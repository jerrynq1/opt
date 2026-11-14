import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const vol = require('../js/stock-options-volatility.js');
globalThis.StockOptionsVolatility = vol;
const surfaces = require('../js/stock-options-surfaces.js');

assert.equal(vol.dividendYieldForSymbol('QQQ'), 0.0045, 'QQQ dividend yield is 0.45%');
assert.equal(vol.dividendYieldForSymbol('GLD'), 0, 'GLD dividend yield is 0%');

// Vanna is d(Delta)/d(decimal sigma); Charm is d(Delta)/d(calendar time),
// meaning the clock advances and time-to-expiry decreases.
const spot = 100, strike = 103, time = 0.42, sigma = 0.27, rate = 0.035, q = 0.0045, eps = 1e-5;
for (const side of ['C', 'P']) {
  const model = vol.bsmVannaCharm(spot, strike, time, sigma, side, rate, q);
  assert.ok(model && Number.isFinite(model.vanna) && Number.isFinite(model.charm));
  const deltaUp = vol.bsmDelta(spot, strike, time, sigma + eps, side, rate, q);
  const deltaDown = vol.bsmDelta(spot, strike, time, sigma - eps, side, rate, q);
  const vannaFD = (deltaUp - deltaDown) / (2 * eps);
  assert.ok(Math.abs(model.vanna - vannaFD) < 2e-6, `${side} Vanna matches finite-difference delta/vol derivative`);
  const deltaEarlier = vol.bsmDelta(spot, strike, time - eps, sigma, side, rate, q);
  const deltaLater = vol.bsmDelta(spot, strike, time + eps, sigma, side, rate, q);
  const charmFD = (deltaEarlier - deltaLater) / (2 * eps);
  assert.ok(Math.abs(model.charm - charmFD) < 2e-5, `${side} Charm matches calendar-time finite difference`);
}

// Constant maturity interpolates total variance, never extrapolates.
const cm = vol.constantMaturity([
  { expiry: 'A', dte: 7, time: 7 / 365.25, atmIV: 0.24, atmSideCount: 2 },
  { expiry: 'B', dte: 30, time: 30 / 365.25, atmIV: 0.20, atmSideCount: 2 }
], [14, 60]);
const expected14 = Math.sqrt((0.24 ** 2 * 7 + ((14 - 7) / (30 - 7)) * ((0.20 ** 2 * 30) - (0.24 ** 2 * 7))) / 14);
assert.ok(Math.abs(cm[0].iv - expected14) < 1e-12);
assert.equal(cm[0].status, 'interpolated-total-variance');
assert.equal(cm[1].iv, null);
assert.equal(cm[1].status, 'unbracketed');

const now = Date.parse('2026-11-14T12:00:00Z');
const expiry = '2026-12-18';
const t = vol.timeToExpiry(expiry, now, 'QQQ');
const baseCall = {
  side: 'C', strike: 100, iv: 0.25, gamma: 0.02, delta: 0.52,
  openInterest: 10, volume: 4, multiplier: 100,
  optionSymbol: 'QQQ261218C00100000'
};
const basePut = {
  side: 'P', strike: 100, iv: 0.25, gamma: 0.02, delta: -0.48,
  openInterest: 20, volume: 6, multiplier: 100,
  optionSymbol: 'QQQ261218P00100000'
};
const vannaModelCall = vol.bsmVannaCharm(100, 100, t, 0.25, 'C', 0, 0.0045);
const vannaModelPut = vol.bsmVannaCharm(100, 100, t, 0.25, 'P', 0, 0.0045);
const vannaSurface = surfaces.build({
  spot: 100, symbol: 'QQQ', now, metric: 'exposure', exposureMetric: 'vanna',
  expiries: [{ expiry, quotes: [baseCall, basePut], complete: true, loadedContracts: 2, expectedContracts: 2 }]
});
const zeroCell = vannaSurface.rows[0].cells.find(cell => cell.value !== null);
assert.ok(zeroCell, 'Vanna surface has a populated ATM cell');
const expectedVanna = (vannaModelCall.vanna * 10 * 100 * 100 * 0.01) + (vannaModelPut.vanna * 20 * 100 * 100 * 0.01);
assert.ok(Math.abs(zeroCell.value - expectedVanna) < 1e-8, 'Vanna exposure uses OI × multiplier × Spot × 1 vol point');
assert.equal(vannaSurface.dividendYield, 0.0045);

const charmSurface = surfaces.build({
  spot: 100, symbol: 'QQQ', now, metric: 'exposure', exposureMetric: 'charm',
  expiries: [{ expiry, quotes: [baseCall, basePut] }]
});
const charmCell = charmSurface.rows[0].cells.find(cell => cell.value !== null);
const expectedCharm = (vannaModelCall.charm * 10 * 100 * 100 / 365.25) + (vannaModelPut.charm * 20 * 100 * 100 / 365.25);
assert.ok(Math.abs(charmCell.value - expectedCharm) < 1e-8, 'Charm exposure is converted to calendar-day USD delta-notional');

const gexCall = surfaces.build({ spot: 100, symbol: 'QQQ', now, metric: 'exposure', exposureMetric: 'gamma', side: 'call', expiries: [{ expiry, quotes: [baseCall, basePut] }] });
const gexPut = surfaces.build({ spot: 100, symbol: 'QQQ', now, metric: 'exposure', exposureMetric: 'gamma', side: 'put', expiries: [{ expiry, quotes: [baseCall, basePut] }] });
assert.ok(gexCall.rows[0].cells.find(c => c.value !== null).value > 0, 'GEX convention makes Calls positive');
assert.ok(gexPut.rows[0].cells.find(c => c.value !== null).value < 0, 'GEX convention makes Puts negative');

const volumeSurface = surfaces.build({ spot: 100, symbol: 'QQQ', now, metric: 'volume', expiries: [{ expiry, quotes: [baseCall, basePut] }] });
const volumeCell = volumeSurface.rows[0].cells.find(c => c.value !== null);
assert.equal(volumeCell.value, 10);
assert.equal(volumeCell.sources.providerIV, 0, 'Volume surface does not run unnecessary IV inversion');
assert.equal(volumeCell.assumedMultiplierCount, 0);
const oiSurface = surfaces.build({ spot: 100, symbol: 'QQQ', now, metric: 'oi', expiries: [{ expiry, quotes: [baseCall, basePut] }] });
assert.equal(oiSurface.rows[0].cells.find(c => c.value !== null).value, 30);

// Missing Volume/OI are unknown, not silently converted to zero on their surfaces.
const missingSurface = surfaces.build({ spot: 100, symbol: 'QQQ', now, metric: 'volume', expiries: [{ expiry, quotes: [{ ...baseCall, volume: null }] }] });
const missingCell = missingSurface.rows[0].cells.find(c => c.contractCount > 0);
assert.equal(missingCell.value, null);
assert.equal(missingCell.assumedVolumeCount, 1);
assert.equal(missingCell.skippedCount, 1);

// A partial expiry must stay explicitly partial.
const partial = surfaces.build({ spot: 100, symbol: 'QQQ', now, metric: 'iv', expiries: [{ expiry, quotes: [baseCall], expectedContracts: 100, loadedContracts: 1, complete: false }] });
assert.equal(partial.rows[0].complete, false);

// An explicit partial state wins even if the loaded and expected counters match.
const explicitPartialFullCount = surfaces.build({
  spot: 100, symbol: 'QQQ', now, metric: 'iv',
  expiries: [{ expiry, quotes: [baseCall, basePut], expectedContracts: 2, loadedContracts: 2, complete: false }]
});
assert.equal(explicitPartialFullCount.rows[0].complete, false,
  'explicit partial/error state must not be overwritten by matching counters');

console.log('Stock Options Surfaces + Vanna/Charm tests: passed');
