'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadMath(){
  const window = {};
  const document = { getElementById: () => null };
  const localStorage = { getItem: () => null, setItem: () => {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'cross-asset-map.js'), 'utf8'),
    { window, document, localStorage, Number, Math, Date, Intl, String, Object },
    { filename: 'cross-asset-map.js' });
  return window.crossAssetMapMath;
}
const math = loadMath();

test('QQQ strike converts to NAS100 with current relative-price anchor', () => {
  assert.equal(math.mapStrike(630, 600, 25000), 26250);
});

test('GLD strike converts to XAUUSD without hardcoding the ETF/ounce ratio', () => {
  assert.equal(math.mapStrike(420, 400, 4000), 4200);
});

test('underlying ATM strike maps exactly to the target chart price', () => {
  assert.equal(math.mapStrike(400, 400, 4072.35), 4072.35);
});

test('mapping preserves percentage distance from source underlying', () => {
  const mapped = math.mapStrike(615, 600, 25200);
  assert.ok(Math.abs((mapped / 25200 - 1) - (615 / 600 - 1)) < 1e-12);
});

test('invalid or unavailable price anchors do not create synthetic levels', () => {
  assert.equal(math.mapStrike(630, null, 25000), null);
  assert.equal(math.mapStrike(630, 600, 0), null);
  assert.equal(math.mapStrike(-1, 600, 25000), null);
});


test('GEX ranking returns the strongest absolute net exposure first', () => {
  const rows = [
    { strike: 90, gex: -10 },
    { strike: 100, gex: 80 },
    { strike: 110, gex: -40 }
  ];
  assert.deepEqual(math.rankGexLevels(rows, 2).map(x => x.strike), [100, 110]);
});
