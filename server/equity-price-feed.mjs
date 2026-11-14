const DEFAULT_URL = 'wss://nbstream.binance.com/equity/ws/price';
const ALLOWED_SYMBOLS = new Set(['GLD', 'QQQ']);
const numberOrNull = value => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

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

function spotFromRow(row, symbol, receivedAt) {
  if (!row) return null;
  const ticker = String(row.s ?? row.symbol ?? '').toUpperCase();
  const assetCode = String(row.ac ?? row.assetCode ?? '').toUpperCase();
  if (ticker !== symbol && assetCode !== `EQ_${symbol}`) return null;
  const price = numberOrNull(row.p ?? row.price ?? row.c ?? row.close);
  if (!(price > 0)) return null;
  return {
    ok: true,
    symbol,
    price,
    previousClose: numberOrNull(row.pc ?? row.prevClose ?? row.lastRegularClose ?? row.prc ?? row.prevRegularClose),
    priceTime: numberOrNull(row.t ?? row.time ?? row.E ?? row.eventTime),
    marketPhase: typeof row.mp === 'string' ? row.mp.toUpperCase() : null,
    receivedAt,
    source: 'binance-equity-price-stream'
  };
}

/**
 * One persistent Binance push-all Price Stream shared by PWA fallback and
 * Quick Options. The stream is public and does not require an API key.
 */
export function createEquityPriceFeed({
  WebSocketImpl = globalThis.WebSocket,
  url = DEFAULT_URL,
  reconnectMinMs = 1_000,
  reconnectMaxMs = 30_000,
  snapshotTimeoutMs = 12_000
} = {}) {
  const snapshots = new Map();
  const waiters = new Map();
  let socket = null;
  let state = 'idle';
  let detail = '';
  let lastMessageAt = 0;
  let reconnectDelay = reconnectMinMs;
  let reconnectTimer = null;
  let watchdogTimer = null;
  let closed = false;

  function publish(payload) {
    const receivedAt = Date.now();
    const rows = rowsFromPayload(payload);
    if (!rows.length) return false;
    lastMessageAt = receivedAt;
    let count = 0;
    for (const symbol of ALLOWED_SYMBOLS) {
      const row = rows.find(item => {
        const ticker = String(item?.s ?? item?.symbol ?? '').toUpperCase();
        const assetCode = String(item?.ac ?? item?.assetCode ?? '').toUpperCase();
        return ticker === symbol || assetCode === `EQ_${symbol}`;
      });
      const spot = spotFromRow(row, symbol, receivedAt);
      if (!spot) continue;
      snapshots.set(symbol, spot);
      count++;
      const pending = waiters.get(symbol);
      if (pending?.length) {
        waiters.delete(symbol);
        for (const waiter of pending) {
          clearTimeout(waiter.timer);
          waiter.resolve({ ...spot, ageMs: 0, feedState: 'ok' });
        }
      }
    }
    if (count) {
      state = 'ok';
      detail = `Received Price Stream snapshot for ${count} configured symbol(s).`;
      reconnectDelay = reconnectMinMs;
    } else {
      state = 'symbol-missing';
      detail = `Price snapshot received (${rows.length} rows), but GLD/QQQ were absent.`;
    }
    armWatchdog();
    return true;
  }

  function armWatchdog() {
    if (watchdogTimer) clearTimeout(watchdogTimer);
    watchdogTimer = setTimeout(() => {
      watchdogTimer = null;
      if (closed) return;
      if (lastMessageAt && Date.now() - lastMessageAt < snapshotTimeoutMs) return;
      state = 'timeout';
      detail = `No Binance price snapshot received for ${Math.round(snapshotTimeoutMs / 1000)} seconds.`;
      try { socket?.close(4000, 'price snapshot timeout'); } catch {}
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
      detail = 'Binance Price Stream connected; waiting for first snapshot.';
      armWatchdog();
    });
    current.addEventListener('message', async event => {
      if (socket !== current || closed) return;
      try {
        const parsed = JSON.parse(await messageText(event.data));
        publish(parsed);
      } catch (error) {
        state = 'parse-warning';
        detail = `Could not parse Binance Price Stream message: ${error?.message || error}`;
      }
    });
    current.addEventListener('error', () => {
      if (socket !== current || closed) return;
      state = 'error';
      detail = 'Binance Price Stream WebSocket error.';
    });
    current.addEventListener('close', event => {
      if (socket === current) socket = null;
      if (watchdogTimer) { clearTimeout(watchdogTimer); watchdogTimer = null; }
      if (closed) return;
      state = 'reconnecting';
      detail = event?.reason || 'Binance Price Stream closed; reconnecting.';
      scheduleReconnect();
    });
  }

  function snapshot(symbol) {
    const key = String(symbol || '').toUpperCase();
    if (!ALLOWED_SYMBOLS.has(key)) throw new Error('Only GLD and QQQ Spot are supported.');
    const item = snapshots.get(key);
    if (!item) return null;
    return { ...item, ageMs: Math.max(0, Date.now() - item.receivedAt), feedState: state };
  }

  function get(symbol, { timeoutMs = 10_000 } = {}) {
    const key = String(symbol || '').toUpperCase();
    if (!ALLOWED_SYMBOLS.has(key)) return Promise.reject(new Error('Only GLD and QQQ Spot are supported.'));
    const cached = snapshot(key);
    if (cached) return Promise.resolve(cached);
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
    return {
      state,
      detail,
      lastMessageAt: lastMessageAt || null,
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
