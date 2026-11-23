'use strict';
// Regression tests for error handling / self-recovery in js/stock-options.js:
//  1. activate() must release `active` after a failed first load so the next call really retries.
//  2. loadChain(refreshAll=true) must release `hydrating` after a failed request so polling is never blocked.
//  3. After switching expiry with a failed load, the previous expiry's data must not survive or be mapped.
//  4. request() has a timeout and retries transient failures with backoff, but not client errors.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function makeHarness(fetchImpl) {
  let source = fs.readFileSync(path.join(__dirname, '..', 'js', 'stock-options.js'), 'utf8');
  const marker = '  buildViews();\n  window.stockOptionsSetActive=setActive;';
  assert.ok(source.includes(marker), 'test hook marker not found');
  source = source.replace(marker,
    '  buildViews();\n  window.__t={cacheRequest,loadChain,activate,deactivate,refreshQuotes,crossAssetSnapshot,loadExpirations,expiryPartStatus,subscribe,underlyingPriceRow,handlePrice,sessions};\n  window.stockOptionsSetActive=setActive;');
  const elements = new Map();
  const el = id => { if (!elements.has(id)) elements.set(id, { id, value: '', innerHTML: '', textContent: '', dataset: {}, style: {}, hidden: false, className: '', classList: { add() {}, remove() {}, toggle() {} }, appendChild() {}, querySelector() { return null; }, querySelectorAll() { return []; } }); return elements.get(id); };
  const document = { getElementById: el, body: { dataset: {} }, createElement: () => el('tmp' + Math.random()) };
  const window = { BINANCE_STOCK_SPOT_API: 'https://spot.test', BINANCE_STOCK_CACHE_API: 'https://cache.test' };
  const calls = [];
  const fetchStub = (url, opts) => { calls.push({ url: String(url), method: opts?.method || 'GET' }); return fetchImpl(url, opts, calls.length); };
  // Fast timers: the 12s request timeout becomes 20ms, backoff/retry waits become ~2ms.
  const fastTimeout = (fn, ms, ...a) => setTimeout(fn, ms === 12000 ? 20 : Math.min(ms, 2), ...a);
  const intervals = [];
  const sockets = [];
  class FakeWS { constructor(url) { this.url=url; this.readyState = 0; this.closed = false; this.sent=[]; sockets.push(this); } send(data) { this.sent.push(JSON.parse(data)); } close() { this.closed = true; } }
  const interval = (fn, ms, ...a) => { const id = setInterval(fn, ms, ...a); intervals.push(id); return id; };
  const clearIntervalTracked = id => { const i = intervals.indexOf(id); if (i >= 0) intervals.splice(i, 1); clearInterval(id); };
  FakeWS.OPEN = 1;
  const ctx = {
    window, document, console, location: { port: '8787' },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    fetch: fetchStub, AbortController, URLSearchParams, WebSocket: FakeWS,
    setTimeout: fastTimeout, clearTimeout, setInterval: interval, clearInterval: clearIntervalTracked, Intl, Date, Math, JSON, Promise, Map, Set
  };
  vm.runInNewContext(source, ctx, { filename: 'stock-options.js' });
  return { t: window.__t, calls, intervals, sockets };
}

const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) });
const html = (body, status = 200) => ({ ok: status < 400, status, text: async () => body });
const hang = (url, opts) => new Promise((_, reject) => opts.signal.addEventListener('abort', () => reject(new Error('aborted'))));
const SYM = 'QQQ261120C00500000';

function seedLoaded(s, expiry = '2026-11-20') {
  s.active = true; s.expiry = expiry; s.expirations = [{ date: expiry, root: 'QQQ' }];
  s.quotesExpiry = expiry; s.loadedExpiry = expiry; s.chainComplete = true;
  s.contractSymbols = new Set([SYM]);
  s.contracts = [{ os: SYM }];
  s.quotes = new Map([[SYM, { optionSymbol: SYM, side: 'C', strike: 500, openInterest: 10, iv: 0.2, multiplier: 100, last: 1 }]]);
}

test('activate() starts Node Spot polling before expiry discovery resolves', async () => {
  const { t, calls, sockets } = makeHarness(hang);
  const s = t.sessions.gld;
  const activation = t.activate(s);

  assert.ok(calls.length >= 2, 'Spot API and expiry discovery should start independently');
  assert.match(calls[0].url, /^https:\/\/spot\.test\/api\/spot\?symbol=GLD/);
  assert.match(calls[1].url, /https:\/\/cache\.test\/api\/options-cache\/expiries\?symbol=GLD/);
  assert.ok(!calls.some(x => /binance-stock-proxy|chain-symbols|get-exchange-info|get-option-quote/.test(x.url)), 'browser must not call Binance Option APIs');
  assert.equal(s.priceActivationAt > 0, true);
  assert.equal(s.priceHttpTimer !== null, true);
  assert.equal(s.priceSocket, null, 'browser WebSocket is not primary when Node API is configured');
  assert.equal(sockets.length, 0, 'expiry discovery is still pending, so option socket has not started');

  t.deactivate(s);
  await activation;
  assert.equal(s.active, false);
  assert.equal(s.priceHttpTimer, null);
});

test('Node Spot API can populate the underlying before expiry discovery resolves', async () => {
  const { t, calls } = makeHarness((url, opts) => {
    if (String(url).includes('/api/spot?symbol=GLD')) {
      return Promise.resolve(json({
        ok: true, symbol: 'GLD', price: 390.45, previousClose: 389.8,
        priceTime: Date.now(), marketPhase: 'O', source: 'binance-equity-price-stream',
        priceAgeMs: 0, receivedAgeMs: 0, feedState: 'live'
      }));
    }
    return hang(url, opts);
  });
  const s = t.sessions.gld;
  const activation = t.activate(s);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(s.price, 390.45);
  assert.equal(s.priceSource, 'node-server · binance-equity-price-stream');
  assert.ok(calls.some(x => x.url.includes('/api/spot?symbol=GLD')));
  t.deactivate(s);
  await activation;
});


test('deactivate() aborts in-flight Node Spot requests and stops the polling timer', async () => {
  let aborted = false;
  const { t, calls, intervals } = makeHarness((url, opts) => {
    if (String(url).includes('/api/spot?symbol=GLD')) {
      return new Promise((resolve, reject) => opts.signal.addEventListener('abort', () => { aborted = true; reject(new Error('aborted')); }));
    }
    return hang(url, opts);
  });
  const s = t.sessions.gld;
  const activation = t.activate(s);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.ok(calls.some(x => x.url.includes('/api/spot?symbol=GLD')));
  assert.equal(intervals.length, 1);
  t.deactivate(s);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(aborted, true);
  assert.equal(intervals.length, 0);
  await activation;
});

test('Option Chain browser requests are read-only Node cache GETs', async () => {
  const { t, calls } = makeHarness(() => json({ ok: true, symbol: 'QQQ', expiry: '2026-11-20', contracts: [] }));
  const payload = await t.cacheRequest('/api/options-cache/chain?symbol=QQQ&expiry=2026-11-20');
  assert.equal(payload.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'GET');
  assert.equal(calls[0].url, 'https://cache.test/api/options-cache/chain?symbol=QQQ&expiry=2026-11-20');
  assert.ok(!calls.some(x => /binance|chain-symbols|get-option-quote|exchange-info/.test(x.url)));
});

test('cached Node request times out instead of hanging forever', async () => {
  const { t } = makeHarness(hang);
  await assert.rejects(t.cacheRequest('/api/options-cache/expiries?symbol=QQQ', { timeoutMs: 1 }), /timeout|time budget/i);
});

test('failed refresh (loadChain refreshAll) releases hydrating so the next refresh is not blocked', async () => {
  const { t, calls } = makeHarness(() => json({ error: 'down' }, 503));
  const s = t.sessions.qqq; seedLoaded(s);
  await assert.rejects(t.loadChain(s, true));
  assert.equal(s.hydrating, false, 'hydrating must be reset after a failed request');
  assert.equal(s.chainComplete, true, 'the previous complete snapshot of the same expiry stays valid');
  const before = calls.length;
  await t.refreshQuotes(s);
  assert.ok(calls.length > before, 'refreshQuotes must issue a new request instead of returning early');
  assert.equal(s.hydrating, false);
  assert.equal(s.quoteLoading, false);
});

test('switching expiry with a failed chain request drops the old snapshot and never maps it', async () => {
  const { t } = makeHarness(() => json({ error: 'down' }, 503));
  const s = t.sessions.qqq; seedLoaded(s, '2026-11-20');
  s.expirations.push({ date: '2026-11-27', root: 'QQQ' });
  s.expiry = '2026-11-27';
  await assert.rejects(t.loadChain(s));
  assert.equal(s.quotes.size, 0, 'old expiry quotes must be dropped');
  assert.equal(s.quotesExpiry, null);
  assert.equal(s.hydrating, false);
  const snap = t.crossAssetSnapshot('qqq');
  assert.equal(snap.expiry, '2026-11-27');
  assert.equal(snap.expiryMismatch, true);
  assert.equal(snap.complete, false);
  // The browser no longer owns an Option Chain WebSocket, so no late option frame can repopulate it.
  assert.equal(s.socket, null);
  assert.equal(s.quotes.size, 0);
});

test('activate() releases the session after a failed first load so the next call retries', async () => {
  const { t, calls } = makeHarness(() => json({ error: 'down' }, 503));
  const s = t.sessions.qqq;
  await t.activate(s);
  assert.equal(s.active, false, 'active must be reset in the failure path');
  const before = calls.length;
  await t.activate(s);
  assert.ok(calls.length > before, 'a second activate() must really retry');
  t.deactivate(s);
});

test('loadExpirations reads the complete expiry inventory from Node SQLite cache', async () => {
  const { t, calls } = makeHarness((url) => {
    if (String(url).includes('/api/options-cache/expiries')) return json({ ok: true, symbol: 'QQQ', expiries: [
      { expiry: '2026-11-27', contractCount: 120, storedContracts: 120, ready: true },
      { expiry: '2026-12-18', contractCount: 180, storedContracts: 180, ready: true },
      { expiry: '2027-01-15', contractCount: 200, storedContracts: 0, ready: false }
    ] });
    return json({ ok: true });
  });
  const s = t.sessions.qqq;
  const expiries = await t.loadExpirations(s);
  assert.deepEqual(Array.from(expiries, x => x.date), ['2026-11-27', '2026-12-18', '2027-01-15']);
  assert.deepEqual(Array.from(expiries, x => x.ready), [true, true, false]);
  assert.equal(s.expiryDiscovery.source, 'server-sqlite');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'GET');
  assert.match(calls[0].url, /api\/options-cache\/expiries/);
  assert.ok(!calls.some(x => /binance|chain-symbols|get-exchange-info/.test(x.url)));
});

test('expiry state distinguishes pending, loading, error, partial and complete while preserving zero-fill', () => {
  const { t } = makeHarness(() => json({}));
  assert.equal(t.expiryPartStatus(null, null), 'pending');
  assert.equal(t.expiryPartStatus({ contractSymbols: new Set(['x']), hydrating: true, loadState: 'loading' }, { complete: false }), 'loading');
  assert.equal(t.expiryPartStatus({ contractSymbols: new Set(), loadState: 'error', error: 'timeout' }, null), 'error');
  assert.equal(t.expiryPartStatus({ contractSymbols: new Set(['x']), hydrating: false, loadState: 'partial' }, { complete: false }), 'partial');
  assert.equal(t.expiryPartStatus({ contractSymbols: new Set(['x']), hydrating: false, loadState: 'loaded', price: 100 }, { complete: true, gexComplete: true }), 'ok');
  // An OCC quote received with null OI is represented as zero rather than a missing quote.
  const sub = { contractSymbols: new Set(['x']), quotes: new Map([['x', { openInterest: null }]]), contracts: [{ os: 'x' }], chainComplete: true, chainListInvalidCount: 0, price: 100 };
  assert.equal(t.expiryPartStatus({ ...sub, loadState: 'loaded' }, { complete: true, gexComplete: true }), 'ok');
  assert.equal(t.expiryPartStatus({ ...sub, loadState: 'loaded', price: null }, { complete: true, gexComplete: false }), 'waiting-spot');
});

test('deactivating during expiry discovery aborts the old activation and prevents timers or sockets', async () => {
  let started;
  const { t, intervals } = makeHarness((url, opts) => {
    if (String(url).includes('/api/options-cache/expiries')) {
      started = true;
      return new Promise((resolve, reject) => opts.signal.addEventListener('abort', () => reject(new Error('aborted'))));
    }
    return json({ data: { expirationDates: ['2099-01-15'] } });
  });
  const s = t.sessions.qqq;
  const activation = t.activate(s);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(started, true);
  t.deactivate(s);
  await activation;
  assert.equal(s.active, false);
  assert.equal(s.pollTimer, null);
  assert.equal(s.scopeTimer, null);
  s.scopeData.set('2099-01-15', { chainLoadToken: 4, hydrating: true, loadState: 'loading', chainComplete: false });
  t.deactivate(s);
  assert.equal(s.scopeData.get('2099-01-15').hydrating, false);
  assert.equal(s.scopeData.get('2099-01-15').loadState, 'pending');
  assert.equal(intervals.length, 0);
  assert.equal(s.socket, null);
});

test('cached Node request enforces one bounded deadline and aborts its fetch', async () => {
  let aborted = false;
  const { t, calls } = makeHarness((url, opts) => new Promise((resolve, reject) => {
    opts.signal.addEventListener('abort', () => { aborted = true; reject(new Error('aborted')); }, { once: true });
  }));
  const started = Date.now();
  await assert.rejects(t.cacheRequest('/api/options-cache/chain?symbol=QQQ&expiry=2026-11-20', { timeoutMs: 1 }), /timeout|time budget/i);
  assert.ok(Date.now() - started < 100, 'the browser cache read must have a bounded deadline');
  assert.equal(aborted, true);
  assert.equal(calls.length, 1, 'read-only cache requests must not fall back to Binance or retry upstream');
});

test('cross-asset map refuses a snapshot whose expiry does not match the displayed one', () => {
  const window = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'cross-asset-map.js'), 'utf8'),
    { window, document: { getElementById: () => null }, localStorage: { getItem: () => null, setItem() {} }, Number, Math, Date, Intl, String, Object },
    { filename: 'cross-asset-map.js' });
  const snap = { key: 'qqq', symbol: 'QQQ', expiry: '2026-11-27', complete: true, dist: [{ strike: 652, callOI: 1, putOI: 1, gex: 1 }], gexLevels: [] };
  assert.equal(window.crossAssetMapMath.buildMappedMap({ ...snap, expiryMismatch: true }, 652, 4545), null);
  assert.notEqual(window.crossAssetMapMath.buildMappedMap(snap, 652, 4545), null);
});


test('underlying price parser accepts Binance Stocks price snapshot and closed-market phase', () => {
  const { t } = makeHarness(() => json({}));
  const quote = t.underlyingPriceRow({
    e: 'price',
    rates: [
      { s: 'QQQ', ac: 'EQ_QQQ', p: '610.25', pc: '608.90', t: 1794681300000, mp: 'C' },
      { s: 'GLD', ac: 'EQ_GLD', p: '390.45', pc: '389.80', t: null, mp: 'C' }
    ]
  }, { symbol: 'GLD', assetCode: 'EQ_GLD' });
  assert.equal(quote.price, 390.45);
  assert.equal(quote.previousClose, 389.8);
  assert.equal(quote.priceTime, null);
  assert.equal(quote.marketPhase, 'C');
});

test('browser fallback opens only the underlying Spot socket; Option Chain stays on Node cache', () => {
  const { t, sockets } = makeHarness(() => json({}));
  const s = t.sessions.gld;
  s.active = true;
  s.expiry = '2026-11-20';
  s.expirations = [{ date: '2026-11-20', root: 'GLD' }];
  t.subscribe(s);
  assert.equal(sockets.length, 1, 'only one Spot fallback socket is allowed');
  const priceWs = sockets.find(x => x.url === 'wss://nbstream.binance.com/equity/ws/price');
  assert.ok(priceWs, 'underlying Spot fallback connects independently');
  assert.equal(s.socket, null, 'browser never creates an Option Chain socket');
  priceWs.readyState = 1; priceWs.onopen();
  assert.equal(priceWs.sent.length, 0, 'raw Binance Price Stream needs no SUBSCRIBE message');
  t.deactivate(s);
});

test('browser direct fallback starts Node polling after the direct socket closes', () => {
  const { t, sockets, calls } = makeHarness(() => json({ ok: false, error: 'temporary' }, 503));
  const s = t.sessions.gld;
  s.active = true; s.expiry = '2026-11-20'; s.expirations = [{ date: '2026-11-20', root: 'GLD' }];
  t.subscribe(s);
  const priceWs = sockets.find(x => x.url.endsWith('/equity/ws/price'));
  assert.ok(priceWs);
  priceWs.readyState = 1; priceWs.onopen();
  priceWs.readyState = 3; priceWs.onclose();
  assert.ok(calls.some(x => x.url.includes('/api/spot?symbol=GLD')), 'Node API polling is re-enabled after browser socket closes');
  t.deactivate(s);
});

test('direct Binance Price Stream updates Spot while Option Chain remains server-cache-only', () => {
  const { t, sockets } = makeHarness(() => json({}));
  const s = t.sessions.gld;
  s.active = true; s.expiry = '2026-11-20'; s.expirations = [{ date: '2026-11-20', root: 'GLD' }];
  t.subscribe(s);
  assert.equal(sockets.length, 1, 'no browser Option Chain socket is created');
  const priceWs = sockets[0];
  priceWs.readyState = 1; priceWs.onopen();
  priceWs.onmessage({ data: JSON.stringify({ e: 'price', rates: [{ s: 'GLD', ac: 'EQ_GLD', p: '391.25', pc: '390.10', t: null, mp: 'C' }] }) });
  assert.equal(s.price, 391.25);
  assert.equal(s.previousClose, 390.10);
  assert.equal(s.marketPhase, 'C');
  assert.equal(s.priceFeedState, 'closed', 'closed-market snapshot must not be labelled live/ok');
  t.deactivate(s);
});

test('raw price socket exposes when Binance snapshot does not contain the requested underlying', () => {
  const { t, sockets } = makeHarness(() => json({}));
  const s = t.sessions.gld; s.active = true;
  t.subscribe(s);
  const priceWs = sockets.find(x => x.url.endsWith('/equity/ws/price'));
  priceWs.readyState = 1; priceWs.onopen();
  priceWs.onmessage({ data: JSON.stringify({ e: 'price', rates: [{ s: 'QQQ', ac: 'EQ_QQQ', p: '610.2' }] }) });
  assert.equal(s.price, null);
  assert.equal(s.priceFeedState, 'symbol-missing');
  assert.match(s.priceFeedDetail, /GLD.*EQ_GLD/);
  t.deactivate(s);
});
