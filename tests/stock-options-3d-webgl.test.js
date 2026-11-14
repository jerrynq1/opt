"use strict";
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const renderer = fs.readFileSync(path.join(root, 'js/stock-options-3d.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/stock-options.css'), 'utf8');

test('pinned Three.js loads before the QuantLab 3D adapter and is cacheable by PWA', () => {
  const three = html.indexOf('https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js');
  const adapter = html.indexOf('js/stock-options-3d.js');
  assert.ok(three >= 0 && adapter > three, 'Three.js script must precede 3D adapter');
  assert.match(sw, /ict-quantlab-shell-v45/);
  assert.match(sw, /cdn\\\.jsdelivr\\\.net/);
});

test('primary renderer creates a WebGL mesh with explicit XYZ semantics', () => {
  for (const token of [
    'THREE.WebGLRenderer', 'THREE.MeshStandardMaterial', 'THREE.BufferGeometry',
    'camera3d.up.set(0, 0, 1)', 'X  STRIKE / SPOT', 'Y  EXPIRY / DTE',
    'Z  ${metricLabel.toUpperCase()}', 'THREE.CanvasTexture',
    'WEBGL · TRUE 3D MESH', 'Drag', 'pointerdown', 'pointermove', 'data-3d-action'
  ]) assert.ok(renderer.includes(token), `Missing WebGL feature: ${token}`);
});

test('3D renderer has an explicit 2D fallback label and retains missing-cell handling', () => {
  assert.match(renderer, /2D projection fallback/);
  assert.match(renderer, /v\.z === null/);
  assert.match(renderer, /Faces are not synthesized|faces|mesh\.faces/i);
  assert.match(css, /\.so-3d-stage/);
  assert.match(css, /\.so-3d-axis-footer \.axis-x/);
  assert.match(css, /\.so-3d-axis-footer \.axis-y/);
  assert.match(css, /\.so-3d-axis-footer \.axis-z/);
});


test('3D axis labels are larger and explicitly include 0DTE expiry ticks', () => {
  assert.match(renderer, /800 66px ui-monospace/);
  assert.match(renderer, /700 48px ui-monospace/);
  assert.match(renderer, /0DTE/);
  assert.match(renderer, /buildDteTicks/);
  assert.match(renderer, /mesh\.dteTicks/);
});

test('Spot is marked on the mesh with a gold ATM ridge and labeled underlying price', () => {
  assert.match(renderer, /function addSpotMarker\(\)/);
  assert.match(renderer, /THREE\.SphereGeometry/);
  assert.match(renderer, /SPOT \$\$\{fmt\(mesh\.spot, 2\)\}/);
  assert.match(renderer, /resolveSpotVertex/);
  assert.match(renderer, /spotIndex/);
});

test('fractional same-day DTE ticks stay distinguishable near expiry', () => {
  const chart3d = require('../js/stock-options-3d.js');
  assert.equal(chart3d.formatDteTick(0), '0DTE');
  assert.equal(chart3d.formatDteTick(0.002), '2.9m');
  assert.equal(chart3d.formatDteTick(0.004), '5.8m');
  assert.equal(chart3d.formatDteTick(0.25), '0.25D');
});

test('single 0DTE expiry builds a multi-slice time-decay surface instead of a one-row profile', () => {
  assert.match(renderer, /timeDecayProjection/);
  assert.match(renderer, /TIME-DECAY SURFACE/);
  assert.match(renderer, /mesh\.timeDecayProjection \? `0DTE · MODEL TIME-DECAY SURFACE/);
  assert.match(renderer, /TIME SLICES/);
  assert.match(renderer, /mesh\.dteTicks/);
  assert.match(renderer, /MODELLED TIME SLICE/);
  assert.match(renderer, /mesh\.timeDecayProjection \? 'Y  TIME REMAINING' : 'Y  EXPIRY \/ DTE'/);
});

test('single-expiry WebGL mode draws an observed 3D profile line instead of an empty-mesh warning', () => {
  assert.match(renderer, /SINGLE EXPIRY/);
  assert.match(renderer, /NO SYNTHETIC EXPIRY/);
  assert.match(renderer, /if \(mesh\.singleExpiry && !mesh\.timeDecayProjection\)/);
  assert.match(renderer, /profileLine/);
  assert.match(renderer, /if \(indices\.length >= 3\)/);
});
