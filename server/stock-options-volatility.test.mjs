import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const vol = require('../js/stock-options-volatility.js');

const now = Date.parse('2026-11-14T12:00:00Z');
const expiry = '2026-12-14';
const sample = [
  { optionSymbol: 'QQQ261214C00095000', side: 'C', strike: 95, iv: 23, delta: 0.75 },
  { optionSymbol: 'QQQ261214C00100000', side: 'C', strike: 100, iv: 20, delta: 0.51 },
  { optionSymbol: 'QQQ261214C00105000', side: 'C', strike: 105, iv: 22, delta: 0.25 },
  { optionSymbol: 'QQQ261214C00110000', side: 'C', strike: 110, iv: 25, delta: 0.10 },
  { optionSymbol: 'QQQ261214P00105000', side: 'P', strike: 105, iv: 24, delta: -0.75 },
  { optionSymbol: 'QQQ261214P00100000', side: 'P', strike: 100, iv: 21, delta: -0.49 },
  { optionSymbol: 'QQQ261214P00095000', side: 'P', strike: 95, iv: 27, delta: -0.25 },
  { optionSymbol: 'QQQ261214P00090000', side: 'P', strike: 90, iv: 30, delta: -0.10 }
];

const result = vol.calculate({ spot: 100, now, expiries: [{ expiry, quotes: sample }] });
assert.equal(result.loadedExpiries, 1);
assert.equal(result.ivCount, 8);
const row = result.expiries[0];
assert.ok(Math.abs(row.atmIV - 0.205) < 1e-9, 'ATM IV averages the call/put ATM smile values');
assert.ok(Math.abs(row.rr25 - (-0.05)) < 1e-9, '25D RR is call IV minus put IV');
assert.ok(Math.abs(row.bf25 - 0.04) < 1e-9, '25D BF is wing average minus ATM IV');
assert.ok(Math.abs(row.putSkew - 0.065) < 1e-9);
assert.ok(Math.abs(row.callSkew - 0.015) < 1e-9);
assert.ok(row.expectedMove > 5 && row.expectedMove < 7, '1-sigma expected move uses ATM IV and sqrt(T)');
assert.equal(row.surface.put25, 0.27);
assert.equal(row.surface.call25, 0.22);
assert.equal(row.skewCurve.length, 5, 'skew chart receives one point per observed strike');
assert.deepEqual(row.skewCurve.map(point => point.strike), [90, 95, 100, 105, 110]);
assert.equal(row.skewCurve.find(point => point.strike === 95).callIV, 0.23);
assert.equal(row.skewCurve.find(point => point.strike === 95).putIV, 0.27);
assert.equal(row.put25Strike, 95);
assert.equal(row.call25Strike, 105);

const noTenDelta = vol.calculate({ spot: 100, now, expiries: [{ expiry, quotes: [
  { side: 'C', strike: 105, iv: 22, delta: 0.25 },
  { side: 'P', strike: 95, iv: 27, delta: -0.25 },
  { side: 'C', strike: 100, iv: 20, delta: 0.51 },
  { side: 'P', strike: 100, iv: 21, delta: -0.49 }
] }] });
assert.equal(noTenDelta.expiries[0].surface.call10, null, '25-delta contracts must not be mislabelled as 10-delta wings');
assert.equal(noTenDelta.expiries[0].surface.put10, null);

// Provider delta in percent units is normalized to decimal delta.
const percentDelta = vol.calculate({ spot: 100, now, expiries: [{ expiry, quotes: [
  { side: 'C', strike: 105, iv: 22, delta: 25 },
  { side: 'P', strike: 95, iv: 27, delta: -25 },
  { side: 'C', strike: 100, iv: 20, delta: 51 },
  { side: 'P', strike: 100, iv: 21, delta: -49 }
] }] });
assert.ok(Math.abs(percentDelta.expiries[0].rr25 - (-0.05)) < 1e-9);

// If provider IV is unavailable, a valid option mid can be inverted to BSM IV.
const t = vol.timeToExpiry(expiry, now);
const modelMid = vol.bsmPrice(100, 100, t, 0.20, 'C');
const midFallback = vol.calculate({ spot: 100, now, expiries: [{ expiry, quotes: [
  { side: 'C', strike: 100, iv: null, delta: null, mid: modelMid }
] }] });
assert.equal(midFallback.midDerivedIVCount, 1);
assert.ok(Math.abs(midFallback.expiries[0].atmIV - 0.20) < 1e-5);
assert.equal(midFallback.expiries[0].sourceLabel, 'Mid-derived BSM IV');

// Expired contracts are not shown as an active term-structure point.
const expired = vol.calculate({ spot: 100, now: Date.parse('2026-11-15T18:00:00Z'), expiries: [
  { expiry: '2026-11-14', quotes: sample }
] });
assert.equal(expired.loadedExpiries, 0);



// Clean skew is display-only: raw metrics continue to use every valid IV, while
// the chart receives quote-quality-filtered IVs for its Clean mode.
const cleanInput = [
  { side: 'C', strike: 95, iv: 31, delta: 0.35, bid: 1.90, ask: 2.00, volume: 20, openInterest: 80 },
  { side: 'C', strike: 100, iv: 22, delta: 0.51, bid: 2.90, ask: 3.00, volume: 12, openInterest: 50 },
  { side: 'C', strike: 105, iv: 63, delta: 0.24, bid: 0, ask: 0.10, volume: 0, openInterest: 0 },
  { side: 'C', strike: 110, iv: 58, delta: 0.12, bid: 1.00, ask: 3.00, volume: 0, openInterest: 2 },
  { side: 'P', strike: 90, iv: 36, delta: -0.10, bid: 0.95, ask: 1.05, volume: 15, openInterest: 40 },
  { side: 'P', strike: 95, iv: 34, delta: -0.25, bid: 1.90, ask: 2.00, volume: 18, openInterest: 70 },
  { side: 'P', strike: 100, iv: 23, delta: -0.49, bid: 2.90, ask: 3.00, volume: 10, openInterest: 60 }
];
const cleanResult = vol.calculate({ spot: 100, now, expiries: [{ expiry, quotes: cleanInput }] });
const cleanRow = cleanResult.expiries[0];
assert.equal(cleanRow.ivCount, cleanInput.length, 'raw IV calculation retains all valid provider IVs');
assert.equal(cleanRow.skewRejectedCount, 2, 'clean display filters zero-bid and very wide low-liquidity quotes');
assert.equal(cleanRow.cleanIVCount, 5);
assert.equal(cleanRow.skewCurve.find(item => item.strike === 105).callIV, 0.63, 'Raw IV remains available');
assert.equal(cleanRow.skewCurve.find(item => item.strike === 105).callCleanIV, null, 'Zero-bid quote is excluded from Clean curve');
assert.equal(cleanRow.skewCurve.find(item => item.strike === 110).callCleanIV, null, 'Wide low-liquidity quote is excluded from Clean curve');
assert.ok(Number.isFinite(cleanRow.skewCurve.find(item => item.strike === 95).callCleanIV));
assert.equal(cleanRow.skewQualityCounts['zero-bid'], 1);
assert.equal(cleanRow.cleanIVCount, 5);
assert.equal(cleanRow.skewQualityCounts['wide-spread-low-liquidity'], 1);
const emptyBook = vol.calculate({ spot: 100, now, expiries: [{ expiry, quotes: [
  { side: 'C', strike: 100, iv: 22, delta: 0.5, bid: 0, ask: 0, volume: 0, openInterest: 0 }
] }] });
assert.equal(emptyBook.expiries[0].skewCurve[0].callCleanIV, null, 'an empty bid/ask book is not shown in Clean');
assert.equal(emptyBook.expiries[0].skewQualityCounts['empty-book'], 1);


// Audit regression: 25-delta metrics are interpolated between bracketing deltas,
// rather than borrowing whichever contract happens to be nearest.
const deltaInterpolation = vol.calculate({ spot: 100, now, expiries: [{ expiry, quotes: [
  { side: 'C', strike: 104, iv: 0.22, delta: 0.20 },
  { side: 'C', strike: 106, iv: 0.28, delta: 0.30 },
  { side: 'P', strike: 96, iv: 0.30, delta: -0.30 },
  { side: 'P', strike: 94, iv: 0.24, delta: -0.20 },
  { side: 'C', strike: 100, iv: 0.20, delta: 0.50 },
  { side: 'P', strike: 100, iv: 0.21, delta: -0.50 }
] }] });
assert.ok(Math.abs(deltaInterpolation.expiries[0].call25IV - 0.25) < 1e-9);
assert.ok(Math.abs(deltaInterpolation.expiries[0].put25IV - 0.27) < 1e-9);
assert.equal(deltaInterpolation.expiries[0].call25Strike, 105);
assert.equal(deltaInterpolation.expiries[0].call25Method, 'delta-interpolated');

// Audit regression: never label a one-sided far-OTM observation as ATM.
const unbracketedAtm = vol.calculate({ spot: 100, now, expiries: [{ expiry, quotes: [
  { side: 'C', strike: 115, iv: 0.35, delta: 0.15 },
  { side: 'P', strike: 90, iv: 0.31, delta: -0.15 }
] }] });
assert.equal(unbracketedAtm.expiries[0].atmIV, null);
assert.equal(unbracketedAtm.expiries[0].atmSideCount, 0);

// Audit regression: an excessively wide strike bracket is not accepted as ATM.
const wideAtmBracket = vol.calculate({ spot: 100, now, expiries: [{ expiry, quotes: [
  { side: 'C', strike: 90, iv: 0.25, delta: 0.65 },
  { side: 'C', strike: 110, iv: 0.35, delta: 0.35 }
] }] });
assert.equal(wideAtmBracket.expiries[0].atmCallIV, null);

// Low but positive provider IVs are valid; do not impose an arbitrary 1% floor.
assert.ok(Math.abs(vol.ivSigma(0.005) - 0.005) < 1e-12);

// GLD and QQQ use their late-close 16:15 ET schedule; normal equity defaults to 16:00 ET.
const winterDate = '2026-12-18';
const gldClose = vol.expiryAtNewYorkClose(winterDate, 'GLD');
const qqqClose = vol.expiryAtNewYorkClose(winterDate, 'QQQ');
const standardClose = vol.expiryAtNewYorkClose(winterDate, 'AAPL');
assert.equal(new Date(gldClose).toISOString(), '2026-12-18T21:15:00.000Z');
assert.equal(new Date(qqqClose).toISOString(), '2026-12-18T21:15:00.000Z');
assert.equal(new Date(standardClose).toISOString(), '2026-12-18T21:00:00.000Z');
const summerClose = vol.expiryAtNewYorkClose('2026-07-17', 'GLD');
assert.equal(new Date(summerClose).toISOString(), '2026-07-17T20:15:00.000Z');
const seventyFiveMinutes = vol.timeToExpiry('2026-12-18', Date.parse('2026-12-18T20:00:00Z'), 'QQQ');
assert.ok(Math.abs(seventyFiveMinutes - (75 / (60 * 24 * 365.25))) < 1e-12, 'QQQ DTE includes the 16:15 ET late close');

// Clean chart marker calculations are kept separate from raw headline metrics.
assert.ok(Number.isFinite(cleanRow.cleanAtmIV));
assert.equal(cleanRow.cleanIVCount, 5);

console.log('Stock Options Volatility Analytics tests: passed');


// Audit: mid-derived IV must retain valid sub-1% vol observations, but not return
// the arbitrary lower solver bound when the premium contains no time value.
const lowVolMid = vol.bsmPrice(100, 100, t, 0.005, 'C');
const lowVolInverted = vol.impliedVolFromMid(lowVolMid, 100, 100, t, 'C');
assert.ok(lowVolInverted !== null && Math.abs(lowVolInverted - 0.005) < 1e-5);
assert.equal(vol.impliedVolFromMid(0, 100, 100, t, 'C'), null);

// Delta interpolation is deliberately unavailable when the nearest bracket is sparse.
const sparseDelta = vol.interpolateAtDelta([
  { side:'C', delta:0.16, iv:0.20, strike:110 },
  { side:'C', delta:0.34, iv:0.30, strike:105 }
], 'C', 0.25);
assert.equal(sparseDelta, null);


// A provider Mid outside its own valid bid/ask book is ignored for model inversion.
const bookTime = vol.timeToExpiry(expiry, now);
const fairMid = vol.bsmPrice(100, 100, bookTime, 0.24, 'C');
const bookFallback = vol.calculate({ spot:100, now, expiries:[{ expiry, quotes:[{
  side:'C', strike:100, iv:null, delta:null,
  bid:fairMid-0.05, ask:fairMid+0.05, mid:0.01
}]}]});
assert.ok(Math.abs(bookFallback.expiries[0].atmIV - 0.24) < 1e-5);
