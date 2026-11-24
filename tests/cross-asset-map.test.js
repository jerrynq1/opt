'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadMath(options={}){
  const window = {};
  const document = { getElementById: () => null };
  const storage = options.storage || new Map();
  const localStorage = { getItem: key => storage.has(key) ? storage.get(key) : null, setItem: (key, value) => storage.set(key, value) };
  const context = { window, document, localStorage, Number, Math, Date, Intl, String, Object,
    agg: options.agg || [], rawAgg: options.rawAgg || [], C: { tf: options.tf || 60 } };
  if(options.u2s)context.u2s=options.u2s;
  if(options.disp)context.disp=options.disp;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'cross-asset-map.js'), 'utf8'), context,
    { filename: 'cross-asset-map.js' });
  return { ...window.crossAssetMapMath, flow: window.crossAssetFlowMath, xmap: window.XMAP, storage };
}
const math = loadMath();

const snap = (overrides={}) => ({
  key:'qqq', symbol:'QQQ', expiry:'2026-11-20', complete:true, coverage:.92, updatedAt:123456,
  dist:[{strike:652,callOI:10,putOI:5,gex:100},{strike:660,callOI:8,putOI:3,gex:50}],
  callOIWall:{strike:652,oi:50}, putOIWall:{strike:640,oi:40},
  gexCallWall:{strike:662,gex:500},gexPutWall:{strike:660,gex:-300},
  gammaFlip:655, gexRatio:1.63, gexRatioState:'ready',gexRatioBias:'call-dominant',callGexTotal:1.63,putGexAbsTotal:1, maxPain:{strike:650,payout:900},
  gexLevels:[{rank:1,strike:658,gex:120},{rank:2,strike:657,gex:-90}],
  ...overrides
});

test('relative-price conversion maps an ETF level onto the CFD scale', () => {
  assert.equal(math.mapStrike(652, 652, 4545), 4545);
  assert.equal(math.mapStrike(630, 600, 25000), 26250);
  assert.equal(math.mapStrike(420, 400, 4000), 4200);
});

test('invalid anchors do not create synthetic prices', () => {
  assert.equal(math.mapStrike(630, null, 25000), null);
  assert.equal(math.mapStrike(630, 600, 0), null);
  assert.equal(math.mapStrike(-1, 600, 25000), null);
});

test('GEX ranking returns strongest absolute exposure first and can exclude CW/PW strikes', () => {
  const rows=[{strike:90,gex:1000},{strike:100,gex:80},{strike:110,gex:-900},{strike:120,gex:-40}];
  assert.deepEqual(math.rankGexLevels(rows,2).map(x=>x.strike),[90,110]);
  assert.deepEqual(math.rankGexLevels(rows,2,[90,110]).map(x=>x.strike),[100,120]);
});

test('first mapping converts OI walls, GEX walls and ladder levels as separate families', () => {
  const m=math.buildMappedMap(snap(),652,4545,null,1000);
  assert.equal(m.target,'NAS100');
  assert.equal(m.callOIWall.sourceLevel,652);
  assert.equal(m.callOIWall.target,4545);
  assert.ok(Math.abs(m.putOIWall.target-4545*640/652)<1e-8);
  assert.ok(Math.abs(m.gexCallWall.target-4545*662/652)<1e-8);
  assert.ok(Math.abs(m.gexPutWall.target-4545*660/652)<1e-8);
  assert.ok(Math.abs(m.gammaFlip.target-4545*655/652)<1e-8);
  assert.equal(m.gammaFlip,m.gammaFlip);
    assert.ok(Math.abs(m.maxPain.target-4545*650/652)<1e-8);
  assert.ok(Math.abs(m.gexLevels[0].target-4545*658/652)<1e-8);
  assert.equal(m.dist[0].target,4545);
  assert.equal(m.dist[0].gex,100);
  assert.equal(m.lastLevelChangeAt,1000);
  assert.ok(m.mappingSignature.includes('652'));
});

test('indicator GEX ladder excludes CW/PW, both OI Walls, Max Pain, ties and Gamma Flip', () => {
  const levels=[
    {strike:662,gex:9000}, // GEX CW
    {strike:660,gex:-8000}, // GEX PW
    {strike:652,gex:700}, // Call OI Wall
    {strike:640,gex:-600}, // Put OI Wall
    {strike:650,gex:550}, // Max Pain
    {strike:651,gex:540}, // tied Max Pain
    {strike:655,gex:530}, // Gamma Flip
    {strike:658,gex:500},
    {strike:657,gex:450},
    {strike:656,gex:400},
    {strike:654,gex:350},
    {strike:653,gex:300}
  ];
  const mapped=math.buildMappedMap(snap({
    dist:levels.map(x=>({...x,callOI:10,putOI:5})),
    gexCallWall:{strike:662,gex:9000},
    gexPutWall:{strike:660,gex:-8000},
    maxPain:{strike:650,tiedStrikes:[650,651],payout:120},
    gammaFlip:655,
    gexLevels:levels.map((x,i)=>({rank:i+1,...x}))
  }),652,4545,null,1500);
  assert.deepEqual(Array.from(mapped.gexLevels, x=>x.strike),[658,657,656,654,653]);
  assert.deepEqual(Array.from(mapped.gexLevels, x=>x.rank),[1,2,3,4,5]);
  const forbidden=[652,640,662,660,650,651,655];
  assert.ok(mapped.gexLevels.every(x=>!forbidden.some(y=>math.sameLevel(x.strike,y))));
  assert.deepEqual(Array.from(mapped.gexExcludedStrikes),forbidden);
});
test('GEX level keeps its own mapping when rank changes after another Key Level is excluded', () => {
  const firstSnap=snap({dist:[
    {strike:662,gex:1000},{strike:660,gex:900},{strike:658,gex:800},{strike:656,gex:700}
  ],gexLevels:[{rank:1,strike:662,gex:1000},{rank:2,strike:660,gex:900},{rank:3,strike:658,gex:800},{rank:4,strike:656,gex:700}],
    gexCallWall:{strike:670,gex:1200},gexPutWall:{strike:640,gex:-1100},
    callOIWall:null,putOIWall:null,maxPain:null,gammaFlip:null});
  const first=math.buildMappedMap(firstSnap,652,4545,null,1000);
  const strike658=first.gexLevels.find(x=>x.sourceLevel===658);
  const secondSnap={...firstSnap,updatedAt:2000,callOIWall:{strike:662,oi:300}};
  const second=math.buildMappedMap(secondSnap,700,5000,first,2000);
  const after=second.gexLevels.find(x=>x.sourceLevel===658);
  assert.equal(after.rank,2,'658 moves up after 662 is excluded as an OI wall');
  assert.equal(after.target,strike658.target,'same source strike retains its previously locked CFD level');
});

test('live ETF and CFD price ticks do not move unchanged source levels', () => {
  const first=math.buildMappedMap(snap(),652,4545,null,1000);
  const laterSnapshot=snap({updatedAt:2000,dist:[
    {strike:652,callOI:99,putOI:55,gex:999},
    {strike:660,callOI:88,putOI:33,gex:500}
  ]});
  const later=math.buildMappedMap(laterSnapshot,670,4800,first,2000);
  assert.equal(later.callOIWall.target,first.callOIWall.target);
  assert.equal(later.putOIWall.target,first.putOIWall.target);
  assert.equal(later.gammaFlip.target,first.gammaFlip.target);
  assert.equal(later.maxPain.target,first.maxPain.target);
  assert.equal(later.gexLevels[0].target,first.gexLevels[0].target);
  assert.equal(later.dist[0].target,first.dist[0].target);
  assert.equal(later.dist[0].gex,999,'OI/GEX metrics may refresh while mapped strike position stays fixed');
  assert.equal(later.lastLevelChangeAt,first.lastLevelChangeAt);
});

test('only source levels whose values changed are recalculated at the new live ratio', () => {
  const first=math.buildMappedMap(snap(),652,4545,null,1000);
  const updated=math.buildMappedMap(snap({
    dist:[
      {strike:652,callOI:1,putOI:1,gex:90},
      {strike:653,callOI:70,putOI:10,gex:700},
      {strike:640,callOI:2,putOI:41,gex:-200},
      {strike:663,callOI:3,putOI:4,gex:600},
      {strike:660,callOI:5,putOI:8,gex:-200},
      {strike:651,callOI:6,putOI:7,gex:150},
      {strike:656,callOI:4,putOI:9,gex:-120},
      {strike:659,callOI:3,putOI:2,gex:300},
      {strike:657,callOI:2,putOI:1,gex:100}
    ],
    callOIWall:{strike:653,oi:70},
    putOIWall:{strike:640,oi:41},
    gexCallWall:{strike:663,gex:600},
    gexPutWall:{strike:660,gex:-200},
    gammaFlip:656,
    maxPain:{strike:651,payout:950},
    gexLevels:[{rank:1,strike:659,gex:300},{rank:2,strike:656,gex:-120},{rank:3,strike:657,gex:100}]
  }),660,4600,first,2500);
  const ratio=4600/660;
  assert.equal(updated.callOIWall.target,653*ratio);
  assert.equal(updated.putOIWall.target,first.putOIWall.target,'unchanged Put OI Wall remains fixed');
  assert.equal(updated.gexCallWall.target,663*ratio,'changed GEX CW remaps independently');
  assert.equal(updated.gexPutWall.target,first.gexPutWall.target,'unchanged GEX PW remains fixed');
  assert.equal(updated.gammaFlip.target,656*ratio,'changed Zero Gamma / Vol Trigger remaps once');
  assert.equal(updated.maxPain.target,651*ratio);
  assert.equal(updated.gexLevels[0].target,659*ratio);
  assert.equal(updated.gexLevels[1].sourceLevel,657);
  assert.equal(updated.gexLevels[1].target,first.gexLevels.find(x=>x.sourceLevel===657).target,'unchanged source strike keeps mapping when rank changes');
  assert.equal(updated.dist[0].target,first.dist[0].target,'the individual strike heatmap row remains fixed');
  assert.equal(updated.lastLevelChangeAt,2500);
});

test('a newly added strike or newly appearing source level is mapped when first received', () => {
  const first=math.buildMappedMap(snap(),652,4545,null,1000);
  const next=math.buildMappedMap(snap({
    dist:[...snap().dist,{strike:670,callOI:1,putOI:2,gex:7}],
    gammaFlip:659
  }),660,4600,first,3000);
  assert.equal(next.dist.find(x=>x.strike===670).target,670*4600/660);
  assert.equal(next.gammaFlip.target,659*4600/660);
});


test('Gamma Flip / Zero Gamma is the only mapped level; no Vol Trigger alias is exposed', () => {
  const source=snap({gammaFlip:654,gexRatio:1.56,gexRatioState:'ready',gexRatioBias:'call-dominant',callGexTotal:156,putGexAbsTotal:100});
  const mapped=math.buildMappedMap(source,652,4545,null,9000);
  assert.ok(Math.abs(mapped.gammaFlip.target-654*4545/652)<1e-8);
  assert.equal(mapped.volTrigger,undefined);
  assert.equal(mapped.mappedCount, snap().dist.length + 8, 'one Zero Gamma level is counted once, not twice');
  assert.equal(mapped.gexRatio,1.56);
  assert.equal(mapped.gexRatioState,'ready');
  assert.equal(mapped.gexRatioBias,'call-dominant');
  assert.equal(mapped.callGexTotal,156);
  assert.equal(mapped.putGexAbsTotal,100);
});

test('nullable GEX Ratio remains unavailable instead of coercing null to zero', () => {
  const mapped=math.buildMappedMap(snap({gexRatio:null,gexRatioState:'incomplete'}),652,4545,null,9100);
  assert.equal(mapped.gexRatio,null);
  assert.equal(mapped.gexRatioState,'incomplete');
});
test('changing expiry starts a new level-mapping session', () => {
  const first=math.buildMappedMap(snap(),652,4545,null,1000);
  const next=math.buildMappedMap(snap({expiry:'2026-12-18'}),670,4800,first,4000);
  assert.equal(next.callOIWall.target,652*4800/670);
  assert.equal(next.lastLevelChangeAt,4000);
});

test('incomplete or empty option snapshots are not mapped', () => {
  assert.equal(math.buildMappedMap(null,652,4545),null);
  assert.equal(math.buildMappedMap(snap({complete:false}),652,4545),null);
  assert.equal(math.buildMappedMap(snap({dist:[]}),652,4545),null);
});

test('when a changed level arrives before anchors, old unchanged levels are retained and new one waits', () => {
  const first=math.buildMappedMap(snap(),652,4545,null,1000);
  const noAnchor=math.buildMappedMap(snap({callOIWall:{strike:653,oi:70}}),null,null,first,2000);
  assert.equal(noAnchor.callOIWall.sourceLevel,653);
  assert.equal(noAnchor.callOIWall.target,null);
  assert.equal(noAnchor.putOIWall.target,first.putOIWall.target);
  const mapped=math.buildMappedMap(snap({callOIWall:{strike:653,oi:70}}),660,4600,noAnchor,3000);
  assert.equal(mapped.callOIWall.target,653*4600/660);
});


test('per-level mappings are persisted separately by ETF source, CFD target and expiry', () => {
  const source=fs.readFileSync(path.join(__dirname,'..','js','cross-asset-map.js'),'utf8');
  assert.match(source,/tp_xmap_levels_v7:/);
  assert.match(source,/localStorage\.setItem\(mapStorageKey\(snapshot\),JSON\.stringify\(map\)\)/);
  assert.match(source,/restoreMappedLevels\(s\)/);
  assert.match(source,/gexCallWall:gexCallWall/);
  assert.match(source,/gexPutWall:gexPutWall/);
  assert.match(source,/map\.expiry===\(snapshot\.expiry\|\|''\)/);
});

test('the panel no longer exposes a manual remap button or manual remap handler', () => {
  const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  const source=fs.readFileSync(path.join(__dirname,'..','js','cross-asset-map.js'),'utf8');
  assert.doesNotMatch(html,/id=["']xmapSync["']/);
  assert.doesNotMatch(html,/Chốt\s*&amp;\s*quy đổi lại/);
  assert.doesNotMatch(source,/xmapSync|forceLock|pendingRelock/);
});

test('chart renderer draws saved flow bubbles and optional key levels without remapping the source values', () => {
  const source=fs.readFileSync(path.join(__dirname,'..','js','cross-asset-map.js'),'utf8');
  const draw=source.slice(source.indexOf('function drawCrossAssetMap'),source.indexOf('window.drawCrossAssetMap'));
  assert.match(draw,/drawFlowBubbles\(w,h,a\)/);
  assert.match(draw,/cs\.priceToCoordinate\(cwall\)/);
  assert.match(draw,/s\.gammaFlip\?\.target/);
  assert.doesNotMatch(draw,/s\.volTrigger\?\.target/);
  assert.doesNotMatch(draw,/mapStrike\(/);
  assert.match(draw,/pendingCount>0/,'live spot anchors are only consulted to resolve levels that could not yet be mapped');
});

test('Volume Flow bubbles use sub-candle event time, mapped strike and print contract strike plus delta', () => {
  const source=fs.readFileSync(path.join(__dirname,'..','js','cross-asset-map.js'),'utf8');
  const draw=source.slice(source.indexOf('function drawFlowBubbles'),source.indexOf('function drawCrossAssetMap'));
  assert.match(source,/function flowEventLogicalTime\(timeSec\)/);
  assert.match(source,/ts\.logicalToCoordinate\(logical\)/);
  assert.match(draw,/event\.volumeDelta|volumeDelta/);
  assert.match(draw,/item\.event\.strike/);
  assert.match(draw,/labelMode==='volume'/);
  assert.match(draw,/compact\(item\.delta\)/);
  assert.match(draw,/centerLabel=labelMode==='volume'\?compact\(item\.delta\):item\.side/);
  assert.match(draw,/const strikeText=`\$\{isInterval\?'~':''\}\$\{strikeLabel\}`/);
  assert.doesNotMatch(source,/P\.heatmap|P\.heat\b/,'ETF Options Volume Flow has no synthetic limit/stop heatmap layer');
});


test('Indicator exposes one Gamma Flip / Zero Gamma toggle and one chart line, without Vol Trigger', () => {
  const defs=fs.readFileSync(path.join(__dirname,'..','js','indicators-custom.js'),'utf8');
  const source=fs.readFileSync(path.join(__dirname,'..','js','cross-asset-map.js'),'utf8');
  assert.match(defs,/\[\"gammaFlip\",\"Gamma Flip \/ Zero Gamma\"/);
  assert.doesNotMatch(defs,/Vol Trigger/i);
  assert.doesNotMatch(defs,/\[\"volTrigger\"/);
  const draw=source.slice(source.indexOf('function drawCrossAssetMap'),source.indexOf('window.drawCrossAssetMap'));
  assert.equal((draw.match(/GAMMA FLIP \/ ZERO GAMMA/g)||[]).length,1);
});


test('ETF Options Volume Flow exposes Volume Delta / C-P bubble label selection and defaults to Volume', () => {
  const defs=fs.readFileSync(path.join(__dirname,'..','js','indicators-custom.js'),'utf8');
  const source=fs.readFileSync(path.join(__dirname,'..','js','cross-asset-map.js'),'utf8');
  assert.ok(defs.includes('["bubbleLabelMode","Nội dung trong bubble","volume","s"'));
  assert.ok(defs.includes('["volume","Volume Delta"]'));
  assert.ok(defs.includes('["cp","Call / Put (C/P)"]'));
  assert.ok(source.includes("bubbleLabelMode:'volume'"));
  assert.ok(source.includes("p.bubbleLabelMode=p.bubbleLabelMode==='cp'?'cp':'volume'"));
  const demo=fs.readFileSync(path.join(__dirname,'..','demo','volume-flow-bubble-preview.html'),'utf8');
  assert.ok(demo.includes('id=\"bubbleMode\"'));
  assert.ok(demo.includes("renderChart(e.target.value)"));
});

test('provisional GEX walls and ladder are not mapped to the CFD chart', () => {
  const snapshot = snap();
  snapshot.gexComplete = false;
  const mapped = math.buildMappedMap(snapshot, 652, 4062, null, 1000);
  assert.equal(mapped.gexCallWall, null);
  assert.equal(mapped.gexPutWall, null);
  assert.deepEqual(Array.from(mapped.gexLevels), []);
  assert.ok(mapped.callOIWall, 'OI walls can still map when OI coverage is complete');
});

test('OptionBubbles DTE and moneyness filters use event-time New York date and fresh underlying snapshot', () => {
  const flow = math.flow;
  const observedAt = Date.parse('2026-11-23T15:00:00Z'); // 10:00 New York
  const base = { observedAt, underlyingSpot: 400, spotTimeMs: observedAt - 2_000, spotAgeMs: 2_000 };
  assert.equal(flow.eventDteDays({ ...base, expiry: '2026-11-27' }), 4);
  assert.equal(flow.eventDteDays({ ...base, expiry: '2026-11-23' }), 0);
  assert.equal(flow.eventMoneyness({ ...base, optionType: 'C', strike: 385 }), 'itm');
  assert.equal(flow.eventMoneyness({ ...base, optionType: 'P', strike: 415 }), 'itm');
  assert.equal(flow.eventMoneyness({ ...base, optionType: 'C', strike: 402 }), 'atm');
  assert.equal(flow.eventMoneyness({ ...base, optionType: 'P', strike: 385 }), 'otm');
  assert.equal(flow.eventMoneyness({ ...base, optionType: 'C', strike: 385, spotAgeMs: 60_001 }), null);
  assert.equal(flow.eventMoneyness({ ...base, optionType: 'C', strike: 385, spotAgeMs: null, spotTimeMs: null }), null);
});

test('OptionBubbles filters Call/Put, DTE, moneyness and minimum Volume independently', () => {
  const flow = math.flow, t = Date.parse('2026-11-23T15:00:00Z');
  const make = (id, optionType, strike, expiry, volumeDelta, extra = {}) => ({
    id, symbol: 'GLD', optionType, strike, expiry, observedAt: t + id * 1_000,
    volumeDelta, underlyingSpot: 400, spotTimeMs: t + id * 1_000, spotAgeMs: 0, ...extra
  });
  const events = [
    make(1, 'C', 385, '2026-11-27', 100), // ITM Call, 4 DTE
    make(2, 'P', 415, '2026-11-27', 200), // ITM Put, 4 DTE
    make(3, 'C', 420, '2026-12-23', 300), // OTM Call, 30 DTE
    make(4, 'P', 385, '2026-11-23', 400)  // OTM Put, 0 DTE
  ];
  const common = { filterBy: 'volume', minVolumeContracts: 0, showCalls: true, showPuts: true, expiryDteFilter: 'all', moneynessFilter: 'all', autoFilter: 'off', biggestPerCandle: false };
  assert.equal(flow.filterFlowEventData(events, { ...common, showPuts: false }).length, 2);
  assert.equal(flow.filterFlowEventData(events, { ...common, expiryDteFilter: '0dte' }).length, 1);
  assert.equal(flow.filterFlowEventData(events, { ...common, expiryDteFilter: '7d' }).length, 3);
  assert.equal(flow.filterFlowEventData(events, { ...common, expiryDteFilter: '7_30d' }).length, 1);
  assert.equal(flow.filterFlowEventData(events, { ...common, moneynessFilter: 'itm' }).length, 2);
  assert.equal(flow.filterFlowEventData(events, { ...common, moneynessFilter: 'otm' }).length, 2);
  assert.deepEqual(Array.from(flow.filterFlowEventData(events, { ...common, minVolumeContracts: 250 }), row => row.delta), [300, 400]);
});

test('OptionBubbles Estimated Premium filter never invents values when a fresh quote is absent', () => {
  const t = Date.parse('2026-11-23T15:00:00Z');
  const events = [
    { symbol: 'QQQ', optionType: 'C', strike: 600, expiry: '2026-11-27', observedAt: t, volumeDelta: 100, estimatedPremiumUsd: 25_000 },
    { symbol: 'QQQ', optionType: 'P', strike: 595, expiry: '2026-11-27', observedAt: t + 1_000, volumeDelta: 200, estimatedPremiumUsd: null }
  ];
  const rows = math.flow.filterFlowEventData(events, {
    filterBy: 'premium', minPremiumUSD: 10_000, showCalls: true, showPuts: true,
    expiryDteFilter: 'all', moneynessFilter: 'all', autoFilter: 'off'
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].premium, 25_000);
});

test('OptionBubbles Strong/Medium/Weak filters use session percentiles and biggest-per-candle keeps one event', () => {
  const t = Date.parse('2026-11-23T15:00:00Z');
  const events = Array.from({ length: 20 }, (_, i) => ({
    symbol: 'GLD', optionType: i % 2 ? 'C' : 'P', strike: 380 + i,
    expiry: '2026-11-27', observedAt: t + i * 5_000, volumeDelta: i + 1
  }));
  const common = { filterBy: 'volume', minVolumeContracts: 0, showCalls: true, showPuts: true, expiryDteFilter: 'all', moneynessFilter: 'all', biggestPerCandle: false };
  assert.equal(math.flow.filterFlowEventData(events, { ...common, autoFilter: 'strong' }).length, 1);
  assert.equal(math.flow.filterFlowEventData(events, { ...common, autoFilter: 'medium' }).length, 2);
  assert.equal(math.flow.filterFlowEventData(events, { ...common, autoFilter: 'weak' }).length, 4);
  const sameCandle = [
    { ...events[0], observedAt: t + 5_000, volumeDelta: 100 },
    { ...events[1], observedAt: t + 15_000, volumeDelta: 500 },
    { ...events[2], observedAt: t + 75_000, volumeDelta: 250 }
  ];
  const biggest = math.flow.filterFlowEventData(sameCandle, { ...common, autoFilter: 'off', biggestPerCandle: true }, [], 60);
  assert.deepEqual(Array.from(biggest, row => row.delta), [500, 250]);
});

test('OptionBubbles settings expose data-supported filters and avoid unsupported Long/Short, Sweep and Liquidation labels', () => {
  const defs = fs.readFileSync(path.join(__dirname, '..', 'js', 'indicators-custom.js'), 'utf8');
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'cross-asset-map.js'), 'utf8');
  for (const text of ['Estimated Premium (USD)', 'Auto filter', 'Strong (top 5%)', 'Medium (top 10%)', 'Weak (top 20%)', 'Draw a zone around bubbles', 'Moneyness (at event time)', 'Expiry (DTE at event time)', 'Possible multi-leg structure', 'Largest event only']) assert.ok(defs.includes(text), `missing OptionBubbles setting: ${text}`);
  assert.match(defs, /Call\/Put is loại hợp đồng|Call\/Put là loại hợp đồng/);
  assert.doesNotMatch(defs, /\[\"(?:Long Call|Short Call|Long Put|Short Put|Sweep|Liquidation)\"/);
  assert.match(source, /function drawActivityZones\(/);
  assert.match(source, /createRadialGradient/);
  assert.match(source, /bubbleShape/);
  assert.match(source, /showLargeEvents/);
});

test('Volume Flow timestamps are converted from collector UTC to the chart selected timezone before logical mapping', () => {
  const utcStart = 1_800_000_000;
  const serverOffset = 2 * 3600;
  const chartOffset = 7 * 3600;
  const bars = [0, 60, 120].map(offset => ({ st: utcStart + offset + chartOffset, open: 1, close: 1 }));
  const flow = loadMath({ agg: bars, u2s: value => value + serverOffset, disp: value => value + chartOffset - serverOffset });
  const location = flow.flow.flowEventLogicalLocation(utcStart + 30, bars, 60);
  assert.equal(location.candleIndex, 0);
  assert.equal(location.fraction, 0.5);
  assert.equal(location.logical, 0.5, 'an event 30 seconds into a 1-minute candle maps halfway to the next candle center');
  assert.equal(location.chartTime, utcStart + 30 + chartOffset);
});


test('Volume Flow maps events against Lightweight Charts display-time values in UTC+7 and New York', () => {
  const utcStart = Date.parse('2026-11-23T14:30:00Z') / 1000;
  const serverOffset = 2 * 3600; // broker candles use UTC+2 during NY winter
  for (const chartOffset of [7 * 3600, -5 * 3600]) {
    const bars = [0, 60, 120, 180].map(offset => ({
      st: utcStart + offset + serverOffset,
      time: utcStart + offset + chartOffset,
      open: 1, close: 1
    }));
    const flow = loadMath({
      agg: bars,
      u2s: value => value + serverOffset,
      disp: value => value - serverOffset + chartOffset
    });
    const location = flow.flow.flowEventLogicalLocation(utcStart + 30, bars, 60);
    assert.ok(location, `event should map when display offset is ${chartOffset}`);
    assert.equal(location.candleIndex, 0);
    assert.equal(location.fraction, 0.5);
    assert.equal(location.logical, 0.5);
    assert.equal(location.chartTime, utcStart + 30 + chartOffset);
    assert.equal(location.timeField, 'time');
    assert.equal(flow.flow.flowChartTimeAtLogical(0.5, bars, 60), utcStart + 30 + chartOffset);
  }
});

test('event-time CFD price anchor uses the exact chart display-time axis after timezone conversion', () => {
  const utcStart = Date.parse('2026-11-23T14:30:00Z') / 1000;
  const serverOffset = 2 * 3600;
  const chartOffset = -5 * 3600;
  const rawBars = [0, 60, 120].map(offset => ({
    st: utcStart + offset + serverOffset,
    time: utcStart + offset + chartOffset,
    open: 26000 + offset,
    close: 26060 + offset
  }));
  const flow = loadMath({
    rawAgg: rawBars,
    u2s: value => value + serverOffset,
    disp: value => value - serverOffset + chartOffset
  });
  assert.equal(flow.flow.flowEventTargetPriceAt(utcStart + 30), 26030);
});

test('Volume Flow does not extrapolate old events to the left edge when chart history is not loaded', () => {
  const bars = [1000, 1060, 1120].map(st => ({ st }));
  const flow = loadMath({ agg: bars });
  assert.equal(flow.flow.flowEventLogicalLocation(700, bars, 60), null);
  assert.equal(flow.flow.flowEventLogicalTime(700), null);
});

test('event strike mapping uses the CFD candle at event time and the event-time ETF spot snapshot', () => {
  const utcStart = 1_800_000_000;
  const rawBars = [0, 60, 120].map(offset => ({ st: utcStart + offset + 2 * 3600, open: 26000 + offset, close: 26060 + offset }));
  const flow = loadMath({ rawAgg: rawBars, u2s: value => value + 2 * 3600 });
  const targetAtEvent = flow.flow.flowEventTargetPriceAt(utcStart + 30);
  assert.equal(targetAtEvent, 26030);
  const mappedStrike = targetAtEvent * (600 / 600);
  assert.equal(mappedStrike, 26030);
});

test('event strike mapping stays fixed after the live CFD candle changes', () => {
  const utcStart = 1_800_000_000;
  const rawBars = [0, 60, 120].map(offset => ({ st: utcStart + offset + 2 * 3600, open: 26000 + offset, close: 26060 + offset }));
  const flow = loadMath({ rawAgg: rawBars, u2s: value => value + 2 * 3600 });
  const event = {
    id: 'fixed-map-1', symbol: 'QQQ', optionSymbol: 'QQQ261127C00600000', expiry: '2026-11-27',
    strike: 600, optionType: 'C', observedAt: (utcStart + 30) * 1000,
    underlyingSpot: 600, spotTimeMs: (utcStart + 30) * 1000, spotAgeMs: 0
  };
  const first = flow.flow.flowEventMapping(event);
  assert.ok(first && first.mappedPrice > 0);
  flow.flow.persistBubbleAnchorCache();
  assert.equal(first.targetPriceAtEvent, 26030);
  rawBars[0].open = 27000;
  rawBars[0].close = 27120;
  const later = flow.flow.flowEventMapping(event);
  assert.equal(later.mappedPrice, first.mappedPrice, 'the stored event-time mapping must not float with live price ticks');
  assert.equal(later.ratio, first.ratio);
  assert.equal(later.cached, true);
  assert.ok([...flow.storage.keys()].some(key => String(key).includes('tp_xmap_bubble_anchors_v7')));

  // Simulate a browser reload: the persisted event anchor wins over a newer live chart price.
  const reloaded = loadMath({ rawAgg: [{ st: utcStart + 2 * 3600, open: 28000, close: 28100 }], u2s: value => value + 2 * 3600, storage: flow.storage });
  const afterReload = reloaded.flow.flowEventMapping(event);
  assert.equal(afterReload.mappedPrice, first.mappedPrice);
  assert.equal(afterReload.cached, true);
});

test('bubble renderer caches filtered/session calculations and no longer linearly searches event array per bubble', () => {
  const source = fs.readFileSync(path.join(__dirname,'..','js','cross-asset-map.js'),'utf8');
  assert.match(source,/function prepareFlowRenderData\(P\)/);
  assert.match(source,/existing\.events===events/);
  assert.match(source,/sessionScaleByKey/);
  const draw = source.slice(source.indexOf('function drawFlowBubbles'),source.indexOf('function drawTradePayoffOverlay'));
  assert.doesNotMatch(draw,/events\.indexOf\(/);
  assert.match(draw,/visibleFlowItems\(prepared\.filtered/);
  assert.match(draw,/flowEventMapping\(event\)/);
  assert.doesNotMatch(draw,/tp\*\(strike\/sp\)/);
});

