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
  assert.match(sw, /ict-quantlab-shell-v36/);
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
