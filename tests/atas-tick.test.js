'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

function makeContext() {
  const context = vm.createContext({ window: {}, console, Math, Date, Number, Array, Object, Set, Map, JSON });
  for (const file of ['js/indicators-defs.js', 'js/indicators-custom.js', 'js/pine-indicators-defs.js']) {
    vm.runInContext(read(file), context, { filename: file });
  }
  const html = read('index.html');
  const indicatorScripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]).filter(file => file.startsWith('indicators/'));
  for (const file of indicatorScripts) vm.runInContext(read(file), context, { filename: file });
  return context;
}

function makeBars(n = 8) {
  const o = [], h = [], l = [], c = [], v = [], t = [], s = [];
  const start = 1700000040; // minute-aligned UTC/server timestamp used by the footprint map
  for (let i = 0; i < n; i++) {
    const base = 2000 + i * .01;
    o.push(base - .02); c.push(base + (i % 2 ? -.01 : .02));
    h.push(base + .05); l.push(base - .05); v.push(100 + i);
    t.push(start + i * 60); s.push(start + i * 60);
  }
  return { o, h, l, c, v, t, s };
}

test('ATAS quote-tick and footprint candidates are registered and explicitly labelled as proxies', () => {
  const context = makeContext();
  const result = vm.runInContext(`({
    tickCount: window.ATASQuoteTickPorts.registeredKeys.length,
    mappedTick: window.ATAS_INDICATOR_CATALOG.filter(x => x.status === 'ported_tick').length,
    keysMissing: window.ATAS_INDICATOR_CATALOG.filter(x => x.status === 'ported_tick' && !IND[x.addKey]).map(x => x.sourceClass),
    badLabel: window.ATAS_INDICATOR_CATALOG.filter(x => x.status === 'ported_tick' && (x.conversion !== 'quote_tick_proxy' || !['quote_ticks','quote_footprint'].includes(x.requirement))).map(x => x.sourceClass)
  })`, context);
  assert.equal(result.tickCount, 23);
  assert.equal(result.mappedTick, 20);
  assert.deepEqual(Array.from(result.keysMissing), []);
  assert.deepEqual(Array.from(result.badLabel), []);
});

test('quote-tick footprint data produces non-empty results for all active quote-tick adaptations', () => {
  const context = makeContext();
  const A = makeBars();
  const fpm = new Map(), bte = new Map();
  for (const sec of A.s) {
    const rows = [[2000.00, 7, 2], [2000.01, 5, 9], [1999.99, 2, 1], [2000.02, 4, 1]];
    rows.sp = .0002; rows.sn = 20;
    fpm.set(sec, rows);
    bte.set(sec, [[sec * 1000 + 10, 2000.01, 1, 5, sec * 1000 + 150], [sec * 1000 + 200, 1999.99, -1, 3, sec * 1000 + 350]]);
  }
  context.FPM = fpm; context.BTE = bte; context.C = { tf: 60, sym: 'EURUSD' }; context.CT = { sym: { digits: 5 } };
  const result = vm.runInContext(`(() => {
    const A = ${JSON.stringify(A)};
    const keys = window.ATASQuoteTickPorts.registeredKeys;
    const failures = [];
    for (const key of keys) {
      try {
        const d = IND[key], p = Object.fromEntries((d.p || []).map(x => [x[0], x[2]]));
        const out = d.f(A, p, { up: '#26a987', dn: '#e56b75' }, { key, p, c: d.c });
        if (!Array.isArray(out) || !out.length) throw new Error('missing series');
        if (out.some(s => !Array.isArray(s.d) || s.d.length !== A.c.length)) throw new Error('bad series length');
      } catch (e) { failures.push(key + ': ' + e.message); }
    }
    const cvd = IND.atas_cvd_quote_tick.f(A, {})[0].d;
    const poc = IND.atas_dynamic_levels_footprint.f(A, {valueArea:70,tickStep:0})[0].d;
    const speed = IND.atas_speed_tape_tick.f(A, {smooth:2})[0].d;
    return { failures, cvdFirst: cvd[0], pocFirst: poc[0], speedFirst: speed[0] };
  })()`, context);
  assert.deepEqual(Array.from(result.failures), []);
  assert.ok(Number.isFinite(result.cvdFirst));
  assert.ok(Number.isFinite(result.pocFirst));
  assert.ok(Number.isFinite(result.speedFirst));
});

test('tick indicators never fabricate zero values when the footprint feed is absent', () => {
  const context = makeContext();
  const A = makeBars();
  const result = vm.runInContext(`(() => {
    const A = ${JSON.stringify(A)};
    const out = IND.atas_cvd_quote_tick.f(A, {});
    return out[0].d.every(v => v == null);
  })()`, context);
  assert.equal(result, true);
});

test('tick consumers activate the existing cTrader footprint loader without enabling the Footprint panel', () => {
  const context = makeContext();
  context.ACT = [{ key: 'atas_cvd_quote_tick', on: true }];
  const active = vm.runInContext('window.atasTickIndicatorActive()', context);
  assert.equal(active, true);
  const fp = read('js/orderflow-footprint.js');
  assert.match(fp, /window\.atasTickIndicatorActive&&window\.atasTickIndicatorActive\(\)/);
});


test('quote tick events are not queued until a tick/footprint consumer is active', () => {
  const source = read('js/ctrader.js');
  assert.match(source, /function ctFpDemandActive\(\)/);
  assert.match(source, /if\(!ctFpDemandActive\(\)\)return/);
  assert.match(source, /window\.atasTickIndicatorActive&&window\.atasTickIndicatorActive\(\)/);
});

test('new footprint adaptations consume quote-tick profiles instead of legacy aliases or depth-only placeholders', () => {
  const context = makeContext();
  const A = makeBars();
  const fpm = new Map(), bte = new Map();
  for (let i = 0; i < A.s.length; i++) {
    const sec = A.s[i];
    const k = i + 1;
    const rows = [
      [1999.99, k, k], [2000.00, k, 8*k], [2000.01, 12*k, k],
      [2000.02, 12*k, k], [2000.03, 12*k, k], [2000.04, 2*k, k]
    ];
    rows.sp = .0002; rows.sn = 40*k;
    fpm.set(sec, rows);
    bte.set(sec, [[sec*1000+10,2000.02,1,4*k,sec*1000+150]]);
  }
  context.FPM = fpm; context.BTE = bte; context.C = { tf: 60, sym: 'TEST' }; context.CT = { sym: { digits: 2 } };
  const result = vm.runInContext(`(() => {
    const A=${JSON.stringify(A)};
    const run=(key, overrides={})=>{const d=IND[key],p=Object.fromEntries((d.p||[]).map(x=>[x[0],x[2]]));Object.assign(p,overrides);return d.f(A,p,{up:'#26a987',dn:'#e56b75'},{key,p,c:d.c});};
    const volume=run('atas_bar_volume_filter_tick',{type:'ticks',minimum:1});
    const patterns=run('atas_bars_pattern_quote_fp',{minTrades:1,minBid:1,minAsk:1});
    const stacked=run('atas_stacked_imbalance_quote_fp',{ratio:100,minEvents:2,stack:3,tickStep:.01});
    const cluster=run('atas_cluster_search_quote_fp',{metric:'total',minEvents:2,minPercent:0,barRange:1,tickStep:.01});
    const ratio=run('atas_ratio_quote_fp',{tickStep:.01,minBaseEvents:1});
    const vhf=run('atas_vhf',{source:'ticks_quote',period:3});
    return {
      volumeMarks:volume[0].mk.length, patternMarks:patterns[0].mk.length,
      stackedAsk:stacked[0].d.some(Number.isFinite), clusterLine:cluster[0].d.some(Number.isFinite),
      ratioMarks:ratio[0].mk.length, vhfValues:vhf[0].d.filter(Number.isFinite).length
    };
  })()`, context);
  assert.ok(result.volumeMarks > 0);
  assert.ok(result.patternMarks > 0);
  assert.equal(result.stackedAsk, true);
  assert.equal(result.clusterLine, true);
  assert.ok(result.ratioMarks > 0);
  assert.ok(result.vhfValues > 0);
});

test('quote data is requested only when optional tick modes/filters are enabled', () => {
  const context = makeContext();
  const states = vm.runInContext(`(() => {
    const check=a=>{ACT=[a];return window.atasTickIndicatorActive();};
    return {
      volumeOnly:check({key:'atas_bar_volume_filter_tick',on:true,p:{type:'volume'}}),
      volumeTicks:check({key:'atas_bar_volume_filter_tick',on:true,p:{type:'ticks'}}),
      barsPatternDefault:check({key:'atas_bars_pattern_quote_fp',on:true,p:{minTrades:0,maxTrades:0,minBid:0,maxBid:0,minAsk:0,maxAsk:0,minDelta:0,maxDelta:0,maxVolLocation:'any'}}),
      barsPatternTickFilter:check({key:'atas_bars_pattern_quote_fp',on:true,p:{minTrades:2,maxTrades:0,minBid:0,maxBid:0,minAsk:0,maxAsk:0,minDelta:0,maxDelta:0,maxVolLocation:'any'}}),
      vhfVolume:check({key:'atas_vhf',on:true,p:{source:'volume'}}),
      vhfTicks:check({key:'atas_vhf',on:true,p:{source:'ticks_quote'}})
    };
  })()`, context);
  assert.deepEqual(JSON.parse(JSON.stringify(states)), { volumeOnly:false, volumeTicks:true, barsPatternDefault:false, barsPatternTickFilter:true, vhfVolume:false, vhfTicks:true });
});
