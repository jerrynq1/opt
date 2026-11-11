/* ================= MARKET PROFILE / TPO CHART =================
   Standalone TPO profile workspace. It only reads the existing M1/footprint feed
   and draws in its own PRICE x TIME table; it never changes candle series,
   price/time scales, chart data, or drawing objects.

   Source basis: CBOT Market Profile Study Guide (1996). Where only cTrader
   M1 OHLC is available, each minute's High-Low is used as an approximate
   traded range. Footprint price rows are preferred when available. cTrader tick volume
   is a quote-count proxy, not exchange volume.
*/
const TPO_STORE_KEY="tp_tpo_v1",TPO_SCALE=1e5;
const TPO_DEFAULTS={
  enabled:false,timeZone:"America/New_York",sessionStart:"00:00",sessionHours:24,
  periodMin:30,letterMode:"cbot24",sessionPick:"current",rowStep:0,
  valueArea:70,valueMode:"tpo",ibMinutes:60,side:"r",widthPct:48,cellWidth:9,
  showValueArea:true,showIB:true,showSinglePrints:true,showStats:true,
  showPriceLabels:true,showCounts:true,showDayType:true,showFairPrice:true,
  showRangeExtension:true,showPioneerRange:false
};
function tpoLoadSettings(){
  let s={};try{s=JSON.parse(localStorage.getItem(TPO_STORE_KEY)||"{}")||{}}catch{}
  const o={...TPO_DEFAULTS,...s};
  if(!["America/New_York","America/Chicago","Etc/UTC","Europe/London","Asia/Ho_Chi_Minh"].includes(o.timeZone))o.timeZone=TPO_DEFAULTS.timeZone;
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(o.sessionStart)))o.sessionStart=TPO_DEFAULTS.sessionStart;
  o.sessionHours=[1,2,3,4,6,8,12,24].includes(+o.sessionHours)?+o.sessionHours:24;
  o.periodMin=[1,5,10,15,30,60].includes(+o.periodMin)?+o.periodMin:30;
  o.letterMode=["cbot24","session"].includes(o.letterMode)?o.letterMode:"cbot24";
  o.sessionPick=o.sessionPick==="previous"?"previous":"current";
  o.rowStep=Math.max(0,Math.min(1e6,Number(o.rowStep)||0));
  o.valueArea=Math.max(50,Math.min(90,Math.round(+o.valueArea||70)));
  o.valueMode=["tick","quote"].includes(o.valueMode)?o.valueMode:"tpo";
  o.ibMinutes=[30,60,90,100,120].includes(+o.ibMinutes)?+o.ibMinutes:60;
  o.side=o.side==="l"?"l":"r";
  o.widthPct=Math.max(20,Math.min(80,Math.round(+o.widthPct||48)));
  o.cellWidth=Math.max(5,Math.min(18,Math.round(+o.cellWidth||9)));
  ["enabled","showValueArea","showIB","showSinglePrints","showStats","showPriceLabels","showCounts","showDayType","showFairPrice","showRangeExtension","showPioneerRange"].forEach(k=>o[k]=!!o[k]);
  return o;
}
const TPO={options:tpoLoadSettings(),cache:new Map(),last:null};
function tpoTimeParts(sec,tz){
  const d=new Date(sec*1000),p={};
  new Intl.DateTimeFormat("en-US",{timeZone:tz,year:"numeric",month:"numeric",day:"numeric",hour:"numeric",minute:"numeric",second:"numeric",hourCycle:"h23"}).formatToParts(d).forEach(x=>{if(x.type!=="literal")p[x.type]=+x.value});
  p.hour=p.hour%24;return{year:p.year,month:p.month,day:p.day,hour:p.hour,minute:p.minute,second:p.second};
}
function tpoDateKey(y,m,d){return Math.floor(Date.UTC(y,m-1,d)/86400000)}
function tpoDateParts(key){const d=new Date(key*86400000);return{year:d.getUTCFullYear(),month:d.getUTCMonth()+1,day:d.getUTCDate()}}
function tpoZonedEpoch(y,m,d,h,mi,tz){
  const wall=Date.UTC(y,m-1,d,h,mi,0,0);let guess=wall;
  for(let i=0;i<4;i++){
    const p=tpoTimeParts(guess/1000,tz),got=Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second);
    const delta=wall-got;if(!delta)break;guess+=delta;
  }
  return Math.floor(guess/1000);
}
function tpoAddDate(key,n){return key+n}
function tpoSessionForKey(key,o){
  const d=tpoDateParts(key),hm=o.sessionStart.split(":").map(Number),start=tpoZonedEpoch(d.year,d.month,d.day,hm[0],hm[1],o.timeZone);
  let end;if(o.sessionHours===24){const nd=tpoDateParts(tpoAddDate(key,1));end=tpoZonedEpoch(nd.year,nd.month,nd.day,hm[0],hm[1],o.timeZone)}else end=start+o.sessionHours*3600;
  return{key,baseKey:key,start,end,label:`${String(d.day).padStart(2,"0")}/${String(d.month).padStart(2,"0")}/${d.year}`};
}
function tpoSessionForTimestamp(sec,o){
  const p=tpoTimeParts(sec,o.timeZone),minute=p.hour*60+p.minute,start=o.sessionStart.split(":").map(Number),startMin=start[0]*60+start[1];
  let key=tpoDateKey(p.year,p.month,p.day);if(minute<startMin)key--;
  const base=tpoSessionForKey(key,o);if(o.sessionHours===24)return base;
  const dur=o.sessionHours*3600,slot=Math.max(0,Math.floor((sec-base.start)/dur)),begin=base.start+slot*dur,sp=tpoTimeParts(begin,o.timeZone);
  return{key:key*100+slot,baseKey:key,start:begin,end:begin+dur,label:`${base.label} ${String(sp.hour).padStart(2,"0")}:${String(sp.minute).padStart(2,"0")}`};
}
function tpoPreviousSession(s,o){
  if(o.sessionHours===24)return tpoSessionForKey(s.baseKey-1,o);
  const start=s.start-o.sessionHours*3600,p=tpoTimeParts(start,o.timeZone),key=s.key-1;
  return{key,baseKey:s.baseKey,start,end:s.start,label:`${String(p.day).padStart(2,"0")}/${String(p.month).padStart(2,"0")}/${p.year} ${String(p.hour).padStart(2,"0")}:${String(p.minute).padStart(2,"0")}`};
}
function tpoNiceStep(span,tick){
  if(!(span>0))return tick;const target=span/70,p=Math.pow(10,Math.floor(Math.log10(target))),m=target/p,k=m<=1?1:m<=2?2:m<=2.5?2.5:m<=5?5:10;
  return Math.max(tick,k*p);
}
function tpoLetter(periodIndex,minuteOfDay,periodMin,mode){
  const alpha="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  if(mode==="cbot24"&&periodMin===30){const q=Math.max(0,Math.min(47,Math.floor(minuteOfDay/30)));return q<24?String.fromCharCode(65+q):String.fromCharCode(97+q-24)}
  return alpha[periodIndex%52]+(periodIndex>=52?String(Math.floor(periodIndex/52)+1):"");
}
function tpoValueArea(metric,poc,targetPct){
  const n=metric.length;if(!n||poc<0||poc>=n)return{lo:0,hi:0,total:0,covered:0};
  let lo=poc,hi=poc,total=0;for(const v of metric)total+=Math.max(0,+v||0);
  const target=total*Math.max(1,Math.min(100,targetPct))/100;let covered=Math.max(0,+metric[poc]||0);
  while(covered+1e-9<target&&(lo>0||hi<n-1)){
    const a=hi+1<n?Math.max(0,+metric[hi+1]||0):-1;
    const b=lo>0?Math.max(0,+metric[lo-1]||0):-1;
    if(a<0&&b<0)break;
    if(a===b&&a>=0){hi++;lo--;covered+=a+b}
    else if(a>b){hi++;covered+=Math.max(0,a)}
    else{lo--;covered+=Math.max(0,b)}
  }
  return{lo,hi,total,covered};
}
function tpoFindFairPrice(counts,lo,hi,profileMid){
  let best=-1,pick=-1;
  for(let i=lo;i<=hi;i++)if(counts[i]>best||(counts[i]===best&&Math.abs(i-profileMid)<Math.abs(pick-profileMid))){best=counts[i];pick=i}
  return pick;
}
// CBOT LDB 70% range method (Study Guide Part II): start at the
// highest-volume price, compare the next two rows above with the next two
// below, then add the larger pair until the target is reached. This helper is
// only used for M1 tick-volume / quote-count proxies; it never labels them as
// actual futures contract volume.
function tpoLdbValueArea(metric,poc,targetPct){
  const n=metric?.length||0;if(!n||poc<0||poc>=n)return{lo:0,hi:0,total:0,covered:0};
  let total=0;for(const v of metric)total+=Math.max(0,+v||0);
  const target=total*Math.max(1,Math.min(100,targetPct))/100;let lo=poc,hi=poc,covered=Math.max(0,+metric[poc]||0);
  const pair=(start,dir)=>{let sum=0;for(let k=1;k<=2;k++){const i=start+dir*k;if(i>=0&&i<n)sum+=Math.max(0,+metric[i]||0)}return sum};
  while(covered+1e-9<target&&(lo>0||hi<n-1)){
    const up=pair(hi,1),down=pair(lo,-1);
    if(up<0&&down<0)break;
    if(up>down){for(let k=1;k<=2&&hi<n-1;k++){hi++;covered+=Math.max(0,+metric[hi]||0)}}
    else if(down>up){for(let k=1;k<=2&&lo>0;k++){lo--;covered+=Math.max(0,+metric[lo]||0)}}
    else{
      let moved=false;for(let k=1;k<=2;k++){if(hi<n-1){hi++;covered+=Math.max(0,+metric[hi]||0);moved=true}if(lo>0){lo--;covered+=Math.max(0,+metric[lo]||0);moved=true}}
      if(!moved)break;
    }
  }
  return{lo,hi,total,covered};
}
function tpoClassifyDay(P){
  if(!P||!P.ibReady||!(P.ibRange>0))return"IB đang hình thành";
  const up=Math.max(0,P.high-P.ibHigh),dn=Math.max(0,P.ibLow-P.low),full=P.high-P.low,inside=P.ibRange/Math.max(full,P.step);
  const eps=P.step*.51,upOn=up>eps,dnOn=dn>eps;
  if(upOn&&dnOn)return"Neutral";
  if(inside>=.85)return"Normal";
  const ext=Math.max(up,dn),closeAtEdge=upOn?(P.close>=P.high-Math.max(P.step*2,full*.05)):(P.close<=P.low+Math.max(P.step*2,full*.05));
  if(ext>2*P.ibRange&&closeAtEdge)return"Trend";
  return"Normal Variation";
}
function tpoLowerBoundUTC(arr,t){let lo=0,hi=arr.length;while(lo<hi){const m=(lo+hi)>>1;(typeof s2u==="function"?s2u(arr[m][0]):arr[m][0])<t?lo=m+1:hi=m}return lo}
function tpoCalcProfile(bars,o,session){
  if(!Array.isArray(bars)||!bars.length||!session||!(session.end>session.start))return null;
  const i0=tpoLowerBoundUTC(bars,session.start),i1=tpoLowerBoundUTC(bars,session.end);if(i0>=i1)return null;
  let min=Infinity,max=-Infinity,last=bars[i1-1],totalMinutes=0;
  const useFootprint=typeof FPM!=="undefined"&&FPM instanceof Map&&FPM.size>0;
  for(let i=i0;i<i1;i++){
    const b=bars[i];if(!b||!Number.isFinite(+b[2])||!Number.isFinite(+b[3]))continue;
    min=Math.min(min,+b[3]);max=Math.max(max,+b[2]);totalMinutes++;
    // Include bid/ask quote rows too: they can sit just outside the candle's one-sided OHLC range.
    if(useFootprint){const rows=FPM.get(+b[0]);if(rows)for(const r of rows){const p=+r[0];if(Number.isFinite(p)){min=Math.min(min,p);max=Math.max(max,p)}}}
  }
  if(!Number.isFinite(min)||!Number.isFinite(max))return null;
  const tick=Math.pow(10,-Math.max(0,Math.min(8,typeof PDIG==="function"?PDIG():2)));let step=o.rowStep>0?Math.max(tick,o.rowStep):tpoNiceStep(Math.max(max-min,tick),tick),binI=Math.max(1,Math.round(step*TPO_SCALE));
  step=binI/TPO_SCALE;let baseI=Math.floor(Math.round(min*TPO_SCALE)/binI),topI=Math.floor(Math.round(max*TPO_SCALE)/binI),n=topI-baseI+1;
  if(n>900){const mult=Math.ceil(n/900);binI=Math.max(1,Math.round(step*mult*TPO_SCALE));step=binI/TPO_SCALE;baseI=Math.floor(Math.round(min*TPO_SCALE)/binI);topI=Math.floor(Math.round(max*TPO_SCALE)/binI);n=topI-baseI+1}
  const dur=session.end-session.start,periodSec=o.periodMin*60,nP=Math.max(1,Math.ceil(dur/periodSec)),cells=new Uint8Array(n*nP),metric=new Float64Array(n),quoteMetric=new Float64Array(n),buyQuote=new Float64Array(n),sellQuote=new Float64Array(n),counts=new Int32Array(n),rowOf=p=>Math.floor(Math.round(p*TPO_SCALE)/Math.max(1,Math.round(step*TPO_SCALE)))-baseI;
  let ibHigh=-Infinity,ibLow=Infinity,ibBars=0,ibEnd=session.start+o.ibMinutes*60,close=+last[4],fpmMins=0,pioneerHigh=-Infinity,pioneerLow=Infinity;
  for(let i=i0;i<i1;i++){
    const b=bars[i],serverTime=+b[0],t=typeof s2u==="function"?s2u(serverTime):serverTime;if(!(t>=session.start&&t<session.end))continue;
    const per=Math.floor((t-session.start)/periodSec);if(per<0||per>=nP)continue;
    const low=Math.min(+b[3],+b[2]),high=Math.max(+b[3],+b[2]);let touched=[];
    // FPM keys use the same server-time minute stamp as m1[i][0]; t is UTC only for session math.
    const fp=useFootprint?FPM.get(serverTime):null;
    if(fp&&fp.length){
      const seen=new Set();for(const r of fp){const p=+r[0];if(!Number.isFinite(p))continue;const q=rowOf(p);if(q>=0&&q<n){seen.add(q);const bq=Math.max(0,+r[1]||0),sq=Math.max(0,+r[2]||0);buyQuote[q]+=bq;sellQuote[q]+=sq;quoteMetric[q]+=bq+sq}}
      if(seen.size){touched=[...seen];fpmMins++}
    }
    if(!touched.length){let a=Math.max(0,rowOf(low)),z=Math.min(n-1,rowOf(high));for(let q=a;q<=z;q++)touched.push(q)}
    for(const q of touched){cells[q*nP+per]=1;}
    const v=Math.max(0,+b[5]||0);if(v>0&&touched.length){const share=v/touched.length;for(const q of touched)metric[q]+=share}
    if(t<session.start+periodSec){pioneerHigh=Math.max(pioneerHigh,high);pioneerLow=Math.min(pioneerLow,low)}
    if(t<ibEnd){ibHigh=Math.max(ibHigh,high);ibLow=Math.min(ibLow,low);ibBars++}
  }
  let totalTpo=0,mx=-1,poc=0;const mid=(n-1)/2;
  for(let q=0;q<n;q++){
    let c=0;for(let p=0;p<nP;p++)c+=cells[q*nP+p];counts[q]=c;totalTpo+=c;
  }
  let tickMetricTotal=0,quoteMetricTotal=0;for(let q=0;q<n;q++){tickMetricTotal+=Math.max(0,metric[q]);quoteMetricTotal+=Math.max(0,quoteMetric[q])}
  const valueModeUsed=o.valueMode==="tick"&&tickMetricTotal>0?"tick":o.valueMode==="quote"&&quoteMetricTotal>0?"quote":"tpo";
  const selectedMetric=valueModeUsed==="tick"?metric:valueModeUsed==="quote"?quoteMetric:counts;
  for(let q=0;q<n;q++){
    const val=selectedMetric[q];
    if(val>mx+1e-9||(Math.abs(val-mx)<=1e-9&&Math.abs(q-mid)<Math.abs(poc-mid))){mx=val;poc=q}
  }
  const vaMetric=selectedMetric,va=valueModeUsed==="tpo"?tpoValueArea(vaMetric,poc,o.valueArea):tpoLdbValueArea(vaMetric,poc,o.valueArea),valueAreaMethod=valueModeUsed==="tpo"?"TPO-count adjacent-row expansion":"CBOT two-row volume-range method · proxy",fair=tpoFindFairPrice(counts,va.lo,va.hi,mid);
  let above=0,below=0;for(let q=0;q<n;q++)if(counts[q]>=2){if(q>fair)above++;else if(q<fair)below++}
  const imbalance=above<below?"Buyer":below<above?"Seller":"Balanced";
  let topSingles=0,botSingles=0;for(let q=n-1;q>=0&&counts[q]===1;q--)topSingles++;for(let q=0;q<n&&counts[q]===1;q++)botSingles++;
  const haveIB=ibBars>0&&ibHigh>-Infinity&&ibLow<Infinity,ibRange=haveIB?ibHigh-ibLow:0;
  const P={session,base:baseI*binI/TPO_SCALE,step,n,nP,periodMin:o.periodMin,periodSec,cells,counts,metric,quoteMetric,buyQuote,sellQuote,totalTpo,poc,va,vaMetric,valueModeUsed,valueAreaMethod,fair,above,below,imbalance,high:max,low:min,close,ibHigh:haveIB?ibHigh:null,ibLow:haveIB?ibLow:null,ibRange,ibBars,pioneerHigh:Number.isFinite(pioneerHigh)?pioneerHigh:null,pioneerLow:Number.isFinite(pioneerLow)?pioneerLow:null,rangeExtensionUp:haveIB?Math.max(0,max-ibHigh):null,rangeExtensionDown:haveIB?Math.max(0,ibLow-min):null,ibReady:haveIB&&(typeof s2u==="function"?s2u(last[0]):last[0])>=ibEnd,topSingles,botSingles,tickMinutes:fpmMins,totalMinutes,quoteCoverage:totalMinutes?fpmMins/totalMinutes:0,source:fpmMins?"M1 + footprint quote rows":"M1 OHLC High–Low",approx:true};
  P.pocPrice=P.base+(P.poc+.5)*step;P.vah=P.base+(P.va.hi+1)*step;P.val=P.base+P.va.lo*step;P.fairPrice=P.base+(P.fair+.5)*step;P.dayType=tpoClassifyDay(P);P.coverage=totalMinutes?fpmMins/totalMinutes:0;
  return P;
}
function tpoProfileForView(){
  const o=TPO.options;if(!o.enabled||typeof m1==="undefined"||!m1.length)return null;
  // Profile uses the active M1 history and current live candle.
  const last=m1.length-1;if(last<0)return null;
  const ts0=typeof s2u==="function"?s2u(m1[last][0]):m1[last][0],s0=tpoSessionForTimestamp(ts0,o),session=o.sessionPick==="previous"?tpoPreviousSession(s0,o):s0,tail=m1[m1.length-1];
  const fph=typeof FPH==="undefined"?0:FPH, fplv=typeof FPLV==="undefined"?0:FPLV, fpv=typeof FPV==="undefined"?0:FPV;
  const symbol=typeof C!=="undefined"?C.sym:"",sig=[symbol,session.start,session.end,m1.length,tail[0],tail[2],tail[3],tail[4],tail[5],fph,fplv,fpv,JSON.stringify(o),"live"].join("|");
  const c=TPO.cache.get("profile");if(c&&c.sig===sig){TPO._profileSig=sig;return c.P}
  const P=tpoCalcProfile(m1,o,session);TPO.cache.set("profile",{sig,P});TPO.last=P;TPO._profileSig=sig;if(TPO.cache.size>4)TPO.cache.delete(TPO.cache.keys().next().value);return P;
}
function tpoFmt(v){if(v==null||v===""||!Number.isFinite(Number(v)))return"—";return Number(v).toFixed(typeof PDIG==="function"?PDIG():2)}
function tpoEsc(v){return String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function tpoActivate(on){
  on=!!on;if(TPO.options.enabled===on){if(on)tpoRenderStandalone(true);return}
  TPO.options.enabled=on;TPO.cache.clear();TPO.last=null;
  try{localStorage.setItem(TPO_STORE_KEY,JSON.stringify(TPO.options))}catch{}
  if(on)tpoRenderStandalone(true);
}
function tpoSetCanvas(canvas,w,h){
  if(!canvas)return null;const dpr=Math.max(1,Math.min(3,(typeof window!=="undefined"&&window.devicePixelRatio)||1));
  canvas.style.width=w+"px";canvas.style.height=h+"px";
  const W=Math.max(1,Math.round(w*dpr)),H=Math.max(1,Math.round(h*dpr));
  if(canvas.width!==W)canvas.width=W;if(canvas.height!==H)canvas.height=H;
  const g=canvas.getContext("2d");if(!g)return null;g.setTransform(dpr,0,0,dpr,0,0);return g;
}
function tpoStatsMarkup(P){
  if(!P)return [
    ["POC","—","Point of Control"],["VALUE AREA","—","VAH / VAL"],["INITIAL BALANCE","—","IBH / IBL"],["FAIR PRICE","—","Fairest price"],["SESSION TYPE","—","Day structure"]
  ].map(x=>`<div class="tpo-metric"><span>${x[0]}</span><b>${x[1]}</b><small>${x[2]}</small></div>`).join("");
  const va=TPO.options.showValueArea?`${tpoFmt(P.vah)} <i>—</i> ${tpoFmt(P.val)}`:"Ẩn",ib=TPO.options.showIB?`${tpoFmt(P.ibHigh)} <i>—</i> ${tpoFmt(P.ibLow)}`:"Ẩn";
  return `<div class="tpo-metric is-poc"><span>POINT OF CONTROL</span><b>${tpoFmt(P.pocPrice)}</b><small>${P.counts[P.poc]} TPO · ${P.totalTpo} tổng TPO</small></div>
  <div class="tpo-metric is-va"><span>VALUE AREA · ${TPO.options.valueArea}%</span><b>${va}</b><small>VAH ở trên · VAL ở dưới</small></div>
  <div class="tpo-metric is-ib"><span>INITIAL BALANCE</span><b>${ib}</b><small>RE ↑ ${tpoFmt(P.rangeExtensionUp)} · RE ↓ ${tpoFmt(P.rangeExtensionDown)}</small></div>
  <div class="tpo-metric is-fair"><span>FAIREST PRICE</span><b>${TPO.options.showFairPrice?tpoFmt(P.fairPrice):"Ẩn"}</b><small>${TPO.options.showFairPrice?`↑ ${P.above} double prints · ↓ ${P.below}`:"Đã tắt hiển thị"}</small></div>
  <div class="tpo-metric is-day"><span>SESSION STRUCTURE</span><b>${TPO.options.showDayType?tpoEsc(P.dayType):"—"}</b><small>${tpoEsc(P.imbalance)} imbalance · ${P.topSingles}/${P.botSingles} single prints</small></div>`;
}
function tpoDrawHeader(P,width,colW,countW,dark){
  const cv=$("tpoHeaderCanvas"),h=38,g=tpoSetCanvas(cv,width,h);if(!g)return;
  const bg=dark?"#151d29":"#f7f0e2",line=dark?"rgba(195,178,143,.22)":"rgba(112,88,49,.20)",mut=dark?"#a9b8c5":"#806a45",ink=dark?"#e5eaf0":"#332713";
  g.clearRect(0,0,width,h);g.fillStyle=bg;g.fillRect(0,0,width,h);g.font="700 10px 'Space Grotesk',sans-serif";g.textAlign="center";g.textBaseline="middle";
  for(let p=0;p<P.nP;p++){
    const x=p*colW,bp=tpoTimeParts(P.session.start+p*P.periodSec,TPO.options.timeZone),letter=tpoLetter(p,bp.hour*60+bp.minute,P.periodMin,TPO.options.letterMode);
    g.fillStyle=p===0?(dark?"rgba(212,165,67,.15)":"rgba(211,157,48,.16)"):(p%2?(dark?"rgba(255,255,255,.018)":"rgba(89,69,39,.025)") : "transparent");g.fillRect(x,0,colW,h);
    g.strokeStyle=line;g.beginPath();g.moveTo(x+.5,0);g.lineTo(x+.5,h);g.stroke();
    g.fillStyle=ink;g.font="700 11px 'Space Grotesk',sans-serif";g.fillText(letter,x+colW/2,12);
    g.fillStyle=mut;g.font="8px 'Space Grotesk',sans-serif";g.fillText(String(bp.hour).padStart(2,"0")+":"+String(bp.minute).padStart(2,"0"),x+colW/2,27);
  }
  const x=P.nP*colW;if(countW>0){g.strokeStyle=line;g.beginPath();g.moveTo(x+.5,0);g.lineTo(x+.5,h);g.stroke();g.fillStyle=ink;g.font="700 9px 'Space Grotesk',sans-serif";g.fillText("TPO",x+countW/2,h/2)}
  g.strokeStyle=line;g.beginPath();g.moveTo(0,h-.5);g.lineTo(width,h-.5);g.stroke();
}
function tpoDrawAxis(P,height,rowH,dark){
  const cv=$("tpoAxisCanvas"),width=82,g=tpoSetCanvas(cv,width,height);if(!g)return;
  const bg=dark?"#17212c":"#fbf5e8",line=dark?"rgba(195,178,143,.16)":"rgba(112,88,49,.15)",mut=dark?"#b7c2cc":"#806a45";
  g.clearRect(0,0,width,height);g.fillStyle=bg;g.fillRect(0,0,width,height);
  for(let r=0;r<P.n;r++){
    const q=P.n-1-r,y=r*rowH,inVA=TPO.options.showValueArea&&q>=P.va.lo&&q<=P.va.hi,isPoc=q===P.poc,isSingle=TPO.options.showSinglePrints&&P.counts[q]===1,isFair=TPO.options.showFairPrice&&q===P.fair;
    g.fillStyle=isPoc?(dark?"rgba(221,168,53,.24)":"rgba(225,172,64,.25)"):isFair?(dark?"rgba(164,123,212,.17)":"rgba(164,123,212,.14)"):inVA?(dark?"rgba(54,157,205,.15)":"rgba(60,151,193,.13)"):isSingle?(dark?"rgba(220,99,99,.17)":"rgba(190,66,66,.12)"):(r%2?(dark?"rgba(255,255,255,.015)":"rgba(85,65,35,.018)"):bg);
    g.fillRect(0,y,width,rowH);g.strokeStyle=line;g.beginPath();g.moveTo(0,y+rowH-.5);g.lineTo(width,y+rowH-.5);g.stroke();
    if(TPO.options.showPriceLabels){g.font=(isPoc?"700 ":"500 ")+"10px 'Space Grotesk',sans-serif";g.textAlign="right";g.textBaseline="middle";g.fillStyle=isPoc?(dark?"#f3c45b":"#a56b0e"):isFair?(dark?"#c9a9f4":"#8554b5"):inVA?mut:(dark?"#95a3af":"#806a45");g.fillText(tpoFmt(P.base+(q+.5)*P.step),width-7,y+rowH/2)}
  }
  g.strokeStyle=line;g.beginPath();g.moveTo(width-.5,0);g.lineTo(width-.5,height);g.stroke();
}
function tpoDrawGrid(P,width,height,rowH,colW,countW,dark){
  const cv=$("tpoGridCanvas"),g=tpoSetCanvas(cv,width,height);if(!g)return;
  const bg=dark?"#121a24":"#fffaf0",line=dark?"rgba(195,178,143,.14)":"rgba(112,88,49,.14)",mut=dark?"#8e9eac":"#766346",blue=dark?"#b8ddeb":"#315d75",gold=dark?"#f0c65a":"#9a6812",red=dark?"#ffaaaa":"#a84343";
  let maxCount=1;for(const c of P.counts)maxCount=Math.max(maxCount,c);
  g.clearRect(0,0,width,height);g.fillStyle=bg;g.fillRect(0,0,width,height);
  const bin=Math.max(1,Math.round(P.step*TPO_SCALE)),baseI=Math.round(P.base*TPO_SCALE),ibHi=P.ibHigh==null?null:Math.floor(Math.round(P.ibHigh*TPO_SCALE)/bin)-Math.floor(baseI/bin),ibLo=P.ibLow==null?null:Math.floor(Math.round(P.ibLow*TPO_SCALE)/bin)-Math.floor(baseI/bin);
  for(let r=0;r<P.n;r++){
    const q=P.n-1-r,y=r*rowH,inVA=TPO.options.showValueArea&&q>=P.va.lo&&q<=P.va.hi,isPoc=q===P.poc,isFair=TPO.options.showFairPrice&&q===P.fair,isSingle=TPO.options.showSinglePrints&&P.counts[q]===1,extUp=TPO.options.showRangeExtension&&ibHi!=null&&q>ibHi,extDn=TPO.options.showRangeExtension&&ibLo!=null&&q<ibLo;
    g.fillStyle=isPoc?(dark?"rgba(220,169,62,.23)":"rgba(224,174,67,.22)"):isFair?(dark?"rgba(164,123,212,.13)":"rgba(164,123,212,.11)"):inVA?(dark?"rgba(52,153,203,.13)":"rgba(63,151,195,.12)"):isSingle?(dark?"rgba(213,92,92,.16)":"rgba(190,66,66,.11)"):extUp?(dark?"rgba(47,165,128,.09)":"rgba(46,151,117,.07)"):extDn?(dark?"rgba(207,76,76,.09)":"rgba(190,66,66,.07)"):(r%2?(dark?"rgba(255,255,255,.012)":"rgba(90,70,40,.015)"):bg);
    g.fillRect(0,y,P.nP*colW+countW,rowH);g.strokeStyle=line;g.beginPath();g.moveTo(0,y+rowH-.5);g.lineTo(width,y+rowH-.5);g.stroke();
    for(let p=0;p<P.nP;p++)if(P.cells[q*P.nP+p]){
      const x=p*colW,cellFill=isPoc?(dark?"rgba(224,171,55,.40)":"rgba(224,171,55,.34)"):isSingle?(dark?"rgba(214,102,102,.23)":"rgba(190,66,66,.17)"):inVA?(dark?"rgba(64,159,207,.19)":"rgba(63,151,195,.17)"):(dark?"rgba(160,178,194,.075)":"rgba(105,117,130,.07)");
      g.fillStyle=cellFill;g.fillRect(x+1,y+2,colW-2,rowH-4);
      if(TPO.options.showPioneerRange&&p===0){g.strokeStyle=dark?"rgba(194,169,119,.75)":"rgba(148,112,53,.65)";g.lineWidth=1;g.strokeRect(x+1,y+2,colW-2,rowH-4)}
      const bp=tpoTimeParts(P.session.start+p*P.periodSec,TPO.options.timeZone),label=tpoLetter(p,bp.hour*60+bp.minute,P.periodMin,TPO.options.letterMode);
      g.fillStyle=isPoc?gold:isSingle?red:inVA?blue:mut;g.font="600 "+(colW<23?9:10)+"px 'Space Grotesk',monospace";g.textAlign="center";g.textBaseline="middle";g.fillText(label,x+colW/2,y+rowH/2+.3);
    }
    if(countW>0&&TPO.options.showCounts){const bx=P.nP*colW+6,bw=countW-23,barW=Math.max(0,bw*P.counts[q]/maxCount);
      g.fillStyle=dark?"rgba(150,164,178,.12)":"rgba(112,98,74,.10)";g.fillRect(bx,y+6,bw,6);
      g.fillStyle=isPoc?gold:inVA?(dark?"#4e9cc4":"#5795b2"):mut;g.fillRect(bx,y+6,barW,6);
      g.fillStyle=isPoc?gold:mut;g.font=(isPoc?"700 ":"500 ")+"9px 'Space Grotesk',sans-serif";g.textAlign="right";g.fillText(String(P.counts[q]),width-5,y+rowH/2);
    }
    if(TPO.options.showIB&&ibHi!=null&&q===ibHi){g.strokeStyle=dark?"#36bd96":"#159b72";g.lineWidth=1.4;g.beginPath();g.moveTo(0,y+.5);g.lineTo(width,y+.5);g.stroke()}
    if(TPO.options.showIB&&ibLo!=null&&q===ibLo){g.strokeStyle=dark?"#e48686":"#ca5b5b";g.lineWidth=1.4;g.beginPath();g.moveTo(0,y+rowH-.5);g.lineTo(width,y+rowH-.5);g.stroke()}
  }
  // Vertical separators for time brackets and a separate TPO-count column.
  for(let p=0;p<=P.nP;p++){const x=p*colW;g.strokeStyle=line;g.beginPath();g.moveTo(x+.5,0);g.lineTo(x+.5,height);g.stroke()}
  const x=P.nP*colW;g.strokeStyle=dark?"rgba(214,178,101,.35)":"rgba(157,117,49,.35)";g.beginPath();g.moveTo(x+.5,0);g.lineTo(x+.5,height);g.stroke();
}
function tpoClearStandaloneCanvases(){
  for(const id of ["tpoHeaderCanvas","tpoAxisCanvas","tpoGridCanvas"]){
    const cv=$(id);if(!cv)continue;cv.width=1;cv.height=1;cv.style.width="0px";cv.style.height="0px";
  }
  TPO._drawSig=null;
}
function tpoRenderStandalone(force=false){
  if(typeof document==="undefined"||document.body?.dataset?.v!=="tpo")return null;
  const title=$("tpoSessionTitle"),meta=$("tpoSessionMeta"),stats=$("tpoSummary"),foot=$("tpoProfileFoot"),empty=$("tpoEmpty"),emptyText=$("tpoEmptyText"),feed=$("tpoFeedStatus");
  if(!TPO.options.enabled)TPO.options.enabled=true;
  if(force){TPO.cache.clear();TPO.last=null}
  const P=tpoProfileForView();
  if(!P||!P.totalTpo){
    tpoClearStandaloneCanvases();
    if(title)title.textContent="Market Profile · TPO";if(meta)meta.textContent="Chưa có dữ liệu trong phiên đang chọn.";
    if(stats)stats.innerHTML=tpoStatsMarkup(null);if(empty){empty.hidden=false;if(emptyText)emptyText.textContent=(!m1||!m1.length)?"Đang chờ dữ liệu M1 từ cTrader. Hãy kết nối tài khoản và mở Chart để tải lịch sử.":"Không tìm thấy nến M1 trong khoảng phiên này. Hãy thử chọn Phiên hiện tại hoặc thay đổi giờ bắt đầu / độ dài phiên."}
    if(feed){feed.textContent="Chưa có dữ liệu";feed.classList.add("is-empty")};if(foot)foot.textContent="TPO chưa được dựng vì thiếu dữ liệu trong khoảng thời gian đã chọn.";return null;
  }
  const o=TPO.options,isDark=document.documentElement.dataset.theme==="dark";
  if(title)title.textContent=(typeof C!=="undefined"?C.sym:"Market")+" · "+P.session.label;
  if(meta)meta.textContent=`${o.sessionHours} giờ · ${o.periodMin} phút/bracket · ${o.timeZone.replace("America/"," ").replace("Asia/"," ").replace("Europe/"," ").replace("Etc/"," ")}`;
  if(stats)stats.innerHTML=tpoStatsMarkup(P);if(empty)empty.hidden=true;
  if(feed){feed.textContent=P.tickMinutes?`Footprint ${Math.round(P.coverage*100)}%`:`M1 OHLC · ước lượng`;feed.classList.toggle("is-empty",!P.tickMinutes)}
  const mode=P.valueModeUsed==="tpo"?(o.valueMode!=="tpo"?"TPO count · fallback":"TPO count"):P.valueModeUsed==="quote"?"Bid/Ask quote-event proxy":"M1 tick-volume proxy";
  if(foot)foot.textContent=`${P.source} · ${P.totalMinutes} phút M1 · ${P.totalTpo} TPO · ${mode}; VA: ${P.valueAreaMethod}. CFD/cTrader không phải dữ liệu giao dịch futures tập trung.`;
  const hdr=$("tpoHeaderScroll"),grid=$("tpoGridScroll"),body=$("tpoBodyScroll");if(!hdr||!grid||!body)return P;
  const oldX=grid.scrollLeft,oldY=body.scrollTop,rowH=18,countW=o.showCounts?68:0,axisW=82;
  const viewWidth=document.getElementById("v-tpo")?.clientWidth||window.innerWidth;
  const available=Math.max(280,viewWidth-axisW-50),colW=Math.max(22,Math.min(34,Math.floor((available-Math.max(26,countW))/Math.max(1,P.nP))));
  const width=P.nP*colW+countW,height=P.n*rowH;
  const drawSig=[TPO._profileSig||"",P.session.start,P.session.end,P.n,P.nP,P.step,P.totalTpo,P.poc,viewWidth,colW,countW,rowH,isDark,JSON.stringify(o)].join("|");
  if(!force&&TPO._drawSig===drawSig)return P;
  tpoDrawHeader(P,width,colW,countW,isDark);tpoDrawAxis(P,height,rowH,isDark);tpoDrawGrid(P,width,height,rowH,colW,countW,isDark);TPO._drawSig=drawSig;
  const hc=$("tpoHeaderCanvas"),gc=$("tpoGridCanvas"),ac=$("tpoAxisCanvas");if(hc&&gc&&ac){hc.dataset.sig=gc.dataset.sig=ac.dataset.sig=[P.session.start,P.session.end,P.n,P.nP,P.step,P.totalTpo,P.poc,oldX,oldY].join("|")}
  if(grid.scrollWidth>grid.clientWidth)grid.scrollLeft=Math.min(oldX,grid.scrollWidth-grid.clientWidth);if(body.scrollHeight>body.clientHeight)body.scrollTop=Math.min(oldY,body.scrollHeight-body.clientHeight);
  return P;
}
function tpoCheck(key,label,on){return`<label class="tpo-setting-check"><input type="checkbox" data-tpo="${key}"${on?" checked":""}><span>${label}</span></label>`}
function tpoBuildSettings(){
  const el=$("tpoSettings");if(!el)return;const o=TPO.options;
  const opt=(list,v)=>list.map(([k,n])=>`<option value="${k}"${String(v)===String(k)?" selected":""}>${n}</option>`).join("");
  const wasOpen=!!el.querySelector?.(".tpo-settings-details")?.open;
  el.innerHTML=`<details class="tpo-settings-details"${wasOpen?" open":""}><summary><span><b>Cài đặt TPO</b><small>Phiên · độ phân giải · Value Area · hiển thị</small></span><span class="tpo-settings-caret">⌄</span></summary><div class="tpo-settings-body">
    <section class="tpo-setting-group"><h4>1. Phiên giao dịch</h4><div class="tpo-config-grid">
      <label>Múi giờ<select data-tpo="timeZone">${opt([["America/New_York","New York"],["America/Chicago","Chicago"],["Europe/London","London"],["Asia/Ho_Chi_Minh","Việt Nam (UTC+7)"],["Etc/UTC","UTC"]],o.timeZone)}</select></label>
      <label>Giờ bắt đầu phiên<input type="time" data-tpo="sessionStart" value="${o.sessionStart}"></label>
      <label>Độ dài phiên<select data-tpo="sessionHours">${opt([[1,"1 giờ"],[2,"2 giờ"],[3,"3 giờ"],[4,"4 giờ"],[6,"6 giờ"],[8,"8 giờ"],[12,"12 giờ"],[24,"24 giờ"]],o.sessionHours)}</select></label>
      <label>Phiên hiển thị<select data-tpo="sessionPick">${opt([["current","Phiên hiện tại"],["previous","Phiên trước"]],o.sessionPick)}</select></label>
    </div></section>
    <section class="tpo-setting-group"><h4>2. Độ phân giải TPO</h4><div class="tpo-config-grid">
      <label>Time bracket<select data-tpo="periodMin">${opt([[5,"5 phút"],[10,"10 phút"],[15,"15 phút"],[30,"30 phút · CBOT"],[60,"60 phút"]],o.periodMin)}</select></label>
      <label>Hệ ký tự<select data-tpo="letterMode">${opt([["cbot24","CBOT 24h · A–X / a–x"],["session","A–Z / a–z theo phiên"]],o.letterMode)}</select></label>
      <label>Bước giá mỗi hàng (0 = tự động)<input type="number" min="0" step="any" data-tpo="rowStep" value="${o.rowStep}"></label>
      <label>Value Area (%)<input type="number" min="50" max="90" step="1" data-tpo="valueArea" value="${o.valueArea}"></label>
      <label>Cách tính Value Area<select data-tpo="valueMode">${opt([["tpo","Theo số TPO · chuẩn profile"],["tick","Theo tick volume M1 · proxy"],["quote","Theo quote events Bid/Ask · proxy"]],o.valueMode)}</select></label>
      <label>Initial Balance<select data-tpo="ibMinutes">${opt([[30,"30 phút"],[60,"60 phút · CBOT cơ bản"],[90,"90 phút"],[100,"100 phút"],[120,"120 phút"]],o.ibMinutes)}</select></label>
    </div></section>
    <section class="tpo-setting-group"><h4>3. Các thành phần hiển thị</h4><div class="tpo-setting-toggles">
      ${tpoCheck("showValueArea","Tô vùng Value Area",o.showValueArea)}${tpoCheck("showIB","Hiện Initial Balance",o.showIB)}${tpoCheck("showSinglePrints","Đánh dấu Single Prints",o.showSinglePrints)}${tpoCheck("showCounts","Hiện số TPO và histogram",o.showCounts)}${tpoCheck("showDayType","Phân loại Normal / Normal Variation / Trend / Neutral",o.showDayType)}${tpoCheck("showFairPrice","Hiện Fair Price / Imbalance",o.showFairPrice)}${tpoCheck("showRangeExtension","Tô Range Extension trên / dưới IB",o.showRangeExtension)}${tpoCheck("showPioneerRange","Đánh dấu Pioneer Range",o.showPioneerRange)}${tpoCheck("showPriceLabels","Hiện nhãn giá",o.showPriceLabels)}
    </div></section>
    <div class="tpo-settings-actions"><button class="btn ghost sm" type="button" data-tpo-action="reset">Khôi phục mặc định</button><span>Thiết lập được lưu tự động trên thiết bị này.</span></div>
    <p class="tpo-source-note">Nguyên tắc theo CBOT: bracket cơ bản 30 phút; IB thường dùng 60 phút trong ví dụ CBOT; Value Area TPO được tính từ POC mở rộng dần tới tỷ lệ đã chọn. Fair Price là mức có nhiều bracket nhất trong Value Area; double prints phía trên/dưới được dùng để quan sát imbalance. Khi chỉ có M1 OHLC, vùng High–Low được dùng làm khoảng giá xấp xỉ. Tick volume cTrader là proxy, không phải volume hợp đồng futures. Bật TPO Chart sẽ dùng chung bộ tải tick của Footprint, giới hạn lịch sử theo vùng chart và tối đa 3 ngày; TPO dùng dữ liệu M1 hiện có và các hàng giá Footprint được nạp cùng nguồn lịch sử.</p>
  </div></details>`;tpoSyncControls();
}
function tpoSyncControls(){
  const root=$("v-tpo");if(!root)return;
  root.querySelectorAll?.("[data-tpo]").forEach(el=>{const k=el.dataset.tpo,v=TPO.options[k];if(el.type==="checkbox")el.checked=!!v;else if(v!=null&&String(el.value)!==String(v))el.value=String(v)});
}
function tpoSave(){
  try{localStorage.setItem(TPO_STORE_KEY,JSON.stringify(TPO.options))}catch{}
  TPO.cache.clear();TPO.last=null;if(typeof dirty!=="undefined")dirty=true;
  if(typeof document!=="undefined"&&document.body?.dataset?.v==="tpo")tpoRenderStandalone(true);
}
function tpoSetValue(key,value){
  const o=TPO.options,checks=["showValueArea","showIB","showSinglePrints","showStats","showPriceLabels","showCounts","showDayType","showFairPrice","showRangeExtension","showPioneerRange"];
  if(checks.includes(key))o[key]=!!value;
  else if(key==="timeZone"){if(["America/New_York","America/Chicago","Etc/UTC","Europe/London","Asia/Ho_Chi_Minh"].includes(value))o.timeZone=value}
  else if(key==="sessionStart"){if(/^([01]\d|2[0-3]):[0-5]\d$/.test(value))o.sessionStart=value}
  else if(key==="sessionHours")o.sessionHours=[1,2,3,4,6,8,12,24].includes(+value)?+value:24;
  else if(key==="sessionPick")o.sessionPick=value==="previous"?"previous":"current";
  else if(key==="periodMin")o.periodMin=[5,10,15,30,60].includes(+value)?+value:30;
  else if(key==="letterMode")o.letterMode=value==="session"?"session":"cbot24";
  else if(key==="rowStep")o.rowStep=Math.max(0,Math.min(1e6,Number(value)||0));
  else if(key==="valueArea")o.valueArea=Math.max(50,Math.min(90,Math.round(+value||70)));
  else if(key==="valueMode")o.valueMode=["tick","quote"].includes(value)?value:"tpo";
  else if(key==="ibMinutes")o.ibMinutes=[30,60,90,100,120].includes(+value)?+value:60;
  tpoSave();tpoSyncControls();
}
const tpoView=$("v-tpo");
if(tpoView){
  tpoView.addEventListener("change",e=>{const t=e.target,k=t&&t.dataset&&t.dataset.tpo;if(!k)return;tpoSetValue(k,t.type==="checkbox"?t.checked:t.value)});
  tpoView.addEventListener("click",e=>{
    const b=e.target.closest("[data-tpo-action]");if(!b)return;
    if(b.dataset.tpoAction==="refresh"){TPO.cache.clear();TPO.last=null;tpoRenderStandalone(true)}
    else if(b.dataset.tpoAction==="reset"){const was=TPO.options.enabled;TPO.options={...TPO_DEFAULTS,enabled:was};tpoSave();tpoBuildSettings()}
    else if(b.dataset.tpoAction==="go-chart"&&typeof show==="function")show("chart");
  });
}
const tpoHeadScroll=$("tpoHeaderScroll"),tpoGridScroll=$("tpoGridScroll");
if(tpoHeadScroll&&tpoGridScroll){let lock=false;tpoHeadScroll.addEventListener("scroll",()=>{if(lock)return;lock=true;tpoGridScroll.scrollLeft=tpoHeadScroll.scrollLeft;lock=false});tpoGridScroll.addEventListener("scroll",()=>{if(lock)return;lock=true;tpoHeadScroll.scrollLeft=tpoGridScroll.scrollLeft;lock=false})}
tpoBuildSettings();
if(typeof document!=="undefined"&&document.body?.dataset?.v==="tpo")tpoActivate(true);else if(TPO.options.enabled)tpoActivate(false);
if(typeof window!=="undefined")window.setInterval(()=>{if(document.body?.dataset?.v==="tpo")tpoRenderStandalone(false)},2000);
