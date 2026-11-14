"use strict";
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadRenderer() {
  let source = fs.readFileSync(path.join(__dirname, '..', 'js', 'stock-options.js'), 'utf8');
  const marker = '  buildViews();\n  window.stockOptionsSetActive=setActive;';
  assert.ok(source.includes(marker), 'stock options test hook marker exists');
  source = source.replace(marker, '  window.__renderVolSkewChart=renderVolSkewChart;\n  return;\n  buildViews();\n  window.stockOptionsSetActive=setActive;');
  const elements = new Map();
  const document = { getElementById(id) { if (!elements.has(id)) elements.set(id, { id, innerHTML: '', textContent: '' }); return elements.get(id); } };
  const window = { BINANCE_STOCK_PROXY: 'https://proxy.test', BINANCE_STOCK_SPOT_API: 'https://proxy.test' };
  vm.runInNewContext(source, { window, document, location: { port: '8787' }, console, Intl }, { filename: 'stock-options.js' });
  return window.__renderVolSkewChart;
}

const render = loadRenderer();

test('Volatility Skew renders Call and Put IV curves with Spot and 25-delta markers', () => {
  const html = render({
    expiry: '2026-12-18',
    skewCurve: [
      { strike: 90, callIV: null, putIV: 0.31 },
      { strike: 95, callIV: 0.24, putIV: 0.27 },
      { strike: 100, callIV: 0.20, putIV: 0.21 },
      { strike: 105, callIV: 0.22, putIV: null },
      { strike: 110, callIV: 0.26, putIV: null }
    ],
    put25Strike: 95, put25IV: 0.27,
    call25Strike: 105, call25IV: 0.22,
    atmIV: 0.205
  }, 100);
  assert.match(html, /<svg/);
  assert.match(html, /<path d="M .*so-vol-skew-call/);
  assert.match(html, /<path d="M .*so-vol-skew-put/);
  assert.doesNotMatch(html, /so-vol-skew-call-dot|so-vol-skew-put-dot/);
  assert.match(html, /data-skew-zoom="in"/);
  assert.match(html, /data-skew-zoom="out"/);
  assert.match(html, /data-skew-zoom="reset"/);
  assert.match(html, /so-vol-skew-spot/);
  assert.match(html, /25Δ P/);
  assert.match(html, /25Δ C/);
  assert.match(html, /SPOT 100/);
  assert.match(html, /Call IV/);
  assert.match(html, /Put IV/);
});


test('Volatility Skew X-axis zoom narrows the strike range while keeping Spot centered', () => {
  const row = {
    expiry: '2026-12-18',
    skewCurve: [
      { strike: 90, callIV: 0.31, putIV: 0.33 },
      { strike: 95, callIV: 0.24, putIV: 0.27 },
      { strike: 100, callIV: 0.20, putIV: 0.21 },
      { strike: 105, callIV: 0.22, putIV: 0.23 },
      { strike: 110, callIV: 0.26, putIV: 0.28 }
    ]
  };
  const full = render(row, 100, 1);
  const zoomed = render(row, 100, 2);
  const range = html => {
    const svg = html.match(/<svg[^>]*data-x-min="([0-9.]+)"[^>]*data-x-max="([0-9.]+)"/);
    assert.ok(svg, 'chart exposes its current strike-axis range');
    return { min: Number(svg[1]), max: Number(svg[2]) };
  };
  const fullRange = range(full), zoomRange = range(zoomed);
  assert.ok(zoomRange.max - zoomRange.min < fullRange.max - fullRange.min);
  assert.ok(zoomRange.min < 100 && zoomRange.max > 100, 'zoom remains centered around Spot');
  assert.match(zoomed, /2.0×/);
  assert.match(full, /data-skew-zoom="reset"/);
});


test('Volatility Skew breaks a line where that side has no observed IV', () => {
  const html = render({
    expiry: '2026-12-18',
    skewCurve: [
      { strike: 90, callIV: 0.30, putIV: 0.31 },
      { strike: 95, callIV: 0.28, putIV: 0.29 },
      { strike: 100, callIV: null, putIV: 0.25 },
      { strike: 105, callIV: 0.24, putIV: null },
      { strike: 110, callIV: 0.25, putIV: null },
      { strike: 115, callIV: null, putIV: 0.27 },
      { strike: 120, callIV: 0.27, putIV: 0.28 }
    ]
  }, 105);
  const callPathCount = (html.match(/<path d="M [^"]+" class="so-vol-skew-call"/g) || []).length;
  assert.equal(callPathCount, 2, 'Call line has two observed segments around the missing IV strike');
});

test('Volatility Skew does not invent a curve when IV observations are insufficient', () => {
  const html = render({ expiry: '2026-12-18', skewCurve: [{ strike: 100, callIV: 0.2, putIV: null }] }, 100);
  assert.match(html, /Chưa đủ IV hợp lệ theo strike/);
  assert.doesNotMatch(html, /<svg/);
});

console.log('Stock Options Volatility Skew renderer tests: passed');
