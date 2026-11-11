'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function makeRuntime({ tf = 60, connected = false } = {}) {
  const N = 9000;
  const start = Date.UTC(2026, 10, 2, 0, 0, 0) / 1000;
  const agg = [];
  let price = 25000;
  for (let i = 0; i < N; i++) {
    const st = start + i * 60;
    const open = price;
    price += Math.sin(i / 9) * 1.3 + Math.cos(i / 83) * 0.8;
    const close = price;
    const wiggle = Math.abs(Math.sin(i / 37) * 9 + Math.cos(i / 113) * 12) * 0.08 + 1;
    agg.push({ st, time: st, open, high: Math.max(open, close) + wiggle,
      low: Math.min(open, close) - wiggle, close,
      v: 100 + Math.abs(Math.sin(i / 7)) * 400 });
  }
  const m1 = agg.map(b => [b.st, b.open, b.high, b.low, b.close, b.v]);
  const labels = [];
  const errors = [];
  const symbol = { symbolName: 'US500', symbolId: 17 };
  const sandbox = {
    console, Date, Math, Intl, JSON, Map, Set, Array, Number, String, Object, RegExp, Promise,
    IND: {}, ACT: [], C: { tf, sym: 'NAS100' }, agg, m1,
    CT: { ready: connected, acc: connected ? 1 : null, symbols: connected ? [symbol] : [], sym: { digits: 2 } },
    PDIG: () => 2, s2u: x => x, u2s: x => x,
    bucket: (st, sec) => Math.floor(st / sec) * sec,
    ctFind: name => name === 'ES' || name === 'US500' ? symbol : null,
    ctHist: async (_type, payload) => {
      const from = Math.floor(payload.fromTimestamp / 1000);
      const to = Math.floor(payload.toTimestamp / 1000);
      const trendbar = [];
      for (let t = from; t < Math.min(to, from + 20000); t += 60) {
        const i = Math.max(0, Math.min(N - 1, Math.floor((t - start) / 60)));
        const b = agg[i];
        trendbar.push({ utcTimestampInMinutes: t / 60, low: b.low, deltaOpen: b.open - b.low,
          deltaClose: b.close - b.low, deltaHigh: b.high - b.low, volume: b.v });
      }
      return { trendbar, hasMore: false };
    },
    tbToBar: tb => {
      const st = tb.utcTimestampInMinutes * 60;
      const low = tb.low;
      const open = low + tb.deltaOpen;
      const close = low + tb.deltaClose;
      const high = low + tb.deltaHigh;
      return { u: st, b: [st, open, high, low, close, tb.volume] };
    },
    plot: () => [1200, 650],
    cs: { priceToCoordinate: p => 325 - (p - 25000) * 0.12,
      coordinateToPrice: y => (325 - y) / 0.12 + 25000 },
    ts: { timeToCoordinate: t => (t - start) / 60 * 0.45 + 20,
      getVisibleLogicalRange: () => ({ from: 0, to: N - 1 }) },
    chErr: (key, error) => errors.push({ key, error: String(error?.stack || error) }),
    ctx: {
      save() {}, restore() {}, beginPath() {}, rect() {}, clip() {}, setLineDash() {},
      moveTo() {}, lineTo() {}, stroke() {}, fill() {}, fillRect() {}, strokeRect() {},
      roundRect() {}, arc() {}, fillText(s) { labels.push(String(s)); },
      measureText(s) { return { width: String(s).length * 6 }; }, closePath() {},
      strokeStyle: '', fillStyle: '', lineWidth: 1, font: '', textBaseline: '', globalAlpha: 1
    }
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'pine-indicators-defs.js'), 'utf8'), sandbox);
  sandbox.ACT = ['crtSoup', 'ssmtPlus', 'sdRangePlus', 'wyckoffPlus', 'po3Plus'].map(key => ({
    id: key, key, on: true,
    p: Object.fromEntries(sandbox.IND[key].p.map(def => [def[0], def[2]])),
    c: [], vis: null
  }));
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'market-model-indicators.js'), 'utf8'), sandbox);
  return { sandbox, labels, errors, agg };
}

test('registers all five supplied Pine ports in the Market Model indicator category', () => {
  const { sandbox } = makeRuntime();
  for (const key of ['crtSoup', 'ssmtPlus', 'sdRangePlus', 'wyckoffPlus', 'po3Plus']) {
    assert.equal(sandbox.IND[key].t, 'mm');
    assert.ok(sandbox.IND[key].n);
    assert.ok(sandbox.IND[key].p.length > 10);
  }
});

test('renders all five indicators without runtime exceptions when cTrader is disconnected', () => {
  const { sandbox, errors } = makeRuntime();
  sandbox.drawMarketModelIndicators(1200, 650);
  assert.deepEqual(errors, []);
  assert.match(sandbox.marketModelIndicatorsStatus().pair.error, /cTrader/);
});

test('shows SSMT broker connection status rather than substituting another symbol', () => {
  const { sandbox, labels } = makeRuntime();
  sandbox.drawMarketModelIndicators(1200, 650);
  assert.ok(labels.some(x => x.includes('SSMT+: SSMT cần kết nối cTrader')));
});

test('PO3 enforces both the configured limit and half-PO3-timeframe rule', () => {
  const { sandbox, labels, errors } = makeRuntime({ tf: 60 * 60 });
  sandbox.drawMarketModelIndicators(1200, 650);
  assert.deepEqual(errors, []);
  assert.ok(labels.some(x => x.includes('PO3+: PO3 timeframe guard')));
});

test('turning all five indicators off prevents pair-feed requests and overlay errors', () => {
  const { sandbox, errors } = makeRuntime({ connected: true });
  sandbox.ACT.forEach(x => { x.on = false; });
  sandbox.drawMarketModelIndicators(1200, 650);
  assert.deepEqual(errors, []);
  assert.equal(sandbox.marketModelIndicatorsStatus().pair.loading, false);
});

test('SSMT refreshes its cached calculation after the cTrader pair feed arrives', async () => {
  const { sandbox, errors } = makeRuntime({ connected: true });
  sandbox.drawMarketModelIndicators(1200, 650);
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
  sandbox.drawMarketModelIndicators(1200, 650);
  assert.deepEqual(errors, []);
  const status = sandbox.marketModelIndicatorsStatus().pair;
  assert.equal(status.symbol, 'US500');
  assert.ok(status.bars > 0);
  assert.equal(status.loading, false);
});
