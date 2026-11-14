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
    '  buildViews();\n  window.__t={request,requestText,loadChain,activate,deactivate,refreshQuotes,crossAssetSnapshot,mergeLiveQuote,loadExpirations,extractExpiryDates,extractExpiryDatesFromHtml,parseExpiryValue,candidateDates,expiryPartStatus,subscribe,underlyingPriceRow,handlePrice,sessions};\n  window.stockOptionsSetActive=setActive;');
  const elements = new Map();
  const el = id => { if (!elements.has(id)) elements.set(id, { id, value: '', innerHTML: '', textContent: '', dataset: {}, style: {}, hidden: false, className: '', classList: { add() {}, remove() {}, toggle() {} }, appendChild() {}, querySelector() { return null; }, querySelectorAll() { return []; } }); return elements.get(id); };
  const document = { getElementById: el, body: { dataset: {} }, createElement: () => el('tmp' + Math.random()) };
  const window = { BINANCE_STOCK_PROXY: 'https://proxy.test' };
  const calls = [];
  const fetchStub = (url, opts) => { calls.push({ url: String(url), method: opts?.method || 'GET' }); return fetchImpl(url, opts, calls.length); };
  // Fast timers: the 12s request timeout becomes 20ms, backoff/retry waits become ~2ms.
  const fastTimeout = (fn, ms, ...a) => setTimeout(fn, ms === 12000 ? 20 : Math.min(ms, 2), ...a);
  const intervals = [];
  const sockets = [];
  class FakeWS { constructor(url) { this.url=url; this.readyState = 0; this.closed = false; this.sent=[]; sockets.push(this); } send(data) { this.sent.push(JSON.parse(data)); } close() { this.closed = true; } }
  const interval = (fn, ms, ...a) => { const id = setInterval(fn, ms, ...a); intervals.push(id); return id; };
  FakeWS.OPEN = 1;
  const ctx = {
    window, document, console, location: { port: '8787' },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    fetch: fetchStub, AbortController, URLSearchParams, WebSocket: FakeWS,
    setTimeout: fastTimeout, clearTimeout, setInterval: interval, clearInterval, Intl, Date, Math, JSON, Promise, Map, Set
  };
  vm.runInNewContext(source, ctx, { filename: 'stock-options.js' });
  return { t: window.__t, calls, intervals, sockets };
}

const json = (body, status = 200) => ({ ok: status < 400, status, text: async () => JSON.stringify(body) });
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

test('request() retries a transient 5xx once for POST and then succeeds', async () => {
  let n = 0;
  const { t, calls } = makeHarness(() => (++n < 2 ? json({ error: 'bad gateway' }, 502) : json({ ok: true, data: {} })));
  const res = await t.request('/bapi/equity/v1/friendly/equity/option/get-option-quote', 'POST', { occSymbols: [SYM] });
  assert.equal(res.ok, true);
  assert.equal(calls.length, 2);
});

test('request() retries GET up to twice (3 attempts) with backoff, then gives up', async () => {
  const { t, calls } = makeHarness(() => json({ error: 'bad gateway' }, 502));
  await assert.rejects(t.request('/bapi/equity/v1/public/equity/option/chain-symbols?symbol=QQQ'), /HTTP 502/);
  // each attempt = direct public call + Worker fallback call
  assert.equal(calls.length, 6);
});

test('request() does not retry client errors (4xx)', async () => {
  const { t, calls } = makeHarness(() => json({ error: 'nope' }, 404));
  await assert.rejects(t.request('/bapi/equity/v1/public/equity/option/chain-symbols?symbol=QQQ'), /HTTP 404/);
  assert.equal(calls.length, 2); // one direct attempt + one Worker fallback, no further retries
});

test('request() aborts a hung request with a timeout error instead of waiting forever', async () => {
  const { t } = makeHarness(hang);
  await assert.rejects(t.request('/bapi/equity/v1/friendly/equity/option/get-option-quote', 'POST', { occSymbols: [SYM] }), /timeout|Request timeout/i);
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
  // A late live frame from the old expiry's stream must not repopulate the cleared session.
  t.mergeLiveQuote(s, { os: SYM, p: '1.5' });
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

test('expiry metadata parser accepts ISO dates, YYYYMMDD numbers, epoch values and OCC symbols', () => {
  const { t } = makeHarness(() => json({}));
  const dates = t.extractExpiryDates({ data: { symbol: 'QQQ', expirationDates: ['2099-01-15T00:00:00Z', 20990219], contracts: [{ optionSymbol: 'QQQ990319C00500000' }] } }, { symbol: 'QQQ', root: 'QQQ' });
  assert.deepEqual(Array.from(dates), ['2099-01-15', '2099-02-19', '2099-03-19']);
  assert.equal(t.parseExpiryValue('20270115'), '2027-01-15');
  assert.equal(t.parseExpiryValue('20270231'), null, 'invalid calendar dates must not become listed expiries');
});

test('loadExpirations uses the Binance exchange-info inventory before the bounded scan', async () => {
  const { t, calls } = makeHarness((url) => {
    if (String(url).includes('get-exchange-info')) return json({ data: { symbol: 'QQQ', expirationDates: ['2099-01-15', '2099-02-19'] } });
    return json({ data: { l: [] } });
  });
  const s = t.sessions.qqq;
  const expiries = await t.loadExpirations(s);
  assert.deepEqual(Array.from(expiries, x => x.date), ['2099-01-15', '2099-02-19']);
  assert.equal(s.expiryDiscovery.source, 'exchange-info');
  assert.equal(s.expiryDiscovery.exact, true);
  assert.equal(calls.length, 1, 'no per-day chain probing when exchange-info supplies the list');
  assert.match(calls[0].url, /symbol=QQQ/);
});

test('Options-page expiry parser captures yearless near dates and explicit long-dated expiries', () => {
  const { t } = makeHarness(() => html(''));
  const nearest = t.candidateDates(1)[0];
  const dates = t.extractExpiryDatesFromHtml(`expiry ${nearest.slice(5)} 2027-01-15 2028-01-21`, { symbol: 'QQQ', root: 'QQQ' });
  assert.ok(dates.includes(nearest));
  assert.ok(dates.includes('2027-01-15'));
  assert.ok(dates.includes('2028-01-21'));
});

test('loadExpirations falls back to Binance Options page for long-dated expiry inventory', async () => {
  const { t, calls } = makeHarness((url) => {
    if (String(url).includes('get-exchange-info')) return json({ data: {} });
    if (String(url).includes('/en/stocks/options/EQ_QQQ')) return html('<div>11-20 12-18 2027-01-15 2028-01-21 2029-01-19</div>');
    return json({ data: { l: [] } });
  });
  const s = t.sessions.qqq;
  const expiries = await t.loadExpirations(s);
  assert.ok(expiries.some(x => x.date === '2027-01-15'));
  assert.ok(expiries.some(x => x.date === '2028-01-21'));
  assert.ok(expiries.some(x => x.date === '2029-01-19'));
  assert.equal(s.expiryDiscovery.source, 'options-page');
  assert.equal(s.expiryDiscovery.exact, true);
  assert.ok(calls.some(x => x.url.includes('/en/stocks/options/EQ_QQQ')));
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
    if (String(url).includes('get-exchange-info')) {
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

test('logical request total timeout bounds direct plus Worker fallback as one request', async () => {
  let n = 0;
  const { t, calls } = makeHarness((url, opts) => (++n === 1 ? json({ error: 'direct unavailable' }, 502) : hang(url, opts)));
  const started = Date.now();
  await assert.rejects(t.request('/bapi/equity/v1/public/equity/option/get-exchange-info?symbol=QQQ', 'GET', undefined, { timeoutMs: 1 }), /timeout|time budget/i);
  assert.ok(Date.now() - started < 100, 'total deadline should end promptly in the test clock');
  assert.ok(calls.length >= 1 && calls.length <= 2, 'a timed-out logical request must stop before another retry cycle');
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

test('subscribe() isolates the Worker Spot relay from the option-chain subscription', () => {
  const { t, sockets } = makeHarness(() => json({}));
  const s = t.sessions.gld;
  s.active = true;
  s.expiry = '2026-11-20';
  s.expirations = [{ date: '2026-11-20', root: 'GLD' }];
  t.subscribe(s);
  assert.equal(sockets.length, 2, 'Spot and option chain must use independent sockets');
  const priceWs = sockets.find(x => x.url === 'wss://proxy.test/api/stock-price-feed');
  const optionWs = sockets.find(x => x.url === 'wss://nbstream.binance.com/equity/stream');
  assert.ok(priceWs, 'PWA should use the same-origin Worker Spot relay first');
  assert.ok(optionWs, 'option stream socket should remain independent');
  priceWs.readyState = 1; priceWs.onopen();
  assert.equal(priceWs.sent.length, 0, 'Worker relay forwards the public Price Stream without client SUBSCRIBE');
  optionWs.readyState = 1; optionWs.onopen();
  assert.deepEqual(optionWs.sent[0].params, ['GLD_20261120_GLD@optionChainQuoteDelayed']);
  assert.equal(typeof optionWs.sent[0].id, 'string', 'Stocks Trading WebSocket request IDs should be strings');
  assert.ok(!optionWs.sent[0].params.includes('price'), 'price stream must not be coupled to option stream acceptance');
  t.deactivate(s);
});

test('Worker Spot relay falls back to Binance raw Price Stream when the relay closes before a snapshot', () => {
  const { t, sockets } = makeHarness(() => json({}));
  const s = t.sessions.gld;
  s.active = true; s.expiry = '2026-11-20'; s.expirations = [{ date: '2026-11-20', root: 'GLD' }];
  t.subscribe(s);
  const relayWs = sockets.find(x => x.url.endsWith('/api/stock-price-feed'));
  assert.ok(relayWs);
  relayWs.readyState = 1; relayWs.onopen();
  relayWs.readyState = 3; relayWs.onclose();
  assert.equal(s.priceFeedState, 'fallback');
  assert.match(s.priceFeedDetail, /Binance raw Price Stream/);
  // Browser WebSocket fallback is scheduled with a short delay by subscribePrice().
  t.deactivate(s);
});

test('Worker relay price snapshot updates Spot independently even when option-chain subscription is rejected', () => {
  const { t, sockets } = makeHarness(() => json({}));
  const s = t.sessions.gld;
  s.active = true; s.expiry = '2026-11-20'; s.expirations = [{ date: '2026-11-20', root: 'GLD' }];
  t.subscribe(s);
  const priceWs = sockets.find(x => x.url.endsWith('/api/stock-price-feed'));
  const optionWs = sockets.find(x => x.url.endsWith('/equity/stream'));
  priceWs.readyState = 1; priceWs.onopen();
  optionWs.readyState = 1; optionWs.onopen();
  const id = optionWs.sent[0].id;
  optionWs.onmessage({ data: JSON.stringify({ id, code: -1000, msg: 'option stream rejected' }) });
  assert.equal(s.optionFeedState, 'error');
  priceWs.onmessage({ data: JSON.stringify({ e: 'price', rates: [{ s: 'GLD', ac: 'EQ_GLD', p: '391.25', pc: '390.10', t: null, mp: 'C' }] }) });
  assert.equal(s.price, 391.25, 'Spot must update despite the option stream RPC error');
  assert.equal(s.previousClose, 390.10);
  assert.equal(s.marketPhase, 'C');
  assert.equal(s.priceFeedState, 'ok');
  t.deactivate(s);
});


test('raw price socket exposes when Binance snapshot does not contain the requested underlying', () => {
  const { t, sockets } = makeHarness(() => json({}));
  const s = t.sessions.gld; s.active = true;
  t.subscribe(s);
  const priceWs = sockets.find(x => x.url.endsWith('/api/stock-price-feed'));
  priceWs.readyState = 1; priceWs.onopen();
  priceWs.onmessage({ data: JSON.stringify({ e: 'price', rates: [{ s: 'QQQ', ac: 'EQ_QQQ', p: '610.2' }] }) });
  assert.equal(s.price, null);
  assert.equal(s.priceFeedState, 'symbol-missing');
  assert.match(s.priceFeedDetail, /GLD.*EQ_GLD/);
  t.deactivate(s);
});
