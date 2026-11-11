/* ----- thông số: dựng ô nhập, đọc giá trị, chuẩn hóa dữ liệu cũ ----- */
const opts=o=>(o||[]).map(x=>Array.isArray(x)?x:[x,x]);
const pdef=d=>Object.fromEntries(d.p.map(x=>[x[0],x[2]]));
const pshow=(sp,p)=>!(sp[4]&&sp[4].on)||sp[4].on(p);
function pin(sp,val,pre,st){
  const k=sp[0],ty=sp[3]||"n",o=sp[4]||{},id=pre+k;
  if(ty==="b")return`<input type="checkbox" id="${id}" data-p="${k}"${val?" checked":""}>`;
  if(ty==="t")return`<input type="text" id="${id}" data-p="${k}" value="${String(val==null?"":val).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;")}" autocomplete="off" spellcheck="false"${st?` style="${st}"`:""}>`;
  if(ty==="ta")return`<textarea id="${id}" data-p="${k}" rows="${o.rows||5}" autocomplete="off" spellcheck="false" style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px">${String(val==null?"":val).replace(/&/g,"&amp;").replace(/</g,"&lt;")}</textarea>`;
  if(ty==="s")return`<select id="${id}" data-p="${k}"${st?` style="${st}"`:""}>${opts(o.o).map(([v,t])=>`<option value="${v}"${v===val?" selected":""}>${t}</option>`).join("")}</select>`;
  return`<input type="number" step="${o.step||(ty==="i"?1:"any")}"${o.min!==undefined?` min="${o.min}"`:""}${o.max!==undefined?` max="${o.max}"`:""} id="${id}" data-p="${k}" value="${val}"${st?` style="${st}"`:""}>`}
function setP(a,d,k,t){
  const sp=d.p.find(x=>x[0]===k);if(!sp)return;const ty=sp[3]||"n",o=sp[4]||{};let v;
  if(ty==="b")v=!!t.checked;
  else if(ty==="s")v=t.value;
  else if(ty==="t"||ty==="ta")v=String(t.value);
  else{v=parseFloat(t.value);const mn=o.min!==undefined?o.min:1e-9;if(!isFinite(v)||v<mn)v=sp[2];if(o.max!==undefined&&v>o.max)v=o.max;if(ty==="i")v=Math.round(v);t.value=v}
  a.p[k]=v}
/* NHỚ cài đặt theo từng loại indicator: thông số, màu, độ dày. Thêm lại indicator (sau khi xóa hoặc tải lại trang) sẽ dùng lại bộ cài đặt đã chỉnh gần nhất. Nút "Mặc định" trong hộp thoại vẫn đưa về mặc định gốc. */
const TPK="tp_ind_tpl";let TPL={};try{TPL=JSON.parse(ld(TPK,"{}"))||{}}catch{TPL={}}
function remTpl(a){if(!a||!IND[a.key])return;TPL[a.key]={ver:a.ver||0,p:{...a.p},c:[...a.c],w:a.w};sv(TPK,JSON.stringify(TPL))}
const mkA=key=>{const d=IND[key],a={id:Date.now().toString(36)+Math.random().toString(36).slice(2,5),key,ver:d.ver||0,p:pdef(d),c:[...d.c],on:true},t=TPL[key];
  if(t&&(t.ver||0)===(d.ver||0)){Object.entries(t.p||{}).forEach(([k,v])=>{if(k in a.p&&typeof v===typeof a.p[k])a.p[k]=v});a.c=d.c.map((x,j)=>(t.c&&t.c[j])||x);if(t.w)a.w=t.w}
  return a};
function normA(a){                                   // chuẩn hóa chỉ báo đã lưu: thêm thông số mới, giữ giá trị cũ; bản làm lại (ver mới) thì dùng bộ màu mặc định mới
  const d=IND[a.key],dp=pdef(d),old=a.p||{};
  a.p=Object.assign(dp,Object.fromEntries(Object.entries(old).filter(([k,v])=>k in dp&&typeof v===typeof dp[k])));
  if((d.ver||0)!==(a.ver||0)){a.c=[...d.c];a.ver=d.ver||0;delete a.w}
  else a.c=d.c.map((x,j)=>(a.c&&a.c[j])||x);
  return a}
const ALLOWED_IND_GROUPS=new Set(["of","mm"]);
let ACT=[];try{const stored=JSON.parse(ld("tp_ind","[]"))||[];ACT=stored.filter(a=>a&&IND[a.key]&&ALLOWED_IND_GROUPS.has(IND[a.key].t)).map(normA);if(ACT.length!==stored.length)sv("tp_ind",JSON.stringify(ACT))}catch{}
const saveInd=()=>sv("tp_ind",JSON.stringify(ACT));
const isOn=a=>a.on&&(!a.vis||a.vis.includes(C.tf));
let SER={},LV={},SM={};
const conv=(t,s)=>{
  const a=s.d,o=[];
  if(s.sp){a.forEach(x=>o.push({time:x.t,value:x.v,color:x.c}));return o}
  a.forEach((v,i)=>{
    if(v==null||(typeof v==="number"&&!isFinite(v))){o.push({time:t[i]});return}
    if(s.k==="f"){if(v.top==null||v.bottom==null||!isFinite(v.top)||!isFinite(v.bottom))o.push({time:t[i]});else o.push({time:t[i],top:v.top,bottom:v.bottom,color:v.col,n:i})}
    else if(s.k==="c")o.push({time:t[i],open:v.o,high:v.h,low:v.l,close:v.v,color:v.col,borderColor:v.col,wickColor:v.col});
    else o.push(typeof v==="object"?{time:t[i],value:v.v,color:v.c}:{time:t[i],value:v})});
  return o};
function calcAll(){
  const A={t:agg.map(x=>x.time),s:agg.map(x=>x.st),o:agg.map(x=>x.open),h:agg.map(x=>x.high),l:agg.map(x=>x.low),c:agg.map(x=>x.close),v:agg.map(x=>x.v)},E=eff();
  return ACT.map(a=>{
    if(!isOn(a)||IND[a.key].t==="of"||IND[a.key].t==="mm")return null;
    const off=a.p.offset?Math.round(a.p.offset):0;
    return IND[a.key].f(A,a.p,E,a).map((s,j)=>{
      if(off&&!s.sp)s={...s,d:shiftA(s.d,off)};
      const ci=s.ci!==undefined?s.ci:(s.k==="l"&&!s.sp?j:null),lg=s.lg!==undefined?s.lg:(s.k!=="f"&&!s.sp);
      return{...s,ci,lg,raw:s.d,data:conv(A.t,s)}})});
}
/* Vùng tô giữa 2 đường (fill() của Pine) và gradient: vẽ bằng custom series của lightweight-charts */
class FillR{
  constructor(){this.d=null;this.o=null}
  update(d,o){this.d=d;this.o=o}
  draw(target,pc){
    target.useBitmapCoordinateSpace(({context:ctx,horizontalPixelRatio:hr,verticalPixelRatio:vr})=>{try{          // lỗi khi vẽ vùng tô không được làm hỏng cả chart
      const d=this.d,o=this.o;if(!d||!d.visibleRange||!d.bars.length)return;
      const B=d.bars,f=Math.max(0,d.visibleRange.from-1),t=Math.min(B.length-1,d.visibleRange.to+1);
      let run=[],rcol=null,pn=-9;
      const paint=()=>{
        if(run.length>1){
          ctx.beginPath();run.forEach((r,i)=>i?ctx.lineTo(r[0],r[1]):ctx.moveTo(r[0],r[1]));
          for(let i=run.length-1;i>=0;i--)ctx.lineTo(run[i][0],run[i][2]);
          ctx.closePath();
          if(o.gy1!=null&&o.gy2!=null&&o.gc1&&o.gc2){
            const y1=pc(o.gy1),y2=pc(o.gy2);
            if(y1!=null&&y2!=null&&y1!==y2){const g=ctx.createLinearGradient(0,y1*vr,0,y2*vr);g.addColorStop(0,o.gc1);g.addColorStop(1,o.gc2);ctx.fillStyle=g}else ctx.fillStyle=o.gc1;
          }else ctx.fillStyle=rcol||o.color;
          ctx.fill()}
        run=[];rcol=null};
      for(let i=f;i<=t;i++){
        const b=B[i],q=b.originalData;
        if(q.top==null||q.bottom==null){paint();continue}
        const y1=pc(q.top),y2=pc(q.bottom);if(y1==null||y2==null){paint();continue}
        if(run.length&&(q.n!==pn+1||(q.color||null)!==rcol))paint();     // đứt quãng hoặc đổi màu thì tô đoạn mới
        if(!run.length)rcol=q.color||null;
        run.push([b.x*hr,y1*vr,y2*vr]);pn=q.n}
      paint()}catch(e){}})}
}
class FillView{
  constructor(){this._r=new FillR()}
  renderer(){return this._r}
  update(d,o){this._r.update(d,o)}
  priceValueBuilder(p){return[p.top,p.bottom]}
  isWhitespace(p){return p.top===undefined}
  defaultOptions(){return{color:"rgba(139,124,255,.1)",gy1:null,gy2:null,gc1:"",gc2:""}}
}
/* ===== Pane riêng cho chỉ báo dao động (RSI, MACD, Stochastic, ATR, CCI) giống TradingView =====
   Mỗi chỉ báo dao động là 1 chart nhỏ xếp dưới chart giá; cuộn/zoom và crosshair được đồng bộ giữa các chart. */
const val=x=>x==null?null:typeof x==="object"?x.v:x;
const lastV=raw=>{for(let i=raw.length-1;i>=0;i--){const v=val(raw[i]);if(v!=null&&isFinite(v))return v}return null};
const idxOf=t=>{let lo=0,hi=agg.length-1;while(lo<=hi){const m=(lo+hi)>>1,x=agg[m].time;if(x===t)return m;if(x<t)lo=m+1;else hi=m-1}return -1};
let RAW={},HOV=null,RSYNC=false;
const paneOf=c=>Object.values(PN).find(x=>x.ch===c);
function xsync(src,p){                          // đưa crosshair từ chart đang rê chuột sang các chart còn lại
  allCh().forEach(c=>{if(c===src||typeof c.setCrosshairPosition!=="function")return;
    try{
      const t=p&&p.time;
      if(t==null){c.clearCrosshairPosition();return}
      const i=idxOf(t),pn=paneOf(c),s=pn?pn.series&&pn.series[0]:cs,pr=i<0?null:pn?(pn.raw&&pn.raw[0]?val(pn.raw[0][i]):null):agg[i].close;
      if(pr!=null&&s)c.setCrosshairPosition(pr,t,s);else c.clearCrosshairPosition();
    }catch{}});
}
function horzOnly(ch){                          // đường ngang + nhãn giá chỉ hiện ở chart đang rê chuột; các chart còn lại chỉ có đường dọc
  allCh().forEach(c=>{try{c.applyOptions({crosshair:{horzLine:{visible:c===ch,labelVisible:c===ch}}})}catch{}});
}
function bindChart(ch,box){
  ch.subscribeCrosshairMove(p=>{if(HOV&&HOV!==ch)return;legend(p);xsync(ch,p)});   // sự kiện do đồng bộ lập trình thì bỏ qua
  ch.timeScale().subscribeVisibleLogicalRangeChange(r=>{
    if(!r||RSYNC)return;RSYNC=true;
    try{allCh().forEach(x=>{if(x!==ch)x.timeScale().setVisibleLogicalRange(r)})}catch{}
    RSYNC=false});
  box.addEventListener("pointerenter",()=>{HOV=ch;horzOnly(ch)});
  box.addEventListener("pointerleave",()=>{if(HOV===ch)HOV=null;allCh().forEach(c=>{try{c.clearCrosshairPosition()}catch{}});legend()});
}
function mkPane(a){
  const el=document.createElement("div");el.className="pn";el.dataset.pid=a.id;el.style.setProperty("--ph",(a.ph||130)+"px");
  el.innerHTML='<div class="rs" title="Kéo để đổi chiều cao" role="separator" aria-orientation="horizontal"></div><div class="pc"></div><div class="pl"></div>';
  $("panes").append(el);
  const c=COL(),g=eff().grid?c.gr:"rgba(0,0,0,0)",box=el.querySelector(".pc");
  const ch=LightweightCharts.createChart(box,{layout:{background:{color:"transparent"},textColor:c.tx,fontFamily:"Space Grotesk"},
    rightPriceScale:{borderColor:c.bd,scaleMargins:{top:.14,bottom:.14}},
    timeScale:{timeVisible:true,secondsVisible:SUB(),borderColor:c.bd,tickMarkFormatter:t=>tickFmt(t)},
    localization:{timeFormatter:t=>crossFmt(t)},grid:{vertLines:{color:g},horzLines:{color:g}},crosshair:{mode:0},autoSize:true});
  PN[a.id]={el,ch,lg:el.querySelector(".pl"),series:[],raw:[]};
  bindChart(ch,box);
}
function syncPanes(list){
  const want=new Set(list.map(a=>a.id));
  Object.keys(PN).forEach(id=>{if(!want.has(id)){const p=PN[id];try{p.ch.remove()}catch{}p.el.remove();delete PN[id]}});
  list.forEach(a=>{if(!PN[a.id])mkPane(a);$("panes").append(PN[a.id].el)});   // append lại để pane xếp đúng thứ tự thêm vào
  const chs=allCh();                                                       // trục thời gian chỉ hiện ở chart dưới cùng
  chs.forEach((c,i)=>c.applyOptions({timeScale:{visible:i===chs.length-1}}));
  horzOnly(HOV);
}
function alignPanes(){                                                     // cho mọi thang giá bên phải rộng bằng nhau để nến và chỉ báo thẳng cột
  try{const cs_=allCh();if(cs_.length<2)return;let w=0;
    cs_.forEach(c=>{w=Math.max(w,c.priceScale("right").width())});
    cs_.forEach(c=>c.priceScale("right").applyOptions({minimumWidth:w}));
    const r=chart.timeScale().getVisibleLogicalRange();
    if(r){RSYNC=true;try{cs_.forEach(c=>{if(c!==chart)c.timeScale().setVisibleLogicalRange(r)})}catch{}RSYNC=false}
  }catch{}
}
bindChart(chart,$("chart"));
$("panes").addEventListener("pointerdown",e=>{                              // kéo thanh phân cách để đổi chiều cao pane
  const hd=e.target.closest(".rs");if(!hd)return;
  const el=hd.parentElement,a=ACT.find(x=>x.id===el.dataset.pid);if(!a)return;
  e.preventDefault();const y0=e.clientY,h0=el.offsetHeight;hd.classList.add("on");try{hd.setPointerCapture(e.pointerId)}catch{}
  const mv=ev=>{const nh=Math.round(Math.max(70,Math.min(h0+(y0-ev.clientY),$("cw").clientHeight-180)));el.style.setProperty("--ph",nh+"px");a.ph=nh};
  const up=()=>{hd.classList.remove("on");hd.removeEventListener("pointermove",mv);hd.removeEventListener("pointerup",up);hd.removeEventListener("pointercancel",up);saveInd()};
  hd.addEventListener("pointermove",mv);hd.addEventListener("pointerup",up);hd.addEventListener("pointercancel",up);
});
function pfOf(def,rs){                              // định dạng số trên trục của pane: tự chọn số lẻ cho chỉ báo tính theo đơn vị giá (ATR, MACD)
  if(def.pf==="vol")return{type:"volume"};
  if(def.pf!=="auto")return null;
  let s=0,c=0;
  rs.forEach(x=>{if(x.k==="f"||x.sp)return;const r=x.raw;for(let i=r.length-1,m=0;i>=0&&m<300;i--){const v=val(r[i]);if(v!=null&&isFinite(v)){s+=Math.abs(v);c++;m++}}});
  const m=c?s/c:1,pr=m>=1?2:m>=.1?3:m>=.01?4:m>=.001?5:6;
  return{type:"price",precision:pr,minMove:Math.pow(10,-pr)}}
function mkSer(ch,a,s,pf,E){
  const base={priceLineVisible:false,lastValueVisible:false};
  if(s.k==="f"){
    const o={...base,color:s.ci!=null&&!s.g?hexA(cres(a,s.ci,E),s.al==null?.1:s.al):"rgba(0,0,0,0)"};
    if(s.g){const c=cres(a,s.ci,E);o.gy1=s.g.y1;o.gy2=s.g.y2;o.gc1=hexA(c,s.g.a1);o.gc2=hexA(c,s.g.a2)}
    return ch.addCustomSeries(new FillView(),o)}
  if(pf)base.priceFormat=pf;
  if(s.k==="h")return ch.addHistogramSeries(base);
  if(s.k==="c")return ch.addCandlestickSeries({...base,borderVisible:true,wickVisible:true});
  if(s.ps)base.priceScaleId=s.ps;                    // thang giá riêng (overlay, ẩn): đường không kéo giãn thang giá của nến
  const ln=ch.addLineSeries({...base,color:s.ci!=null?cres(a,s.ci,E):"#ffffff",lineWidth:s.lw||a.w||2,lineStyle:s.ls||0,crosshairMarkerVisible:false});
  if(s.ps){try{ch.priceScale(s.ps).applyOptions({visible:false,scaleMargins:s.pm||{top:.7,bottom:.03}})}catch{}}
  return ln}
function applyColor(a,j){                           // đổi 1 ô màu: cập nhật thẳng vào series, không dựng lại
  const ss=SER[a.id],ms=SM[a.id];if(!ss||!ms)return;const c=cres(a,j);
  ms.forEach((m,x)=>{if(m.ci!==j||!ss[x])return;
    try{if(m.k==="l")ss[x].applyOptions({color:c});
      else if(m.k==="f"&&m.g)ss[x].applyOptions({gc1:hexA(c,m.g.a1),gc2:hexA(c,m.g.a2)});
      else if(m.k==="f"&&!m.pc)ss[x].applyOptions({color:hexA(c,m.al==null?.1:m.al)})}catch{}})}
let riq=0;const rIndSoon=()=>{if(!riq)riq=requestAnimationFrame(()=>{riq=0;renderInd()})};
function renderInd(){
  // Special orderflow indicators manage their own canvas layers and data sessions.
  try{window.crossAssetMapIndicatorSync?.()}catch(e){console.warn("cross asset indicator sync",e)}
  Object.entries(SER).forEach(([id,ss])=>{const pn=PN[id],ch=pn?pn.ch:chart;ss.forEach(s=>{if(s){try{ch.removeSeries(s)}catch{}}})});
  SER={};LV={};RAW={};SM={};
  chart.priceScale("right").applyOptions({scaleMargins:{top:.06,bottom:.15}});
  chart.priceScale("vol").applyOptions({scaleMargins:{top:.87,bottom:0}});
  syncPanes(ACT.filter(a=>isOn(a)&&IND[a.key].t==="osc"));
  if(!agg.length){legend();return}
  const R=calcAll(),E=eff(),tx=COL().tx;
  ACT.forEach((a,i)=>{
    if(!R[i])return;const def=IND[a.key],pn=def.t==="osc"?PN[a.id]:null,ch=pn?pn.ch:chart,rs=R[i],ss=new Array(rs.length).fill(null),pf=pfOf(def,rs)||(ch===chart&&def.t==="ov"?priceFmt():null);   // chỉ báo chồng lên giá: cùng số lẻ với mã
    const go=(s,j)=>{try{
      const ser=mkSer(ch,a,s,pf,E);ser.setData(s.data);
      if(s.mk&&s.mk.length)ser.setMarkers([...s.mk].sort((x,y)=>x.time-y.time));
      ss[j]=ser}catch(e){console.warn("indicator",a.key,e)}};
    rs.forEach((s,j)=>{if(s.k==="f")go(s,j)});      // vùng tô dựng trước để nằm dưới các đường
    rs.forEach((s,j)=>{if(s.k!=="f")go(s,j)});
    const m0=rs.findIndex(s=>s.k!=="f"&&!s.sp),main=m0>=0?ss[m0]:null;
    if(main)(def.hl||[]).forEach(h=>{try{main.createPriceLine({price:h.y,color:hexA(tx,h.al==null?.5:h.al),lineWidth:1,lineStyle:2,axisLabelVisible:false})}catch{}});
    SER[a.id]=ss;SM[a.id]=rs.map(s=>({k:s.k,ci:s.ci,lg:s.lg,al:s.al,g:s.g,pc:s.pc,sp:s.sp}));
    RAW[a.id]=rs.map(s=>s.raw);
    LV[a.id]=rs.map(s=>s.lg?lastV(s.raw):null);
    if(pn){pn.series=ss;pn.raw=RAW[a.id]}
  });
  legend();
  setTimeout(alignPanes,60);
}
function liveInd(){
  if(!ACT.length)return;
  const R=calcAll();
  ACT.forEach((a,i)=>{const ss=SER[a.id];if(!R[i]||!ss||R[i].length!==ss.length)return;
    R[i].forEach((s,j)=>{const ser=ss[j];if(!ser)return;
      try{if(s.sp)ser.setData(s.data);else{const q=s.data[s.data.length-1];if(q)ser.update(q)}
        if(s.mk)ser.setMarkers([...s.mk].sort((x,y)=>x.time-y.time))}catch{}});
    RAW[a.id]=R[i].map(s=>s.raw);LV[a.id]=R[i].map(s=>s.lg?lastV(s.raw):null);
    const pn=PN[a.id];if(pn)pn.raw=RAW[a.id];
  });
  legend();
}
const fv=v=>Math.abs(v)<1?v.toFixed(5):v.toFixed(2);
const ICO={
 ey:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
 eo:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a10 10 0 0 0 4-.8"/></svg>',
 gr:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2l2 2.6 3.2-.6.9 3.1 3 1.2-1 3.1 1 3.1-3 1.2-.9 3.1-3.2-.6L12 22l-2-2.6-3.2.6-.9-3.1-3-1.2 1-3.1-1-3.1 3-1.2.9-3.1 3.2.6z"/></svg>',
 tr:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>'};
let LSIG="",LGC=ld("tp_lgc","")==="1";
ICO.up='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l6-6 6 6"/></svg>';
ICO.dn='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
// Hàng legend chỉ dựng lại khi danh sách/thông số đổi; còn lại chỉ cập nhật số, để nút bấm không bị mất khi chart cập nhật mỗi giây.
function lrow(a){
  const d=IND[a.key],on=isOn(a),hid=a.on&&!on?" (ẩn ở khung này)":"",lb=d.lab?d.lab(a.p):Object.values(a.p).join(" ");
  return `<div class="lr${on?"":" off"}" data-id="${a.id}"><span style="color:${cres(a,0)};font-weight:600">${d.n} ${lb}${hid}</span><span class="lvs"></span><span class="la"><button type="button" data-k="ey" title="${a.on?"Ẩn":"Hiện"}" aria-label="${a.on?"Ẩn":"Hiện"} ${d.n}">${a.on?ICO.ey:ICO.eo}</button><button type="button" data-k="gr" title="Cài đặt" aria-label="Cài đặt ${d.n}">${ICO.gr}</button><button type="button" data-k="tr" title="Xóa" aria-label="Xóa ${d.n}">${ICO.tr}</button></span></div>`;
}
const fmtV=v=>{const x=Math.abs(v);return x>=1e6?(v/1e6).toFixed(2)+"M":x>=1e3?(v/1e3).toFixed(2)+"K":v.toFixed(0)};
const lastI=raw=>{for(let i=raw.length-1;i>=0;i--){const x=raw[i];if(x!=null&&(typeof x!=="number"||isFinite(x)))return x}return null};
// Chỉ báo overlay (và chỉ báo đang ẩn) nằm ở góc trên chart giá; chỉ báo dao động đang bật nằm ở góc trên pane của nó.
// Hàng legend chỉ dựng lại khi danh sách/thông số đổi; còn lại chỉ cập nhật số, để nút bấm không bị mất khi chart cập nhật mỗi giây.
function legend(p){
  const el=$("legend"),sig=LGC+"#"+ACT.map(a=>[a.id,a.on,isOn(a),!!PN[a.id],JSON.stringify(a.p),a.c.join()].join(":")).join("|");
  if(sig!==LSIG){LSIG=sig;
    const mainL=ACT.filter(a=>!PN[a.id]);
    const head=mainL.length?`<div class="lh"><button type="button" data-k="col" title="${LGC?"Mở rộng":"Thu gọn"} chỉ báo" aria-label="${LGC?"Mở rộng":"Thu gọn"} danh sách chỉ báo" aria-expanded="${!LGC}">${LGC?ICO.dn:ICO.up}</button>${LGC?`<span data-k="col">${mainL.length} chỉ báo</span>`:""}</div>`:"";
    el.innerHTML=head+(LGC?"":mainL.map(lrow).join(""));
    ACT.forEach(a=>{const pn=PN[a.id];if(pn)pn.lg.innerHTML=lrow(a)});
  }
  const card=$("chartCard"),i=p&&p.time!=null?idxOf(p.time):-2;
  ACT.forEach(a=>{const r=card.querySelector(`[data-id="${a.id}"] .lvs`);if(!r)return;
    const ms=SM[a.id];if(!isOn(a)||!ms){r.innerHTML="";return}
    const F=IND[a.key].fm==="vol"?fmtV:IND[a.key].t==="ov"?(v=>(+v).toFixed(PDIG())):fv;
    r.innerHTML=ms.map((m,j)=>{if(!m.lg)return"";
      const raw=RAW[a.id]&&RAW[a.id][j],v=i===-2?(LV[a.id]||[])[j]:(i>=0&&raw?val(raw[i]):null),
        it=raw?(i===-2?lastI(raw):i>=0?raw[i]:null):null,col=m.ci!=null?cres(a,m.ci):(it&&(it.c||it.col))||"inherit";
      return `<b style="color:${col}">${v==null?"–":F(v)}</b>`}).join(" ")});
}
function legClick(e){
  const b=e.target.closest("[data-k]");if(!b)return;
  if(b.dataset.k==="col"){LGC=!LGC;sv("tp_lgc",LGC?"1":"0");legend();return}
  const id=b.closest("[data-id]").dataset.id,a=ACT.find(x=>x.id===id);if(!a)return;
  if(b.dataset.k==="ey"){a.on=!a.on;saveInd();renderInd()}
  else if(b.dataset.k==="gr")openSet(id);
  else{ACT=ACT.filter(x=>x.id!==id);saveInd();renderInd()}
}
$("legend").onclick=legClick;$("panes").addEventListener("click",legClick);
/* Hộp thoại cài đặt indicator (Thông số / Kiểu dáng / Hiển thị), áp dụng trực tiếp lên chart, Hủy sẽ hoàn lại */
function openSet(id){
  const a=ACT.find(x=>x.id===id);if(!a||document.querySelector(".mdl"))return;
  const d=IND[a.key],bak=JSON.parse(JSON.stringify(a)),back=document.activeElement;let tab="in";const hpo=new Set();
  const o=document.createElement("div");o.className="mdl";o.setAttribute("role","dialog");o.setAttribute("aria-modal","true");o.setAttribute("aria-labelledby","dlgT");
  const vis=()=>a.vis||allTfs().map(t=>t[1]);
  const draw=()=>{
    const sc0=(o.querySelector(".bd")||{}).scrollTop||0,advancedOpen=!!(o.querySelector(".ict-advanced-settings")&&o.querySelector(".ict-advanced-settings").open);const T=[["in","Thông số"],["st","Kiểu dáng"],["vi","Hiển thị"]];let b="";
    if(tab==="in"){
      const renderParams=list=>{let g=null;return list.filter(sp=>pshow(sp,a.p)).map(sp=>{const x=sp[4]||{};let h="";if(x.g&&x.g!==g){g=x.g;h=`<h4>${x.g}</h4>`}
        const q=x.hp?`<span class="lw"><label for="dp_${sp[0]}">${sp[1]}</label><button type="button" class="qh" data-help="${sp[0]}" title="${x.hp[0]}" aria-label="${x.hp[0]}">?</button></span>`:`<label for="dp_${sp[0]}">${sp[1]}</label>`;
        return h+`<div class="f">${q}${pin(sp,a.p[sp[0]],"dp_")}${x.tt?`<small>${x.tt}</small>`:""}${x.hp?`<small class="hp" data-hp="${sp[0]}"${hpo.has(sp[0])?"":" hidden"}>${x.hp.map(z=>`<span>${z}</span>`).join("")}</small>`:""}</div>`}).join("")};
      if(a.key==="ict22"){
        const coreKeys=new Set(["visualMode","dashboard","structure","prevLevels","eq","sweeps","fvg","blocks","range"]),core=d.p.filter(sp=>coreKeys.has(sp[0])),advanced=d.p.filter(sp=>!coreKeys.has(sp[0]));
        b=`<div class="ict-settings"><p class="msg ict-settings-intro">Chọn cách hiển thị và các lớp cốt lõi. Mặc định Gọn để chart dễ đọc; toàn bộ thông số chuyên sâu nằm bên dưới.</p><div class="ict-core-settings">${renderParams(core)}</div><details class="ict-advanced-settings"><summary>Nâng cao · toàn bộ mô hình và thông số</summary><div class="ict-advanced-body">${renderParams(advanced)}</div></details></div>`;
      }else b=renderParams(d.p)||`<p class="msg">Indicator này không có thông số.</p>`;
    }
    else if(tab==="st"){
      b=d.L.map((l,j)=>`<div class="f"><label for="dc_${j}">${l}</label><input type="color" id="dc_${j}" data-c="${j}" value="${cres(a,j)}"></div>`).join("");
      if(d.L.length&&!["vd","cvd","fpr","bt","dst","kinv"].includes(a.key))b+=`<div class="f"><label for="dw">Độ dày đường</label><select id="dw" data-w="1">${[1,2,3,4].map(n=>`<option value="${n}"${(a.w||2)===n?" selected":""}>${n}px</option>`).join("")}</select></div>`;
      if(d.c.some(x=>x[0]==="@"))b+=`<p class="msg">Một số màu mặc định lấy theo màu nến tăng/giảm (mục Chart Setting). Chọn màu khác để ghi đè; bấm Mặc định để quay lại.</p>`;
      if(a.key==="macd")b+=`<p class="msg">Histogram luôn lấy theo màu nến tăng/giảm (đậm khi động lượng mạnh lên, nhạt khi yếu đi).</p>`}
    else b=`<p class="msg">Chỉ hiện indicator trên các khung được chọn.</p><div class="bar">${allTfs().map(([n,s])=>`<label class="chk"><input type="checkbox" data-v="${s}"${vis().includes(s)?" checked":""}>${n}</label>`).join("")}</div>`;
    o.innerHTML=`<div class="box"><header><h3 id="dlgT">${d.n}</h3><button class="ib" type="button" data-act="cancel" aria-label="Đóng" style="width:36px;height:36px">✕</button></header><div class="tabs">${T.map(([k,n])=>`<button type="button" data-tab="${k}" class="${k===tab?"on":""}">${n}</button>`).join("")}</div><div class="bd">${b}</div><footer><button class="btn ghost sm" type="button" data-act="def">Mặc định</button><span style="flex:1"></span><button class="btn ghost sm" type="button" data-act="cancel">Hủy</button><button class="btn sm" type="button" data-act="ok">OK</button></footer></div>`;
    const bd0=o.querySelector(".bd");if(bd0)bd0.scrollTop=sc0;const ad0=o.querySelector(".ict-advanced-settings");if(ad0&&advancedOpen)ad0.open=true;
  };
  const close=ok=>{
    if(!ok){for(const k of Object.keys(a))delete a[k];Object.assign(a,bak)}else remTpl(a);
    o.remove();document.removeEventListener("keydown",kd,true);saveInd();renderInd();buildInd();
    if(back&&back.isConnected&&back.focus)back.focus();
  };
  const kd=e=>{if(e.key==="Escape"){e.preventDefault();close(false)}};
  document.addEventListener("keydown",kd,true);
  o.onclick=e=>{
    if(e.target===o)return close(false);
    const hb=e.target.closest("[data-help]");if(hb){const k=hb.dataset.help,el=o.querySelector(`[data-hp="${k}"]`);if(el){el.hidden=!el.hidden;el.hidden?hpo.delete(k):hpo.add(k)}return}
    const t=e.target.closest("[data-tab],[data-act]");if(!t)return;
    if(t.dataset.tab){tab=t.dataset.tab;draw();return}
    const k=t.dataset.act;
    if(k==="ok")close(true);else if(k==="cancel")close(false);
    else if(k==="def"){a.p=pdef(d);a.c=[...d.c];delete a.w;delete a.vis;saveInd();renderInd();draw()}
  };
  o.onchange=e=>{const t=e.target;
    if(t.dataset.p){setP(a,d,t.dataset.p,t);saveInd();renderInd();
      if(t.tagName==="SELECT"||t.type==="checkbox"){draw();const n=o.querySelector(`[data-p="${t.dataset.p}"]`);if(n)n.focus()}}   // vẽ lại để ẩn/hiện các ô phụ thuộc
    else if(t.dataset.w){a.w=+t.value;saveInd();renderInd()}
    else if(t.dataset.v){const l=[...o.querySelectorAll("[data-v]")].filter(x=>x.checked).map(x=>+x.dataset.v);if(!l.length){t.checked=true;return}if(l.length===allTfs().length)delete a.vis;else a.vis=l;saveInd();renderInd()}
  };
  o.oninput=e=>{const t=e.target,j=t.dataset.c;if(j===undefined)return;a.c[+j]=t.value;saveInd();if(d.rc)rIndSoon();else applyColor(a,+j);try{window.crossAssetMapIndicatorSync?.()}catch{}legend()};
  draw();document.body.append(o);o.querySelector("[data-act=ok]").focus();
}
legend();
let IF="all";
const TL={of:"Orderflow",mm:"Market Model"};
function buildInd(){
  const LS=ACT;
  $("actList").innerHTML=LS.length?LS.map(a=>{const d=IND[a.key];
    return `<div class="f" style="grid-template-columns:1fr auto;gap:8px 12px" data-id="${a.id}"><div><b>${d.n}</b> <span class="msg">${TL[d.t]}</span><div class="bar" style="margin-top:6px">${d.p.filter(sp=>pshow(sp,a.p)&&(!["of","mm"].includes(d.t)||(sp[4]&&sp[4].mn))).map(sp=>`<label class="msg">${sp[1]} ${pin(sp,a.p[sp[0]],"ap_"+a.id+"_",sp[3]==="s"?"width:auto":sp[3]==="b"?"":"width:78px")}</label>`).join("")}${d.L.map((l,j)=>`<label class="msg">${l} <input type="color" data-c="${j}" value="${cres(a,j)}"></label>`).join("")}</div></div><div class="bar"><label class="msg">Hiện <input type="checkbox" data-on="1"${a.on?" checked":""}></label><button class="btn ghost sm" data-set="1">Cài đặt</button><button class="btn ghost sm" data-rm="1">Xóa</button></div></div>`}).join(""):`<div class="msg">Chưa có indicator nào. Chọn trong kho bên dưới.</div>`;
  $("indGrid").innerHTML=Object.entries(IND).filter(([k,d])=>ALLOWED_IND_GROUPS.has(d.t)&&(IF==="all"||d.t===IF)).map(([k,d])=>`<div class="card"><h2>${d.n} <span class="pill">${TL[d.t]}</span></h2><p class="msg" style="margin:0 0 12px">${d.d}</p><button class="btn sm" data-add="${k}">+ Thêm vào chart</button></div>`).join("");
  $("indF").innerHTML=[["all","Tất cả"],["of","Orderflow"],["mm","Market Model"]].map(([k,n])=>`<button class="tf${k===IF?" on":""}" data-f="${k}">${n}</button>`).join("");
}
$("v-ind").onclick=e=>{
  const t=e.target.closest("[data-add],[data-rm],[data-f],[data-set]");if(!t)return;
  if(t.dataset.set){openSet(t.closest("[data-id]").dataset.id);return}
  if(t.dataset.f){IF=t.dataset.f;buildInd();return}
  if(t.dataset.add){
    if(t.dataset.add==='xmap'){
      const existing=ACT.find(a=>a.key==='xmap');
      if(existing){openSet(existing.id);return}
    }
    ACT.push(mkA(t.dataset.add));saveInd();renderInd()
    buildInd();return}
  if(t.dataset.rm){const id=t.closest("[data-id]").dataset.id;
    ACT=ACT.filter(a=>a.id!==id);saveInd();renderInd()
    buildInd()}
};
$("v-ind").onchange=e=>{
  const t=e.target,row=t.closest("[data-id]");if(!row)return;
  const a=ACT.find(x=>x.id===row.dataset.id);if(!a)return;
  if(t.dataset.p){setP(a,IND[a.key],t.dataset.p,t);saveInd();remTpl(a);renderInd();if(t.tagName==="SELECT"||t.type==="checkbox")buildInd()}
  else if(t.dataset.on){a.on=t.checked;saveInd();renderInd()}
};
$("v-ind").oninput=e=>{
  const t=e.target,j=t.dataset.c;if(j===undefined)return;const a=ACT.find(x=>x.id===t.closest("[data-id]").dataset.id);if(!a)return;
  a.c[+j]=t.value;saveInd();remTpl(a);if(IND[a.key].rc)rIndSoon();else applyColor(a,+j);try{window.crossAssetMapIndicatorSync?.()}catch{}legend();
};
document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>show(b.dataset.go));
