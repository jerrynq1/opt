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


// A single selected expiry (including 0DTE) is a valid 3D strike profile.
// It must render as a curve at the real DTE rather than requiring a second expiry.
const singleExpiryDataset = {
  spot: 100, bins: Array.from({ length: 17 }, (_, i) => -20 + i * 2.5),
  metric: 'gex', config: { kind: 'signed', label: 'GEX' },
  rows: [{ expiry: '2026-01-02', dte: 0, complete: true,
    cells: Array.from({ length: 17 }, (_, i) => ({ value: (i - 8) * (i - 8) - 24, coverage: 1, usableCount: 12, contractCount: 12 })) }]
};
const singleMesh = chart3d.makeMesh(singleExpiryDataset);
assert.equal(singleMesh.rows.length, 1, 'selected 0DTE contains one real expiry');
assert.equal(singleMesh.singleExpiry, true, 'renderer identifies a single expiry');
assert.equal(singleMesh.renderMode, 'single-expiry-profile', 'one expiry is rendered as a profile, not a fake area mesh');
assert.equal(singleMesh.faces.length, 0, 'no synthetic faces are created for a single expiry');
assert.equal(singleMesh.renderable, true, 'a valid single-expiry strike profile remains renderable');
assert.equal(singleMesh.validPointCount, 17, 'all valid moneyness buckets are retained');
assert.equal(singleMesh.profileSegmentCount, 16, 'adjacent strike buckets form a 3D profile line');
assert.equal(singleMesh.axisMaxDte, 1, 'single 0DTE uses a readable 0..1D display span');
assert.equal(singleMesh.vertices[0][0].y, -1, 'exact 0DTE profile lies at the expiry axis origin');
assert.equal(chart3d.resolveSpotVertex(singleMesh.vertices[0], singleMesh)?.spotSource, 'observed', 'Spot marker is resolvable on the single-expiry profile');

const fractional0dteMesh = chart3d.makeMesh({
  spot: 100, bins: [-5, 0, 5], metric: 'iv', config: { kind: 'rate' },
  rows: [{ expiry: '2026-01-02', dte: 0.25, cells: [{ value: 0.25 }, { value: 0.24 }, { value: 0.26 }] }]
});
assert.equal(fractional0dteMesh.axisMaxDte, 1, 'fractional 0DTE gets a 0..1D axis span');
assert.equal(fractional0dteMesh.vertices[0][0].y, -0.5, '0.25D remains at its exact position on the 0..1D axis');
assert.deepEqual(fractional0dteMesh.dteTicks, [0, 0.25, 1], 'single-expiry Y ticks label 0DTE, actual DTE and 1D boundary');

const singleSparseMesh = chart3d.makeMesh({
  spot: 100, bins: [-10, -5, 0, 5, 10], metric: 'iv', config: { kind: 'rate' },
  rows: [{ expiry: '2026-01-02', dte: 0.25, cells: [
    { value: 0.25 }, { value: 0.24 }, { value: null }, { value: 0.26 }, { value: 0.27 }
  ] }]
});
assert.equal(singleSparseMesh.renderable, true, 'single expiry can render separate valid segments without joining across missing buckets');
assert.equal(singleSparseMesh.profileSegmentCount, 2, 'profile lines do not bridge a missing moneyness bucket');
assert.equal(singleSparseMesh.vertices[0][2].z, null, 'missing strike remains a gap');

const singleEmptyMesh = chart3d.makeMesh({
  spot: 100, bins: [-5, 0, 5], metric: 'iv', config: { kind: 'rate' },
  rows: [{ expiry: '2026-01-02', dte: 0, cells: [{ value: null }, { value: null }, { value: null }] }]
});
assert.equal(singleEmptyMesh.renderable, false, 'one expiry with no valid values still shows empty state');
