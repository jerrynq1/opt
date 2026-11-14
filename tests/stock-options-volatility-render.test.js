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
  source = source.replace(marker, '  window.__renderVolSkewChart=renderVolSkewChart;\n  window.__renderVolTermChart=renderVolTermChart;\n  return;\n  buildViews();\n  window.stockOptionsSetActive=setActive;');
  const elements = new Map();
  const document = { getElementById(id) { if (!elements.has(id)) elements.set(id, { id, innerHTML: '', textContent: '' }); return elements.get(id); } };
  const window = { BINANCE_STOCK_PROXY: 'https://proxy.test', BINANCE_STOCK_SPOT_API: 'https://proxy.test' };
  vm.runInNewContext(source, { window, document, location: { port: '8787' }, console, Intl }, { filename: 'stock-options.js' });
  return { skew: window.__renderVolSkewChart, term: window.__renderVolTermChart };
}

const renderer = loadRenderer();
const render = renderer.skew;
const renderTerm = renderer.term;

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
    atmIV: 0.205,
    cleanPut25Strike: 95, cleanPut25IV: 0.27,
    cleanCall25Strike: 105, cleanCall25IV: 0.22,
    cleanAtmIV: 0.205
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


test('Clean/Raw toggle is present and Clean mode uses filtered IV fields by default', () => {
  const row = {
    expiry: '2026-12-18', cleanIVCount: 4, rawSkewIVCount: 6,
    skewCurve: [
      { strike: 90, callIV: 0.62, putIV: 0.58, callCleanIV: null, putCleanIV: null },
      { strike: 95, callIV: 0.31, putIV: 0.33, callCleanIV: 0.30, putCleanIV: 0.32 },
      { strike: 100, callIV: 0.20, putIV: 0.21, callCleanIV: 0.20, putCleanIV: 0.21 },
      { strike: 105, callIV: 0.27, putIV: 0.29, callCleanIV: 0.26, putCleanIV: 0.28 },
      { strike: 110, callIV: 0.65, putIV: 0.61, callCleanIV: null, putCleanIV: null }
    ]
  };
  const clean = render(row, 100, 1, 'clean');
  const raw = render(row, 100, 1, 'raw');
  assert.match(clean, /data-skew-mode="clean"/);
  assert.match(clean, /data-skew-mode="raw"/);
  assert.match(clean, /data-mode="clean"/);
  assert.match(clean, /4\/6 IV points/);
  assert.match(clean, /LOESS/);
  assert.match(raw, /data-mode="raw"/);
  assert.match(raw, /no filtering/);
  assert.doesNotMatch(raw, /LOESS/);
});


test('Clean and Raw modes share the same Y-axis range for honest visual comparison', () => {
  const row = {
    expiry: '2026-12-18', cleanIVCount: 4, rawSkewIVCount: 6,
    skewCurve: [
      { strike: 90, callIV: 0.62, putIV: 0.58, callCleanIV: null, putCleanIV: null },
      { strike: 95, callIV: 0.31, putIV: 0.33, callCleanIV: 0.30, putCleanIV: 0.32 },
      { strike: 100, callIV: 0.20, putIV: 0.21, callCleanIV: 0.20, putCleanIV: 0.21 },
      { strike: 105, callIV: 0.27, putIV: 0.29, callCleanIV: 0.26, putCleanIV: 0.28 },
      { strike: 110, callIV: 0.65, putIV: 0.61, callCleanIV: null, putCleanIV: null }
    ]
  };
  const clean = render(row, 100, 1, 'clean');
  const raw = render(row, 100, 1, 'raw');
  const yTicks = html => [...html.matchAll(/<text x="[0-9.]+" y="[0-9.]+" text-anchor="end" class="so-vol-axis">([^<]+)<\/text>/g)].map(x => x[1]);
  assert.deepEqual(yTicks(clean), yTicks(raw));
});

console.log('Stock Options Volatility Skew renderer tests: passed');


test('IV Term Structure excludes single-sided ATM estimates', () => {
  const html = renderTerm([
    { expiry:'2026-11-20', dte:6, atmIV:0.21, atmSideCount:2 },
    { expiry:'2026-11-27', dte:13, atmIV:0.24, atmSideCount:1 },
    { expiry:'2026-12-04', dte:20, atmIV:0.26, atmSideCount:2 }
  ]);
  assert.match(html,/Two-sided ATM IV · 2 loaded expiries/);
  assert.match(html,/2026-11-20/);
  assert.match(html,/2026-12-04/);
  assert.doesNotMatch(html,/2026-11-27/);
});
