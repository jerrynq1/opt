import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const vol = require('../js/stock-options-volatility.js');
globalThis.StockOptionsVolatility = vol;
const surfaces = require('../js/stock-options-surfaces.js');
const chart3d = require('../js/stock-options-3d.js');

const now = Date.parse('2026-01-02T14:00:00Z'); // 09:00 ET, before the ETF 16:15 ET close.
const expiry = '2026-01-02';
const currentTime = vol.timeToExpiry(expiry, now, 'QQQ');
const currentDte = currentTime * 365.25;
assert.ok(currentDte > 0 && currentDte < 1, 'test expiry is a fractional 0DTE');

const quotes = [];
for (const [strike, delta] of [[90, .92], [100, .52], [110, .18]]) {
  quotes.push({
    optionSymbol: `QQQ260102C${String(strike * 1000).padStart(8, '0')}`,
    side: 'C', strike, delta, gamma: .012, iv: .28, vega: .045, theta: -.08,
    openInterest: 120, volume: 22, multiplier: 100
  });
  quotes.push({
    optionSymbol: `QQQ260102P${String(strike * 1000).padStart(8, '0')}`,
    side: 'P', strike, delta: delta - 1, gamma: .012, iv: .30, vega: .047, theta: -.075,
    openInterest: 90, volume: 18, multiplier: 100
  });
}
const expiryInput = [{ expiry, quotes, expectedContracts: quotes.length, loadedContracts: quotes.length, complete: true }];
const bins = [-10, 0, 10];

const slices = surfaces.buildIntradayTimeSlices(currentTime, 9);
assert.equal(slices.length, 9, 'creates nine time slices');
assert.ok(slices.every((slice, i) => slice.time > 0 && (!i || slice.dte > slices[i - 1].dte)), 'remaining DTE increases monotonically from near expiry to now');
assert.ok(Math.abs(slices.at(-1).dte - currentDte) < 1e-10, 'last slice is exactly the current observed DTE');
assert.ok(slices[0].dte > 0 && slices[0].dte < currentDte, 'first projection remains above mathematical T=0');

const gex = surfaces.build({ spot: 100, symbol: 'QQQ', now, bins, metric: 'exposure', exposureMetric: 'gamma', expiries: expiryInput });
assert.equal(gex.projection?.type, 'time-decay');
assert.equal(gex.projection.sliceCount, 9);
assert.equal(gex.loadedExpiries, 1, 'one listed expiry remains one listed expiry');
assert.equal(gex.rows.length, 9, 'one listed 0DTE expiry expands to nine model time slices');
assert.equal(new Set(gex.rows.map(row => row.expiry)).size, 1, 'all time slices retain the same real expiry');
const gexBase = gex.rows.find(row => Math.abs(row.dte - currentDte) < 1e-8);
const gexNear = gex.rows.reduce((a, b) => a.dte < b.dte ? a : b);
assert.ok(gexBase?.cells[1].value > 0, 'observed/current ATM GEX cell is populated');
assert.ok(gexNear?.cells[1].value > 0, 'near-expiry projected ATM GEX cell is populated');
assert.notEqual(gexBase.cells[1].value, gexNear.cells[1].value, 'GEX is recalculated as time-to-expiry decays');
assert.ok(gexNear.cells[1].sources.bsmDerivedGreek > 0, 'projected GEX is clearly sourced from BSM');

const iv = surfaces.build({ spot: 100, symbol: 'QQQ', now, bins, metric: 'iv', expiries: expiryInput });
const ivValues = iv.rows.map(row => row.cells[1].value);
assert.ok(ivValues.every(value => Math.abs(value - ivValues[0]) < 1e-12), 'IV is held constant across the modelled time axis');
const volume = surfaces.build({ spot: 100, symbol: 'QQQ', now, bins, metric: 'volume', expiries: expiryInput });
assert.ok(volume.rows.every(row => row.cells[1].value === volume.rows[0].cells[1].value), 'observed volume is held constant, not invented through time');
const oi = surfaces.build({ spot: 100, symbol: 'QQQ', now, bins, metric: 'oi', expiries: expiryInput });
assert.ok(oi.rows.every(row => row.cells[1].value === oi.rows[0].cells[1].value), 'OI is held constant through time');

const greek = surfaces.buildGreeks({ spot: 100, symbol: 'QQQ', now, bins, metric: 'gamma', side: 'call', expiries: expiryInput });
assert.equal(greek.rows.length, 9, 'Greek surface uses the same nine time slices');
const greekBase = greek.rows.find(row => Math.abs(row.dte - currentDte) < 1e-8);
const greekNear = greek.rows.reduce((a, b) => a.dte < b.dte ? a : b);
assert.ok(greekBase.cells[1].providerCount > 0, 'current observed row preserves provider Greek when available');
assert.ok(greekNear.cells[1].modelCount > 0, 'future time slices are BSM model projections');
assert.notEqual(greekBase.cells[1].value, greekNear.cells[1].value, 'Greek surface changes along remaining-time axis');

const mesh = chart3d.makeMesh(gex);
assert.equal(mesh.singleExpiry, true, 'mesh knows all generated rows belong to one listed expiry');
assert.equal(mesh.timeDecayProjection, true, 'mesh labels projected time-decay mode');
assert.equal(mesh.renderMode, 'time-decay-surface', 'single 0DTE now produces a real XYZ area mesh');
assert.ok(mesh.faces.length > 0, 'time slices create faces between strike and time dimensions');
assert.ok(mesh.dteTicks.length >= 3, 'Y axis includes several remaining-DTE tick values');
assert.ok(mesh.axisMaxDte <= 1 && mesh.axisMaxDte > 0, 'Y axis spans the actual remaining 0DTE interval, not a single fixed 1');
assert.ok(mesh.rows[0].dte < mesh.rows.at(-1).dte, 'rendered rows are ordered from near expiry to current time');
assert.deepEqual(mesh.dteTicks.slice(0, 2), [0, mesh.dteTicks[1]], 'Y axis starts at 0DTE and then subdivides remaining time');
assert.ok(new Set(mesh.dteTicks.map(chart3d.formatDteTick)).size === mesh.dteTicks.length, 'same-day Y-axis labels are distinct and readable');

const non0dteExpiry = '2026-01-09';
const non0dte = surfaces.build({
  spot: 100, symbol: 'QQQ', now, bins, metric: 'volume',
  expiries: [{ expiry: non0dteExpiry, quotes, expectedContracts: quotes.length, loadedContracts: quotes.length, complete: true }]
});
assert.equal(non0dte.projection, null, 'a single weekly expiry is not falsely treated as an intraday 0DTE scenario');
assert.equal(non0dte.rows.length, 1);

console.log('Stock Options 0DTE time-decay surface tests: passed');
