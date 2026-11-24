/* ================= CHART ================= */
let m1=[],agg=[],rawAgg=[],sb=[],loading=false,busy=false,gen=0;
const SUB=()=>C.tf<60,baseArr=()=>SUB()?sb:m1;   // khung giây (< 60s) dựng từ sb (nến 1 giây từ tick), các khung còn lại dựng từ m1 (nến M1)
const baseSig=()=>{const A=baseArr(),l=A[A.length-1];return l?l[5]+","+l[4]:"0,0"};
const COL=()=>P.theme==="dark"?{up:"#3df5c0",dn:"#ff5c8a",tx:"#c4b79a",gr:"rgba(244,201,106,.08)",bd:"rgba(244,201,106,.22)"}:{up:"#08987a",dn:"#d6336c",tx:"#7a6740",gr:"rgba(176,116,26,.1)",bd:"rgba(176,116,26,.25)"};
const chart=LightweightCharts.createChart($("chart"),{layout:{background:{color:"transparent"},textColor:"#c4b79a",fontFamily:"Space Grotesk",attributionLogo:true},rightPriceScale:{borderColor:"rgba(244,201,106,.22)"},timeScale:{timeVisible:true,secondsVisible:false},crosshair:{mode:0},autoSize:true});
// Lightweight Charts v5: series được tạo qua API thống nhất addSeries().
let cs=chart.addSeries(LightweightCharts.CandlestickSeries,{borderVisible:false});
const vs=chart.addSeries(LightweightCharts.HistogramSeries,{priceFormat:{type:"volume"},priceScaleId:"vol"});
/* ===== Số lẻ của giá theo từng mã =====
   Trước đây series nến không đặt priceFormat nên lightweight-charts dùng mặc định 2 số lẻ (minMove 0.01): vàng (2 số lẻ) hiện đúng nhưng EURUSD/GBPUSD (5 số lẻ) bị làm tròn thành 1.34.
   Giờ: lấy số lẻ (digits) broker báo cho mã đang xem (CT.sym.digits). Nếu chưa có thì suy ra từ chính dữ liệu giá (số lẻ nhiều nhất của các nến gần nhất). */
function PDIG(){
  const d=typeof CT!=="undefined"&&CT.sym?+CT.sym.digits:NaN;
  if(Number.isInteger(d)&&d>=0&&d<=10)return d;
  let m=0;for(let i=agg.length-1,k=0;i>=0&&k<60;i--,k++){const x=agg[i];for(const v of[x.open,x.high,x.low,x.close]){const s=String(+(+v).toFixed(8)),p=s.indexOf(".");if(p>=0&&s.length-p-1>m)m=s.length-p-1}}
  return Math.max(2,Math.min(8,m))}
/* Đổi mã (vd XAUUSD -> EURUSD): trục giá có thể đang ở chế độ thủ công (người dùng đã kéo/zoom trục giá) nên vẫn giữ khoảng giá của mã cũ,
   chart trống rỗng cho tới khi zoom ra xa rồi vào lại. Khi dữ liệu mã mới về: bật lại tự căn thang giá cho mọi chart (chính + các pane chỉ báo),
   về nến mới nhất. Chạy 1 lần cho mỗi lần đổi mã. */
let viewSym=C.sym;
function symReset(){
  if(viewSym===C.sym)return;viewSym=C.sym;
  try{allCh().forEach(c=>{try{c.priceScale("right").applyOptions({autoScale:true})}catch(e){}})}catch(e){}
  try{chart.priceScale("vol").applyOptions({autoScale:true})}catch(e){}
  try{chart.timeScale().scrollToRealTime()}catch(e){}
}
const priceFmt=()=>{const d=PDIG();return{type:"price",precision:d,minMove:+Math.pow(10,-d).toFixed(d)}};
let pfDig=-1;
function applyPrec(){                              // đặt lại định dạng giá của trục + nhãn khi số lẻ đổi (đổi mã)
  const d=PDIG();if(d===pfDig)return;pfDig=d;
  try{cs.applyOptions({priceFormat:priceFmt()})}catch(e){}
}
chart.priceScale("vol").applyOptions({scaleMargins:{top:.85,bottom:0}});
const PN={};                                   // id chỉ báo -> {el,ch,lg,series,raw}: mỗi chỉ báo dao động có 1 chart riêng bên dưới
const allCh=()=>[chart,...Object.values(PN).map(p=>p.ch)];
chart.subscribeCrosshairMove(p=>{const d=p.seriesData&&p.seriesData.get(cs);const f=v=>(+v).toFixed(PDIG());if(!d){$("ohlc").textContent="";return}if(d.open!=null&&d.close!=null){$("ohlc").textContent=`O ${f(d.open)}   H ${f(d.high)}   L ${f(d.low)}   C ${f(d.close)}`}else if(d.value!=null){$("ohlc").textContent=`${QLChartTypes.byId[CHART_TYPE]?.label||"Value"}  ${f(d.value)}`}else $("ohlc").textContent=""});
function themeChart(){
  const c=COL();
  allCh().forEach(x=>x.applyOptions({layout:{textColor:c.tx},rightPriceScale:{borderColor:c.bd},timeScale:{borderColor:c.bd}}));
  applyCand();
  if(agg.length)rebuild(false);
}
const vcol=(o,c)=>(c>=o?eff().up:eff().dn)+"55";
function status(t,c){
  const e=$("st");if(e){e.textContent=t;e.title=t;e.className="pill "+(c||"")}
  const empty=$("chartEmptyState");
  if(empty){
    const hasBars=Array.isArray(agg)&&agg.length>0;
    empty.hidden=hasBars;
    if(!hasBars){
      const ready=typeof ctReady==="function"&&ctReady();
      const title=$("chartEmptyTitle"),detail=$("chartEmptyText");
      if(title)title.textContent=ready?"Đang chờ dữ liệu nến từ cTrader":"Kết nối cTrader để tải dữ liệu chart";
      if(detail)detail.textContent=ready?"Feed đã kết nối nhưng chưa có nến cho mã hoặc khung giờ đang chọn. Hãy kiểm tra symbol broker và trạng thái thị trường.":"Nhập Client ID, Client Secret và Access Token trong mục Kết nối cTrader. Khi feed có nến, biểu đồ sẽ tự xuất hiện.";
    }
  }
}
/* Tải M1 THEO NHU CẦU: mở chart chỉ tải ~1 ngày gần nhất, kéo chart sang trái tới đâu thì tải thêm nến cũ tới đó (fillLeft).
   Mốc thời gian ở đây là UTC (giây). m1Old = mốc cũ nhất đã hỏi server; m1Span = độ dài lần tải kế (1 -> 2 -> 4 -> 8 ngày). */
/* ===== Chống đứng chart =====
   Trước đây poll() chạy một mạch: ghi Bid/Ask ra màn hình RỒI mới cập nhật nến/footprint. Chỉ cần 1 bước ở giữa ném lỗi (vẽ đường Bid/Ask, cs.update lệch thời gian,
   tính chỉ báo...) hoặc cờ loading bị kẹt thì nến + footprint dừng hẳn trong khi Bid/Ask vẫn nhảy. Giờ: mỗi bước có try/catch riêng (lỗi chỉ ghi log, không chặn bước sau),
   và chartWatch() tự phát hiện "có giá mới mà nến không được cập nhật" để khôi phục theo cấp: áp lại -> dựng lại -> bù nến -> tải lại. Chẩn đoán: ctDiag() trong Console. */
const CHW={applied:Date.now(),lvl:0,err:"",errAt:0,loadAt:0,stale:6000,mid:15000,reload:30000,loadMax:90000};
function chErr(w,e){CHW.err=w+": "+String(e&&e.message||e);const n=Date.now();if(n-CHW.errAt>5000){CHW.errAt=n;console.warn("[chart] lỗi ở "+w,e)}}
let fpKick=0,m1Old=0,m1Span=86400,m1Empty=0,m1NoMore=false,fillBusy=false,fillRetry=0;
const M1_MAXSPAN=8*86400,M1_GIVEUP=30*86400;    // gặp liên tiếp 30 ngày không có nến thì coi như hết lịch sử
async function loadM1(keep){
  if(SUB())return loadSub();
  /* keep=true (bộ giám sát chartWatch tự khôi phục): giữ lại phần lịch sử đã tải, chỉ tải lại ~1 ngày mới nhất rồi nối vào. Trước đây khôi phục xoá sạch m1 nên chart nhảy về nến hiện tại và mất hết dữ liệu đã kéo về. */
  const kp=keep&&m1.length>0&&!SUB()?{m1,old:m1Old,span:m1Span,nm:m1NoMore,em:m1Empty}:null;
  const g=++gen;loading=true;CHW.loadAt=Date.now();fillBusy=false;m1NoMore=false;m1Empty=0;m1Span=86400;fillRetry=0;
  const now=Math.floor(Date.now()/1000)+120;
  let acc=[];
  try{
    status("Đang kết nối cTrader…");
    try{await ctEnsure()}catch(e){if(g===gen)status("cTrader: "+why(e),"bad");return}
    if(g!==gen)return;
    status("Đang tải M1…");
    let top=now,empty=0;                                   // cuối tuần/ngày lễ có thể trống: lùi dần tới khi có nến
    for(;;){
      const lo=top-m1Span,bars=await ctBars(lo,top);
      if(g!==gen)return;
      m1Old=lo;
      if(bars.length){acc=bars;break}
      empty+=top-lo;top=lo;m1Span=Math.min(m1Span*2,4*86400);
      if(empty>=M1_GIVEUP){m1NoMore=true;break}
    }
    if(!acc.length&&kp){m1Old=kp.old;m1Span=kp.span;m1NoMore=kp.nm;m1Empty=kp.em;status("Chưa tải lại được nến mới, giữ nguyên dữ liệu đã tải","bad");return}
    if(!acc.length){m1=[];rebuild(true);symReset();status("Chưa có nến cho "+C.sym+" (kiểm tra tên mã đúng với broker, hoặc thị trường chưa có dữ liệu)","bad");return}
    m1Span=Math.min(m1Span*2,M1_MAXSPAN);
    if(kp&&kp.m1[kp.m1.length-1][0]>=acc[0][0]-600){      // nối phần lịch sử cũ (không hở) với đợt vừa tải
      let i=0;while(i<kp.m1.length&&kp.m1[i][0]<acc[0][0])i++;
      acc=kp.m1.slice(0,i).concat(acc);m1Old=kp.old;m1Span=kp.span;m1NoMore=kp.nm;m1Empty=kp.em}
    m1=acc;rebuild(false);symReset();
    // bù các nến mới đóng trong lúc đang tải (poll() bị tạm dừng nối nến live khi loading) để không bị hở
    try{
      const bars=await ctBars(s2u(m1[m1.length-1][0]),Math.floor(Date.now()/1000)+120);
      if(g!==gen)return;
      let add=0;
      for(const x of bars){const l=m1[m1.length-1];if(x[0]===l[0])m1[m1.length-1]=x;else if(x[0]>l[0]){m1.push(x);add++}}
      if(add)rebuild(false);
    }catch(e){}
    status(m1.length+" nến M1 · cTrader","ok");
  }catch(e){status((acc.length?"Tải dở dang ("+m1.length+" nến) · lỗi: ":"Lỗi tải: ")+why(e),"bad")}
  finally{if(g===gen){loading=false;CHW.loadAt=0;if(m1.length)fillLeft()}}
}
/* Nối thêm nến cũ vào bên trái khi người dùng kéo chart gần tới đầu dữ liệu (còn < 40 nến bên trái màn hình).
   Giữ nguyên vị trí đang xem (bù số nến vừa thêm), nên chart không bị giật. */
async function fillLeft(){
  if(SUB())return subFill();
  if(fillBusy||loading||m1NoMore||!m1.length||Date.now()<fillRetry)return;
  const g=gen,ts=chart.timeScale();fillBusy=true;
  try{
    for(;;){
      const r=ts.getVisibleLogicalRange();
      if(!r||r.from>=40)break;
      status("Đang tải thêm nến cũ… "+m1.length+" nến");
      const top=m1Old,lo=top-m1Span,bars=await ctBars(lo,top);
      if(g!==gen)return;
      m1Old=lo;m1Span=Math.min(m1Span*2,M1_MAXSPAN);
      if(bars.length){m1Empty=0;prependM1(bars)}
      else{m1Empty+=top-lo;if(m1Empty>=M1_GIVEUP){m1NoMore=true;break}}
    }
    status(m1.length+" nến M1 · cTrader"+(m1NoMore?" · đã tới đầu lịch sử":""),"ok");
  }catch(e){fillRetry=Date.now()+5000;status("Lỗi tải thêm nến cũ: "+why(e),"bad")}
  finally{if(g===gen)fillBusy=false}
}
function prependM1(bars){
  const ts=chart.timeScale(),r=ts.getVisibleLogicalRange(),n0=Math.max(0,Math.ceil(r?r.from:0)),t0=agg[n0]&&agg[n0].time;
  if(SUB())sb=sbJoin(bars,sb);else m1=bars.concat(m1);
  rebuild(false);
  if(!r||t0==null)return;
  const i=agg.findIndex(b=>b.time===t0);if(i<0)return;
  const d=i-n0,c=ts.getVisibleLogicalRange();                // giữ đúng các nến đang xem (chart có thể đã tự giữ, thì không làm gì)
  if(d&&(!c||Math.abs(c.from-(r.from+d))>.5))try{ts.setVisibleLogicalRange({from:r.from+d,to:r.to+d})}catch{}
}

/* ===== Historical candles required by ETF Option Volume Flow =====
   Volume Events live in SQLite independently of the CFD chart. Before drawing a
   historical bubble, explicitly fetch the matching target-symbol M1 candles from
   cTrader. This is the missing link between the saved Volume history and the CFD
   price/time axes. Fetch one complete Nasdaq RTH session per date, merge by the
   broker/server candle timestamp, rebuild once, then restore the user's viewport. */
let volumeFlowHistoryPromise=null;
const volumeFlowFetchedRanges=new Set();
function chartServerAtLogical(logical){
  if(!Array.isArray(agg)||!agg.length||!Number.isFinite(logical))return null;
  const index=Math.floor(logical),fraction=logical-index;
  if(index<0){const a=agg[0],b=agg[1];const step=b?Number(b.st)-Number(a.st):Math.max(60,Number(C.tf)||60);return Number(a.st)+logical*step;}
  if(index>=agg.length-1){const a=agg[agg.length-1],b=agg[agg.length-2];const step=b?Number(a.st)-Number(b.st):Math.max(60,Number(C.tf)||60);return Number(a.st)+(logical-(agg.length-1))*step;}
  const a=Number(agg[index].st),b=Number(agg[index+1].st);
  return Number.isFinite(a)&&Number.isFinite(b)?a+(b-a)*fraction:null;
}
function chartLogicalAtServer(serverTime){
  if(!Array.isArray(agg)||!agg.length||!Number.isFinite(serverTime))return null;
  let lo=0,hi=agg.length-1;
  if(serverTime<Number(agg[0].st)||serverTime>Number(agg[hi].st))return null;
  while(lo<hi){const mid=(lo+hi+1)>>1;if(Number(agg[mid].st)<=serverTime)lo=mid;else hi=mid-1;}
  if(Math.abs(Number(agg[lo].st)-serverTime)<.001)return lo;
  if(lo>=agg.length-1)return lo;
  const left=Number(agg[lo].st),right=Number(agg[lo+1].st);
  if(!(right>left))return lo;
  const step=right-left;
  if(step>Math.max(60,Number(C.tf)||60)*1.75)return null;
  return lo+Math.max(0,Math.min(1,(serverTime-left)/step));
}
function volumeFlowRangeBounds(range){
  const lo=Math.max(1,Math.floor(Number(range?.fromUtcSec)||0)-120);
  const hi=Math.ceil(Number(range?.toUtcSec)||0)+120;
  return{lo,hi,key:`${String(C.sym)}|${lo}|${hi}`};
}
function volumeFlowRangeCoverage(range){
  const {lo,hi}=volumeFlowRangeBounds(range);
  const serverLo=u2s(lo),serverHi=u2s(hi);
  const count=(Array.isArray(m1)?m1:[]).reduce((total,bar)=>total+(Number(bar?.[0])>=serverLo&&Number(bar?.[0])<=serverHi?1:0),0);
  const expected=Math.max(1,Math.ceil((hi-lo)/60));
  const minimum=Math.max(5,Math.min(30,Math.floor(expected*.15)));
  return{count,expected,minimum,covered:count>=minimum,serverLo,serverHi};
}
async function ensureVolumeFlowChartHistory(ranges=[]){
  if(SUB())return{ok:false,reason:"sub-minute-chart-not-supported-for-event-anchor",loadedBars:0};
  if(QLChartTypes.isSynthetic(CHART_TYPE))return{ok:false,reason:"synthetic-chart-has-no-time-based-candle-anchor",loadedBars:0};
  const normalized=(Array.isArray(ranges)?ranges:[]).map(r=>({
    fromUtcSec:Math.floor(Number(r?.fromUtcSec??r?.from??0)),
    toUtcSec:Math.ceil(Number(r?.toUtcSec??r?.to??0)),
    sessionKey:String(r?.sessionKey||"")
  })).filter(r=>Number.isFinite(r.fromUtcSec)&&Number.isFinite(r.toUtcSec)&&r.fromUtcSec>0&&r.toUtcSec>r.fromUtcSec)
    .sort((a,b)=>a.fromUtcSec-b.fromUtcSec).slice(-20);
  if(!normalized.length)return{ok:true,reason:"no-qualified-events",loadedBars:0,requestedRanges:0,coverage:[]};
  if(volumeFlowHistoryPromise)return volumeFlowHistoryPromise;
  volumeFlowHistoryPromise=(async()=>{
    const waitUntil=Date.now()+45000;
    while((loading||fillBusy)&&Date.now()<waitUntil)await new Promise(resolve=>setTimeout(resolve,100));
    if(loading||fillBusy)throw new Error("Chart đang tải lịch sử khác quá lâu; chưa thể nạp Volume Flow history.");
    await ctEnsure();
    if(!ctReady()||CT.sym?.req!==C.sym)throw new Error(`cTrader chưa sẵn sàng cho chart ${C.sym}.`);

    const chartSymbol=C.sym,ts=chart.timeScale(),visibleRange=ts.getVisibleLogicalRange?.();
    const viewport=visibleRange?{fromServer:chartServerAtLogical(Number(visibleRange.from)),toServer:chartServerAtLogical(Number(visibleRange.to))}:null;
    const byTime=new Map((Array.isArray(m1)?m1:[]).map(bar=>[Number(bar[0]),bar]));
    let fetchedBars=0,addedBars=0,updatedBars=0,requestedRanges=0,skippedRanges=0;
    const rangeErrors=[],coverageBefore=[];
    let earliestUtc=Infinity;

    for(const range of normalized){
      if(C.sym!==chartSymbol)throw new Error("Chart symbol changed while loading Volume Flow history; request cancelled.");
      const bounds=volumeFlowRangeBounds(range),before=volumeFlowRangeCoverage(range);
      coverageBefore.push({sessionKey:range.sessionKey,...before});
      // A previous page/session cache is trusted only while the actual M1 array
      // still contains enough bars for this complete RTH session.
      if(before.covered){volumeFlowFetchedRanges.add(bounds.key);skippedRanges++;continue;}
      volumeFlowFetchedRanges.delete(bounds.key);
      if(bounds.hi-bounds.lo>8*86400){rangeErrors.push({sessionKey:range.sessionKey,error:"history range exceeds 8 days"});continue;}
      requestedRanges++;earliestUtc=Math.min(earliestUtc,bounds.lo);
      try{
        // cTrader expects UTC milliseconds; ctBars converts returned UTC minute
        // timestamps into the same broker/server `.st` values used by M1 and rawAgg.
        const rows=await ctBars(bounds.lo,bounds.hi);
        if(!Array.isArray(rows)||!rows.length){rangeErrors.push({sessionKey:range.sessionKey,error:"cTrader returned no M1 candles"});continue;}
        fetchedBars+=rows.length;
        for(const bar of rows){
          const stamp=Number(bar?.[0]);if(!Number.isFinite(stamp))continue;
          const old=byTime.get(stamp);
          if(!old){byTime.set(stamp,bar);addedBars++;}
          else if(old.some((value,index)=>Number(value)!==Number(bar[index]))){byTime.set(stamp,bar);updatedBars++;}
        }
      }catch(error){rangeErrors.push({sessionKey:range.sessionKey,error:error?.message||String(error)});}
    }

    if(C.sym!==chartSymbol)throw new Error("Chart symbol changed before Volume Flow history merge; request cancelled.");
    if(addedBars>0||updatedBars>0){
      if(Number.isFinite(earliestUtc))m1Old=Math.min(Number(m1Old)||Infinity,earliestUtc);
      m1=[...byTime.values()].sort((a,b)=>Number(a[0])-Number(b[0]));
      m1NoMore=false;m1Empty=0;
      rebuild(false);
      // setData can change logical indexes when older candles were prepended.
      // Restore the user's view using broker/server timestamps, not pixel offsets.
      if(viewport&&Number.isFinite(viewport.fromServer)&&Number.isFinite(viewport.toServer)){
        const from=chartLogicalAtServer(viewport.fromServer),to=chartLogicalAtServer(viewport.toServer);
        if(Number.isFinite(from)&&Number.isFinite(to)&&to>from){try{ts.setVisibleLogicalRange({from,to});}catch{}}
      }
    }

    const coverage=normalized.map(range=>{
      const bounds=volumeFlowRangeBounds(range),state=volumeFlowRangeCoverage(range);
      if(state.covered)volumeFlowFetchedRanges.add(bounds.key);
      else volumeFlowFetchedRanges.delete(bounds.key); // partial/empty downloads remain retryable
      return{sessionKey:range.sessionKey,count:state.count,expected:state.expected,minimum:state.minimum,covered:state.covered,
        firstServerTime:m1.find(bar=>Number(bar[0])>=state.serverLo)?.[0]??null,
        lastServerTime:[...m1].reverse().find(bar=>Number(bar[0])<=state.serverHi)?.[0]??null};
    });
    return{ok:true,targetSymbol:chartSymbol,requestedRanges,skippedRanges,fetchedBars,addedBars,updatedBars,totalM1Bars:m1.length,
      rawChartBars:Array.isArray(rawAgg)?rawAgg.length:0,firstServerTime:m1[0]?.[0]??null,lastServerTime:m1[m1.length-1]?.[0]??null,
      coverageBefore,coverage,errors:rangeErrors};
  })().finally(()=>{volumeFlowHistoryPromise=null;});
  return volumeFlowHistoryPromise;
}
window.ensureVolumeFlowChartHistory=ensureVolumeFlowChartHistory;


chart.timeScale().subscribeVisibleLogicalRangeChange(r=>{
  if(!r)return;
  if(r.from<40)fillLeft();
  clearTimeout(fpKick);fpKick=setTimeout(()=>{if(window.fpSync)fpSync()},400);   // footprint tick cũng tải thêm theo vùng đang xem
});
const bucket=(t,tf)=>tf>=604800&&tf%604800===0?Math.floor((t-345600)/tf)*tf+345600:Math.floor(t/tf)*tf;
const CHART_TYPE_KEY="tp_chart_type",CHART_TYPE_SETTINGS_KEY="tp_chart_type_settings";
const CHART_TYPE_DEFAULTS={rangeSize:40,rangeUnit:"ticks",renkoSize:10,renkoUnit:"ticks",tickSize:250,volumeSize:500,lineBreakCount:3,kagiReversal:40,kagiUnit:"ticks",pnfBoxSize:10,pnfUnit:"ticks",pnfReversal:3};
let CHART_TYPE=ld(CHART_TYPE_KEY,"candles"),CHART_TYPE_SETTINGS={...CHART_TYPE_DEFAULTS};
try{CHART_TYPE_SETTINGS={...CHART_TYPE_SETTINGS,...JSON.parse(ld(CHART_TYPE_SETTINGS_KEY,"{}"))}}catch{}
if(!QLChartTypes.byId[CHART_TYPE])CHART_TYPE="candles";
window.QL_CHART_TYPE=CHART_TYPE;
const typeTickSize=()=>{
  const s=typeof CT!=="undefined"&&CT.sym?CT.sym:{};
  const t=+(s.tickSize||s.minPriceIncrement||s.tick_size);
  return t>0&&isFinite(t)?t:Math.pow(10,-PDIG());
};
const typeSize=(value,unit)=>Math.max(1e-12,(+value||1)*(unit==="ticks"?typeTickSize():1));
function chartTypeOptions(){return{
  rangeSize:typeSize(CHART_TYPE_SETTINGS.rangeSize,CHART_TYPE_SETTINGS.rangeUnit),
  renkoSize:typeSize(CHART_TYPE_SETTINGS.renkoSize,CHART_TYPE_SETTINGS.renkoUnit),
  tickSize:CHART_TYPE_SETTINGS.tickSize,volumeSize:CHART_TYPE_SETTINGS.volumeSize,
  lineBreakCount:CHART_TYPE_SETTINGS.lineBreakCount,
  kagiReversal:typeSize(CHART_TYPE_SETTINGS.kagiReversal,CHART_TYPE_SETTINGS.kagiUnit),
  pnfBoxSize:typeSize(CHART_TYPE_SETTINGS.pnfBoxSize,CHART_TYPE_SETTINGS.pnfUnit),pnfReversal:CHART_TYPE_SETTINGS.pnfReversal
}}
function chartTypeColors(){const e=typeof eff==="function"?eff():COL();return{up:e.up||COL().up,down:e.dn||COL().dn};}
function chartSeriesKind(type){
  if(type==="ohlc"||type==="tick"||type==="volume")return LightweightCharts.BarSeries;
  if(type==="line"||type==="step"||type==="trend"||type==="kagi")return LightweightCharts.LineSeries;
  if(type==="area")return LightweightCharts.AreaSeries;
  if(type==="baseline")return LightweightCharts.BaselineSeries;
  return LightweightCharts.CandlestickSeries;
}
function chartSeriesOptions(type){
  const c=chartTypeColors(),up=c.up,down=c.down,gold="#d8b66a";
  const common={priceScaleId:"right",lastValueVisible:true,priceLineVisible:true};
  if(type==="ohlc"||type==="tick"||type==="volume")return{...common,upColor:up,downColor:down,openVisible:true,thinBars:false};
  if(type==="line")return{...common,color:gold,lineWidth:2,crosshairMarkerVisible:false};
  if(type==="area")return{...common,lineColor:gold,lineWidth:2,topColor:"rgba(216,182,106,.24)",bottomColor:"rgba(216,182,106,.015)"};
  if(type==="baseline")return{...common,baseValue:{type:"price",price:rawAgg[0]?.open||0},topLineColor:up,bottomLineColor:down,topFillColor:"rgba(61,245,192,.18)",bottomFillColor:"rgba(255,92,138,.16)",topLineWidth:2,bottomLineWidth:2};
  if(type==="step")return{...common,color:gold,lineWidth:2,lineType:LightweightCharts.LineType.WithSteps,crosshairMarkerVisible:false};
  if(type==="kagi")return{...common,color:gold,lineWidth:2,lineType:LightweightCharts.LineType.WithSteps,crosshairMarkerVisible:false};
  if(type==="trend")return{...common,color:gold,lineWidth:2,crosshairMarkerVisible:false};
  if(type==="hollow")return{...common,upColor:"rgba(0,0,0,0)",downColor:down,borderVisible:true,borderUpColor:up,borderDownColor:down,wickUpColor:up,wickDownColor:down};
  return{...common,upColor:up,downColor:down,borderVisible:true,borderUpColor:up,borderDownColor:down,wickUpColor:up,wickDownColor:down};
}
function seriesDataForLast(b){return QLChartTypes.dataForSeries([b],CHART_TYPE,chartTypeColors())[0]}
function renderCurrentChartData(fit=false,full=true){
  const source=rawAgg;
  const transformed=QLChartTypes.transform(source,CHART_TYPE,chartTypeOptions());
  agg=[];let lastT=-Infinity;
  for(const b of transformed){
    const st=Number.isFinite(+b.st)?+b.st:+b.time,whole=Math.floor(st),fraction=st-whole,t=disp(whole)+fraction;
    if(!Number.isFinite(t)||t<=lastT)continue;
    agg.push({...b,st,time:t});lastT=t;
  }
  const data=QLChartTypes.dataForSeries(agg,CHART_TYPE,chartTypeColors());
  if(CHART_TYPE==="baseline"&&rawAgg.length){try{cs.applyOptions({baseValue:{type:"price",price:rawAgg[0].open}})}catch{}}
  try{
    if(full)cs.setData(data);
    else if(data.length)cs.update(data[data.length-1]);
    vs.setData(QLChartTypes.dataForVolume(agg,chartTypeColors()));
  }catch(e){chErr("chart type render",e);try{cs.setData(data);vs.setData(QLChartTypes.dataForVolume(agg,chartTypeColors()))}catch(x){chErr("chart type rebuild",x)}}
  if(fit)chart.timeScale().scrollToRealTime();
  updateChartTypeHint();
}
function setChartType(type,save=true){
  if(!QLChartTypes.byId[type])return;
  const vr=chart.timeScale().getVisibleLogicalRange();
  if(typeof resetBAForSeries==="function")resetBAForSeries();
  try{chart.removeSeries(cs)}catch(e){}
  CHART_TYPE=type;window.QL_CHART_TYPE=type;
  if(save)sv(CHART_TYPE_KEY,type);
  cs=chart.addSeries(chartSeriesKind(type),chartSeriesOptions(type));
  pfDig=-1;applyPrec();
  renderCurrentChartData(true,true);
  try{if(typeof applyCand==="function")applyCand()}catch(e){chErr("apply chart type style",e)}
  if(vr&&agg.length>1){try{chart.timeScale().setVisibleLogicalRange(vr)}catch{}}
  const sel=$("chartType");if(sel)sel.value=type;
  try{renderInd()}catch(e){chErr("render indicators after chart type",e)}
  CHW.applied=Date.now();
}
function buildChartTypePicker(){
  const sel=$("chartType");if(!sel)return;
  const groups=[...new Set(QLChartTypes.DEFINITIONS.map(x=>x.group))];
  sel.innerHTML=groups.map(group=>`<optgroup label="${group}">`+QLChartTypes.DEFINITIONS.filter(x=>x.group===group).map(x=>`<option value="${x.id}">${x.label}</option>`).join("")+"</optgroup>").join("");
  sel.value=CHART_TYPE;sel.onchange=()=>setChartType(sel.value);
  const btn=$("chartTypeSettings");if(btn)btn.onclick=()=>openChartTypeSettings(btn);
  updateChartTypeHint();
  // Apply a previously saved chart mode on first load; otherwise the picker can show
  // one style while the underlying series is still a CandlestickSeries.
  if(CHART_TYPE!=="candles")setChartType(CHART_TYPE,false);
}
function updateChartTypeHint(){
  const el=$("chartTypeHint");if(!el)return;
  const names={range:"Range bars are reconstructed from source OHLC bars; tick order inside each source bar is not available.",renko:"Renko bricks use source-bar closes; this is a close-based reconstruction.",tick:"Tick bars use broker tick-volume counts aggregated in source bars, not individual tick sequencing.",volume:"Volume bars use cTrader broker tick-volume (not centralized exchange volume).",linebreak:"Three Line Break uses source-bar closing prices.",kagi:"Kagi reversals use source-bar closes and the selected reversal threshold.",pnf:"Point & Figure columns use source-bar closes and the selected box/reversal settings."};
  const note=names[CHART_TYPE]||"";el.textContent=note;el.title=note;
}
function openChartTypeSettings(btn){
  const old=document.querySelector(".ct-settings");if(old){old.remove();return}
  const el=document.createElement("div");el.className="ct-settings";el.setAttribute("role","dialog");el.setAttribute("aria-label","Cài đặt chart type");
  const rows=[
    ["rangeSize","Range size","number",1], ["rangeUnit","Range unit","unit",0],
    ["renkoSize","Renko brick size","number",1], ["renkoUnit","Renko unit","unit",0],
    ["tickSize","Ticks per bar","number",1], ["volumeSize","Tick-volume per bar","number",1],
    ["lineBreakCount","Line Break count","number",1], ["kagiReversal","Kagi reversal","number",1], ["kagiUnit","Kagi unit","unit",0],
    ["pnfBoxSize","P&F box size","number",1], ["pnfUnit","P&F unit","unit",0], ["pnfReversal","P&F reversal boxes","number",1]
  ];
  el.innerHTML=`<div class="ct-settings-head"><strong>Chart type settings</strong><button type="button" data-close aria-label="Đóng">×</button></div><p>Ticks được quy đổi theo tick size của broker; nếu broker không cung cấp, dùng bước giá theo digits của symbol.</p><div class="ct-settings-grid">${rows.map(([k,label,kind,min])=>`<label data-setting="${k}"><span>${label}</span>${kind==="unit"?`<select data-key="${k}"><option value="ticks">Ticks</option><option value="points">Price points</option></select>`:`<input data-key="${k}" type="number" min="${min}" step="1" value="${CHART_TYPE_SETTINGS[k]}">`}</label>`).join("")}</div><div class="ct-settings-actions"><button type="button" data-reset>Defaults</button><button type="button" data-save>Apply</button></div>`;
  document.body.appendChild(el);const r=btn.getBoundingClientRect();el.style.left=Math.max(8,Math.min(r.left,innerWidth-340)) + "px";el.style.top=Math.min(r.bottom+6,innerHeight-el.offsetHeight-8)+"px";
  el.querySelectorAll("select[data-key]").forEach(x=>x.value=CHART_TYPE_SETTINGS[x.dataset.key]);
  el.querySelector("[data-close]").onclick=()=>el.remove();
  el.querySelector("[data-reset]").onclick=()=>{CHART_TYPE_SETTINGS={...CHART_TYPE_DEFAULTS};sv(CHART_TYPE_SETTINGS_KEY,JSON.stringify(CHART_TYPE_SETTINGS));el.remove();renderCurrentChartData(true,true);renderInd()};
  el.querySelector("[data-save]").onclick=()=>{for(const x of el.querySelectorAll("[data-key]")){const k=x.dataset.key,v=x.tagName==="SELECT"?x.value:+x.value;if(x.tagName!=="SELECT"&&(!Number.isFinite(v)||v<=0)){x.focus();return}CHART_TYPE_SETTINGS[k]=v}sv(CHART_TYPE_SETTINGS_KEY,JSON.stringify(CHART_TYPE_SETTINGS));el.remove();renderCurrentChartData(true,true);renderInd()};
  const outside=e=>{if(!el.contains(e.target)&&e.target!==btn){el.remove();document.removeEventListener("pointerdown",outside,true)}};setTimeout(()=>document.addEventListener("pointerdown",outside,true),0);
}
function rebuild(fit){
  const raw=[];let cur=null;
  for(const x of baseArr()){
    const k=bucket(x[0],C.tf);
    if(!cur||cur.st!==k){cur={st:k,time:0,open:x[1],high:x[2],low:x[3],close:x[4],v:x[5]};raw.push(cur)}
    else{if(x[2]>cur.high)cur.high=x[2];if(x[3]<cur.low)cur.low=x[3];cur.close=x[4];cur.v+=x[5]}
  }
  rawAgg=[];let lastT=-1;
  for(const b of raw){b.time=disp(b.st);if(b.time>lastT){rawAgg.push(b);lastT=b.time}}
  applyPrec();
  renderCurrentChartData(!!fit,true);
  renderInd();
}
function scheduleSyntheticRefresh(){
  clearTimeout(chartTypeRefreshTimer);
  chartTypeRefreshTimer=setTimeout(()=>{try{renderCurrentChartData(false,true);safeInd()}catch(e){chErr("synthetic chart refresh",e)}},450);
}
let chartTypeRefreshTimer=0;
function applyLive(b,A){
  A=A||m1;const last=A[A.length-1];
  if(last&&last[0]===b[0])A[A.length-1]=b;else if(!last||b[0]>last[0])A.push(b);else{if(Date.now()-cuAt>15000)catchUp();return}
  const k=bucket(b[0],C.tf);let o,h,l,c,v=0;
  for(let i=A.length-1;i>=0&&A[i][0]>=k;i--){const x=A[i];o=x[1];c=c??x[4];h=Math.max(h??x[2],x[2]);l=Math.min(l??x[3],x[3]);v+=x[5]}
  if(o===undefined)return;
  const bar={st:k,time:disp(k),open:o,high:h,low:l,close:c,v},a=rawAgg[rawAgg.length-1];
  if(a&&a.st===k)rawAgg[rawAgg.length-1]=bar;else if(!a||bar.time>a.time)rawAgg.push(bar);else{if(Date.now()-cuAt>15000)catchUp();return}
  if(QLChartTypes.isSynthetic(CHART_TYPE)){
    scheduleSyntheticRefresh();
  }else{
    try{
      agg=QLChartTypes.transform(rawAgg,CHART_TYPE,chartTypeOptions());
      const lastBar=agg[agg.length-1],data=lastBar?seriesDataForLast(lastBar):null;
      if(data)cs.update(data);
      if(lastBar)vs.update(QLChartTypes.dataForVolume([lastBar],chartTypeColors())[0]);
    }catch(e){chErr("cs.update",e);try{rebuild(false)}catch(x){chErr("rebuild",x)}return}
  }
  CHW.applied=Date.now();
  const n=performance.now();if(n-liveIndAt>330){liveIndAt=n;clearTimeout(liveIndT);safeInd()}else{clearTimeout(liveIndT);liveIndT=setTimeout(()=>{liveIndAt=performance.now();safeInd()},330)}
}
let liveIndAt=0,liveIndT=0;
const safeInd=()=>{try{liveInd()}catch(e){chErr("liveInd",e)}};
/* Bù nến M1 bị thiếu. applyLive() chỉ nối đúng nến live hiện tại, nên khi tab bị ẩn (poll() dừng), máy ngủ hoặc mạng chập vài phút thì các nến ở giữa
   KHÔNG BAO GIỜ được tải: chart bị hở, và với khung lớn thì high/low/open của nến hiện tại sai. Hàm này tải lại từ nến cuối tới giờ rồi ghép vào. */
let cuBusy=false,cuAt=0;
async function catchUp(){
  if(SUB()||cuBusy||loading||!ctReady()||!m1.length)return;
  const g=gen;cuBusy=true;cuAt=Date.now();
  try{
    const bars=await ctBars(s2u(m1[m1.length-1][0])-120,Math.floor(Date.now()/1000)+120);
    if(g!==gen||loading||!bars.length||!m1.length)return;
    const t0=bars[0][0];let i=m1.length;while(i>0&&m1[i-1][0]>=t0)i--;     // bỏ đuôi cũ từ nến đầu của đợt tải, nối đợt mới vào
    m1.length=i;for(const x of bars)m1.push(x);
    if(CT.liveBar)CT.barDirty=true;                                          // nến live (mới hơn tới từng tick) được áp lại ngay sau đó
    rebuild(false);
  }catch(e){}
  finally{cuBusy=false}
}
document.addEventListener("visibilitychange",()=>{if(!document.hidden)setTimeout(catchUp,300)});
/* Mỗi 250ms: lấy giá + nến live + footprint live mà ctrader.js đã nhận qua WebSocket (cTrader tự đẩy, không cần hỏi server). */
function poll(){
  if(document.hidden||!ctReady())return;
  try{
    if(CT.quoteDirty&&CT.bid>0){
      CT.quoteDirty=false;const d=CT.sym.digits,bid=(CT.bid/1e5).toFixed(d),ask=CT.ask>0?(CT.ask/1e5).toFixed(d):"–";
      $("bid").textContent=bid;$("ask").textContent=ask;
      try{if(window.baUpdate)baUpdate(C.sym,CT.bid/1e5,CT.ask/1e5)}catch(e){chErr("baUpdate",e)}   // đường Bid/Ask trên chart: lỗi ở đây không được chặn nến
    }
  }catch(e){chErr("quote",e)}
  try{
    if(SUB()){if(SB.dirty&&SB.ready&&!loading&&sb.length){SB.dirty=false;applyLive(sb[sb.length-1],sb)}}   // khung giây: nến chạy theo từng tick bid
    else if(CT.barDirty&&CT.liveBar&&m1.length&&!loading){
      if(CT.liveBar[0]-m1[m1.length-1][0]>120&&Date.now()-cuAt>15000)catchUp();   // nến live nhảy xa hơn 2 phút so với nến cuối: thiếu nến ở giữa
      CT.barDirty=false;applyLive(CT.liveBar)}
  }catch(e){chErr("applyLive",e)}
  try{ctFpIdle()}catch(e){chErr("ctFpIdle",e)}
  try{if(FPL.dirty){FPL.dirty=false;ctFpFlush();FPV++;FPLV++;dirty=true}}catch(e){chErr("ctFpFlush",e)}
  try{if(typeof domTick==="function")domTick()}catch(e){chErr("dom",e)}
  try{chartWatch()}catch(e){chErr("chartWatch",e)}
}
/* Có giá bid mới (CT.dirtyAt) mà nến không được áp trong > 6s => chart đang đứng. Khôi phục theo cấp, mỗi cấp chỉ chạy 1 lần cho tới khi chart chạy lại. */
function chartWatch(){
  const n=Date.now(),pg=CHW.pt?n-CHW.pt:0;CHW.pt=n;
  /* đang tải lịch sử dài (kéo chart) hoặc luồng chính vừa bị nghẽn >2s (dựng lại hàng trăm nghìn nến) thì không phải chart đứng: bỏ qua, không khôi phục */
  if(fillBusy||pg>2000){CHW.applied=n;if(CHW.lvl)CHW.lvl=0;return}
  if(loading&&CHW.loadAt&&n-CHW.loadAt>CHW.loadMax){CHW.loadAt=0;loading=false;chErr("loading","kẹt quá "+Math.round(CHW.loadMax/1e3)+"s, tải lại");loadM1(true);return}
  if(loading||!baseArr().length)return;
  const lag=CT.dirtyAt>CHW.applied&&n-CT.dirtyAt<3000?n-CHW.applied:0;
  if(lag<CHW.stale){if(CHW.lvl){CHW.lvl=0;status(baseArr().length+(SUB()?" nến 1 giây · tick":" nến M1 · cTrader"),"ok")}return}
  if(lag>=CHW.reload&&CHW.lvl<3){CHW.lvl=3;CHW.applied=n;status("Chart đứng, đang tải lại (giữ dữ liệu đã tải)…","bad");loadM1(true);return}
  if(lag>=CHW.mid&&CHW.lvl<2){CHW.lvl=2;status("Chart chậm cập nhật, đang bù nến…","bad");catchUp();return}
  if(CHW.lvl<1){CHW.lvl=1;status("Chart chậm cập nhật, đang khôi phục…","bad");rebuild(false);CT.barDirty=true}
}
function buildTfs(){
  const quick=[...TFS,...TFF.filter(s=>!TFS.some(t=>t[1]===s)).slice(0,4).map(s=>[tfName(s),s])];
  if(!quick.some(t=>t[1]===C.tf))quick.push([tfName(C.tf),C.tf]);
  $("tfs").innerHTML=quick.map(([name,sec])=>{const custom=CTF.includes(sec);return`<button type="button" class="tf${sec===C.tf?" on":""}${custom?" cu":""}" data-s="${sec}" title="${name}">${name}${custom?`<i class="x" data-del="${sec}" role="button" title="Xoá khung này" aria-label="Xoá khung này">×</i>`:""}</button>`}).join("")
    +`<button type="button" class="tf tf-more" id="tfMore" title="Tất cả timeframe" aria-label="Tất cả timeframe" aria-haspopup="dialog">⋯</button>`
    +`<button type="button" class="tf tf-add" id="tfAdd" title="Tạo custom timeframe" aria-label="Tạo custom timeframe" aria-haspopup="dialog">+</button>`;
}
const applyTfOpts=()=>allCh().forEach(x=>x.applyOptions({timeScale:{secondsVisible:SUB()}}));
function setTf(s){
  if(!okTf(s))return;
  const was=SUB();C.tf=s;sv("tp_tf",s);buildTfs();applyTfOpts();
  if(SUB()){if(!was||!sb.length)loadSub();else{rebuild(true);fillLeft()}}
  else if(was){rebuild(true);loadM1()}      // từ khung giây về khung phút: nến M1 cũ vẽ ngay, rồi tải lại cho mới
  else rebuild(true);
  tfNote();
}
function tfNote(){   // Footprint / Big Trade / Statistic cần dữ liệu theo phút
  if(!SUB())return;try{if(fpOn()||btOn()||stOn()||haOn())status("Footprint / Big Trade / Statistic / Heavy Absorption cần khung từ M1 trở lên","bad")}catch{}
}
function delTf(s){CTF=CTF.filter(x=>x!==s);TFF=TFF.filter(x=>x!==s);saveCtf();saveTfFavs();if(C.tf===s)setTf(900);else buildTfs()}
$("tfs").onclick=e=>{
  const del=e.target.closest("[data-del]");if(del){e.stopPropagation();delTf(+del.dataset.del);if(tfP)tfMorePop($("tfMore"));return}
  const b=e.target.closest("button");if(!b)return;
  if(b.id==="tfAdd"){tfPop(b);return}
  if(b.id==="tfMore"){tfMorePop(b);return}
  if(b.dataset.s)setTf(+b.dataset.s);
};
/* Bộ chọn timeframe mở rộng: nhóm theo đơn vị, tìm kiếm, favorite và xóa custom interval. */
let tfP=null;
function tfMorePop(btn){
  if(tfP){tfClose();return}
  const el=document.createElement("div");el.className="tfp tfp-more";el.setAttribute("role","dialog");el.setAttribute("aria-label","Chọn timeframe");
  const all=allTfs(),groups=[
    ["SECONDS · TICK",all.filter(x=>x[1]<60)],
    ["MINUTES",all.filter(x=>x[1]>=60&&x[1]<3600)],
    ["HOURS",all.filter(x=>x[1]>=3600&&x[1]<86400)],
    ["DAYS",all.filter(x=>x[1]>=86400&&x[1]<604800)],
    ["WEEKS",all.filter(x=>x[1]>=604800)]
  ].filter(g=>g[1].length);
  const item=([name,sec])=>`<div class="tfpi" data-tf-item data-label="${name.toLowerCase()} ${sec<60?sec+"s":sec%604800===0?sec/604800+"w":sec%86400===0?sec/86400+"d":sec%3600===0?sec/3600+"h":sec/60+"m"}"><button type="button" class="tfpick${sec===C.tf?" active":""}" data-s="${sec}">${name}${sec===C.tf?" <span>ACTIVE</span>":""}</button><button type="button" class="tffav${TFF.includes(sec)?" on":""}" data-fav="${sec}" title="${TFF.includes(sec)?"Bỏ yêu thích":"Thêm yêu thích"}" aria-label="${TFF.includes(sec)?"Bỏ yêu thích":"Thêm yêu thích"} ${name}">★</button>${CTF.includes(sec)?`<button type="button" class="tfdel" data-del="${sec}" title="Xóa custom timeframe" aria-label="Xóa ${name}">×</button>`:""}</div>`;
  el.innerHTML=`<div class="tfp-head"><strong>Timeframe Library</strong><button type="button" class="tfp-close" aria-label="Đóng">×</button></div><input class="tfp-search" type="search" placeholder="Tìm M3, H2, 45m…" autocomplete="off"><div class="tfp-favlabel">FAVORITES · Tối đa ${TF_FAV_CAP}</div><div class="tfp-favs">${TFF.length?TFF.map(s=>item([tfName(s),s])).join(""):`<span class="tfp-muted">Chưa có favorite. Nhấn ★ để ghim timeframe.</span>`}</div><div class="tfp-groups">${groups.map(([title,items])=>`<section class="tfp-group"><h4>${title}</h4><div class="tfp-grid">${items.map(item).join("")}</div></section>`).join("")}</div><div class="tfp-foot"><span>${CTF.length}/${TF_CAP} custom</span><button type="button" class="btn sm" data-create>+ Custom timeframe</button></div><div class="tfp-message" aria-live="polite"></div>`;
  document.body.appendChild(el);tfP=el;
  const r=btn.getBoundingClientRect(),w=el.offsetWidth,L=Math.max(8,Math.min(r.left,innerWidth-w-8));
  el.style.left=L+"px";el.style.top=Math.min(r.bottom+6,Math.max(8,innerHeight-el.offsetHeight-8))+"px";
  const search=el.querySelector(".tfp-search");
  search.addEventListener("input",()=>{const q=search.value.trim().toLowerCase();el.querySelectorAll("[data-tf-item]").forEach(x=>x.hidden=!!q&&!x.dataset.label.includes(q));el.querySelectorAll(".tfp-group").forEach(g=>g.hidden=!g.querySelector("[data-tf-item]:not([hidden])"));});
  el.addEventListener("click",ev=>{
    const fav=ev.target.closest("[data-fav]");
    if(fav){const sec=+fav.dataset.fav;if(TFF.includes(sec))TFF=TFF.filter(x=>x!==sec);else if(TFF.length<TF_FAV_CAP)TFF.push(sec);else{el.querySelector(".tfp-message").textContent="Đã đạt giới hạn favorite. Hãy bỏ ghim một khung trước.";return}saveTfFavs();const q=search.value;tfClose();buildTfs();tfMorePop($("tfMore"));if(tfP){const s=tfP.querySelector(".tfp-search");s.value=q;s.dispatchEvent(new Event("input"));}return}
    if(ev.target.closest(".tfp-close")){tfClose();return}
    if(ev.target.closest("[data-create]")){const anchor=$("tfAdd");tfClose();tfPop(anchor);return}
    const del=ev.target.closest("[data-del]");if(del){const q=search.value;delTf(+del.dataset.del);tfClose();tfMorePop($("tfMore"));if(tfP){const next=tfP.querySelector(".tfp-search");next.value=q;next.dispatchEvent(new Event("input"));}return}
    const pick=ev.target.closest("[data-s]");if(pick){const sec=+pick.dataset.s;tfClose();setTf(sec)}
  });
  setTimeout(()=>{document.addEventListener("pointerdown",tfOut,true)},0);
  search.focus();
}
/* Ô tạo custom timeframe; giữ giới hạn tick <60s và tổng hợp M1 cho khung từ 1 phút. */
function tfPop(btn){
  if(tfP){tfClose();return}
  const el=document.createElement("div");el.className="tfp tfp-create";el.setAttribute("role","dialog");el.setAttribute("aria-label","Khung tuỳ chọn");
  el.innerHTML=`<div class="tfp-head"><strong>Custom timeframe</strong><button type="button" class="tfp-close" aria-label="Đóng">×</button></div><div class="tfp-hint">Tạo khung riêng từ tick hoặc nến M1</div><div class="tfpr"><input type="number" id="tfpN" min="1" step="1" inputmode="numeric" aria-label="Số" placeholder="Ví dụ 7"><select id="tfpU" aria-label="Đơn vị"><option value="s">Giây</option><option value="m" selected>Phút</option><option value="h">Giờ</option><option value="d">Ngày</option><option value="w">Tuần</option></select></div><div class="tfpm" id="tfpM" aria-live="polite"></div><button type="button" class="btn sm" id="tfpOk">Dùng timeframe này</button>`;
  document.body.appendChild(el);tfP=el;
  const r=btn.getBoundingClientRect(),w=el.offsetWidth,L=Math.max(8,Math.min(r.left,innerWidth-w-8));
  el.style.left=L+"px";el.style.top=Math.min(r.bottom+6,Math.max(8,innerHeight-el.offsetHeight-8))+"px";
  const n=el.querySelector("#tfpN"),u=el.querySelector("#tfpU"),m=el.querySelector("#tfpM");
  const go=()=>{
    const v=Math.round(+n.value),sec=v*TF_UNIT[u.value];
    if(!(v>=1)){m.textContent="Nhập số từ 1 trở lên";return}
    if(u.value==="s"&&v>59){m.textContent="Khung giây tối đa 59s; từ 1 phút hãy chọn đơn vị Phút";return}
    if(sec>TF_MAX){m.textContent="Tối đa 4 tuần";return}
    if(!okTf(sec)){m.textContent="Khung không hợp lệ";return}
    if(!isPresetTf(sec)&&!CTF.includes(sec)){
      if(CTF.length>=TF_CAP){m.textContent="Đã đạt giới hạn "+TF_CAP+" custom timeframe. Hãy xóa bớt trong Timeframe Library.";return}
      CTF.push(sec);CTF.sort((a,b)=>a-b);saveCtf();
    }
    tfClose();setTf(sec);
  };
  el.querySelector("#tfpOk").onclick=go;el.querySelector(".tfp-close").onclick=tfClose;
  el.addEventListener("keydown",ev=>{if(ev.key==="Enter"){ev.preventDefault();go()}else if(ev.key==="Escape"){tfClose();btn.focus()}});
  setTimeout(()=>{document.addEventListener("pointerdown",tfOut,true)},0);n.focus();
}
const tfOut=e=>{if(tfP&&!tfP.contains(e.target)&&!e.target.closest("#tfAdd,#tfMore"))tfClose()};
function tfClose(){if(tfP){tfP.remove();tfP=null}document.removeEventListener("pointerdown",tfOut,true)}
$("sym").value=C.sym;
buildChartTypePicker();
/* đổi mã: xem symbols.js (ô chọn mã tuỳ biến) */

/* ================= KHUNG GIÂY (< 60 giây) =================
   cTrader chỉ có nến từ M1 trở lên, nên khung giây được dựng từ TICK bid (giống nến M1 của cTrader cũng tính theo bid):
   - lịch sử: GetTickData (ctTicks) gom thành nến 1 giây vào sb = [giờ server, o, h, l, c, số tick], rồi rebuild() gom tiếp theo khung đang chọn (5s, 15s, 30s...);
   - live: mỗi báo giá bid (ctSpot -> sbLive) cập nhật nến 1 giây cuối, poll() áp lên chart.
   Volume = số lần bid đổi giá (tick volume). Tick tải THEO NHU CẦU như M1: lần đầu 30 phút gần nhất, kéo chart sang trái thì tải thêm (tối đa 24 giờ). */
const SB={q:[],ready:false,dirty:false};
let sbOld=0,sbSpan=3600e3,sbNoMore=false,sbEmpty=0,sbOffH=-1,sbOffV=0;
const SB_FIRST=1800e3,SB_MAXSPAN=4*3600e3,SB_CAP=24*3600e3,SB_GIVEUP=3*86400e3;
const sbOff=u=>{const h=Math.floor(u/3600);if(h!==sbOffH){sbOffH=h;sbOffV=u2s(h*3600)-h*3600}return sbOffV};   // chênh lệch UTC -> giờ server (đổi theo giờ cho nhanh)
function sbBuild(T){
  const out=[];let cur=null;
  for(const [t,p] of T){const u=Math.floor(t/1000),k=u+sbOff(u),v=p/1e5;
    if(!cur||cur[0]!==k){cur=[k,v,v,v,v,1];out.push(cur)}
    else{if(v>cur[2])cur[2]=v;if(v<cur[3])cur[3]=v;cur[4]=v;cur[5]++}}
  return out;
}
function sbJoin(a,b){   // a = nến cũ hơn, b = nến hiện có; nến 1 giây nằm vắt qua ranh giới thì gộp lại
  if(a.length&&b.length&&a[a.length-1][0]===b[0][0]){const x=a.pop(),y=b[0];y[1]=x[1];if(x[2]>y[2])y[2]=x[2];if(x[3]<y[3])y[3]=x[3];y[5]+=x[5]}
  return a.concat(b);
}
function sbPush(ts,v){
  const u=Math.floor(ts/1000),k=u+sbOff(u),L=sb[sb.length-1];
  if(L&&L[0]===k){if(v>L[2])L[2]=v;if(v<L[3])L[3]=v;L[4]=v;L[5]++}
  else if(!L||k>L[0])sb.push([k,v,v,v,v,1]);
  else return;
  SB.dirty=true;CT.dirtyAt=Date.now();
}
function sbLive(ts,bid){   // ctSpot gọi cho mỗi báo giá có bid
  if(!SUB())return;
  if(!SB.ready){if(SB.q.length<100000)SB.q.push([ts,bid]);return}   // đang tải lịch sử: giữ lại, phát lại sau để không hở
  sbPush(ts,bid/1e5);
}
const sbStatus=()=>status(sb.length+" nến 1 giây · tick cTrader"+(sbNoMore?" · đã tới giới hạn lịch sử":""),"ok");
async function loadSub(){
  const g=++gen;loading=true;CHW.loadAt=Date.now();fillBusy=false;sbNoMore=false;sbEmpty=0;sbSpan=3600e3;fillRetry=0;SB.ready=false;SB.q=[];SB.dirty=false;
  try{
    status("Đang kết nối cTrader…");
    try{await ctEnsure()}catch(e){if(g===gen)status("cTrader: "+why(e),"bad");return}
    if(g!==gen)return;
    status("Đang tải tick…");
    const hi=Date.now();let top=hi,span=SB_FIRST,T=[],miss=0;
    for(;;){                                              // cuối tuần/ngày lễ không có tick: lùi dần tới khi có
      const lo=top-span;T=await ctTicks(1,lo,top);
      if(g!==gen)return;
      sbOld=lo;
      if(T.length)break;
      miss+=top-lo;top=lo;span=Math.min(span*2,86400e3);
      if(miss>=SB_GIVEUP){sbNoMore=true;break}
    }
    sb=sbBuild(T);SB.ready=true;
    const q=SB.q;SB.q=[];for(const [t,b] of q)if(t>hi)sbPush(t,b/1e5);   // tick live tới trong lúc tải
    rebuild(true);symReset();
    if(sb.length)sbStatus();else status("Chưa có tick cho "+C.sym+" (thị trường đóng cửa hoặc broker không lưu tick)","bad");
    tfNote();
  }catch(e){status("Lỗi tải tick: "+why(e),"bad");SB.ready=true;SB.q=[]}
  finally{if(g===gen){loading=false;CHW.loadAt=0;if(sb.length)subFill()}}
}
async function subFill(){
  if(!SUB()||fillBusy||loading||sbNoMore||!sb.length||Date.now()<fillRetry)return;
  const g=gen,ts=chart.timeScale();fillBusy=true;
  try{
    for(;;){
      const r=ts.getVisibleLogicalRange();
      if(!r||r.from>=40)break;
      if(Date.now()-sbOld>=SB_CAP){sbNoMore=true;break}
      status("Đang tải thêm tick cũ… "+sb.length+" nến");
      const top=sbOld,lo=top-sbSpan,T=await ctTicks(1,lo,top-1);
      if(g!==gen||!SUB())return;
      sbOld=lo;sbSpan=Math.min(sbSpan*2,SB_MAXSPAN);
      if(T.length){sbEmpty=0;prependM1(sbBuild(T))}
      else{sbEmpty+=top-lo;if(sbEmpty>=SB_GIVEUP){sbNoMore=true;break}}
    }
    sbStatus();
  }catch(e){fillRetry=Date.now()+5000;status("Lỗi tải thêm tick cũ: "+why(e),"bad")}
  finally{if(g===gen)fillBusy=false}
}
