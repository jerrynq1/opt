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
    '  window.__stockOptionsTest={normaliseQuote,mergeLiveQuote,calc,strikeSymbols,renderExposure,renderLevels,renderChain,quoteCell,gammaFlipOf,maxPainOf,bsmGamma,resolveGamma,gammaFlipInputKey,yearsToExpiry,expiryAtUsCloseUtc,quoteRowsFromReply,effectiveMultiplier,mergeQuoteSnapshot,quoteNeedsAnalyticsRetry,collectGexLadderExclusions,isExcludedGexStrike};\n  return;\n  buildViews();\n  window.stockOptionsSetActive=setActive;'
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
    price: 100, contracts: [{ os: 'GLD1261110P00100000' }],
    quotes: new Map([['GLD1261110P00100000', {
      optionSymbol: 'GLD1261110P00100000', side: 'P', strike: 100,
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
  assert.equal(result.oiAssumedZero, 1);
  assert.equal(result.dist[0].gex, -5000);
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

test('OI Walls rank by OI, CW/PW rank by Net GEX, and GEX 1-10 excludes every duplicate Key Level', () => {
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
  assert.ok(!ladderStrikes.includes(120), 'Call OI Wall excluded from GEX ladder');
  assert.ok(!ladderStrikes.includes(125), 'Put OI Wall excluded from GEX ladder');
  assert.ok(!ladderStrikes.includes(result.maxPain.strike), 'Max Pain strike excluded from GEX ladder');
  assert.deepEqual(ladderStrikes, [115,100,130], 'remaining strikes ranked by absolute Net GEX');
});

test('GEX exclusion set deduplicates CW, PW, OI Walls, every tied Max Pain strike and Gamma Flip', () => {
  const excluded=helpers.collectGexLadderExclusions({
    callOIWall:{strike:120},putOIWall:{strike:125},
    gexCallWall:{strike:105},gexPutWall:{strike:110},
    maxPain:{strike:115,tiedStrikes:[115,116,117]},gammaFlip:118
  });
  assert.deepEqual(Array.from(excluded, x=>x.strike),[120,125,105,110,115,116,117,118]);
  assert.ok(helpers.isExcludedGexStrike(116,excluded));
  assert.ok(helpers.isExcludedGexStrike(118.00001,excluded),'near-identical strike/zero-gamma overlap is excluded');
  assert.ok(!helpers.isExcludedGexStrike(119,excluded));
});

test('GEX preview stays provisional when one contract lacks both provider Gamma and IV', () => {
  const session = {
    price:100, chainComplete:true,
    contracts:[{os:'a'},{os:'b'}],
    quotes:new Map([
      ['a',{optionSymbol:'a',side:'C',strike:100,multiplier:1,openInterest:10,gamma:.2,iv:.25,volume:0}],
      ['b',{optionSymbol:'b',side:'P',strike:105,multiplier:1,openInterest:10,gamma:null,iv:null,volume:0}]
    ])
  };
  const result=helpers.calc(session);
  assert.equal(result.oiComplete,true);
  assert.equal(result.gexComplete,false);
  assert.equal(result.gexProvisional,true);
  assert.equal(result.gexCoverage,.5);
  assert.equal(result.gexCallWall.strike,100);
  assert.equal(result.gexPutWall,null);
  assert.equal(result.gammaFlip,null);
});

test('missing underlying Spot blocks BSM GEX even when IV and multiplier coverage are complete', () => {
  const expiry='2026-12-18', now=Date.parse('2026-11-12T12:00:00Z');
  const contracts=[{os:'c100'},{os:'p100'}];
  const quotes=new Map([
    ['c100',{optionSymbol:'c100',side:'C',strike:100,multiplier:100,openInterest:120,iv:.28,gamma:null,volume:0}],
    ['p100',{optionSymbol:'p100',side:'P',strike:100,multiplier:100,openInterest:150,iv:.30,gamma:null,volume:0}]
  ]);
  const session={cfg:{key:'qqq'},price:null,expiry,chainComplete:true,contracts,quotes};
  const result=helpers.calc(session,now);
  assert.equal(result.complete,true);
  assert.equal(result.ivKnown,2);
  assert.equal(result.ivMissing,0);
  assert.equal(result.multiplierMissing,0);
  assert.equal(result.gammaProviderKnown,0);
  assert.equal(result.gammaDerivedKnown,0);
  assert.equal(result.gexComplete,false);
  assert.equal(result.gexMissing,2);
  helpers.renderLevels(session);
  const html=helpers.elements.get('so-qqq-levels').innerHTML;
  assert.match(html,/Chờ Spot underlying để tính Gamma BSM\/IV và GEX/);
  assert.match(html,/Chờ Spot underlying từ Binance price stream/);
});

test('renderExposure shows waiting-for-Spot state without throwing when Spot is absent', () => {
  const session={cfg:{key:'qqq'},price:null,expiry:'2026-11-20',chainComplete:true,contracts:[],quotes:new Map()};
  assert.doesNotThrow(()=>helpers.renderExposure(session));
  const html=helpers.elements.get('so-qqq-gex').innerHTML;
  assert.match(html,/Đang chờ Spot underlying/);
  assert.match(html,/Chờ Spot underlying từ Binance price stream/);
});

test('zero provider Gamma falls back to BSM IV instead of creating a false zero-GEX strike', () => {
  const q={optionSymbol:'QQQ261120C00100000',side:'C',strike:100,multiplier:100,openInterest:10,iv:.25,gamma:0};
  const resolved=helpers.resolveGamma(q,100,0.02);
  assert.ok(resolved.gamma>0);
  assert.equal(resolved.source,'bsm-iv');
});

test('GEX is derived from Option Chain IV when Binance omits per-strike Gamma', () => {
  const expiry='2026-12-18', now=Date.parse('2026-11-12T12:00:00Z'), spot=100;
  const rows=[
    ['c100','C',100,120,.28],['c105','C',105,90,.30],
    ['p95','P',95,110,.32],['p110','P',110,150,.29]
  ];
  const contracts=rows.map(([os])=>({os}));
  const quotes=new Map(rows.map(([os,side,strike,oi,iv])=>[os,{
    optionSymbol:os,side,strike,multiplier:100,openInterest:oi,iv,gamma:null,volume:0
  }]));
  const result=helpers.calc({price:spot,expiry,chainComplete:true,contracts,quotes},now);
  assert.equal(result.gexComplete,true);
  assert.equal(result.gexCoverage,1);
  assert.equal(result.gammaProviderKnown,0);
  assert.equal(result.gammaDerivedKnown,4);
  assert.equal(result.gexMissing,0);
  assert.ok(result.gexCallWall && result.gexCallWall.gex>0);
  assert.ok(result.gexPutWall && result.gexPutWall.gex<0);
  assert.ok(result.gexLevels.length>0);
  assert.ok(result.gexRatio>0);
  const time=helpers.yearsToExpiry(expiry,now);
  const expected=helpers.bsmGamma(spot,100,time,.28)*120*100*spot*spot*.01;
  assert.ok(Math.abs(result.dist.find(x=>x.strike===100).callGex-expected)<1e-8);
  assert.equal(result.gammaFlipComplete,true);
});

test('Key Levels render GEX walls and ladder from derived IV Gamma without provider GEX', () => {
  const expiry='2026-12-18', now=Date.parse('2026-11-12T12:00:00Z');
  const rows=[['c100','C',100,120,.28],['c105','C',105,90,.30],['p95','P',95,110,.32],['p110','P',110,150,.29]];
  const quotes=new Map(rows.map(([os,side,strike,oi,iv])=>[os,{optionSymbol:os,side,strike,multiplier:100,openInterest:oi,iv,gamma:null,volume:0}]));
  const session={cfg:{key:'qqq'},price:100,expiry,chainComplete:true,contracts:rows.map(([os])=>({os})),quotes};
  helpers.renderLevels(session);
  const html=helpers.elements.get('so-qqq-levels').innerHTML;
  assert.match(html,/CW · GEX CALL WALL/);
  assert.match(html,/PW · GEX PUT WALL/);
  assert.match(html,/GEX ladder/);
  assert.doesNotMatch(html,/Chưa có dữ liệu GEX theo strike/);
  assert.match(html,/BSM\/IV 4/);
});


test('signed provider Put Gamma is normalized to positive option Gamma before applying the Put GEX sign', () => {
  const resolved=helpers.resolveGamma({gamma:-.25,iv:null,strike:100},100,null);
  assert.equal(resolved.gamma,.25);
  assert.equal(resolved.source,'provider');
  const session={price:100,chainComplete:true,contracts:[{os:'put'}],quotes:new Map([
    ['put',{optionSymbol:'put',side:'P',strike:100,multiplier:10,openInterest:5,gamma:-.25,iv:null,volume:0}]
  ])};
  const result=helpers.calc(session);
  assert.equal(result.gexComplete,true);
  assert.equal(result.dist[0].gex,-1250);
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


test('322-contract expiry with 277 observed OI and 45 null OI still produces full analytics by zero-fill', () => {
  const contracts=[];
  const quotes=new Map();
  for(let i=0;i<161;i++){
    const strike=570+i;
    for(const side of ['C','P']){
      const symbol=`QQQ261120${side}${String(strike*1000).padStart(8,'0')}`;
      const index=contracts.length;
      contracts.push({os:symbol});
      const assumedZero=index<45;
      quotes.set(symbol,{
        optionSymbol:symbol,side,strike,multiplier:100,
        openInterest:assumedZero?null:(side==='C'?100+i:90+i),
        volume:assumedZero?null:25,gamma:.001,iv:.30,delta:side==='C'?.5:-.5
      });
    }
  }
  const contractSymbols=new Set(contracts.map(x=>x.os));
  const result=helpers.calc({price:650,expiry:'2026-11-20',chainComplete:true,contracts,contractSymbols,quotes},Date.parse('2026-11-12T12:00:00Z'));
  assert.equal(result.totalContracts,322);
  assert.equal(result.oiKnown,277);
  assert.equal(result.oiAssumedZero,45);
  assert.equal(result.oiComplete,true);
  assert.ok(Math.abs(result.coverage-(277/322))<1e-12,'observed OI coverage remains honest');
  assert.equal(result.oiAnalyticsCoverage,1,'all received contracts are represented in analytics via observed OI or zero-fill');
  assert.equal(result.gexComplete,true);
  assert.equal(result.gexKnown,322);
  assert.equal(result.gexMissing,0);
  assert.equal(result.maxPainComplete,true);
  assert.ok(result.maxPain);
  assert.ok(result.gexCallWall);
  assert.ok(result.gexPutWall);
  assert.equal(result.gexLevels.length,10);
});

test('Null OI on a received contract is zero-filled for OI/GEX/Max Pain analytics', () => {
  const session = {
    price: 100, expiry:'2026-11-20', chainComplete: true,
    contracts: [{ os: 'QQQ261120C00090000' }, { os: 'QQQ261120P00110000' }],
    quotes: new Map([
      ['c', { optionSymbol:'c', side:'C', strike:90, multiplier:1, openInterest:10, volume:0, gamma:0.1, iv:.25, delta:0.5 }],
      ['p', { optionSymbol:'p', side:'P', strike:110, multiplier:1, openInterest:null, volume:null, gamma:0.1, iv:null, delta:-0.5 }]
    ])
  };
  const result = helpers.calc(session,Date.parse('2026-11-12T12:00:00Z'));
  assert.equal(result.complete, true);
  assert.equal(result.oiComplete, true);
  assert.equal(result.oiMissing, 1);
  assert.equal(result.oiAssumedZero, 1);
  assert.equal(result.volumeAssumedZero, 1);
  assert.equal(result.dist.find(x=>x.strike===110).putOI, 0);
  assert.equal(result.dist.find(x=>x.strike===110).putPainOI, 0);
  assert.equal(result.gexComplete, true);
  assert.equal(result.gexMissing, 0);
  assert.equal(result.maxPainComplete, true);
  assert.equal(result.maxPain.strike, 90);
  assert.equal(result.maxPain.payout, 0);
  assert.equal(result.gammaFlipComplete, true);
});


test('Gamma Flip excludes null-OI contracts as assumed zero but keeps the completed full-chain calculation', () => {
  const expiry='2026-11-20', now=Date.parse('2026-11-12T12:00:00Z');
  const rows=[
    {optionSymbol:'c110',side:'C',strike:110,multiplier:100,openInterest:100,iv:.30},
    {optionSymbol:'p90',side:'P',strike:90,multiplier:100,openInterest:100,iv:.30},
    {optionSymbol:'c125',side:'C',strike:125,multiplier:null,openInterest:null,iv:null}
  ];
  const result=helpers.gammaFlipOf(rows,100,expiry,now);
  assert.equal(result.complete,true);
  assert.ok(result.coverage===1);
  assert.ok(result.level>90&&result.level<100);
});

test('received null OI is not retried forever; it is zero-filled until an actual OI update arrives', () => {
  const symbol='QQQ261120C00100000';
  const session={quotes:new Map([[symbol,{optionSymbol:symbol,openInterest:null,iv:null,multiplier:null}]])};
  assert.equal(helpers.quoteNeedsAnalyticsRetry(session,symbol),false);
  helpers.mergeLiveQuote(session,{os:symbol,oi:'25',iv:'.30',m:'100'});
  assert.equal(session.quotes.get(symbol).openInterest,25);
});

test('Option Chain cells display null OI and Volume as zero with an assumed-zero marker', () => {
  const htmlOI=helpers.quoteCell({openInterest:null},'openInterest',String);
  const htmlVol=helpers.quoteCell({volume:null},'volume',String);
  assert.match(htmlOI,/>0<\/td>/);
  assert.match(htmlVol,/>0<\/td>/);
  assert.match(htmlOI,/opt-assumed-zero/);
  assert.match(htmlVol,/opt-assumed-zero/);
});

test('Max Pain is unavailable when every contract has zero OI instead of fabricating the lowest strike', () => {
  const dist=[
    {strike:90,callPainOI:0,putPainOI:0},
    {strike:100,callPainOI:0,putPainOI:0},
    {strike:110,callPainOI:0,putPainOI:0}
  ];
  assert.equal(helpers.maxPainOf(dist),null);
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



test('calc does not throw when rendering full-chain coverage diagnostics', () => {
  const contracts=[{os:'QQQ261120C00095000'},{os:'QQQ261120C00100000'},{os:'QQQ261120P00105000'}];
  const quotes=new Map([
    ['c95',{optionSymbol:'QQQ261120C00095000',side:'C',strike:95,multiplier:100,openInterest:10,iv:.25,gamma:null,volume:0}],
    ['c100',{optionSymbol:'QQQ261120C00100000',side:'C',strike:100,multiplier:100,openInterest:10,iv:.25,gamma:null,volume:0}],
    ['p105',{optionSymbol:'QQQ261120P00105000',side:'P',strike:105,multiplier:100,openInterest:12,iv:.27,gamma:null,volume:0}]
  ]);
  const result=helpers.calc({price:100,expiry:'2026-11-20',chainComplete:true,contracts,contractSymbols:new Set(contracts.map(x=>x.os)),quotes},Date.parse('2026-11-12T12:00:00Z'));
  assert.equal(result.oiComplete,true);
  assert.equal(result.gexComplete,true);
  assert.equal(result.oiMissingSamples.length,0);
  assert.equal(result.gammaDerivedKnown,3);
  assert.ok(result.gexCallWall);
  assert.equal(result.maxPainComplete,true);
  assert.ok(result.maxPain);
});

test('standard QQQ and GLD OCC contracts can use disclosed 100-share multiplier fallback; adjusted roots cannot', () => {
  const qqq=helpers.effectiveMultiplier({optionSymbol:'QQQ261120C00100000',multiplier:null});
  const gld=helpers.effectiveMultiplier({optionSymbol:'GLD261120P00100000',multiplier:null});
  assert.equal(qqq.value,100);assert.equal(qqq.source,'standard-100-assumption');
  assert.equal(gld.value,100);assert.equal(gld.source,'standard-100-assumption');
  assert.equal(helpers.effectiveMultiplier({optionSymbol:'QQQ1261120C00100000',multiplier:null}).value,null);
});

test('Binance nested quote reply shapes are recursively extracted', () => {
  const rows=helpers.quoteRowsFromReply({success:true,data:{result:{quotes:[{os:'QQQ261120C00100000',oi:'10'},{os:'QQQ261120P00100000',oi:'12'}]}}});
  assert.equal(rows.length,2);
  assert.equal(helpers.normaliseQuote(rows[0]).openInterest,10);
});

test('normalizer falls through null OI aliases and accepts nested contract quote fields', () => {
  const q=helpers.normaliseQuote({os:'QQQ261120C00100000',oi:null,data:{openInterest:'345',multiplier:'100',markIV:'0.31'},greeks:{gamma:'0.04'}});
  assert.equal(q.openInterest,345);
  assert.equal(q.multiplier,100);
  assert.equal(q.iv,.31);
  assert.equal(q.gamma,.04);
});

test('chain-symbol contract metadata fills fields omitted as null by the quote response', () => {
  const meta=helpers.normaliseQuote({os:'GLD261120P00200000',oi:77,m:100,iv:.28});
  const quote=helpers.normaliseQuote({os:'GLD261120P00200000',oi:null,m:null,iv:null,ga:.05,last:'2.1'});
  const enriched=helpers.mergeQuoteSnapshot(meta,quote);
  assert.equal(enriched.openInterest,77);
  assert.equal(enriched.multiplier,100);
  assert.equal(enriched.iv,.28);
  assert.equal(enriched.gamma,.05);
  assert.equal(enriched.last,2.1);
});

test('partial live update with explicit null OI, IV and multiplier preserves previous valid analytics', () => {
  const symbol='QQQ261120C00100000';
  const initial=helpers.normaliseQuote({os:symbol,t:'call',m:100,oi:250,iv:.3,ga:.04});
  const session={contracts:[{os:symbol}],contractSymbols:new Set([symbol]),quotes:new Map([[symbol,initial]]),price:100,oiLastUpdate:0};
  helpers.mergeLiveQuote(session,{os:symbol,oi:null,iv:null,m:null,p:'4.2'});
  const updated=session.quotes.get(symbol);
  assert.equal(updated.openInterest,250);
  assert.equal(updated.iv,.3);
  assert.equal(updated.multiplier,100);
  assert.equal(updated.last,4.2);
});

test('quote with a payload but missing OI is accepted as zero-fill and not retried forever', () => {
  const symbol='QQQ261120C00100000';
  const session={quotes:new Map([[symbol,{optionSymbol:symbol,side:'C',strike:100,openInterest:null,multiplier:100,gamma:.1,iv:.3}]])};
  assert.equal(helpers.quoteNeedsAnalyticsRetry(session,symbol),false);
  session.quotes.set(symbol,{...session.quotes.get(symbol),openInterest:10});
  assert.equal(helpers.quoteNeedsAnalyticsRetry(session,symbol),false);
});

test('positive-OI contract with provider Gamma but missing IV is retried for Zero Gamma repricing', () => {
  const symbol='QQQ261120C00100000';
  const session={quotes:new Map([[symbol,{optionSymbol:symbol,side:'C',strike:100,openInterest:10,multiplier:100,gamma:.1,iv:null}]])};
  assert.equal(helpers.quoteNeedsAnalyticsRetry(session,symbol),true);
  session.quotes.set(symbol,{...session.quotes.get(symbol),iv:.28});
  assert.equal(helpers.quoteNeedsAnalyticsRetry(session,symbol),false);
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
  assert.match(source, /if\(!response\)\{[\s\S]*?if\(!proxyUrl\)[\s\S]*?fetchWithTimeout\(proxyUrl,options,REQUEST_TIMEOUT_MS,deadlineAt\)/);
  assert.match(source, /Worker fallback cũng lỗi/);
});
