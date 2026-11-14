import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const css = readFileSync(new URL('../css/stock-options.css', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
test('signed exposure negative uses GEX/DEX gold palette', () => {
  assert.match(css, /\.exposure-signed-track i\.is-negative\{[^}]*#f0c978[^}]*#a87935/);
  assert.match(css, /\.exposure-signed-value\.is-negative\{color:#e8bd73\}/);
  assert.match(css, /\.so-exposure-legend i\.model-negative\{background:#e8bd73\}/);
});
test('signed exposure positive uses GEX/DEX blue palette', () => {
  assert.match(css, /\.exposure-signed-track i\.is-positive\{[^}]*#65d6e8[^}]*#2f91b0/);
  assert.match(css, /\.exposure-signed-value\.is-positive\{color:#65d6e8\}/);
  assert.match(css, /\.so-exposure-legend i\.model-positive\{background:#55c9df\}/);
});
test('zero-centered signed track keeps gold left and blue right', () => {
  assert.match(css, /background:linear-gradient\(90deg,rgba\(232,189,115,.10\) 0 50%,rgba\(85,201,223,.10\) 50% 100%\)/);
  assert.match(css, /\.exposure-signed-track i\.is-negative\{right:50%/);
  assert.match(css, /\.exposure-signed-track i\.is-positive\{left:50%/);
});
test('PWA cache version bumped', () => {
  assert.match(sw, /CACHE_VERSION = "ict-quantlab-shell-v42"/);
});
