const DEFAULT_URL = 'wss://nbstream.binance.com/equity/stream';
const ALLOWED_SYMBOLS = new Set(['GLD', 'QQQ']);
const SUBSCRIPTIONS = ['price', 'GLD@quote', 'QQQ@quote'];
const numberOrNull = value => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

function ageOf(timestamp, now) {
  const value = numberOrNull(timestamp);
  return value !== null && value > 0 ? Math.max(0, now - value) : null;
}

async function messageText(data) {
  if (typeof data === 'string') return data;
  if (Buffer.isBuffer(data)) return data.toString('utf8');
  if (data instanceof ArrayBuffer) return new TextDecoder().decode(data);
  if (ArrayBuffer.isView(data)) return new TextDecoder().decode(data);
  if (data && typeof data.text === 'function') return data.text();
  return String(data ?? '');
}

function rowsFromPayload(payload) {
  const data = payload?.data ?? payload;
  if (Array.isArray(data?.rates)) return data.rates;
  if (Array.isArray(data)) return data;
  return data && typeof data === 'object' ? [data] : [];
}

function symbolFromRow(row) {
  return String(row?.s ?? row?.symbol ?? '').toUpperCase();
}

function spotFromRow(row, receivedAt) {
  if (!row) return null;
  const symbol = symbolFromRow(row);
  const assetCode = String(row.ac ?? row.assetCode ?? '').toUpperCase();
  const resolvedSymbol = ALLOWED_SYMBOLS.has(symbol)
    ? symbol
    : (assetCode.startsWith('EQ_') && ALLOWED_SYMBOLS.has(assetCode.slice(3)) ? assetCode.slice(3) : null);
  if (!resolvedSymbol) return null;

  const price = numberOrNull(row.p ?? row.price ?? row.c ?? row.close);
  if (!(price > 0)) return null;
  return {
    ok: true,
    symbol: resolvedSymbol,
    price,
    priceType: 'last',
    bid: null,
    ask: null,
    previousClose: numberOrNull(row.pc ?? row.prevClose ?? row.lastRegularClose ?? row.prc ?? row.prevRegularClose),
    priceTime: numberOrNull(row.t ?? row.time ?? row.E ?? row.eventTime),
    marketPhase: typeof row.mp === 'string' ? row.mp.toUpperCase() : null,
    receivedAt,
    source: 'binance-equity-price-stream'
  };
}

function quoteFromPayload(payload, receivedAt, previousPrice) {
  const data = payload?.data ?? payload;
  if (String(data?.e ?? '').toLowerCase() !== 'quote') return null;
  const symbol = symbolFromRow(data);
  if (!ALLOWED_SYMBOLS.has(symbol)) return null;
  const bid = numberOrNull(data.bp);
  const ask = numberOrNull(data.ap);
  if (!(bid > 0) || !(ask > 0) || ask < bid) return null;
  const sourceTime = numberOrNull(data.T);
  return {
    ok: true,
    symbol,
    price: (bid + ask) / 2,
    priceType: 'midquote',
    bid,
    ask,
    previousClose: previousPrice?.previousClose ?? null,
    // Binance documents T as the source quote timestamp; preserve null rather than
    // substituting the server event/receive time and implying a fresh quote.
    priceTime: sourceTime,
    eventTime: numberOrNull(data.E),
    marketPhase: null,
    receivedAt,
    source: 'binance-equity-quote-stream'
  };
}

/**
 * One persistent Binance Stocks WebSocket connection subscribes to:
 * - `price`: Last Price snapshots for all active US-equity symbols.
 * - `GLD@quote` and `QQQ@quote`: per-symbol best bid/ask fallback streams.
 *
 * The API prefers a recent Last Price. It uses a clearly-labelled Bid/Ask
 * midpoint when the Last Price is missing or stale, and retains the last known
 * regular-session price when the market is closed.
 */
export function createEquityPriceFeed({
  WebSocketImpl = globalThis.WebSocket,
  url = DEFAULT_URL,
  reconnectMinMs = 1_000,
  reconnectMaxMs = 30_000,
  snapshotTimeoutMs = 12_000,
  staleAfterMs = 5 * 60_000,
  quoteFreshMs = 60_000,
  lastPricePreferredMs = 15_000
} = {}) {
  const lastPrices = new Map();
  const quotePrices = new Map();
  const waiters = new Map();
  let socket = null;
  let state = 'idle';
  let detail = '';
  let lastMessageAt = 0;
  let lastPriceMessageAt = 0;
  let lastQuoteMessageAt = 0;
  let priceMessageCount = 0;
  let quoteMessageCount = 0;
  let reconnectDelay = reconnectMinMs;
  let reconnectTimer = null;
  let watchdogTimer = null;
  let closed = false;
  let subscriptionId = 1;

  function classify(item, now = Date.now()) {
    if (!item) return null;
    const priceAgeMs = ageOf(item.priceTime, now);
    const receivedAgeMs = ageOf(item.receivedAt, now) ?? 0;
    let feedState = 'unknown-age';
    if (item.marketPhase === 'C') {
      feedState = 'closed';
    } else if (priceAgeMs !== null) {
      if (item.priceType === 'midquote') {
        feedState = priceAgeMs <= quoteFreshMs ? 'live-midquote' : 'stale';
      } else {
        feedState = priceAgeMs <= staleAfterMs ? 'live' : 'stale';
      }
    }
    return {
      ...item,
      priceAgeMs,
      receivedAgeMs,
      // Backward-compatible alias: ageMs now means the age of the actual market
      // price/quote, not how recently the server received a repeated snapshot.
      ageMs: priceAgeMs,
      feedState
    };
  }

  function selectSnapshot(symbol, now = Date.now()) {
    const last = lastPrices.get(symbol) || null;
    const quote = quotePrices.get(symbol) || null;
    if (!last) return classify(quote, now);
    if (!quote) return classify(last, now);

    const lastAge = ageOf(last.priceTime, now);
    const quoteAge = ageOf(quote.priceTime, now);
    const quoteReceivedAge = ageOf(quote.receivedAt, now) ?? Infinity;
    const quoteIsFresh = quoteAge !== null
      ? quoteAge <= quoteFreshMs
      : quoteReceivedAge <= quoteFreshMs;
    const lastIsRecent = lastAge !== null && lastAge <= lastPricePreferredMs;

    // Prefer a fresh Last Price. When it is absent/stale, use a recent quote
    // midpoint instead. A CLOSED Last Price remains the correct fallback when
    // there is no fresh quote update.
    if (quoteIsFresh && !lastIsRecent) {
      return classify({ ...quote, previousClose: last.previousClose ?? quote.previousClose }, now);
    }
    return classify(last, now);
  }

  function isUsableSnapshot(current) {
    if (!current) return false;
    if (['live', 'live-midquote', 'closed'].includes(current.feedState)) return true;
    // Binance allows the quote source timestamp T to be null. In that case the
    // quote remains usable as a reference only while it was just received, and
    // the API explicitly reports unknown-age rather than inventing a timestamp.
    return current.feedState === 'unknown-age'
      && current.priceType === 'midquote'
      && current.receivedAgeMs <= quoteFreshMs;
  }

  function resolveWaiters(symbol) {
    const pending = waiters.get(symbol);
    if (!pending?.length) return;
    const current = selectSnapshot(symbol);
    if (!isUsableSnapshot(current)) return;
    waiters.delete(symbol);
    for (const waiter of pending) {
      clearTimeout(waiter.timer);
      waiter.resolve(current);
    }
  }

  function updateConnectionSummary() {
    const available = [...ALLOWED_SYMBOLS].some(symbol => Boolean(selectSnapshot(symbol)));
    if (available) {
      state = 'ok';
      if (lastQuoteMessageAt > lastPriceMessageAt) {
        detail = 'Connected; Last Price and per-symbol quote streams are active.';
      } else {
        detail = 'Connected; Binance Stocks Price Stream is active.';
      }
    } else if (lastMessageAt) {
      state = 'symbol-missing';
      detail = 'Price/quote messages received, but no valid GLD/QQQ price has been cached yet.';
    }
  }

  function publish(payload) {
    const receivedAt = Date.now();
    const data = payload?.data ?? payload;
    if (!data || typeof data !== 'object') return false;

    if (String(data.e ?? '').toLowerCase() === 'quote') {
      const symbol = symbolFromRow(data);
      const quote = quoteFromPayload(data, receivedAt, lastPrices.get(symbol));
      if (!quote) return false;
      quotePrices.set(symbol, quote);
      lastMessageAt = receivedAt;
      lastQuoteMessageAt = receivedAt;
      quoteMessageCount++;
      updateConnectionSummary();
      resolveWaiters(symbol);
      return true;
    }

    const rows = rowsFromPayload(data);
    if (!rows.length) return false;
    lastMessageAt = receivedAt;
    lastPriceMessageAt = receivedAt;
    priceMessageCount++;
    const updatedSymbols = new Set();
    for (const row of rows) {
      const spot = spotFromRow(row, receivedAt);
      if (!spot) continue;
      lastPrices.set(spot.symbol, spot);
      updatedSymbols.add(spot.symbol);
    }
    updateConnectionSummary();
    for (const symbol of updatedSymbols) resolveWaiters(symbol);
    return true;
  }

  function armWatchdog() {
    if (watchdogTimer) clearTimeout(watchdogTimer);
    watchdogTimer = setTimeout(() => {
      watchdogTimer = null;
      if (closed) return;
      if (lastMessageAt && Date.now() - lastMessageAt < snapshotTimeoutMs) return;
      state = 'timeout';
      detail = `No Binance Stocks stream message received for ${Math.round(snapshotTimeoutMs / 1000)} seconds.`;
      try { socket?.close(4000, 'price stream timeout'); } catch {}
    }, snapshotTimeoutMs);
    watchdogTimer.unref?.();
  }

  function scheduleReconnect() {
    if (closed || reconnectTimer) return;
    const wait = reconnectDelay;
    reconnectDelay = Math.min(reconnectMaxMs, Math.max(reconnectMinMs, wait * 2));
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, wait);
    reconnectTimer.unref?.();
  }

  function connect() {
    if (closed || socket || reconnectTimer) return;
    if (typeof WebSocketImpl !== 'function') {
      state = 'error';
      detail = 'Node.js global WebSocket is unavailable; use Node.js 22 or newer.';
      scheduleReconnect();
      return;
    }
    state = 'connecting';
    detail = `Connecting to ${url}`;
    let current;
    try { current = new WebSocketImpl(url); }
    catch (error) {
      state = 'error';
      detail = error?.message || String(error);
      scheduleReconnect();
      return;
    }
    socket = current;
    current.addEventListener('open', () => {
      if (socket !== current || closed) return;
      state = 'connected-waiting';
      detail = 'Binance Stocks WebSocket connected; subscribing to price + GLD/QQQ quotes.';
      try {
        current.send(JSON.stringify({ method: 'SUBSCRIBE', params: SUBSCRIPTIONS, id: subscriptionId++ }));
      } catch (error) {
        state = 'error';
        detail = `Could not subscribe to Binance Stocks streams: ${error?.message || error}`;
        try { current.close(1011, 'subscription failed'); } catch {}
        return;
      }
      armWatchdog();
    });
    current.addEventListener('message', async event => {
      if (socket !== current || closed) return;
      try {
        const parsed = JSON.parse(await messageText(event.data));
        // Subscription acknowledgements have an id/result but no market event.
        if (parsed && parsed.id !== undefined && parsed.result === null) return;
        if (publish(parsed)) {
          reconnectDelay = reconnectMinMs;
          armWatchdog();
        }
      } catch (error) {
        detail = `Could not parse Binance Stocks stream message: ${error?.message || error}`;
      }
    });
    current.addEventListener('error', () => {
      if (socket !== current || closed) return;
      state = 'error';
      detail = 'Binance Stocks WebSocket error.';
    });
    current.addEventListener('close', event => {
      if (socket === current) socket = null;
      if (watchdogTimer) { clearTimeout(watchdogTimer); watchdogTimer = null; }
      if (closed) return;
      state = 'reconnecting';
      detail = event?.reason || 'Binance Stocks WebSocket closed; reconnecting.';
      scheduleReconnect();
    });
  }

  function snapshot(symbol) {
    const key = String(symbol || '').toUpperCase();
    if (!ALLOWED_SYMBOLS.has(key)) throw new Error('Only GLD and QQQ Spot are supported.');
    return selectSnapshot(key);
  }

  function get(symbol, { timeoutMs = 10_000 } = {}) {
    const key = String(symbol || '').toUpperCase();
    if (!ALLOWED_SYMBOLS.has(key)) return Promise.reject(new Error('Only GLD and QQQ Spot are supported.'));
    const cached = snapshot(key);
    if (isUsableSnapshot(cached)) return Promise.resolve(cached);
    connect();
    return new Promise((resolve, reject) => {
      const list = waiters.get(key) || [];
      const waiter = {
        resolve,
        timer: setTimeout(() => {
          const current = waiters.get(key) || [];
          waiters.set(key, current.filter(item => item !== waiter));
          reject(new Error(`${key} Spot not received within ${Math.ceil(timeoutMs / 1000)} seconds (${state}: ${detail})`));
        }, timeoutMs)
      };
      waiter.timer.unref?.();
      list.push(waiter);
      waiters.set(key, list);
    });
  }

  function status() {
    const now = Date.now();
    return {
      state,
      detail,
      lastMessageAt: lastMessageAt || null,
      messageAgeMs: lastMessageAt ? Math.max(0, now - lastMessageAt) : null,
      lastPriceMessageAt: lastPriceMessageAt || null,
      lastQuoteMessageAt: lastQuoteMessageAt || null,
      messageCounts: { price: priceMessageCount, quote: quoteMessageCount },
      symbols: Object.fromEntries([...ALLOWED_SYMBOLS].map(symbol => [symbol, snapshot(symbol)]))
    };
  }

  function close() {
    closed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (watchdogTimer) clearTimeout(watchdogTimer);
    reconnectTimer = watchdogTimer = null;
    try { socket?.close(1000, 'server shutdown'); } catch {}
    socket = null;
    for (const pending of waiters.values()) {
      for (const waiter of pending) {
        clearTimeout(waiter.timer);
        waiter.reject(new Error('Spot feed closed.'));
      }
    }
    waiters.clear();
    state = 'closed';
  }

  return { get, snapshot, status, close, connect };
}
