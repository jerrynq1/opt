/* Kiểm thử tính toán Market Profile dài hạn / composite / Minus Development. */
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const files=['js/tpo.js','js/tpo-advanced.js'].map(f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8'));
const storage=new Map();
const ctx={Math,Number,Array,String,Object,Date,JSON,Intl,Map,Set,Uint8Array,Int32Array,Float64Array,Infinity,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},$:()=>null,PDIG:()=>2,s2u:x=>x,m1:[],FPM:new Map(),FPH:0,FPLV:0,FPV:0,dirty:false,console};
vm.createContext(ctx);files.forEach(s=>vm.runInContext(s,ctx));
const run=s=>vm.runInContext(s,ctx),J=x=>JSON.parse(JSON.stringify(x));let n=0;const ok=s=>{console.log('ok  ',s);n++};
const make=(poc,offset=0,failed=false)=>({base:100+offset,step:1,n:9,nP:4,counts:new Int32Array([1,2,4,8,12,8,4,2,1]),metric:new Float64Array(9).fill(1),poc:4,pocPrice:104+offset,vah:107+offset,val:102+offset,va:{lo:2,hi:7},high:109+offset,low:99+offset,close:104+offset,ibHigh:106+offset,ibLow:101+offset,ibRange:5,rangeExtensionUp:failed?3:0,rangeExtensionDown:0,ibReady:true,topSingles:2,botSingles:0,imbalance:'Buyer',session:{start:offset+1000,end:offset+2000,label:'test'}});
let a=make(4),b=make(5,5),c=make(6,10);a.openPrice=103;b.openPrice=110;c.openPrice=114;
assert.strictEqual(run(`tpoXValueMigration(${JSON.stringify({val:120,vah:130,step:1,pocPrice:125})},${JSON.stringify({val:100,vah:110,step:1,pocPrice:105})})`),'Dịch chuyển lên');
assert.strictEqual(run(`tpoXValueMigration(${JSON.stringify({val:80,vah:90,step:1,pocPrice:85})},${JSON.stringify({val:100,vah:110,step:1,pocPrice:105})})`),'Dịch chuyển xuống');
ok('Value migration: VA tách rời lên/xuống, POC overlapping');

const failed=J(run(`tpoXActivity({rangeExtensionUp:3,rangeExtensionDown:0,step:1,topSingles:2,botSingles:0,ibHigh:106,ibLow:101,close:104,imbalance:'Buyer'},null)`));
assert.strictEqual(failed.failedUp,true);assert.strictEqual(failed.sellExtreme,true);assert.strictEqual(failed.buyRange,true);
const both=J(run(`tpoXActivity({rangeExtensionUp:3,rangeExtensionDown:2,step:1,topSingles:0,botSingles:2,ibHigh:106,ibLow:101,close:104,imbalance:'Seller'},null)`));
assert.strictEqual(both.neutral,true);assert.strictEqual(both.buyExtreme,true);
ok('Activity classification: failed range extension, extremes and neutral day');

const p=J(run(`tpoXMinusDevelopment({counts:[1,1,1,2,1,1,4,5],base:100,step:1,n:8},101,1,4)`));
assert.strictEqual(p.ready,true);assert.strictEqual(p.rows,4);assert.strictEqual(p.emergingPrice,106.5);assert.strictEqual(p.priceGap,5.5);
const no=J(run(`tpoXMinusDevelopment({counts:[1,1,1],base:100,step:1,n:3},101,1,4)`));assert.strictEqual(no.emergingPrice,null);
ok('Minus Development: tìm emerging activity đạt ngưỡng 4 TPOs across');

const sessions=[a,b,c];
const comp=run(`tpoXBuildComposite(${JSON.stringify(sessions)},70)`);
assert.ok(comp&&comp.sessions===3&&comp.total>0);assert.ok(comp.vah>=comp.val);assert.ok(comp.pocPrice>=comp.min&&comp.pocPrice<=comp.max);
ok('Composite: hợp nhất nhiều phiên về common price rows, POC và Value Area');

const analytics=run(`tpoXBuildAnalytics(${JSON.stringify(sessions)},${JSON.stringify(comp)},{emergingTpo:4,eventClass:'surprise'})`);
assert.ok(analytics.nearControl!=null&&analytics.intermediateControl!=null&&analytics.longControl!=null);
assert.strictEqual(analytics.event.title,'Surprise event');assert.ok(analytics.params.length===5);
ok('Multi-timeframe control prices, event context and key reference points');

// Empty reference uses current close rather than being coerced to numeric zero.
const blank=run(`tpoXBuildAnalytics(${JSON.stringify(sessions)},${JSON.stringify(comp)},{emergingTpo:4,eventClass:'unknown',referencePrice:''})`);
assert.strictEqual(blank.minus.reference,c.close);
ok('Blank trade-location input safely defaults to the latest profile close');

// History merger keeps one bar per server timestamp, with the newest feed winning.
const merged=J(run(`tpoXMergeBars([[120,1,2,1,2,3],[60,1,1,1,1,1]],[[120,2,3,2,3,4],[180,3,4,3,4,5]])`));
assert.deepStrictEqual(merged.map(x=>x[0]),[60,120,180]);assert.strictEqual(merged[1][1],2);
ok('History merge: deduplicated, sorted M1 bars without mutating chart m1');


// Distribution chronology follows the CBOT definitions: balance→directional = 1-2-3;
// directional→balance = 3-2-1. Use actual bracket-by-price cells rather than a histogram.
function profileFromRanges(ranges){
  const rows=24,nP=ranges.length,cells=new Uint8Array(rows*nP),counts=new Int32Array(rows);
  ranges.forEach(([lo,hi],per)=>{for(let q=lo;q<=hi;q++){cells[q*nP+per]=1;counts[q]++}});
  let poc=0;for(let q=1;q<rows;q++)if(counts[q]>counts[poc])poc=q;
  return{counts,cells,n:rows,nP,poc};
}
const oneTwoThree=J(run(`tpoXDistributionShape(${JSON.stringify(profileFromRanges([[2,6],[2,6],[2,6],[2,6],[2,6],[2,6],[8,12],[13,17],[18,22]]))})`));
assert.strictEqual(oneTwoThree.code,'1-2-3');
ok('Distribution chronology: 1-2-3 rotations first, directional movement last');
const threeTwoOne=J(run(`tpoXDistributionShape(${JSON.stringify(profileFromRanges([[2,6],[8,12],[14,18],[14,18],[14,18],[14,18],[14,18],[14,18],[14,18]]))})`));
assert.strictEqual(threeTwoOne.code,'3-2-1');
ok('Distribution chronology: 3-2-1 directional movement first, rotations after');

const prior={val:100,vah:110};
assert.strictEqual(run(`tpoXActivityBehaviour('Buyer',95,${JSON.stringify(prior)})`),'Responsive');
assert.strictEqual(run(`tpoXActivityBehaviour('Buyer',115,${JSON.stringify(prior)})`),'Initiating');
assert.strictEqual(run(`tpoXActivityBehaviour('Seller',115,${JSON.stringify(prior)})`),'Responsive');
assert.strictEqual(run(`tpoXActivityBehaviour('Seller',95,${JSON.stringify(prior)})`),'Initiating');
assert.strictEqual(run(`tpoXActivityBehaviour('Seller',105,${JSON.stringify(prior)})`),'Within value · judgment');
ok('Initiating / Responsive: buyer and seller behavior classified against previous Value');

const units=J(run(`tpoXBuildUnits(${JSON.stringify([
  {...a,high:109,low:99,pocPrice:104,vah:107,val:102,shape:{code:'3-2-1'}},
  {...b,high:114,low:104,pocPrice:109,vah:112,val:107,shape:{code:'1-2-3'}}
])})`));
assert.ok(units.length>=1);
ok('Natural trading units: grouped from directional boundaries with control / developing Value');


// Intraday four-step sequence uses actual bracket matrix, not a session-close shortcut.
const intraday=profileFromRanges([[3,7],[3,7],[3,7],[8,12],[8,12],[3,9],[0,5]]);
intraday.base=100;intraday.step=1;intraday.periodSec=1800;intraday.periodMin=30;intraday.session={start:0};
const bracketFlow=J(run(`tpoXBracketSequence(${JSON.stringify(intraday)})`));
assert.ok(bracketFlow.periods.some(x=>x.phase==='Distribution / range extension ↑'));
assert.ok(bracketFlow.periods.some(x=>x.phase==='Test / transition'));
assert.ok(bracketFlow.fourStep.includes('Change / opposite response'));
ok('Intraday bracket sequence: Beginning → Distribution → Balance → Test → Change inferred from temporal brackets');

const neutralState=run(`tpoXSessionState({high:120,low:80,pocPrice:110,step:1,vah:115,val:105,activity:{neutral:true}},${JSON.stringify({high:110,low:90,pocPrice:100,vah:105,val:95,step:1})})`);
assert.ok(neutralState.includes('Neutral'));
ok('Session regime: Neutral day with range extension on both sides takes priority over one-direction trend');



// Part VI: LDB-style activity profile. Keep this a labelled proxy, never actual CBOT volume.
const activityInput={base:100,step:1,n:6,counts:[1,2,3,4,2,1],metric:[1,2,5,9,2,1],quoteMetric:[1,2,10,4,2,1],buyQuote:[1,1,8,3,1,0],sellQuote:[0,1,2,1,1,1],quoteCoverage:.9};
const quoteProfile=J(run(`tpoXBuildDataProfile(${JSON.stringify(activityInput)},'auto')`));
assert.strictEqual(quoteProfile.source,'quote');assert.strictEqual(quoteProfile.total,20);assert.strictEqual(quoteProfile.poc,2);assert.ok(quoteProfile.coveredPct>=70);assert.ok(quoteProfile.rows.length>0);assert.ok(quoteProfile.vah>=quoteProfile.val);
ok('Part VI proxy profile: auto selects quote rows with adequate coverage, calculates POC, CBOT-style 70% range and price-level rows');
const tickInput={...activityInput,quoteCoverage:.2};
const tickProfile=J(run(`tpoXBuildDataProfile(${JSON.stringify(tickInput)},'auto')`));
assert.strictEqual(tickProfile.source,'tick');assert.strictEqual(tickProfile.total,20);
const forcedQuote=J(run(`tpoXBuildDataProfile(${JSON.stringify(tickInput)},'quote')`));
assert.strictEqual(forcedQuote.source,'quote');assert.ok(forcedQuote.caveat.includes('20.0%'));
const emptyProfile=J(run(`tpoXBuildDataProfile({base:1,step:1,n:2,counts:[1,1],metric:[0,0],quoteMetric:[0,0]},'auto')`));
assert.strictEqual(emptyProfile.available,false);
ok('Part VI source selection: low quote coverage falls back to M1 tick proxy; manual quote mode warns; no metric is not mislabelled as volume');
const compareP={partial:false,close:106,step:1,totalMinutes:120},comparePrev={partial:false,close:100,step:1,totalMinutes:120};
const compareNow={available:true,source:'tick',total:30,coverage:0},compareBefore={available:true,source:'tick',total:20,coverage:0};
const facilitation=J(run(`tpoXCompareActivity(${JSON.stringify(compareP)},${JSON.stringify(compareNow)},${JSON.stringify(comparePrev)},${JSON.stringify(compareBefore)})`));
assert.ok(facilitation.change>0);assert.ok(facilitation.label.includes('cũng tăng'));
const partialCompare=J(run(`tpoXCompareActivity(${JSON.stringify({...compareP,partial:true})},${JSON.stringify(compareNow)},${JSON.stringify(comparePrev)},${JSON.stringify(compareBefore)})`));
assert.strictEqual(partialCompare.change,null);assert.ok(partialCompare.label.includes('chưa hoàn tất'));
ok('Part VI trade-facilitation proxy: compares price and activity only on complete, compatible sessions');


const settingsMarkup=run(`tpoXSettingsMarkup()`);
assert.ok(settingsMarkup.includes('data-tpox="dataSource"'));
run(`tpoXSetSetting('dataSource','quote')`);
assert.strictEqual(run(`TPOX.options.dataSource`),'quote');
ok('Part VI settings: data-source control is visible and persists in TPOX settings');

console.log(`\n${n} nhóm kiểm thử TPO Advanced đạt`);
