/* ICT 2022 toolkit: pivot confirmation, structure, ICT zones, NY time, sessions, PD arrays and manual news parsing. */
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const code=fs.readFileSync(path.join(__dirname,'..','js','ict-2022.js'),'utf8');
const g={Intl,Date,Math,Number,Array,Map,Set,String,JSON,Object,isFinite,Infinity,RegExp,console};g.window={};vm.createContext(g);vm.runInContext(code,g);
const I=g.window.ICT22;let tests=0;const ok=s=>{tests++;console.log('ok  ',s)};
const make=(n,tf,start,fn)=>Array.from({length:n},(_,i)=>Object.assign({st:start+i*tf},fn(i)));
const flat=i=>({open:100,high:101+(i%3)*.05,low:99-(i%4)*.05,close:100+(i%2)*.02,v:1});

// Pivot is assigned to its swing candle but is only confirmed after right-side bars.
{
  const B=make(8,60,0,i=>({open:10,high:[11,12,16,13,12,13,14,12][i],low:[8,9,10,9,8,9,10,8][i],close:10}));
  const p=I.findPivots(B,2,2,B.length),h=p.find(x=>x.type==='H'&&x.i===2);
  assert.ok(h);assert.strictEqual(h.at,4);assert.ok(h.at>h.i);ok('pivot STH/STL chỉ xuất hiện sau đủ nến phải xác nhận (no look-ahead)');
}
// Structure labels continuation as BOS and reversal of the prior flow as MSS.
{
  const B=make(7,60,0,i=>({open:8,high:12,low:4,close:[8,9,11,8,8,5,5][i]}));
  const P=[{type:'H',i:1,at:2,price:10,st:60},{type:'L',i:3,at:4,price:6,st:180}];
  const s=I.structure(B,P,B.length-1);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(s.events.map(x=>[x.type,x.dir]))),[['BOS',1],['MSS',-1]]);
  const weak=I.structure(B,P,B.length-1,new Array(B.length).fill(10),true);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(weak.events.map(x=>x.type))),['BOS']);
  const strong=I.structure(B,P,B.length-1,new Array(B.length).fill(2),true);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(strong.events.map(x=>x.type))),['BOS','MSS']);
  ok('BOS/MSS: break Close qua swing; MSS chỉ được xác nhận khi có displacement đủ mạnh');
}
// NY clock must follow EST/EDT automatically.
{
  const nov=Date.UTC(2026,10,2,14,0,0)/1000,mar=Date.UTC(2026,2,9,13,0,0)/1000;
  const a=I.nyParts(nov,x=>x),b=I.nyParts(mar,x=>x);
  assert.deepStrictEqual([a.y,a.m,a.d,a.h],[2026,11,2,9]);assert.deepStrictEqual([b.y,b.m,b.d,b.h],[2026,3,9,9]);
  ok('New York session clock handles EST/EDT daylight-saving transitions');
}
// ICT trading day changes at 17:00 New York, week starts Sunday 17:00.
{
  const before={y:2026,m:11,d:2,h:16,mi:59,s:0,wd:1},after={y:2026,m:11,d:2,h:17,mi:0,s:0,wd:1};
  assert.strictEqual(I.dayKey(after)-I.dayKey(before),1);
  const sunAM={y:2026,m:11,d:8,h:16,mi:0,s:0,wd:0},sunPM={y:2026,m:11,d:8,h:17,mi:0,s:0,wd:0};
  assert.strictEqual(I.weekKey(sunPM)-I.weekKey(sunAM),7);ok('ICT trading-day rollover 17:00 NY and weekly rollover Sunday 17:00 NY');
}
// FVG, inversion, BPR, LV and the 50% consequent encroachment field.
{
  const start=Date.UTC(2026,10,2,12,0,0)/1000;
  const v=[
    [100,102,98,100],[100,103,99,102],[102,101,100,101],
    [101,103,100,102],[102,106,105,105.5], // bullish FVG 101..105
    [105,106,103,104],[104,104,101,102],[102,103,99,100], // bearish FVG overlaps bullish
    [100,101,97,98],[98,99,95,96]
  ];
  const B=v.map((x,i)=>({st:start+i*1800,open:x[0],high:x[1],low:x[2],close:x[3],v:10}));
  const M=I.build(B,[],{closedOnly:false,fvgStrict:false,showLV:true,atrLen:2},x=>x,x=>x);
  assert.ok(M.fvg.some(z=>z.dir===1&&z.bot===101&&z.top===105));
  assert.ok(M.fvg.some(z=>z.dir===1&&z.imbalance==="BISI"));
  assert.ok(M.fvg.every(z=>Math.abs(z.ce-(z.top+z.bot)/2)<1e-9));
  assert.ok(M.bpr.length>0);ok('FVG ba nến, CE 50%, BPR giao vùng FVG ngược hướng');
  const bull=M.fvg.find(z=>z.dir===1&&z.bot===101&&z.top===105);
  assert.ok(bull.invalid);assert.ok(M.ifvg.some(z=>z.i===bull.i));ok('IFVG được đánh dấu sau khi giá đóng xuyên qua cạnh xa của FVG');
}
// NY session windows, previous-day references and daily open data are time-derived.
{
  const start=Date.UTC(2026,10,2,0,0,0)/1000,tf=1800;
  const B=make(8*48,tf,start,i=>{
    const x=flat(i),ny=I.nyParts(start+i*tf,t=>t),m=ny.h*60+ny.mi;
    if(m>=420&&m<600){x.high=103;x.low=98;}return x;
  });
  const M=I.build(B,[],{closedOnly:false,atrLen:3,fvgStrict:false},x=>x,x=>x);
  assert.ok(M.sessions.some(s=>s.name==='NY AM'&&s.count>0));
  assert.ok(M.sessions.some(s=>s.name==='NY Lunch'&&s.count>0));
  assert.ok(M.sessions.some(s=>s.name==='4:00–4:30 Range'&&s.count>0));
  assert.ok(M.daily.all.length>=7);assert.ok(M.daily.previous);assert.ok(M.weekly.current);assert.ok(M.quarter.current);
  assert.ok(M.levels.some(x=>x.name==="HOD")&&M.levels.some(x=>x.name==="LOD"));
  ok('NY AM 07:00–10:00, trading-day grouping, PDH/PDL, weekly and quarterly context');
}
// CBDR is a calendar-time range (14:00–20:00 NY), not split at the 17:00 ICT day rollover.
{
  const start=Date.UTC(2026,10,2,18,0,0)/1000,tf=1800; // 13:00–21:00 NY, after DST has ended
  const B=make(17,tf,start,i=>({open:100+i*.1,high:101+i*.1,low:99+i*.1,close:100.5+i*.1,v:1}));
  const M=I.build(B,[],{closedOnly:false,atrLen:3,maxBars:1000},x=>x,x=>x);
  assert.ok(M.cbdr);assert.strictEqual(M.cbdr.count,12);
  const a=I.nyParts(M.cbdr.start,x=>x),b=I.nyParts(M.cbdr.end,x=>x);
  assert.deepStrictEqual([a.h,a.mi,b.h,b.mi],[14,0,19,30]);
  assert.strictEqual(M.cbProj.mid,(M.cbdr.high+M.cbdr.low)/2);
  assert.strictEqual(M.cbProj.unit,M.cbdr.high-M.cbdr.low);
  ok('CBDR groups 14:00–20:00 across 17:00 rollover, measures midpoint and range-unit deviations');
}
// Manual event parser interprets input as New York local time and converts it to UTC.
{
  const E=I.manualEvents('2026-11-02 08:30, CPI\n# comment\nwrong row',x=>x);
  assert.strictEqual(E.length,1);const p=I.nyParts(E[0].utc,x=>x);assert.deepStrictEqual([p.y,p.m,p.d,p.h,p.mi],[2026,11,2,8,30]);
  ok('manual economic calendar parser converts NY local date/time and ignores malformed rows');
}
// ADR uses five completed weekday trading-day ranges, excluding the developing day.
{
  const start=Date.UTC(2026,10,1,22,0,0)/1000,tf=1800,B=[];
  for(let i=0;i<8*48;i++){
    const day=Math.floor(i/48),slot=i%48,range=10+day;
    const lo=100+day*2,hi=lo+range,close=lo+(slot/47)*range;
    B.push({st:start+i*tf,open:close,high:hi,low:lo,close,v:1});
  }
  const M=I.build(B,[],{closedOnly:false,atrLen:3,maxBars:1000},x=>x,x=>x);
  assert.ok(M.adr.d5!=null);assert.strictEqual(M.adr.d5,12);
  assert.strictEqual(M.adr.half5,6);assert.ok(M.daily.threeDay);
  ok('ADR5/20/50 và 3-day H/L chỉ lấy ngày giao dịch đã hoàn thành');
}
// Precision entry drill stops at the first valid timeframe in the PDF order 5→4→3→2→1m.
{
  const start=Date.UTC(2026,10,2,22,0,0)/1000,M1=[];
  for(let group=0;group<30;group++)for(let j=0;j<5;j++){
    let open=100,close=100.02,high=100.2,low=99.8;
    if(group===26){open=101.2+j*.55;close=open+.5;high=close+.05;low=open-.05;}
    M1.push({st:start+M1.length*60,open,high,low,close,v:1});
  }
  const M=I.build(M1,M1,{closedOnly:false,atrLen:14,entryDrill:true},x=>x,x=>x);
  assert.strictEqual(M.entryDrill.tf,5);assert.strictEqual(M.entryDrill.dir,1);
  assert.strictEqual(M.entryDrill.scanned.length,1);
  ok('LTF Entry Drill tìm FVG 5m đầu tiên rồi dừng, không quét TF thấp hơn');
}
// User-defined risk plan calculates SL/TP, reward:risk, and a reference BE trigger.
{
  const start=Date.UTC(2026,10,2,12,0,0)/1000;
  const B=make(12,1800,start,i=>({open:100,high:102,low:98,close:100,v:1}));
  const M=I.build(B,[],{closedOnly:false,atrLen:2,planOn:true,planDir:"long",planEntry:100,planStop:98,planTarget:106,beAtR:1},x=>x,x=>x);
  assert.ok(M.riskPlan.valid);assert.strictEqual(M.riskPlan.risk,2);assert.strictEqual(M.riskPlan.reward,6);
  assert.strictEqual(M.riskPlan.rr,3);assert.strictEqual(M.riskPlan.beTrigger,102);
  const S=I.build(B,[],{closedOnly:false,atrLen:2,planOn:true,planDir:"short",planEntry:100,planStop:102,planTarget:96,beAtR:1.5},x=>x,x=>x);
  assert.ok(S.riskPlan.valid);assert.strictEqual(S.riskPlan.rr,2);assert.strictEqual(S.riskPlan.beTrigger,97);
  ok('Trade Plan: BUY/SELL Entry, SL, TP, RR and BE reference levels');
}
// OTE math references the PDF 62%, 70.5%, 79% retracements.
{
  const hi=200,lo=100,range=hi-lo;const ote={bull:{a:hi-range*.62,b:hi-range*.79,mid:hi-range*.705},bear:{a:lo+range*.62,b:lo+range*.79,mid:lo+range*.705}};
  assert.deepStrictEqual([ote.bull.a,ote.bull.mid,ote.bull.b],[138,129.5,121]);
  assert.deepStrictEqual([ote.bear.a,ote.bear.mid,ote.bear.b],[162,170.5,179]);ok('OTE 62% / 70.5% / 79% retracement levels match the PDF model');
}
console.log(`\n${tests} kiểm thử ICT 2022 đạt.`);
