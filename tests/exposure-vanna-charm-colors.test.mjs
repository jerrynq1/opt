import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const js = readFileSync(new URL('../js/stock-options.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../css/stock-options.css', import.meta.url), 'utf8');
const theme = readFileSync(new URL('../css/ict-quantlab-theme.css', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

test('Vanna uses shared bilateral GEX/DEX Call-Put fields', () => {
  assert.match(js, /vanna:\{callField:'callVannaEx',putField:'putVannaEx'/);
  const config = js.match(/vanna:\{[^}]+\}/)?.[0] || '';
  assert.doesNotMatch(config, /signedField/);
});
test('Charm uses shared bilateral GEX/DEX Call-Put fields', () => {
  assert.match(js, /charm:\{callField:'callCharmEx',putField:'putCharmEx'/);
  const config = js.match(/charm:\{[^}]+\}/)?.[0] || '';
  assert.doesNotMatch(config, /signedField/);
});
test('Vanna/Charm use the exact common bilateral row component', () => {
  assert.match(js, /exposure-put-track[\s\S]+exposure-zero[\s\S]+exposure-call-track/);
  assert.match(js, /const commonLegend=.*CALL EXPOSURE.*PUT EXPOSURE.*UNDERLYING SPOT/);
  assert.match(js, /const modelDetails=modelMetric/);
  assert.match(js, /Call signed .*Put signed/);
  assert.doesNotMatch(js, /exposure-row-signed|exposure-signed-track|is-signed-exposure/);
});
test('Vanna/Charm inherit the exact GEX/DEX cyan Call and gold Put bar styles', () => {
  assert.match(theme, /\.exposure-put-track i\{[^}]*#e8bd73/);
  assert.match(theme, /\.exposure-call-track i\{[^}]*#55c9df/);
  assert.doesNotMatch(css, /exposure-signed-track|model-positive|model-negative/);
});
test('PWA cache version bumped for the shared Exposure renderer', () => {
  assert.match(sw, /CACHE_VERSION = "ict-quantlab-shell-v45"/);
});
