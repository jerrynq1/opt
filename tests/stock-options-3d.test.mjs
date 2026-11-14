import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const vol = require('../js/stock-options-volatility.js');
globalThis.StockOptionsVolatility = vol;
const surfaces = require('../js/stock-options-surfaces.js');
const chart3d = require('../js/stock-options-3d.js');
const now = Date.UTC(2026, 0, 1, 12, 0, 0);
const expiryA = '2026-01-30';
const expiryB = '2026-02-27';
const q = (side, strike, delta, iv, oi = 100) => ({
  optionSymbol: `QQQ260130${side}${String(Math.round(strike * 1000)).padStart(8, '0')}`,
  side, strike, delta, iv, gamma: 0.02, vega: 0.12, theta: -0.03,
  openInterest: oi, volume: 30, multiplier: 100
});
const expiries = [
  { expiry: expiryA, quotes: [q('C', 95, .75, .24), q('C', 100, .52, .21), q('C', 105, .30, .22), q('P', 95, -.25, .26), q('P', 100, -.48, .21), q('P', 105, -.70, .23)], expectedContracts: 6, loadedContracts: 6, complete: true },
  { expiry: expiryB, quotes: [q('C', 95, .78, .23), q('C', 100, .55, .20), q('C', 105, .33, .21), q('P', 95, -.22, .25), q('P', 100, -.45, .20), q('P', 105, -.67, .22)], expectedContracts: 6, loadedContracts: 6, complete: true }
];
for (const metric of ['delta','gamma','vega','theta','vanna','charm','rho']) {
  const result = surfaces.buildGreeks({ spot: 100, symbol: 'QQQ', expiries, now, metric, side: 'call', bins: [-5,0,5] });
  assert.equal(result.rows.length, 2, `${metric} returns both expiry rows`);
  assert.equal(result.metric, metric);
  assert.ok(result.rows.some(row => row.cells.some(cell => Number.isFinite(cell.value))), `${metric} creates at least one numeric cell`);
}
const deltaCalls = surfaces.buildGreeks({ spot: 100, symbol: 'QQQ', expiries, now, metric: 'delta', side: 'call', bins: [-5,0,5] });
const deltaPuts = surfaces.buildGreeks({ spot: 100, symbol: 'QQQ', expiries, now, metric: 'delta', side: 'put', bins: [-5,0,5] });
assert.ok(deltaCalls.rows[0].cells.some(c => c.value > 0), 'call delta is positive');
assert.ok(deltaPuts.rows[0].cells.some(c => c.value < 0), 'put delta is negative');
const ivSurface = surfaces.build({ spot: 100, symbol: 'QQQ', expiries, now, metric: 'iv', bins: [-5,0,5] });
const mesh = chart3d.makeMesh(ivSurface);
assert.equal(mesh.vertices.length, 2);
assert.equal(mesh.vertices[0].length, 3);
assert.ok(mesh.faces.length > 0, '3D mesh has faces for complete 2x3 grid');
const cam = { yaw: -.72, pitch: .62, zoom: 1 };
const p1 = chart3d.projectPoint({x:0,y:0,z:0}, cam, 800, 420);
const p2 = chart3d.projectPoint({x:1,y:0,z:0}, cam, 800, 420);
assert.notEqual(p1.x, p2.x, 'changing X changes projected point');
assert.ok(Number.isFinite(p1.y));
const empty = chart3d.makeMesh({ bins: [-5,0], rows: [{ dte: 7, cells: [{value:null},{value:null}] }, { dte: 14, cells: [{value:null},{value:null}] }] });
assert.equal(empty.faces.length, 0, 'missing cells do not create fictional faces');
console.log('Stock Options 3D Greek/Surface tests: passed');
