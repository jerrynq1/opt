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

console.log('Stock Options Volatility Analytics tests: passed');
