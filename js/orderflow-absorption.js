/* ===== Orderflow: Heavy Absorption v2 (indicator "hab") =====
   Tự viết lại theo mô tả công khai của "Heavy Absorption" (ProfitPro, ATAS), không phải mã gốc, kèm các nâng cấp riêng.
   Print = volume MUA (Ask) hoặc BÁN (Bid) tại một hàng giá trong một nến. Ngưỡng thích nghi từ mọi print trong lookback nến:
     - "sd": trung bình + k × độ lệch chuẩn (như mô tả ATAS);  - "log": theo log của volume (volume từng mức giá lệch phải, đuôi dài, nên log ổn định hơn).
   Nâng cấp so với v1:
   1. Hấp thụ thật: print lớn chưa đủ, giá còn phải BỊ CHẶN. Phía mua bị hấp thụ khi giá không đi quá mép trên cụm (dung sai "ext" hàng) trong chính nến đó;
      phía bán tương tự ở mép dưới. Sau đó theo dõi K nến: đóng cửa (hoặc râu) vượt mức hấp thụ = thất bại, hết K nến mà giữ được = xác nhận, chưa đủ nến = đang chờ.
   2. Cụm: các print đủ ngưỡng ở hàng kề nhau (cho phép vài hàng trống) gộp thành một cụm; marker đặt tại print lớn nhất của cụm, volume là tổng cụm.
   3. Ngưỡng chính xác hơn: có thể loại nến đang xét khỏi thống kê (print lớn của chính nó không tự nâng ngưỡng); bỏ nến thiếu tick (độ phủ thấp);
      yêu cầu đủ số print trong cửa sổ; lọc theo tỉ trọng print trong nến; bước giá tự động theo biên độ nến.
   4. Kết hợp HVN Profile theo THỜI GIAN (không phụ thuộc vùng nhìn thấy): marker trong vùng HVN còn hiệu lực, biết vai trò vùng (hỗ trợ khi giá tới từ trên, kháng cự khi từ dưới),
      "đúng vai trò" khi mua bị hấp thụ tại kháng cự hoặc bán bị hấp thụ tại hỗ trợ; có đánh dấu POC.
   Phần tính ngưỡng ở đầu file được tách khỏi DOM/canvas. Cần dữ liệu tick (footprint) nên dùng chung bộ tải tick với Footprint/Big Trade. */

/* Các print của 1 nến. mins = mảng các phút, mỗi phút là mảng dòng footprint [giá, mua, bán]. B/S = [[hàng, volume]] của phía mua/bán. sl, sql = tổng ln(v), ln(v)² (cho chế độ log). */
function haBar(mins,step){
  const lv=new Map();
  for(const r of mins){if(!r)continue;
    for(const [p,b,s] of r){const q=fpQ(p,step);let e=lv.get(q);if(!e){e=[0,0];lv.set(q,e)}e[0]+=b;e[1]+=s}}
  const B=[],S=[];let n=0,sum=0,sq=0,sl=0,sql=0;
  const add=(L,q,v)=>{L.push([q,v]);n++;sum+=v;sq+=v*v;const l=Math.log(v);sl+=l;sql+=l*l};
  for(const [q,e] of lv){if(e[0]>0)add(B,q,e[0]);if(e[1]>0)add(S,q,e[1])}
  return{B,S,n,sum,sq,sl,sql}}

/* Hệ số k theo độ nhạy. Chế độ log cần k cao hơn một chút vì đuôi phân phối đã được nén lại. */
function haK(Q){
  const lg=Q.dist==="log",m=Q.sens;
  if(m==="custom")return Math.max(0.1,+Q.sdk||2);
  return m==="low"?(lg?3:3):m==="high"?(lg?2:1.5):(lg?2.5:2)}

/* Ngưỡng của từng nến. bars[i] = {n,sum,sq,sl,sql} hoặc null (nến bị loại). Cửa sổ = lb nến; excl = true thì cửa sổ là lb nến TRƯỚC nến đang xét (không gồm nó).
   Trả mảng cùng độ dài: {thr,c,s,n,log} hoặc null (chưa đủ minN print, hoặc mọi print bằng nhau nên độ lệch chuẩn = 0). c, s dùng tính điểm σ qua haZ. */
function haThrs(bars,lb,k,minN,dist,excl){
  const N=bars.length,pn=new Float64Array(N+1),ps=new Float64Array(N+1),pq=new Float64Array(N+1),pl=new Float64Array(N+1),pm=new Float64Array(N+1),out=new Array(N).fill(null);
  for(let i=0;i<N;i++){const b=bars[i];pn[i+1]=pn[i]+(b?b.n:0);ps[i+1]=ps[i]+(b?b.sum:0);pq[i+1]=pq[i]+(b?b.sq:0);pl[i+1]=pl[i]+(b?b.sl:0);pm[i+1]=pm[i]+(b?b.sql:0)}
  const L=Math.max(1,Math.round(lb)),lg=dist==="log";
  for(let i=0;i<N;i++){
    const e=excl?i:i+1,s=Math.max(0,e-L),n=pn[e]-pn[s];if(n<Math.max(2,minN))continue;
    if(lg){const mu=(pl[e]-pl[s])/n,sd=Math.sqrt(Math.max(0,(pm[e]-pm[s])/n-mu*mu));if(sd>1e-9)out[i]={thr:Math.exp(mu+k*sd),c:mu,s:sd,n,log:true}}
    else{const mean=(ps[e]-ps[s])/n,sd=Math.sqrt(Math.max(0,(pq[e]-pq[s])/n-mean*mean));if(sd>1e-9)out[i]={thr:mean+k*sd,c:mean,s:sd,n,log:false}}}
  return out}
const haZ=(t,v)=>t.log?(Math.log(v)-t.c)/t.s:(v-t.c)/t.s;

/* Một phía của 1 nến: các print >= floor gộp thành cụm (hàng cách nhau <= gap+1), giữ maxm cụm có tổng volume lớn nhất.
   Cụm: q = hàng của print lớn nhất (cùng volume thì hàng thấp hơn), v = tổng, mx = print lớn nhất, cnt, lo/hi = hàng thấp nhất/cao nhất của cụm. */
function haClusters(L,floor,gap,maxm){
  const Q=L.filter(p=>p[1]>=floor).sort((a,b)=>a[0]-b[0]),out=[];let c=null;
  for(const [q,v] of Q){
    if(c&&q-c.hi<=Math.max(0,gap)+1){c.hi=q;c.v+=v;c.cnt++;if(v>c.mx){c.mx=v;c.q=q}}
    else{c={q,v,mx:v,cnt:1,lo:q,hi:q};out.push(c)}}
  out.sort((a,b)=>b.v-a.v||a.q-b.q);return out.slice(0,Math.max(1,Math.round(maxm)))}

/* Có hấp thụ thật không. bars[j] = {high,low,close}; side +1 = mua bị hấp thụ (chặn ở mép trên hi), -1 = bán bị hấp thụ (chặn ở mép dưới lo); e = bề rộng 1 hàng giá.
   o: rej "none"|"ext"|"close" (điều kiện trong nến), ext (số hàng giá cho phép vượt mức), conf (số nến xác nhận), wick (true = râu vượt cũng tính là thất bại, false = chỉ đóng cửa), len (nến xét thêm để kẻ mức), lc = chỉ số nến đã đóng cuối cùng.
   Kết quả: st "run" (giá chạy xuyên ngay trong nến: không phải hấp thụ) | "fail" | "ok" | "pend"; br = chỉ số nến đầu tiên phá mức (-1 nếu chưa). */
function haJudge(bars,i,side,lo,hi,e,o,lc){
  const b=bars[i],x=Math.max(0,+o.ext||0)*e,K=Math.max(0,Math.round(+o.conf||0)),lcl=lc==null?bars.length-2:lc;
  if(o.rej&&o.rej!=="none"){
    if(side>0?b.high>hi+x:b.low<lo-x)return{st:"run",br:-1};
    if(o.rej==="close"&&(side>0?b.close>hi:b.close<lo))return{st:"run",br:-1}}
  const maxJ=Math.min(bars.length-1,i+Math.max(K,Math.round(+o.len||0)));let br=-1;
  for(let j=i+1;j<=maxJ;j++){
    if(!o.wick&&j>lcl)break;                                         // chỉ xét đóng cửa thì nến đang chạy chưa tính
    const d=bars[j];if(side>0?(o.wick?d.high:d.close)>hi+x:(o.wick?d.low:d.close)<lo-x){br=j;break}}
  if(br>0&&br<=i+K)return{st:"fail",br};
  return{st:i+K<=lcl?"ok":"pend",br}}

/* Đối chiếu với vùng HVN (zones từ HVZ: {zb,zt,pp,t1,te}). t = giờ bắt đầu nến; lo/hi = khoảng giá của cụm; open = giá mở nến; tol = dung sai (giá).
   Vùng hiệu lực khi t1 <= t <= te (te = giờ nến bị dùng hết, nến đó vẫn tính vì đó chính là phản ứng). Giá tới từ dưới thì vùng là kháng cự, từ trên là hỗ trợ.
   aligned = mua bị hấp thụ tại kháng cự hoặc bán bị hấp thụ tại hỗ trợ. poc = POC của vùng nằm sát cụm. */
function haHvn(zones,t,lo,hi,open,side,tol){
  let best=null,bo=-1;
  for(const z of zones){
    if(t<z.t1||t>z.te)continue;
    const ov=Math.min(hi+tol,z.zt)-Math.max(lo-tol,z.zb);if(ov<0)continue;
    if(ov>bo){bo=ov;best=z}}
  if(!best)return null;
  const mid=(best.zb+best.zt)/2,res=open<=mid;
  return{role:res?"R":"S",aligned:res?side>0:side<0,poc:best.pp>=lo-tol&&best.pp<=hi+tol}}

/* ===== vẽ ===== */
const haOn=()=>ACT.find(x=>x.key==="hab"&&isOn(x));
// bước giá: > 0 là người dùng đặt; 0 = tự động theo trung vị biên độ các nến đã đóng gần nhất chia số hàng mong muốn (làm tròn 1/2/5 nên ít đổi)
function haStep(Q){
  const s=+Q.step;if(s>0)return s;
  const N=agg.length,L=Math.max(5,Math.round(Q.lb)),r=[];
  for(let i=Math.max(0,N-1-L);i<N-1;i++)r.push(agg[i].high-agg[i].low);
  r.sort((a,b)=>a-b);const med=r.length?r[r.length>>1]:0;
  return med>0?Math.max(vpTick(),hvnNice(med/Math.max(3,Q.rows||12))):vpTick()}
// print của 1 nến + độ phủ tick (% số phút có volume mà có dữ liệu tick); cache trên nến, làm mới khi nạp thêm tick, đổi bước giá hoặc nến đang chạy có tick mới
function haBarOf(c,step){
  const last=agg.length&&c===agg[agg.length-1],key=[step,FPH,last?FPLV:0].join("|");
  if(c._hk===key&&fpSigOk(c,"_hs",FPM))return c._hl;
  fpSigSet(c,"_hs",FPM);const mins=[];
  for(let t=c.st;t<c.st+C.tf&&t<Infinity;t+=60)mins.push(FPM.get(t));
  const a0=hvnLB(m1,c.st),a1=hvnLB(m1,c.st+C.tf);let nn=0,ok=0;
  for(let i=a0;i<a1;i++)if(m1[i][5]>0){nn++;if(FPM.has(m1[i][0]))ok++}
  const b=haBar(mins,step);b.cov=nn?ok/nn*100:(b.n?100:0);
  c._hk=key;return c._hl=b}
/* Marker của các nến from..to: {i,side,q,v,mx,cnt,lo,hi (hàng),pl,ph (giá),thr,z,st,br}. Đã loại các cụm giá chạy xuyên ngay trong nến (st "run"). */
function haRun(from,to,Q,step){
  const lb=Math.max(5,Math.round(Q.lb)),lo=Math.max(0,from-lb),B=[],mc=Math.max(0,+Q.cov||0);
  for(let i=lo;i<=to;i++)B.push(haBarOf(agg[i],step));
  const S=B.map(b=>b.cov>=mc&&b.n>0?b:null);                        // nến thiếu tick không tham gia thống kê và không có marker
  const T=haThrs(S,lb,haK(Q),Math.max(5,Math.round(Q.minn)),Q.dist,Q.excl),mk=[],e=fpSI(step)/FPU,lc=agg.length-2;
  const o={rej:Q.rej,ext:Q.ext,conf:Q.conf,wick:Q.cm==="wick",len:Q.lvl?Q.len:0},mv=Math.max(0,+Q.minv||0),mp=Math.max(0,+Q.minp||0)/100;
  for(let i=Math.max(0,from);i<=to;i++){
    const t=T[i-lo],b=S[i-lo];if(!t||!b)continue;
    const fl=Math.max(t.thr,mv,b.sum*mp);
    for(const side of [1,-1])for(const c of haClusters(side>0?b.B:b.S,fl,Q.gap,Q.maxm)){
      const pl=c.lo*e,ph=(c.hi+1)*e,j=haJudge(agg,i,side,pl,ph,e,o,lc);
      if(j.st==="run")continue;
      mk.push({i,side,q:c.q,v:c.v,mx:c.mx,cnt:c.cnt,lo:c.lo,hi:c.hi,pl,ph,thr:t.thr,z:haZ(t,c.mx),st:j.st,br:j.br})}}
  return mk}
let haSeen=new Set(),haSK="";
function haBeep(){try{const A=new (window.AudioContext||window.webkitAudioContext)(),o=A.createOscillator(),g=A.createGain();o.frequency.value=660;g.gain.value=.05;o.connect(g);g.connect(A.destination);o.start();o.stop(A.currentTime+.15)}catch{}}
const haFm=v=>v>=1e6?(v/1e6).toFixed(1)+"M":v>=1e4?(v/1e3).toFixed(1)+"K":String(Math.round(v));
/* Cảnh báo: "bar" = khi nến chứa marker đóng, "ok" = khi marker đã được xác nhận (K nến sau đã đóng mà giữ được mức). Lần quét đầu chỉ ghi nhớ để không báo dồn lịch sử. */
function haAlert(Q,step){
  const N=agg.length;if(N<3||Q.alm==="off"||!Q.alm)return;
  const K=Math.max(0,Math.round(+Q.conf||0)),k=C.sym+"|"+C.tf+"|"+step,first=haSK!==k;
  if(first){haSK=k;haSeen=new Set()}
  const ms=haRun(Math.max(0,N-K-4),N-2,Q,step);let g=null;
  for(const m of ms){
    const okb=Q.alm==="ok"?(m.st==="ok"&&m.i+K<=N-2):m.i<=N-2;if(!okb)continue;
    const id=agg[m.i].st+"|"+m.side+"|"+m.q;if(haSeen.has(id))continue;haSeen.add(id);
    if(!first&&(!g||m.v>g.v))g=m}
  if(g){try{status("Heavy Absorption: "+(g.side>0?"MUA bị hấp thụ":"BÁN bị hấp thụ")+" "+haFm(g.v)+" tại "+fpYp(g.q,step).toFixed(pd())+(g.st==="ok"?" (đã xác nhận)":""),"ok")}catch{}haBeep()}}
function drawHAB(w,h){
  const a=haOn();if(!a||!agg.length)return;
  const lr=ts.getVisibleLogicalRange();if(!lr)return;
  const Q=Object.assign(pdef(IND.hab),a.p);
  if(!FPM.size){
    if(fpLast&&!fpOn()){ctx.save();ctx.textAlign="right";ctx.textBaseline="top";ctx.font="12px system-ui,sans-serif";ctx.globalAlpha=.6;ctx.fillStyle=ink();
      ctx.fillText("Heavy Absorption: chưa có dữ liệu tick (kiểm tra kết nối cTrader)",w-10,8);ctx.restore()}
    return}
  const step=haStep(Q),e=fpSI(step)/FPU,N=agg.length,j0=Math.max(0,Math.floor(lr.from)-1),i1=Math.min(N-1,Math.ceil(lr.to)+1);
  haAlert(Q,step);
  const xa=ts.logicalToCoordinate(j0),xb=ts.logicalToCoordinate(j0+1),bs=xa!=null&&xb!=null?xb-xa:0;if(!bs)return;
  const hm=hvnOn()?Q.hvn:"off",tol=Math.max(0,+Q.htol||0)*e,fp=!!window.FPHIDE,dx=fp?1+Math.min(8,bs*.12)/2:0,vis=[];
  for(const m of haRun(j0,i1,Q,step)){
    if(m.i===N-1&&!Q.live)continue;
    if(Q.sts==="nofail"&&m.st==="fail")continue;
    if(Q.sts==="ok"&&m.st!=="ok")continue;
    const x=ts.logicalToCoordinate(m.i),y=cs.priceToCoordinate(fpYp(m.q,step));if(x==null||y==null||y<-100||y>h+100)continue;
    const bar=agg[m.i],hv=hm==="off"?null:haHvn(HVZ,bar.st,m.pl,m.ph,bar.open,m.side,tol);
    if((hm==="only"||hm==="align")&&!hv)continue;
    if(hm==="align"&&!hv.aligned)continue;
    vis.push({m,x:x+dx,y,hv,bar})}
  if(!vis.length)return;
  const cU=fpRgb(cres(a,0)),cD=fpRgb(cres(a,1)),cT=cres(a,2),cH=cres(a,3),mono="Consolas,ui-monospace,Menlo,monospace";
  const dmin=Math.max(4,+Q.dmin||14),dmax=Math.max(dmin,+Q.dmax||44),cap=Math.max(1.5,+Q.cap||5);let vmax=0;for(const o of vis)if(o.m.v>vmax)vmax=o.m.v;
  vis.sort((p,q)=>q.m.v-p.m.v);                                        // to vẽ trước, nhỏ vẽ đè lên
  ctx.save();ctx.setLineDash([]);ctx.textBaseline="middle";
  try{
    // mức hấp thụ: kẻ từ marker sang phải đến khi bị phá (thất bại) hoặc hết số nến tối đa
    if(Q.lvl)for(const o of vis){
      const g=o.m,end=g.br>0?g.br:Math.min(N-1,g.i+Math.max(1,Math.round(Q.len))),x1=ts.logicalToCoordinate(end);if(x1==null||x1<=o.x)continue;
      const cl=g.side>0?cU:cD,fail=g.st==="fail";
      ctx.lineWidth=1;ctx.strokeStyle=`rgba(${cl},${fail?.25:.6})`;ctx.setLineDash(g.st==="pend"?[4,3]:[]);
      ctx.beginPath();ctx.moveTo(o.x,o.y);ctx.lineTo(Math.min(x1,w),o.y);ctx.stroke()}
    ctx.setLineDash([]);
    for(const o of vis){
      const g=o.m,cl=g.side>0?cU:cD,fail=g.st==="fail",prov=g.st==="pend";
      const k=Q.sz==="vis"?Math.sqrt(g.v/vmax):Math.sqrt(Math.max(0,Math.min(1,(g.v/g.thr-1)/(cap-1))));
      let r=(dmin+(dmax-dmin)*k)/2;if(fp)r=Math.min(r,Math.max(bs*.3,10));
      const al=Q.op*(fail?.4:1);
      ctx.lineWidth=g.st==="ok"?2:1.2;ctx.setLineDash(prov?[3,2]:[]);ctx.strokeStyle=`rgba(${cl},${Math.min(1,al+.35)})`;ctx.beginPath();ctx.arc(o.x,o.y,r,0,7);
      if(!Q.hol){ctx.fillStyle=`rgba(${cl},${al})`;ctx.fill()}
      ctx.stroke();ctx.setLineDash([]);
      if(o.hv){                                                        // trong vùng HVN còn hiệu lực: vòng ngoài (liền = đúng vai trò, đứt = ngược vai trò)
        ctx.lineWidth=2;ctx.setLineDash(o.hv.aligned?[]:[3,3]);ctx.strokeStyle=hexA(cH,fail?.5:.95);ctx.beginPath();ctx.arc(o.x,o.y,r+3,0,7);ctx.stroke();ctx.setLineDash([]);
        if(r>=8){ctx.font="bold 9px "+mono;ctx.textAlign="center";ctx.fillStyle=hexA(cH,.95);ctx.fillText("HVN "+o.hv.role+(o.hv.poc?" POC":""),o.x,o.y-r-9)}}
      if(Q.tm!=="z"&&Q.txt&&r>=Q.tsz*.8){ctx.fillStyle=cT;ctx.font="bold "+Q.tsz+"px "+mono;ctx.textAlign="center";ctx.fillText(haFm(g.v),o.x,o.y+1)}
      if(Q.tm!=="vol"&&r>=8){ctx.fillStyle=Q.tm==="z"?cT:hexA(cT,.8);ctx.font=(Q.tm==="z"?"bold ":"")+Math.max(8,Q.tsz-(Q.tm==="z"?0:2))+"px "+mono;ctx.textAlign="center";
        ctx.fillText((g.z>=0?"+":"")+g.z.toFixed(1)+"σ",o.x,Q.tm==="z"?o.y+1:o.y+r+9)}}
  }finally{ctx.restore()}
}
