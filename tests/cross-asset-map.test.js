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
  gexLevels:[{rank:1,strike:658,gex:120},{rank:2,strike:656,gex:-90}],
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

test('GEX ladder excludes only Gamma walls and retains OI wall strikes', () => {
  const mapped=math.buildMappedMap(snap({
    gexCallWall:{strike:662,gex:9000},
    gexPutWall:{strike:660,gex:-8000},
    gexLevels:[
      {rank:1,strike:662,gex:9000}, // GEX CW
      {rank:2,strike:660,gex:-8000}, // GEX PW
      {rank:3,strike:652,gex:700}, // Call OI Wall must stay eligible
      {rank:4,strike:640,gex:-600}, // Put OI Wall must stay eligible
      {rank:5,strike:658,gex:500}
    ]
  }),652,4545,null,1500);
  assert.deepEqual(mapped.gexLevels.map(x=>x.strike),[652,640,658]);
  assert.deepEqual(mapped.gexLevels.map(x=>x.rank),[1,2,3]);
  assert.ok(!mapped.gexLevels.some(x=>x.strike===mapped.gexCallWall.sourceLevel));
  assert.ok(!mapped.gexLevels.some(x=>x.strike===mapped.gexPutWall.sourceLevel));
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
    callOIWall:{strike:653,oi:70},
    putOIWall:{strike:640,oi:41},
    gexCallWall:{strike:663,gex:600},
    gexPutWall:{strike:660,gex:-200},
    gammaFlip:656,
    maxPain:{strike:651,payout:950},
    gexLevels:[{rank:1,strike:659,gex:300},{rank:2,strike:656,gex:-120}]
  }),660,4600,first,2500);
  const ratio=4600/660;
  assert.equal(updated.callOIWall.target,653*ratio);
  assert.equal(updated.putOIWall.target,first.putOIWall.target,'unchanged Put OI Wall remains fixed');
  assert.equal(updated.gexCallWall.target,663*ratio,'changed GEX CW remaps independently');
  assert.equal(updated.gexPutWall.target,first.gexPutWall.target,'unchanged GEX PW remains fixed');
  assert.equal(updated.gammaFlip.target,656*ratio,'changed Zero Gamma / Vol Trigger remaps once');
  assert.equal(updated.maxPain.target,651*ratio);
  assert.equal(updated.gexLevels[0].target,659*ratio);
  assert.equal(updated.gexLevels[1].target,first.gexLevels[1].target,'unchanged GEX rank 2 remains fixed');
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
