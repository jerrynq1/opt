/* ===== HVN Profile v2 (indicator "hvn") =====
   Lấy cảm hứng từ "HVN Profile" của ProfitPro cho ATAS. Bản tự viết lại theo mô tả công khai, không phải mã gốc.
   Chia lịch sử thành các chu kỳ (1 phút … 1 tuần), dựng volume profile cho từng chu kỳ, tìm các node volume dày (HVN), đánh dấu POC,
   rồi kéo vùng sang phải làm hỗ trợ/kháng cự cho đến khi giá chạm lại.

   Nâng cấp v2:
   - Volume: dùng tick thật (footprint) khi đã tải, nếu không thì mô hình đường đi của giá trong nến M1 (giống volume-profile.js).
   - Nhận diện: chế độ "Đỉnh nổi bật" tìm cực đại cục bộ, lọc theo độ nổi bật (prominence), biên vùng dừng ở thung lũng giữa 2 đỉnh nên các node kề nhau
     không dính vào nhau. Chế độ "Theo ngưỡng" giữ cách cũ (ngưỡng % của đỉnh + gộp theo khoảng trống).
   - Độ mạnh: mỗi vùng có % volume trên profile và độ mạnh tương đối; lọc vùng yếu, bỏ chu kỳ volume thấp bất thường (so với trung vị).
   - Hỗ trợ / kháng cự: theo vị trí vùng so với giá đóng cuối chu kỳ.
   - Chạm vùng: 3 chế độ (chạm mép / chạm POC / nến đóng cửa vào-vượt vùng), nhận diện giá NHẢY QUA vùng (gap) cũng là đã dùng hết vùng,
     phân loại khi chạm: "giữ" (bật lại) hay "phá" (đóng cửa xuyên qua).
   - Confluence: đếm số vùng chưa chạm chồng lên nhau.
   Phần trên (đến mốc "vẽ") là hàm thuần, được kiểm thử bằng tests/hvn.test.js; phần dưới vẽ lên canvas của chart. */

const HVU=1e5;                                   // giá đổi sang số nguyên (x1e5) khi chia hàng, tránh sai số ở biên hàng
const HVN_FLOOR=.25;                             // đỉnh phải cao ít nhất 25% đỉnh lớn nhất của profile mới được xét là HVN
const hvnLB=(m,t)=>{let lo=0,hi=m.length;while(lo<hi){const k=(lo+hi)>>1;m[k][0]<t?lo=k+1:hi=k}return lo};
const hvnNice=w=>{const p=Math.pow(10,Math.floor(Math.log10(w))),q=w/p;return(q<=1?1:q<=2?2:q<=5?5:10)*p};

/* Volume profile của khoảng [t0,t1) từ nến M1. rows = số hàng mong muốn, tick = bước giá nhỏ nhất.
   fp(t) (tuỳ chọn) trả các dòng footprint [giá, mua, bán] (có thuộc tính .sp = spread) của phút t; có thì phân bổ theo tick thật, không có thì theo đường đi của giá. */
function hvnProfile(m,t0,t1,rows,tick,fp){
  const a=hvnLB(m,t0),b=hvnLB(m,t1);if(b<=a)return null;
  const I=x=>Math.round(x*HVU);let pmin=Infinity,pmax=-Infinity;
  for(let i=a;i<b;i++){const x=m[i],l=I(x[3]),h=I(x[2]);if(l<pmin)pmin=l;if(h>pmax)pmax=h}
  if(!isFinite(pmin))return null;
  let bI=Math.max(Math.round(tick*HVU),Math.round(hvnNice(Math.max(tick,(pmax-pmin)/HVU/Math.max(5,rows)))*HVU),1);
  let bi0=Math.floor(pmin/bI),n=Math.floor(pmax/bI)-bi0+1;
  if(n>3000){bI*=Math.ceil(n/3000);bi0=Math.floor(pmin/bI);n=Math.floor(pmax/bI)-bi0+1}
  const vol=new Float64Array(n),cl=(x,lo,hi)=>x<lo?lo:x>hi?hi:x,row=p=>Math.floor(p/bI)-bi0;
  const seg=(pa,pb,v)=>{const lo=Math.min(pa,pb),hi=Math.max(pa,pb),len=hi-lo,j0=Math.floor(lo/bI),j1=Math.ceil(hi/bI)-1;
    for(let j=j0;j<=j1;j++){const r0=j*bI,ov=Math.min(hi,r0+bI)-Math.max(lo,r0);if(ov>0)vol[j-bi0]+=v*ov/len}};
  let tk=0;
  for(let i=a;i<b;i++){
    const x=m[i],V=x[5]>0?x[5]:0,O=I(x[1]),H=I(x[2]),L=I(x[3]),Cl=I(x[4]),rs=fp?fp(x[0]):null;
    let Tm=0;if(rs)for(const r of rs)Tm+=r[1]+r[2];
    if(rs&&Tm>0){                                                   // có tick thật: phân bổ theo footprint, kẹp trong [low,high] của nến
      const W=V>0?V:Tm,sc=W/Tm,sp=rs.sp||0;
      for(const r of rs){if(r[1]>0)vol[row(cl(I(r[0]-sp),L,H))]+=r[1]*sc;if(r[2]>0)vol[row(cl(I(r[0]),L,H))]+=r[2]*sc}
      tk+=W;continue}
    if(!V)continue;
    const pts=Cl>=O?[O,L,H,Cl]:[O,H,L,Cl],                          // nến tăng O→L→H→C, nến giảm O→H→L→C
      ln=[Math.abs(pts[1]-pts[0]),Math.abs(pts[2]-pts[1]),Math.abs(pts[3]-pts[2])],T=ln[0]+ln[1]+ln[2];
    if(T===0){vol[row(O)]+=V;continue}
    for(let q=0;q<3;q++)if(ln[q]>0)seg(pts[q],pts[q+1],V*ln[q]/T)}
  let mx=0,tot=0;for(let i=0;i<n;i++){tot+=vol[i];if(vol[i]>mx)mx=vol[i]}
  if(!(tot>0))return null;
  return{base:bi0*bI/HVU,bin:bI/HVU,n,vol,mx,tot,cov:tk/tot}}

/* Làm mượt bằng trung bình 3 điểm, lặp "passes" lần. */
function hvnSmooth(v,passes){
  let s=Float64Array.from(v);
  for(let k=0;k<Math.max(0,Math.round(passes));k++){
    const o=new Float64Array(s.length);
    for(let i=0;i<s.length;i++){let t=s[i],c=1;if(i>0){t+=s[i-1];c++}if(i<s.length-1){t+=s[i+1];c++}o[i]=t/c}
    s=o}
  return s}

const hvnMake=(P,c)=>{let poc=c.lo,tot=0;for(let i=c.lo;i<=c.hi;i++){tot+=P.vol[i];if(P.vol[i]>P.vol[poc])poc=i}return{lo:c.lo,hi:c.hi,poc,tot}};

/* Cách cũ ("Theo ngưỡng"): hàng có volume làm mượt >= thr% đỉnh là HVN; các hàng cách nhau <= gapr hàng thì gộp; cụm phải có >= minr hàng. */
function hvnClusters(P,Q){
  const n=P.n,sm=hvnSmooth(P.vol,Q.smooth);let mx=0;for(let i=0;i<n;i++)if(sm[i]>mx)mx=sm[i];
  if(!(mx>0))return[];
  const th=mx*Math.min(99,Math.max(1,Q.thr))/100,raw=[];let cur=null,gap=0;
  for(let i=0;i<n;i++){
    if(sm[i]>=th){if(cur&&gap<=Q.gapr)cur.hi=i;else{if(cur)raw.push(cur);cur={lo:i,hi:i}}gap=0}
    else if(cur)gap++}
  if(cur)raw.push(cur);
  return raw.filter(c=>c.hi-c.lo+1>=Math.max(1,Q.minr)).map(c=>hvnMake(P,c))}

/* Cách mới ("Đỉnh nổi bật"): tìm cực đại cục bộ của profile đã làm mượt (có xử lý cao nguyên), giữ đỉnh đủ cao (>= HVN_FLOOR đỉnh lớn nhất) và đủ nổi bật
   (prominence >= prom% đỉnh lớn nhất). Biên vùng đi xuống từ đỉnh đến khi volume < thr% của đỉnh đó hoặc gặp thung lũng (volume bắt đầu tăng lại),
   nên 2 node kề nhau được tách đúng ở đáy giữa chúng. */
function hvnNodes(P,Q){
  const n=P.n,sm=hvnSmooth(P.vol,Q.smooth);let mx=0;for(let i=0;i<n;i++)if(sm[i]>mx)mx=sm[i];
  if(!(mx>0))return[];
  const E=mx*1e-9,pk=[];
  for(let i=0;i<n;){
    let j=i;while(j+1<n&&Math.abs(sm[j+1]-sm[i])<=E)j++;
    const l=i>0?sm[i-1]:-1,r=j<n-1?sm[j+1]:-1;
    if(sm[i]>l&&sm[i]>r)pk.push((i+j)>>1);
    i=j+1}
  const prom=p=>{const h=sm[p];let lm=h,rm=h;
    for(let i=p-1;i>=0&&sm[i]<=h;i--)if(sm[i]<lm)lm=sm[i];
    for(let j=p+1;j<n&&sm[j]<=h;j++)if(sm[j]<rm)rm=sm[j];
    return h-Math.max(lm,rm)};
  const keep=pk.filter(p=>sm[p]>=mx*HVN_FLOOR&&prom(p)>=mx*Math.max(0,Q.prom)/100),lvl=Math.min(99,Math.max(1,Q.thr))/100,box=[];
  for(const p of keep){
    const t=sm[p]*lvl;let lo=p,hi=p;
    while(lo>0&&sm[lo-1]>=t&&sm[lo-1]<=sm[lo]+E)lo--;
    while(hi<n-1&&sm[hi+1]>=t&&sm[hi+1]<=sm[hi]+E)hi++;
    box.push({lo,hi})}
  for(let k=1;k<box.length;k++)if(box[k].lo<=box[k-1].hi)box[k].lo=box[k-1].hi+1;     // 2 node chung thung lũng: hàng đáy thuộc node bên dưới
  return box.filter(c=>c.hi>=c.lo&&c.hi-c.lo+1>=Math.max(1,Q.minr)).map(c=>hvnMake(P,c))}

/* Điểm vào: chọn cách nhận diện, thêm % volume trên profile (sh) và độ mạnh tương đối so với vùng mạnh nhất (rel), lọc vùng yếu (mins %). */
function hvnFind(P,Q){
  const L=Q.meth==="level"?hvnClusters(P,Q):hvnNodes(P,Q),mxT=L.reduce((a,z)=>Math.max(a,z.tot),0);
  L.forEach(z=>{z.sh=P.tot>0?z.tot/P.tot*100:0;z.rel=mxT>0?z.tot/mxT:0});
  return L.filter(z=>z.sh>=(Q.mins||0))}

/* Giá có "dùng hết" vùng z ở nến b không (prev = nến trước đó). mode: edge = chạm mép, poc = chạm POC, close = nến đóng cửa vào hoặc vượt vùng.
   Giá nhảy qua vùng (đóng cửa nến trước ở một phía, mở cửa nến này ở phía bên kia) cũng tính là đã qua vùng. */
function hvnHit(z,b,prev,mode){
  if(prev&&((prev.close<z.zb&&b.open>z.zt)||(prev.close>z.zt&&b.open<z.zb)))return true;
  if(mode==="poc")return b.low<=z.pp&&b.high>=z.pp;
  if(mode==="close")return z.sd>0?b.close>=z.zb:z.sd<0?b.close<=z.zt:(b.close>=z.zb&&b.close<=z.zt);
  return b.low<=z.zt&&b.high>=z.zb}
/* Kết quả lúc chạm: "b" = phá (đóng cửa xuyên qua vùng), "h" = giữ (bật lại), "" = vùng trung tính. */
const hvnOut=(z,b)=>z.sd>0?(b.close>z.zt?"b":"h"):z.sd<0?(b.close<z.zb?"b":"h"):"";

/* ===== vẽ ===== */
const hvnOn=()=>ACT.find(x=>x.key==="hvn"&&isOn(x));
const HVC=new Map();
const HVZ=[];                                   // vùng HVN của các chu kỳ đã đóng: {zb,zt,pp,t1,te} (giá, POC, giờ bắt đầu hiệu lực, giờ bị dùng hết hoặc Infinity), theo THỜI GIAN nên không phụ thuộc vùng nhìn thấy; Heavy Absorption đối chiếu

function hvnGet(Q,len,t0,tick,fp,ver){
  const key=[C.sym,len,Q.rows,Q.meth,Q.thr,Q.prom,Q.smooth,Q.gapr,Q.minr,Q.mins,Q.src,t0].join("|"),t1=t0+len,N=m1.length,lo=hvnLB(m1,t0),hi=hvnLB(m1,t1),live=hi>=N;
  const sig=(hi-lo)+"|"+tick+"|"+(fp?ver:"")+(live&&N?"|"+m1[N-1][5]+"|"+m1[N-1][4]:""),c=HVC.get(key);if(c&&c.sig===sig)return c.E;
  const P=hvnProfile(m1,t0,t1,Q.rows,tick,fp);let E=null;
  if(P){
    const cl=hvnFind(P,Q),mk=new Uint8Array(P.n),ref=!live&&hi>lo?m1[hi-1][4]:null;
    cl.forEach(z=>{for(let i=z.lo;i<=z.hi;i++)mk[i]=1;mk[z.poc]=2;
      z.zb=P.base+z.lo*P.bin;z.zt=P.base+(z.hi+1)*P.bin;z.pp=P.base+(z.poc+.5)*P.bin;
      z.sd=ref==null?0:z.zb>ref?1:z.zt<ref?-1:0;                    // 1 = kháng cự (vùng trên giá), -1 = hỗ trợ (vùng dưới giá), 0 = giá đóng cuối chu kỳ nằm trong vùng
      z.tc=null;z.i=-1;z.sg="";z.al=false;z.out="";z.cf=1;
      if(c&&c.E)for(const o of c.E.cl)if(o.lo===z.lo&&o.hi===z.hi){z.al=o.al;z.tc=o.tc;z.i=o.i;z.sg=o.sg;z.out=o.out}});   // giữ trạng thái chạm/báo khi chỉ có volume mới
    E={P,cl,mk,live,t0,t1}}
  HVC.set(key,{sig,E});if(HVC.size>1500)HVC.delete(HVC.keys().next().value);return E}
/* Tìm nến đầu tiên (sau khi chu kỳ kết thúc + grace nến) làm vùng bị dùng hết. Quét tăng dần; nến cuối luôn được kiểm tra lại (riêng chế độ "close" chỉ xét nến đã đóng). */
function hvnTouch(z,t1,grace,mode){
  const sg=agg[0].st+"|"+C.tf+"|"+C.sym+"|"+grace+"|"+mode;
  if(z.sg!==sg){z.sg=sg;z.i=-1;z.tc=null;z.out=""}
  if(z.tc!=null&&agg.length&&z.tc>agg[agg.length-1].st){z.tc=null;z.out="";z.al=false}   // dữ liệu hiện tại chưa còn bao phủ mốc đã chạm: kiểm tra lại vùng
  if(z.tc!=null)return z.tc;
  if(z.i<0){let lo=0,hi=agg.length;while(lo<hi){const k=(lo+hi)>>1;agg[k].st<t1?lo=k+1:hi=k}z.i=lo+Math.max(0,Math.round(grace))}
  const lim=mode==="close"?agg.length-1:agg.length;
  for(let j=Math.max(z.i,0);j<lim;j++){const b=agg[j];if(hvnHit(z,b,j>0?agg[j-1]:null,mode)){z.tc=b.st;z.out=hvnOut(z,b);return z.tc}}
  z.i=Math.max(z.i,lim-1);return null}
function hvnAlert(z){
  try{status("HVN "+(z.sd>0?"kháng cự":z.sd<0?"hỗ trợ":"")+": giá chạm vùng "+z.zb.toFixed(pd())+" – "+z.zt.toFixed(pd()),"ok")}catch{}
  try{const A=new (window.AudioContext||window.webkitAudioContext)(),o=A.createOscillator(),g=A.createGain();o.frequency.value=880;g.gain.value=.05;o.connect(g);g.connect(A.destination);o.start();o.stop(A.currentTime+.15)}catch{}}
function drawHVN(w,h){
  HVZ.length=0;
  const a=hvnOn();if(!a||!agg.length||!m1.length)return;
  const Q=Object.assign(pdef(IND.hvn),a.p),len=Math.max(60,+Q.tf||3600),N=agg.length,lastT=m1[m1.length-1][0],tick=vpTick(),lw=a.w||1.5,last=agg[N-1].st;
  const fp=Q.src==="auto"&&typeof FPM!=="undefined"&&FPM.size>0?(t=>FPM.get(t)):null,ver=fp?FPH+"|"+FPLV:"";
  const col=[0,1,2,3,4,5].map(j=>cres(a,j)),[c0,c1,c2,c3,cSup,cRes]=col;
  const tFirst=agg[Math.max(0,N-Math.max(50,Math.round(Q.maxb)))].st,per=[];
  for(let p=bucket(tFirst,len);p<=lastT;p+=len)per.push(p);
  if(per.length>400)per.splice(0,per.length-400);
  const Es=[];for(const t0 of per){const E=hvnGet(Q,len,t0,tick,fp,ver);if(E&&(!E.live||Q.live))Es.push(E)}
  // bỏ chu kỳ volume thấp bất thường (nghỉ lễ, phiên mỏng) so với trung vị các chu kỳ đã đóng
  const cl=Es.filter(e=>!e.live).map(e=>e.P.tot).sort((x,y)=>x-y),minT=cl.length?cl[cl.length>>1]*Math.max(0,Q.mpv)/100:0,items=[],act=[],shown=[];
  for(const E of Es){
    if(!E.live&&E.P.tot<minT)continue;
    const x0=ts.logicalToCoordinate(s2l(E.t0)),x1=ts.logicalToCoordinate(s2l(E.t1));if(x0==null||x1==null||x0>w)continue;
    E.x0=x0;E.x1=x1;shown.push(E);
    for(const z of E.cl){
      const yt=cs.priceToCoordinate(z.zt),yb=cs.priceToCoordinate(z.zb),yp=cs.priceToCoordinate(z.pp);if(yt==null||yb==null)continue;
      let xe=x1,touched=false;
      if(!E.live){
        const tc=hvnTouch(z,E.t1,Q.grace,Q.touch);
        if(tc!=null){touched=true;xe=ts.logicalToCoordinate(s2l(tc));if(xe==null)xe=x1;
          if(!z.al){z.al=true;if(Q.alert&&tc>=last)hvnAlert(z)}}
        else xe=w;
        HVZ.push({zb:z.zb,zt:z.zt,pp:z.pp,t1:E.t1,te:tc!=null?tc:Infinity});
        if(touched&&!Q.shwt)continue;
      }
      if(xe<0)continue;
      const it={E,z,x0,xe,touched,yt,yb,yp};items.push(it);if(!E.live&&!touched){z.cf=1;act.push(z)}
    }
  }
  // confluence: số vùng chưa chạm chồng lên nhau theo giá
  act.sort((p,q)=>p.zb-q.zb);
  for(let i=0;i<act.length;i++)for(let j=i+1;j<act.length&&act[j].zb<act[i].zt;j++){act[i].cf++;act[j].cf++}
  ctx.save();ctx.setLineDash([]);ctx.textBaseline="middle";
  try{
    for(const it of items){
      const{E,z,x0,xe,touched,yt,yb,yp}=it,live=E.live,brk=touched&&z.out==="b";
      const c=live?c3:Q.sdc&&z.sd>0?cRes:Q.sdc&&z.sd<0?cSup:c0;
      const al=(live?Q.lop:Q.zop)*(.5+.5*z.rel)*(touched?(brk?.3:.5):1),y0=Math.min(yt,yb),hh=Math.max(1.5,Math.abs(yb-yt));
      ctx.fillStyle=hexA(c,al);ctx.fillRect(x0,y0,xe-x0,hh);
      ctx.lineWidth=1;ctx.strokeStyle=hexA(c,Math.min(1,al+.3));ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(xe,y0);ctx.moveTo(x0,y0+hh);ctx.lineTo(xe,y0+hh);ctx.stroke();
      if(yp!=null){
        if(brk)ctx.setLineDash([4,4]);
        ctx.lineWidth=lw;ctx.strokeStyle=hexA(c1,touched?.45:.95);ctx.beginPath();ctx.moveTo(x0,yp);ctx.lineTo(Q.pocx||live||touched?xe:E.x1,yp);ctx.stroke();ctx.setLineDash([]);
        if(!live&&!touched&&xe-x0>70&&yp>6&&yp<h-6){
          ctx.font=font(10,1);ctx.textAlign="right";ctx.fillStyle=hexA(c1,.95);
          ctx.fillText("POC "+z.pp.toFixed(pd())+" · "+Math.round(z.sh)+"%"+(Q.cfl&&z.cf>1?" ×"+z.cf:""),Math.min(xe,w)-4,yp-7)}}
    }
    // histogram volume của từng chu kỳ (vẽ sau để nằm trên vùng)
    for(const E of shown){
      const P=E.P,live=E.live,x0=E.x0,x1=E.x1;if(x1<0)continue;
      const maxW=(x1-x0)*Q.hw/100;if(maxW<6||P.mx<=0)continue;
      const ya=cs.priceToCoordinate(P.base),yb=cs.priceToCoordinate(P.base+P.n*P.bin);if(ya==null||yb==null||ya===yb)continue;
      const Yp=p=>ya+(p-P.base)*(yb-ya)/(P.n*P.bin),rh=Math.abs(Yp(P.base+P.bin)-Yp(P.base)),gap=rh>4?1:0;
      for(let i=0;i<P.n;i++){
        const v=P.vol[i];if(v<=0)continue;
        const yu=Yp(P.base+(i+1)*P.bin),yd=Yp(P.base+i*P.bin),y=Math.min(yu,yd),hh=Math.max(1,Math.abs(yd-yu)-gap);
        if(y+hh<-2||y>h+2)continue;
        const k=E.mk[i],c=k===2?c1:k===1?(live?c3:c0):(live?c3:c2),al=live?Q.lop:(k?Math.min(1,Q.hop+.3):Q.hop*.7);
        ctx.fillStyle=hexA(c,k===2?Math.min(1,al+.2):al);ctx.fillRect(x0,y,v/P.mx*maxW,hh)}
    }
  }finally{ctx.restore()}
}
