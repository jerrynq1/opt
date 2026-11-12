'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadMath(){
  const window = {};
  const document = { getElementById: () => null };
  const localStorage = { getItem: () => null, setItem: () => {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'cross-asset-map.js'), 'utf8'),
    { window, document, localStorage, Number, Math, Date, Intl, String, Object },
    { filename: 'cross-asset-map.js' });
  return window.crossAssetMapMath;
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

test('chart renderer only reads mapped CFD targets and never recomputes from live prices', () => {
  const source=fs.readFileSync(path.join(__dirname,'..','js','cross-asset-map.js'),'utf8');
  const draw=source.slice(source.indexOf('function drawCrossAssetMap'),source.indexOf('window.drawCrossAssetMap'));
  assert.match(draw,/cs\.priceToCoordinate\(p\)/);
  assert.match(draw,/s\.gammaFlip\?\.target/);
  assert.doesNotMatch(draw,/s\.volTrigger\?\.target/);
  assert.doesNotMatch(draw,/mapStrike\(/);
  assert.match(draw,/pendingCount>0/,'live spot anchors are only consulted to resolve levels that could not yet be mapped');
});


test('Indicator exposes one Gamma Flip / Zero Gamma toggle and one chart line, without Vol Trigger', () => {
  const defs=fs.readFileSync(path.join(__dirname,'..','js','indicators-custom.js'),'utf8');
  const source=fs.readFileSync(path.join(__dirname,'..','js','cross-asset-map.js'),'utf8');
  assert.match(defs,/Gamma Flip \/ Zero Gamma \(BSM repricing\)/);
  assert.doesNotMatch(defs,/Vol Trigger/i);
  assert.doesNotMatch(defs,/\[\"volTrigger\"/);
  const draw=source.slice(source.indexOf('function drawCrossAssetMap'),source.indexOf('window.drawCrossAssetMap'));
  assert.equal((draw.match(/GAMMA FLIP \/ ZERO GAMMA/g)||[]).length,1);
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
