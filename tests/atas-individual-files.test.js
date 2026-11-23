'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

function loadContext() {
  const context = vm.createContext({ window: {}, console, Math, Date, Number, Array, Object, Set, Map, JSON });
  for (const file of ['js/indicators-defs.js', 'js/indicators-custom.js', 'js/pine-indicators-defs.js']) vm.runInContext(read(file), context, { filename: file });
  const html = read('index.html');
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]).filter(p => p.startsWith('indicators/'));
  for (const file of scripts) vm.runInContext(read(file), context, { filename: file });
  return { context, scripts };
}

test('catalog only contains usable items and every catalog indicator has a unique JS module/registry key', () => {
  const { context } = loadContext();
  const catalog = JSON.parse(read('indicators/atas-catalog.json'));
  const rows = catalog.items;
  const fileIds = vm.runInContext(`Object.keys(window.ATASIndicatorFiles).filter(k => k !== 'summary')`, context);
  const metadataErrors = vm.runInContext(`window.ATAS_INDICATOR_CATALOG.filter(x => !window.ATASIndicatorFiles[x.id] || window.ATASIndicatorFiles[x.id].id !== x.id || !window.ATASIndicatorFiles[x.id].moduleFile)`, context);
  const mappedMissing = vm.runInContext(`window.ATAS_INDICATOR_CATALOG.filter(x => !x.addKey || !IND[x.addKey]).map(x => x.id)`, context);
  assert.equal(catalog.indicatorCount, 217);
  assert.equal(rows.length, 217);
  assert.equal(new Set(rows.map(x => x.sourceClass)).size, 217);
  assert.equal(new Set(rows.map(x => x.addKey)).size, 217);
  assert.ok(rows.every(x => x.name && x.sourceClass && x.sourceFile && x.status && x.detail && x.addKey));
  assert.ok(rows.every(x => ['ported','ported_tick','existing'].includes(x.status)));
  assert.deepEqual(Array.from(metadataErrors), []);
  assert.deepEqual(Array.from(mappedMissing), []);
  const metadataMismatches = vm.runInContext(`window.ATAS_INDICATOR_CATALOG.flatMap(x => { const m=window.ATASIndicatorFiles[x.id]||{}; return ['name','sourceClass','sourceFile','group','requirement','status','conversion','addKey'].filter(k => x[k] !== m[k]).map(k => x.id+':'+k); })`, context);
  assert.deepEqual(Array.from(metadataMismatches), []);
  assert.equal(fileIds.length, 217);
  assert.equal(fs.readdirSync(path.join(root, 'indicators/individual')).filter(x => x.endsWith('.js') && !x.startsWith('_compat_')).length, 217);
  assert.equal(catalog.items.find(x => x.sourceClass === 'MultiMarketPower'), undefined);
  assert.equal(catalog.items.find(x => x.sourceClass === 'VolumePerTrade'), undefined);
  assert.equal(catalog.items.find(x => x.sourceClass === 'DomPower').addKey, 'atas_dom_power_l2');
  assert.equal(catalog.items.find(x => x.sourceClass === 'OrderBookAlerts').addKey, 'atas_order_book_alerts_l2');
  assert.ok(catalog.items.find(x => x.sourceClass === 'DailyChange').detail.includes('Previous Day Close'));
  assert.ok(catalog.items.find(x => x.sourceClass === 'Pivots').detail.includes('PP ± 2'));
  assert.equal(catalog.items.find(x => x.sourceClass === 'Ratio').group, 'orderflow');
  assert.equal(catalog.items.find(x => x.sourceClass === 'ClusterStatistic').requirement, 'quote_footprint');
});

test('module load order respects runtimes, individual files, compatibility aliases and finalizer', () => {
  const { context, scripts } = loadContext();
  const html = read('index.html');
  const moduleTypeByPath = new Map(Object.values(context.window.ATASIndicatorFiles).filter(x => x && x.moduleFile).map(x => [x.moduleFile, x.moduleType]));
  const primaryIndices = scripts.map((p, i) => moduleTypeByPath.get(p) === 'primary' ? i : -1).filter(i => i >= 0);
  const aliasIndices = scripts.map((p, i) => moduleTypeByPath.get(p) === 'alias' ? i : -1).filter(i => i >= 0);
  assert.ok(html.indexOf('indicators/atas-catalog.js') < html.indexOf('indicators/atas-technical-runtime.js'));
  assert.ok(html.indexOf('indicators/atas-technical-runtime.js') < html.indexOf('indicators/atas-session-runtime.js'));
  assert.ok(html.indexOf('indicators/atas-session-runtime.js') < html.indexOf('indicators/atas-tick-runtime.js'));
  assert.ok(html.indexOf('indicators/atas-tick-runtime.js') < html.indexOf('indicators/individual/acbw.js'));
  assert.ok(primaryIndices.length > 0 && aliasIndices.length > 0);
  assert.ok(Math.max(...primaryIndices) < Math.min(...aliasIndices));
  assert.ok(html.indexOf('indicators/atas-registry-finalize.js') < html.indexOf('js/indicators-engine.js'));
  assert.equal(scripts.filter(p => p.startsWith('indicators/individual/') && !p.split('/').pop().startsWith('_compat_')).length, 217);
  assert.equal(scripts.filter(p => p.startsWith('indicators/individual/') && p.split('/').pop().startsWith('_compat_')).length, 7);
  assert.ok(!scripts.includes('indicators/individual/multimarketpower.js'));
  assert.ok(!scripts.includes('indicators/individual/volumepertrade.js'));
  assert.equal(fs.existsSync(path.join(root,'indicators/individual/multimarketpower.js')), false);
  assert.equal(fs.existsSync(path.join(root,'indicators/individual/volumepertrade.js')), false);
});

test('quote-tick consumers are explicitly proxy-labelled and only request quote data when needed', () => {
  const { context } = loadContext();
  const state = vm.runInContext(`({
    keys: window.ATASQuoteTickPorts.registeredKeys,
    catalog: window.ATAS_INDICATOR_CATALOG.filter(x => x.status === 'ported_tick'),
  })`, context);
  assert.equal(state.keys.length, 23);
  assert.equal(state.catalog.length, 20);
  assert.ok(state.catalog.every(x => x.conversion === 'quote_tick_proxy'));
  assert.ok(state.catalog.every(x => ['quote_ticks','quote_footprint'].includes(x.requirement)));
  for (const c of ['CAV','FCV','VsaWsd','VsaBetterVolume','WeissWave']) {
    const row = state.catalog.find(x => x.sourceClass === c);
    assert.equal(row, undefined);
  }
  const ctx = context;
  ctx.ACT = [{key:'atas_cvd_quote_tick',on:true}];
  assert.equal(vm.runInContext('window.atasTickIndicatorActive()', ctx), true);
});

test('session-based indicators are wired with server-time OHLC and source default behavior', () => {
  const { context } = loadContext();
  const result = vm.runInContext(`(() => {
    const n=6,o=[],h=[],l=[],c=[],v=[],t=[],s=[];
    const start=1700006400; // 2023-11-15 00:00 UTC, two 24h sessions
    const rows=[
      [100,102,99,101],[101,103,100,102],[102,104,101,103],
      [104,106,103,105],[105,107,104,106],[106,108,105,107]
    ];
    for(let i=0;i<n;i++){o.push(rows[i][0]);h.push(rows[i][1]);l.push(rows[i][2]);c.push(rows[i][3]);v.push(100);t.push(start+i*86400);s.push(start+i*86400);}
    const A={o,h,l,c,v,t,s};
    const dc=IND.atas_daily_change.f(A,{mode:'previous',format:'price'})[0].d;
    const dl=IND.atas_daily_lines.f(A,{period:'previousDay',showOpen:true,showHigh:true,showLow:true,showClose:true})[0].d;
    const ib=IND.atas_initial_balance.f(A,{minutes:60,x1:1,x2:2,x3:3}) ;
    const piv=IND.atas_pivots.f(A,{period:'day',levels:3,showMidpoints:true});
    const open=IND.atas_open_line.f(A,{days:5,tillTouch:false,sessionStartHour:0,sessionStartMinute:0})[0].d;
    return {dc,open,ibCount:ib.length,ibFinite:ib[0].d.some(Number.isFinite),pivCount:piv.length,pivR3:piv[5].d[3],pivS3:piv[6].d[3],pivPP:piv[0].d[3],dlLength:dl.length};
  })()`, context);
  assert.equal(result.dc[0], null);
  assert.equal(result.dc[3], 2); // session 2 close 105 minus previous session close 103
  assert.deepEqual(Array.from(result.open), [null,101,102,104,105,106]);
  assert.equal(result.ibCount, 10);
  assert.equal(result.ibFinite, true);
  assert.equal(result.pivCount, 11);
  assert.ok(Math.abs(result.pivR3 - (102.66666666666667 + 6)) < 1e-9);
  assert.ok(Math.abs(result.pivS3 - (102.66666666666667 - 6)) < 1e-9);
  assert.ok(Math.abs(result.pivPP - 102.66666666666667) < 1e-9);
  assert.equal(result.dlLength, 6);
});

test('Initial Balance refuses to fabricate first-N-minute extrema on a coarser chart timeframe', () => {
  const { context } = loadContext();
  context.C = { tf: 240 * 60 };
  const result = vm.runInContext(`(() => {
    const A={o:[100,101],h:[105,106],l:[99,100],c:[103,104],v:[10,10],t:[1700000000,1700014400],s:[1700000000,1700014400]};
    return IND.atas_initial_balance.f(A,{minutes:60});
  })()`, context);
  assert.deepEqual(Array.from(result), []);
});

test('Level II DOM indicators use cTrader depth snapshots and never invent historical data', () => {
  const { context } = loadContext();
  context.window.atasDepthSnapshot = () => ({available:true,bids:[{price:100,size:250}],asks:[{price:100.1,size:140}],bidTotal:250,askTotal:140,mid:100.05,updatedAt:Date.now(),changes:[]});
  context.CT = {sym:{id:9,digits:2}};
  const result = vm.runInContext(`(() => {
    const A={o:[100,100,100],h:[101,101,101],l:[99,99,99],c:[100,100,100],v:[1,1,1],t:[1,2,3],s:[1,2,3]};
    const dom=IND.atas_dom_power_l2.f(A,{levels:5});
    const alerts=IND.atas_order_book_alerts_l2.f(A,{levels:5,minSize:100,offsetMode:'percent',priceOffset:1,side:'both',timeFilterEnabled:false,cooldownSec:0});
    return {bid:dom[0].d,ask:dom[1].d,net:dom[2].d,markers:alerts[0].mk.length};
  })()`, context);
  assert.deepEqual(Array.from(result.bid), [null,null,250]);
  assert.deepEqual(Array.from(result.ask), [null,null,-140]);
  assert.deepEqual(Array.from(result.net), [null,null,110]);
  assert.equal(result.markers, 2);
});

test('Order Book Alerts tick-offset filter uses decimal Level II prices', () => {
  const { context } = loadContext();
  context.PDIG = () => 2;
  context.window.atasDepthSnapshot = () => ({available:true,bids:[{price:100.00,size:250}],asks:[{price:100.10,size:140}],bidTotal:250,askTotal:140,mid:100.05,updatedAt:Date.now(),changes:[]});
  context.CT = {sym:{id:11,digits:2}};
  const result = vm.runInContext(`(() => {
    const A={o:[100],h:[100.2],l:[99.8],c:[100.05],v:[1],t:[1],s:[1]};
    const p={levels:5,minSize:100,offsetMode:'ticks',priceOffset:1,side:'both',timeFilterEnabled:false,cooldownSec:0};
    const near=IND.atas_order_book_alerts_l2.f(A,p)[0].mk.length;
    p.priceOffset=5;
    const wide=IND.atas_order_book_alerts_l2.f(A,p)[0].mk.length;
    return {near,wide};
  })()`, context);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), {near:0,wide:2});
});

test('Service Worker precaches every remaining indicator module with updated cache version', () => {
  const sw = read('sw.js');
  const html = read('index.html');
  const modules = [...html.matchAll(/<script src="(indicators\/individual\/[^"]+\.js)"/g)].map(m => './' + m[1]);
  assert.equal(modules.filter(x => !x.includes('/_compat_')).length, 217);
  for (const module of modules) assert.ok(sw.includes(JSON.stringify(module)), `SW missing ${module}`);
  assert.doesNotMatch(sw, /multimarketpower\.js/);
  assert.match(sw, /const batchSize = 24/);
  assert.match(sw, /cache\.addAll\(SHELL\.slice\(i, i \+ batchSize\)\)/);
  assert.match(sw, /ict-quantlab-shell-v65/);
  assert.match(sw, /\.\/indicators\/atas-session-runtime\.js/);
});

test('browser catalog manifest exactly matches the JSON catalog', () => {
  const json = JSON.parse(read('indicators/atas-catalog.json'));
  const { context } = loadContext();
  assert.deepEqual(JSON.parse(JSON.stringify(context.window.ATAS_INDICATOR_CATALOG)), json.items);
});


test('indicator requirement labels distinguish broker Level II and server-time from unavailable MBO/exchange calendars', () => {
  const engine=read('js/indicators-engine.js');
  assert.match(engine, /depth:"cTrader Level II depth quotes \(không phải MBO\)"/);
  assert.match(engine, /session:"Dựa trên timestamp chart\/server \(không có exchange calendar\)"/);
  assert.doesNotMatch(engine, /depth:"Cần full depth \/ MBO"/);
});
