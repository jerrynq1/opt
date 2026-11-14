'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function load() {
  let source = fs.readFileSync(path.join(__dirname, '..', 'js', 'stock-options.js'), 'utf8');
  const hook = '  buildViews();\n  window.stockOptionsSetActive=setActive;';
  assert.ok(source.includes(hook), 'test hook anchor present');
  source = source.replace(hook, '  window.__t={renderScope,renderScopeViews,renderLevels,elements:null,calc,calcSingle,calcAggregate,scopeExpiries,gammaFlipOf,newScopeSub,yearsToExpiry,isoTodayNY,expiryPartStatus};\n  window.stockOptionsSetActive=setActive;');
  const elements = new Map();
  const document = { getElementById(id) {
    if (!elements.has(id)) elements.set(id, { id, value: 'gamma', innerHTML: '', textContent: '' });
    return elements.get(id);
  }};
  const window = {};
  vm.runInNewContext(source, { window, document, location: { port: '8787' }, console }, { filename: 'stock-options.js' });
  window.__t.elements = elements;
  return window.__t;
}
const H = load();
const NOW = Date.now();
const arr = x => Array.from(x);

const addDays = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const occ = (root, date, side, strike) => `${root}${date.slice(2, 4)}${date.slice(5, 7)}${date.slice(8, 10)}${side}${String(Math.round(strike * 1000)).padStart(8, '0')}`;
function snapshot(date, spec) {
  const quotes = new Map(), symbols = new Set();
  for (const [side, strike, oi] of spec) {
    const os = occ('QQQ', date, side, strike);
    symbols.add(os);
    quotes.set(os, { optionSymbol: os, side, strike, multiplier: 100, openInterest: oi, iv: 0.25, volume: 1 });
  }
  return { quotes, contractSymbols: symbols, contracts: [...symbols].map(os => ({ os })), chainComplete: true, chainListInvalidCount: 0, price: 100, _gammaFlipCache: null, expirationDate: date };
}
function session(scope, specs) {
  const dates = Object.keys(specs).sort();
  const sel = dates[0], selSnap = snapshot(sel, specs[sel]);
  const s = { cfg: { symbol: 'QQQ', root: 'QQQ', key: 'qqq' }, scope, price: 100, expiry: sel, quotesExpiry: sel,
    expirations: dates.map(d => ({ date: d, root: 'QQQ' })), scopeData: new Map(), scopeRev: 1, oiLastUpdate: 1,
    ...selSnap };
  for (const d of dates.slice(1)) {
    const sub = H.newScopeSub(s, d); Object.assign(sub, snapshot(d, specs[d])); sub.loadedAt = Date.now(); s.scopeData.set(d, sub);
  }
  return s;
}

test('scope expiry selection: selected / weekly (one per week) / all', () => {
  const d1 = addDays(3), d2 = addDays(4), d3 = addDays(17);
  const s = { scope: 'all', expiry: d1, expirations: [d1, d2, d3].map(date => ({ date })) };
  assert.deepEqual(arr(H.scopeExpiries(s)), [d1, d2, d3].sort());
  s.scope = 'selected'; assert.deepEqual(arr(H.scopeExpiries(s)), [d1]);
  s.scope = 'weekly';
  const weekly = arr(H.scopeExpiries(s));
  assert.ok(weekly.length >= 2 && weekly.length <= 3, 'at most one expiry per calendar week');
  assert.ok(weekly.includes(d3));
});

test('0DTE scope only returns today and is empty when none is listed', () => {
  const today = H.isoTodayNY();
  const s = { scope: '0dte', expiry: addDays(5), expirations: [{ date: addDays(5) }] };
  assert.deepEqual(arr(H.scopeExpiries(s)), []);
  const empty = H.calc({ ...session('0dte', { [addDays(5)]: [['C', 100, 10]] }), scope: '0dte' }, NOW);
  assert.equal(empty.scopeInfo.total, 0);
  assert.equal(empty.gammaFlip, null);
  assert.ok(typeof today === 'string');
});

test('Selected Expiry scope is byte-identical to the original single-expiry calc', () => {
  const d1 = addDays(2), d2 = addDays(9);
  const s = session('selected', { [d1]: [['C', 100, 50], ['P', 100, 40]], [d2]: [['C', 100, 500]] });
  const a = H.calc(s, NOW), b = H.calcSingle(s, NOW);
  assert.equal(a.scopeInfo, undefined);
  assert.equal(a.callOI, b.callOI);
  assert.equal(a.gamma, b.gamma);
});

test('All Expiries aggregates OI and GEX by strike across expiries', () => {
  const d1 = addDays(2), d2 = addDays(9);
  const s = session('all', { [d1]: [['C', 100, 50], ['P', 95, 40]], [d2]: [['C', 100, 30], ['P', 95, 10]] });
  const agg = H.calc(s, NOW), one = H.calcSingle(s, NOW), other = H.calcSingle(Object.assign(s.scopeData.get(d2), { price: 100 }), NOW);
  assert.equal(agg.callOI, 80);
  assert.equal(agg.putOI, 50);
  assert.equal(agg.dist.length, 2, 'same strike in two expiries is one row');
  const k100 = agg.dist.find(x => x.strike === 100);
  assert.equal(k100.callOI, 80);
  assert.ok(Math.abs(k100.callGex - (one.dist.find(x => x.strike === 100).callGex + other.dist.find(x => x.strike === 100).callGex)) < 1e-6);
  assert.equal(agg.complete, true);
  assert.equal(agg.scopeInfo.total, 2);
});

test('Max Pain stays per expiry and is never merged across expiries', () => {
  const d1 = addDays(2), d2 = addDays(9);
  // d1 alone: calls at 100 and puts at 100 -> pain at 100. d2: huge OI on 110 calls / 110 puts -> pain at 110.
  const s = session('all', { [d1]: [['C', 100, 10], ['P', 100, 10], ['C', 110, 1], ['P', 90, 1]], [d2]: [['C', 110, 1000], ['P', 110, 1000], ['C', 100, 1], ['P', 120, 1]] });
  const agg = H.calc(s, NOW);
  const perExpiry = Object.fromEntries(agg.scopeInfo.parts.map(p => [p.expiry, p.maxPain.strike]));
  assert.equal(perExpiry[d1], 100);
  assert.equal(perExpiry[d2], 110);
  assert.equal(agg.maxPain.strike, 100, 'headline Max Pain is the selected expiry, not a merged payout');
  assert.equal(agg.scopeInfo.maxPainExpiry, d1);
});

test('Gamma Flip reprices each contract with its own DTE', () => {
  const near = addDays(1), far = addDays(30);
  const now = NOW;
  const rows = [
    { optionSymbol: 'a', side: 'C', strike: 100, multiplier: 100, openInterest: 100, iv: 0.3, _expiry: near },
    { optionSymbol: 'b', side: 'P', strike: 110, multiplier: 100, openInterest: 100, iv: 0.3, _expiry: far }
  ];
  const mixed = H.gammaFlipOf(rows, 105, '', now);
  const wrongSameFar = H.gammaFlipOf(rows.map(r => ({ ...r, _expiry: far })), 105, '', now);
  const wrongSameNear = H.gammaFlipOf(rows.map(r => ({ ...r, _expiry: near })), 105, '', now);
  assert.equal(mixed.complete, true);
  assert.ok(mixed.crosses.length > 0);
  assert.notEqual(mixed.level.toFixed(4), wrongSameFar.level.toFixed(4));
  assert.notEqual(mixed.level.toFixed(4), wrongSameNear.level.toFixed(4));
});

test('Incomplete expiry data keeps the aggregate provisional: no Gamma Flip, no false completeness', () => {
  const d1 = addDays(2), d2 = addDays(9);
  const s = session('all', { [d1]: [['C', 100, 50], ['P', 95, 40]], [d2]: [['C', 100, 30]] });
  s.scopeData.get(d2).chainComplete = false;
  const agg = H.calc(s, NOW);
  assert.equal(agg.complete, false);
  assert.equal(agg.gammaFlip, null);
  assert.equal(agg.scopeInfo.loaded, 1);
  // an expiry that was never loaded is also reported as pending, not as zero OI
  s.scopeData.delete(d2); s.scopeRev++;
  const pending = H.calc(s, NOW);
  assert.equal(pending.scopeInfo.parts.find(p => p.expiry === d2).status, 'pending');
  assert.equal(pending.complete, false);
});

test('near-term vs far gamma share is computed from per-expiry gross GEX', () => {
  const d1 = addDays(2), d2 = addDays(40);
  const s = session('all', { [d1]: [['C', 100, 500], ['P', 100, 500]], [d2]: [['C', 100, 500], ['P', 100, 500]] });
  const i = H.calc(s, NOW).scopeInfo;
  assert.ok(i.nearShare > i.farShare, 'short-dated ATM gamma is larger than the same OI 40 days out');
  assert.ok(Math.abs(i.nearShare + i.farShare - 1) < 1e-9);
});

test('Gamma Share stays provisional when any expiry has incomplete GEX, but treats received null OI as zero', () => {
  const d1 = addDays(2), d2 = addDays(40);
  const s = session('all', { [d1]: [['C', 100, 500], ['P', 100, 500]], [d2]: [['C', 100, 500], ['P', 100, 500]] });
  const incomplete = s.scopeData.get(d2);
  const symbol = [...incomplete.contractSymbols][0];
  incomplete.quotes.get(symbol).iv = null;
  incomplete.quotes.get(symbol).gamma = null;
  // Positive OI still requires provider Gamma or IV for GEX.
  s.scopeRev++;
  let result = H.calc(s, NOW);
  assert.equal(result.scopeInfo.gammaShareComplete, false);
  assert.equal(result.scopeInfo.nearShare, null);
  assert.equal(result.scopeInfo.farShare, null);
  assert.equal(result.scopeInfo.parts.find(p => p.expiry === d2).status, 'partial');

  // The same received contract with null OI is zero-filled and is not a GEX-missing contract.
  incomplete.quotes.get(symbol).openInterest = null;
  incomplete.quotes.get(symbol).iv = null;
  incomplete.quotes.get(symbol).gamma = null;
  s.scopeRev++;
  result = H.calc(s, NOW);
  assert.equal(result.scopeInfo.parts.find(p => p.expiry === d2).gexComplete, true);
  assert.equal(result.scopeInfo.gammaShareComplete, true);
  assert.ok(Number.isFinite(result.scopeInfo.nearShare));
});

test('headline Max Pain identifies the expiry that produced the per-expiry value', () => {
  const d1 = addDays(2), d2 = addDays(9);
  const s = session('all', { [d1]: [['C', 100, 10], ['P', 100, 10]], [d2]: [['C', 110, 10], ['P', 110, 10]] });
  H.renderLevels(s);
  assert.match(H.elements.get('so-qqq-levels').innerHTML, new RegExp(`Expiry ${d1}`));
});

test('renderScope draws the per-expiry breakdown and shows/hides it with the scope', () => {
  const d1 = addDays(2), d2 = addDays(9);
  const s = session('all', { [d1]: [['C', 100, 50], ['P', 95, 40]], [d2]: [['C', 100, 30], ['P', 95, 10]] });
  H.renderScope(s);
  const body = H.elements.get('so-qqq-breakdown');
  assert.ok(body.innerHTML.includes(d1) && body.innerHTML.includes(d2));
  assert.equal(H.elements.get('so-qqq-breakdown-card').hidden, false);
  assert.match(H.elements.get('so-qqq-breakdown-summary').innerHTML, /DTE/);
  s.scope = 'selected'; s.scopeRev++;
  H.renderScope(s);
  assert.equal(H.elements.get('so-qqq-breakdown-card').hidden, true);
});
