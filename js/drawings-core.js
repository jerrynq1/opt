const cv=document.createElement("canvas");cv.id="dw";$("chart").appendChild(cv);
const ctx=cv.getContext("2d"),ts=chart.timeScale(),card=$("chartCard");
let D=[],sel=null,tool="cur",mag=true,hid=false,dwCur=null,dsym=null,drag=null,dirty=true,sig="",edit=null;
const dl=(v,e,z)=>{const l=window.I18N?I18N.get():"vi";return l==="en"?e:l==="zh"?z:v};
const ink=()=>P.theme==="dark"?"#fff4d9":"#2a1c06";
const DC={trend:"#35b6ff",hline:"#35b6ff",vline:"#35b6ff",chan:"#35b6ff",fib:"#ffb02e",rect:"#8b7cff",ell:"#8b7cff",note:"#ffd24a",long:"#98a2d8",short:"#98a2d8"};
const col=d=>d.c||DC[d.k]||ink();
const FIB=[[0,"#98a2d8"],[.236,"#ff5c8a"],[.382,"#ffb02e"],[.5,"#3df5c0"],[.618,"#35b6ff"],[.786,"#8b7cff"],[1,"#98a2d8"]];
const dwIC={set:'<circle cx="10" cy="10" r="2.6"/><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4"/>',cur:'<path d="M5 3l11 7-5 1.5L8.5 17z"/>',trend:'<path d="M4 16L16 4"/><circle cx="4" cy="16" r="1.8"/><circle cx="16" cy="4" r="1.8"/>',
fib:'<path d="M3 4h14M3 8h14M3 12h14M3 16h14"/><path d="M6 4l8 12" stroke-dasharray="2 2"/>',vp:'<path d="M3 3v14"/><path d="M3 4.5h8M3 8h12M3 11.5h6M3 15h10"/>',
long:'<path d="M3 3h14v7H3z" fill="currentColor" fill-opacity=".3"/><path d="M3 10h14v4H3z"/>',
short:'<path d="M3 10h14v7H3z" fill="currentColor" fill-opacity=".3"/><path d="M3 6h14v4H3z"/>',
rect:'<rect x="3.5" y="5.5" width="13" height="9" rx="1"/>',ell:'<ellipse cx="10" cy="10" rx="7" ry="5"/>',
text:'<path d="M5 5h10M10 5v11"/>',note:'<path d="M4 4h12v9H9l-4 3v-3H4z"/>',
mag:'<path d="M5 3v7a5 5 0 0010 0V3h-3v7a2 2 0 01-4 0V3z"/>',eye:'<path d="M2 10s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5z"/><circle cx="10" cy="10" r="2"/>',
del:'<path d="M4 6h12M8 6V4h4v2M6 6l1 10h6l1-10"/>',
hline:'<path d="M3 10h14"/><circle cx="10" cy="10" r="1.6"/>',vline:'<path d="M10 3v14"/><circle cx="10" cy="10" r="1.6"/>',ray:'<path d="M4 15L17 5"/><circle cx="4" cy="15" r="1.8"/>',chan:'<path d="M3 12L14 4M6 17l11-8"/>',ruler:'<path d="M3 13L13 3l4 4L7 17z"/><path d="M6 10l2 2M9 7l2 2M12 4l1.5 1.5"/>',
undo:'<path d="M7 5L3.5 8.5 7 12M4 8.5h7a4.5 4.5 0 010 9H8"/>',redo:'<path d="M13 5l3.5 3.5L13 12M16 8.5H9a4.5 4.5 0 000 9h3"/>',
lock:'<rect x="4.5" y="9" width="11" height="8" rx="1.5"/><path d="M7 9V6.5a3 3 0 016 0V9"/>',unlock:'<rect x="4.5" y="9" width="11" height="8" rx="1.5"/><path d="M7 9V6.5a3 3 0 015.8-1"/>',
dup:'<rect x="7" y="7" width="9" height="9" rx="1.5"/><path d="M13 7V5a1.5 1.5 0 00-1.5-1.5H5A1.5 1.5 0 003.5 5v6.5A1.5 1.5 0 005 13h2"/>',up:'<path d="M10 16V4M5.5 8.5L10 4l4.5 4.5"/>',dn:'<path d="M10 4v12M5.5 11.5L10 16l4.5-4.5"/>'};
const TT=[["cur","Con trỏ"],["trend","Đường xu hướng"],["ray","Tia"],["hline","Đường ngang"],["vline","Đường dọc"],["chan","Kênh song song"],["ruler","Thước đo"],["fib","Fibonacci"],["vp","Volume Profile"],["long","Lệnh Long"],["short","Lệnh Short"],["rect","Hình chữ nhật"],["ell","Hình elip"],["text","Văn bản"],["note","Ghi chú"],0,["undo","Hoàn tác"],["redo","Làm lại"],0,["mag","Nam châm: bắt giá Open/High/Low/Close"],["eye","Ẩn / hiện hình vẽ"],["del","Xóa tất cả hình vẽ"]];
const st=document.createElement("style");
st.textContent="#cw{inset:6px 6px 36px 46px!important}#ohlc,#legend{left:54px!important}#dw{position:absolute;left:0;top:0;pointer-events:none;z-index:5}"+
"#dwt{position:absolute;left:6px;top:6px;bottom:36px;width:34px;z-index:7;display:flex;flex-direction:column;align-items:center;gap:2px;padding:4px 0;overflow-y:auto;scrollbar-width:none;border-right:1px solid var(--line)}"+
"#dwt button{flex:none;width:30px;height:30px;display:grid;place-items:center;padding:0;border:0;border-radius:8px;background:transparent;color:var(--mut);cursor:pointer}"+
"#dwt button:hover{background:var(--inp);color:var(--ink)}#dwt button.on{background:var(--inp);color:var(--win)}#dwt button.keep{outline:1.5px solid var(--win);outline-offset:-2px}#dwt svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}"+
"#dwt hr{flex:none;width:22px;border:0;border-top:1px solid var(--line);margin:4px 0}"+
"#dwp{position:absolute;top:10px;left:50%;transform:translateX(-50%);z-index:8;display:none;align-items:center;gap:6px;padding:4px 8px;background:var(--hole);border:1px solid var(--line);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,10,.35)}"+
"#dwp input{width:28px;height:24px;padding:0;border:0;background:none;cursor:pointer}#dwp button{width:28px;height:28px;display:grid;place-items:center;padding:0;border:0;border-radius:8px;background:transparent;color:var(--loss);cursor:pointer}#dwp svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.6}"+
"#chart.dwa *{cursor:crosshair!important}#chart.dwh,#chart.dwh *{cursor:var(--dwc,pointer)!important}#chart.dwa,#chart.dwn,#chart.dwn *{touch-action:none}#dwi{position:absolute;z-index:9;min-width:24px;padding:1px 4px;line-height:1.2;box-sizing:content-box;font:600 14px 'Space Grotesk',sans-serif;color:var(--ink);background:var(--hole);border:1px solid var(--win);border-radius:8px;outline:0}";
st.textContent+="#dwp{left:50px;right:10px;transform:none;width:max-content;max-width:calc(100% - 60px);margin:0 auto;flex-wrap:wrap;justify-content:center}#dwp .dwl{display:flex;align-items:center;gap:5px;font-size:12px;color:var(--mut)}"+
"#dwp .dwl select,#dwp .dwl input[type=text],#dwp .dwl input[type=number]{width:auto;height:26px;padding:0 6px;font-size:12px;border-radius:7px;border:1px solid var(--line);background:var(--inp);color:var(--ink)}#dwp .dwl input[type=number]{width:60px}#dwp .dwl input[type=range]{width:70px;height:auto;padding:0;border:0}#dwp .dwl input[type=checkbox]{width:16px;height:16px}"+
"#dwp .dwcb{width:32px;height:28px;border:1px solid var(--line)!important;background:var(--inp)!important}#dwp .dwcb i{width:18px;height:18px;border-radius:5px;display:block;box-shadow:0 0 0 1px rgba(255,255,255,.3) inset}"+
"#dwk{position:absolute;top:calc(100% + 6px);left:0;z-index:12;padding:10px;background:var(--hole);border:1px solid var(--line);border-radius:12px;box-shadow:0 12px 32px rgba(0,0,10,.5)}#dwk .r{display:grid;grid-template-columns:repeat(10,22px);gap:4px;margin-bottom:4px}"+
"#dwk .r i{width:22px;height:22px;border-radius:4px;cursor:pointer;box-shadow:0 0 0 1px rgba(128,128,128,.25) inset}#dwk .r i.on{outline:2px solid #fff;outline-offset:1px}#dwk .r i:hover{transform:scale(1.12)}#dwk hr{border:0;border-top:1px solid var(--line);margin:8px 0}#dwk .cc:empty{display:none}"+
"#dwk .hx{display:flex;gap:6px;align-items:center;margin-top:6px}#dwk .hx b{flex:none;width:26px;height:26px;border-radius:6px;box-shadow:0 0 0 1px rgba(128,128,128,.35) inset}#dwk .hx input{flex:1;min-width:0;width:auto;height:26px;padding:0 8px;border:1px solid var(--line);border-radius:7px;background:var(--inp);color:var(--ink);font-size:12px;text-transform:uppercase}"+
"#dwk .hx button{width:auto;height:26px;padding:0 12px;border-radius:7px;background:var(--win);color:#06231b;font-weight:600}";
st.textContent+="#dwk{position:fixed;z-index:1300;max-width:270px}.dwcb{width:34px;height:30px;display:grid;place-items:center;padding:0;border:1px solid var(--line);border-radius:8px;background:var(--inp);cursor:pointer}.dwcb i{width:18px;height:18px;border-radius:5px;display:block;box-shadow:0 0 0 1px rgba(255,255,255,.3) inset}"+
".dr{display:flex;align-items:center;gap:8px;margin:9px 0;flex-wrap:wrap}.dr .l{flex:0 0 120px;color:var(--mut);font-size:13px}.dr .h{width:92px;color:var(--mut);font-size:12px}.mdl .dr input[type=number]{width:96px;height:34px;padding:0 8px;box-sizing:border-box}.mdl .dr select{width:auto;min-width:96px;max-width:100%;height:34px;padding:0 8px 0 10px;box-sizing:border-box;line-height:normal}.dr input[type=range]{width:120px}.dr input[type=checkbox]{width:18px;height:18px;flex:none}.dr span{font-size:13px}"+
".fg{display:grid;grid-template-columns:1fr 1fr;gap:0 14px}.fg .dr{margin:5px 0;flex-wrap:nowrap}.mdl .fg .dr input[type=number]{width:74px}.mdl textarea{width:100%;min-height:84px;box-sizing:border-box}.mdl h4{margin:14px 0 4px}";
document.head.appendChild(st);
const bar=document.createElement("div");bar.id="dwt";bar.setAttribute("role","toolbar");bar.setAttribute("aria-label","Thanh công cụ vẽ");
bar.innerHTML=TT.map(t=>t?`<button type="button" data-t="${t[0]}" title="${t[1]}" aria-label="${t[1]}"><svg viewBox="0 0 20 20">${dwIC[t[0]]}</svg></button>`:"<hr>").join("");
card.appendChild(bar);
const pp=document.createElement("div");pp.id="dwp";pp.innerHTML="";
card.appendChild(pp);
const key=()=>"tp_dw_"+C.sym;
let H=[],hx=0,ht=0,clip=null,kc=false,ks=false,keep=false,tl=1,mpv=null,lx=null,ly=null,claim=false,tch=false,pendEdit=null;window.addEventListener("keydown",e=>{kc=e.ctrlKey||e.metaKey;ks=e.shiftKey;upd()});window.addEventListener("keyup",e=>{kc=e.ctrlKey||e.metaKey;ks=e.shiftKey;upd()});window.addEventListener("blur",()=>{kc=ks=false;upd()});window.addEventListener("mousemove",e=>{const[x,y]=rel(e);lx=x;ly=y;kc=e.ctrlKey||e.metaKey;ks=e.shiftKey;if(mpv||xs2||drag||tool!=="cur")upd()});const rp=(k,v)=>k[0]==="_"?undefined:v;
const put=s=>{try{localStorage.setItem(key(),s)}catch(e){}};
const save=()=>{const s=JSON.stringify(D,rp);put(s);if(s===H[hx])return;const t=Date.now();if(document.querySelector(".mdl")&&t-ht<800&&hx>0)H[hx]=s;else{H=H.slice(0,hx+1);H.push(s);hx++;if(H.length>100){H.shift();hx--}}ht=t};
const hgo=i=>{if(i<0||i>=H.length)return;hx=i;D=JSON.parse(H[hx]);sel=dwCur=null;put(H[hx]);ui();dirty=true};
const undo=()=>hgo(hx-1),redo=()=>hgo(hx+1);
const loadD=()=>{dsym=C.sym;try{D=JSON.parse(localStorage.getItem(key()))||[]}catch(e){D=[]}H=[JSON.stringify(D,rp)];hx=0;sel=dwCur=null;dirty=true;ui()};
function ui(){bar.querySelectorAll("[data-t]").forEach(b=>{const t=b.dataset.t;b.classList.toggle("on",t==="mag"?mag:t==="eye"?hid:t===tool);b.classList.toggle("keep",keep&&t===tool)});
  const c=$("chart");c.classList.toggle("dwa",tool!=="cur"&&!hid);c.classList.toggle("dwn",!!sel&&!sel.lk&&!hid);
  pp.style.display=sel&&!hid?"flex":"none";if(sel)panel()}
/* ---- toạ độ: thời gian (server) <-> chỉ số nến logic ---- */
const n=()=>agg.length,gs=i=>!n()?0:i<0?agg[0].st+i*C.tf:i>=n()?agg[n()-1].st+(i-n()+1)*C.tf:agg[i].st;
const l2s=l=>{const i=Math.floor(l);return gs(i)+(gs(i+1)-gs(i))*(l-i)};
function s2l(s){const N=n();if(!N)return 0;if(s>=agg[N-1].st)return N-1+(s-agg[N-1].st)/C.tf;if(s<=agg[0].st)return(s-agg[0].st)/C.tf;
  let a=0,b=N-1;while(b-a>1){const m=(a+b)>>1;agg[m].st<=s?a=m:b=m}return a+(s-agg[a].st)/(agg[b].st-agg[a].st)}
const X=p=>ts.logicalToCoordinate(s2l(p.t)),Y=p=>cs.priceToCoordinate(p.p);
function pt(x,y){let l=ts.coordinateToLogical(x),p=cs.coordinateToPrice(y);if(l==null||p==null)return null;
  if(mag||kc){l=Math.round(l);const b=agg[l];if(b){let bd=kc?1e9:60;[b.open,b.high,b.low,b.close].forEach(v=>{const d=Math.abs(cs.priceToCoordinate(v)-y);if(d<bd){bd=d;p=v}})}}
  return{t:l2s(l),p}}
function upd(){if(lx==null)return;const[w,h]=plot();mpv=(tool!=="cur"||drag)&&(mag||kc||(tch&&placing()))&&!hid&&lx>=0&&ly>=0&&lx<=w&&ly<=h?pt(lx,ly):null;dirty=true;xh(lx,ly)}
let xs2=false;const hasX=typeof chart.setCrosshairPosition==="function";
function xh(x,y){try{if(hasX){let p=null,b=null;if(mpv){b=agg[Math.round(s2l(mpv.t))];p=mpv.p}else if(drag){const l=ts.coordinateToLogical(x);p=cs.coordinateToPrice(y);b=l==null?null:agg[Math.round(l)]}
  if(b&&p!=null){chart.setCrosshairPosition(p,b.time,cs);xs2=true;return}}if(xs2){chart.clearCrosshairPosition();xs2=false}}catch(e){}}
const cp=(x,y,d,i)=>{if(!ks||!d||!d.pts||i>1||d.pts.length<2||!["trend","chan","fib","rect","ell"].includes(d.k))return pt(x,y);
  const o=d.pts[1-i],ox=X(o),oy=Y(o);if(ox==null||oy==null)return pt(x,y);const dx=x-ox,dy=y-oy;let a=null,x2,y2;
  if(d.k==="rect"||d.k==="ell"){const m=Math.max(Math.abs(dx),Math.abs(dy));x2=ox+(dx<0?-m:m);y2=oy+(dy<0?-m:m)}
  else{const r=Math.hypot(dx,dy);a=Math.round(Math.atan2(dy,dx)/(Math.PI/4))*Math.PI/4;x2=ox+r*Math.cos(a);y2=oy+r*Math.sin(a)}
  const q=pt(x2,y2);if(!q)return q;if(a!=null){if(Math.abs(Math.sin(a))<1e-6)q.p=o.p;else if(Math.abs(Math.cos(a))<1e-6)q.t=o.t}return q};
const plot=()=>{let w=0,h=28;try{w=chart.priceScale("right").width();h=ts.height()}catch(e){}const r=$("chart").getBoundingClientRect();return[r.width-w,r.height-h]};
/* ---- vẽ ---- */
const seg=(a,b)=>{ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke()};
function geo(d){const P=d.pts.map(p=>[X(p),Y(p)]);return P.some(q=>q[0]==null||q[1]==null||!isFinite(q[0]+q[1]))?null:P}
const FIBD=[[1,0,"#98a2d8"],[1,.236,"#ff5c8a"],[1,.382,"#ffb02e"],[1,.5,"#3df5c0"],[1,.618,"#35b6ff"],[1,.786,"#8b7cff"],[1,1,"#98a2d8"],[0,1.618,"#2962ff"],[0,2.618,"#f23645"],[0,3.618,"#9c27b0"],[0,4.236,"#e91e63"],[0,1.272,"#8d6e1f"],[0,1.414,"#8b3a3a"],[0,2.272,"#8d6e1f"]];
const font=(fs,b,i)=>(i?"italic ":"")+(b?"700 ":"600 ")+fs+"px 'Space Grotesk',sans-serif";
const vis=d=>!d.vis||d.vis.includes(C.tf);
function sq(p){ctx.setLineDash([]);ctx.fillStyle="#fff";ctx.strokeStyle="#2962ff";ctx.lineWidth=2;const z=tl>1?8:5;ctx.fillRect(p[0]-z,p[1]-z,z*2,z*2);ctx.strokeRect(p[0]-z,p[1]-z,z*2,z*2)}
/* trendline: khi chữ nằm giữa đường (va="m"), cắt một khoảng trống trên đường đúng bằng vùng chữ để chữ không bị đè */
function tline(d,lo,hi,mid,L1,R1){
  if(!d.x||(d.va||"t")!=="m"){seg(L1,R1);return}
  const fs=d.fs||14,ha=d.ha||"r",A=ha==="l"?lo:ha==="c"?mid:hi,ang=hi[0]===lo[0]?-Math.PI/2:Math.atan2(hi[1]-lo[1],hi[0]-lo[0]);
  ctx.save();ctx.font=font(fs,d.b,d.i);const w=ctx.measureText(d.x).width;ctx.restore();
  const pad=6,s0=(ha==="l"?0:ha==="c"?-w/2:-w)-pad,s1=s0+w+2*pad,h=fs*.75+2,ux=Math.cos(ang),uy=Math.sin(ang),nx=-uy,ny=ux;
  if(Math.hypot(R1[0]-L1[0],R1[1]-L1[1])<w+2*pad+16){seg(L1,R1);return}
  const q=[[s0,-h],[s1,-h],[s1,h],[s0,h]].map(([u,t])=>[A[0]+ux*u+nx*t,A[1]+uy*u+ny*t]);
  ctx.save();ctx.beginPath();ctx.rect(-1e4,-1e4,2e4,2e4);ctx.moveTo(q[0][0],q[0][1]);q.slice(1).forEach(p=>ctx.lineTo(p[0],p[1]));ctx.closePath();ctx.clip("evenodd");seg(L1,R1);ctx.restore()}
const pd=()=>PDIG();
const cdy=(d,a)=>cs.priceToCoordinate(d.pts[0].p+(d.off||0))-a[1];
function boxTxt(d,P){const fs=d.fs||14,ha=d.ha||"c",va=d.va||"m",xs=P.map(p=>p[0]),ys=P.map(p=>p[1]),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
  ctx.save();ctx.setLineDash([]);ctx.font=font(fs,d.b,d.i);ctx.fillStyle=d.tc||col(d);ctx.textAlign=ha==="l"?"left":ha==="r"?"right":"center";ctx.textBaseline=va==="t"?"top":va==="b"?"bottom":"middle";
  ctx.fillText(d.x,ha==="l"?x0+8:ha==="r"?x1-8:(x0+x1)/2,va==="t"?y0+6:va==="b"?y1-6:(y0+y1)/2);ctx.restore()}
function arrow(p,q,c){const a=Math.atan2(p[1]-q[1],p[0]-q[0]);ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(p[0],p[1]);ctx.lineTo(p[0]-11*Math.cos(a-.4),p[1]-11*Math.sin(a-.4));ctx.lineTo(p[0]-11*Math.cos(a+.4),p[1]-11*Math.sin(a+.4));ctx.fill()}
function pill(t,cx,cy,bg){ctx.setLineDash([]);ctx.font=font(12,1);const w=ctx.measureText(t).width+16,x=Math.max(2,Math.min(cx-w/2,plot()[0]-w-2));ctx.fillStyle=bg;ctx.beginPath();ctx.roundRect(x,cy-11,w,22,6);ctx.fill();ctx.fillStyle="#fff";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(t,x+w/2,cy+1)}
function posI(d){const e=d.pts[0].p,tp=d.pts[1].p,sl=d.pts[2].p,last=n()?agg[n()-1].close:e,risk=Math.abs(e-sl)||1e-9,qty=d.qt>0?d.qt:+((d.ac||1000)*(d.rk==null?1:d.rk)/100/risk).toFixed(2),dec=PDIG();
  return{e,qty,pnl:qty*(last-e)*(d.k==="long"?1:-1),rr:Math.abs(tp-e)/risk,t:Math.abs(tp-e),s:Math.abs(e-sl),tk:Math.pow(10,-dec)}}
