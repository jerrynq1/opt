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
  for (const file of ['js/indicators-defs.js', 'js/indicators-custom.js', 'js/pine-indicators-defs.js']) {
    vm.runInContext(read(file), context, { filename: file });
  }
  const html = read('index.html');
  const indicatorScripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]).filter(file => file.startsWith('indicators/'));
  for (const file of indicatorScripts) vm.runInContext(read(file), context, { filename: file });
  return context;
}

test('all retained compatible ATAS indicators are catalogued and all unsupported source classes are documented', () => {
  const catalog = JSON.parse(read('indicators/atas-catalog.json'));
  assert.equal(catalog.indicatorCount, 217);
  assert.equal(catalog.items.length, 217);
  assert.equal(new Set(catalog.items.map(x => x.sourceClass)).size, 217);
  const removedClasses = [...read('indicators/REMOVED_INDICATORS_VI.md').matchAll(/^- `[^`]+` \(`([^`]+)`\):/gm)].map(match => match[1]);
  assert.equal(removedClasses.length, 37);
  assert.equal(new Set(removedClasses).size, 37);
  assert.equal(new Set([...catalog.items.map(x => x.sourceClass), ...removedClasses]).size, 254);
  assert.ok(['MultiMarketPower','VolumePerTrade'].every(x => removedClasses.includes(x)));
  assert.ok(catalog.items.every(x => x.name && x.sourceClass && x.sourceFile && x.status && x.detail));
  assert.equal(catalog.items.filter(x => x.addKey).length, 217);
  assert.equal(catalog.items.filter(x => !x.addKey).length, 0);
  assert.ok(catalog.items.every(x => x.status !== 'pending'));
  assert.ok(catalog.items.every(x => x.requirement !== 'pending'));
  assert.equal(catalog.items.find(x => x.sourceClass === 'CMO').addKey, 'atas_chaikin_cmo');
  assert.equal(catalog.items.find(x => x.sourceClass === 'DMI').addKey, 'atas_dynamic_momentum');
  assert.equal(catalog.items.find(x => x.sourceClass === 'VWAP').conversion, 'approx_proxy');
  for (const sourceClass of ['CAV','FCV','VsaWsd','VsaBetterVolume','WeissWave']) assert.equal(catalog.items.find(x => x.sourceClass === sourceClass).requirement, 'ohlcv');
  assert.equal(catalog.items.find(x => x.sourceClass === 'VolumePerTrade'), undefined);
  for (const sourceClass of ['ADX','ATR','BollingerBands','CCI','Donchian','EMA','MACD','RSI','SMA','Stochastic','SuperTrend']) {
    assert.equal(catalog.items.find(x => x.sourceClass === sourceClass).conversion, 'approx_proxy');
  }
  assert.equal(catalog.items.filter(x => x.conversion === 'direct').length, 95);
  assert.equal(catalog.items.filter(x => x.conversion === 'approx_proxy').length, 100);
  assert.equal(catalog.items.filter(x => x.conversion === 'quote_tick_proxy').length, 21);
  assert.equal(catalog.items.filter(x => x.status === 'ported_tick').length, 20);
  for (const sourceClass of ['MultiMarketPower','HerrickPayoff','OIAnalyzer','BalanceOI','OpenInterest','VolumePerTrade','DomStrength','MainIndicator']) {
    assert.equal(catalog.items.find(x => x.sourceClass === sourceClass), undefined, `${sourceClass} must be removed when unsupported by current app resources`);
  }
  for (const sourceClass of ['DomPower','OrderBookAlerts']) {
    const item = catalog.items.find(x => x.sourceClass === sourceClass);
    assert.equal(item.status, 'ported');
    assert.equal(item.requirement, 'depth');
    assert.ok(item.addKey);
    assert.ok(item.detail.includes('Level II'));
  }
  const clusterStatistic = catalog.items.find(x => x.sourceClass === 'ClusterStatistic');
  assert.equal(clusterStatistic.status, 'existing');
  assert.equal(clusterStatistic.requirement, 'quote_footprint');
  assert.equal(clusterStatistic.conversion, 'quote_tick_proxy');
  assert.equal(catalog.items.filter(x => x.requirement === 'depth').length, 3);
});

test('all mapped ATAS entries resolve to an actual QuantLab indicator definition', () => {
  const context = loadPorts();
  const result = vm.runInContext(`({
    keys: Object.keys(IND),
    registered: window.ATASIndicatorPorts.registeredKeys,
    missing: window.ATAS_INDICATOR_CATALOG.filter(x => x.addKey && !IND[x.addKey]).map(x => x.sourceClass)
  })`, context);
  assert.equal(result.registered.length, 222);
  assert.deepEqual(Array.from(result.missing), []);
});

test('all ATAS JavaScript indicator definitions return valid series for deterministic OHLCV input', () => {
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
  assert.equal(result.tested, 222);
  assert.deepEqual(Array.from(result.failures), []);
});

test('Chaikin CMO and ATAS Dynamic Momentum Index use dedicated formulas instead of similarly named indicators', () => {
  const context = loadPorts();
  const result = vm.runInContext(`(() => {
    const n = 40, o = [], h = [], l = [], c = [], v = [], t = [], s = [];
    for (let i = 0; i < n; i++) {
      const close = 100 + i * .03 + Math.sin(i / 1.7) * 2 + Math.sin(i / 5) * .5;
      o.push(close - .2); c.push(close); h.push(close + .5); l.push(close - .6);
      v.push(100 + i * 3); t.push(1700000000 + i * 3600); s.push(1700000000 + i * 3600);
    }
    const A = { o, h, l, c, v, t, s };
    const cmo = IND.atas_chaikin_cmo.f(A, { long: 10, short: 3 })[0].d;
    const dmi = IND.atas_dynamic_momentum.f(A, { rsiPeriod: 14, rsiMin: 3, rsiMax: 30, stdPeriod: 5, smaPeriod: 10 })[0].d;
    const wrongCmo = IND.atas_cmo.f(A, { period: 14 })[0].d;
    const wrongDmi = IND.atas_dmi.f(A, { period: 14 })[2].d;
    return {
      cmoFinite: cmo.some(v => Number.isFinite(v) && Math.abs(v) > 1e-9), dmiFinite: dmi.some(v => Number.isFinite(v) && Math.abs(v) > 1e-9),
      cmoDifferent: cmo.some((v, i) => Number.isFinite(v) && Number.isFinite(wrongCmo[i]) && Math.abs(v - wrongCmo[i]) > 1e-9),
      dmiDifferent: dmi.some((v, i) => Number.isFinite(v) && Number.isFinite(wrongDmi[i]) && Math.abs(v - wrongDmi[i]) > 1e-9),
      dmiBounds: dmi.every(v => v == null || (v >= 0 && v <= 100))
    };
  })()`, context);
  assert.equal(result.cmoFinite, true);
  assert.equal(result.dmiFinite, true);
  assert.equal(result.cmoDifferent, true);
  assert.equal(result.dmiDifferent, true);
  assert.equal(result.dmiBounds, true);
});

test('indicator search/list UI and browser load order are wired before the engine', () => {
  const html = read('index.html');
  const engine = read('js/indicators-engine.js');
  const sw = read('sw.js');
  assert.match(html, /id="indSearch"/);
  assert.match(html, /class="ind-list" id="indGrid"/);
  assert.ok(html.indexOf('indicators/atas-catalog.js') < html.indexOf('indicators/atas-technical-runtime.js'));
  assert.ok(html.indexOf('indicators/atas-technical-runtime.js') < html.indexOf('indicators/atas-tick-runtime.js'));
  assert.ok(html.indexOf('indicators/atas-tick-runtime.js') < html.indexOf('indicators/individual/acbw.js'));
  assert.ok(html.indexOf('indicators/atas-registry-finalize.js') < html.indexOf('js/indicators-engine.js'));
  assert.equal([...html.matchAll(/<script src="indicators\/individual\/[^"]+\.js"/g)].length, 224);
  assert.match(engine, /new Set\(\["of","mm","ov","osc"\]\)/);
  assert.match(engine, /t\.id==="indSearch"/);
  assert.match(sw, /ict-quantlab-shell-v62/);
  assert.match(sw, /\.\/indicators\/atas-catalog\.js/);
  assert.match(sw, /\.\/indicators\/atas-technical-runtime\.js/);
  assert.match(sw, /\.\/indicators\/atas-tick-runtime\.js/);
  assert.match(sw, /\.\/indicators\/individual\/dailychange\.js/);
  assert.match(sw, /\.\/indicators\/individual\/orderbookalerts\.js/);
  assert.doesNotMatch(sw, /multimarketpower\.js|volumepertrade\.js/);
  assert.ok(sw.includes('img|indicators'));
});

test('ATAS ACBW, ACDC and AMA are no longer mapped to generic or mismatched formulas', () => {
  const context = loadPorts();
  const result = vm.runInContext(`(() => {
    const n = 180, o = [], h = [], l = [], c = [], v = [], t = [], s = [];
    for (let i = 0; i < n; i++) {
      const close = 100 + i * .11 + Math.sin(i / 4) * 2 + Math.cos(i / 11) * .7;
      o.push(close - .3); c.push(close); h.push(close + .8 + Math.sin(i / 3) * .05);
      l.push(close - .7 - Math.cos(i / 7) * .04); v.push(100 + i * 2);
      t.push(1700000000 + i * 60); s.push(1700000000 + i * 60);
    }
    const A = { o, h, l, c, v, t, s };
    const acbw = IND.atas_acbw.f(A, { long: 51, short: 50, signal: 50 })[0].d;
    const acdc = IND.atas_acdc.f(A, { sma1: 34, sma2: 5, sma3: 10, sma4: 5 })[0].d;
    const ama = IND.atas_ama.f(A, { period: 15, fast: 3, slow: 20 })[0].d;
    const genericAc = IND.atas_ac.f(A)[0].d;
    const genericAma = IND.atas_kama.f(A, { period: 14 })[0].d;
    const finite = a => a.filter(Number.isFinite).length;
    return {
      acbwFinite: finite(acbw), acdcFinite: finite(acdc), amaFinite: finite(ama),
      acbwDistinct: acbw.some((v, i) => Number.isFinite(v) && Number.isFinite(genericAc[i]) && Math.abs(v - genericAc[i]) > 1e-8),
      acdcDistinct: acdc.some((v, i) => Number.isFinite(v) && Number.isFinite(genericAc[i]) && Math.abs(v - genericAc[i]) > 1e-8),
      amaDistinctSeed: ama.some((v, i) => Number.isFinite(v) && Number.isFinite(genericAma[i]) && Math.abs(v - genericAma[i]) > 1e-8)
    };
  })()`, context);
  assert.ok(result.acbwFinite > 50);
  assert.ok(result.acdcFinite > 50);
  assert.ok(result.amaFinite > 100);
  assert.equal(result.acbwDistinct, true);
  assert.equal(result.acdcDistinct, true);
  assert.equal(result.amaDistinctSeed, true);
  const catalog = JSON.parse(read('indicators/atas-catalog.json'));
  assert.equal(catalog.items.find(x => x.sourceClass === 'ACBW').addKey, 'atas_acbw');
  assert.equal(catalog.items.find(x => x.sourceClass === 'ACDC').addKey, 'atas_acdc');
  assert.equal(catalog.items.find(x => x.sourceClass === 'AMA').addKey, 'atas_ama');
  assert.equal(catalog.items.find(x => x.sourceClass === 'ACBW').conversion, 'direct');
  assert.equal(catalog.items.find(x => x.sourceClass === 'ACDC').conversion, 'direct');
});


test('ACBW, ACDC and AMA port outputs match independent source-formula fixtures', () => {
  const context = loadPorts();
  const result = vm.runInContext(`(() => {
    const n = 190, c = [], h = [], l = [], o = [], v = [], t = [], s = [];
    for (let i = 0; i < n; i++) {
      const close = 95 + i * .17 + Math.sin(i / 3.1) * 1.4 + Math.cos(i / 9) * .8;
      c.push(close); o.push(close - .2); h.push(close + .65 + Math.sin(i/4)*.03); l.push(close - .55 - Math.cos(i/6)*.03);
      v.push(100+i); t.push(1700000000+i*60); s.push(1700000000+i*60);
    }
    const A={o,h,l,c,v,t,s};
    const smaRef=(a,p)=>a.map((_,i)=>i+1<p?null:a.slice(i-p+1,i+1).reduce((x,y)=>x+y,0)/p);
    const closeShort=smaRef(c,50), closeLong=smaRef(c,51);
    const bwDiff=closeShort.map((x,i)=>x==null||closeLong[i]==null?null:x-closeLong[i]);
    const bwSignal=smaRef(bwDiff.filter(x=>x!=null),50);
    // Align signal SMA's first valid index to the first non-null diff value.
    const bwSignalFull=Array(n).fill(null); let first=bwDiff.findIndex(x=>x!=null);
    for(let i=0;i<n;i++) if(i-first+1>=50) bwSignalFull[i]=bwDiff.slice(i-49,i+1).reduce((x,y)=>x+y,0)/50;
    const bwExpected=bwDiff.map((x,i)=>x==null||bwSignalFull[i]==null?null:x-bwSignalFull[i]);
    const median=h.map((x,i)=>(x+l[i])/2), m5=smaRef(median,5), m34=smaRef(median,34);
    const ao=m5.map((x,i)=>x==null||m34[i]==null?null:x-m34[i]);
    const aoSma5=smaRef(ao.filter(x=>x!=null),5), aoSmaFull=Array(n).fill(null); first=ao.findIndex(x=>x!=null);
    for(let i=0;i<n;i++) if(i-first+1>=5) aoSmaFull[i]=ao.slice(i-4,i+1).reduce((x,y)=>x+y,0)/5;
    const ac=ao.map((x,i)=>x==null||aoSmaFull[i]==null?null:x-aoSmaFull[i]);
    const acSma10=smaRef(ac.filter(x=>x!=null),10), acExpected=Array(n).fill(null); first=ac.findIndex(x=>x!=null);
    for(let i=0;i<n;i++) if(i-first+1>=10) acExpected[i]=ac.slice(i-9,i+1).reduce((x,y)=>x+y,0)/10;
    const amaExpected=Array(n).fill(null), period=15, fast=2/(3+1), slow=2/(20+1);
    for(let i=period;i<n;i++) {
      let vol=0; for(let j=i-period+1;j<=i;j++) vol+=Math.abs(c[j]-c[j-1]);
      const dir=c[i]-c[i-period], er=Math.abs(dir/(vol||0.000001));
      const sc=(er*(fast-slow)+slow)**2;
      const prev=amaExpected[i-1]!=null&&amaExpected[i-1]!==0?amaExpected[i-1]:c[i-1];
      amaExpected[i]=prev+sc*(c[i]-prev);
    }
    const eq=(x,y)=>x.length===y.length&&x.every((v,i)=>(v==null&&y[i]==null)||(Number.isFinite(v)&&Number.isFinite(y[i])&&Math.abs(v-y[i])<1e-9));
    const bw=IND.atas_acbw.f(A,{long:51,short:50,signal:50})[0].d;
    const dc=IND.atas_acdc.f(A,{sma1:34,sma2:5,sma3:10,sma4:5})[0].d;
    const ama=IND.atas_ama.f(A,{period:15,fast:3,slow:20})[0].d;
    return { bw:eq(bw,bwExpected), dc:eq(dc,acExpected), ama:eq(ama,amaExpected) };
  })()`, context);
  assert.equal(result.bw, true);
  assert.equal(result.dc, true);
  assert.equal(result.ama, true);
});
