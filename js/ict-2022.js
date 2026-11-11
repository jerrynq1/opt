/*
 * ICT 2022 Mentorship — Multi-Layer Toolkit v1.3.0 (PDF-derived implementation + compact UI)
 * Tích hợp cho Gexadecimal QuantLab. Không phải một indicator BUY/SELL duy nhất.
 * Engine độc lập ICT22.build() dùng OHLC + timestamp; drawICT() chỉ là lớp vẽ cho chart.
 * Lưu ý: các cấu trúc "institutional" được suy luận từ OHLC/time, không quan sát được lệnh của ngân hàng/dealer.
 */
(function (root) {
  "use strict";
  const DAY = 86400, MIN = 60;
  const NY = (() => {
    try { return new Intl.DateTimeFormat("en-US", {timeZone:"America/New_York", year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", second:"2-digit", weekday:"short", hourCycle:"h23"}); }
    catch (_) { return null; }
  })();
  const NYC = new Map();
  const n = x => Number.isFinite(+x) ? +x : 0;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const mean = a => a.length ? a.reduce((s,x)=>s+x,0)/a.length : 0;
  const stdev = a => { if(a.length<2)return 0;const m=mean(a);return Math.sqrt(a.reduce((s,x)=>s+(x-m)*(x-m),0)/(a.length-1)); };
  const minmax = (a, f) => { let lo=Infinity,hi=-Infinity; for(const x of a){const v=f(x);if(v<lo)lo=v;if(v>hi)hi=v;} return lo===Infinity?null:{low:lo,high:hi}; };
  const clone = x => JSON.parse(JSON.stringify(x));
  function nyParts(st, toUTC) {
    const u = typeof toUTC === "function" ? toUTC(st) : st;
    const key = Math.round(u);
    if (NYC.has(key)) return NYC.get(key);
    let p;
    if (NY) {
      const o = {};
      for (const q of NY.formatToParts(new Date(u*1000))) if(q.type!=="literal")o[q.type]=q.value;
      const wd = ({Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6})[o.weekday] ?? 0;
      p={y:+o.year,m:+o.month,d:+o.day,h:+o.hour%24,mi:+o.minute,s:+o.second,wd};
    } else {
      const d=new Date(u*1000);p={y:d.getUTCFullYear(),m:d.getUTCMonth()+1,d:d.getUTCDate(),h:d.getUTCHours(),mi:d.getUTCMinutes(),s:d.getUTCSeconds(),wd:d.getUTCDay()};
    }
    if(NYC.size>220000)NYC.clear();NYC.set(key,p);return p;
  }
  const wallSec = p => Date.UTC(p.y,p.m-1,p.d,p.h,p.mi,p.s)/1000;
  const dayKey = p => Math.floor((wallSec(p)-17*3600)/DAY); // ICT trading day: 17:00 NY -> 17:00 NY
  const weekKey = p => {
    const midnight=Date.UTC(p.y,p.m-1,p.d)/1000;
    let back=p.wd; if(p.wd===0&&p.h<17)back=7;
    return Math.floor((midnight-back*DAY)/DAY); // Sunday date of week; rollover Sunday 17:00
  };
  const dateKey = p => p.y*10000+p.m*100+p.d;
  function atrOf(B, len) {
    const a=new Array(B.length).fill(null),tr=[];let sum=0;
    for(let i=0;i<B.length;i++){
      const b=B[i],pc=i?B[i-1].close:b.open;
      const v=Math.max(b.high-b.low,Math.abs(b.high-pc),Math.abs(b.low-pc));tr.push(v);sum+=v;
      if(i>=len)sum-=tr[i-len];if(i>=len-1)a[i]=sum/len;
    }
    return a;
  }
  function findPivots(B, left=2, right=2, end=B.length-1) {
    const out=[];for(let i=left;i<end-right;i++){
      const b=B[i];let H=true,L=true;
      for(let j=i-left;j<=i+right;j++){if(j===i)continue;if(B[j].high>=b.high)H=false;if(B[j].low<=b.low)L=false;if(!H&&!L)break;}
      if(H)out.push({type:"H",i,at:i+right,price:b.high,st:b.st});
      if(L)out.push({type:"L",i,at:i+right,price:b.low,st:b.st});
    }
    return out.sort((a,b)=>a.at-b.at||a.i-b.i);
  }
  function classifyPivots(pivots) {
    const hs=pivots.filter(x=>x.type==="H"),ls=pivots.filter(x=>x.type==="L");
    for(const p of hs)p.tier="STH";
    for(const p of ls)p.tier="STL";
    for(let i=0;i<hs.length;i++){
      if(i>0)hs[i].swing=hs[i].price>hs[i-1].price?"HH":"LH";
      if(i>0&&i<hs.length-1&&hs[i-1].price<hs[i].price&&hs[i+1].price<hs[i].price)hs[i].tier="ITH";
    }
    for(let i=0;i<ls.length;i++){
      if(i>0)ls[i].swing=ls[i].price>ls[i-1].price?"HL":"LL";
      if(i>0&&i<ls.length-1&&ls[i-1].price>ls[i].price&&ls[i+1].price>ls[i].price)ls[i].tier="ITL";
    }
    const itH=hs.filter(x=>x.tier==="ITH"),itL=ls.filter(x=>x.tier==="ITL");
    for(let i=1;i<itH.length-1;i++)if(itH[i-1].price<itH[i].price&&itH[i+1].price<itH[i].price)itH[i].tier="LTH";
    for(let i=1;i<itL.length-1;i++)if(itL[i-1].price>itL[i].price&&itL[i+1].price>itL[i].price)itL[i].tier="LTL";
    return pivots;
  }
  function structure(B, pivots, end, atr, requireMssDisplacement=false) {
    const out=[],last={H:null,L:null},trend=0,active={H:0,L:0};let dir=trend;
    const at={};for(const p of pivots)(at[p.at]||(at[p.at]=[])).push(p);
    const hasDisplacement=(b,i,d)=>{const a=atr&&atr[i]||Math.max(1e-9,b.close*.001),r=b.high-b.low,body=Math.abs(b.close-b.open),loc=r>0?(b.close-b.low)/r:.5;return body>=a*.7&&r>=a*1.05&&(d>0?loc>=.72:loc<=.28);};
    for(let i=0;i<=end;i++){
      for(const p of at[i]||[])last[p.type]=p;
      const b=B[i],prev=i?B[i-1]:b;
      if(last.H&&active.H!==last.H.at&&prev.close<=last.H.price&&b.close>last.H.price){const type=dir<0?"MSS":"BOS";
        if(type!=="MSS"||!requireMssDisplacement||hasDisplacement(b,i,1)){out.push({i,dir:1,type,level:last.H.price,ref:last.H});dir=1;active.H=last.H.at;}}
      if(last.L&&active.L!==last.L.at&&prev.close>=last.L.price&&b.close<last.L.price){const type=dir>0?"MSS":"BOS";
        if(type!=="MSS"||!requireMssDisplacement||hasDisplacement(b,i,-1)){out.push({i,dir:-1,type,level:last.L.price,ref:last.L});dir=-1;active.L=last.L.at;}}
    }
    return {events:out,trend:dir,last};
  }
  function periodGroups(A, toUTC, kind) {
    const M=new Map();
    for(const x of A){const p=nyParts(x.st,toUTC),k=kind==="D"?dayKey(p):kind==="W"?weekKey(p):p.y*100+p.m;
      let g=M.get(k);if(!g){g={key:k,open:x.open,high:x.high,low:x.low,close:x.close,start:x.st,end:x.st,n:0};M.set(k,g)}
      g.high=Math.max(g.high,x.high);g.low=Math.min(g.low,x.low);g.close=x.close;g.end=x.st;g.n++;
    }
    return [...M.values()].sort((a,b)=>a.start-b.start);
  }
  function timeframeGroups(A,toUTC,tf) {
    const M=new Map();
    for(const x of A){const p=nyParts(x.st,toUTC),k=Math.floor((wallSec(p)-17*3600)/tf);let g=M.get(k);
      if(!g){g={st:x.st,open:x.open,high:x.high,low:x.low,close:x.close,v:x.v||0};M.set(k,g)}
      else{g.high=Math.max(g.high,x.high);g.low=Math.min(g.low,x.low);g.close=x.close;g.v+=x.v||0;}
    }
    return [...M.values()].sort((a,b)=>a.st-b.st);
  }
  function sessionGroups(A,toUTC) {
    const defs=[
      ["Asia",20*60,24*60],
      ["London KZ",2*60,5*60],["London Session",2*60,7*60],
      ["4:00–4:30 Range",4*60,4*60+30],
      ["NY AM",7*60,10*60],
      ["London Close",10*60,12*60],["NY Lunch",12*60,13*60],
      ["NY PM",14*60,16*60],
      ["CBDR",14*60,20*60]
    ];
    const M=new Map();
    for(const x of A){const p=nyParts(x.st,toUTC),m=p.h*60+p.mi,dk=dayKey(p);
      for(const [name,a,b] of defs)if(m>=a&&m<b){const sk=name==="CBDR"?dateKey(p):dk,k=name+"|"+sk;let g=M.get(k);
        if(!g){g={name,day:dk,start:x.st,end:x.st,open:x.open,high:x.high,low:x.low,close:x.close,count:0,active:true};M.set(k,g)}
        g.end=x.st;g.high=Math.max(g.high,x.high);g.low=Math.min(g.low,x.low);g.close=x.close;g.count++;
      }
    }
    return [...M.values()].sort((a,b)=>a.start-b.start);
  }
  function eqPools(pivots, B, tolATR, atr) {
    const out=[];for(const typ of ["H","L"]){const P=pivots.filter(x=>x.type===typ).slice(-220);const used=new Set();
      for(let i=0;i<P.length;i++){if(used.has(i))continue;const base=P[i],t=(atr[Math.min(B.length-1,base.at)]||base.price*.001)*tolATR;const g=[base];
        for(let j=i+1;j<P.length;j++)if(Math.abs(P[j].price-base.price)<=Math.max(t,(atr[Math.min(B.length-1,P[j].at)]||t)*tolATR)){g.push(P[j]);used.add(j)}
        if(g.length>=2){const price=mean(g.map(x=>x.price));out.push({type:typ==="H"?"EQH":"EQL",dir:typ==="H"?-1:1,sweepDir:typ==="H"?-1:1,targetDir:typ==="H"?1:-1,price,st:g[0].st,i:g[0].i,last:g[g.length-1].i,count:g.length,pivots:g});}
      }
    }
    return out;
  }
  function zoneStatus(B, i, top, bot, dir, end) {
    let touched=false,filled=false,invalid=false,mitAt=null;
    for(let j=i+1;j<=end;j++){
      const b=B[j],hit=b.low<=top&&b.high>=bot;
      if(hit&&!touched){touched=true;mitAt=j;}
      if(dir===1){if(b.low<=bot)filled=true;if(b.close<bot){invalid=true;break}}
      else{if(b.high>=top)filled=true;if(b.close>top){invalid=true;break}}
    }
    return {touched,filled,invalid,mitAt};
  }
  function manualEvents(text, fromUTC) {
    const out=[];for(const raw of String(text||"").split(/\r?\n/)){
      const s=raw.trim();if(!s||s.startsWith("#")||s.startsWith("//"))continue;
      const m=/^(\d{4})-(\d\d)-(\d\d)\s+(\d\d):(\d\d)\s*(?:,|\|)\s*(.*)$/.exec(s);if(!m)continue;
      const wall=Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5]);let utc=wall/1000;
      for(let k=0;k<3;k++){const o=nyParts(utc,x=>x);const off=(Date.UTC(o.y,o.m-1,o.d,o.h,o.mi,o.s)-utc*1000)/1000;utc=wall/1000-off;}
      out.push({utc,st:typeof fromUTC==="function"?fromUTC(utc):utc,label:m[6]||"Tin tức",date:m[1]+"-"+m[2]+"-"+m[3],time:m[4]+":"+m[5]});
    }
    return out.sort((a,b)=>a.st-b.st);
  }
  function build(B0, M10, Q0, toUTC, fromUTC) {
    const Q=Q0||{},B=(B0||[]).slice(-Math.max(500,+Q.maxBars||6000));
    const M1=(M10||[]).slice(-Math.max(1000,+Q.maxM1||140000));
    const end=Math.max(-1,B.length-(Q.closedOnly===false?0:1)-1),src=(M1.length?M1:B0||[]);
    const mEnd=Math.max(-1,src.length-(Q.closedOnly===false?0:1)-1);
    if(B.length<8||end<3)return {empty:true,B:[],end,atr:[],pivots:[],structure:{events:[],trend:0,last:{}},zones:[],fvg:[],levels:[],sessions:[],news:[],bias:{dir:0,label:"Trung tính",reason:"Chưa đủ dữ liệu"}};
    const G=B.slice(0,end+1),atr=atrOf(G,Math.max(2,+Q.atrLen||14));
    const pivots=classifyPivots(findPivots(G,+Q.pivotL||2,+Q.pivotR||2,G.length));
    const stc=structure(G,pivots,G.length-1,atr,true),last=G[G.length-1],lastATR=atr[atr.length-1]||last.close*.001;
    const eq=eqPools(pivots,G,+Q.eqTol||.08,atr);
    // FVG / LV / VI — 3-candle imbalance; confirmed candles only.
    const fvg=[];for(let i=2;i<G.length;i++){
      const a=G[i-2],c=G[i],bull=c.low>a.high,bear=c.high<a.low;
      if(!bull&&!bear)continue;const dir=bull?1:-1,top=bull?c.low:a.low,bot=bull?a.high:c.high;
      if(top<=bot)continue;const size=top-bot,disp=atr[i]||lastATR;
      if(Q.fvgStrict!==false&&size<disp*(+Q.fvgATR||.08))continue;
      const z={type:"FVG",dir,imbalance:dir>0?"BISI":"SIBI",top,bot,ce:(top+bot)/2,size,i,st:c.st,lv:size>disp*(+Q.lvATR||1.25)};
      Object.assign(z,zoneStatus(G,i,top,bot,dir,G.length-1));z.type=z.lv&&Q.showLV!==false?"LV":"FVG";fvg.push(z);
    }
    // Inversion FVG (IFVG): a prior FVG closed through its far boundary.
    const ifvg=fvg.filter(z=>z.invalid).map(z=>({...z,type:"IFVG",dir:-z.dir,invalid:true}));
    // Balanced Price Range = price intersection of an opposing bullish and bearish FVG.
    const bpr=[];for(let i=Math.max(0,fvg.length-90);i<fvg.length;i++)for(let j=i+1;j<fvg.length;j++){
      const a=fvg[i],b=fvg[j];if(a.dir===b.dir||Math.abs(a.i-b.i)>120)continue;
      const top=Math.min(a.top,b.top),bot=Math.max(a.bot,b.bot);if(top>bot)bpr.push({type:"BPR",dir:0,top,bot,ce:(top+bot)/2,i:Math.max(a.i,b.i),st:Math.max(a.st,b.st)});
    }
    // Volume imbalance (VI) proxy: body-to-body gap between adjacent candles, OHLC-only.
    const vi=[];for(let i=1;i<G.length;i++){const a=G[i-1],b=G[i];let top,bot,dir;
      if(Math.min(a.open,a.close)>Math.max(b.open,b.close)){top=Math.min(a.open,a.close);bot=Math.max(b.open,b.close);dir=-1;}
      else if(Math.max(a.open,a.close)<Math.min(b.open,b.close)){top=Math.min(b.open,b.close);bot=Math.max(a.open,a.close);dir=1;}
      else continue;if(top>bot)vi.push({type:"VI",dir,top,bot,ce:(top+bot)/2,i,st:b.st});}
    // Order blocks tied to structure breaks; invalidated OB becomes a Breaker Block.
    const blocks=[];for(const e of stc.events){let j=e.i-1,found=null;for(;j>=Math.max(0,e.i-12);j--){const b=G[j];if((e.dir===1&&b.close<b.open)||(e.dir===-1&&b.close>b.open)){found={i:j,st:b.st,top:Q.obWick===false?Math.max(b.open,b.close):b.high,bot:Q.obWick===false?Math.min(b.open,b.close):b.low};break}}
      if(found){const z={type:"OB",dir:e.dir,top:found.top,bot:found.bot,i:found.i,st:found.st,event:e};Object.assign(z,zoneStatus(G,found.i,z.top,z.bot,z.dir,G.length-1));if(z.invalid){z.type="BB";z.dir=-z.dir;}blocks.push(z);}}
    // Rejection Blocks (wick rejection) at confirmed short-term pivots.
    const rb=[];for(const p of pivots){const b=G[p.i],body=Math.abs(b.close-b.open),lw=Math.min(b.open,b.close)-b.low,uw=b.high-Math.max(b.open,b.close),k=Math.max(0,+Q.rbWick||1.4);
      if(p.type==="L"&&lw>Math.max(body*.75,lastATR*.02)&&lw>=body*k)rb.push({type:"RB",dir:1,top:Math.min(b.open,b.close),bot:b.low,i:p.i,st:p.st});
      if(p.type==="H"&&uw>Math.max(body*.75,lastATR*.02)&&uw>=body*k)rb.push({type:"RB",dir:-1,top:b.high,bot:Math.max(b.open,b.close),i:p.i,st:p.st});}
    // Failed-swing / Mitigation Block proxy: a short-term pivot retested without taking the prior pivot extreme.
    const mb=[];for(const typ of ["H","L"]){const P=pivots.filter(p=>p.type===typ);for(let j=1;j<P.length;j++){
      const p=P[j],prev=P[j-1],b=G[p.i],failed=typ==="H"?p.price<prev.price&&p.price>prev.price-lastATR*.35:p.price>prev.price&&p.price<prev.price+lastATR*.35;
      if(failed){let k=p.i-1;while(k>=Math.max(0,p.i-8)&&((typ==="H"&&G[k].close>=G[k].open)||(typ==="L"&&G[k].close<=G[k].open)))k--;
        const zB=G[Math.max(0,k)];mb.push({type:"MB",dir:typ==="H"?-1:1,top:zB.high,bot:zB.low,i:Math.max(0,k),st:zB.st});}}
    }
    // Liquidity sweeps: EQH/EQL and confirmed pivot levels taken then rejected on a closed bar.
    const sweeps=[];for(let i=1;i<G.length;i++){const b=G[i],tol=(atr[i]||lastATR)*.03;
      const refs=pivots.filter(p=>p.at<i&&i-p.at<=250).slice(-80);
      for(const p of refs){if(p.type==="H"&&b.high>p.price+tol&&b.close<p.price){sweeps.push({type:"BSL Sweep",dir:-1,level:p.price,i,st:b.st,ref:p});break}
        if(p.type==="L"&&b.low<p.price-tol&&b.close>p.price){sweeps.push({type:"SSL Sweep",dir:1,level:p.price,i,st:b.st,ref:p});break}}
      for(const z of eq){if(z.last>=i)continue;if(z.type==="EQH"&&b.high>z.price+tol&&b.close<z.price)sweeps.push({type:"EQH Sweep",dir:-1,level:z.price,i,st:b.st,ref:z});
        if(z.type==="EQL"&&b.low<z.price-tol&&b.close>z.price)sweeps.push({type:"EQL Sweep",dir:1,level:z.price,i,st:b.st,ref:z});}
    }
    // Session and HTF reference construction uses M1 for exact opening prices; fallback to chart bars.
    const timed=src.slice(0,mEnd+1).map(x=>({st:x[0]??x.st,open:x[1]??x.open,high:x[2]??x.high,low:x[3]??x.low,close:x[4]??x.close,v:x[5]??x.v??0})).filter(x=>Number.isFinite(x.st));
    const D=periodGroups(timed,toUTC,"D"),W=periodGroups(timed,toUTC,"W"),MO=periodGroups(timed,toUTC,"M");
    const prevD=D.length>1?D[D.length-2]:null,curD=D[D.length-1]||null,prevW=W.length>1?W[W.length-2]:null,curW=W[W.length-1]||null;
    // IPDA / ADR use completed Monday-Friday ICT trading days only (Sunday 17:00 NY opens Monday's session).
    const tradingDays=D.filter(x=>{const wd=nyParts(x.start,toUTC).wd;return wd>=0&&wd<=4;});
    const completedDays=tradingDays.slice(0,-1),dailyRange=x=>x.high-x.low;
    const avgRange=(a,k)=>a.length>=k?mean(a.slice(-k).map(dailyRange)):null;
    const adr={d5:avgRange(completedDays,5),d20:avgRange(completedDays,20),d50:avgRange(completedDays,50),
      current:curD?dailyRange(curD):null,progressPct:curD&&avgRange(completedDays,5)>0?dailyRange(curD)/avgRange(completedDays,5)*100:null,
      half5:avgRange(completedDays,5)==null?null:avgRange(completedDays,5)*.5,sourceDays:completedDays.length};
    const prev3=completedDays.slice(-3),threeDay=prev3.length===3?{high:Math.max(...prev3.map(x=>x.high)),low:Math.min(...prev3.map(x=>x.low)),from:prev3[0].start,to:prev3[2].end}:null;
    // Detect current/nearby PDH, PDL, PWH, PWL runs explicitly as liquidity pools.
    if(prevD||prevW)for(let i=Math.max(1,G.length-300);i<G.length;i++){const b=G[i];
      if(prevD&&b.high>prevD.high&&b.close<prevD.high)sweeps.push({type:"PDH Sweep",dir:-1,level:prevD.high,i,st:b.st});
      if(prevD&&b.low<prevD.low&&b.close>prevD.low)sweeps.push({type:"PDL Sweep",dir:1,level:prevD.low,i,st:b.st});
      if(prevW&&b.high>prevW.high&&b.close<prevW.high)sweeps.push({type:"PWH Sweep",dir:-1,level:prevW.high,i,st:b.st});
      if(prevW&&b.low<prevW.low&&b.close>prevW.low)sweeps.push({type:"PWL Sweep",dir:1,level:prevW.low,i,st:b.st});
    }
    const ses=sessionGroups(timed,toUTC),latestBy=name=>ses.filter(x=>x.name===name).slice(-2);
    // Rebuild 1H / 4H candles from M1 so top-down context is available on lower chart timeframes.
    const h1Bars=timeframeGroups(timed,toUTC,3600),h4Bars=timeframeGroups(timed,toUTC,14400);
    const dBars=D.map(x=>({st:x.start,open:x.open,high:x.high,low:x.low,close:x.close}));
    const closedCount=a=>Math.max(0,a.length-(Q.closedOnly===false?0:1));
    const structureOf=a=>{const c=closedCount(a);if(c<7)return{events:[],trend:0,last:{H:null,L:null}};const A=a.slice(0,c),P=classifyPivots(findPivots(A,+Q.pivotL||2,+Q.pivotR||2,A.length)),aa=atrOf(A,Math.max(2,+Q.atrLen||14));return structure(A,P,A.length-1,aa,true)};
    const h1Struct=structureOf(h1Bars),h4Struct=structureOf(h4Bars),d1Struct=structureOf(dBars);
    const lastP=nyParts(last.st,toUTC),todayKey=dateKey(lastP),curDayKey=dayKey(lastP);
    const asia=latestBy("Asia").find(x=>x.day===curDayKey)||latestBy("Asia").slice(-1)[0]||null;
    const london=latestBy("London KZ").slice(-1)[0]||null;
    const london0430=latestBy("4:00–4:30 Range").slice(-1)[0]||null;
    const nyam=latestBy("NY AM").slice(-1)[0]||null;
    const nypm=latestBy("NY PM").slice(-1)[0]||null;
    const cbdr=latestBy("CBDR").slice(-1)[0]||null;
    const opens={midnight:null,ny0200:null,ny0500:null,ny0700:null,ny0720:null,ny0830:null,ny0930:null};
    for(const x of timed){const p=nyParts(x.st,toUTC);if(dateKey(p)!==todayKey)continue;
      if(p.h===0&&p.mi===0&&!opens.midnight)opens.midnight={price:x.open,st:x.st};
      if(p.h===2&&p.mi===0&&!opens.ny0200)opens.ny0200={price:x.open,st:x.st};
      if(p.h===5&&p.mi===0&&!opens.ny0500)opens.ny0500={price:x.open,st:x.st};
      if(p.h===7&&p.mi===0&&!opens.ny0700)opens.ny0700={price:x.open,st:x.st};
      if(p.h===7&&p.mi===20&&!opens.ny0720)opens.ny0720={price:x.open,st:x.st};
      if(p.h===8&&p.mi===30&&!opens.ny0830)opens.ny0830={price:x.open,st:x.st};
      if(p.h===9&&p.mi===30&&!opens.ny0930)opens.ny0930={price:x.open,st:x.st};}
    const dr=(()=>{const h=pivots.filter(x=>x.type==="H"&&x.at<=G.length-1).slice(-1)[0],l=pivots.filter(x=>x.type==="L"&&x.at<=G.length-1).slice(-1)[0];
      if(h&&l&&h.price>l.price)return{high:h.price,low:l.price,eq:(h.price+l.price)/2,from:Math.min(h.i,l.i),to:G.length-1,kind:"Swing range"};
      if(curD&&curD.high>curD.low)return{high:curD.high,low:curD.low,eq:(curD.high+curD.low)/2,kind:"Daily range"};return null;})();
    const premium=dr?last.close>dr.eq:null;
    const ote=dr?{bull:{a:dr.high-(dr.high-dr.low)*.62,b:dr.high-(dr.high-dr.low)*.79,mid:dr.high-(dr.high-dr.low)*.705},bear:{a:dr.low+(dr.high-dr.low)*.62,b:dr.low+(dr.high-dr.low)*.79,mid:dr.low+(dr.high-dr.low)*.705}}:null;
    // Daily / weekly and IPDA 20/40/60 trading-day ranges.
    const ipda={};for(const k of [20,40,60]){const a=completedDays.slice(-k),mm=minmax(a,x=>x.high),nn=minmax(a,x=>-x.low);ipda[k]=a.length>=k?{high:mm.high,low:-nn.high,n:a.length}:null;}
    // Current quarter open and previous completed quarter reference.
    const qGroups=new Map();for(const x of timed){const p=nyParts(x.st,toUTC),q=Math.floor((p.m-1)/3)+1,key=p.y*10+q;let z=qGroups.get(key);if(!z){z={key,open:x.open,high:x.high,low:x.low,close:x.close,start:x.st};qGroups.set(key,z)}else{z.high=Math.max(z.high,x.high);z.low=Math.min(z.low,x.low);z.close=x.close}}
    const quarters=[...qGroups.values()],curQ=quarters[quarters.length-1]||null,prevQ=quarters.length>1?quarters[quarters.length-2]:null;
    // CBDR statistical projection: rolling standard deviation of historical 14:00-20:00 NY ranges.
    const cbHist=ses.filter(x=>x.name==="CBDR").slice(-21),cbRanges=cbHist.slice(0,-1).map(x=>x.high-x.low),cbSD=stdev(cbRanges),cbMean=mean(cbRanges);
    // In this PDF, one CBDR deviation is the measured 14:00–20:00 range unit; project from its edges.
    // Historical SD/mean are retained as diagnostics, not substituted for the PDF's range-based unit.
    const cbUnit=cbdr?Math.max(0,cbdr.high-cbdr.low):0;
    const cbProj=cbdr?{open:cbdr.open,mid:(cbdr.high+cbdr.low)/2,sd:cbSD,mean:cbMean,unit:cbUnit,
      up1:cbdr.high+cbUnit,dn1:cbdr.low-cbUnit,up2:cbdr.high+2*cbUnit,dn2:cbdr.low-2*cbUnit,
      up3:cbdr.high+3*cbUnit,dn3:cbdr.low-3*cbUnit,up4:cbdr.high+4*cbUnit,dn4:cbdr.low-4*cbUnit}:null;
    // NDOG / NWOG: gap between prior session close and next 17:00 session open. Forex may have no measurable gap.
    const gaps=[];for(let i=1;i<D.length;i++){const a=D[i-1],b=D[i],g=b.open-a.close;if(Math.abs(g)>lastATR*.015)gaps.push({type:"NDOG",dir:Math.sign(g),top:Math.max(a.close,b.open),bot:Math.min(a.close,b.open),st:b.start,from:a.end,to:b.start,size:Math.abs(g)});}
    for(let i=1;i<W.length;i++){const a=W[i-1],b=W[i],g=b.open-a.close;if(Math.abs(g)>lastATR*.015)gaps.push({type:"NWOG",dir:Math.sign(g),top:Math.max(a.close,b.open),bot:Math.min(a.close,b.open),st:b.start,from:a.end,to:b.start,size:Math.abs(g)});}
    // Breakaway gap: opening gap from consolidation followed by a range expansion in same direction.
    const bg=[];for(let i=Math.max(1,G.length-500);i<G.length;i++){const a=G[i-1],b=G[i],atrI=atr[i]||lastATR,dir=b.open>a.high?1:b.open<a.low?-1:0;
      if(dir&&Math.abs(b.open-(dir===1?a.high:a.low))>atrI*.08&&(b.close-b.open)*dir>atrI*.5)bg.push({type:"BG",dir,top:Math.max(b.open,dir===1?a.high:a.low),bot:Math.min(b.open,dir===1?a.high:a.low),i,st:b.st});}
    // Three Drives: three consecutive higher-high/higher-low (bull) or lower-high/lower-low (bear) pivots.
    const drives=[];for(const dir of [1,-1]){const H=pivots.filter(x=>x.type==="H"),L=pivots.filter(x=>x.type==="L");
      for(let i=2;i<Math.min(H.length,L.length);i++){const hh=H.slice(i-2,i+1),ll=L.slice(i-2,i+1);let ok=true;
        for(let j=1;j<3;j++)if(dir===1?(hh[j].price<=hh[j-1].price||ll[j].price<=ll[j-1].price):(hh[j].price>=hh[j-1].price||ll[j].price>=ll[j-1].price))ok=false;
        if(ok)drives.push({type:"3 Drives",dir,i:Math.max(hh[2].i,ll[2].i),st:Math.max(hh[2].st,ll[2].st),price:dir===1?hh[2].price:ll[2].price,complete:dir===1?hh[2].price>hh[1].price:ll[2].price<ll[1].price});}}
    // PO3 / AMD heuristic: Asia range = accumulation, run on one side = manipulation, displacement back through range = distribution.
    let po3={phase:"Chưa xác định",dir:0,asia,reason:"Cần đủ Asia range và sweep"};
    if(asia){const later=G.filter(b=>b.st>=asia.end),sweepHi=later.find(b=>b.high>asia.high&&b.close<asia.high),sweepLo=later.find(b=>b.low<asia.low&&b.close>asia.low);
      if(sweepHi){const disp=later.find(b=>b.st>sweepHi.st&&b.close<asia.low&&(b.close-b.open)<0);po3={phase:disp?"Distribution ↓":"Manipulation trên Asia High",dir:-1,asia,sweep:sweepHi,distribution:disp||null,reason:"Asia accumulation → quét Buy-side → kiểm tra dịch chuyển xuống"};}
      else if(sweepLo){const disp=later.find(b=>b.st>sweepLo.st&&b.close>asia.high&&(b.close-b.open)>0);po3={phase:disp?"Distribution ↑":"Manipulation dưới Asia Low",dir:1,asia,sweep:sweepLo,distribution:disp||null,reason:"Asia accumulation → quét Sell-side → kiểm tra dịch chuyển lên"};}
      else po3={phase:"Accumulation / chờ sweep",dir:0,asia,reason:"Chưa thấy quét một biên Asia"};}
    // Judas swing around midnight / 08:30 references, then require opposite-side displacement.
    const judas=[];for(const [source,op] of [["Midnight Open",opens.midnight],["London 02:00 Open",opens.ny0200],["05:00 Open",opens.ny0500],["07:00 Open",opens.ny0700],["08:30 Open",opens.ny0830],["09:30 NY Open",opens.ny0930]])if(op){
      const after=timed.filter(b=>b.st>=op.st),up=after.find(b=>b.high>op.price&&b.close<op.price),dn=after.find(b=>b.low<op.price&&b.close>op.price);
      const gi=x=>{let k=0;while(k<G.length&&G[k].st<=x)k++;return Math.max(0,k-1)};
      // The mark is a reclaim/rejection around the reference open; require subsequent opposite displacement when available.
      const accepted=(candidate,dir)=>candidate&&after.some(b=>b.st>candidate.st&&((dir<0&&b.close<b.open&&b.close<candidate.low)||(dir>0&&b.close>b.open&&b.close>candidate.high)));
      if(up&&accepted(up,-1))judas.push({type:"Judas",dir:-1,level:op.price,st:up.st,i:gi(up.st),source});
      if(dn&&accepted(dn,1))judas.push({type:"Judas",dir:1,level:op.price,st:dn.st,i:gi(dn.st),source});}
    // Silver Bullet windows in NY time, source model = look for displacement and FVG 10:00–11:00.
    const silver=[];for(const z of fvg){const p=nyParts(z.st,toUTC),m=p.h*60+p.mi;if(m>=600&&m<660)silver.push({...z,type:"Silver Bullet FVG"});}
    // Precision entry drill from Chapter 14: scan 5m → 4m → 3m → 2m → 1m and stop at first qualifying FVG.
    function ltfEntryDrill(){
      if(!M10.length)return{available:false,tf:null,label:"Cần dữ liệu M1",scanned:[]};
      const base=timed.slice(-18000),scanned=[];
      for(const seconds of [300,240,180,120,60]){
        const A=timeframeGroups(base,toUTC,seconds);if(Q.closedOnly!==false)A.pop();
        if(A.length<5){scanned.push(seconds/60+"m: thiếu dữ liệu");continue;}
        const aa=atrOf(A,Math.max(2,+Q.atrLen||14));let found=null;
        for(let i=A.length-1;i>=Math.max(2,A.length-36);i--){
          const a=A[i-2],c=A[i],bull=c.low>a.high,bear=c.high<a.low;if(!bull&&!bear)continue;
          const dir=bull?1:-1,top=bull?c.low:a.low,bot=bull?a.high:c.high,atrI=aa[i]||c.close*.001;
          if(top<=bot||top-bot<atrI*(+Q.entryFvgATR||.03))continue;
          const body=Math.abs(c.close-c.open),range=c.high-c.low,loc=range?(c.close-c.low)/range:.5;
          const displaced=body>=atrI*.45&&range>=atrI*.8&&(dir>0?loc>=.65:loc<=.35);
          if(!displaced)continue;
          found={tf:seconds/60,dir,top,bot,ce:(top+bot)/2,st:c.st,bar:i,size:top-bot};break;
        }
        scanned.push(seconds/60+"m: "+(found?"có displacement + FVG":"không có FVG đạt điều kiện"));
        if(found)return{available:true,...found,label:"Tìm thấy FVG đầu tiên ở "+(seconds/60)+"m — dừng quét TF thấp hơn",scanned};
      }
      return{available:true,tf:null,dir:0,label:"Không thấy FVG đạt điều kiện từ 5m đến 1m",scanned};
    }
    const entryDrill=Q.entryDrill?ltfEntryDrill():{available:false,tf:null,label:"Đã tắt",scanned:[]};
    // Bias is a transparent confluence read, never a probability score.
    const trend=stc.trend,htfTrend=h4Struct.events.length?h4Struct.trend:(d1Struct.events.length?d1Struct.trend:trend);let bull=0,bear=0,reasons=[];
    if(htfTrend>0){bull++;reasons.push("cấu trúc HTF tăng")}else if(htfTrend<0){bear++;reasons.push("cấu trúc HTF giảm")}
    if(h1Struct.trend&&htfTrend&&h1Struct.trend!==htfTrend)reasons.push("1H đang ngược hướng HTF — chờ đồng thuận");
    if(premium===false){bull++;reasons.push("giá ở Discount")}else if(premium===true){bear++;reasons.push("giá ở Premium")}
    if(prevD){if(last.close>prevD.high){bull++;reasons.push("đóng trên PDH")}if(last.close<prevD.low){bear++;reasons.push("đóng dưới PDL")}}
    if(sweeps.length&&sweeps[sweeps.length-1].i>=G.length-12){const s=sweeps[sweeps.length-1];if(s.dir>0){bull++;reasons.push("sweep Sell-side gần nhất")}else{bear++;reasons.push("sweep Buy-side gần nhất")}}
    const biasDir=bull>bear?1:bear>bull?-1:0;
    const liquidity=[];if(prevD){liquidity.push({name:"PDH",price:prevD.high,dir:1,st:prevD.end},{name:"PDL",price:prevD.low,dir:-1,st:prevD.end});}
    if(prevW)liquidity.push({name:"PWH",price:prevW.high,dir:1,st:prevW.end},{name:"PWL",price:prevW.low,dir:-1,st:prevW.end});
    if(threeDay)liquidity.push({name:"PD3H",price:threeDay.high,dir:1,st:threeDay.from},{name:"PD3L",price:threeDay.low,dir:-1,st:threeDay.from});
    eq.slice(-30).forEach(z=>liquidity.push({name:z.type,price:z.price,dir:z.targetDir??(z.type==="EQH"?1:-1),st:z.st}));
    const dol=liquidity.filter(x=>biasDir===0||x.dir===biasDir).sort((a,b)=>Math.abs(a.price-last.close)-Math.abs(b.price-last.close))[0]||null;
    const news=Q.newsOn?manualEvents(Q.newsText,fromUTC):[];
    // Manual trade-plan helper for the glossary/setup terms SL, TP, RR, BE and drawdown discipline.
    // It calculates a plan only from user-entered levels; it never infers position size or places orders.
    const riskPlan=(()=>{
      if(!Q.planOn)return{enabled:false,valid:false,label:"Đã tắt"};
      const entry=Number(Q.planEntry),stop=Number(Q.planStop),target=Number(Q.planTarget),dir=Q.planDir==="short"?-1:1;
      const risk=(entry-stop)*dir,reward=(target-entry)*dir,beR=Number.isFinite(+Q.beAtR)?Math.max(0,+Q.beAtR):1;
      if(![entry,stop,target].every(Number.isFinite)||entry<=0||risk<=0||reward<=0)
        return{enabled:true,valid:false,dir,entry,stop,target,label:"Nhập Entry / SL / TP hợp lệ theo hướng lệnh"};
      return{enabled:true,valid:true,dir,entry,stop,target,risk,reward,rr:reward/risk,beAtR:beR,beTrigger:entry+dir*risk*beR,
        label:"RR 1:"+(reward/risk).toFixed(2)+" · Risk "+risk.toFixed(5)+" · Reward "+reward.toFixed(5)};
    })();
    const levels=[];
    if(prevD){levels.push({name:"PDH",price:prevD.high,type:"liq",st:prevD.start},{name:"PDL",price:prevD.low,type:"liq",st:prevD.start});}
    if(prevW){levels.push({name:"PWH",price:prevW.high,type:"liq",st:prevW.start},{name:"PWL",price:prevW.low,type:"liq",st:prevW.start});}
    if(curD)levels.push({name:"D Open",price:curD.open,type:"open",st:curD.start},
      {name:"HOD",price:curD.high,type:"liq",st:curD.start},{name:"LOD",price:curD.low,type:"liq",st:curD.start});
    if(curW)levels.push({name:"W Open",price:curW.open,type:"open",st:curW.start},
      {name:"HOW",price:curW.high,type:"liq",st:curW.start},{name:"LOW",price:curW.low,type:"liq",st:curW.start});
    if(MO.length&&MO[MO.length-1])levels.push({name:"M Open",price:MO[MO.length-1].open,type:"open",st:MO[MO.length-1].start});
    if(curQ)levels.push({name:"Q Open",price:curQ.open,type:"open",st:curQ.start});
    if(prevQ)levels.push({name:"PQH",price:prevQ.high,type:"liq",st:prevQ.start},{name:"PQL",price:prevQ.low,type:"liq",st:prevQ.start});
    if(MO.length>1){const pm=MO[MO.length-2];levels.push({name:"PMH",price:pm.high,type:"liq",st:pm.start},{name:"PML",price:pm.low,type:"liq",st:pm.start});}
    if(threeDay)levels.push({name:"PD3H",price:threeDay.high,type:"liq",st:threeDay.from},{name:"PD3L",price:threeDay.low,type:"liq",st:threeDay.from});
    if(opens.midnight)levels.push({name:"00:00 NY",price:opens.midnight.price,type:"open",st:opens.midnight.st});
    if(opens.ny0200)levels.push({name:"02:00 London",price:opens.ny0200.price,type:"open",st:opens.ny0200.st});
    if(opens.ny0500)levels.push({name:"05:00 NY",price:opens.ny0500.price,type:"open",st:opens.ny0500.st});
    if(opens.ny0700)levels.push({name:"07:00 NY",price:opens.ny0700.price,type:"open",st:opens.ny0700.st});
    if(opens.ny0720)levels.push({name:"07:20 NY",price:opens.ny0720.price,type:"open",st:opens.ny0720.st});
    if(opens.ny0830)levels.push({name:"08:30 NY",price:opens.ny0830.price,type:"open",st:opens.ny0830.st});
    if(opens.ny0930)levels.push({name:"09:30 NY Open",price:opens.ny0930.price,type:"open",st:opens.ny0930.st});
    if(asia)levels.push({name:"Asia High",price:asia.high,type:"session",st:asia.start},{name:"Asia Low",price:asia.low,type:"session",st:asia.start});
    if(london)levels.push({name:"London High",price:london.high,type:"session",st:london.start},{name:"London Low",price:london.low,type:"session",st:london.start});
    if(london0430)levels.push({name:"04:00 Range High",price:london0430.high,type:"session",st:london0430.start},{name:"04:00 Range Low",price:london0430.low,type:"session",st:london0430.start});
    if(nyam)levels.push({name:"NY AM High",price:nyam.high,type:"session",st:nyam.start},{name:"NY AM Low",price:nyam.low,type:"session",st:nyam.start});
    if(nypm)levels.push({name:"NY PM High",price:nypm.high,type:"session",st:nypm.start},{name:"NY PM Low",price:nypm.low,type:"session",st:nypm.start});
    if(cbdr)levels.push({name:"CBDR High",price:cbdr.high,type:"session",st:cbdr.start},{name:"CBDR Low",price:cbdr.low,type:"session",st:cbdr.start});
    const activeSession=(()=>{const p=lastP,m=p.h*60+p.mi;if(m>=840&&m<960)return "NY PM / CBDR";if(m>=960&&m<1200)return "CBDR";if(m>=720&&m<780)return "NY Lunch";if(m>=600&&m<720)return "London Close";if(m>=420&&m<600)return "NY AM";if(m>=120&&m<420)return m<300?"London KZ":"London Session";if(m>=1200)return "Asia KZ";return "Ngoài Killzone"})();
    const currentStructure=stc.events.length?stc.events[stc.events.length-1]:null;
    const displacement=[];for(let i=1;i<G.length;i++){const b=G[i],r=b.high-b.low,body=Math.abs(b.close-b.open),a=atr[i]||lastATR,dir=b.close>b.open?1:b.close<b.open?-1:0;
      const closeLoc=r>0?(b.close-b.low)/r:.5;if(dir&&body>=a*.7&&r>=a*1.05&&(dir>0?closeLoc>=.72:closeLoc<=.28))displacement.push({type:"Displacement",dir,i,st:b.st,body,range:r,atr:a});}
    const dayMid=prevD?(prevD.high+prevD.low)/2:null;
    const dow=["Chủ nhật","Thứ Hai","Thứ Ba","Thứ Tư","Thứ Năm","Thứ Sáu","Thứ Bảy"][lastP.wd];
    const weekdayContext=[2,3].includes(lastP.wd)?"Thứ Ba/Thứ Tư — PDF nhấn mạnh khả năng hình thành weekly high/low quanh London Open":lastP.wd===1?"Thứ Hai — chú ý mở tuần và weekly range formation":lastP.wd===4?"Thứ Năm — kiểm tra weekly range đã hình thành hay chưa":lastP.wd===5?"Thứ Sáu — cuối tuần giao dịch; kiểm tra lịch NFP thủ công":"Chủ nhật — mở tuần ICT lúc 17:00 NY";
    const quarterShift=prevQ?(last.close>prevQ.high?"Vượt đỉnh quý trước":last.close<prevQ.low?"Phá đáy quý trước":"Trong biên quý trước"):"Cần dữ liệu quý trước";
    const dailySwingPivots=classifyPivots(findPivots(dBars,1,1,dBars.length));
    return {empty:false,B:G,end:G.length-1,atr,pivots,structure:stc,htf:{h1:h1Struct,h4:h4Struct,d1:d1Struct,h1Bars:h1Bars.length,h4Bars:h4Bars.length},displacement,eq,sweeps,fvg:fvg.slice(-120),ifvg:ifvg.slice(-60),bpr:bpr.slice(-40),vi:vi.slice(-60),blocks:blocks.slice(-60),rb:rb.slice(-60),mb:mb.slice(-40),daily:{current:curD,previous:prevD,mid:dayMid,all:D.slice(-65),threeDay:threeDay,swings:dailySwingPivots.slice(-20)},adr,weekly:{current:curW,previous:prevW},monthly:{current:MO[MO.length-1]||null,previous:MO.length>1?MO[MO.length-2]:null},quarter:{current:curQ,previous:prevQ,shift:quarterShift},ipda,dr,ote,premium,sessions:ses.slice(-120),asia,london,london0430,nyam,nypm,cbdr,cbProj,opens,gaps:gaps.slice(-5),breakaway:bg.slice(-30),drives:drives.slice(-12),po3,judas:judas.slice(-10),silver:silver.slice(-20),entryDrill,levels,liquidity,dol,bias:{dir:biasDir,label:biasDir>0?"Bullish":biasDir<0?"Bearish":"Trung tính",bull,bear,h4Dir:h4Struct.trend,h1Dir:h1Struct.trend,d1Dir:d1Struct.trend,reason:reasons.join(" · ")||"Chưa có cụm xác nhận đồng thuận"},activeSession,lastNY:lastP,weekday:dow,weekdayContext,news,riskPlan,trend,currentStructure,counts:{FVG:fvg.length,OB:blocks.filter(z=>z.type==="OB").length,BB:blocks.filter(z=>z.type==="BB").length,RB:rb.length,MB:mb.length},tf:+Q.tf||0};
  }
  root.ICT22={build,atrOf,findPivots,classifyPivots,structure,nyParts,dayKey,weekKey,manualEvents,version:"1.3.0"};

  // ---------- Canvas overlay ----------
  let MODEL=null,SIG="",DASH=null,DASHHTML="";
  const COLORS={bull:"#20c997",bear:"#ff5c7a",liq:"#f6c453",open:"#9ca3af",session:"#22b8cf",fvg:"#39a7ff",ob:"#a78bfa",bb:"#fb923c",rb:"#f472b6",mb:"#c084fc",bpr:"#e9a23b",ipda:"#b0bec5",news:"#ffb020"};
  function onICT(){try{return ACT.find(x=>x.key==="ict22"&&isOn(x))||null}catch(_){return null}}
  function ictDash(){if(!DASH){DASH=document.createElement("div");DASH.id="ict22Dash";$("chart").appendChild(DASH);}return DASH;}
  function ictStyle(){if(document.getElementById("ict22Css"))return;const s=document.createElement("style");s.id="ict22Css";s.textContent=`
    #ict22Dash{position:absolute;z-index:6;width:min(208px,calc(100% - 14px));min-width:0;max-width:208px;padding:8px 9px;border:1px solid rgba(148,163,184,.28);border-radius:10px;background:rgba(15,20,30,.92);color:#e9eef5;box-shadow:0 5px 20px rgba(0,0,0,.20);font:10px/1.35 'Space Grotesk',sans-serif;pointer-events:none;backdrop-filter:blur(8px)}
    #ict22Dash .top{display:flex;align-items:center;justify-content:space-between;gap:7px;margin-bottom:7px}#ict22Dash .hd{font-weight:800;letter-spacing:.35px;font-size:11px;color:#f8fafc}#ict22Dash .mut{color:#aab5c4;font-weight:500}
    #ict22Dash .badge{border-radius:999px;padding:2px 7px;font-size:9px;font-weight:800;letter-spacing:.25px;background:rgba(148,163,184,.14)}#ict22Dash .good{color:#20c997}#ict22Dash .bad{color:#ff7187}#ict22Dash .warn{color:#f6c453}
    #ict22Dash .stats{display:grid;grid-template-columns:1fr 1fr;gap:6px 9px}#ict22Dash .stat{min-width:0}#ict22Dash .stat small{display:block;color:#8794a7;font-size:8px;letter-spacing:.45px;text-transform:uppercase;margin-bottom:1px}#ict22Dash .stat b{display:block;color:#e9eef5;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:700}
    #ict22Dash .draw{margin-top:7px;padding-top:6px;border-top:1px solid rgba(150,160,180,.16);color:#9eabba;font-size:9px}#ict22Dash .draw b{color:#f6c453;font-size:10px;margin-left:3px}#ict22Dash .foot{color:#8794a7;font-size:8px;padding-top:5px}
    .mdl .ict-settings-intro{margin:0 0 8px;padding:8px 10px;border:1px solid var(--line);border-radius:9px;background:rgba(128,145,170,.07);font-size:12px;line-height:1.45}
    .mdl .ict-core-settings{display:grid;grid-template-columns:1fr 1fr;gap:0 14px}.mdl .ict-core-settings h4{grid-column:1/-1;margin:9px 0 3px}.mdl .ict-core-settings .f{grid-template-columns:minmax(0,1fr) auto;gap:5px 9px;padding:8px 0;font-size:12px}.mdl .ict-core-settings .f small{grid-column:1/-1}
    .mdl .ict-advanced-settings{margin-top:12px;border-top:1px solid var(--line);padding-top:10px}.mdl .ict-advanced-settings summary{cursor:pointer;list-style:none;font-size:12px;font-weight:700;color:var(--acc);padding:5px 0}.mdl .ict-advanced-settings summary::-webkit-details-marker{display:none}.mdl .ict-advanced-settings summary:after{content:'＋';float:right}.mdl .ict-advanced-settings[open] summary:after{content:'−'}.mdl .ict-advanced-body{padding-top:4px}
    @media(max-width:520px){#ict22Dash{width:min(194px,calc(100% - 12px));max-width:194px;padding:7px 8px}.mdl .ict-core-settings{grid-template-columns:1fr}}
  `;document.head.appendChild(s);}
  function drawICT(w,h){
    const a=onICT(),el=ictDash();if(!a||!agg.length){el.style.display="none";return;}ictStyle();
    const Q=Object.assign(pdef(IND.ict22),a.p),B=agg,M1=typeof m1!=="undefined"?m1:[];
    const tail=B[B.length-1],mt=M1[M1.length-1],sig=[C.sym,C.tf,B.length,B[0]&&B[0].st,tail.st,tail.high,tail.low,tail.close,M1.length,mt&&mt[0],mt&&mt[4],JSON.stringify(Q)].join("|");
    if(!MODEL||sig!==SIG){MODEL=root.ICT22.build(B,M1,Q,t=>typeof s2u==="function"?s2u(t):t,t=>typeof u2s==="function"?u2s(t):t);SIG=sig;}
    const M=MODEL;if(M.empty){el.style.display="none";return;}
    const indexOffset=Math.max(0,B.length-M.B.length);
    const X=i=>{const x=ts.logicalToCoordinate(i+indexOffset);return x==null||!isFinite(x)?null:x;};
    const XL=st=>{const G=M.B;let lo=0,hi=G.length;while(lo<hi){const m=(lo+hi)>>1;if(G[m].st<st)lo=m+1;else hi=m;}if(lo>=G.length)return X(G.length-1+(st-G[G.length-1].st)/(C.tf||60));if(lo===0)return X(0);const a0=G[lo-1],a1=G[lo],f=(st-a0.st)/(a1.st-a0.st||C.tf||60);return X(lo-1+f);};
    const Y=p=>{const y=cs.priceToCoordinate(p);return y==null||!isFinite(y)?null:y;};
    const clean=Q.visualMode!=="full",rightLabelYs=[];
    const line=(x0,x1,y,c,wd=1,ds=[])=>{if(x0==null||x1==null||y==null||Math.max(x0,x1)<0||Math.min(x0,x1)>w)return;ctx.strokeStyle=c;ctx.lineWidth=wd;ctx.setLineDash(ds);ctx.beginPath();ctx.moveTo(x0,y);ctx.lineTo(x1,y);ctx.stroke();};
    const label=(t,x,y,c,align="left")=>{if(x==null||y==null||y<0||y>h||x<-120||x>w+150)return;if(clean&&align==="right"){if(rightLabelYs.length>=8||rightLabelYs.some(v=>Math.abs(v-y)<13))return;rightLabelYs.push(y);}ctx.font=font(clean?9:10,1);ctx.fillStyle=c;ctx.textAlign=align;ctx.textBaseline="middle";ctx.fillText(t,x,y);};
    const rect=(st0,st1,top,bot,c,alpha=.10,txt="")=>{const x0=XL(st0),x1=XL(st1),y0=Y(top),y1=Y(bot);if(x0==null||x1==null||y0==null||y1==null||x1<0||x0>w)return;ctx.fillStyle=hexA(c,alpha);ctx.fillRect(x0,Math.min(y0,y1),Math.max(1,x1-x0),Math.max(1,Math.abs(y1-y0)));ctx.strokeStyle=hexA(c,Math.min(.9,alpha*4));ctx.lineWidth=1;ctx.strokeRect(x0,Math.min(y0,y1),Math.max(1,x1-x0),Math.max(1,Math.abs(y1-y0)));if(txt)label(txt,Math.min(w-4,x1-4),(y0+y1)/2,c,"right");};
    const lastSt=tail.st,far=lastSt+(C.tf||60)*Math.max(3,+Q.extend||25),priceFmt=p=>Number(p).toFixed(pd());
    ctx.save();ctx.font=font(10,0);
    // HTF liquidity reference levels.
    if(Q.prevLevels){const refs=M.levels.filter(x=>(clean?["PDH","PDL"]:["PDH","PDL","PWH","PWL","HOD","LOD","HOW","LOW","PD3H","PD3L","PMH","PML","PQH","PQL"]).includes(x.name));for(const z of refs){const y=Y(z.price),isHigh=/(?:PDH|PWH|HOD|HOW|PD3H|PMH|PQH)$/.test(z.name),c=isHigh?COLORS.bear:COLORS.bull;line(0,w,y,hexA(c,.68),1,[5,3]);label(z.name+" "+priceFmt(z.price),w-5,y,c,"right");}}
    if(Q.opens){for(const z of M.levels.filter(x=>["D Open","W Open","M Open","Q Open","00:00 NY","02:00 London","05:00 NY","07:00 NY","07:20 NY","08:30 NY","09:30 NY Open"].includes(x.name)&&(!clean||x.name==="D Open"))){const y=Y(z.price),c=COLORS.open;line(Math.max(0,XL(z.st)||0),w,y,hexA(c,.55),1,[2,4]);label(z.name,y==null?null:w-5,y,c,"right");}}
    if(Q.sessions&&!clean){
      const sc={"Asia":"#64748b","London KZ":"#60a5fa","London Session":"#60a5fa","4:00–4:30 Range":"#38bdf8","NY AM":"#34d399","London Close":"#a78bfa","NY Lunch":"#94a3b8","NY PM":"#f59e0b","CBDR":COLORS.session};
      M.sessions.filter(x=>x.name!=="CBDR").slice(-24).forEach(z=>{const c=sc[z.name]||COLORS.session;rect(z.start,z.end+(C.tf||60),z.high,z.low,c,.018,z.name);});
      for(const z of M.levels.filter(x=>x.name.startsWith("Asia ")||x.name.startsWith("London ")||x.name.startsWith("04:00")||x.name.startsWith("NY AM ")||x.name.startsWith("NY PM ")||x.name.startsWith("CBDR "))){const y=Y(z.price);line(Math.max(0,XL(z.st)||0),w,y,hexA(COLORS.session,.75),1,[2,3]);label(z.name,w-5,y,COLORS.session,"right");}
    }
    // Equal highs/lows + liquidity sweeps.
    if(Q.eq){for(const z of M.eq.slice(clean?-1:-25)){const y=Y(z.price);line(Math.max(0,XL(z.st)||0),w,y,hexA(COLORS.liq,.8),1,[3,3]);label(z.type+" ×"+z.count,w-5,y,COLORS.liq,"right");}}
    if(Q.sweeps){for(const z of M.sweeps.slice(clean?-2:-14)){const x=X(z.i),y=Y(z.level);if(x==null||y==null)continue;ctx.fillStyle=z.dir>0?COLORS.bull:COLORS.bear;ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fill();label(z.type,x+5,y-8,z.dir>0?COLORS.bull:COLORS.bear);}}
    // FVG, IFVG, BPR, liquidity void, order block families.
    if(Q.fvg){let zones=M.fvg.filter(z=>!(z.filled&&!Q.showFilled));if(clean){zones=zones.filter(z=>{const y0=Y(z.top),y1=Y(z.bot);return y0!=null&&y1!=null&&Math.max(y0,y1)>=0&&Math.min(y0,y1)<=h;}).sort((a,b)=>Math.abs((a.top+a.bot)/2-tail.close)-Math.abs((b.top+b.bot)/2-tail.close)).slice(0,2);}else zones=zones.slice(-Math.max(8,+Q.maxZones||32));for(const z of zones){rect(z.st,far,z.top,z.bot,z.type==="LV"?COLORS.session:COLORS.fvg,z.invalid?.04:z.filled?.025:(clean?.07:.09),clean?(z.type+ (z.dir>0?" ↑":" ↓")):z.type+" "+(z.imbalance||"")+(z.dir>0?" ↑":" ↓")+(z.filled?" ✓":""));if(!clean)line(XL(z.st),w,Y(z.ce),hexA(COLORS.fvg,.7),1,[2,3]);}}
    if(Q.ifvg&&!clean){for(const z of M.ifvg.slice(-10))rect(z.st,far,z.top,z.bot,COLORS.bb,.08,"IFVG");}
    if(Q.bpr&&!clean){for(const z of M.bpr.slice(-10))rect(z.st,far,z.top,z.bot,COLORS.bpr,.11,"BPR");}
    if(Q.gaps&&!clean){for(const z of M.gaps.slice(-5))rect(z.st,far,z.top,z.bot,z.type==="NWOG"?COLORS.ob:COLORS.fvg,.07,z.type);}
    if(Q.models&&!clean){for(const z of M.breakaway.slice(-8))rect(z.st,far,z.top,z.bot,COLORS.session,.06,"Breakaway Gap");}
    if(Q.blocks){let zones=M.blocks.filter(z=>!(z.filled&&!Q.showFilled));if(clean){zones=zones.filter(z=>{const y0=Y(z.top),y1=Y(z.bot);return y0!=null&&y1!=null&&Math.max(y0,y1)>=0&&Math.min(y0,y1)<=h;}).sort((a,b)=>Math.abs((a.top+a.bot)/2-tail.close)-Math.abs((b.top+b.bot)/2-tail.close)).slice(0,1);}else zones=zones.slice(-Math.max(5,+Q.maxZones||32));for(const z of zones){const c=z.type==="BB"?COLORS.bb:z.dir>0?COLORS.bull:COLORS.bear;rect(z.st,far,z.top,z.bot,c,z.invalid?.035:z.filled?.04:(clean?.10:.12),clean?z.type:z.type+(z.dir>0?" ↑":" ↓"));}}
    if(Q.rb&&!clean){for(const z of M.rb.slice(-15))rect(z.st,far,z.top,z.bot,COLORS.rb,.075,"RB");}
    if(Q.mb&&!clean){for(const z of M.mb.slice(-12))rect(z.st,far,z.top,z.bot,COLORS.mb,.07,"MB*");}
    if(Q.vi&&!clean){for(const z of M.vi.slice(-18))rect(z.st,lastSt+(C.tf||60)*3,z.top,z.bot,COLORS.open,.07,"VI");}
    // Premium / discount dealing range, equilibrium and OTE.
    if(Q.range&&M.dr){const y=Y(M.dr.eq);line(0,w,y,"#e5e7eb",1,[4,4]);label("EQ 50% · "+(M.premium?"Premium":"Discount"),w-5,y,"#e5e7eb","right");}
    if(Q.range&&M.daily.mid!=null&&!clean){const y=Y(M.daily.mid);line(0,w,y,hexA(COLORS.open,.55),1,[1,5]);label("Previous Day EQ",w-5,y,COLORS.open,"right");}
    if(Q.ote&&M.ote&&!clean){const bull=M.ote.bull,bear=M.ote.bear;rect(tail.st,far,bull.a,bull.b,COLORS.bull,.055,"OTE 62–79% BUY");rect(tail.st,far,bear.a,bear.b,COLORS.bear,.055,"OTE 62–79% SELL");}
    // CBDR deviations measured from the actual range edges; IPDA 20/40/60 completed trading-day high/low.
    if(Q.cbdr&&M.cbProj&&!clean){const my=Y(M.cbProj.mid);line(XL(M.cbdr.start),w,my,hexA(COLORS.session,.8),1,[5,3]);label("CBDR 50%",w-5,my,COLORS.session,"right");for(const [nm,p] of [["CBDR +1σ",M.cbProj.up1],["CBDR -1σ",M.cbProj.dn1],["CBDR +2σ",M.cbProj.up2],["CBDR -2σ",M.cbProj.dn2],["CBDR +3σ",M.cbProj.up3],["CBDR -3σ",M.cbProj.dn3],["CBDR +4σ",M.cbProj.up4],["CBDR -4σ",M.cbProj.dn4]]){const y=Y(p);line(XL(M.cbdr.start),w,y,hexA(COLORS.session,.45),1,[2,5]);label(nm,w-5,y,COLORS.session,"right");}}
    if(Q.adr&&M.adr.d5&&M.daily.current&&!clean){const op=M.daily.current.open,unit=M.adr.d5*.5;for(const [nm,p] of [["50% ADR5 ↑",op+unit],["50% ADR5 ↓",op-unit]]){const y=Y(p);line(XL(M.daily.current.start),w,y,hexA(COLORS.open,.65),1,[4,4]);label(nm,w-5,y,COLORS.open,"right");}}
    if(Q.entryDrill&&M.entryDrill&&M.entryDrill.tf&&!clean){const z=M.entryDrill,clr=z.dir>0?COLORS.bull:COLORS.bear;rect(z.st,lastSt+(C.tf||60)*Math.max(3,+Q.extend||25),z.top,z.bot,clr,.16,"Entry Drill · "+z.tf+"m FVG");}
    if(Q.ipda&&!clean){for(const k of [20,40,60]){const z=M.ipda[k];if(!z)continue;for(const [s,p] of [["IPDA "+k+"D H",z.high],["IPDA "+k+"D L",z.low]]){const y=Y(p);line(0,w,y,hexA(COLORS.ipda,k===20?.65:.35),1,[1,5]);label(s,w-5,y,COLORS.ipda,"right");}}}
    if(Q.quarter&&M.quarter.current&&!clean){const y=Y(M.quarter.current.open);line(0,w,y,hexA(COLORS.open,.7),1,[7,3]);label("Quarter Open",w-5,y,COLORS.open,"right");}
    // User-entered trade plan levels; BE trigger is a reference, not an auto stop modification.
    if(Q.planOn&&M.riskPlan&&M.riskPlan.valid){const p=M.riskPlan;for(const [nm,v,c,dash] of [["ENTRY",p.entry,COLORS.open,[6,2]],["SL",p.stop,COLORS.bear,[4,3]],["TP",p.target,COLORS.bull,[4,3]],["BE @ "+p.beAtR+"R",p.beTrigger,COLORS.liq,[2,4]]]){const y=Y(v);line(0,w,y,hexA(c,.85),1.2,dash);label(nm+" "+priceFmt(v),w-5,y,c,"right");}}
    // Structure BOS/MSS + confirmed short/intermediate/long pivots.
    if(Q.structure){for(const e of M.structure.events.slice(clean?-2:-24)){const y=Y(e.level),x=X(e.i),c=e.dir>0?COLORS.bull:COLORS.bear;line(x,w,y,c,1.3,[6,3]);label(e.type+(e.dir>0?" ↑":" ↓"),x==null?null:x+4,y,c);}
      if(!clean)for(const d of M.displacement.slice(-12)){const x=X(d.i),y=Y(d.dir>0?M.B[d.i].low:M.B[d.i].high);label("DISP",x,y,d.dir>0?COLORS.bull:COLORS.bear);}}
    if(Q.dailySwings&&!clean){for(const p of M.daily.swings.slice(-8)){const x=XL(p.st),y=Y(p.price),c=p.type==="H"?COLORS.bear:COLORS.bull;label(p.type==="H"?"D1 Swing High":"D1 Swing Low",x,y,c);}}
    if(Q.pivots&&!clean){for(const p of M.pivots.slice(-70)){const x=X(p.i),y=Y(p.price);if(x==null||y==null)continue;const c=p.type==="H"?COLORS.bear:COLORS.bull;const s=p.swing?(p.swing+" · "):"";if(x>=-10&&x<=w+10)label(s+(p.tier||(p.type==="H"?"STH":"STL")),x,y+(p.type==="H"?-9:9),hexA(c,.8));}}
    // Three Drives, Judas, Silver Bullet, PO3 markers.
    if(Q.models&&!clean){for(const z of M.drives.slice(-4)){const x=X(z.i),y=Y(z.price);label("3 Drives "+(z.dir>0?"↑":"↓"),x,y,z.dir>0?COLORS.bull:COLORS.bear);}
      for(const z of M.judas.slice(-6)){const x=X(z.i),y=Y(z.level);label("Judas "+z.source,x,y,z.dir>0?COLORS.bull:COLORS.bear);}
      for(const z of M.silver.slice(-8)){const x=X(z.i);if(x!=null)label("Silver Bullet",x,16,COLORS.liq);}}
    // Manually supplied news calendar markers; never auto-invent events.
    if(Q.newsOn){for(const ev of M.news){const x=XL(ev.st);if(x==null||x<0||x>w)continue;ctx.strokeStyle=COLORS.news;ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();label("NEWS · "+ev.label,x+3,30,COLORS.news);}}
    ctx.restore();
    // Dashboard.
    if(!Q.dashboard){el.style.display="none";return;}
    const pos=Q.dashPos||"tr",cw=$("chart").getBoundingClientRect(),s=el.style;s.display="block";s.top=s.bottom=s.left=s.right="auto";s.transform="";
    if(pos[0]==="t")s.top="8px";else s.bottom=(cw.height-h+8)+"px";if(pos[1]==="l")s.left="56px";else s.right=(cw.width-w+8)+"px";
    const cls=M.bias.dir>0?"good":M.bias.dir<0?"bad":"warn",str=M.currentStructure?M.currentStructure.type+(M.currentStructure.dir>0?" ↑":" ↓"):"Chưa có MSS/BOS";
    const h4=M.bias.h4Dir>0?"Bullish":M.bias.h4Dir<0?"Bearish":"—",h1=M.bias.h1Dir>0?"Bullish":M.bias.h1Dir<0?"Bearish":"—";
    const pdTxt=M.premium==null?"—":M.premium?"Premium":"Discount",dol=M.dol?M.dol.name+" · "+priceFmt(M.dol.price):"Chưa rõ";
    const badge=M.bias.dir>0?"BULLISH":M.bias.dir<0?"BEARISH":"NEUTRAL";
    const html=`<div class="top"><div class="hd">ICT 2022 <span class="mut">v${root.ICT22.version}</span></div><span class="badge ${cls}">${badge}</span></div><div class="stats"><div class="stat"><small>HTF · 4H / 1H</small><b>${h4} / ${h1}</b></div><div class="stat"><small>Cấu trúc</small><b>${str}</b></div><div class="stat"><small>Vị trí giá</small><b>${pdTxt}</b></div><div class="stat"><small>Phiên</small><b>${M.activeSession||"—"}</b></div></div><div class="draw">MỤC TIÊU THANH KHOẢN <b>${dol}</b></div><div class="foot">OHLC &amp; time model · Không phải lệnh tự động</div>`;
    if(html!==DASHHTML){el.innerHTML=html;DASHHTML=html;}
  }
  root.drawICT=drawICT;
})(window);
