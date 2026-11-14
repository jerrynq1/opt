'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'stock-options.css'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, '..', 'js', 'stock-options.js'), 'utf8');

const requiredVolatilityClasses = [
  'so-vol-card', 'so-vol-head', 'so-vol-eyebrow', 'so-vol-status', 'so-vol-kpis',
  'so-vol-grid', 'so-vol-panel', 'so-vol-panel-title', 'so-vol-wing-grid',
  'so-vol-skew-lines', 'so-vol-move', 'so-vol-range', 'so-vol-footnote',
  'so-vol-skew-wrap', 'so-vol-skew-chart', 'so-vol-empty', 'so-vol-surface-wrap',
  'so-vol-table', 'so-vol-term-wrap', 'so-vol-term-chart', 'so-vol-cm-wrap',
  'so-vol-cm-grid', 'so-vol-cm-item', 'so-vol-disclaimer', 'so-vol-axis',
  'so-vol-gridline', 'so-vol-line', 'so-vol-point', 'so-vol-chart-legend',
  'so-vol-heat', 'so-vol-skew-modes', 'so-vol-clean-note', 'so-vol-skew-tools',
  'so-vol-gridline-x', 'so-vol-skew-call', 'so-vol-skew-put', 'so-vol-skew-spot',
  'so-vol-skew-spot-label', 'so-vol-skew-marker', 'so-vol-skew-marker-put',
  'so-vol-skew-marker-atm', 'so-vol-skew-marker-call', 'so-vol-skew-marker-label',
  'so-vol-skew-legend', 'so-vol-legend-call', 'so-vol-legend-put',
  'so-vol-legend-spot', 'so-vol-clean-empty'
];

function hasSelector(className) {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('(?<![\\w-])\\.' + escaped + '(?![\\w-])').test(css);
}

test('B. Volatility: every rendered IV/Skew/Term/CM class has a stylesheet rule', () => {
  const missing = requiredVolatilityClasses.filter(className => !hasSelector(className));
  assert.deepEqual(missing, [], `Missing CSS selectors: ${missing.join(', ')}`);
});

test('B. Volatility: Constant Maturity cards have responsive layout rules', () => {
  assert.match(css, /\.so-vol-cm-grid\s*\{[^}]*grid-template-columns\s*:\s*repeat\(4/);
  assert.match(css, /@media\s*\(max-width\s*:\s*900px\)[\s\S]*?\.so-vol-cm-grid\s*\{[^}]*repeat\(2/);
  assert.match(css, /\.so-vol-cm-item\.is-unavailable/);
});

test('B. Volatility: original panel, skew chart and responsive rules are present', () => {
  assert.match(css, /\.so-vol-card\s*\{/);
  assert.match(css, /\.so-vol-skew-chart\s+svg\s*\{/);
  assert.match(css, /\.so-vol-skew-call\s*\{/);
  assert.match(css, /@media\s*\(max-width\s*:\s*520px\)/);
  assert.match(js, /class="card so-vol-card"/);
  assert.match(js, /class="so-vol-cm-item/);
});
