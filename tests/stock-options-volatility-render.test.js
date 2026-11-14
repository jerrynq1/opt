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
  assert.match(html, /so-vol-skew-call/);
  assert.match(html, /so-vol-skew-put/);
  assert.match(html, /so-vol-skew-spot/);
  assert.match(html, /25Δ P/);
  assert.match(html, /25Δ C/);
  assert.match(html, /SPOT 100/);
  assert.match(html, /Call IV/);
  assert.match(html, /Put IV/);
});

test('Volatility Skew does not invent a curve when IV observations are insufficient', () => {
  const html = render({ expiry: '2026-12-18', skewCurve: [{ strike: 100, callIV: 0.2, putIV: null }] }, 100);
  assert.match(html, /Chưa đủ IV hợp lệ theo strike/);
  assert.doesNotMatch(html, /<svg/);
});

console.log('Stock Options Volatility Skew renderer tests: passed');
