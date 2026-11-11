/* ===== Mobile / cảm ứng cho chart =====
   1) Chart nhận toàn bộ cử chỉ chạm: pinch không còn zoom cả trang, vuốt không còn cuộn trang.
   2) Kéo trục giá (dọc) và trục thời gian (ngang) bằng ngón tay hoạt động như chuột.
   3) Cụm nút nổi: phóng to / thu nhỏ, tự căn giá, về nến mới nhất, toàn màn hình.
   4) Giao diện chart gọn hơn trên điện thoại (toolbar vẽ to hơn, bảng màu dạng bottom sheet, v.v.). */
(function(){
"use strict";
const card=$("chartCard"),cw=$("cw"),chEl=$("chart");
if(!card||!cw||!chEl||typeof chart==="undefined")return;
const MQ="(pointer:coarse),(max-width:760px)";

/* ---------- CSS ---------- */
const css=document.createElement("style");css.id="mcss";
css.textContent=`
#cw,#cw *{touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
#cw input{-webkit-user-select:text;user-select:text}
#chartCard{-webkit-tap-highlight-color:transparent;overscroll-behavior:contain}
#dwt{touch-action:pan-y;overscroll-behavior:contain;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
html{-webkit-text-size-adjust:100%;text-size-adjust:100%}
#mcl{position:absolute;left:58px;bottom:72px;z-index:8;display:none;gap:6px}
#mcl button,#mch .mcb{width:36px;height:36px;display:grid;place-items:center;padding:0;border:1px solid var(--line);border-radius:11px;background:var(--card);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);color:var(--ink);cursor:pointer;box-shadow:0 4px 14px rgba(0,0,10,.28)}
#mcl button:active,#mch .mcb:active{background:var(--inp)}
#mcl svg,#mch svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
#mch{display:none}
.pn .rs::after{content:"";position:absolute;left:50%;top:50%;width:34px;height:3px;margin:-1px 0 0 -17px;border-radius:2px;background:var(--mut);opacity:0}
@media (pointer:coarse),(max-width:760px){#mcl{display:flex}}
@media (pointer:coarse){
.pn .rs{height:18px}.pn .rs::after{opacity:.55}
input,select,textarea,#dwi{font-size:16px!important}
#dwt{width:42px}
#dwt button{width:38px;height:38px;border-radius:10px}
#dwt svg{width:21px;height:21px}
html body #cw{inset:6px 6px 36px 52px!important}
html body #ohlc,html body #legend{left:60px!important}
#dwp{left:56px}
#dwp button,#dwp .dwcb{width:38px;height:36px}
#dwk{left:8px!important;right:8px!important;top:auto!important;bottom:calc(8px + env(safe-area-inset-bottom,0px));max-width:none}
#dwk .r{grid-template-columns:repeat(10,1fr)}
#dwk .r i{width:auto;height:auto;aspect-ratio:1;border-radius:6px}
.mdl .tabs{overflow-x:auto;white-space:nowrap;gap:16px;touch-action:pan-x}
}
@media (max-width:760px){
.wrap{padding:10px}
#v-chart.on{display:flex;flex-direction:column;min-height:calc(100vh - 80px);min-height:calc(100dvh - 80px)}
#v-chart>.card.bar{padding:8px 10px;gap:8px}
#v-chart>.card.bar .tfs{flex:1 1 100%;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;touch-action:pan-x;-webkit-overflow-scrolling:touch}
#v-chart>.card.bar .tfs::-webkit-scrollbar{display:none}
#v-chart .symw{order:-3;flex:1 1 0;min-width:0;width:auto}
#v-chart #st{order:-2}
#v-chart>.card.bar .tfs{order:-1}
#v-chart .tf{flex:none;padding:8px 13px}
#v-chart .px{margin-left:0;flex:1 1 100%;justify-content:space-between}
#chartCard{flex:1 1 auto;height:auto;min-height:380px;margin-top:10px;padding:4px}
.mdl{align-items:flex-end;padding:0}
.mdl .box{max-width:100%!important;border-radius:16px 16px 0 0;max-height:90vh;max-height:90dvh}
}
body.cfs{overflow:hidden}
body.cfs .topbar{display:none}
body.cfs #chartCard{position:fixed;inset:0;z-index:60;margin:0;height:auto;min-height:0;border-radius:0;border:0;padding:0;background:var(--hole);-webkit-backdrop-filter:none;backdrop-filter:none;box-shadow:none}
body.cfs #mch{display:flex;position:absolute;left:0;right:0;top:0;z-index:9;align-items:center;gap:8px;padding:calc(6px + env(safe-area-inset-top,0px)) calc(8px + env(safe-area-inset-right,0px)) 6px calc(8px + env(safe-area-inset-left,0px));border-bottom:1px solid var(--line)}
#mch .mcs{flex:none;font:700 13px/1.15 "Space Grotesk",sans-serif;font-variant-numeric:tabular-nums;white-space:nowrap}
#mch .mcs small{display:block;font-weight:500;color:var(--mut);font-size:11px}
#mch .tfs{flex:1 1 auto;min-width:0;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;touch-action:pan-x}
#mch .tfs::-webkit-scrollbar{display:none}
#mch .tf{flex:none;padding:7px 11px}
body.cfs #cw{inset:calc(52px + env(safe-area-inset-top,0px)) calc(6px + env(safe-area-inset-right,0px)) calc(36px + env(safe-area-inset-bottom,0px)) calc(52px + env(safe-area-inset-left,0px))!important}
body.cfs #dwt{top:calc(54px + env(safe-area-inset-top,0px));bottom:calc(36px + env(safe-area-inset-bottom,0px));left:calc(6px + env(safe-area-inset-left,0px))}
body.cfs #ohlc,body.cfs #legend{left:calc(60px + env(safe-area-inset-left,0px))!important}
body.cfs #ohlc{top:calc(58px + env(safe-area-inset-top,0px))}
body.cfs #legend{top:calc(78px + env(safe-area-inset-top,0px))}
body.cfs #dwp{top:calc(58px + env(safe-area-inset-top,0px));left:calc(56px + env(safe-area-inset-left,0px))}
body.cfs #clk{right:calc(12px + env(safe-area-inset-right,0px));bottom:calc(5px + env(safe-area-inset-bottom,0px))}
body.cfs #tzp{bottom:calc(38px + env(safe-area-inset-bottom,0px))}
body.cfs #mcl{left:calc(58px + env(safe-area-inset-left,0px));bottom:calc(72px + env(safe-area-inset-bottom,0px))}
/* Toàn màn hình: trước đây style.css (:root[data-theme] #chartCard) có độ ưu tiên cao hơn nên nền thẻ chart vẫn trong suốt, thanh công cụ / chart phụ phía sau lộ ra thành "hình mờ" và còn bấm được.
   Giờ: nền đặc (!important) + ẩn hẳn mọi thứ nằm sau khi đang toàn màn hình. */
body.cfs #chartCard{background:var(--hole)!important;border:0!important;box-shadow:none!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important}
body.cfs #mch{background:var(--hole)}
body.cfs #v-chart>.card.bar,body.cfs #mc,body.cfs #embBack,body.cfs #side,body.cfs .scrim,body.cfs #sky{display:none!important}
/* Nút toàn màn hình cho máy tính (chuột): góc trên bên phải chart, cạnh trục giá */
#fsd{position:absolute;top:8px;right:78px;z-index:8;display:none;width:32px;height:32px;place-items:center;padding:0;border:1px solid var(--line);border-radius:9px;background:var(--card);color:var(--ink);cursor:pointer;opacity:.7;transition:opacity .15s}
#fsd:hover{opacity:1;background:var(--inp)}
#fsd svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
@media (hover:hover) and (pointer:fine) and (min-width:761px){#fsd{display:grid}}
body.cfs #fsd,html.emb #fsd{display:none!important}
`;
document.head.appendChild(css);

/* ---------- Chặn zoom / cuộn trang khi thao tác trên chart ---------- */
["gesturestart","gesturechange","gestureend"].forEach(n=>card.addEventListener(n,e=>e.preventDefault(),{passive:false}));   // iOS Safari: pinch zoom trang
cw.addEventListener("touchmove",e=>{if(e.touches.length>1&&e.cancelable)e.preventDefault()},{passive:false});

/* ---------- Kéo trục giá / trục thời gian bằng ngón tay ----------
   Thư viện chart coi thao tác kéo trục bằng cảm ứng là "cuộn trang" nên không xử lý.
   Ở đây ta nhận cử chỉ trên vùng trục, chặn sự kiện chạm gốc, rồi:
   - trục giá: phát lại thành sự kiện chuột (mousedown/move/up) để thư viện tự co giãn thang giá như khi dùng chuột;
   - trục thời gian: tự tính lại vùng hiển thị (cùng công thức: kéo sang phải = thu nhỏ, neo ở mép phải).
   Chạm 2 lần vào trục giá = tự căn giá; chạm 2 lần vào trục thời gian = đặt lại zoom. */
let AX=null,lastTap={t:0,k:"",x:0,y:0};
const zones=()=>[{ch:chart,box:chEl},...Object.values(PN).map(p=>({ch:p.ch,box:p.el.querySelector(".pc")}))];
function hitZone(x,y){
  for(const z of zones()){const r=z.box&&z.box.getBoundingClientRect();if(!r||x<r.left||x>r.right||y<r.top||y>r.bottom)continue;
    let pw=0,th=0;try{pw=z.ch.priceScale("right").width();th=z.ch.timeScale().height()}catch(e){}
    if(pw>0&&x>=r.right-pw)return{z,r,pw,k:"p"};
    if(th>0&&y>=r.bottom-th)return{z,r,pw,k:"t"};
    return{z,r,pw,k:"pane"}}
  return null}
function fireMouse(type,x,y){const a=AX;if(!a||!a.tg||!a.tg.isConnected)return;
  try{a.tg.dispatchEvent(new MouseEvent(type,{bubbles:true,cancelable:true,composed:true,view:window,detail:1,clientX:x,clientY:y,screenX:x,screenY:y,button:0,buttons:type==="mouseup"?0:1}))}catch(e){}}
function timeDrag(cx){const a=AX,W=a.r.width-a.pw,x0=a.x0-a.r.left,x=cx-a.r.left,den=W-x0;if(den<8||!a.rg)return;
  const f=Math.max(.05,Math.min(20,(W-x)/den)),ns=Math.max(5,Math.min(2000,(a.rg.to-a.rg.from)/f));
  try{a.z.ch.timeScale().setVisibleLogicalRange({from:a.rg.to-ns,to:a.rg.to})}catch(e){}}
const eatTouch=e=>{if(!AX)return;e.stopImmediatePropagation();if(e.cancelable)e.preventDefault();
  if((e.type==="touchend"||e.type==="touchcancel")&&e.touches.length===0&&AX.done)AX=null};
["touchstart","touchmove","touchend","touchcancel"].forEach(n=>cw.addEventListener(n,eatTouch,{capture:true,passive:false}));
cw.addEventListener("pointerdown",e=>{
  if(e.pointerType!=="touch"||!e.isPrimary)return;
  AX=null;
  if(e.target.closest&&e.target.closest(".rs,#dwi"))return;
  const h=hitZone(e.clientX,e.clientY);if(!h||h.k==="pane")return;
  AX={id:e.pointerId,k:h.k,z:h.z,r:h.r,pw:h.pw,x0:e.clientX,y0:e.clientY,t:Date.now(),tg:e.target,moved:false,done:false,rg:null};
  if(h.k==="t"){try{AX.rg=h.z.ch.timeScale().getVisibleLogicalRange()}catch(x){}}
  else fireMouse("mousedown",e.clientX,e.clientY);
},true);
window.addEventListener("pointermove",e=>{const a=AX;if(!a||a.done||e.pointerId!==a.id)return;
  if(!a.moved){if(Math.hypot(e.clientX-a.x0,e.clientY-a.y0)<6)return;a.moved=true}
  if(a.k==="p")fireMouse("mousemove",e.clientX,e.clientY);else timeDrag(e.clientX)});
const axEnd=(e,cancel)=>{const a=AX;if(!a||a.done||e.pointerId!==a.id)return;a.done=true;
  if(a.k==="p")fireMouse("mouseup",e.clientX,e.clientY);
  if(cancel||a.moved||Date.now()-a.t>350)return;
  const n=Date.now();
  if(n-lastTap.t<350&&lastTap.k===a.k&&Math.hypot(e.clientX-lastTap.x,e.clientY-lastTap.y)<30){lastTap.t=0;
    try{if(a.k==="p")a.z.ch.priceScale("right").applyOptions({autoScale:true});else a.z.ch.timeScale().resetTimeScale()}catch(x){}}
  else lastTap={t:n,k:a.k,x:e.clientX,y:e.clientY}};
window.addEventListener("pointerup",e=>axEnd(e,false));
window.addEventListener("pointercancel",e=>axEnd(e,true));

/* ---------- Cụm nút nổi + toàn màn hình ---------- */
const IC={
  fs:'<path d="M4 8V4h4M16 8V4h-4M4 12v4h4M16 12v4h-4"/>',
  fx:'<path d="M8 4v4H4M12 4v4h4M8 16v-4H4M12 16v-4h4"/>',
  auto:'<path d="M10 3v14M6.5 6.5L10 3l3.5 3.5M6.5 13.5L10 17l3.5-3.5"/>',
  last:'<path d="M5 4l6 6-6 6M14 4v12"/>',
  zi:'<path d="M10 4v12M4 10h12"/>',
  zo:'<path d="M4 10h12"/>',
  x:'<path d="M5 5l10 10M15 5L5 15"/>'};
const BT=[["zo","Thu nhỏ"],["zi","Phóng to"],["auto","Tự căn thang giá"],["last","Về nến mới nhất"],["fs","Toàn màn hình"]];
const cl=document.createElement("div");cl.id="mcl";cl.setAttribute("role","toolbar");cl.setAttribute("aria-label","Điều khiển chart");
cl.innerHTML=BT.map(([k,t])=>`<button type="button" data-m="${k}" title="${t}" aria-label="${t}"><svg viewBox="0 0 20 20">${IC[k]}</svg></button>`).join("");
card.appendChild(cl);
const fd=document.createElement("button");fd.id="fsd";fd.type="button";fd.dataset.m="fs";fd.title="Toàn màn hình";fd.setAttribute("aria-label","Toàn màn hình");
fd.innerHTML=`<svg viewBox="0 0 20 20">${IC.fs}</svg>`;card.appendChild(fd);
const hd=document.createElement("div");hd.id="mch";
hd.innerHTML=`<div class="mcs" data-no-i18n><span id="mcsy"></span><small id="mcpx"></small></div><button type="button" class="mcb" data-m="exit" title="Thoát toàn màn hình" aria-label="Thoát toàn màn hình"><svg viewBox="0 0 20 20">${IC.x}</svg></button>`;
card.appendChild(hd);

function zoom(f){const ts=chart.timeScale(),r=ts.getVisibleLogicalRange();if(!r)return;
  const span=r.to-r.from,ns=Math.max(6,Math.min(2000,span/f)),atEnd=r.to>=agg.length-1-.5;
  ts.setVisibleLogicalRange(atEnd?{from:r.to-ns,to:r.to}:{from:(r.from+r.to)/2-ns/2,to:(r.from+r.to)/2+ns/2})}
function autoPrice(){allCh().forEach(c=>{try{c.priceScale("right").applyOptions({autoScale:true})}catch(e){}})}
const tfs=$("tfs"),tfsHome=tfs?tfs.parentNode:null,ph=document.createComment("tfs");
let fsTimer=0,fsPushed=false,fsReal=false;
const desk=()=>matchMedia("(hover:hover) and (pointer:fine)").matches;
const fsOn=()=>document.body.classList.contains("cfs");
function lab(){$("mcsy").textContent=C.sym||"";$("mcpx").textContent=($("bid").textContent||"").trim()}
function setFs(on){
  if(on===fsOn())return;
  if(on){
    if(tfs){tfsHome.insertBefore(ph,tfs);hd.insertBefore(tfs,hd.querySelector(".mcb"))}
    document.body.classList.add("cfs");lab();fsTimer=setInterval(lab,1000);
    try{history.pushState({mcfs:1},"");fsPushed=true}catch(e){}
    if(desk()&&document.documentElement.requestFullscreen&&!document.fullscreenElement){   // máy tính: vào toàn màn hình thật của trình duyệt (ẩn cả thanh địa chỉ)
      fsReal=true;try{const r=document.documentElement.requestFullscreen({navigationUI:"hide"});if(r&&r.catch)r.catch(()=>{fsReal=false})}catch(e){fsReal=false}
    }
  }else{
    document.body.classList.remove("cfs");clearInterval(fsTimer);
    if(tfs&&ph.parentNode)ph.parentNode.insertBefore(tfs,ph),ph.remove();
    if(fsPushed){fsPushed=false;try{if(history.state&&history.state.mcfs)history.back()}catch(e){}}
    if(fsReal){fsReal=false;if(document.fullscreenElement){try{const r=document.exitFullscreen();if(r&&r.catch)r.catch(()=>{})}catch(e){}}}
  }
  card.querySelectorAll('[data-m="fs"]').forEach(b=>{b.innerHTML=`<svg viewBox="0 0 20 20">${on?IC.fx:IC.fs}</svg>`;
    const t=on?"Thoát toàn màn hình":"Toàn màn hình";b.setAttribute("title",t);b.setAttribute("aria-label",t)});
  requestAnimationFrame(()=>window.dispatchEvent(new Event("resize")));
}
card.addEventListener("click",e=>{const b=e.target.closest("[data-m]");if(!b||!card.contains(b))return;const m=b.dataset.m;
  if(m==="zi")zoom(1.35);else if(m==="zo")zoom(1/1.35);else if(m==="auto")autoPrice();
  else if(m==="last"){try{chart.timeScale().scrollToRealTime()}catch(x){}}
  else if(m==="fs")setFs(!fsOn());else if(m==="exit")setFs(false)});
document.addEventListener("fullscreenchange",()=>{if(!document.fullscreenElement&&fsReal){fsReal=false;if(fsOn())setFs(false)}});   // bấm Esc: trình duyệt tự thoát toàn màn hình, app thoát theo
window.addEventListener("popstate",()=>{if(fsOn()){fsPushed=false;setFs(false)}});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&fsOn()&&!document.querySelector(".mdl,#dwk"))setFs(false)});
matchMedia(MQ).addEventListener("change",e=>{if(!e.matches)setFs(false)});
})();
