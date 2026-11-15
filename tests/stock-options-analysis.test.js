'use strict';
const assert = require('node:assert/strict');
const Analysis = require('../js/stock-options-analysis.js');
const Volatility = require('../js/stock-options-volatility.js');

const now = Date.parse('2026-11-15T15:00:00Z');
const spot = 500;
const expiry = '2026-12-18';
const nextExpiry = '2027-01-15';
function quote(side, strike, openInterest, iv, extra = {}) {
  return {
    optionSymbol: `QQQ${expiry.replaceAll('-', '').slice(2)}${side}${String(Math.round(strike * 1000)).padStart(8, '0')}`,
    side, strike, openInterest, volume: 10, multiplier: 100, iv,
    bid: 2, ask: 2.2, mid: 2.1,
    delta: side === 'C' ? 0.5 : -0.5,
    gamma: 0.04, vega: 0.15, theta: -0.08,
    ...extra
  };
}
const rows = [
  quote('C', 490, 0, 0.30, { optionSymbol: 'QQQ261218C00490000' }),
  quote('C', 510, 1000, 0.30, { optionSymbol: 'QQQ261218C00510000' }),
  quote('P', 490, 700, 0.32, { optionSymbol: 'QQQ261218P00490000' }),
  quote('P', 510, null, 0.32, { optionSymbol: 'QQQ261218P00510000' })
];
const nextRows = [
  { ...quote('C', 490, 250, 0.29), optionSymbol: 'QQQ270115C00490000' },
  { ...quote('C', 510, 500, 0.29), optionSymbol: 'QQQ270115C00510000' },
  { ...quote('P', 490, 350, 0.31), optionSymbol: 'QQQ270115P00490000' },
  { ...quote('P', 510, 400, 0.31), optionSymbol: 'QQQ270115P00510000' }
];
const volatility = Volatility.calculate({
  spot, symbol: 'QQQ', now,
  expiries: [
    { expiry, quotes: rows, complete: true, expectedContracts: 4, loadedContracts: 4 },
    { expiry: nextExpiry, quotes: nextRows, complete: true, expectedContracts: 4, loadedContracts: 4 }
  ]
});
const calc = {
  rows, dist: [
    { strike: 470, callOI: 0, putOI: 0, callVol: 0, putVol: 0, gex: 0 },
    { strike: 480, callOI: 0, putOI: 700, callVol: 0, putVol: 10, gex: -4000 },
    { strike: 500, callOI: 1000, putOI: 0, callVol: 10, putVol: 0, gex: 5000 }
  ],
  totalContracts: 4, complete: true, gexComplete: true, gexAvailable: true,
  gamma: 1000, delta: 42000, vega: 13, theta: -35,
  vannaExposure: 2500, charmExposure: -700,
  vannaCoverage: 1, charmCoverage: 1,
  callOI: 1000, putOI: 700, oiKnown: 2, oiMissing: 1, oiAssumedZero: 1,
  oiAnalyticsCoverage: 1, coverage: 3 / 4,
  callVol: 10, putVol: 10, volumeAssumedZero: 1,
  callGexTotal: 5000, putGexAbsTotal: 4000, gexRatio: 1.25,
  gammaFlip: 495, callOIWall: { strike: 500, callOI: 1000 },
  putOIWall: { strike: 480, putOI: 700 },
  gexCallWall: { strike: 500, gex: 5000 },
  gexPutWall: { strike: 480, gex: -4000 },
  maxPain: { strike: 490, payout: 1000 },
  gexLevels: [{ rank: 1, strike: 500, gex: 5000 }, { rank: 2, strike: 480, gex: -4000 }],
  missingQuoteSymbols: [], gexCoverage: 1, ivCoverage: 1,
  multiplierMissing: 0, ivMissing: 0,
  scopeInfo: null
};

const coreCalcSnapshot = JSON.stringify(calc);
const result = Analysis.analyse({
  symbol: 'QQQ', spot, previousClose: 497.5, priceAgeMs: 10000,
  marketPhase: 'O', priceFeedState: 'connected', calc, expiry,
  scope: 'selected', scopeLabel: 'Selected Expiry', volatility,
  volatilityApi: Volatility, now
});

assert.equal(result.symbol, 'QQQ');
assert.equal(result.greekExposure.deltaNotional, 42000);
assert.equal(result.greekExposure.vannaPerVolPoint, 2500);
assert.equal(result.greekExposure.charmPerCalendarDay, -700);
assert.equal(result.oiAssumedZero, 1, 'received OCC null OI count is retained');
assert.equal(result.stress.rows.length, 9, '3x3 Spot/IV stress scenarios');
assert.equal(result.stress.coverage, 1, 'only positive-OI contracts enter required model coverage');
assert.ok(result.stress.rows.every(row => Number.isFinite(row.netGex) && Number.isFinite(row.dex)));
assert.ok(result.stress.rows.every(row => Number.isFinite(row.vannaPerVolPoint) && Number.isFinite(row.charmPerCalendarDay)));
assert.ok(result.constantMaturity.some(row => row.days === 30), 'constant maturity tenor is passed through');
assert.ok(result.termPoints.length >= 2, 'multi-expiry volatility curve is analyzed');
assert.ok(result.clusters.length > 0, 'confluence levels built');
assert.match(result.report, /null OI/);
assert.match(result.report, /not verified dealer positioning/);
assert.match(result.report, /QQQ q=0\.45%/);

const html = Analysis.render(result);
assert.match(html, /Automatic|EXECUTIVE MARKET BRIEF|OPTIONS POSITIONING/);
assert.match(html, /Copy Full Analysis/);
assert.match(html, /GREEKS & OI-WEIGHTED SENSITIVITY/);
assert.match(html, /WHAT-IF GREEK STRESS GRID/);
assert.match(html, /Constant maturity/);
assert.match(html, /OI không cho biết holder Long hay Short/);

const escaped = Analysis.render(Analysis.analyse({
  symbol: '<img src=x onerror=alert(1)>', spot, calc, expiry, scope: 'selected',
  scopeLabel: '<script>alert(1)</script>', volatility, volatilityApi: Volatility, now
}));
assert.doesNotMatch(escaped, /<img src=x onerror=/);
assert.doesNotMatch(escaped, /<script>alert\(1\)<\/script>/);

const stress = Analysis.simulateGex(rows, { symbol: 'QQQ', spot, now, expiry, volatilityApi: Volatility });
assert.equal(stress.zeroOi, 2, 'explicit zero and received null OI remain zero-weighted in analysis stress model');
assert.equal(stress.requiredContracts, 2);
assert.equal(stress.coverage, 1);


assert.equal(JSON.stringify(calc), coreCalcSnapshot, 'analysis does not mutate core calculation output');

const gldNow = Date.parse('2026-11-15T15:00:00Z');
const gldRows = [
  { ...quote('C', 180, 120, 0.24), optionSymbol: 'GLD261218C00180000', multiplier: 100 },
  { ...quote('P', 180, null, 0.25), optionSymbol: 'GLD261218P00180000', multiplier: 100 }
];
const gldStress = Analysis.simulateGex(gldRows, {
  symbol: 'GLD', spot: 180, now: gldNow, expiry, volatilityApi: Volatility
});
assert.equal(gldStress.zeroOi, 1, 'GLD received null OI follows the same existing zero policy');
assert.equal(gldStress.requiredContracts, 1);
assert.equal(Volatility.dividendYieldForSymbol('GLD'), 0, 'GLD q=0 assumption is preserved');
assert.equal(Volatility.dividendYieldForSymbol('QQQ'), 0.0045, 'QQQ q=0.45% assumption is preserved');

const noData = Analysis.analyse({ symbol: 'GLD', calc: {}, volatility: null, now: gldNow });
assert.match(noData.report, /GLD q=0%/);
assert.match(noData.brief, /chờ underlying Spot/);
assert.equal(noData.stress.rows.length, 0, 'no quotes must not create synthetic stress results');

console.log('Options market analysis tests passed.');
