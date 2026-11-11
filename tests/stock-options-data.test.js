'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadStockOptionsHelpers() {
  let source = fs.readFileSync(path.join(__dirname, '..', 'js', 'stock-options.js'), 'utf8');
  source = source.replace(
    "if(changed){s.oiLastUpdate=Date.now();renderAll(s);}",
    "if(changed){s.oiLastUpdate=Date.now();}"
  );
  source = source.replace(
    '  buildViews();\n  window.stockOptionsSetActive=setActive;',
    '  window.__stockOptionsTest={normaliseQuote,mergeLiveQuote,calc,strikeSymbols};\n  return;\n  buildViews();\n  window.stockOptionsSetActive=setActive;'
  );
  const window = {};
  vm.runInNewContext(source, { window, location: { port: '8787' } }, { filename: 'stock-options.js' });
  return window.__stockOptionsTest;
}

const helpers = loadStockOptionsHelpers();

test('Binance quote fields map last price, OI, Greeks and contract multiplier', () => {
  const q = helpers.normaliseQuote({
    os: 'GLD261110C00369000', t: 'call', sp: '369', m: '100',
    p: '5.70', oi: 248, iv: '0.25855', de: '0.65891', ga: '0.03929',
    th: '-0.80089', ve: '0.13246'
  });
  assert.equal(q.last, 5.7);
  assert.equal(q.multiplier, 100);
  assert.equal(q.openInterest, 248);
  assert.equal(q.side, 'C');
  assert.equal(q.gamma, 0.03929);
});

test('partial option-chain updates using p refresh last price without clearing OI', () => {
  const symbol = 'GLD261110C00369000';
  const initial = helpers.normaliseQuote({ os: symbol, t: 'call', sp: '369', m: '100', l: '5.70', oi: 248, ga: '0.03929' });
  const session = {
    contracts: [{ os: symbol }], contractSymbols: new Set([symbol]),
    quotes: new Map([[symbol, initial]]), price: 370, oiLastUpdate: 0
  };
  helpers.mergeLiveQuote(session, { os: symbol, p: '5.95' });
  const updated = session.quotes.get(symbol);
  assert.equal(updated.last, 5.95);
  assert.equal(updated.openInterest, 248);
  assert.equal(updated.gamma, 0.03929);
});

test('a missing multiplier does not silently default to 100 for exposure', () => {
  const session = {
    price: 100, contracts: [{ os: 'GLD261110P00100000' }],
    quotes: new Map([['GLD261110P00100000', {
      optionSymbol: 'GLD261110P00100000', side: 'P', strike: 100,
      multiplier: null, openInterest: 20, volume: 0,
      gamma: 0.2, delta: -0.4, vega: 0.1, theta: -0.2
    }]])
  };
  const result = helpers.calc(session);
  assert.equal(result.putOI, 20);
  assert.equal(result.oiKnown, 1);
  assert.equal(result.multiplierMissing, 1);
  assert.equal(result.gamma, 0);
  assert.equal(result.delta, 0);
  assert.equal(result.vega, 0);
  assert.equal(result.theta, 0);
});

test('exposure uses the actual multiplier supplied by Binance', () => {
  const session = {
    price: 100, contracts: [{ os: 'QQQ261110C00100000' }],
    quotes: new Map([['QQQ261110C00100000', {
      optionSymbol: 'QQQ261110C00100000', side: 'C', strike: 100,
      multiplier: 50, openInterest: 10, volume: 0,
      gamma: 0.1, delta: 0.5, vega: 0.2, theta: -0.3
    }]])
  };
  const result = helpers.calc(session);
  assert.equal(result.gamma, 0.1 * 10 * 50 * 100 * 100 * 0.01);
  assert.equal(result.delta, 0.5 * 10 * 50 * 100);
  assert.equal(result.vega, 0.2 * 10 * 50);
  assert.equal(result.theta, -0.3 * 10 * 50);
  assert.equal(result.multiplierMissing, 0);
});


test('bilateral exposure keeps Call and Put Greeks separate for the mirrored profile', () => {
  const session = {
    price: 100,
    contracts: [{ os: 'QQQ261110C00100000' }, { os: 'QQQ261110P00100000' }],
    quotes: new Map([
      ['c', { optionSymbol:'c', side:'C', strike:100, multiplier:10, openInterest:10, volume:0, gamma:0.1, delta:0.6, vega:0.4, theta:-0.2 }],
      ['p', { optionSymbol:'p', side:'P', strike:100, multiplier:10, openInterest:10, volume:0, gamma:0.2, delta:-0.4, vega:0.5, theta:-0.3 }]
    ])
  };
  const result = helpers.calc(session);
  const strike = result.dist[0];
  assert.equal(strike.callGex, 1000);
  assert.equal(strike.putGex, -2000);
  assert.equal(strike.callDex, 6000);
  assert.equal(strike.putDex, 4000);
  assert.equal(strike.callVgex, 40);
  assert.equal(strike.putVgex, 50);
  assert.equal(strike.callThex, 20);
  assert.equal(strike.putThex, 30);
  assert.equal(result.gamma, -1000);
  assert.equal(result.delta, 2000);
  assert.equal(result.vega, 90);
  assert.equal(result.theta, -50);
});

test('option volume by strike survives missing OI and is kept separate from OI exposure', () => {
  const session = {
    price: 100, contracts: [{ os: 'QQQ261110C00100000' }, { os: 'QQQ261110P00100000' }],
    quotes: new Map([
      ['c', { optionSymbol:'c', side:'C', strike:100, multiplier:100, openInterest:null, volume:12, gamma:0.1, delta:0.5, vega:0.2, theta:-0.3 }],
      ['p', { optionSymbol:'p', side:'P', strike:100, multiplier:100, openInterest:5, volume:8, gamma:0.1, delta:-0.5, vega:0.2, theta:-0.3 }]
    ])
  };
  const result = helpers.calc(session);
  assert.equal(result.dist.length, 1);
  assert.equal(result.dist[0].callVol, 12);
  assert.equal(result.dist[0].putVol, 8);
  assert.equal(result.dist[0].callOI, 0);
  assert.equal(result.dist[0].putOI, 5);
  assert.equal(result.volume, 20);
  assert.equal(result.oiKnown, 1);
});


test('provider Vol Trigger is retained when the quote payload includes it', () => {
  const q = helpers.normaliseQuote({ os: 'QQQ261110C00369000', t: 'call', sp: '369', vt: '372.5' });
  assert.equal(q.volTrigger, 372.5);
});

test('Max Pain is computed from the complete expiry and OI-weighted intrinsic payout', () => {
  const session = {
    price: 100, chainComplete: true,
    contracts: [{ os: 'QQQ261110C00090000' }, { os: 'QQQ261110P00110000' }],
    quotes: new Map([
      ['c', { optionSymbol:'c', side:'C', strike:90, multiplier:1, openInterest:10, volume:0, gamma:0.1, delta:0.5 }],
      ['p', { optionSymbol:'p', side:'P', strike:110, multiplier:1, openInterest:30, volume:0, gamma:0.1, delta:-0.5 }]
    ])
  };
  const result = helpers.calc(session);
  assert.equal(result.complete, true);
  assert.equal(result.maxPain.strike, 110);
  assert.equal(result.maxPain.payout, 200);
});

test('GEX 1-10 ranks strikes by absolute net gamma exposure, not price order', () => {
  const session = {
    price: 100, chainComplete: true,
    contracts: Array.from({length:3}, (_,i)=>({os:`QQQ261110C00${100+i}00000`})),
    quotes: new Map([
      ['a', { optionSymbol:'a', side:'C', strike:90, multiplier:1, openInterest:10, volume:0, gamma:0.01 }],
      ['b', { optionSymbol:'b', side:'C', strike:100, multiplier:1, openInterest:10, volume:0, gamma:0.2 }],
      ['c', { optionSymbol:'c', side:'P', strike:110, multiplier:1, openInterest:10, volume:0, gamma:0.1 }]
    ])
  };
  const result = helpers.calc(session);
  assert.equal(result.gexLevels[0].strike, 100);
  assert.equal(result.gexLevels[1].strike, 110);
  assert.equal(result.gexLevels[2].strike, 90);
});

test('Max Pain stays unavailable when any contract in a completed chain has missing OI', () => {
  const session = {
    price: 100, chainComplete: true,
    contracts: [{ os: 'QQQ261110C00090000' }, { os: 'QQQ261110P00110000' }],
    quotes: new Map([
      ['c', { optionSymbol:'c', side:'C', strike:90, multiplier:1, openInterest:10, volume:0, gamma:0.1, delta:0.5 }],
      ['p', { optionSymbol:'p', side:'P', strike:110, multiplier:1, openInterest:null, volume:0, gamma:0.1, delta:-0.5 }]
    ])
  };
  const result = helpers.calc(session);
  assert.equal(result.complete, true);
  assert.equal(result.oiComplete, false);
  assert.equal(result.maxPain, null);
});

test('Max Pain stays unavailable when a complete chain has missing contract multipliers', () => {
  const session = {
    price: 100, chainComplete: true,
    contracts: [{ os: 'QQQ261110C00090000' }, { os: 'QQQ261110P00110000' }],
    quotes: new Map([
      ['c', { optionSymbol:'c', side:'C', strike:90, multiplier:100, openInterest:10, volume:0, gamma:0.1, delta:0.5 }],
      ['p', { optionSymbol:'p', side:'P', strike:110, multiplier:null, openInterest:30, volume:0, gamma:0.1, delta:-0.5 }]
    ])
  };
  const result = helpers.calc(session);
  assert.equal(result.complete, true);
  assert.equal(result.oiComplete, true);
  assert.equal(result.maxPainComplete, false);
  assert.equal(result.maxPain, null);
});


test('Option Chain strike selector requests only the nearest N strikes first', () => {
  const list = [
    { os:'QQQ261110C00080000' }, { os:'QQQ261110P00080000' },
    { os:'QQQ261110C00090000' }, { os:'QQQ261110P00090000' },
    { os:'QQQ261110C00100000' }, { os:'QQQ261110P00100000' },
    { os:'QQQ261110C00110000' }, { os:'QQQ261110P00110000' },
    { os:'QQQ261110C00120000' }, { os:'QQQ261110P00120000' }
  ];
  const selected = helpers.strikeSymbols(list, { price:107, displayStrikes:2 });
  assert.equal(selected.length,4);
  assert.ok(selected.every(x=>x.includes('00100000')||x.includes('00110000')));
});

test('Option Chain All selection keeps every listed contract', () => {
  const list = [{os:'QQQ261110C00080000'},{os:'QQQ261110P00080000'},{os:'QQQ261110C00090000'}];
  assert.deepEqual(helpers.strikeSymbols(list, {price:85, displayStrikes:'all'}), list.map(x=>x.os));
});
