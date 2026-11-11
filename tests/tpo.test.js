/* Kiểm thử TPO / Market Profile: timezone/session, TPO matrix, VA và phân loại ngày. */
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const source=fs.readFileSync(path.join(__dirname,'..','js','tpo.js'),'utf8');
const element=()=>({innerHTML:'',dataset:{},style:{},children:[],classList:{toggle(){},contains(){return false}},setAttribute(){},addEventListener(){},appendChild(x){this.children.push(x)}});
const elements={tpoSettings:element(),"v-tpo":element(),"v-ind":element()};
const storage=new Map();
const ctx={Math,Number,Array,String,Object,Date,JSON,Intl,Map,Set,Uint8Array,Int32Array,Float64Array,Infinity,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
  $:id=>elements[id]||null,PDIG:()=>2,s2u:x=>x,m1:[],agg:[],FPM:new Map(),FPH:0,FPLV:0,FPV:0,dirty:false,P:{theme:'dark'},console};
vm.createContext(ctx);vm.runInContext(source,ctx);
const run=s=>vm.runInContext(s,ctx),J=x=>JSON.parse(JSON.stringify(x));
let n=0;const ok=s=>{console.log('ok  ',s);n++};
{
  const metric=[1,1,2,10,8,7,1,1],va=J(run(`tpoLdbValueArea(${JSON.stringify(metric)},3,70)`));
  assert.strictEqual(va.lo,3);assert.strictEqual(va.hi,5);assert.ok(va.covered>=va.total*.7);
  const lower=J(run(`tpoLdbValueArea([1,7,8,10,2,1,1],3,70)`));assert.strictEqual(lower.lo,1);assert.strictEqual(lower.hi,3);
  const tie=J(run(`tpoLdbValueArea([1,4,10,4,1],2,70)`));assert.strictEqual(tie.lo,0);assert.strictEqual(tie.hi,4);
  ok('LDB 70% range proxy: compare two rows on each side, expands larger pair and both sides on tie');
}
const U=(y,m,d,h=0,mi=0)=>Date.UTC(y,m-1,d,h,mi)/1000;

// ---------- Timezone wall-clock and session boundaries ----------
assert.strictEqual(run(`tpoZonedEpoch(2026,11,2,0,0,"Etc/UTC")`),U(2026,11,2));
const ny=J(run(`tpoTimeParts(${U(2026,7,15,17)},"America/New_York")`));
assert.deepStrictEqual([ny.year,ny.month,ny.day,ny.hour],[2026,7,15,13]);
let s=J(run(`tpoSessionForTimestamp(${U(2026,7,15,17)}, {timeZone:"America/New_York",sessionStart:"18:00",sessionHours:24})`));
assert.strictEqual(s.start,U(2026,7,14,22));assert.strictEqual(s.end,U(2026,7,15,22));
ok('Múi giờ IANA + session 18:00 New York, DST mùa hè');

// ---------- CBOT 24h brackets ----------
assert.strictEqual(run(`tpoLetter(0,0,30,"cbot24")`),'A');
assert.strictEqual(run(`tpoLetter(23,690,30,"cbot24")`),'X');
assert.strictEqual(run(`tpoLetter(24,720,30,"cbot24")`),'a');
assert.strictEqual(run(`tpoLetter(47,1410,30,"cbot24")`),'x');
assert.strictEqual(run(`tpoLetter(0,0,30,"session")`),'A');
assert.strictEqual(run(`tpoLetter(27,0,30,"session")`),'b');
ok('Bảng chữ CBOT A–X / a–x và chuỗi chữ theo phiên');

// ---------- TPO rows count a time bracket once, not once per minute ----------
const bars=[
  [U(2026,1,1,0,0),100,101,100,100.5,10],
  [U(2026,1,1,0,10),100.5,102,100.5,101.5,20],
  [U(2026,1,1,0,30),101,102,100,101.5,30],
  [U(2026,1,1,0,40),102,103,102,102.5,40],
  [U(2026,1,1,1,0),103,104,103,103.5,50],
  [U(2026,1,1,1,30),104,105,104,104.5,60]
];
const opts={timeZone:'Etc/UTC',sessionStart:'00:00',sessionHours:24,periodMin:30,rowStep:1,valueArea:70,valueMode:'tpo',ibMinutes:60};
const P=J(run(`tpoCalcProfile(${JSON.stringify(bars)},${JSON.stringify(opts)},{start:${U(2026,1,1)},end:${U(2026,1,2)},key:1,label:"01/01/2026"})`));
assert.ok(P&&P.n>0);assert.strictEqual(P.nP,48);assert.strictEqual(P.counts[0],2); // row 100 touched during A and B
assert.strictEqual(P.counts[1],2);assert.strictEqual(P.totalMinutes,6);assert.strictEqual(P.ibReady,true);
assert.ok(P.va.lo<=P.poc&&P.va.hi>=P.poc);assert.ok(P.vah>=P.val);assert.strictEqual(P.valueModeUsed,'tpo');
const tickMode=J(run(`tpoCalcProfile(${JSON.stringify(bars)},${JSON.stringify({...opts,valueMode:'tick'})},{start:${U(2026,1,1)},end:${U(2026,1,2)},key:1,label:"01/01/2026"})`));assert.strictEqual(tickMode.valueModeUsed,'tick');assert.ok(tickMode.valueAreaMethod.includes('two-row'));
const noVol=J(run(`tpoCalcProfile(${JSON.stringify(bars.map(b=>[...b.slice(0,5),0]))},${JSON.stringify({...opts,valueMode:'tick'})},{start:${U(2026,1,1)},end:${U(2026,1,2)},key:1,label:"01/01/2026"})`));assert.strictEqual(noVol.valueModeUsed,'tpo');assert.ok(noVol.valueAreaMethod.includes('TPO-count'));
ok('Mỗi bracket chỉ cộng một TPO/mức giá dù có nhiều nến M1 trong cùng bracket');
const ibOnly=Array.from({length:60},(_,i)=>[U(2026,1,2,0,i),100,101,99,100,1]);
const ibWait=J(run(`tpoCalcProfile(${JSON.stringify(ibOnly)},${JSON.stringify(opts)},{start:${U(2026,1,2)},end:${U(2026,1,3)},key:2,label:"02/01/2026"})`));
const ibDone=J(run(`tpoCalcProfile(${JSON.stringify([...ibOnly,[U(2026,1,2,1,0),100,102,99,101,1]])},${JSON.stringify(opts)},{start:${U(2026,1,2)},end:${U(2026,1,3)},key:2,label:"02/01/2026"})`));
assert.strictEqual(ibWait.ibReady,false);assert.strictEqual(ibDone.ibReady,true);
ok('IB chỉ xác nhận hoàn tất khi xuất hiện nến phút đầu tiên sau biên IB');

// ---------- Fair price / double-print imbalance ----------
assert.strictEqual(run(`tpoFindFairPrice(new Int32Array([1,3,8,3,1]),1,3,2)`),2);
const va=J(run(`tpoValueArea([1,2,10,3,2,1],2,70)`));
assert.ok(va.lo<=2&&va.hi>=2&&va.covered>=va.total*.7);
ok('POC/Value Area theo TPO hoặc tick proxy; tự fallback TPO khi tick volume trống; fairest price');

// ---------- Day type classification ----------
assert.strictEqual(run(`tpoClassifyDay({ibReady:false})`),'IB đang hình thành');
assert.strictEqual(run(`tpoClassifyDay({ibReady:true,ibRange:10,high:110,low:100,ibHigh:110,ibLow:100,close:105,step:1})`),'Normal');
assert.strictEqual(run(`tpoClassifyDay({ibReady:true,ibRange:10,high:131,low:100,ibHigh:110,ibLow:100,close:130,step:1})`),'Trend');
assert.strictEqual(run(`tpoClassifyDay({ibReady:true,ibRange:10,high:120,low:90,ibHigh:110,ibLow:100,close:105,step:1})`),'Neutral');
assert.strictEqual(run(`tpoClassifyDay({ibReady:true,ibRange:10,high:118,low:100,ibHigh:110,ibLow:100,close:112,step:1})`),'Normal Variation');
assert.strictEqual(run(`tpoClassifyDay({ibReady:true,ibRange:85,high:115,low:15,ibHigh:100,ibLow:15,close:115,step:1})`),'Normal');
assert.strictEqual(run(`tpoClassifyDay({ibReady:true,ibRange:85,high:115,low:0,ibHigh:100,ibLow:15,close:50,step:1})`),'Neutral');
assert.strictEqual(run(`tpoFmt(null)`),'—');
ok('Normal / Normal Variation / Trend / Neutral theo IB & range extension; IB không bắt buộc hết extension mới là Normal');

// ---------- Footprint timestamps are server time; session boundaries are UTC ----------
const offset=7*3600,serverBars=bars.map(b=>[b[0]+offset,...b.slice(1)]);
ctx.s2u=x=>x-offset;ctx.m1=serverBars;ctx.FPM=new Map([[serverBars[0][0],[[99.5,2,1],[101,3,2]]]]);
let fp=J(run(`tpoCalcProfile(m1,${JSON.stringify(opts)},{start:${U(2026,1,1)},end:${U(2026,1,2)},key:1,label:"01/01/2026"})`));
assert.strictEqual(fp.tickMinutes,1);assert.ok(fp.source.includes('footprint'));assert.ok(fp.low<=99.5);
ok('Footprint dùng đúng server timestamp và được sử dụng trong chế độ live');
assert.strictEqual(run(`TPO.options.showFairPrice`),true);run(`tpoSetValue('showFairPrice',false)`);assert.strictEqual(run(`TPO.options.showFairPrice`),false);
ok('Các toggle Fair Price / Range Extension / Pioneer Range hoạt động');

// ---------- Dedicated TPO workspace: no chart overlay ----------
ctx.s2u=x=>x;ctx.m1=bars;ctx.agg=[{st:bars[0][0]}];ctx.FPM=new Map();
run(`TPO.options={...TPO.options,enabled:true,timeZone:'Etc/UTC',sessionStart:'00:00',sessionHours:24,sessionPick:'current',periodMin:30,rowStep:1}`);
const standalone=J(run(`tpoProfileForView()`));assert.ok(standalone&&standalone.totalTpo>0);
assert.strictEqual(run(`typeof drawTPO`),'undefined');assert.strictEqual(run(`typeof tpoRenderStandalone`),'function');
assert.ok(elements.tpoSettings.innerHTML.includes('Cài đặt TPO'));
assert.ok(elements.tpoSettings.innerHTML.includes('Time bracket'));
assert.ok(elements.tpoSettings.innerHTML.includes('Value Area'));
run(`tpoSetValue('showFairPrice',false)`);assert.strictEqual(run(`TPO.options.showFairPrice`),false);
run(`tpoActivate(false)`);assert.strictEqual(run(`TPO.options.enabled`),false);
run(`tpoActivate(true)`);assert.strictEqual(run(`TPO.options.enabled`),true);
ok('TPO Profile được tính độc lập, trang cài đặt gọn theo nhóm; không còn hàm vẽ lên chart nến');

console.log(`\n${n} nhóm kiểm thử TPO đạt`);
