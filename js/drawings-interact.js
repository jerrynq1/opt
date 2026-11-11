function render(){const r=$("chart").getBoundingClientRect(),dp=devicePixelRatio||1;if(!r.width)return;
  if(cv.width!==Math.round(r.width*dp)||cv.height!==Math.round(r.height*dp)){cv.width=Math.round(r.width*dp);cv.height=Math.round(r.height*dp);cv.style.width=r.width+"px";cv.style.height=r.height+"px"}
  ctx.setTransform(dp,0,0,dp,0,0);ctx.clearRect(0,0,r.width,r.height);try{drawST()}catch(e){}if(!n())return;if(hid){try{kzEl().style.display="none"}catch(e){}if(window.FPHIDE){window.FPHIDE=false;applyCand()}return}
  const[w,h]=plot();ctx.save();ctx.beginPath();ctx.rect(0,0,w,h);ctx.clip();try{drawHVN(w,h)}catch(e){chErr("hvn",e)}try{drawKZ(w,h)}catch(e){chErr("kz",e)}try{drawICT(w,h)}catch(e){chErr("ict22",e)}try{drawCRT(w,h)}catch(e){chErr("crt",e)}try{drawGB(w,h)}catch(e){chErr("gb",e)}try{drawQT(w,h)}catch(e){chErr("qt",e)}drawFP(w,h);drawBT(w,h);try{drawHAB(w,h)}catch(e){chErr("hab",e)}try{drawDOM(w,h)}catch(e){chErr("dom",e)}try{drawCrossAssetMap(w,h)}catch(e){chErr("xmap",e)}try{drawMarketModelIndicators(w,h)}catch(e){chErr("market-models",e)}D.forEach(d=>vis(d)&&draw(d));if(dwCur&&dwCur.pts&&tl>1){const q=dwCur.pts[0],qx=X(q),qy=Y(q);if(qx!=null&&qy!=null){ctx.setLineDash([]);ctx.lineWidth=2;ctx.strokeStyle="#2962ff";ctx.fillStyle="rgba(41,98,255,.18)";ctx.beginPath();ctx.arc(qx,qy,11,0,7);ctx.fill();ctx.stroke()}}if(mpv){const mx=X(mpv),my=Y(mpv);if(mx!=null&&my!=null){if(!hasX){ctx.setLineDash([]);ctx.lineWidth=1.5;ctx.strokeStyle=ink();ctx.beginPath();ctx.moveTo(mx-7,my);ctx.lineTo(mx+7,my);ctx.moveTo(mx,my-7);ctx.lineTo(mx,my+7);ctx.stroke()}}}ctx.restore()}
/* ---- chạm trúng ---- */
const dseg=(x,y,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],L=dx*dx+dy*dy;let t=L?((x-a[0])*dx+(y-a[1])*dy)/L:0;t=Math.max(0,Math.min(1,t));return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy)};
function hit(d,x,y,soft){const P=geo(d);if(!P)return false;const[a,b]=P,inB=(p,q,m)=>x>=Math.min(p[0],q[0])-m&&x<=Math.max(p[0],q[0])+m&&y>=Math.min(p[1],q[1])-m&&y<=Math.max(p[1],q[1])+m;
  if(d.k==="hline")return Math.abs(y-a[1])<7*tl;if(d.k==="vline")return Math.abs(x-a[0])<7*tl;if(d.k==="chan"){const dy=cdy(d,a);return dseg(x,y,a,b)<7*tl||dseg(x,y,[a[0],a[1]+dy],[b[0],b[1]+dy])<7*tl}if(d.k==="trend")return dseg(x,y,a,b)<7*tl;if(d.k==="rect"){const x0=Math.min(a[0],b[0]),x1=Math.max(a[0],b[0]),y0=Math.min(a[1],b[1]),y1=Math.max(a[1],b[1]),m=7*tl;if(x<x0-m||x>x1+m||y<y0-m||y>y1+m)return false;return d.bg===false?(Math.min(Math.abs(x-x0),Math.abs(x-x1))<m||Math.min(Math.abs(y-y0),Math.abs(y-y1))<m):true}
  if(d.k==="fib"){const fl=(d.fl||FIBD).filter(q=>q[0]),r=d.rv,pA=d.pts[r?0:1].p,pB=d.pts[r?1:0].p,ex=d.ex===true?"r":d.ex||"n";let x0=Math.min(a[0],b[0]),x1=Math.max(a[0],b[0]);if(ex==="l"||ex==="b")x0=-1e5;if(ex==="r"||ex==="b")x1=1e5;
    return x>=x0-6&&x<=x1+6&&(fl.some(q=>Math.abs(cs.priceToCoordinate(pA+(pB-pA)*q[1])-y)<6*tl)||dseg(x,y,a,b)<6*tl)}
  if(d.k==="ell"){const rx=Math.abs(b[0]-a[0])/2||1,ry=Math.abs(b[1]-a[1])/2||1;const v=Math.hypot((x-(a[0]+b[0])/2)/rx,(y-(a[1]+b[1])/2)/ry);return d.bg===false?Math.abs(v-1)*Math.min(rx,ry)<7*tl:v<=1.1}
  if(d.k==="long"||d.k==="short")return inB([a[0],P[1][1]],[P[1][0],P[2][1]],0);
  if(d.k==="vp"&&soft&&(!d.per||d.per==="custom")&&inB(a,b,4))return true;   // Volume Profile: bấm bất kỳ đâu trong khung (ưu tiên thấp hơn các hình khác nằm đè lên)
  const q=d._b;return!!q&&x>=q[0]-4&&x<=q[0]+q[2]+4&&y>=q[1]-4&&y<=q[1]+q[3]+4}
/* ---- thao tác ---- */
const pickIdx=(x,y,ns)=>{for(let i=D.length-1;i>=0;i--)if(vis(D[i])&&hit(D[i],x,y))return i;if(ns)return -1;for(let i=D.length-1;i>=0;i--)if(vis(D[i])&&D[i].k==="vp"&&hit(D[i],x,y,true))return i;return -1};
/* ---- CẢM ỨNG: chạm chủ động vs kéo/zoom chart ----
   Trước đây ngón tay vừa chạm xuống hình vẽ là hình được chọn và bị kéo đi luôn, nên kéo/zoom chart mà lỡ chạm vào hình (nhất là Volume Profile) là hình dịch chuyển.
   Giờ (chỉ cảm ứng, chuột giữ nguyên): chạm xuống KHÔNG làm gì, chart vẫn kéo/zoom bình thường. Hình chỉ được chọn khi CHẠM NHẸ (nhấc tay nhanh, không di chuyển, không có ngón thứ 2).
   Muốn dời cả hình: chọn hình trước, rồi GIỮ yên ngón tay trên hình ~0,3 giây (máy rung nhẹ) rồi mới kéo. Kéo nút tròn (điểm neo) của hình đang chọn vẫn kéo được ngay.
   Chạm nhẹ vào chỗ trống mới bỏ chọn (kéo/zoom chart không làm mất chọn). Volume Profile trên cảm ứng chỉ chọn khi chạm đúng vào phần hiển thị, không chọn cả khung. */
let tp=null,lpk=false;const TAPMV=10,LPMS=300,TAPMS=450;
const cancelTp=()=>{if(tp&&tp.T)clearTimeout(tp.T);tp=null};
function tpStart(e,x,y){
  cancelTp();lpk=false;
  const i=pickIdx(x,y,true);
  tp={id:e.pointerId,i,x,y,t:Date.now(),lp:false,T:0};
  if(i>=0&&D[i]===sel&&!sel.lk)tp.T=setTimeout(()=>{
    if(!tp||drag)return;tp.T=0;tp.lp=true;claim=true;lpk=true;      // giữ đủ lâu: vào chế độ dời hình, chặn chart kéo theo
    drag={m:"body",o:sel.pts.map(q=>({...q})),l0:ts.coordinateToLogical(tp.x),p0:cs.coordinateToPrice(tp.y),px:tp.x,py:tp.y};
    try{navigator.vibrate&&navigator.vibrate(18)}catch(_){}
    dirty=true},LPMS);
}
const TOFF=46,TWO=["trend","ray","ruler","chan","fib","rect","ell","vp"];const placing=()=>TWO.includes(tool)||(drag&&drag.m==="new");
const rel=e=>{const r=cv.getBoundingClientRect();let y=e.clientY-r.top;if(e.pointerType==="touch"&&placing())y=Math.max(0,y-TOFF);return[e.clientX-r.left,y]};
const done=()=>{if(dwCur&&dwCur.k==="chan"&&dwCur.off==null){const y0=cs.priceToCoordinate(dwCur.pts[0].p);dwCur.off=cs.coordinateToPrice(y0-60)-dwCur.pts[0].p}if(dwCur&&dwCur.pts[0].t===dwCur.pts[1].t&&dwCur.pts[0].p===dwCur.pts[1].p)D=D.filter(z=>z!==dwCur);else sel=dwCur;dwCur=null;if(!keep)tool="cur";save();ui();dirty=true};
function openEdit(d){const q=d._b;if(!q)return;edit=d;const i=document.createElement("input");i.id="dwi";i.value=d.x||"";i.placeholder="Nhập nội dung…";const fz=d.fs||14;i.style.fontSize=fz+"px";const fit=()=>{i.style.width=Math.max(i.value?24:100,i.value.length*fz*.62+12)+"px"};i.oninput=fit;fit();i.style.left=Math.max(4,q[0])+"px";i.style.top=Math.max(4,q[1]-4)+"px";
  let fin=0;const end=ok=>{if(fin)return;fin=1;const v=i.value.trim();if(ok&&v)d.x=v;else if(!d.x)D=D.filter(z=>z!==d);edit=null;i.remove();save();dirty=true};
  i.onkeydown=e=>{e.stopPropagation();if(e.key==="Enter")end(1);else if(e.key==="Escape")end(0)};i.onblur=()=>end(1);$("chart").appendChild(i);setTimeout(()=>i.focus(),0)}
/* ---- NHỚ STYLE theo từng công cụ: chỉnh màu/nét/cỡ chữ... xong thì hình vẽ MỚI cùng loại dùng lại style đó (kể cả sau khi xóa hình cũ hoặc tải lại trang) ---- */
const SDK="tp_dw_style",SDX=["id","k","tk","pts","x","lk","off","qt","vis"],clone=o=>JSON.parse(JSON.stringify(o)),tkOf=d=>d.tk||d.k;
let SD={};try{SD=JSON.parse(localStorage.getItem(SDK))||{}}catch(e){SD={}}
const TDEF={ray:{ex:"r"},ruler:{st:"v",as:true,c:"#8b7cff",ls:"d"}};
function remStyle(d){if(!d||!d.k||(!d.tk&&d.k==="trend"))return;const s={};Object.keys(d).forEach(q=>{if(q[0]!=="_"&&!SDX.includes(q))s[q]=d[q]});SD[tkOf(d)]=clone(s);try{localStorage.setItem(SDK,JSON.stringify(SD))}catch(e){}}
const mk=(k,p,tk)=>{tk=tk||k;const d={id:Date.now()+""+Math.random().toString(36).slice(2,6),k,tk,pts:[p,{...p}]};Object.assign(d,clone(TDEF[tk]||{}),clone(SD[tk]||{}));return d};
$("chart").addEventListener("pointerdown",e=>{tl=e.pointerType==="touch"?2.4:1;tch=tl>1;if(e.isPrimary)claim=false;kc=e.ctrlKey||e.metaKey;ks=e.shiftKey;if(hid||e.button||edit||(e.target&&e.target.id==="dwi"))return;if(e.pointerType==="touch"&&!e.isPrimary&&tool==="cur"){cancelTp();return}const[x,y]=rel(e),[w,h]=plot();if(x>w||y>h||e.clientY-cv.getBoundingClientRect().top>h)return;
  const stop=()=>{e.stopPropagation();e.preventDefault();if(e.pointerType==="touch")claim=true};
  if(tool!=="cur"){stop();const p=pt(x,y);if(!p)return;
    if(tool==="long"||tool==="short"){const L=tool==="long",l1=ts.coordinateToLogical(x+170),d=mk(tool,p),t1=l2s(l1==null?s2l(p.t)+10:l1);
      d.pts=[p,{t:t1,p:cs.coordinateToPrice(y+(L?-120:120))},{t:t1,p:cs.coordinateToPrice(y+(L?60:-60))}];D.push(d);dwCur=d;done();return}
    if(tool==="hline"||tool==="vline"){const d=mk(tool,p);d.pts=[p];D.push(d);sel=d;if(!keep)tool="cur";save();ui();dirty=true;return}if(tool==="text"||tool==="note"){const d=mk(tool,p);d.pts=[p];D.push(d);sel=d;tool="cur";ui();render();if(e.pointerType==="touch")pendEdit=d;else openEdit(d);return}
    if(!dwCur){dwCur=mk(tool==="ray"||tool==="ruler"?"trend":tool,p,tool);D.push(dwCur);drag={m:"new",x,y}}else{dwCur.pts[1]=cp(x,y,dwCur,1)||p;done()}dirty=true;return}
  if(sel&&!sel.lk){const h=hnd(sel).find(q=>Math.hypot(q[0]-x,q[1]-y)<9*tl);if(h){stop();
    if((sel.k==="long"||sel.k==="short")&&h[2]===0)drag={m:"body",o:sel.pts.map(q=>({...q})),l0:ts.coordinateToLogical(x),p0:cs.coordinateToPrice(y),px:x,py:y};else drag={m:"h",i:h[2],gx:e.pointerType==="touch"?h[0]-x:0,gy:e.pointerType==="touch"?h[1]-y:0};return}}
  if(e.pointerType==="touch"){tpStart(e,x,y);return}   // cảm ứng: chưa chọn gì, đợi xem là chạm nhẹ hay kéo/zoom
  for(let i=pickIdx(x,y);i>=0;i=-1){if(D[i].lk){sel=D[i];ui();dirty=true;return}stop();sel=D[i];drag={m:"body",o:sel.pts.map(q=>({...q})),l0:ts.coordinateToLogical(x),p0:cs.coordinateToPrice(y),px:x,py:y};ui();dirty=true;return}
  if(sel){sel=null;ui();dirty=true}},true);
window.addEventListener("pointermove",e=>{const[x,y]=rel(e);if(tp&&e.pointerId===tp.id&&!tp.lp&&Math.hypot(x-tp.x,y-tp.y)>TAPMV)cancelTp();tch=e.pointerType==="touch";kc=e.ctrlKey||e.metaKey;ks=e.shiftKey;lx=x;ly=y;upd();
  if(dwCur&&tool==="cur"===false&&dwCur.pts){const p=cp(x,y,dwCur,1);if(p){dwCur.pts[1]=p;dirty=true}}
  if(!drag)return;
  if(drag.m==="new"){const p=cp(x,y,dwCur,1);if(p){dwCur.pts[1]=p;dirty=true}}
  else if(drag.m==="body"){const l=ts.coordinateToLogical(x),p=cs.coordinateToPrice(y);if(l==null||p==null)return;let dl=l-drag.l0,dp=p-drag.p0;if(ks){if(Math.abs(x-drag.px)>=Math.abs(y-drag.py))dp=0;else dl=0}sel.pts=drag.o.map(q=>({t:l2s(s2l(q.t)+dl),p:q.p+dp}));dirty=true}
  else if(drag.m==="h"){const gy=drag.gy||0,s=sel,p=cp(x+(drag.gx||0),y+gy,s,drag.i);if(!p)return;
    if(s.k==="long"||s.k==="short"){if(drag.i===1){s.pts[1]=p;s.pts[2].t=p.t}else if(drag.i===2){s.pts[2].p=p.p;s.pts[2].t=p.t;s.pts[1].t=p.t}else{s.pts[1].t=s.pts[2].t=p.t}}else if((s.k==="rect"||s.k==="ell")&&drag.i>1)rdrag(s,drag,p);else if(s.k==="chan"&&drag.i===2)s.off=cs.coordinateToPrice(y+gy)-(s.pts[0].p+s.pts[1].p)/2;else s.pts[drag.i]=p;dirty=true}});
window.addEventListener("pointercancel",e=>{if(tp&&e.pointerId===tp.id&&!tp.lp)cancelTp()});
window.addEventListener("pointerup",e=>{if(tp&&e.pointerId===tp.id){const t=tp;cancelTp();if(!t.lp&&Date.now()-t.t<TAPMS){if(t.i>=0){sel=D[t.i];ui();dirty=true}else if(sel){sel=null;ui();dirty=true}}}if(pendEdit){const d=pendEdit;pendEdit=null;openEdit(d)}if(e.pointerType==="touch")setTimeout(upd,0);if(!drag)return;const m=drag.m;if(m==="new"){const[x,y]=rel(e);if(Math.hypot(x-drag.x,y-drag.y)>(tl>1?14:6)){drag=null;done();return}}else save();drag=null});
/* chạm: khi module vẽ đã nhận cử chỉ (đang vẽ / kéo hình) thì chặn sự kiện chạm gốc, để chart không bị kéo theo ngón tay */
(()=>{const eat=e=>{if(lpk&&(e.type==="touchend"||e.type==="touchcancel")){if(e.touches.length===0){claim=false;lpk=false}return}if(!claim)return;e.stopImmediatePropagation();if(e.cancelable)e.preventDefault();if((e.type==="touchend"||e.type==="touchcancel")&&e.touches.length===0)claim=false};["touchstart","touchmove","touchend","touchcancel"].forEach(n=>$("chart").addEventListener(n,eat,{capture:true,passive:false}))})();
function rdrag(s,dr,p){const i=dr.i,P=geo(s);if(!P)return;const[a,b]=P;
  if(i===2){s.pts[1].t=p.t;s.pts[0].p=p.p;return}if(i===3){s.pts[0].t=p.t;s.pts[1].p=p.p;return}
  if(dr.ix===undefined)dr.ix=i<6?(i===4?(a[1]<=b[1]?0:1):(a[1]<=b[1]?1:0)):(i===6?(a[0]<=b[0]?0:1):(a[0]<=b[0]?1:0));
  if(i<6)s.pts[dr.ix].p=p.p;else s.pts[dr.ix].t=p.t}
function curAt(x,y){if(sel&&!sel.lk){const H2=hnd(sel),h=H2.find(q=>Math.hypot(q[0]-x,q[1]-y)<9*tl);if(h){const k=sel.k;if(k==="hline")return"ns-resize";if(k==="vline")return"ew-resize";if(k==="long"||k==="short")return h[2]===2?"ns-resize":h[2]===3?"ew-resize":h[2]===1?"nesw-resize":"move";if(k==="chan"&&h[2]===2)return"ns-resize";
    if(k==="rect"||k==="ell"){if(h[2]>=4)return h[2]<6?"ns-resize":"ew-resize";const cx=H2[4][0],cy=H2[6][1];return(h[0]-cx)*(h[1]-cy)>=0?"nwse-resize":"nesw-resize"}
    if(k==="fib"){const o=H2.find(q=>q[2]===(h[2]?0:1))||h;return(h[0]-o[0])*(h[1]-o[1])>=0?"nwse-resize":"nesw-resize"}return"pointer"}}
  const d=D[pickIdx(x,y)];return!d?null:d.lk?"default":d.k==="hline"?"ns-resize":d.k==="vline"?"ew-resize":"pointer"}
$("chart").addEventListener("pointermove",e=>{if(hid||drag||tool!=="cur")return;const[x,y]=rel(e),c=curAt(x,y),k=$("chart");if(c)k.style.setProperty("--dwc",c);k.classList.toggle("dwh",!!c)},true);
$("chart").addEventListener("dblclick",e=>{if(hid||tool!=="cur")return;const[x,y]=rel(e),d=D[pickIdx(x,y)];if(d){e.stopPropagation();e.preventDefault();sel=d;ui();(d.k==="text"||d.k==="note")?openEdit(d):openDlg(d)}},true);
function askDel(go){let sk=0;try{sk=localStorage.getItem("tp_dw_nocf")==="1"}catch(e){}if(sk){go();return}
  const o=document.createElement("div");o.className="mdl";o.setAttribute("role","dialog");o.setAttribute("aria-modal","true");o.setAttribute("data-no-i18n","");
  o.innerHTML=`<div class="box" style="max-width:380px"><header><h3>${dl("Xóa tất cả hình vẽ?","Delete all drawings?","删除所有绘图？")}</h3></header><div class="bd" style="min-height:0"><p style="margin:0 0 14px;color:var(--mut);line-height:1.5">${dl("Có "+D.length+" hình vẽ trên "+C.sym+" sẽ bị xóa. Nếu lỡ tay, bạn có thể bấm Ctrl+Z để lấy lại.",D.length+" drawings on "+C.sym+" will be deleted. If you change your mind, press Ctrl+Z to get them back.","将删除 "+C.sym+" 上的 "+D.length+" 个绘图。误删后可按 Ctrl+Z 恢复。")}</p><label style="display:flex;gap:8px;align-items:center;font-size:13px;cursor:pointer"><input type="checkbox" id="dwnc" style="width:16px;height:16px">${dl("Không hỏi lại lần sau","Don't ask me again","下次不再提示")}</label></div><footer><span style="flex:1"></span><button class="btn ghost sm" type="button" data-k="n">${dl("Giữ lại","Keep","保留")}</button><button class="btn sm" type="button" data-k="y" style="background:var(--loss);color:#fff">${dl("Xóa tất cả","Delete all","全部删除")}</button></footer></div>`;
  o.onclick=e=>{const b=e.target.closest("[data-k]");if(!b&&e.target!==o)return;if(b&&b.dataset.k==="y"){if(o.querySelector("#dwnc").checked)try{localStorage.setItem("tp_dw_nocf","1")}catch(x){}go()}o.remove()};
  o.onkeydown=e=>{if(e.key==="Escape"){e.stopPropagation();o.remove()}};o.tabIndex=-1;document.body.appendChild(o);o.focus()}
bar.ondblclick=e=>{const b=e.target.closest("[data-t]");if(!b)return;const t=b.dataset.t;if(["cur","mag","eye","del","undo","redo"].includes(t))return;tool=t;keep=true;hid=false;sel=null;ui();dirty=true};
let lpDone=false,lpT=0;bar.addEventListener("contextmenu",e=>e.preventDefault());
bar.addEventListener("pointerdown",e=>{const b=e.target.closest("[data-t]");if(!b||e.pointerType!=="touch")return;const t=b.dataset.t;if(["cur","mag","eye","del","undo","redo"].includes(t))return;clearTimeout(lpT);lpT=setTimeout(()=>{lpT=0;lpDone=true;if(dwCur){D=D.filter(z=>z!==dwCur);dwCur=null}tool=t;keep=true;hid=false;sel=null;ui();dirty=true;try{navigator.vibrate&&navigator.vibrate(12)}catch(x){}},450)});
["pointerup","pointercancel","pointerleave"].forEach(n=>bar.addEventListener(n,()=>{clearTimeout(lpT)}));
bar.onclick=e=>{const b=e.target.closest("[data-t]");if(!b)return;if(lpDone){lpDone=false;return}const t=b.dataset.t;
  if(t==="undo")undo();else if(t==="redo")redo();else if(t==="mag")mag=!mag;else if(t==="eye"){hid=!hid;if(hid){sel=null;dwCur=null}}
  else if(t==="del"){if(D.length)askDel(()=>{D=[];sel=dwCur=null;save();ui();dirty=true})}
  else{if(dwCur){D=D.filter(z=>z!==dwCur);dwCur=null}tool=t;keep=false;if(t!=="cur")hid=false;if(t!=="cur")sel=null}
  ui();dirty=true};
const DS={d:[8,6],o:[2,4]},fo=(d,v)=>d.fo==null?v:d.fo;
const mixc=(h,t,w)=>{const m=parseInt(h.slice(1),16);return"#"+[m>>16,m>>8&255,m&255].map(v=>Math.round(v+(w-v)*t).toString(16).padStart(2,"0")).join("")};
const BASE=["#f23645","#ff9800","#ffeb3b","#4caf50","#089981","#00bcd4","#2962ff","#673ab7","#9c27b0","#e91e63"];
const GRID=[Array.from({length:10},(_,i)=>mixc("#ffffff",i/9,0)),BASE,...[[.8,255],[.6,255],[.4,255],[.25,0],[.5,0]].map(([t,w])=>BASE.map(c=>mixc(c,t,w)))];
let CC=[],pcb=null;try{CC=JSON.parse(localStorage.getItem("tp_dw_cc"))||[]}catch(e){}
const normHex=v=>{v=String(v).trim().replace(/^#/,"").toLowerCase();if(/^[0-9a-f]{3}$/.test(v))v=v.replace(/./g,"$&$&");return/^[0-9a-f]{6}$/.test(v)?"#"+v:null};
const palInner=c0=>{const sw=c=>`<i data-c="${c}"${c===c0?' class="on"':""} style="background:${c}"></i>`;return GRID.map(r=>`<div class="r">${r.map(sw).join("")}</div>`).join("")+`<hr><div class="r cc">${CC.map(sw).join("")}</div><div class="hx"><b style="background:${c0}"></b><input id="dwh" type="text" maxlength="7" placeholder="#RRGGBB" value="${c0}" aria-label="Hex"><button type="button" data-a="hex">Thêm</button></div>`};
function closePal(){const k=$("dwk");if(k)k.remove();pcb=null}
function openPal(btn,c0,cb){closePal();pcb=cb;const k=document.createElement("div");k.id="dwk";k.innerHTML=palInner(String(c0).toLowerCase());const r=btn.getBoundingClientRect();
  k.style.left=Math.max(6,Math.min(r.left,innerWidth-276))+"px";k.style.top=Math.max(6,Math.min(r.bottom+6,innerHeight-290))+"px";document.body.appendChild(k)}
document.addEventListener("click",e=>{if(!pcb||!e.target.closest("#dwk"))return;const c=e.target.closest("[data-c]"),a=e.target.closest("[data-a=hex]");
  if(c){const f=pcb;closePal();f(c.dataset.c)}
  else if(a){const h=normHex($("dwh").value);if(!h){$("dwh").style.borderColor="var(--loss)";return}CC=[h,...CC.filter(x=>x!==h)].slice(0,10);try{localStorage.setItem("tp_dw_cc",JSON.stringify(CC))}catch(x){}const f=pcb;closePal();f(h)}});
document.addEventListener("input",e=>{if(e.target.id!=="dwh")return;const h=normHex(e.target.value);e.target.style.borderColor="";if(h)e.target.previousElementSibling.style.background=h});
document.addEventListener("pointerdown",e=>{if(pcb&&!e.target.closest("#dwk,[data-fc],[data-a=pal]"))closePal()},true);
/* thanh nhỏ trên chart: màu / cài đặt / xóa */
function panel0(){pp.innerHTML=`<button type="button" class="dwcb" data-a="pal" title="Màu hình vẽ" aria-label="Màu hình vẽ"><i style="background:${col(sel)}"></i></button><button type="button" class="dwx" data-a="set" title="Cài đặt hình vẽ" aria-label="Cài đặt hình vẽ" style="color:var(--ink)"><svg viewBox="0 0 20 20">${dwIC.set}</svg></button><button type="button" class="dwx" data-a="del" title="Xóa hình đang chọn" aria-label="Xóa hình đang chọn"><svg viewBox="0 0 20 20">${dwIC.del}</svg></button>`}
function panel(){panel0();const x=pp.querySelector('[data-a="del"]');if(!x||!sel)return;const B=(a,i,t)=>`<button type="button" class="dwx" data-a="${a}" title="${t}" aria-label="${t}" style="color:var(--ink)"><svg viewBox="0 0 20 20">${dwIC[i]}</svg></button>`;
  x.insertAdjacentHTML("beforebegin",B("lk",sel.lk?"unlock":"lock",sel.lk?"Mở khóa hình":"Khóa hình")+B("dup","dup","Nhân bản")+B("up","up","Đưa lên lớp trên cùng")+B("dn","dn","Đưa xuống lớp dưới cùng"))}
const paste=t=>{try{const d=JSON.parse(t);d.id=Date.now()+""+Math.random().toString(36).slice(2,6);delete d.lk;d.pts=d.pts.map(q=>({t:l2s(s2l(q.t)+3),p:q.p}));D.push(d);sel=d;clip=JSON.stringify(d,rp);save();ui();dirty=true}catch(e){}};
const dup=()=>{if(sel)paste(JSON.stringify(sel,rp))};
const mv=t=>{const i=D.indexOf(sel);if(i<0)return;D.splice(i,1);t==="up"?D.push(sel):D.unshift(sel);save();dirty=true};
pp.addEventListener("click",e=>{const a=e.target.closest("[data-a]");if(!a||!sel)return;const t=a.dataset.a;
  if(t==="pal")openPal(a,col(sel),c=>{sel.c=c;remStyle(sel);save();dirty=true;panel()});else if(t==="set")openDlg(sel);
  else if(t==="lk"){sel.lk=!sel.lk;save();ui();dirty=true}else if(t==="dup")dup();else if(t==="up"||t==="dn")mv(t);else if(t==="del"){D=D.filter(z=>z!==sel);sel=null;closePal();save();ui();dirty=true}});
/* hộp thoại cài đặt riêng cho từng công cụ (áp dụng trực tiếp, Hủy sẽ hoàn lại) */
const TN={vp:"Volume Profile",hline:"Đường ngang",vline:"Đường dọc",chan:"Kênh song song",trend:"Đường xu hướng",fib:"Fibonacci",long:"Lệnh Long",short:"Lệnh Short",rect:"Hình chữ nhật",ell:"Hình elip",text:"Văn bản",note:"Ghi chú"};
const jr=(k,v)=>k[0]==="_"?undefined:v,esc=s=>String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;");
const FI={on:0,v:1,c:2};
const getF=(d,f)=>{const p=f.split(".");return p[0]==="fl"?(d.fl||FIBD)[+p[1]][FI[p[2]]]:d[f]};
const setF=(d,f,v)=>{const p=f.split(".");if(p[0]==="fl"){if(!d.fl)d.fl=FIBD.map(x=>[...x]);d.fl[+p[1]][FI[p[2]]]=v}else d[f]=v};
function openDlg(d){
  if(document.querySelector(".mdl"))return;closePal();sel=d;const bak=JSON.stringify(d,jr),k=d.k,pos=k==="long"||k==="short";
  const TB=k==="vp"?[["g","Profile"],["s","Kiểu dáng"],["v","Hiển thị"]]:[...(pos?[["i","Thông số"]]:[]),["s","Kiểu dáng"],...(["trend","rect","ell","fib","long","short","chan"].includes(k)?[["t","Văn bản"]]:[]),["c","Tọa độ"],["v","Hiển thị"]];let tab=TB[0][0];
  const LS=[["s","Liền"],["d","Đứt nét"],["o","Chấm"]],WS=[1,2,3,4].map(n=>[n,n+"px"]),EXT=[["n","Không kéo dài"],["l","Kéo dài sang trái"],["r","Kéo dài sang phải"],["b","Kéo dài hai phía"]],
    HA=[["l","Bên trái"],["c","Ở giữa"],["r","Bên phải"]],VA=[["t","Phía trên"],["m","Ở giữa"],["b","Phía dưới"]],FS=a=>a.map(n=>[n,n]);
  const R=(l,h)=>`<div class="dr"><span class="l">${l}</span>${h}</div>`,
    CX=(f,l,def,x)=>`<div class="dr"><input type="checkbox" data-f="${f}"${(getF(d,f)??def)?" checked":""}><span>${l}</span>${x||""}</div>`,
    CB=(f,def)=>`<button type="button" class="dwcb" data-fc="${f}"><i style="background:${getF(d,f)||def}"></i></button>`,
    SE=(f,o,def)=>`<select data-f="${f}">${o.map(x=>`<option value="${x[0]}"${String(getF(d,f)??def)===String(x[0])?" selected":""}>${x[1]}</option>`).join("")}</select>`,
    NU=(f,def,x)=>`<input type="number" step="any" min="0" data-f="${f}" value="${getF(d,f)??def}"${x||""}>`,
    OP=(f,def)=>`<input type="range" data-f="${f}" min="0" max="100" value="${Math.round((getF(d,f)??def)*100)}">`,
    PI=(i,kk)=>`<input type="number" step="any" data-pi="${i}" data-pk="${kk}" value="${kk==="p"?+d.pts[i].p.toFixed(5):Math.round(s2l(d.pts[i].t))}">`,
    TXT=`<textarea data-f="x" placeholder="Nhập nội dung…">${esc(d.x)}</textarea>`;
  const body=()=>{
    if(k==="vp"&&["g","s"].includes(tab))return vpTab(tab,d,{R,CX,CB,SE,NU,OP});
    if(tab==="i")return R("Vốn tài khoản",NU("ac",1000))+R("Rủi ro (%)",NU("rk",1))+R("Khối lượng (để trống = tự tính)",`<input type="number" step="any" min="0" data-f="qt" value="${d.qt||""}" placeholder="${posI(d).qty}">`)+R("Giá vào",PI(0,"p"))+R("Mức chốt lời",PI(1,"p"))+R("Mức cắt lỗ",PI(2,"p"));
    if(tab==="c")return`<div class="dr"><span class="l"></span><span class="h">Giá</span><span class="h">Nến</span></div>`+d.pts.map((q,i)=>`<div class="dr"><span class="l">#${i+1}</span>${PI(i,"p")}${PI(i,"b")}</div>`).join("");
    if(tab==="v"){const v=d.vis||allTfs().map(t=>t[1]);return`<p class="msg">Chỉ hiện hình vẽ trên các khung được chọn.</p><div class="bar">${allTfs().map(([n,s])=>`<label class="chk"><input type="checkbox" data-v="${s}"${v.includes(s)?" checked":""}>${n}</label>`).join("")}</div>`}
    if(tab==="t")return R("Màu chữ",CB("tc",col(d))+SE("fs",FS([12,14,18,24,32]),14))+CX("b","Đậm")+CX("i","Nghiêng")+TXT+R("Căn dọc",SE("va",VA,k==="trend"?"t":"m"))+R("Căn ngang",SE("ha",HA,k==="trend"?"r":"c"));
    if(k==="trend")return R("Đường",CB("c",col(d))+SE("w",WS,2)+SE("ls",LS,"s"))+R("Đầu A",SE("s1",[["n","Thường"],["a","Mũi tên"]],"n"))+R("Đầu B",SE("e1",[["n","Thường"],["a","Mũi tên"]],"n"))+R("Kéo dài",SE("ex",EXT,"n"))+CX("mp","Điểm giữa")+CX("pl","Nhãn giá")+
      `<h4>Thông tin</h4>`+R("Thống kê",SE("st",[["h","Ẩn"],["v","Giá trị"]],"h"))+R("Vị trí thống kê",SE("sp",HA,"r"))+CX("as","Luôn hiện thống kê");
    if(k==="hline"||k==="vline"||k==="chan")return R("Đường",CB("c",col(d))+SE("w",WS,2)+SE("ls",LS,"s"))+(k==="chan"?CX("bg","Nền",true,OP("fo",.08)):"");
    if(k==="fib")return CX("tl","Đường xu hướng",true,CB("tc2","#98a2d8")+SE("tls",LS,"d"))+R("Đường mức",SE("lw",WS,1)+SE("ls",LS,"s"))+R("Kéo dài",SE("ex",EXT,"n"))+
      `<div class="fg">${(d.fl||FIBD).map((q,i)=>`<div class="dr"><input type="checkbox" data-f="fl.${i}.on"${q[0]?" checked":""}><input type="number" step="any" data-f="fl.${i}.v" value="${q[1]}">${CB("fl."+i+".c")}</div>`).join("")}</div>`+
      CX("uo","Dùng một màu",false,CB("oc","#2962ff"))+CX("bg","Nền",true,OP("fo",.08))+CX("rv","Đảo chiều")+CX("pr","Giá",true)+CX("lb","Các mức",true,SE("lm",[["v","Giá trị"],["p","Phần trăm"]],"v"))+R("Nhãn",SE("lh",[["l","Bên trái"],["r","Bên phải"]],"l")+SE("lv2",VA,"t"))+R("Cỡ chữ",SE("fs",FS([10,12,14,16,18]),12));
    if(pos)return R("Màu chốt lời",CB("pc",COL().up))+R("Màu cắt lỗ",CB("sc",COL().dn))+R("Màu đường vào",CB("c",col(d)))+R("Độ phủ",OP("fo",.2));
    if(k==="rect"||k==="ell")return R("Viền",CB("c",col(d))+SE("w",WS,2)+SE("ls",LS,"s"))+CX("bg","Nền",true,CB("fc",col(d))+OP("fo",k==="rect"?.15:.12));
    return R(k==="note"?"Màu nền":"Màu chữ",CB("c",col(d)))+(k==="note"?R("Màu chữ",CB("tc","#2a2000")):"")+R("Cỡ chữ",SE("fs",FS([12,14,18,24,32]),14))+CX("b","Đậm")+CX("i","Nghiêng")+TXT};
  const o=document.createElement("div");o.className="mdl";o.tabIndex=-1;o.setAttribute("role","dialog");o.setAttribute("aria-modal","true");
  const ren=()=>{const y=(o.querySelector(".bd")||{}).scrollTop||0;
    o.innerHTML=`<div class="box" style="max-width:${k==="fib"?"520px":"460px"}"><header><h3>${TN[k]}</h3><button class="ib" type="button" data-x="c" aria-label="Đóng" style="width:36px;height:36px">✕</button></header><div class="tabs">${TB.map(([t,n])=>`<button type="button" data-tab="${t}" class="${t===tab?"on":""}">${n}</button>`).join("")}</div><div class="bd">${body()}</div><footer><span style="flex:1"></span><button class="btn ghost sm" type="button" data-x="c">Hủy</button><button class="btn sm" type="button" data-x="o">OK</button></footer></div>`;o.querySelector(".bd").scrollTop=y};
  const close=ok=>{closePal();if(!ok){const i=D.indexOf(d);if(i>=0){D[i]=JSON.parse(bak);sel=D[i]}}else remStyle(d);o.remove();save();ui();dirty=true};
  o.onclick=e=>{const t=e.target.closest("[data-tab],[data-x],[data-fc]");if(!t)return;
    if(t.dataset.tab){tab=t.dataset.tab;closePal();ren()}else if(t.dataset.x)close(t.dataset.x==="o");
    else openPal(t,getF(d,t.dataset.fc)||"#ffffff",c=>{setF(d,t.dataset.fc,c);save();dirty=true;ren()})};
  o.addEventListener("input",e=>{const t=e.target;
    if(t.dataset.v){const l=[...o.querySelectorAll("[data-v]")].filter(x=>x.checked).map(x=>+x.dataset.v);if(!l.length){t.checked=true;return}if(l.length===allTfs().length)delete d.vis;else d.vis=l}
    else if(t.dataset.pi!==undefined){const i=+t.dataset.pi,v=+t.value;if(t.value===""||!isFinite(v))return;
      if(t.dataset.pk==="p")d.pts[i].p=v;else{const s=l2s(v);d.pts[i].t=s;if(pos&&i>0){d.pts[1].t=s;d.pts[2].t=s}}}
    else if(t.dataset.f){let v=t.type==="checkbox"?t.checked:t.value;
      if(t.type==="range")v=v/100;else if(t.type==="number"){if(v==="")v=null;else{v=+v;if(!isFinite(v))return}}else if(t.tagName==="SELECT"&&/^-?\d+(\.\d+)?$/.test(v))v=+v;
      setF(d,t.dataset.f,v)}
    else return;save();dirty=true});
  o.addEventListener("keydown",e=>{if(e.key==="Escape"){e.stopPropagation();close(false)}});
  document.body.appendChild(o);ren();o.focus()}
document.addEventListener("keydown",e=>{if(document.querySelector(".mdl"))return;if(/INPUT|TEXTAREA|SELECT/.test((e.target||{}).tagName||""))return;
  if((e.key==="Delete"||e.key==="Backspace")&&sel&&$("v-chart").classList.contains("on")){D=D.filter(z=>z!==sel);sel=null;save();ui();dirty=true}
  else if(e.key==="Escape"){if(dwCur){D=D.filter(z=>z!==dwCur);dwCur=null}tool="cur";keep=false;sel=null;ui();dirty=true}});
document.addEventListener("keydown",e=>{if(document.querySelector(".mdl")||/INPUT|TEXTAREA|SELECT/.test((e.target||{}).tagName||"")||!$("v-chart").classList.contains("on"))return;const m=e.ctrlKey||e.metaKey,k=e.key.toLowerCase();
  if(m&&k==="z"){e.preventDefault();e.shiftKey?redo():undo()}else if(m&&k==="y"){e.preventDefault();redo()}else if(m&&k==="c"&&sel)clip=JSON.stringify(sel,rp);else if(m&&k==="v"&&clip){e.preventDefault();paste(clip)}else if(m&&k==="d"&&sel){e.preventDefault();dup()}});
/* chart không có sự kiện đổi thang giá, nên kiểm tra mỗi khung hình và chỉ vẽ lại khi có thay đổi */
(function tick(){requestAnimationFrame(tick);if(C.sym!==dsym)loadD();const r=$("chart").getBoundingClientRect(),a=ts.getVisibleLogicalRange();
  const s=[r.width,r.height,a&&a.from,a&&a.to,cs.priceToCoordinate(0),cs.priceToCoordinate(1000),n(),P.theme,C.tf,baseArr().length,baseSig(),FPV,DOM.v,ACT.length,(window.crossAssetMapRenderKey?window.crossAssetMapRenderKey():""),(window.marketModelIndicatorsRenderKey?window.marketModelIndicatorsRenderKey():""),JSON.stringify([fpOn(),btOn(),stOn(),hvnOn(),haOn(),domOn(),kzOn(),gbOn(),qtOn()].map(x=>x||0))].join();if(s!==sig||dirty){sig=s;dirty=false;try{render()}catch(e){chErr("render",e);setTimeout(()=>{dirty=true},500)}}})();
ui();
