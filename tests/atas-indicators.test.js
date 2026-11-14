'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

function loadPorts() {
  const context = vm.createContext({
    window: {}, console, Math, Date, Number, Array, Object, Set, Map, JSON
  });
  for (const file of ['js/indicators-defs.js', 'js/indicators-custom.js', 'js/pine-indicators-defs.js', 'indicators/atas-catalog.js', 'indicators/atas-technical.js']) {
    vm.runInContext(read(file), context, { filename: file });
  }
  return context;
}

test('all ATAS DisplayName indicators are present in the searchable catalogue', () => {
  const catalog = JSON.parse(read('indicators/atas-catalog.json'));
  assert.equal(catalog.indicatorCount, 254);
  assert.equal(catalog.items.length, 254);
  assert.equal(new Set(catalog.items.map(x => x.sourceClass)).size, 254);
  assert.ok(catalog.items.every(x => x.name && x.sourceClass && x.sourceFile && x.status && x.detail));
  assert.equal(catalog.items.filter(x => x.addKey).length, 188);
  assert.equal(catalog.items.filter(x => !x.addKey).length, 66);
  assert.ok(catalog.items.every(x => x.status !== 'pending'));
});

test('all mapped ATAS entries resolve to an actual QuantLab indicator definition', () => {
  const context = loadPorts();
  const result = vm.runInContext(`({
    keys: Object.keys(IND),
    registered: window.ATASIndicatorPorts.registeredKeys,
    missing: window.ATAS_INDICATOR_CATALOG.filter(x => x.addKey && !IND[x.addKey]).map(x => x.sourceClass)
  })`, context);
  assert.equal(result.registered.length, 150);
  assert.deepEqual(Array.from(result.missing), []);
});

test('all 150 JavaScript indicator definitions return valid series for deterministic OHLCV input', () => {
  const context = loadPorts();
  const result = vm.runInContext(`(() => {
    const keys = window.ATASIndicatorPorts.registeredKeys;
    const n = 260, o = [], h = [], l = [], c = [], v = [], t = [], s = [];
    for (let i = 0; i < n; i++) {
      const base = 100 + i * .13 + Math.sin(i / 5) * 2;
      o.push(base - .25);
      c.push(base + Math.sin(i / 3) * .4);
      h.push(Math.max(o[i], c[i]) + .7);
      l.push(Math.min(o[i], c[i]) - .6);
      v.push(400 + (i % 17) * 19);
      t.push(1700000000 + i * 60);
      s.push(1700000000 + i * 60);
    }
    const A = { o, h, l, c, v, t, s };
    const E = { up: '#26a987', dn: '#e56b75' };
    const failures = [];
    for (const key of keys) {
      const d = IND[key];
      const p = Object.fromEntries((d.p || []).map(x => [x[0], x[2]]));
      try {
        const out = d.f(A, p, E, { key, p, c: d.c });
        if (!Array.isArray(out)) throw new Error('return must be a series array');
        for (const series of out) {
          if (!series || !Array.isArray(series.d) || (!series.sp && series.d.length !== n)) throw new Error('series shape/length invalid');
          if (series.d.some(v => typeof v === 'number' && !Number.isFinite(v))) throw new Error('non-finite series value');
        }
      } catch (e) { failures.push(key + ': ' + e.message); }
    }
    return { tested: keys.length, failures };
  })()`, context);
  assert.equal(result.tested, 150);
  assert.deepEqual(Array.from(result.failures), []);
});

test('indicator search/list UI and browser load order are wired before the engine', () => {
  const html = read('index.html');
  const engine = read('js/indicators-engine.js');
  const sw = read('sw.js');
  assert.match(html, /id="indSearch"/);
  assert.match(html, /class="ind-list" id="indGrid"/);
  assert.ok(html.indexOf('indicators/atas-catalog.js') < html.indexOf('indicators/atas-technical.js'));
  assert.ok(html.indexOf('indicators/atas-technical.js') < html.indexOf('js/indicators-engine.js'));
  assert.match(engine, /new Set\(\["of","mm","ov","osc"\]\)/);
  assert.match(engine, /t\.id==="indSearch"/);
  assert.match(sw, /ict-quantlab-shell-v45/);
  assert.match(sw, /\.\/indicators\/atas-catalog\.js/);
  assert.match(sw, /\.\/indicators\/atas-technical\.js/);
  assert.ok(sw.includes('img|indicators'));
});
