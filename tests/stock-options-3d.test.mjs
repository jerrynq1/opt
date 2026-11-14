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


const dteDataset = {
  spot: 100, bins: [-5, 0, 5], metric: 'iv', config: { kind: 'rate' },
  rows: [
    { expiry: '2026-02-15', dte: 14, cells: [{ value: .24 }, { value: .22 }, { value: .25 }] },
    { expiry: '2026-01-02', dte: .25, cells: [{ value: .30 }, { value: .28 }, { value: .32 }] },
    { expiry: '2026-01-08', dte: 7, cells: [{ value: .26 }, { value: .23 }, { value: .27 }] }
  ]
};
const dteMesh = chart3d.makeMesh(dteDataset);
assert.deepEqual(dteMesh.rows.map(row => row.dte), [.25, 7, 14], 'expiry rows are ordered by DTE');
assert.equal(dteMesh.minDte, 0, 'expiry axis always starts at zero');
assert.equal(dteMesh.vertices[0][0].y, (0.25 / 14) * 2 - 1, '0DTE expiry remains at its actual fractional DTE position');
assert.ok(dteMesh.dteTicks[0] === 0, 'DTE tick list includes an explicit 0DTE origin');
assert.ok(dteMesh.dteTicks.includes(14), 'DTE tick list includes the farthest expiry');
assert.equal(chart3d.formatDteTick(0), '0DTE');
assert.equal(chart3d.dteToAxis(0, 14), -1);
assert.equal(chart3d.dteToAxis(14, 14), 1);

const exactSpotRow = chart3d.resolveSpotVertex(dteMesh.vertices[0], dteMesh);
assert.equal(dteMesh.spotIndex, 1, 'zero-moneyness bucket is identified as Spot');
assert.equal(exactSpotRow.spotSource, 'observed', 'spot marker uses observed ATM cell when available');
assert.equal(exactSpotRow.strikePrice, 100, 'spot marker maps to the underlying spot price');
assert.equal(exactSpotRow.x, 0, 'spot marker is placed at zero moneyness');
const interpolatedSpotRow = chart3d.resolveSpotVertex([
  { ...dteMesh.vertices[0][0], labelX: -5, value: .30 },
  { ...dteMesh.vertices[0][1], value: null, z: null },
  { ...dteMesh.vertices[0][2], labelX: 5, value: .32, z: dteMesh.vertices[0][2].z }
], dteMesh);
assert.equal(interpolatedSpotRow?.spotSource, 'interpolated', 'Spot marker may interpolate only between valid cells on either side of ATM');
assert.equal(interpolatedSpotRow?.strikePrice, 100);
const noZeroBinMesh = chart3d.makeMesh({
  spot: 100, bins: [-5, 5], config: { kind: 'rate' },
  rows: [{ expiry: '2026-01-02', dte: .4, cells: [{ value: .30 }, { value: .34 }] }]
});
assert.equal(noZeroBinMesh.spotIndex, -1, 'a nearby bucket is not mislabeled as an observed exact ATM strike');
assert.equal(noZeroBinMesh.spotX, 0, 'Spot axis coordinate is computed between the surrounding moneyness buckets');
assert.equal(chart3d.resolveSpotVertex(noZeroBinMesh.vertices[0], noZeroBinMesh)?.spotSource, 'interpolated', 'Spot point interpolates only when valid buckets bracket zero');

console.log('Stock Options 3D Greek/Surface tests: passed');
