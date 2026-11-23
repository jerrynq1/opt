import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function loadMath() {
  const window = {};
  vm.runInNewContext(fs.readFileSync(path.join(root, 'js/trade-structure-analyzer.js'), 'utf8'), { window, Intl, Number, Math, Set, Object });
  return window.tradeStructureAnalyzer;
}

const math = loadMath();

test('long call payoff reports exact max loss, unlimited upside and breakeven', () => {
  const leg = [{ type: 'C', strike: 100, side: 'buy', premium: 5, quantity: 1, multiplier: 100 }];
  const result = math.analyzePayoff(leg, { underlyingSpot: 100 });
  assert.equal(result.ok, true);
  assert.equal(result.unlimitedProfit, true);
  assert.equal(result.unlimitedLoss, false);
  assert.equal(result.maxLoss, 500);
  assert.deepEqual(Array.from(result.breakevens), [105]);
  assert.equal(math.payoffAt(leg, 100), -500);
  assert.equal(math.payoffAt(leg, 110), 500);
});

test('bull call debit spread calculates capped profit, max loss and breakeven', () => {
  const legs = [
    { type: 'C', strike: 100, side: 'buy', premium: 5, quantity: 1, multiplier: 100 },
    { type: 'C', strike: 110, side: 'sell', premium: 2, quantity: 1, multiplier: 100 }
  ];
  const result = math.analyzePayoff(legs);
  assert.equal(result.unlimitedProfit, false);
  assert.equal(result.unlimitedLoss, false);
  assert.equal(result.maxLoss, 300);
  assert.equal(result.maxProfit, 700);
  assert.deepEqual(Array.from(result.breakevens), [103]);
  assert.equal(math.payoffAt(legs, 120), 700);
});

test('bear put debit spread calculates its expiration payoff', () => {
  const legs = [
    { type: 'P', strike: 110, side: 'buy', premium: 7, quantity: 1, multiplier: 100 },
    { type: 'P', strike: 100, side: 'sell', premium: 3, quantity: 1, multiplier: 100 }
  ];
  const result = math.analyzePayoff(legs);
  assert.equal(result.maxLoss, 400);
  assert.equal(result.maxProfit, 600);
  assert.deepEqual(Array.from(result.breakevens), [106]);
});

test('long straddle identifies two breakeven points', () => {
  const legs = [
    { type: 'C', strike: 100, side: 'buy', premium: 4, quantity: 1, multiplier: 100 },
    { type: 'P', strike: 100, side: 'buy', premium: 3, quantity: 1, multiplier: 100 }
  ];
  const result = math.analyzePayoff(legs);
  assert.equal(result.maxLoss, 700);
  assert.equal(result.unlimitedProfit, true);
  assert.deepEqual(Array.from(result.breakevens), [93, 107]);
});

test('short uncovered call correctly marks unlimited loss', () => {
  const result = math.analyzePayoff([{ type: 'C', strike: 100, side: 'sell', premium: 4, quantity: 2, multiplier: 100 }]);
  assert.equal(result.unlimitedLoss, true);
  assert.equal(result.maxProfit, 800);
  assert.equal(result.maxLoss, null);
});

test('iron condor calculates credit, both break-evens and defined risk', () => {
  const legs = [
    { type: 'P', strike: 95, side: 'sell', premium: 2, quantity: 1, multiplier: 100 },
    { type: 'P', strike: 90, side: 'buy', premium: 1, quantity: 1, multiplier: 100 },
    { type: 'C', strike: 105, side: 'sell', premium: 2, quantity: 1, multiplier: 100 },
    { type: 'C', strike: 110, side: 'buy', premium: 1, quantity: 1, multiplier: 100 }
  ];
  const result = math.analyzePayoff(legs);
  assert.equal(result.netDebit, -200);
  assert.equal(result.maxProfit, 200);
  assert.equal(result.maxLoss, 300);
  assert.deepEqual(Array.from(result.breakevens), [93, 107]);
});

test('call butterfly calculates defined profit and loss', () => {
  const legs = [
    { type: 'C', strike: 95, side: 'buy', premium: 7, quantity: 1, multiplier: 100 },
    { type: 'C', strike: 100, side: 'sell', premium: 4, quantity: 2, multiplier: 100 },
    { type: 'C', strike: 105, side: 'buy', premium: 2, quantity: 1, multiplier: 100 }
  ];
  const result = math.analyzePayoff(legs);
  assert.equal(result.maxLoss, 100);
  assert.equal(result.maxProfit, 400);
  assert.deepEqual(Array.from(result.breakevens), [96, 104]);
});

test('short put has premium-capped profit and strike-limited loss at zero', () => {
  const result = math.analyzePayoff([{ type: 'P', strike: 100, side: 'sell', premium: 4, quantity: 1, multiplier: 100 }]);
  assert.equal(result.maxProfit, 400);
  assert.equal(result.maxLoss, 9600);
  assert.deepEqual(Array.from(result.breakevens), [96]);
});

test('quantity and multiplier scale P/L linearly', () => {
  const result = math.analyzePayoff([{ type: 'P', strike: 100, side: 'buy', premium: 2, quantity: 3, multiplier: 100 }]);
  assert.equal(result.maxLoss, 600);
  assert.equal(math.payoffAt(result.legs, 90), 2400);
});

test('invalid or missing premium cannot produce a fabricated payoff', () => {
  assert.equal(math.analyzePayoff([{ type: 'C', strike: 100, side: 'buy', premium: null }]).ok, false);
  assert.equal(math.payoffAt([], 100), null);
});

test('chart integration exposes clickable panel and explicitly identifies assumptions', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const js = fs.readFileSync(path.join(root, 'js/cross-asset-map.js'), 'utf8');
  assert.match(html, /id="xmapTradePanel"/);
  assert.match(html, /id="xmapTradeStrategy"/);
  assert.match(html, /js\/trade-structure-analyzer\.js/);
  assert.match(js, /function openTradeAnalyzer\(event\)/);
  assert.match(js, /function applyRelatedCandidate\(eventIndex\)/);
  assert.match(js, /data-trade-candidate/);
  assert.match(html, /value=\"custom\"/);
  assert.match(js, /function drawTradePayoffOverlay\(w,h\)/);
  assert.match(js, /BUY\/SELL là giả định/);
  assert.match(js, /volume-flow\/events/);
  assert.match(js, /options-cache\/chain/);
});
