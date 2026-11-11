/* ===== Orderflow: DOM / MBO (indicator "dom") =====
   Dữ liệu: cTrader Open API có kênh DEPTH (SubscribeDepthQuotes 2156 -> DepthEvent 2155). Mỗi báo giá trong sổ lệnh có một ID riêng + size, sự kiện chỉ gửi phần
   THÊM/ĐỔI (newQuotes) và phần XOÁ (deletedQuotes). Vì có ID từng lệnh nên giữ được cấu trúc "market by order" (MBO): biết mỗi mức giá gồm những lệnh nào, lệnh nào
   mới đặt, lệnh nào vừa bị rút/đổi. Lưu ý: với forex/CFD đây là thanh khoản tổng hợp do broker/nhà cung cấp báo, không phải sổ lệnh sàn tập trung như CME.
   Size trong giao thức tính theo 1/100 đơn vị: lot = size / lotSize, đơn vị (oz, EUR...) = size / 100.
   Hiển thị:
   1) Bảng DOM bên phải chart (Bid | Giá | Ask | VP), canvas riêng, cuộn bằng bánh xe, nhấp đúp = căn giữa lại.
   2) Histogram thanh khoản ở mép phải vùng vẽ, thẳng hàng với trục giá, tách từng lệnh (MBO), tô nổi các mức "thanh khoản mạnh" (vượt trung bình + k·độ lệch chuẩn)
      và kẻ đường ngang kèm nhãn từ mức đó sang trái, giống ảnh mẫu "STRONG LIQUIDITY". */
const DOM={sub:0,epoch:-1,S:{q:new Map(),ch:[],seen:false},v:0,dirty:false,syncAt:0,paintAt:0,retry:0,busy:false,err:"",off:0,msgAt:0,lvK:"",lv:null,vpK:"",vp:null,thr:Infinity,H:[],hStep:0,hAt:0,hc:null,hk:""};
const domOn=()=>ACT.find(x=>x.key==="dom"&&isOn(x));
const domVpOn=()=>{const a=domOn();return a&&a.p.vp?a:null};   // fpSync dùng: cột VP cần tick

/* ===== phần thuần (có test ở tests/dom.test.js) ===== */
const domNice=v=>{if(!(v>0))return 1;const e=Math.pow(10,Math.floor(Math.log10(v))),m=v/e;return(m<=1?1:m<=2?2:m<=5?5:10)*e};
// áp 1 DepthEvent vào sổ lệnh S. Sự kiện đầu tiên sau khi đăng ký là ảnh chụp sổ: không tính là "thêm", tuổi lệnh chưa biết (t0=0).
function domApply(S,p,now){
  const Q=S.q,first=!S.seen;S.seen=true;
  const px=o=>o.bid>0?o.bid:o.ask;
  const rec=(o,d)=>{if(first||!d)return;S.ch.push({t:now,p:px(o),s:o.bid>0?1:-1,d})};
  for(const k of p.deletedQuotes||[]){const key=String(k),o=Q.get(key);if(o){Q.delete(key);rec(o,-o.size)}}
  for(const x of p.newQuotes||[]){
    const key=String(x.id),size=+x.size||0,bid=+x.bid||0,ask=+x.ask||0,o=Q.get(key);
    if(!(size>0)||!(bid>0||ask>0)){if(o){Q.delete(key);rec(o,-o.size)}continue}
    if(o){
      if(px(o)===(bid>0?bid:ask)&&(o.bid>0)===(bid>0)){const d=size-o.size;o.size=size;rec(o,d)}
      else{rec(o,-o.size);o.size=size;o.bid=bid;o.ask=ask;o.t0=now;rec(o,size)}      // đổi giá = rút lệnh cũ + đặt lệnh mới
    }else{const n={size,bid,ask,t0:first?0:now};Q.set(key,n);rec(n,size)}
  }
  const lim=now-6000;let i=0;while(i<S.ch.length&&S.ch[i].t<lim)i++;if(i)S.ch.splice(0,i);
  if(S.ch.length>800)S.ch.splice(0,S.ch.length-800);
}
// gộp các lệnh thành mức giá (step = số nguyên 1/100000, u = chia size ra lot/đơn vị). Mỗi mức giữ danh sách từng lệnh (MBO), lớn trước.
function domBuild(Q,step,u,now){
  const M=new Map();let nb=0,na=0,sb=0,sa=0;
  for(const o of Q.values()){
    const bid=o.bid>0,pr=bid?o.bid:o.ask,b=Math.floor(pr/step)*step,s=o.size/u;
    let L=M.get(b);if(!L){L={p:b,bid:0,ask:0,bo:[],ao:[],age:0};M.set(b,L)}
    if(bid){L.bid+=s;L.bo.push(s);nb++;sb+=s}else{L.ask+=s;L.ao.push(s);na++;sa+=s}
    if(o.t0&&now){const g=now-o.t0;if(g>L.age)L.age=g}
  }
  const arr=[...M.values()].sort((a,b)=>a.p-b.p);
  for(const L of arr){L.bo.sort((a,b)=>b-a);L.ao.sort((a,b)=>b-a)}
  return{map:M,arr,nb,na,sb,sa};
}
// ngưỡng "thanh khoản mạnh" = trung bình + k·độ lệch chuẩn của size mọi mức (cả hai phía), không thấp hơn min. Quá ít mức hoặc đều tăm tắp thì không có mức mạnh.
function domThr(arr,k,min){
  const v=[];for(const L of arr){if(L.bid>0)v.push(L.bid);if(L.ask>0)v.push(L.ask)}
  if(v.length<6)return Infinity;
  let m=0;for(const x of v)m+=x;m/=v.length;let s=0;for(const x of v)s+=(x-m)*(x-m);s=Math.sqrt(s/v.length);
  if(!(s>0))return Infinity;
  return Math.max(m+k*s,min||0);
}
// tổng thay đổi (thêm +, rút -) theo mức giá trong `ms` mili-giây gần nhất, để nháy ô trên bảng
function domFlow(S,step,u,now,ms){
  const M=new Map();
  for(const c of S.ch){if(now-c.t>ms)continue;const b=Math.floor(c.p/step)*step;M.set(b,(M.get(b)||0)+c.d/u)}
  return M;
}

// ảnh chụp sổ lệnh cho heatmap: [[giá hàng, size, phía(1 bid / -1 ask)],...] trong mid ± range hàng
function domSnap(Q,step,u,mid,range){
  const M=new Map(),c=Math.floor(mid/step)*step,lo=c-range*step,hi=c+range*step;
  for(const o of Q.values()){
    const bid=o.bid>0,pr=bid?o.bid:o.ask,b=Math.floor(pr/step)*step;if(b<lo||b>hi)continue;
    const k=b*2+(bid?1:0);let e=M.get(k);if(!e){e=[b,0,bid?1:-1];M.set(k,e)}e[1]+=o.size/u;
  }
  return[...M.values()];
}

/* ===== kết nối: đăng ký / huỷ đăng ký kênh depth ===== */
function domFeed(p){                       // ctMsg gọi khi có DepthEvent (2155)
  if(!CT.sym||+p.symbolId!==CT.sym.id||DOM.sub!==CT.sym.id)return;
  domApply(DOM.S,p,Date.now());DOM.dirty=true;DOM.msgAt=Date.now();DOM.err="";
}
function domReset(){DOM.H=[];DOM.hc=null;DOM.hk="";DOM.S={q:new Map(),ch:[],seen:false};DOM.lvK="";DOM.lv=null;DOM.vpK="";DOM.vp=null;DOM.v++}
async function domUnsub(){
  const id=DOM.sub,ep=DOM.epoch;DOM.sub=0;domReset();
  if(id&&ep===CT.epoch&&CT.ready)try{await ctSend(2158,{ctidTraderAccountId:CT.acc,symbolId:[id]},8000)}catch{}
}
async function domSync(){
  const a=domOn();
  if(!a||!ctReady()){if(DOM.sub&&!a)domUnsub();return}
  const id=CT.sym.id;
  if(DOM.sub===id&&DOM.epoch===CT.epoch)return;
  if(DOM.busy||Date.now()<DOM.retry)return;
  DOM.busy=true;const g=CT.gen;
  try{
    if(DOM.sub&&DOM.epoch===CT.epoch&&DOM.sub!==id)try{await ctSend(2158,{ctidTraderAccountId:CT.acc,symbolId:[DOM.sub]},8000)}catch{}
    domReset();DOM.sub=id;DOM.epoch=CT.epoch;
    await ctSend(2156,{ctidTraderAccountId:CT.acc,symbolId:[id]},15000).catch(e=>{if(!/ALREADY/i.test(e.message))throw e});
  }catch(e){
    if(g===CT.gen){DOM.sub=0;DOM.err=/NOT_SUPPORTED|NO_DEPTH|INVALID|SYMBOL/i.test(e.message)?"Broker không cung cấp depth cho mã này ("+e.message+")":"Không đăng ký được depth: "+why(e);DOM.retry=Date.now()+8000;DOM.v++}
  }finally{DOM.busy=false}
}

/* ===== vẽ ===== */
const domUnit=Q=>Q.unit==="lot"?(CT.sym&&CT.sym.lotSize>0?CT.sym.lotSize:100):Q.unit==="unit"?100:1;
const domUnitName=Q=>Q.unit==="lot"?"lot":Q.unit==="unit"?"đv":"raw";
function domStep(Q){
  const tick=Math.pow(10,-PDIG());let s=+Q.step;
  if(!(s>0)){const sp=CT.ask>0&&CT.bid>0?(CT.ask-CT.bid)/1e5:0;s=domNice(Math.max(tick,sp/2))}
  return Math.max(1,Math.round(Math.max(s,tick)*1e5));
}
const domFm=v=>v>=1e4?(v/1e3).toFixed(1)+"K":v>=100?String(Math.round(v)):v>=10?v.toFixed(1):v>=1?v.toFixed(2):v.toFixed(3);
const domRgba=(h,a)=>"rgba("+fpRgb(h)+","+a+")";
const domMono="Consolas,ui-monospace,Menlo,monospace";
function domData(Q){      // mức giá + ngưỡng mạnh, lưu theo phiên bản dữ liệu để không tính lại mỗi khung hình
  const step=domStep(Q),u=domUnit(Q),key=[DOM.v,step,u,Q.sk,Q.smin,CT.sym&&CT.sym.id].join("|");
  if(DOM.lvK!==key){DOM.lv=domBuild(DOM.S.q,step,u,Date.now());DOM.thr=Q.strong?domThr(DOM.lv.arr,+Q.sk||2,+Q.smin||0):Infinity;DOM.lvK=key}
  return{step,u,lv:DOM.lv,thr:DOM.thr};
}
// volume đã khớp theo giá (từ tick footprint) trong vpm phút gần nhất, gộp theo cùng step
function domVP(step,Q){
  const live=m1.length?m1[m1.length-1][0]:0;if(!live||!FPM.size)return null;
  const key=[step,Q.vpm,live,FPV,FPH].join("|");if(DOM.vpK===key)return DOM.vp;
  const M=new Map();let mx=0,poc=0;
  for(let t=live-60*Math.max(1,Math.round(+Q.vpm||240));t<=live;t+=60){const rows=FPM.get(t);if(!rows)continue;
    for(const [p,b,s] of rows){const k=Math.floor(Math.round(p*1e5)/step)*step,v=(M.get(k)||0)+b+s;M.set(k,v);if(v>mx){mx=v;poc=k}}}
  DOM.vpK=key;return DOM.vp={M,mx,poc};
}
const domMount=()=>{
  if(DOMUI.el)return;
  const el=document.createElement("div");el.id="dom";el.innerHTML='<div class="dh"><b></b><span></span></div><canvas></canvas>';
  $("chartCard").appendChild(el);DOMUI.el=el;DOMUI.cv=el.querySelector("canvas");DOMUI.t=el.querySelector("b");DOMUI.s=el.querySelector("span");
  el.addEventListener("wheel",e=>{e.preventDefault();DOM.off+=e.deltaY>0?-3:3;DOM.paintAt=0;DOM.dirty=true},{passive:false});
  el.addEventListener("dblclick",()=>{DOM.off=0;DOM.paintAt=0;DOM.dirty=true});
};
const DOMUI={el:null,cv:null,t:null,s:null,w:0};
function domLayout(a){
  const card=$("chartCard"),show=!!(a&&a.p.panel);
  if(show){domMount();const w=Math.max(150,Math.min(Math.round(+a.p.pw||250),Math.round(card.clientWidth*.45)));if(w!==DOMUI.w){DOMUI.w=w;card.style.setProperty("--domw",w+"px")}}
  if(card.classList.contains("hasdom")!==show)card.classList.toggle("hasdom",show);
}
function domPaint(a){
  if(!DOMUI.cv||!a.p.panel)return;
  const Q=Object.assign(pdef(IND.dom),a.p),cv=DOMUI.cv,r=cv.getBoundingClientRect(),dp=devicePixelRatio||1;if(!r.width||!r.height)return;
  if(cv.width!==Math.round(r.width*dp)||cv.height!==Math.round(r.height*dp)){cv.width=Math.round(r.width*dp);cv.height=Math.round(r.height*dp)}
  const g=cv.getContext("2d");g.setTransform(dp,0,0,dp,0,0);g.clearRect(0,0,r.width,r.height);
  const W=r.width,H=r.height,tx=COL().tx,cB=cres(a,0),cA=cres(a,1),cS=cres(a,2),cP=cres(a,3),cV=cres(a,4);
  const {step,u,lv,thr}=domData(Q),sym=CT.sym?CT.sym.name:C.sym,d=PDIG();
  DOMUI.t.textContent=sym+" · "+(step/1e5).toFixed(Math.max(d,2))+" · "+domUnitName(Q);
  const tot=lv.sb+lv.sa,imb=tot>0?Math.round((lv.sb-lv.sa)/tot*100):0;
  DOMUI.s.textContent=lv.nb+"B/"+lv.na+"A lệnh · Σ "+domFm(lv.sb)+" / "+domFm(lv.sa)+" · "+(imb>0?"+":"")+imb+"%";
  if(!lv.arr.length){
    g.fillStyle=tx;g.globalAlpha=.8;g.font="12px system-ui,sans-serif";g.textAlign="center";
    const msg=DOM.err||(DOM.sub?"Đang chờ dữ liệu depth từ cTrader…":"Chưa đăng ký depth");
    const words=msg.match(/.{1,26}(\s|$)/g)||[msg];words.forEach((w,i)=>g.fillText(w.trim(),W/2,H/2-8+i*16));g.globalAlpha=1;return;
  }
  const rh=Math.max(12,Math.round(+Q.rh||18)),N=Math.max(5,Math.floor(H/rh)),mid=CT.bid>0&&CT.ask>0?(CT.bid+CT.ask)/2:(lv.arr[0].p+lv.arr[lv.arr.length-1].p)/2;
  const bidB=Math.floor((CT.bid||mid)/step)*step,askB=Math.floor((CT.ask||mid)/step)*step,top=Math.floor(mid/step)*step+(Math.floor(N/2)+DOM.off)*step;
  const vp=Q.vp?domVP(step,Q):null,fl=Q.flow?domFlow(DOM.S,step,u,Date.now(),1200):null,now=Date.now();
  const wB=Q.vp?.27:.31,wP=Q.vp?.3:.34,wA=Q.vp?.27:.35,xB=0,xP=W*wB,xA=xP+W*wP,xV=xA+W*wA,cw=W*wB,aw=W*wA,vw=W-xV;
  let mxs=0;for(let i=0;i<N;i++){const L=lv.map.get(top-i*step);if(L)mxs=Math.max(mxs,L.bid,L.ask)}
  g.font=Math.min(12,rh-5)+"px "+domMono;g.textBaseline="middle";
  for(let i=0;i<N;i++){
    const p=top-i*step,y=i*rh,L=lv.map.get(p),cy=y+rh/2;
    g.fillStyle=domRgba(tx,i%2?.03:.0);if(i%2)g.fillRect(0,y,W,rh);
    if(p===bidB){g.fillStyle=domRgba(cB,.18);g.fillRect(xP,y,W*wP,rh)}
    if(p===askB){g.fillStyle=domRgba(cA,.18);g.fillRect(xP,y,W*wP,rh)}
    if(p===bidB&&p===askB){g.fillStyle=domRgba(cP,.2);g.fillRect(xP,y,W*wP,rh)}
    if(vp&&vp.M.has(p)){const v=vp.M.get(p),w=Math.max(1,v/vp.mx*(vw-3));g.fillStyle=domRgba(cV,p===vp.poc?.85:.5);g.fillRect(xV+1,y+1,w,rh-2)}
    if(L){
      const f=fl&&fl.get(p);
      if(L.bid>0){const w=L.bid/mxs*(cw-2);g.fillStyle=domRgba(cB,.38);g.fillRect(xB+cw-w,y+1,w,rh-2);
        if(f){g.fillStyle=domRgba(f>0?cB:cA,Math.min(.55,.2+Math.abs(f)/Math.max(L.bid,1e-9)*.3));g.fillRect(xB,y+1,cw,rh-2)}
        g.fillStyle=tx;g.textAlign="right";g.fillText(domFm(L.bid),xB+cw-4,cy);
        if(Q.ord&&L.bo.length>1){g.save();g.globalAlpha=.55;g.font=Math.min(9,rh-7)+"px "+domMono;g.textAlign="left";g.fillText("×"+L.bo.length,xB+3,cy);g.restore()}
        if(L.bid>=thr){g.strokeStyle=cS;g.lineWidth=1.5;g.strokeRect(xB+1,y+1,cw-2,rh-2)}}
      if(L.ask>0){const w=L.ask/mxs*(aw-2);g.fillStyle=domRgba(cA,.38);g.fillRect(xA,y+1,w,rh-2);
        if(f){g.fillStyle=domRgba(f>0?cB:cA,Math.min(.55,.2+Math.abs(f)/Math.max(L.ask,1e-9)*.3));g.fillRect(xA,y+1,aw,rh-2)}
        g.fillStyle=tx;g.textAlign="left";g.fillText(domFm(L.ask),xA+4,cy);
        if(Q.ord&&L.ao.length>1){g.save();g.globalAlpha=.55;g.font=Math.min(9,rh-7)+"px "+domMono;g.textAlign="right";g.fillText("×"+L.ao.length,xA+aw-3,cy);g.restore()}
        if(L.ask>=thr){g.strokeStyle=cS;g.lineWidth=1.5;g.strokeRect(xA+1,y+1,aw-2,rh-2)}}
    }
    g.fillStyle=p===bidB||p===askB?ink():tx;g.textAlign="center";g.fillText((p/1e5).toFixed(Math.max(d,(String(step/1e5).split(".")[1]||"").length)),xP+W*wP/2,cy);
  }
  g.strokeStyle=domRgba(tx,.15);g.lineWidth=1;g.beginPath();[xP,xA,xV].forEach(x=>{g.moveTo(x+.5,0);g.lineTo(x+.5,H)});g.stroke();
  if(DOM.off){g.fillStyle=tx;g.globalAlpha=.7;g.font="10px system-ui,sans-serif";g.textAlign="right";g.fillText("nhấp đúp: căn giữa",W-4,H-8);g.globalAlpha=1}
}
// histogram thanh khoản ở mép phải vùng vẽ (gọi từ render() của drawings-interact.js, ctx đã clip theo vùng vẽ)
function domHeat(a,Q,w,h){
  const lr=ts.getVisibleLogicalRange();if(!lr||!agg.length||!DOM.H.length)return;
  const i0=Math.max(0,Math.floor(lr.from)-1),xa=ts.logicalToCoordinate(i0),xb=ts.logicalToCoordinate(i0+1),bs=xa!=null&&xb!=null?xb-xa:0;if(!bs)return;
  const dp=devicePixelRatio||1,key=[DOM.H.length,DOM.hStep,lr.from.toFixed(2),lr.to.toFixed(2),w,h,Math.round(cs.priceToCoordinate(0)||0),Math.round(cs.priceToCoordinate(1000)||0),Q.hmo,a.c.join()].join("|");
  if(DOM.hk!==key||!DOM.hc){
    const cv=DOM.hc||(DOM.hc=document.createElement("canvas"));cv.width=Math.max(1,Math.round(w*dp));cv.height=Math.max(1,Math.round(h*dp));
    const g=cv.getContext("2d");g.setTransform(dp,0,0,dp,0,0);g.clearRect(0,0,w,h);
    const tf=C.tf,st=[],X=t=>{                 // giờ server (giây) -> toạ độ x, nội suy trong nến chứa thời điểm đó
      let lo=0,hi=agg.length-1;while(lo<hi){const m=(lo+hi+1)>>1;if(agg[m].st<=t)lo=m;else hi=m-1}
      const c=agg[lo];if(t<c.st)return null;const x=ts.logicalToCoordinate(lo);return x==null?null:x-bs/2+(t-c.st)/tf*bs};
    const xs=[];let lx=-9;
    for(const s of DOM.H){const x=X(s.t);if(x==null||x<-5||x>w+5)continue;if(x-lx<1.2&&xs.length){xs[xs.length-1]=[x,s]}else xs.push([x,s]);lx=x}
    let n=0,m=0,q=0;for(const [,s] of xs)for(const e of s.e){n++;m+=e[1];q+=e[1]*e[1]}
    if(n){m/=n;const ref=Math.max(1e-9,m+2*Math.sqrt(Math.max(0,q/n-m*m))),cB=cres(a,0),cA=cres(a,1),op=Math.max(.05,Math.min(1,+Q.hmo||.5)),Y=new Map(),step=DOM.hStep;
      const colW=Math.max(1,bs/tf);   // px mỗi giây
      for(let k=0;k<xs.length;k++){
        const [x,s]=xs[k],nx=k+1<xs.length?xs[k+1][0]:x+colW,ww=Math.max(1,Math.min(nx-x,colW*3));
        for(const e of s.e){let y=Y.get(e[0]);if(!y){const y1=cs.priceToCoordinate((e[0]+step)/1e5),y0=cs.priceToCoordinate(e[0]/1e5);y=(y0==null||y1==null)?[0,0]:[Math.min(y0,y1),Math.max(1,Math.abs(y0-y1))];Y.set(e[0],y)}
          if(!y[1]||y[0]>h||y[0]+y[1]<0)continue;
          g.fillStyle=domRgba(e[2]>0?cB:cA,Math.min(1,Math.pow(e[1]/ref,.7))*op);g.fillRect(x,y[0],ww,y[1])}
      }}
    DOM.hk=key;
  }
  ctx.drawImage(DOM.hc,0,0,w,h);
}
function drawDOM(w,h){
  const a=domOn();if(!a)return;
  const Q=Object.assign(pdef(IND.dom),a.p);
  if(Q.hm)domHeat(a,Q,w,h);
  if(!DOM.S.q.size||!Q.edge)return;
  const {step,u,lv,thr}=domData(Q),cB=cres(a,0),cA=cres(a,1),cS=cres(a,2),maxW=Math.max(40,w*Math.max(5,Math.min(60,+Q.ew||24))/100);
  const rows=[];let mx=0;
  for(const L of lv.arr){
    const y1=cs.priceToCoordinate((L.p+step)/1e5),y0=cs.priceToCoordinate(L.p/1e5);
    if(y0==null||y1==null||y0<0||y1>h)continue;
    rows.push({L,y:Math.min(y0,y1),hh:Math.max(1,Math.abs(y0-y1))});if(L.bid>mx)mx=L.bid;if(L.ask>mx)mx=L.ask;
  }
  if(!rows.length||!(mx>0))return;
  ctx.save();ctx.font="11px "+domMono;ctx.textBaseline="middle";
  const strong=[];
  for(const R of rows){
    const L=R.L,both=L.bid>0&&L.ask>0,hh=both?R.hh/2:R.hh;
    const side=(arr,tot,col,y)=>{
      const isS=tot>=thr;let x=w;const gap=Q.mbo&&arr.length>1&&hh>=5?1:0,h2=Math.max(1,hh-(hh>=4?1:0));
      if(Q.mbo)for(const s of arr){const len=s/mx*maxW;if(len<.5)continue;ctx.fillStyle=domRgba(col,isS?.85:.5);ctx.fillRect(x-len,y,Math.max(.5,len-gap),h2);x-=len}
      else{const len=tot/mx*maxW;ctx.fillStyle=domRgba(col,isS?.85:.5);ctx.fillRect(w-len,y,len,h2)}
      if(isS){strong.push({y:y+h2/2,v:tot,p:L.p,col});{const len=tot/mx*maxW;ctx.strokeStyle=cS;ctx.lineWidth=1.2;ctx.strokeRect(w-len+.5,y+.5,len-1,Math.max(1,h2-1))}}
    };
    if(L.ask>0)side(L.ao,L.ask,cA,R.y);
    if(L.bid>0)side(L.bo,L.bid,cB,both?R.y+hh:R.y);
  }
  if(Q.strong&&strong.length){
    strong.sort((x,y)=>y.v-x.v);const dg=Math.max(PDIG(),(String(step/1e5).split(".")[1]||"").length),lab=[];
    for(const s of strong.slice(0,8)){
      if(Q.sline){ctx.save();ctx.setLineDash([6,4]);ctx.strokeStyle=domRgba(cS,.5);ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,Math.round(s.y)+.5);ctx.lineTo(w-s.v/mx*maxW,Math.round(s.y)+.5);ctx.stroke();ctx.restore()}
      if(lab.some(y=>Math.abs(y-s.y)<14))continue;lab.push(s.y);
      const t=domFm(s.v)+" "+domUnitName(Q)+" @ "+(s.p/1e5).toFixed(dg),x=w-s.v/mx*maxW-6,tw=ctx.measureText(t).width+10;
      ctx.fillStyle=domRgba("#000000",.55);ctx.fillRect(x-tw,s.y-8,tw,16);ctx.fillStyle=cS;ctx.textAlign="right";ctx.fillText(t,x-5,s.y);
    }
  }
  ctx.restore();
}
// poll() gọi mỗi 250ms
function domTick(){
  const a=domOn(),n=Date.now();
  domLayout(a);
  if(!a){if(DOM.sub)domUnsub();return}
  if(n-DOM.syncAt>1000){DOM.syncAt=n;domSync().catch(()=>{})}
  if(a.p.hm&&DOM.S.q.size&&n-DOM.hAt>=1000){
    DOM.hAt=n;const Q=Object.assign(pdef(IND.dom),a.p),step=domStep(Q);
    if(step!==DOM.hStep){DOM.H=[];DOM.hStep=step;DOM.hk=""}
    const mid=CT.bid>0&&CT.ask>0?(CT.bid+CT.ask)/2:0;
    if(mid){DOM.H.push({t:u2s(Math.floor(n/1000)),e:domSnap(DOM.S.q,step,domUnit(Q),mid,Math.max(10,Math.round(+Q.hmr)||120))});
      const cap=Math.max(60,Math.round((+Q.hmm||30)*60));if(DOM.H.length>cap)DOM.H.splice(0,DOM.H.length-cap)}
  }
  if((DOM.dirty||n-DOM.paintAt>1500)&&n-DOM.paintAt>=100){DOM.dirty=false;DOM.paintAt=n;DOM.v++;try{domPaint(a)}catch(e){chErr("domPaint",e)}}
}
