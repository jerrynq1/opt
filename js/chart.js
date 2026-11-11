/* ================= CHART ================= */
let m1=[],agg=[],sb=[],loading=false,busy=false,gen=0;
const SUB=()=>C.tf<60,baseArr=()=>SUB()?sb:m1;   // khung giây (< 60s) dựng từ sb (nến 1 giây từ tick), các khung còn lại dựng từ m1 (nến M1)
const baseSig=()=>{const A=baseArr(),l=A[A.length-1];return l?l[5]+","+l[4]:"0,0"};
const COL=()=>P.theme==="dark"?{up:"#3df5c0",dn:"#ff5c8a",tx:"#c4b79a",gr:"rgba(244,201,106,.08)",bd:"rgba(244,201,106,.22)"}:{up:"#08987a",dn:"#d6336c",tx:"#7a6740",gr:"rgba(176,116,26,.1)",bd:"rgba(176,116,26,.25)"};
const chart=LightweightCharts.createChart($("chart"),{layout:{background:{color:"transparent"},textColor:"#c4b79a",fontFamily:"Space Grotesk"},rightPriceScale:{borderColor:"rgba(244,201,106,.22)"},timeScale:{timeVisible:true,secondsVisible:false},crosshair:{mode:0},autoSize:true});
const cs=chart.addCandlestickSeries({borderVisible:false});
const vs=chart.addHistogramSeries({priceFormat:{type:"volume"},priceScaleId:"vol"});
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
chart.subscribeCrosshairMove(p=>{const d=p.seriesData&&p.seriesData.get(cs);{const f=v=>(+v).toFixed(PDIG());$("ohlc").textContent=d?`O ${f(d.open)}   H ${f(d.high)}   L ${f(d.low)}   C ${f(d.close)}`:""}});
function themeChart(){
  const c=COL();
  allCh().forEach(x=>x.applyOptions({layout:{textColor:c.tx},rightPriceScale:{borderColor:c.bd},timeScale:{borderColor:c.bd}}));
  applyCand();
  if(agg.length)rebuild(false);
}
const vcol=(o,c)=>(c>=o?eff().up:eff().dn)+"55";
function status(t,c){const e=$("st");e.textContent=t;e.className="pill "+(c||"")}
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
chart.timeScale().subscribeVisibleLogicalRangeChange(r=>{
  if(!r)return;
  if(r.from<40)fillLeft();
  clearTimeout(fpKick);fpKick=setTimeout(()=>{if(window.fpSync)fpSync()},400);   // footprint tick cũng tải thêm theo vùng đang xem
});
const bucket=(t,tf)=>tf>=604800&&tf%604800===0?Math.floor((t-345600)/tf)*tf+345600:Math.floor(t/tf)*tf;
function rebuild(fit){
  const raw=[];let cur=null;
  for(const x of baseArr()){
    const k=bucket(x[0],C.tf);
    if(!cur||cur.st!==k){cur={st:k,time:0,open:x[1],high:x[2],low:x[3],close:x[4],v:x[5]};raw.push(cur)}
    else{if(x[2]>cur.high)cur.high=x[2];if(x[3]<cur.low)cur.low=x[3];cur.close=x[4];cur.v+=x[5]}
  }
  // đổi sang giờ hiển thị; chart cần thời gian tăng dần, nên lúc đổi giờ mùa làm giờ lùi lại thì bỏ các nến trùng giờ
  agg=[];let lastT=-1;
  for(const b of raw){b.time=disp(b.st);if(b.time>lastT){agg.push(b);lastT=b.time}}
  applyPrec();
  cs.setData(agg);
  vs.setData(agg.map(c=>({time:c.time,value:c.v,color:vcol(c.open,c.close)})));
  if(fit)chart.timeScale().scrollToRealTime();   // đổi khung giờ: về nến mới nhất (dữ liệu cũ hơn tự tải khi kéo sang trái)
  renderInd();
}
function applyLive(b,A){
  A=A||m1;const last=A[A.length-1];
  if(last&&last[0]===b[0])A[A.length-1]=b;else if(!last||b[0]>last[0])A.push(b);else{if(Date.now()-cuAt>15000)catchUp();return}   // nến live cũ hơn nến cuối: dữ liệu lệch, bù lại thay vì im lặng bỏ qua
  const k=bucket(b[0],C.tf);let o,h,l,c,v=0;
  for(let i=A.length-1;i>=0&&A[i][0]>=k;i--){const x=A[i];o=x[1];c=c??x[4];h=Math.max(h??x[2],x[2]);l=Math.min(l??x[3],x[3]);v+=x[5]}
  if(o===undefined)return;
  const bar={st:k,time:disp(k),open:o,high:h,low:l,close:c,v},a=agg[agg.length-1];
  if(a&&a.st===k)agg[agg.length-1]=bar;else if(!a||bar.time>a.time)agg.push(bar);else{if(Date.now()-cuAt>15000)catchUp();return}
  try{cs.update(bar);vs.update({time:bar.time,value:v,color:vcol(o,c)})}
  catch(e){chErr("cs.update",e);try{rebuild(false)}catch(x){chErr("rebuild",x)}return}   // series lệch thứ tự thời gian...: dựng lại từ m1
  CHW.applied=Date.now();
  /* chỉ báo tính lại trên toàn bộ nến nên khá nặng: tối đa ~3 lần/giây (nến + giá vẫn cập nhật từng tick) */
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
  const L=allTfs();if(!L.some(t=>t[1]===C.tf)){L.push([tfName(C.tf),C.tf]);L.sort((a,b)=>a[1]-b[1])}   // khung đang chọn đã bị xoá khỏi danh sách: vẫn hiện tới khi đổi khung
  $("tfs").innerHTML=L.map(([n,s])=>{const cu=CTF.includes(s);return`<button class="tf${s===C.tf?" on":""}${cu?" cu":""}" data-s="${s}">${n}${cu?`<i class="x" data-del="${s}" role="button" title="Xoá khung này" aria-label="Xoá khung này">×</i>`:""}</button>`}).join("")
    +`<button type="button" class="tf" id="tfAdd" title="Khung tuỳ chọn" aria-label="Khung tuỳ chọn" aria-haspopup="dialog">+</button>`;
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
function delTf(s){CTF=CTF.filter(x=>x!==s);saveCtf();if(C.tf===s)setTf(900);else buildTfs()}
$("tfs").onclick=e=>{
  const x=e.target.closest("[data-del]");if(x){e.stopPropagation();delTf(+x.dataset.del);return}
  const b=e.target.closest("button");if(!b)return;
  if(b.id==="tfAdd"){tfPop(b);return}
  setTf(+b.dataset.s);
};
/* Ô nhập khung tuỳ chọn (nổi, gắn vào body để không bị thanh khung giờ cuộn ngang cắt mất) */
let tfP=null;
function tfPop(btn){
  if(tfP){tfClose();return}
  const el=document.createElement("div");el.className="tfp";el.setAttribute("role","dialog");el.setAttribute("aria-label","Khung tuỳ chọn");
  el.innerHTML=`<div class="tfpt">Khung tuỳ chọn</div><div class="tfpr"><input type="number" id="tfpN" min="1" step="1" inputmode="numeric" aria-label="Số" placeholder="vd 7"><select id="tfpU" aria-label="Đơn vị"><option value="s">Giây</option><option value="m" selected>Phút</option><option value="h">Giờ</option><option value="d">Ngày</option><option value="w">Tuần</option></select></div><div class="tfpm" id="tfpM"></div><button type="button" class="btn sm" id="tfpOk">Dùng khung này</button>`;
  document.body.appendChild(el);tfP=el;
  const r=btn.getBoundingClientRect(),w=el.offsetWidth,L=Math.max(8,Math.min(r.left,innerWidth-w-8));
  el.style.left=L+"px";el.style.top=Math.min(r.bottom+6,Math.max(8,innerHeight-el.offsetHeight-8))+"px";
  const n=el.querySelector("#tfpN"),u=el.querySelector("#tfpU"),m=el.querySelector("#tfpM");
  const go=()=>{
    const v=Math.round(+n.value),s=v*TF_UNIT[u.value];
    if(!(v>=1)){m.textContent="Nhập số từ 1 trở lên";return}
    if(u.value==="s"&&v>59){m.textContent="Giây chỉ nhận 1–59 (từ 60 giây hãy chọn Phút)";return}
    if(s>TF_MAX){m.textContent="Tối đa 4 tuần";return}
    if(!okTf(s)){m.textContent="Khung không hợp lệ";return}
    if(!TFS.some(t=>t[1]===s)&&!CTF.includes(s)){
      if(CTF.length>=TF_CAP){m.textContent="Tối đa "+TF_CAP+" khung tuỳ chọn, hãy xoá bớt (dấu × trên nút khung)";return}
      CTF.push(s);CTF.sort((a,b)=>a-b);saveCtf();
    }
    tfClose();setTf(s);
  };
  el.querySelector("#tfpOk").onclick=go;
  el.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();go()}else if(e.key==="Escape"){tfClose();btn.focus()}});
  setTimeout(()=>{document.addEventListener("pointerdown",tfOut,true)},0);
  n.focus();
}
const tfOut=e=>{if(tfP&&!tfP.contains(e.target)&&!e.target.closest("#tfAdd"))tfClose()};
function tfClose(){if(tfP){tfP.remove();tfP=null}document.removeEventListener("pointerdown",tfOut,true)}
$("sym").value=C.sym;
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
