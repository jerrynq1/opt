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
    '  window.__stockOptionsTest={normaliseQuote,mergeLiveQuote,calc,strikeSymbols,renderExposure,gammaFlipOf,maxPainOf,bsmGamma,gammaFlipInputKey,yearsToExpiry,expiryAtUsCloseUtc};\n  return;\n  buildViews();\n  window.stockOptionsSetActive=setActive;'
  );
  const elements = new Map();
  const document = { getElementById(id) {
    if (!elements.has(id)) elements.set(id, { id, value: 'gamma', innerHTML: '', textContent: '' });
    return elements.get(id);
  }};
  const window = {};
  vm.runInNewContext(source, { window, document, location: { port: '8787' }, console }, { filename: 'stock-options.js' });
  return { ...window.__stockOptionsTest, elements };
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


test('Gamma Flip / Zero Gamma is the single zero-cross level; Vol Trigger is not exposed', () => {
  const q = helpers.normaliseQuote({ os: 'QQQ261110C00369000', t: 'call', sp: '369', vt: '372.5' });
  assert.equal(q.volTrigger, undefined);
  const contracts=[{os:'call-110'},{os:'put-90'}];
  const quotes=new Map([
    ['call-110',{optionSymbol:'call-110',side:'C',strike:110,multiplier:100,openInterest:100,volume:0,gamma:.02,iv:.30}],
    ['put-90',{optionSymbol:'put-90',side:'P',strike:90,multiplier:100,openInterest:100,volume:0,gamma:.02,iv:.30}]
  ]);
  const result=helpers.calc({price:100,expiry:'2026-11-20',chainComplete:true,contracts,quotes},Date.parse('2026-11-12T12:00:00Z'));
  assert.ok(result.gammaFlip>90&&result.gammaFlip<100);
  assert.equal(result.zeroGamma, undefined);
  assert.equal(result.volTrigger, undefined);
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

test('OI Walls rank by OI while CW/PW rank by signed Net GEX and GEX 1-10 excludes only CW/PW', () => {
  const entries = [
    ['call-oi', 'C', 120, 500, 0.001],   // biggest Call OI, but not biggest positive Net GEX
    ['put-oi',  'P', 125, 600, 0.001],   // biggest Put OI, but not biggest negative Net GEX
    ['cw',      'C', 105,  50, 0.50],    // strongest positive Net GEX => CW
    ['pw',      'P', 110,  60, 0.40],    // strongest negative Net GEX => PW
    ['gex-a',   'C', 100,  40, 0.20],
    ['gex-b',   'P', 115,  80, 0.12],
    ['gex-c',   'C', 130,  40, 0.10]
  ];
  const contracts = entries.map(([id,side,strike])=>({os:id}));
  const quotes = new Map(entries.map(([id,side,strike,oi,gamma])=>[id,{
    optionSymbol:id,side,strike,multiplier:1,openInterest:oi,volume:0,gamma
  }]));
  const result = helpers.calc({price:100,chainComplete:true,contracts,quotes});

  assert.equal(result.oiComplete, true);
  assert.equal(result.gexComplete, true);
  assert.equal(result.callOIWall.strike, 120);
  assert.equal(result.putOIWall.strike, 125);
  assert.equal(result.gexCallWall.strike, 105);
  assert.ok(result.gexCallWall.gex > 0);
  assert.equal(result.gexPutWall.strike, 110);
  assert.ok(result.gexPutWall.gex < 0);

  const ladderStrikes = Array.from(result.gexLevels, x=>x.strike);
  assert.ok(!ladderStrikes.includes(105), 'GEX CW excluded from ladder');
  assert.ok(!ladderStrikes.includes(110), 'GEX PW excluded from ladder');
  assert.ok(ladderStrikes.includes(120), 'Call OI Wall is not excluded merely for being an OI Wall');
  assert.ok(ladderStrikes.includes(125), 'Put OI Wall is not excluded merely for being an OI Wall');
  assert.deepEqual(ladderStrikes.slice(0,2), [115,100], 'remaining strikes sorted by absolute Net GEX');
});

test('GEX walls and Zero Gamma stay unavailable when gamma/OI/multiplier coverage is incomplete', () => {
  const session = {
    price:100, chainComplete:true,
    contracts:[{os:'a'},{os:'b'}],
    quotes:new Map([
      ['a',{optionSymbol:'a',side:'C',strike:100,multiplier:1,openInterest:10,gamma:.2,volume:0}],
      ['b',{optionSymbol:'b',side:'P',strike:105,multiplier:1,openInterest:10,gamma:null,volume:0}]
    ])
  };
  const result=helpers.calc(session);
  assert.equal(result.oiComplete,true);
  assert.equal(result.gexComplete,false);
  assert.equal(result.gexCoverage,.5);
  assert.equal(result.gexCallWall,null);
  assert.equal(result.gexPutWall,null);
  assert.deepEqual(Array.from(result.gexLevels),[]);
  assert.equal(result.gammaFlip,null);
});

test('Gamma Flip is calculated by repricing Black-Scholes gamma across hypothetical underlying prices', () => {
  const contracts=[{os:'call-110'},{os:'put-90'}];
  const quotes=new Map([
    ['call-110',{optionSymbol:'call-110',side:'C',strike:110,multiplier:100,openInterest:100,volume:0,gamma:.02,iv:.30}],
    ['put-90',{optionSymbol:'put-90',side:'P',strike:90,multiplier:100,openInterest:100,volume:0,gamma:.02,iv:.30}]
  ]);
  const session={price:100,expiry:'2026-11-20',chainComplete:true,contracts,quotes};
  const result=helpers.calc(session,Date.parse('2026-11-12T12:00:00Z'));
  assert.equal(result.gammaFlipComplete,true);
  assert.ok(result.gammaFlip>90&&result.gammaFlip<100,`expected BSM zero-cross between 90 and 100; got ${result.gammaFlip}`);
  assert.match(result.gammaFlipReason,/Gamma Flip \/ Zero Gamma · BSM repricing/);
  assert.equal(result.gammaFlipCoverage,1);
  const root=result.gammaFlip;
  const time=helpers.yearsToExpiry('2026-11-20',Date.parse('2026-11-12T12:00:00Z'));
  const residual=quotes.size?Array.from(quotes.values()).reduce((sum,q)=>{
    const gamma=helpers.bsmGamma(root,q.strike,time,q.iv);
    return sum+(q.side==='P'?-1:1)*gamma*q.openInterest*q.multiplier*root*root*.01;
  },0):Infinity;
  assert.ok(Math.abs(residual)<1e-5,`Net GEX at estimated zero level should be approximately 0; got ${residual}`);
});

test('Gamma Flip chooses the crossing nearest to the current Spot from cached BSM crossings', () => {
  const contracts=[{os:'call'},{os:'put'}];
  const quotes=new Map([
    ['call',{optionSymbol:'call',side:'C',strike:100,multiplier:100,openInterest:10,gamma:.1,iv:.25}],
    ['put',{optionSymbol:'put',side:'P',strike:105,multiplier:100,openInterest:10,gamma:.1,iv:.25}]
  ]);
  const now=Date.parse('2026-11-12T12:00:00Z');
  const rows=Array.from(quotes.values());
  const session={price:104,expiry:'2026-11-20',chainComplete:true,contracts,quotes,
    _gammaFlipCache:{key:['2026-11-20',helpers.gammaFlipInputKey(rows),2,Math.floor(now/60000)].join('|'),value:{level:95,crosses:[95,105],complete:true,reason:'cached BSM scan',coverage:1}}};
  assert.equal(helpers.calc(session,now).gammaFlip,105);
  session.price=96;
  assert.equal(helpers.calc(session,now).gammaFlip,95);
});

test('Gamma Flip BSM cache key ignores option last/bid/ask ticks but changes with IV or OI', () => {
  const base={optionSymbol:'c',side:'C',strike:100,multiplier:100,openInterest:10,iv:.25,last:1,bid:.9,ask:1.1};
  const initial=helpers.gammaFlipInputKey([base]);
  const quoteTick=helpers.gammaFlipInputKey([{...base,last:1.2,bid:1.1,ask:1.3}]);
  const ivUpdate=helpers.gammaFlipInputKey([{...base,iv:.3}]);
  const oiUpdate=helpers.gammaFlipInputKey([{...base,openInterest:11}]);
  assert.equal(initial,quoteTick);
  assert.notEqual(initial,ivUpdate);
  assert.notEqual(initial,oiUpdate);
});

test('Gamma Flip stays unavailable when any contract lacks IV even if live Gamma is present', () => {
  const contracts=[{os:'call'},{os:'put'}];
  const quotes=new Map([
    ['call',{optionSymbol:'call',side:'C',strike:100,multiplier:100,openInterest:10,gamma:.1,iv:.25}],
    ['put',{optionSymbol:'put',side:'P',strike:105,multiplier:100,openInterest:10,gamma:.1,iv:null}]
  ]);
  const result=helpers.calc({price:100,expiry:'2026-11-20',chainComplete:true,contracts,quotes},Date.parse('2026-11-12T12:00:00Z'));
  assert.equal(result.gexComplete,true);
  assert.equal(result.gammaFlipComplete,false);
  assert.equal(result.gammaFlip,null);
  assert.equal(result.gammaFlipCoverage,.5);
});

test('Zero Gamma uses the 16:00 America/New_York option expiry close for DTE', () => {
  // 2026-11-20 is standard time (EST, UTC-5); 20:00Z is 15:00 ET, one hour before expiry close.
  const now=Date.parse('2026-11-20T20:00:00Z');
  const t=helpers.yearsToExpiry('2026-11-20',now);
  assert.ok(Math.abs(t-(1/(24*365.25)))<1e-10,`expected one hour DTE, got ${t}`);
  assert.equal(helpers.expiryAtUsCloseUtc('2026-11-20'),Date.parse('2026-11-20T21:00:00Z'));
  // A summer expiry uses EDT (UTC-4).
  assert.equal(helpers.expiryAtUsCloseUtc('2027-06-18'),Date.parse('2027-06-18T20:00:00Z'));
});

test('GEX Ratio sums Call and Put exposure independently before division, without strike netting', () => {
  const contracts=[{os:'c100'},{os:'p100'},{os:'c110'}];
  const quotes=new Map([
    ['c100',{optionSymbol:'c100',side:'C',strike:100,multiplier:1,openInterest:1,volume:0,gamma:1}],
    ['p100',{optionSymbol:'p100',side:'P',strike:100,multiplier:1,openInterest:1,volume:0,gamma:4}],
    ['c110',{optionSymbol:'c110',side:'C',strike:110,multiplier:1,openInterest:1,volume:0,gamma:5}]
  ]);
  const result=helpers.calc({price:100,chainComplete:true,contracts,quotes});
  assert.equal(result.callGexTotal,600);
  assert.equal(result.putGexAbsTotal,400);
  assert.equal(result.gexRatio,1.5);
  assert.equal(result.gexRatioBias,'call-dominant');
});

test('GEX Ratio below one identifies Put-GEX dominance', () => {
  const contracts=[{os:'c'},{os:'p'}];
  const quotes=new Map([
    ['c',{optionSymbol:'c',side:'C',strike:100,multiplier:1,openInterest:1,volume:0,gamma:1}],
    ['p',{optionSymbol:'p',side:'P',strike:110,multiplier:1,openInterest:2,volume:0,gamma:1}]
  ]);
  const result=helpers.calc({price:100,chainComplete:true,contracts,quotes});
  assert.equal(result.gexRatio,.5);
  assert.equal(result.gexRatioBias,'put-dominant');
});

test('Max Pain reports all listed strikes tied at the minimum payout', () => {
  const session={price:100,chainComplete:true,contracts:[{os:'c90'},{os:'p110'}],quotes:new Map([
    ['c90',{optionSymbol:'c90',side:'C',strike:90,multiplier:100,openInterest:1,volume:0,gamma:.1}],
    ['p110',{optionSymbol:'p110',side:'P',strike:110,multiplier:100,openInterest:1,volume:0,gamma:.1}]
  ])};
  const result=helpers.calc(session);
  assert.deepEqual(Array.from(result.maxPain.tiedStrikes),[90,110]);
  assert.equal(result.maxPain.strike,90,'lowest tied listed strike is the deterministic displayed representative');
  assert.equal(result.maxPain.payout,2000);
  assert.equal(result.maxPain.isTie,true);
});

test('Max Pain uses each contract multiplier and ignores zero-OI contracts without a multiplier', () => {
  const session={price:100,chainComplete:true,contracts:[{os:'c90'},{os:'p110'},{os:'c100zero'}],quotes:new Map([
    ['c90',{optionSymbol:'c90',side:'C',strike:90,multiplier:1,openInterest:1,volume:0,gamma:.1}],
    ['p110',{optionSymbol:'p110',side:'P',strike:110,multiplier:10,openInterest:1,volume:0,gamma:.1}],
    ['c100zero',{optionSymbol:'c100zero',side:'C',strike:100,multiplier:null,openInterest:0,volume:0,gamma:.1}]
  ])};
  const result=helpers.calc(session);
  assert.equal(result.maxPainComplete,true);
  assert.equal(result.maxPain.strike,110,'multiplier-weighted Put payout makes 110 the minimum');
  assert.equal(result.maxPain.payout,20);
});

test('GEX Ratio is total Call GEX divided by absolute total Put GEX', () => {
  const contracts=[{os:'c'},{os:'p'}];
  const quotes=new Map([
    ['c',{optionSymbol:'c',side:'C',strike:100,multiplier:1,openInterest:50,volume:0,gamma:.5}],
    ['p',{optionSymbol:'p',side:'P',strike:110,multiplier:1,openInterest:60,volume:0,gamma:.4}]
  ]);
  const result=helpers.calc({price:100,chainComplete:true,contracts,quotes});
  assert.equal(result.callGexTotal,2500);
  assert.equal(result.putGexAbsTotal,2400);
  assert.ok(Math.abs(result.gexRatio-(2500/2400))<1e-12);
  assert.equal(result.gexRatioBias,'call-dominant');
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


test('bilateral exposure renderer outputs visible nonzero Call and Put bar widths',()=>{
  const render=helpers.renderExposure;
  const quotes=new Map([
    ['c1',{optionSymbol:'c1',side:'C',strike:99,multiplier:100,openInterest:30,volume:1,gamma:.12,delta:.6,vega:.3,theta:-.1}],
    ['p1',{optionSymbol:'p1',side:'P',strike:99,multiplier:100,openInterest:20,volume:1,gamma:.1,delta:-.4,vega:.2,theta:-.08}],
    ['c2',{optionSymbol:'c2',side:'C',strike:100,multiplier:100,openInterest:50,volume:1,gamma:.2,delta:.55,vega:.4,theta:-.12}],
    ['p2',{optionSymbol:'p2',side:'P',strike:100,multiplier:100,openInterest:45,volume:1,gamma:.17,delta:-.45,vega:.35,theta:-.1}],
    ['c3',{optionSymbol:'c3',side:'C',strike:101,multiplier:100,openInterest:20,volume:1,gamma:.08,delta:.5,vega:.25,theta:-.08}]
  ]);
  const session={cfg:{key:'qqq'},price:100,contracts:Array.from(quotes.keys(),os=>({os})),quotes,chainComplete:true};
  render(session);
  const html=helpers.elements.get('so-qqq-gex').innerHTML;
  assert.match(html,/exposure-put-track/);
  assert.match(html,/exposure-call-track/);
  const widths=[...html.matchAll(/style="width:([0-9.]+)%"/g)].map(m=>Number(m[1]));
  assert.ok(widths.length>=6);
  assert.ok(widths.some(x=>x>0&&x<=100),'Call/Put widths must be visible and normalized');
  assert.match(html,/SPOT/);
});


test('public chain-symbol requests have a configured Worker fallback for browser CORS failures', () => {
  const source = fs.readFileSync(path.join(__dirname, '../js/stock-options.js'), 'utf8');
  assert.match(source, /if\(!response\)\{[\s\S]*?if\(!proxyUrl\)[\s\S]*?fetch\(proxyUrl,options\)/);
  assert.match(source, /Worker fallback cũng lỗi/);
});
