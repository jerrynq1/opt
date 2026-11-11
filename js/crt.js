/* ===== CRT - Candle Range Theory, HTF + PD Array (indicator "crt") =====
   Port từ Pine Script "CRT - Candle Range Theory (HTF + PD Array)" sang JS thuần cho chart này.
   Gồm: 4 model CRT trên khung HTF (2nd Candle, 3rd Candle, Multiple Candle, Inside Bar), vùng + đường CRT H / mid / L,
   PD Array trong cửa sổ nến sweep (OID, RB, FVG, OB, BB), nến HTF vẽ bên phải chart, bảng thông tin, cảnh báo khi có CRT mới.
   Chỉ dùng nến HTF ĐÃ ĐÓNG để nhận diện (nến HTF đang chạy chỉ dùng để vẽ), nên không repaint.
   Khác bản Pine: nến HTF dựng từ nến M1 (cùng cách chart gom khung giờ); nến HTF bên phải có chế độ "gắn mép phải" để luôn nhìn thấy
   dù chart không chừa khoảng trống bên phải; lịch sử tín hiệu bám theo dữ liệu M1 hiện có.
   Phần trên (đến mốc "vẽ") là hàm thuần, được kiểm thử bằng tests/crt.test.js; phần dưới vẽ lên canvas của chart. */

const CRT_MN=["","2nd Candle","3rd Candle","Multiple Candle","Inside Bar"];
const CRT_TFN={1800:"30m",3600:"1H",7200:"2H",14400:"4H",21600:"6H",28800:"8H",43200:"12H",86400:"1D",604800:"1W"};
const crtTfTxt=s=>CRT_TFN[s]||(s%86400===0?s/86400+"D":s%3600===0?s/3600+"H":Math.round(s/60)+"m");

/* ---- nến HTF dựng từ nến M1 (A = [[t,o,h,l,c,v],...]); bk(t,tf) = hàm gom khung giờ của chart ---- */
function crtHtfBars(A,tf,bk){
  const out=[];let cur=null;
  for(let i=0;i<A.length;i++){
    const x=A[i],k=bk(x[0],tf);
    if(!cur||cur.st!==k){cur={st:k,o:x[1],h:x[2],l:x[3],c:x[4]};out.push(cur)}
    else{if(x[2]>cur.h)cur.h=x[2];if(x[3]<cur.l)cur.l=x[3];cur.c=x[4]}
  }
  return out}

/* ---- nhận diện CRT: nến s là nến sweep (đã đóng), nến range nằm trước nó k-1 nến (k = 2..maxK) ----
   en = [_, m1, m2, m3, m4] bật/tắt từng model. Trả về null nếu không có CRT. */
function crtDetect(H,s,maxK,en){
  const sw=H[s];if(!sw)return null;
  for(let k=2;k<=maxK;k++){
    const r=s-(k-1);if(r<0)break;
    const h0=H[r].h,l0=H[r].l;let ok=true,ins=true;
    if(k>2)for(let j=2;j<=k-1;j++){
      const b=H[s-(j-1)];
      if(b.c>h0||b.c<l0){ok=false;break}              // nến giữa đóng cửa ngoài range: không còn là CRT với nến này
      if(b.h>h0||b.l<l0)ins=false}                    // râu nến giữa vượt range: không phải Inside Bar
    if(!ok)continue;
    const bear=sw.h>h0&&sw.c<h0&&sw.c>=l0,bull=sw.l<l0&&sw.c>l0&&sw.c<=h0;
    if(bear===bull)continue;
    const m=k===2?1:k===3?2:(ins?4:3);
    if(!en[m])continue;
    return{s,r,k,dir:bear?-1:1,mdl:m,rH:h0,rL:l0,rngSt:H[r].st,swpSt:sw.st,so:sw.o,sh:sw.h,sl:sw.l,sc:sw.c}}
  return null}

/* ---- các CRT gần nhất (cũ -> mới). onlyLast: chỉ lấy 1; không thì tối đa maxn ---- */
function crtSignals(H,Q){
  const out=[],en=[0,!!Q.m1,!!Q.m2,!!Q.m3,!!Q.m4],need=Q.onlyLast?1:Math.max(1,Q.maxn|0);
  for(let s=H.length-2;s>=1&&out.length<need;s--){const r=crtDetect(H,s,Q.maxK,en);if(r)out.push(r)}
  return out.reverse()}

/* ---- cửa sổ nến chart nằm trong nến sweep [t0, t1): trả {i1: nến mới nhất, n: số nến (đã giới hạn maxScan)} hoặc null ---- */
function crtWin(G,t0,t1,maxScan){
  let lo=0,hi=G.length;while(lo<hi){const m=(lo+hi)>>1;G[m].st<t0?lo=m+1:hi=m}
  let e=lo;while(e<G.length&&G[e].st<t1)e++;
  const n=Math.min(e-lo,Math.max(1,maxScan|0));
  return n>=1?{i1:e-1,n}:null}

/* ---- PD Array trong cửa sổ sweep. Giống Pine: chỉ số i = 1 là nến chart mới nhất của cửa sổ, i tăng = lùi về quá khứ ---- */
function crtPD(G,i1,N,sg,Q){
  const dir=sg.dir,B=i=>G[i1-i+1],hi=i=>B(i).high,lo=i=>B(i).low,cl=i=>B(i).close,op=i=>B(i).open;
  let ie=1,ex=dir===-1?hi(1):lo(1);
  for(let i=1;i<=N;i++){
    if(dir===-1&&hi(i)>ex){ex=hi(i);ie=i}
    if(dir===1&&lo(i)<ex){ex=lo(i);ie=i}}
  const Z=[],tags=[];
  if(Q.showOHL){Z.push({t:"OID",st:B(ie).st,price:ex});tags.push("OID")}
  if(Q.showRB){Z.push({t:"RB",st:sg.swpSt,top:dir===-1?sg.sh:Math.min(sg.so,sg.sc),bot:dir===-1?Math.max(sg.so,sg.sc):sg.sl});tags.push("RB")}
  if(Q.showFVG){
    let cnt=0;
    for(let i=1;i<=N-2;i++){
      if(i+2>ie)break;                                  // chỉ lấy FVG nằm trong đợt displacement từ đỉnh/đáy bị quét
      const gap=dir===-1?hi(i)<lo(i+2):lo(i)>hi(i+2);
      if(!gap)continue;
      const zt=dir===-1?lo(i+2):lo(i),zb=dir===-1?hi(i):hi(i+2);
      let filled=false;
      for(let m=1;m<i;m++){if(dir===-1&&hi(m)>zt)filled=true;if(dir===1&&lo(m)<zb)filled=true}
      if(!filled){Z.push({t:"FVG",st:B(i+2).st,top:zt,bot:zb});cnt++;if(cnt>=Q.maxFVG)break}}
    if(cnt>0)tags.push("FVG")}
  if(Q.showOB)for(let j=ie;j<=N;j++){                  // nến ngược chiều đầu tiên tính từ đỉnh/đáy lùi về quá khứ
    if(dir===-1?cl(j)>op(j):cl(j)<op(j)){Z.push({t:"OB",st:B(j).st,top:hi(j),bot:lo(j)});tags.push("OB");break}}
  if(Q.showBB)for(let j=ie;j<=N;j++){                  // nến cùng chiều, sau đó bị đóng cửa xuyên qua => đảo thành Breaker
    if(dir===-1?cl(j)<op(j):cl(j)>op(j)){
      let brk=false;
      for(let m=1;m<j;m++){if(dir===-1&&cl(m)<lo(j))brk=true;if(dir===1&&cl(m)>hi(j))brk=true}
      if(brk){Z.push({t:"BB",st:B(j).st,top:hi(j),bot:lo(j)});tags.push("BB")}
      break}}
  return{ie,ex,exSt:B(ie).st,zones:Z,txt:tags.length?tags.join(" "):"-"}}

/* ---- dựng toàn bộ mô hình: nến HTF, các CRT và PD Array của từng CRT ---- */
function crtBuild(m1A,G,Q,tf,bk){
  const H=crtHtfBars(m1A,tf,bk),sigs=crtSignals(H,Q);
  for(const sg of sigs){const w=crtWin(G,sg.swpSt,sg.swpSt+tf,Q.maxScan);sg.pd=w?crtPD(G,w.i1,w.n,sg,Q):null}
  return{H,sigs,tf}}

/* thời gian server (st) -> vị trí logical trên chart; qua nến cuối thì ngoại suy theo độ dài nến chart */
function crtLog(G,st,tf){
  const n=G.length;if(!n)return 0;
  let lo=0,hi=n;while(lo<hi){const m=(lo+hi)>>1;G[m].st<st?lo=m+1:hi=m}
  if(lo>=n)return n-1+(st-G[n-1].st)/tf;
  if(G[lo].st>st&&lo>0&&G[lo-1].st+tf>st)return lo-1;
  return lo}

/* ===== vẽ ===== */
const CRT_PX=["tr","tl","br","bl"];
const crtOn=()=>ACT.find(x=>x.key==="crt"&&isOn(x));
let CRTM=null,CRTS="",CRTE=null,CRTH="",CRTSK="",CRTSEEN=new Set();
function crtEl(){if(!CRTE){CRTE=document.createElement("div");CRTE.id="crtTbl";$("chart").appendChild(CRTE)}return CRTE}

function crtModel(a,Q,tf){
  const N=agg.length,last=agg[N-1],ml=m1[m1.length-1];
  const sig=[N,agg[0].st,last.high,last.low,last.close,m1.length,ml?ml[4]:0,m1.length?m1[0][0]:0,C.tf,C.sym,JSON.stringify(a.p)].join("|");
  if(CRTM&&CRTS===sig)return CRTM;
  CRTM=crtBuild(m1,agg,Q,tf,bucket);CRTS=sig;return CRTM}

function crtAlert(msg){
  try{status("CRT: "+msg,"ok")}catch{}
  try{const A=new (window.AudioContext||window.webkitAudioContext)(),o=A.createOscillator(),g=A.createGain();o.frequency.value=740;g.gain.value=.05;o.connect(g);g.connect(A.destination);o.start();o.stop(A.currentTime+.15)}catch{}}

function crtTable(a,Q,M,w,h,warn){
  const el=crtEl();
  if(!Q.tbl||(!warn&&!M)){el.style.display="none";return}
  const dg=pd(),sg=M&&M.sigs.length?M.sigs[M.sigs.length-1]:null,tx=cres(a,2);
  const row=(k,v,c)=>`<tr><td style="text-align:left">${k}</td><td${c?` style="color:${c}"`:""}>${v}</td></tr>`;
  let html;
  if(warn)html=`<table>${row("CRT",warn,"#ffb02e")}</table>`;
  else html=`<table>${row("CRT HTF",crtTfTxt(M.tf))}${
    row("Hướng",sg?(sg.dir===1?"BUY (sweep Low)":"SELL (sweep High)"):"-",sg?cres(a,sg.dir===1?0:1):tx)}${
    row("Model",sg?CRT_MN[sg.mdl]:"-")}${
    row("CRT H / L",sg?sg.rH.toFixed(dg)+" / "+sg.rL.toFixed(dg):"-")}${
    row("PD Array",sg&&sg.pd?sg.pd.txt:"-","#ffd24a")}</table>`;
  if(html!==CRTH){el.innerHTML=html;CRTH=html}
  const cw=$("chart").getBoundingClientRect(),st=el.style,p=CRT_PX.includes(Q.tpos)?Q.tpos:"tr";
  st.display="block";st.top=st.bottom=st.left=st.right="auto";
  if(p[0]==="t")st.top="8px";else st.bottom=(cw.height-h+8)+"px";
  if(p[1]==="l")st.left="8px";else st.right=(cw.width-w+8)+"px"}

function drawCRT(w,h){
  const a=crtOn(),el=crtEl();
  if(!a||!agg.length||!m1.length){el.style.display="none";return}
  const Q=Object.assign(pdef(IND.crt),a.p),tf=+Q.htf||14400;
  if(tf<=C.tf){                                       // giống runtime.error của Pine: HTF phải lớn hơn khung chart
    crtTable(a,Q,null,w,h,"HTF phải lớn hơn khung chart");
    ctx.save();ctx.font=font(12,1);ctx.fillStyle="#ffb02e";ctx.textAlign="left";ctx.textBaseline="top";
    ctx.fillText("CRT: khung HTF ("+crtTfTxt(tf)+") phải LỚN HƠN khung chart hiện tại",10,40);ctx.restore();return}
  const M=crtModel(a,Q,tf),G=agg,n=G.length,H=M.H;
  // cảnh báo: CRT mới vừa hình thành (nến sweep là nến HTF đóng gần nhất). Lần đầu mở/đổi mã/đổi HTF chỉ ghi nhận, không báo.
  const sk=C.sym+"|"+tf,keyOf=s=>sk+"|"+s.swpSt;
  if(CRTSK!==sk){CRTSK=sk;CRTSEEN=new Set(M.sigs.map(keyOf))}
  else for(const s of M.sigs){const k=keyOf(s);
    if(!CRTSEEN.has(k)){CRTSEEN.add(k);
      if(Q.alrt&&s.s===H.length-2)crtAlert(s.dir===1?"CRT Bullish: HTF sweep Low rồi đóng cửa trong range, tìm BUY tại PD Array":"CRT Bearish: HTF sweep High rồi đóng cửa trong range, tìm SELL tại PD Array")}}
  const bull=cres(a,0),bear=cres(a,1),rng=cres(a,2),cRB=cres(a,3),cFVG=cres(a,4),cOB=cres(a,5),cBB=cres(a,6);
  const zc={RB:cRB,FVG:cFVG,OB:cOB,BB:cBB};
  const X=st=>{const x=ts.logicalToCoordinate(crtLog(G,st,C.tf));return x==null||!isFinite(x)?null:x},Y=p=>{const y=cs.priceToCoordinate(p);return y==null||!isFinite(y)?null:y};
  const x0b=ts.logicalToCoordinate(0),x1b=ts.logicalToCoordinate(1),bw=x0b!=null&&x1b!=null?Math.abs(x1b-x0b):6;
  const lastX=ts.logicalToCoordinate(n-1);
  const hex=(c,al)=>hexA(c,al);
  const line=(x0,x1,y,c,wd,ds)=>{if(x0==null||x1==null||y==null)return;if(Math.max(x0,x1)<-5||Math.min(x0,x1)>w+5)return;ctx.setLineDash(ds);ctx.lineWidth=wd;ctx.strokeStyle=c;ctx.beginPath();ctx.moveTo(x0,y);ctx.lineTo(x1,y);ctx.stroke()};
  const rect=(x0,x1,yt,yb,c,fa,bd,txt)=>{
    if(x0==null||x1==null||yt==null||yb==null)return;if(x1<0||x0>w)return;
    const y0=Math.min(yt,yb),hh=Math.max(1,Math.abs(yb-yt));
    ctx.fillStyle=hex(c,fa);ctx.fillRect(x0,y0,x1-x0,hh);
    if(bd){ctx.setLineDash([]);ctx.lineWidth=1;ctx.strokeStyle=c;ctx.strokeRect(x0,y0,x1-x0,hh)}
    if(txt){ctx.font=font(11,1);ctx.fillStyle=c;ctx.textAlign="right";ctx.textBaseline="middle";ctx.fillText(txt,Math.min(x1,w)-4,y0+hh/2)}};
  /* nhãn dạng viên thuốc. al: "l" = nằm bên phải điểm neo (như label_left của Pine, kẹp vào mép phải), "c" = căn giữa; bl: "top"|"bottom"|"middle" */
  const pill=(t,x,y,bg,fg,al,bl,px)=>{
    if(x==null||y==null)return;ctx.font=font(px||10,1);
    const tw=ctx.measureText(t).width+10,hh=(px||10)+6;
    let L=al==="c"?x-tw/2:x+4;if(L+tw>w-2)L=w-2-tw;if(L<2)L=2;
    const T=bl==="top"?y:bl==="bottom"?y-hh:y-hh/2;
    if(L+tw<0||L>w||T+hh<0||T>h)return;
    ctx.fillStyle=bg;ctx.beginPath();if(ctx.roundRect)ctx.roundRect(L,T,tw,hh,4);else ctx.rect(L,T,tw,hh);ctx.fill();
    ctx.fillStyle=fg;ctx.textAlign="left";ctx.textBaseline="middle";ctx.fillText(t,L+5,T+hh/2)};
  ctx.save();ctx.font=font(11,1);
  try{
    M.sigs.forEach((sg,si)=>{
      const cc=sg.dir===1?bull:bear,swapH=sg.dir===-1,extSt=sg.swpSt+tf*(1+Q.extN),xr=X(sg.rngSt),xe=X(extSt);
      const xL=xr==null?null:xr-bw/2;
      // vùng + đường CRT H / mid / L
      rect(xL,xe,Y(sg.rH),Y(sg.rL),rng,.08,false);
      line(xL,xe,Y(sg.rH),rng,1,[6,4]);line(xL,xe,Y(sg.rL),rng,1,[6,4]);
      line(xL,xe,Y((sg.rH+sg.rL)/2),hex(rng,.5),1,[2,3]);
      pill("CRT H"+(swapH?" (swept)":" (target)"),xe,Y(sg.rH),hex(rng,.7),"#fff","l","middle");
      pill("CRT L"+(!swapH?" (swept)":" (target)"),xe,Y(sg.rL),hex(rng,.7),"#fff","l","middle");
      // PD Array
      const pd_=sg.pd;
      if(pd_)for(const z of pd_.zones){
        if(z.t==="OID"){const y=Y(z.price);line(X(z.st),xe,y,cc,1,[]);pill(sg.dir===-1?"OID High (sweep)":"OID Low (sweep)",xe,y,hex(cc,.8),"#fff","l","middle",9)}
        else{const c=zc[z.t],xa=X(z.st);rect(xa==null?null:xa-bw/2,xe,Y(z.top),Y(z.bot),c,.18,true,z.t)}}
      // nhãn hướng tại nến sweep (đặt ở đúng nến chart chạm đỉnh/đáy bị quét nếu có dữ liệu)
      const ax=X(pd_?pd_.exSt:sg.swpSt),txt="CRT "+(sg.dir===1?"BUY":"SELL")+" | "+CRT_MN[sg.mdl];
      if(swapH)pill(txt,ax,Y(sg.sh)-4,cc,"#fff","c","bottom");else pill(txt,ax,Y(sg.sl)+4,cc,"#fff","c","top")});
    // nến HTF bên phải chart (nến đang chạy + các nến trước) và 2 đường CRT H/L đang hiệu lực kéo tới đó
    if(Q.showHTF&&H.length){
      const nn=Math.min(Q.nHTF,H.length),bars=H.slice(-nn);                 // cũ -> mới
      const dock=!!Q.dock,cwPx=Math.max(3,(dock?3:bw)*Q.cW),stepPx=Math.max(cwPx+3,(dock?3:bw)*Q.cGap);
      let xs0;                                                                // x (px) mép trái nến cũ nhất
      if(dock)xs0=w-10-nn*stepPx+(stepPx-cwPx)/2;
      else{const b0=ts.logicalToCoordinate(n-1+Q.htfOff);xs0=b0==null?null:b0}
      if(xs0!=null){
        const xEnd=xs0+nn*stepPx;
        if(dock){ctx.fillStyle="rgba(128,128,128,.07)";ctx.fillRect(xs0-stepPx/2+2,0,nn*stepPx+4,h)}
        const sg=M.sigs.length?M.sigs[M.sigs.length-1]:null;
        if(sg&&lastX!=null){line(lastX,xEnd,Y(sg.rH),rng,1,[2,3]);line(lastX,xEnd,Y(sg.rL),rng,1,[2,3])}
        let minLow=Infinity;
        bars.forEach((b,i)=>{
          const x=xs0+i*stepPx,c=b.c>=b.o?bull:bear,xm=x+Math.floor((cwPx-1)/2)+.5,yh=Y(b.h),yl=Y(b.l),yo=Y(b.o),yc=Y(b.c);
          if(yh==null||yl==null||yo==null||yc==null)return;
          ctx.setLineDash([]);ctx.strokeStyle=c;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(xm,yh);ctx.lineTo(xm,yl);ctx.stroke();
          ctx.fillStyle=c;ctx.fillRect(x,Math.min(yo,yc),cwPx,Math.max(1,Math.abs(yc-yo)));
          if(b.l<minLow)minLow=b.l});
        const ym=Y(minLow);
        if(ym!=null){ctx.font=font(12,1);ctx.fillStyle=ink();ctx.textAlign="center";ctx.textBaseline="top";ctx.fillText(crtTfTxt(tf),xs0+nn*stepPx/2-(stepPx-cwPx)/2,ym+6)}}}
  }finally{ctx.restore()}
  crtTable(a,Q,M,w,h)}
