import { VolumeFlowStore } from './volume-flow-store.mjs';

const SYMBOLS = ['GLD', 'QQQ'];
const STREAM_URL = 'wss://nbstream.binance.com/equity/stream';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function messageToText(data) {
  if (typeof data === 'string') return Promise.resolve(data);
  if (Buffer.isBuffer(data)) return Promise.resolve(data.toString('utf8'));
  if (data instanceof ArrayBuffer) return Promise.resolve(new TextDecoder().decode(data));
  if (ArrayBuffer.isView(data)) return Promise.resolve(new TextDecoder().decode(data));
  if (data && typeof data.text === 'function') return data.text();
  return Promise.resolve(String(data ?? ''));
}

function rowsFromOptionMessage(message) {
  const root = message?.data ?? message;
  if (Array.isArray(root)) return root;
  if (!root || typeof root !== 'object') return [];
  for (const key of ['q', 't', 'g', 'v', 'quotes', 'list', 'items']) {
    if (Array.isArray(root[key])) return root[key];
  }
  if (Array.isArray(root.data)) return root.data;
  if (root.os || root.optionSymbol || root.symbol) return [root];
  return [];
}

function expiryStream(symbol, expiry) {
  return `${symbol}_${String(expiry).replaceAll('-', '')}_${symbol}@optionChainQuoteDelayed`;
}

function asSafeInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : fallback;
}

function sourceTimeFromRow(row) {
  return row?.E ?? row?.eventTime ?? row?.T ?? row?.time ?? null;
}

export class VolumeFlowCollector {
  constructor({
    optionsService,
    store = new VolumeFlowStore(),
    chainStore = null,
    spotFeed = null,
    WebSocketImpl = globalThis.WebSocket,
    maxExpiriesPerSymbol = Number(process.env.VOLUME_COLLECTOR_EXPIRIES || 512),
    universeRefreshMs = Number(process.env.VOLUME_COLLECTOR_UNIVERSE_REFRESH_MS || 15 * 60_000),
    scanIntervalMs = Number(process.env.VOLUME_COLLECTOR_SCAN_INTERVAL_MS || 1_000),
    reconnectMinMs = Number(process.env.VOLUME_COLLECTOR_RECONNECT_MIN_MS || 1_000),
    reconnectMaxMs = Number(process.env.VOLUME_COLLECTOR_RECONNECT_MAX_MS || 30_000),
    now = () => Date.now()
  } = {}) {
    if (!optionsService || typeof optionsService.getExpiries !== 'function' || typeof optionsService.getVolumeSnapshot !== 'function') {
      throw new Error('Volume Flow Collector requires getExpiries() and getVolumeSnapshot().');
    }
    this.optionsService = optionsService;
    this.store = store;
    this.chainStore = chainStore;
    this.spotFeed = spotFeed;
    this.WebSocketImpl = WebSocketImpl;
    this.maxExpiriesPerSymbol = Math.max(1, Math.min(512, asSafeInteger(maxExpiriesPerSymbol, 512)));
    this.universeRefreshMs = Math.max(60_000, asSafeInteger(universeRefreshMs, 15 * 60_000));
    this.scanIntervalMs = Math.max(250, asSafeInteger(scanIntervalMs, 1_000));
    this.reconnectMinMs = Math.max(250, asSafeInteger(reconnectMinMs, 1_000));
    this.reconnectMaxMs = Math.max(this.reconnectMinMs, asSafeInteger(reconnectMaxMs, 30_000));
    this.now = now;

    this.running = false;
    this.state = 'idle';
    this.detail = '';
    this.socket = null;
    this.socketOpen = false;
    this.streamNames = [];
    this.streamInfo = new Map();
    this.scanUniverse = [];
    this.scanCursor = 0;
    this.pendingContracts = new Map();
    this.reconnectTimer = null;
    this.universeTimer = null;
    this.scanTimer = null;
    this.scanInFlight = false;
    this.reconnectDelay = this.reconnectMinMs;
    this.lastMessageAt = null;
    this.lastEventAt = null;
    this.messageCount = 0;
    this.eventCount = 0;
    this.scanTickCount = 0;
    this.restScanCount = 0;
    this.restScanChangedContracts = 0;
    this.restScanCheckedContracts = 0;
    this.lastScanAt = null;
    this.lastScanCompletedAt = null;
    this.lastRestScanAt = null;
    this.lastRestScanSymbol = null;
    this.lastRestScanExpiry = null;
    this.lastRestScanError = '';
    this.restScanErrorCount = 0;
    this.restScanBackoffMs = 0;
    this.restScanNextAllowedAt = 0;
    this.lastFlushChangedContracts = 0;
    this.lastFlushAt = null;
    this.symbolStatus = Object.fromEntries(SYMBOLS.map(symbol => [symbol, {
      state: 'discovering', expiries: [], lastMessageAt: null, lastEventAt: null,
      messages: 0, events: 0, contracts: 0, stored_chain_contracts: 0, error: ''
    }]));
  }

  async start() {
    if (this.running) return this.status();
    this.running = true;
    this.state = 'discovering';
    this.detail = 'Đang tìm toàn bộ expiry và tạo baseline cho full option chain.';
    try {
      await this.#refreshUniverse({ reconnect: false });
      if (this.streamNames.length) this.#connect();
      else this.#scheduleUniverseRefresh(30_000);
      this.#startScanner();
      this.#scheduleUniverseRefresh(this.universeRefreshMs);
    } catch (error) {
      this.state = 'error';
      this.detail = error?.message || String(error);
      this.#startScanner();
      this.#scheduleUniverseRefresh(30_000);
    }
    return this.status();
  }

  async #refreshUniverse({ reconnect = true } = {}) {
    if (!this.running) return;
    this.state = 'discovering';
    const nextStreams = [];
    const nextInfo = new Map();
    const nextUniverse = [];

    for (const symbol of SYMBOLS) {
      const symbolState = this.symbolStatus[symbol];
      symbolState.state = 'discovering';
      symbolState.error = '';
      try {
        const result = await this.optionsService.getExpiries(symbol, this.maxExpiriesPerSymbol);
        const freshExpiries = (result?.expiries || []).map(item => String(item.expiry || item.date || '')).filter(Boolean);
        if (this.chainStore) this.chainStore.replaceExpiryInventory(symbol, result?.expiries || freshExpiries.map(expiry => ({ expiry })), {
          source: result?.source || 'exchange-info', updatedAt: this.now()
        });
        // Preserve every previously discovered future expiry if one upstream
        // inventory source temporarily returns a shorter list.
        const cachedExpiries = this.chainStore?.listExpiries(symbol).map(item => item.expiry) || [];
        const expiries = [...new Set([...freshExpiries, ...cachedExpiries])]
          .filter(Boolean).sort().slice(0, this.maxExpiriesPerSymbol);
        symbolState.expiries = expiries;
        if (!expiries.length) {
          symbolState.state = 'no-expiry';
          symbolState.error = result?.warning || 'Không tìm thấy expiry có contract.';
          continue;
        }
        for (const expiry of expiries) {
          const stream = expiryStream(symbol, expiry);
          nextStreams.push(stream);
          nextInfo.set(stream, { symbol, expiry });
          nextUniverse.push({ symbol, expiry });
        }
      } catch (error) {
        symbolState.state = 'error';
        symbolState.error = error?.message || String(error);
      }
    }

    // Bootstrap every missing expiry once. Existing full-chain snapshots are not
    // downloaded again during later inventory refreshes; the 1-second scanner
    // checks one expiry at a time and merges only changed contract fields.
    for (const { symbol, expiry } of nextUniverse) {
      if (!this.running) return;
      const needsHydration = this.chainStore?.needsHydration?.(symbol, expiry) ?? !this.chainStore?.hasChain?.(symbol, expiry);
      if (!needsHydration) continue;
      try {
        const snapshot = typeof this.optionsService.getFullChainSnapshot === 'function'
          ? await this.optionsService.getFullChainSnapshot(symbol, expiry)
          : await this.optionsService.getVolumeSnapshot(symbol, expiry);
        if (this.chainStore && snapshot?.contracts) {
          this.chainStore.saveChainSnapshot({ ...snapshot, symbol, expiry }, {
            source: 'rest-bootstrap', updatedAt: this.now()
          });
        }
        for (const contract of snapshot?.contracts || []) {
          const result = this.store.ingest({ ...contract, symbol, expiry, ...this.#spotContext(symbol) }, {
            source: 'rest-bootstrap', observedAt: this.now()
          });
          if (result.event) this.#countEvent(symbol, result.event);
        }
        if (snapshot?.quote_error) this.symbolStatus[symbol].error = snapshot.quote_error;
      } catch (error) {
        this.symbolStatus[symbol].error = error?.message || String(error);
      }
      // Prevent a burst of quote batches while hydrating many expiries.
      await sleep(150);
    }

    this.scanUniverse = nextUniverse;
    if (this.scanCursor >= this.scanUniverse.length) this.scanCursor = 0;
    for (const symbol of SYMBOLS) {
      this.symbolStatus[symbol].contracts = this.store.listContracts({ symbol, limit: 5_000 }).length;
      this.symbolStatus[symbol].stored_chain_contracts = this.chainStore?.listExpiries(symbol)
        .reduce((sum, item) => sum + (Number(item.storedContracts) || 0), 0) || 0;
    }

    const changed = nextStreams.join('|') !== this.streamNames.join('|');
    this.streamNames = nextStreams;
    this.streamInfo = nextInfo;
    if (reconnect && changed) {
      this.#closeSocket();
      if (this.streamNames.length) this.#connect();
    }
    if (!this.streamNames.length) {
      this.state = 'waiting-expiries';
      this.detail = 'Chưa có stream expiry để theo dõi.';
    } else if (!this.socketOpen && !this.socket) {
      this.state = 'connecting';
      this.detail = `Đã chuẩn bị ${this.streamNames.length} expiry stream.`;
    }
  }

  #spotContext(symbol) {
    try {
      const snapshot = this.spotFeed?.snapshot?.(symbol);
      if (!snapshot || !(Number(snapshot.price) > 0)) return {};
      return {
        underlyingSpot: Number(snapshot.price),
        spotTimeMs: snapshot.priceTime ?? snapshot.time ?? snapshot.receivedAt ?? null,
        spotAgeMs: snapshot.priceAgeMs ?? snapshot.ageMs ?? snapshot.receivedAgeMs ?? null
      };
    } catch {
      return {};
    }
  }

  #startScanner() {
    if (!this.running || this.scanTimer) return;
    this.scanTimer = setInterval(() => {
      this.#scanTick().catch(error => {
        this.lastRestScanError = error?.message || String(error);
      });
    }, this.scanIntervalMs);
    this.scanTimer.unref?.();
  }

  async scanNow() {
    return this.#scanTick();
  }

  async #scanTick() {
    if (!this.running || this.scanInFlight) return { skipped: true, reason: 'scanner-busy-or-stopped' };
    this.scanInFlight = true;
    const scanStartedAt = this.now();
    this.scanTickCount++;
    this.lastScanAt = scanStartedAt;
    let restScanned = false;
    let restResult = null;
    try {
      // Round-robin REST reconciliation: one expiry per second, never every expiry
      // in one burst. The REST response is compared with SQLite and only changed
      // contracts are written. Any WebSocket deltas queued while this request runs
      // are flushed afterward so push updates take precedence over a stale snapshot.
      const target = this.scanUniverse.length
        ? this.scanUniverse[this.scanCursor % this.scanUniverse.length]
        : null;
      if (target && scanStartedAt >= this.restScanNextAllowedAt) {
        this.scanCursor = (this.scanCursor + 1) % this.scanUniverse.length;
        try {
          const snapshot = typeof this.optionsService.getFullChainSnapshot === 'function'
            ? await this.optionsService.getFullChainSnapshot(target.symbol, target.expiry)
            : await this.optionsService.getVolumeSnapshot(target.symbol, target.expiry);
          const updatedAt = this.now();
          // If a WebSocket update for this same expiry arrived while the REST
          // snapshot was in flight, do not let a potentially older REST value
          // overwrite that contract. Its queued push update is flushed below.
          const pendingSymbols = new Set([...this.pendingContracts.values()]
            .filter(item => item.symbol === target.symbol && item.expiry === target.expiry)
            .map(item => item.optionSymbol));
          const scanContracts = (snapshot?.contracts || []).filter(item =>
            !pendingSymbols.has(String(item.optionSymbol ?? item.os ?? item.symbol ?? '').toUpperCase()));
          const filteredSnapshot = { ...snapshot, contracts: scanContracts };
          let merge = { checked: scanContracts.length, inserted: 0, changed: 0, unchanged: 0 };
          if (this.chainStore && Array.isArray(snapshot?.contracts)) {
            merge = this.chainStore.mergeChainSnapshot({ ...filteredSnapshot, symbol: target.symbol, expiry: target.expiry }, {
              source: 'rest-scan', updatedAt
            });
          }
          for (const contract of scanContracts) {
            const result = this.store.ingest({ ...contract, symbol: target.symbol, expiry: target.expiry, ...this.#spotContext(target.symbol) }, {
              source: 'rest-scan', observedAt: updatedAt,
              sourceTimeMs: contract.sourceTimeMs ?? contract.eventTime ?? contract.E ?? null
            });
            if (result.event) this.#countEvent(target.symbol, result.event);
          }
          this.restScanCount++;
          this.restScanCheckedContracts += Number(merge.checked) || 0;
          this.restScanChangedContracts += (Number(merge.inserted) || 0) + (Number(merge.changed) || 0);
          this.lastRestScanAt = updatedAt;
          this.lastRestScanSymbol = target.symbol;
          this.lastRestScanExpiry = target.expiry;
          this.lastRestScanError = snapshot?.quote_error || '';
          this.restScanErrorCount = 0;
          this.restScanBackoffMs = 0;
          this.restScanNextAllowedAt = 0;
          restScanned = true;
          restResult = { target, ...merge };
        } catch (error) {
          this.lastRestScanError = error?.message || String(error);
          this.lastRestScanAt = this.now();
          this.lastRestScanSymbol = target.symbol;
          this.lastRestScanExpiry = target.expiry;
          this.restScanErrorCount++;
          this.restScanBackoffMs = Math.min(30_000, Math.max(2_000, this.restScanBackoffMs ? this.restScanBackoffMs * 2 : 2_000));
          this.restScanNextAllowedAt = this.now() + this.restScanBackoffMs;
        }
      }

      const flush = this.#flushPendingContracts(this.now());
      this.lastFlushChangedContracts = flush.changedContracts;
      if (flush.processedContracts) this.lastFlushAt = this.now();
      this.lastScanCompletedAt = this.now();
      return { ok: true, restScanned, restResult, ...flush };
    } finally {
      this.scanInFlight = false;
    }
  }

  #flushPendingContracts(observedAt) {
    const queued = [...this.pendingContracts.values()];
    this.pendingContracts.clear();
    if (!queued.length) return { processedContracts: 0, changedContracts: 0, events: 0 };

    const groups = new Map();
    for (const entry of queued) {
      const key = `${entry.symbol}|${entry.expiry}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(entry);
    }

    let changedContracts = 0, events = 0;
    for (const rows of groups.values()) {
      const first = rows[0];
      if (this.chainStore) {
        const result = this.chainStore.mergeLiveContracts(first.symbol, first.expiry, rows.map(item => item.row), {
          source: 'websocket', updatedAt: observedAt
        });
        changedContracts += Number(result?.changed) || 0;
      }
      for (const entry of rows) {
        const cached = this.chainStore?.getContract?.(entry.optionSymbol) || {};
        const input = { ...cached, ...entry.row, optionSymbol: entry.optionSymbol, symbol: entry.symbol, expiry: entry.expiry };
        // Short field aliases in the stream must override canonical fields from the cached contract.
        const aliases = {
          volume: ['volume', 'v'], bid: ['bid', 'bidPrice', 'bp'], ask: ['ask', 'askPrice', 'ap'],
          mid: ['mid', 'midPrice', 'mp'], last: ['last', 'lastPrice', 'p', 'l'],
          side: ['side', 'contractType', 'optionType', 't'], strike: ['strike', 'strikePrice', 'sp', 'k']
        };
        for (const [field, keys] of Object.entries(aliases)) {
          for (const key of keys) {
            if (Object.prototype.hasOwnProperty.call(entry.row, key) && entry.row[key] !== null && entry.row[key] !== '') {
              input[field] = entry.row[key];
              break;
            }
          }
        }
        input.quoteUpdatedAt = cached.quoteUpdatedAt ?? null;
        if (['bid', 'bidPrice', 'bp', 'ask', 'askPrice', 'ap', 'mid', 'midPrice', 'mp', 'last', 'lastPrice', 'p', 'l']
          .some(key => Object.prototype.hasOwnProperty.call(entry.row, key) && Number(entry.row[key]) > 0)) {
          input.quoteUpdatedAt = observedAt;
        }
        Object.assign(input, this.#spotContext(entry.symbol));
        const result = this.store.ingest(input, {
          source: 'websocket', observedAt,
          sourceTimeMs: entry.sourceTimeMs
        });
        if (result.event) {
          events++;
          this.#countEvent(entry.symbol, result.event);
        }
      }
    }
    return { processedContracts: queued.length, changedContracts, events };
  }

  #connect() {
    if (!this.running || !this.streamNames.length || this.socket) return;
    if (typeof this.WebSocketImpl !== 'function') {
      this.state = 'error';
      this.detail = 'Node.js cần WebSocket toàn cục (Node.js 22+).';
      return;
    }
    this.state = 'connecting';
    this.detail = 'Đang kết nối Binance Equity Option WebSocket.';
    let socket;
    try {
      socket = new this.WebSocketImpl(STREAM_URL);
    } catch (error) {
      this.state = 'error';
      this.detail = error?.message || String(error);
      this.#scheduleReconnect();
      return;
    }
    this.socket = socket;
    socket.addEventListener('open', async () => {
      if (!this.running || this.socket !== socket) return;
      this.socketOpen = true;
      this.state = 'subscribed';
      this.detail = `WebSocket connected; subscribing ${this.streamNames.length} expiry streams and waiting for first market payload.`;
      this.reconnectDelay = this.reconnectMinMs;
      try {
        const batchSize = 100;
        for (let offset = 0; offset < this.streamNames.length; offset += batchSize) {
          if (!this.running || this.socket !== socket) return;
          const params = this.streamNames.slice(offset, offset + batchSize);
          socket.send(JSON.stringify({ method: 'SUBSCRIBE', params, id: Math.floor(this.now() % 2_000_000_000) + Math.floor(offset / batchSize) }));
          // Binance counts control messages; stay below its per-connection message rate.
          if (offset + batchSize < this.streamNames.length) await sleep(250);
        }
      } catch (error) {
        this.detail = `Không gửi được SUBSCRIBE: ${error?.message || error}`;
        try { socket.close(); } catch {}
      }
    });
    socket.addEventListener('message', event => {
      if (!this.running || this.socket !== socket) return;
      this.#handleMessage(event.data).catch(error => {
        this.detail = `Không xử lý được Option stream: ${error?.message || error}`;
      });
    });
    socket.addEventListener('error', () => {
      if (this.socket !== socket) return;
      this.state = 'error';
      this.detail = 'Binance Equity Option WebSocket báo lỗi mạng.';
    });
    socket.addEventListener('close', () => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.socketOpen = false;
      if (!this.running) return;
      this.state = 'reconnecting';
      this.detail = 'Option WebSocket đã đóng; đang lên lịch kết nối lại.';
      this.#scheduleReconnect();
    });
  }

  async #handleMessage(raw) {
    const text = await messageToText(raw);
    let message;
    try { message = JSON.parse(text); } catch { return; }
    if (message && message.id !== undefined && (Object.prototype.hasOwnProperty.call(message, 'result') || message.code !== undefined)) {
      if (message.code !== undefined && message.code !== null) {
        this.state = 'error';
        this.detail = `Binance ${message.code}: ${message.msg || 'subscription rejected'}`;
        for (const symbol of SYMBOLS) this.symbolStatus[symbol].error = this.detail;
      } else {
        this.state = 'subscribed';
        this.detail = `Binance acknowledged ${this.streamNames.length} expiry streams; waiting for market payload.`;
      }
      return;
    }

    const now = this.now();
    this.lastMessageAt = now;
    this.messageCount++;
    const streamName = String(message?.stream || '');
    const streamContext = this.streamInfo.get(streamName) || null;
    const rows = rowsFromOptionMessage(message);
    if (!rows.length) return;

    this.state = 'live';
    this.detail = `Receiving Binance option-chain updates (${this.messageCount} payloads). Incremental scanner persists changes every ${this.scanIntervalMs} ms.`;
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue;
      const optionSymbol = String(row.optionSymbol ?? row.os ?? row.symbol ?? '').toUpperCase();
      const prefixSymbol = optionSymbol.startsWith('GLD') ? 'GLD' : optionSymbol.startsWith('QQQ') ? 'QQQ' : '';
      const context = streamContext || (prefixSymbol ? { symbol: prefixSymbol, expiry: '' } : null);
      if (!context || !optionSymbol) continue;
      const expiry = context.expiry || String(row.expiration || row.expiry || '').slice(0, 10);
      if (!expiry) continue;
      // Keep only the latest cumulative contract snapshot inside the 1-second
      // scan window. Volume increments between messages are retained in the
      // cumulative counter and become one accurate delta when flushed.
      this.pendingContracts.set(optionSymbol, {
        optionSymbol, symbol: context.symbol, expiry, row: { ...row, optionSymbol },
        sourceTimeMs: sourceTimeFromRow(row)
      });
      const target = this.symbolStatus[context.symbol];
      if (target) {
        target.lastMessageAt = now;
        target.messages++;
      }
    }
  }

  #countEvent(symbol, event) {
    this.eventCount++;
    this.lastEventAt = event.observedAt;
    const target = this.symbolStatus[symbol];
    if (target) {
      target.events++;
      target.lastEventAt = event.observedAt;
    }
  }

  #scheduleReconnect() {
    if (!this.running || this.reconnectTimer || !this.streamNames.length) return;
    const delay = this.reconnectDelay;
    this.reconnectDelay = Math.min(this.reconnectMaxMs, Math.max(this.reconnectMinMs, delay * 2));
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.#connect();
    }, delay);
    this.reconnectTimer.unref?.();
  }

  #scheduleUniverseRefresh(delay) {
    if (!this.running || this.universeTimer) return;
    this.universeTimer = setTimeout(async () => {
      this.universeTimer = null;
      try {
        await this.#refreshUniverse({ reconnect: true });
        if (!this.socket && this.streamNames.length) this.#connect();
      } catch (error) {
        this.state = 'error';
        this.detail = error?.message || String(error);
      }
      this.#scheduleUniverseRefresh(this.universeRefreshMs);
    }, delay);
    this.universeTimer.unref?.();
  }

  #closeSocket() {
    const socket = this.socket;
    this.socket = null;
    this.socketOpen = false;
    if (socket) {
      try { socket.close(1000, 'volume collector refresh'); } catch {}
    }
  }

  status() {
    const counts = this.store.getStatusCounts();
    const totalScannerUniverse = this.scanUniverse.length;
    return {
      ok: true,
      enabled: this.running,
      state: this.state,
      detail: this.detail,
      source: 'binance-equity-option-websocket+round-robin-rest-scanner',
      state_note: this.state === 'subscribed' ? 'Subscription acknowledged; waiting for market payload. REST scanner remains active.' : this.state === 'live' ? 'Market payload received; queued updates are persisted by the 1-second scanner.' : this.detail,
      capture: 'volume-delta-only',
      option_chain_persistence: 'changed-contracts-only',
      interval: '1-second scan; one expiry REST snapshot per tick, plus WebSocket push',
      scan_interval_ms: this.scanIntervalMs,
      scanner_ticks: this.scanTickCount,
      scanner_busy: this.scanInFlight,
      pending_contracts: this.pendingContracts.size,
      last_scan_at: this.lastScanAt ? new Date(this.lastScanAt).toISOString() : null,
      last_scan_completed_at: this.lastScanCompletedAt ? new Date(this.lastScanCompletedAt).toISOString() : null,
      last_flush_at: this.lastFlushAt ? new Date(this.lastFlushAt).toISOString() : null,
      last_flush_changed_contracts: this.lastFlushChangedContracts,
      rest_scan: {
        expiries_in_cycle: totalScannerUniverse,
        one_expiry_per_tick: true,
        scans_completed: this.restScanCount,
        contracts_checked: this.restScanCheckedContracts,
        contracts_changed: this.restScanChangedContracts,
        last_at: this.lastRestScanAt ? new Date(this.lastRestScanAt).toISOString() : null,
        last_symbol: this.lastRestScanSymbol,
        last_expiry: this.lastRestScanExpiry,
        last_error: this.lastRestScanError || null,
        consecutive_errors: this.restScanErrorCount,
        backoff_ms: this.restScanBackoffMs,
        next_allowed_at: this.restScanNextAllowedAt ? new Date(this.restScanNextAllowedAt).toISOString() : null,
        estimated_full_cycle_seconds: totalScannerUniverse ? totalScannerUniverse * this.scanIntervalMs / 1000 : null
      },
      connected: this.socketOpen,
      subscribed_streams: this.streamNames.length,
      max_expiries_per_symbol: this.maxExpiriesPerSymbol,
      last_message_at: this.lastMessageAt ? new Date(this.lastMessageAt).toISOString() : null,
      last_event_at: this.lastEventAt ? new Date(this.lastEventAt).toISOString() : (counts.lastEventAt ? new Date(counts.lastEventAt).toISOString() : null),
      messages_received: this.messageCount,
      events_this_run: this.eventCount,
      stored_events: counts.eventCount,
      tracked_contracts: counts.contractCount,
      database: this.store.dbPath === ':memory:' ? ':memory:' : 'server/data/gexadecimal-volume-flow.sqlite',
      option_chain_cache: this.chainStore?.status?.() || null,
      symbols: this.symbolStatus
    };
  }

  stop() {
    this.running = false;
    this.state = 'stopped';
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.universeTimer) clearTimeout(this.universeTimer);
    if (this.scanTimer) clearInterval(this.scanTimer);
    this.reconnectTimer = null;
    this.universeTimer = null;
    this.scanTimer = null;
    this.#closeSocket();
  }

  close() {
    this.stop();
    this.store.close();
  }
}

export function createVolumeFlowCollector(options) {
  return new VolumeFlowCollector(options);
}

export { STREAM_URL, expiryStream, rowsFromOptionMessage };
