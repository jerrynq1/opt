'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'js/stock-options.js'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/stock-options.css'), 'utf8');
const rendererSource = fs.readFileSync(path.join(root, 'js/stock-options-3d.js'), 'utf8');

test('Options page loads the 3D renderer before stock-options UI', () => {
  assert.match(html, /stock-options-surfaces\.js"><\/script><script src="https:\/\/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/build\/three\.min\.js" crossorigin="anonymous"><\/script><script src="js\/stock-options-3d\.js"><\/script><script src="js\/stock-options\.js/);
  assert.match(sw, /"\.\/js\/stock-options-3d\.js"/);
  assert.match(sw, /ict-quantlab-shell-v40/);
});

test('Greeks area is a dedicated 3D surface with model metric and side controls', () => {
  assert.match(js, /so-greeks-3d-lab/);
  assert.match(js, /greeks3d-metric/);
  for (const greek of ['delta', 'gamma', 'vega', 'theta', 'vanna', 'charm', 'rho']) {
    assert.match(js, new RegExp(`<option value="${greek}">`));
  }
  assert.match(js, /X: Strike \/ Spot · Y: Expiry · Z: Greek/);
});

test('Option IV/Exposure/Volume/OI surfaces render through the 3D chart module', () => {
  assert.match(js, /renderer\.mount\(surfaceHost,result/);
  assert.match(js, /data-surface-tab="iv"/);
  assert.match(js, /data-surface-tab="exposure"/);
  assert.match(js, /data-surface-tab="volume"/);
  assert.match(js, /data-surface-tab="oi"/);
  assert.ok(js.includes("X = % Strike/Spot − 1, Y = ${result.projection?'remaining DTE/time-to-expiry':'DTE/expiry'}, Z = selected metric"));
  assert.match(js, /0DTE time-decay projection/);
});

test('3D chart includes canvas rotation, zoom, axis and tooltip styling', () => {
  const renderer = fs.readFileSync(path.join(root, 'js/stock-options-3d.js'), 'utf8');
  for (const token of ['projectPoint', 'pointerdown', 'pointermove', 'wheel', 'data-3d-action', 'EXPIRY / DTE', 'mesh.faces', 'zTicks', 'strikePrice', 'THREE.WebGLRenderer', 'MeshStandardMaterial', 'camera3d.up.set(0, 0, 1)', 'CanvasTexture', 'WEBGL · TRUE 3D MESH', 'SINGLE EXPIRY', 'mesh.renderable']) assert.ok(renderer.includes(token), `Missing renderer feature ${token}`);
  for (const selector of ['so-3d-host', 'so-3d-stage', 'so-3d-canvas', 'so-3d-tooltip', 'so-3d-actions', 'so-3d-axis-footer']) assert.match(css, new RegExp(`\\.${selector}\\b`));
});

test('single 0DTE expiry renders a 3D strike profile without synthetic expiry rows', () => {
  assert.match(rendererSource, /single-expiry-profile/);
  assert.match(rendererSource, /NO SYNTHETIC EXPIRY/);
  assert.match(rendererSource, /mesh\.singleExpiry/);
  assert.match(rendererSource, /mesh\.renderable/);
  assert.doesNotMatch(rendererSource, /Cần ít nhất 2 expiry và 2 vùng moneyness/);
});
