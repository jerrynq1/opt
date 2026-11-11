/* ===== Volume Profile (kiểu Deep Profile) =====
   Tổng volume mỗi phút luôn lấy từ tick volume của nến M1 (m1[i] = [thời gian, open, high, low, close, tickVolume]); nguồn chỉ quyết định volume được PHÂN BỔ vào các mức giá thế nào:
   1) Có dữ liệu tick của phút đó (Footprint / Big Trade / Statistic đang bật và đã tải): phân bổ theo footprint thật từ tick, mua/bán lấy từ phân loại tick.
      Giá MUA (khớp ở Ask) được quy về hệ Bid bằng spread trung bình của phút, để cùng hệ giá với nến; giá luôn được kẹp trong [low, high] của nến.
   2) Không có tick: mô hình đường đi của giá trong nến, nến tăng O→L→H→C, nến giảm O→H→L→C. Volume chia theo độ dài từng đoạn, mỗi đoạn trải đều theo
      phần giao của nó với từng hàng; đoạn đi lên là Ask (mua), đoạn đi xuống là Bid (bán). Chính xác hơn cách chia đều theo số hàng và áp 1 tỉ lệ mua/bán chung cho mọi hàng.
   Mọi phép tính hàng giá dùng SỐ NGUYÊN (1/100000) nên không sai số ở biên hàng. Kích thước hàng gắn với GIÁ (không phụ thuộc zoom / kéo trục Y): tự động ≈ 70 hàng cho cả vùng giá của profile, hoặc cố định theo số tick. */
const VPC=new Map(),VPU={h:3600,d:86400,w:604800};
const vpTick=()=>Math.pow(10,-pd());
function vpCalc(d,t0,t1){
  const N=m1.length;if(!N)return null;
  const mt=Math.round(+d.mt||0),src=d.src==="m1"?"m1":"auto",useTk=src==="auto"&&typeof FPM!=="undefined"&&FPM.size>0,lastT=m1[N-1][0];
  const sig=[t0,t1,N,m1[N-1][5],mt,src,pd(),useTk?FPH:0,useTk&&t1>lastT?FPLV:0].join(),key=d.id+"|"+t0,c=VPC.get(key);if(c&&c.sig===sig)return c.P;
  let lo=0,hi=N;while(lo<hi){const m=(lo+hi)>>1;m1[m][0]<t0?lo=m+1:hi=m}
  const U=1e5,I=x=>Math.round(x*U);
  let pmin=Infinity,pmax=-Infinity,cnt=0,i;
  for(i=lo;i<N&&m1[i][0]<t1;i++){const x=m1[i],l=I(x[3]),h=I(x[2]);if(l<pmin)pmin=l;if(h>pmax)pmax=h;cnt++}
  if(!cnt){VPC.set(key,{sig,P:null});return null}
  const tk=vpTick();let k=mt;
  if(k<1){const want=Math.max(1,(pmax-pmin)/U/tk/70),p10=Math.pow(10,Math.floor(Math.log10(want))),m=want/p10;k=(m<=1?1:m<=2?2:m<=5?5:10)*p10}
  let bI=Math.max(1,Math.round(tk*k*U)),bi0=Math.floor(pmin/bI),nL=Math.floor(pmax/bI)-bi0+1;
  if(nL>3000){bI*=Math.ceil(nL/3000);bi0=Math.floor(pmin/bI);nL=Math.floor(pmax/bI)-bi0+1}
  const vol=new Float64Array(nL),ask=new Float64Array(nL),bid=new Float64Array(nL),clamp=(x,a,b)=>x<a?a:x>b?b:x,row=p=>Math.floor(p/bI)-bi0;
  const point=(p,v,fa)=>{const j=row(p);vol[j]+=v;ask[j]+=v*fa;bid[j]+=v*(1-fa)};
  // trải v đều dọc đoạn giá [pa,pb] theo độ dài giao với từng hàng; đoạn đi lên = Ask, đi xuống = Bid
  const seg=(pa,pb,v)=>{const a=Math.min(pa,pb),b=Math.max(pa,pb),len=b-a,up=pb>pa,j0=Math.floor(a/bI),j1=Math.ceil(b/bI)-1;
    for(let j=j0;j<=j1;j++){const r0=j*bI,ov=Math.min(b,r0+bI)-Math.max(a,r0);if(ov<=0)continue;const q=v*ov/len,jj=j-bi0;vol[jj]+=q;(up?ask:bid)[jj]+=q}};
  let totV=0,tkV=0;
  for(i=lo;i<N&&m1[i][0]<t1;i++){
    const x=m1[i],V=x[5]>0?x[5]:0,L=I(x[3]),H=I(x[2]),O=I(x[1]),Cl=I(x[4]),rows=useTk?FPM.get(x[0]):null;let Tm=0;
    if(rows)for(const r of rows)Tm+=r[1]+r[2];
    if(rows&&Tm>0){
      const W=V>0?V:Tm,sc=W/Tm,sp=rows.sp||0;
      for(const r of rows){
        if(r[1]>0){const j=row(clamp(I(r[0]-sp),L,H)),q=r[1]*sc;vol[j]+=q;ask[j]+=q}
        if(r[2]>0){const j=row(clamp(I(r[0]),L,H)),q=r[2]*sc;vol[j]+=q;bid[j]+=q}
      }
      totV+=W;tkV+=W;continue;
    }
    if(!(V>0))continue;totV+=V;
    const pts=Cl>=O?[O,L,H,Cl]:[O,H,L,Cl],ln=[Math.abs(pts[1]-pts[0]),Math.abs(pts[2]-pts[1]),Math.abs(pts[3]-pts[2])],T=ln[0]+ln[1]+ln[2];
    if(T===0){point(O,V,.5);continue}
    for(let q=0;q<3;q++)if(ln[q]>0)seg(pts[q],pts[q+1],V*ln[q]/T);
  }
  // POC: hàng volume lớn nhất; nếu bằng nhau thì lấy hàng gần giữa vùng giá nhất
  let poc=0,pocV=-1;const mid=(nL-1)/2;
  for(let j=0;j<nL;j++){const v=vol[j];if(v>pocV+1e-9||(v>pocV-1e-9&&Math.abs(j-mid)<Math.abs(poc-mid))){pocV=v;poc=j}}
  const P={base:bi0*bI/U,bin:bI/U,n:nL,vol,ask,bid,poc,cov:totV>0?tkV/totV:0};VPC.set(key,{sig,P});if(VPC.size>400)VPC.delete(VPC.keys().next().value);return P}
function vpDerive(d,P){
  const v=P.vol,n=P.n;let tot=0,mx=0,mxD=0;
  for(let i=0;i<n;i++){tot+=v[i];if(v[i]>mx)mx=v[i];const q=Math.abs(P.ask[i]-P.bid[i]);if(q>mxD)mxD=q}
  const tg=tot*Math.min(100,Math.max(1,d.vap==null?70:d.vap))/100;let lo=P.poc,hi=P.poc,s=v[P.poc];
  while(s<tg&&(lo>0||hi<n-1)){const a=(hi+1<n?v[hi+1]:0)+(hi+2<n?v[hi+2]:0),bb=(lo>0?v[lo-1]:0)+(lo>1?v[lo-2]:0);
    if(hi>=n-1||(lo>0&&bb>a)){s+=bb;lo=Math.max(0,lo-2)}else{s+=a;hi=Math.min(n-1,hi+2)}}
  /* HVN (đỉnh) / LVN (đáy): làm mượt, tìm cực trị cục bộ, chỉ giữ node đủ nổi bật */
  const r=3,w=6,sm=new Float64Array(n),nd=new Uint8Array(n),thr=mx*.15,W3=3*w;
  for(let i=0;i<n;i++){let a=0,c=0;for(let j=i-r;j<=i+r;j++)if(j>=0&&j<n){a+=v[j];c++}sm[i]=a/c}
  for(let i=1;i<n-1;i++){let isMax=true,isMin=true;
    for(let j=Math.max(0,i-w);j<=Math.min(n-1,i+w);j++){if(j===i)continue;if(j<i?sm[j]>=sm[i]:sm[j]>sm[i])isMax=false;if(j<i?sm[j]<=sm[i]:sm[j]<sm[i])isMin=false;if(!isMax&&!isMin)break}
    if(isMax&&sm[i]>0){let lm=1e30,rm=1e30;for(let j=Math.max(0,i-W3);j<=i;j++)lm=Math.min(lm,sm[j]);for(let j=i;j<=Math.min(n-1,i+W3);j++)rm=Math.min(rm,sm[j]);
      if(sm[i]-Math.max(lm,rm)>=thr){let p=i;for(let j=Math.max(0,i-2);j<=Math.min(n-1,i+2);j++)if(v[j]>v[p])p=j;nd[p]=1}}
    else if(isMin){let lm=0,rm=0;for(let j=Math.max(0,i-W3);j<=i;j++)lm=Math.max(lm,sm[j]);for(let j=i;j<=Math.min(n-1,i+W3);j++)rm=Math.max(rm,sm[j]);
      if(Math.min(lm,rm)-sm[i]>=thr){let p=i;for(let j=Math.max(0,i-2);j<=Math.min(n-1,i+2);j++)if(v[j]<v[p])p=j;if(!nd[p])nd[p]=2}}}
  return{tot,mx,mxD,vlo:lo,vhi:hi,nd}}
function vpRanges(d){
  const per=d.per||"custom",W=plot()[0],out=[],N=m1.length;if(!N||!n())return out;
  const t00=m1[0][0],t11=m1[N-1][0]+60,len=VPU[d.lu||"d"]*Math.max(1,Math.round(d.ln||1)),cl=(x0,x1)=>({x0:Math.max(0,x0),x1:Math.min(W,x1)});
  if(per==="custom"){const P=geo(d);if(!P)return out;const[a,b]=P,ta=Math.min(d.pts[0].t,d.pts[1].t),tb=Math.max(d.pts[0].t,d.pts[1].t);
    out.push({t0:ta,t1:tb+C.tf,x0:Math.min(a[0],b[0]),x1:Math.max(a[0],b[0]),fr:true});return out}
  const lr=ts.getVisibleLogicalRange();if(!lr)return out;
  const vt0=Math.max(t00,l2s(Math.max(0,lr.from))),vt1=Math.min(t11,l2s(lr.to)+C.tf);
  if(per==="visible")out.push({t0:vt0,t1:vt1,x0:0,x1:W});
  else if(per==="comp")out.push({t0:t00,t1:t11,...cl(X({t:t00}),X({t:t11}))});
  else if(per==="latest"){const s0=bucket(m1[N-1][0],len);out.push({t0:s0,t1:s0+len,...cl(X({t:s0}),X({t:s0+len}))})}
  else{for(let p=bucket(vt0,len);p<vt1&&out.length<80;p+=len)out.push({t0:p,t1:p+len,...cl(X({t:p}),X({t:p+len}))})}
  return out}
const vpFmt=v=>v>=1e6?(v/1e6).toFixed(1)+"M":v>=1e3?(v/1e3).toFixed(1)+"k":String(Math.round(v));
function drawVP(d){
  const R=vpRanges(d);d._b=null;if(!R.length)return;
  const E=COL(),g=(k,x)=>d[k]==null?x:d[k],per=d.per||"custom",H=plot()[1],dg=pd(),side=per==="custom"||per==="multi";
  const ty=g("ty","vol"),wp=g("wp",side?.7:.3),sd=g("sd",side?"l":"r"),fo=g("fo",.6),pe=g("pe",true),ve=g("ve",true),vl=g("vl",true);
  const c1=g("c1","#98a2d8"),vc=g("vc","#35b6ff"),ca=g("ca",E.up),cb=g("cb",E.dn),pc=g("pc","#ffb02e"),hc=g("hc","#b388ff"),lc=g("lc","#ffd24a");
  let bx0=1e9,by0=1e9,bx1=-1e9,by1=-1e9;const ext=(x0,y0,x1,y1)=>{bx0=Math.min(bx0,x0);by0=Math.min(by0,y0);bx1=Math.max(bx1,x1);by1=Math.max(by1,y1)};
  ctx.save();ctx.setLineDash([]);ctx.textBaseline="middle";
  R.forEach(r=>{
    const P=vpCalc(d,r.t0,r.t1);if(!P)return;const S=vpDerive(d,P),fx0=r.x0,fx1=r.x1,fw=fx1-fx0;if(fw<6||S.mx<=0)return;
    const pa=P.base,pb=P.base+P.n*P.bin,ya=cs.priceToCoordinate(pa),yb=cs.priceToCoordinate(pb);if(ya==null||yb==null||ya===yb)return;
    const Yp=p=>ya+(p-pa)*(yb-ya)/(pb-pa),maxW=fw*wp,dir=sd==="r"?-1:1,ax=sd==="r"?fx1:fx0,cx=ax+dir*maxW/2,half=maxW/2;
    const rowH=Math.abs(Yp(pa+P.bin)-Yp(pa)),gap=rowH>4?1:0,yTop=Math.min(ya,yb),yBot=Math.max(ya,yb);
    ext(fx0,yTop,fx1,yBot);
    if(g("cv",true)){ctx.save();ctx.font=font(10);ctx.textAlign="left";ctx.fillStyle=hexA(ink(),.55);ctx.fillText(d.src==="m1"||P.cov<=0?"M1":P.cov>=.995?"Tick":"Tick "+Math.round(P.cov*100)+"%",fx0+4,Math.max(yTop,0)+8);ctx.restore()}
    const yVAH=Yp(pa+(S.vhi+1)*P.bin),yVAL=Yp(pa+S.vlo*P.bin);
    if(ve){ctx.fillStyle=hexA(vc,.07);ctx.fillRect(fx0,Math.min(yVAH,yVAL),fw,Math.abs(yVAL-yVAH))}
    if(r.fr&&d===sel){ctx.strokeStyle="rgba(152,162,216,.6)";ctx.lineWidth=1;ctx.setLineDash([4,4]);ctx.strokeRect(fx0,yTop,fw,yBot-yTop);ctx.setLineDash([])}
    for(let i=0;i<P.n;i++){const v=P.vol[i];if(v<=0)continue;const yt=Yp(pa+(i+1)*P.bin),yu=Yp(pa+i*P.bin),y=Math.min(yt,yu),h=Math.abs(yu-yt);if(y+h<-2||y>H+2)continue;const hh=Math.max(1,h-gap);
      const inVA=i>=S.vlo&&i<=S.vhi,isPoc=i===P.poc&&pe,nd=S.nd[i],hv=nd===1&&g("hv",true),lv=nd===2&&g("lv",true),vcol=isPoc?pc:inVA&&ve?vc:c1,va=fo+(inVA?.1:0);
      let tip=0;                                   // độ dài thanh volume (để đặt dấu HVN/LVN ngay đầu thanh)
      if(ty==="vol"){tip=v/S.mx*maxW;ctx.fillStyle=hexA(vcol,va);ctx.fillRect(dir>0?ax:ax-tip,y,tip,hh)}
      else if(ty==="ab"){tip=v/S.mx*maxW;const bw=tip*P.bid[i]/v,aw=tip-bw;ctx.fillStyle=hexA(cb,fo+.1);ctx.fillRect(dir>0?ax:ax-bw,y,bw,hh);ctx.fillStyle=hexA(ca,fo+.1);ctx.fillRect(dir>0?ax+bw:ax-bw-aw,y,aw,hh);
        if(isPoc){ctx.strokeStyle=pc;ctx.lineWidth=1.5;ctx.strokeRect(dir>0?ax:ax-tip,y,tip,hh)}}
      else{const dl=P.ask[i]-P.bid[i],dw=S.mxD?Math.abs(dl)/S.mxD*half:0;ctx.fillStyle=hexA(dl>=0?ca:cb,fo+.15);
        if(ty==="dl"){ctx.fillRect(dl>=0?cx:cx-dw,y,dw,hh);tip=maxW}
        else{ctx.fillRect(cx-dw,y,dw,hh);const vw=v/S.mx*half;ctx.fillStyle=hexA(vcol,va);ctx.fillRect(cx,y,vw,hh);tip=maxW}}
      if(hv||lv){ctx.fillStyle=hv?hc:lc;const ex=ty==="vol"||ty==="ab"?ax+dir*tip:ax+dir*maxW;ctx.fillRect(dir>0?ex+2:ex-6,y,4,hh)}
      if(g("nm",false)&&hh>=11){ctx.font=font(10);ctx.fillStyle=ink();ctx.textAlign=dir>0?"left":"right";const ex=(ty==="vol"||ty==="ab"?ax+dir*tip:ax+dir*maxW)+dir*(hv||lv?10:5),dl=P.ask[i]-P.bid[i];
        ctx.fillText(ty==="dl"?vpFmt(dl):ty==="dv"?vpFmt(dl)+" | "+vpFmt(v):vpFmt(v),ex,y+hh/2)}}
    if(ty==="dl"||ty==="dv"){ctx.strokeStyle=hexA(ink(),.25);ctx.lineWidth=1;seg([cx,yTop],[cx,yBot])}
    const yPoc=Yp(pa+(P.poc+.5)*P.bin);
    if(pe){ctx.strokeStyle=pc;ctx.lineWidth=1.5;seg([fx0,yPoc],[fx1,yPoc])}
    if(vl){ctx.strokeStyle=vc;ctx.lineWidth=1;ctx.setLineDash([6,4]);seg([fx0,yVAH],[fx1,yVAH]);seg([fx0,yVAL],[fx1,yVAL]);ctx.setLineDash([])}
    if(vl||pe){ctx.font=font(10,1);ctx.textAlign="right";const L=(t,p,y,col,dy)=>{ctx.fillStyle=col;ctx.fillText(t+" "+p.toFixed(dg),fx1-4,y+dy)};
      if(vl){L("VAH",pa+(S.vhi+1)*P.bin,yVAH,vc,-7);L("VAL",pa+S.vlo*P.bin,yVAL,vc,10)}if(pe)L("POC",pa+(P.poc+.5)*P.bin,yPoc,pc,vl&&Math.abs(yPoc-yVAH)<14?14:-7)}
  });
  ctx.restore();
  if(isFinite(bx0))d._b=[bx0,by0,bx1-bx0,by1-by0];
  if(per==="custom"&&d===sel&&!d.lk)hnd(d).forEach(h=>{ctx.setLineDash([]);ctx.lineWidth=1.5;ctx.fillStyle="#fff";ctx.strokeStyle="#2962ff";ctx.beginPath();ctx.arc(h[0],h[1],tl>1?8:5,0,7);ctx.fill();ctx.stroke()})}
/* cài đặt Volume Profile: chỉ 2 tab (Profile / Kiểu dáng) + khung thời gian hiển thị */
function vpTab(tab,d,h){const{R,CX,CB,SE,NU,OP}=h,side=!d.per||d.per==="custom"||d.per==="multi",legacy=!!d.per&&d.per!=="custom";
  if(tab==="g")return`<p class="msg" style="margin:0 0 6px">Tổng volume lấy từ tick volume của nến M1. Phân bổ vào từng mức giá theo tick thật nếu có (bật Footprint, Big Trade hoặc Statistic để tải tick), nếu không thì theo đường đi của giá trong nến. Ask/Bid và Delta là ước lượng.</p>`+
    R("Nguồn phân bổ volume",SE("src",[["auto","Tự động (tick nếu có)"],["m1","Chỉ nến M1"]],"auto"))+
    R("Loại profile",SE("ty",[["vol","Volume"],["ab","Ask / Bid"],["dl","Delta"],["dv","Delta + Volume"]],"vol"))+
    (legacy?R("Phạm vi",SE("per",[["custom","Vùng đã vẽ"],["visible","Đang hiển thị"],["comp","Toàn bộ dữ liệu"],["latest","Chu kỳ mới nhất"],["multi","Mỗi chu kỳ một profile"]],"custom")):"")+
    (legacy&&["latest","multi"].includes(d.per)?R("Chu kỳ",NU("ln",1)+SE("lu",[["h","Giờ"],["d","Ngày"],["w","Tuần"]],"d")):"")+
    R("Số tick mỗi hàng (0 = tự động)",NU("mt",0))+R("Value Area (%)",NU("vap",70));
  if(tab==="s")return CX("pe","Đường POC",true,CB("pc","#ffb02e"))+CX("ve","Value Area + VAH / VAL",true,CB("vc","#35b6ff"))+CX("hv","Đánh dấu HVN",true,CB("hc","#b388ff"))+CX("lv","Đánh dấu LVN",true,CB("lc","#ffd24a"))+CX("nm","Hiện số trên thanh",false)+CX("cv","Hiện nguồn dữ liệu (Tick / M1)",true)+
    R("Bề rộng (% vùng)",`<input type="range" data-f="wp" min="10" max="100" value="${Math.round((d.wp==null?(side?.7:.3):d.wp)*100)}">`)+
    R("Vị trí",SE("sd",[["l","Bám trái"],["r","Bám phải"]],side?"l":"r"))+
    R("Màu thanh",CB("c1","#98a2d8"))+R("Màu mua / bán",CB("ca",COL().up)+CB("cb",COL().dn))+R("Độ phủ",OP("fo",.6));
  return""}

function draw(d){if(d.k==="vp")return drawVP(d);const P=geo(d);if(!P)return;const c=col(d),[a,b]=P,E=COL(),W=plot()[0],k=d.k;
  ctx.lineWidth=d.w||2;ctx.strokeStyle=c;ctx.fillStyle=c;ctx.setLineDash(DS[d.ls]||[]);ctx.textBaseline="middle";ctx.font=font(12);
  if(k==="trend"){const ex=d.ex===true?"r":d.ex||"n",lo=a[0]<=b[0]?a:b,hi=lo===a?b:a,mid=[(lo[0]+hi[0])/2,(lo[1]+hi[1])/2];let L1=lo,R1=hi;
    if(hi[0]!==lo[0]){const m=(hi[1]-lo[1])/(hi[0]-lo[0]),yy=x=>lo[1]+m*(x-lo[0]);if(ex==="l"||ex==="b")L1=[0,yy(0)];if(ex==="r"||ex==="b")R1=[W,yy(W)]}
    tline(d,lo,hi,mid,L1,R1);ctx.setLineDash([]);if(d.s1==="a")arrow(a,b,c);if(d.e1==="a")arrow(b,a,c);
    if(d.mp){ctx.fillStyle=c;ctx.beginPath();ctx.arc(mid[0],mid[1],3.5,0,7);ctx.fill()}
    if(d.pl){ctx.font=font(12,1);ctx.fillStyle=c;ctx.textAlign="right";ctx.fillText(d.pts[lo===a?0:1].p.toFixed(pd()),lo[0]-8,lo[1]);ctx.textAlign="left";ctx.fillText(d.pts[lo===a?1:0].p.toFixed(pd()),hi[0]+8,hi[1])}
    if(d.st==="v"&&(d.as||d===sel)){const dp=d.pts[1].p-d.pts[0].p,bars=Math.round(s2l(d.pts[1].t)-s2l(d.pts[0].t)),ang=Math.round(Math.atan2(-(b[1]-a[1]),b[0]-a[0])*180/Math.PI),sp=d.sp||"r",ax=sp==="l"?lo:sp==="r"?hi:mid;
      pill(dp.toFixed(pd())+" ("+(dp/d.pts[0].p*100).toFixed(2)+"%)  "+bars+" "+dl("nến","bars","根")+"  "+ang+"°",ax[0],ax[1]+22,"#2b3270")}
    if(d.x){const fs=d.fs||14,ha=d.ha||"r",va=d.va||"t",A=ha==="l"?lo:ha==="c"?mid:hi,ang=hi[0]===lo[0]?-Math.PI/2:Math.atan2(hi[1]-lo[1],hi[0]-lo[0]);
      ctx.save();ctx.translate(A[0],A[1]);ctx.rotate(ang);ctx.font=font(fs,d.b,d.i);ctx.fillStyle=d.tc||c;ctx.textAlign=ha==="l"?"left":ha==="c"?"center":"right";ctx.textBaseline=va==="t"?"bottom":va==="b"?"top":"middle";ctx.fillText(d.x,0,va==="t"?-5:va==="b"?5:0);ctx.restore()}}
  else if(k==="hline"||k==="vline"){if(k==="hline"){seg([0,a[1]],[W,a[1]]);ctx.setLineDash([]);ctx.font=font(12,1);ctx.textAlign="right";ctx.fillText(d.pts[0].p.toFixed(pd()),W-6,a[1]-9)}else seg([a[0],0],[a[0],plot()[1]])}
  else if(k==="chan"){const dy=cdy(d,a),pa=[a[0],a[1]+dy],pb=[b[0],b[1]+dy];if(d.bg!==false){ctx.fillStyle=hexA(d.fc||c,fo(d,.08));ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.lineTo(pb[0],pb[1]);ctx.lineTo(pa[0],pa[1]);ctx.fill()}
    seg(a,b);seg(pa,pb);ctx.setLineDash(DS.d);ctx.lineWidth=1;seg([(a[0]+pa[0])/2,(a[1]+pa[1])/2],[(b[0]+pb[0])/2,(b[1]+pb[1])/2])}
  else if(k==="rect"||k==="ell"){ctx.fillStyle=hexA(d.fc||c,fo(d,k==="rect"?.15:.12));
    if(k==="rect"){if(d.bg!==false)ctx.fillRect(a[0],a[1],b[0]-a[0],b[1]-a[1]);ctx.strokeRect(a[0],a[1],b[0]-a[0],b[1]-a[1])}
    else{ctx.beginPath();ctx.ellipse((a[0]+b[0])/2,(a[1]+b[1])/2,Math.abs(b[0]-a[0])/2||.1,Math.abs(b[1]-a[1])/2||.1,0,0,7);if(d.bg!==false)ctx.fill();ctx.stroke()}}
  else if(k==="fib"){const fl=(d.fl||FIBD).filter(q=>q[0]),r=d.rv,pA=d.pts[r?0:1].p,pB=d.pts[r?1:0].p,py=v=>pA+(pB-pA)*v,ex=d.ex===true?"r":d.ex||"n";let x0=Math.min(a[0],b[0]),x1=Math.max(a[0],b[0]);if(ex==="l"||ex==="b")x0=0;if(ex==="r"||ex==="b")x1=W;
    const S=fl.map(q=>[q[1],d.uo?d.oc||c:q[2],cs.priceToCoordinate(py(q[1])),py(q[1])]).sort((m,n)=>m[0]-n[0]),lh=d.lh||"l",lv=d.lv2||"t";
    if(d.bg!==false)S.forEach((q,i)=>{if(i){ctx.fillStyle=hexA(q[1],fo(d,.08));ctx.fillRect(x0,S[i-1][2],x1-x0,q[2]-S[i-1][2])}});
    ctx.lineWidth=d.lw||1;S.forEach(q=>{ctx.setLineDash(DS[d.ls]||[]);ctx.strokeStyle=q[1];seg([x0,q[2]],[x1,q[2]]);ctx.setLineDash([]);
      if(d.lb!==false){ctx.font=font(d.fs||12);ctx.fillStyle=q[1];ctx.textAlign=lh==="r"?"right":"left";ctx.textBaseline="middle";ctx.fillText((d.lm==="p"?+(q[0]*100).toFixed(2)+"%":q[0])+(d.pr===false?"":" ("+q[3].toFixed(pd())+")"),lh==="r"?x1-4:x0+4,q[2]+(lv==="t"?-8:lv==="b"?8:0))}});
    if(d.tl!==false){ctx.strokeStyle=d.tc2||"#98a2d8";ctx.lineWidth=1;ctx.setLineDash(DS[d.tls===undefined?"d":d.tls]||[]);seg(a,b)}}
  else if(k==="long"||k==="short"){const I=posI(d),x0=a[0],x1=P[1][0],yT=P[1][1],yS=P[2][1],yE=a[1],w=x1-x0,pc=d.pc||E.up,sc=d.sc||E.dn,fm=v=>Math.round(v).toLocaleString("en-US"),pct=v=>(v/I.e*100).toFixed(3);
    ctx.fillStyle=hexA(pc,fo(d,.2));ctx.fillRect(x0,yE,w,yT-yE);ctx.fillStyle=hexA(sc,fo(d,.2));ctx.fillRect(x0,yE,w,yS-yE);
    ctx.lineWidth=1.5;ctx.strokeStyle=pc;seg([x0,yT],[x1,yT]);ctx.strokeStyle=sc;seg([x0,yS],[x1,yS]);ctx.strokeStyle=c;ctx.lineWidth=2;seg([x0,yE],[x1,yE]);
    pill(dl("Mục tiêu","Target","目标")+": "+I.t.toFixed(pd())+" ("+pct(I.t)+"%) "+fm(I.t/I.tk)+", "+dl("Số tiền","Amount","金额")+": "+(I.qty*I.t).toFixed(2),x0+w/2,yT+(yT<yE?-14:14),pc);
    pill(dl("Cắt lỗ","Stop","止损")+": "+I.s.toFixed(pd())+" ("+pct(I.s)+"%) "+fm(I.s/I.tk)+", "+dl("Số tiền","Amount","金额")+": "+(I.qty*I.s).toFixed(2),x0+w/2,yS+(yS>yE?14:-14),sc);
    pill(dl("Lãi/lỗ đang mở","Open PnL","浮动盈亏")+": "+I.pnl.toFixed(2)+", "+dl("Khối lượng","Qty","数量")+": "+I.qty+", "+dl("Tỷ lệ R:R","Risk/reward ratio","盈亏比")+": "+I.rr.toFixed(2),x0+w/2,yE,"#2962ff")}
  else{const fs=d.fs||14,t=d.x||dl("Văn bản","Text","文字");ctx.font=font(fs,d.b,d.i);ctx.textAlign="left";const w=ctx.measureText(t).width;
    if(k==="note"){const bw=w+18,bh=fs+16,bx=a[0],by=a[1]-bh-8;ctx.fillStyle=hexA(c,.95);ctx.beginPath();ctx.roundRect(bx,by,bw,bh,8);ctx.fill();ctx.fillStyle=d.tc||"#2a2000";ctx.fillText(t,bx+9,by+bh/2+1);ctx.fillStyle=c;ctx.beginPath();ctx.arc(a[0],a[1],4,0,7);ctx.fill();d._b=[bx,by,bw,bh]}
    else{ctx.fillText(t,a[0],a[1]);d._b=[a[0],a[1]-fs/2-3,w,fs+6]}}
  if(!["trend","text","note","hline","vline"].includes(k)&&d.x)boxTxt(d,P);if(d===sel&&!d.lk)hnd(d).forEach(h=>{if(k==="long"||k==="short")sq(h);else{ctx.setLineDash([]);ctx.lineWidth=1.5;ctx.fillStyle="#fff";ctx.strokeStyle="#2962ff";ctx.beginPath();ctx.arc(h[0],h[1],tl>1?8:5,0,7);ctx.fill();ctx.stroke()}})}
function hnd(d){const P=geo(d);if(!P)return[];if(d.k==="vp"&&d.per&&d.per!=="custom")return[];if(d.k==="text"||d.k==="note")return[[P[0][0],P[0][1],0]];if(d.k==="long"||d.k==="short")return[[P[0][0],P[0][1],0],[P[1][0],P[1][1],1],[P[1][0],P[2][1],2],[P[1][0],P[0][1],3]];if(d.k==="rect"||d.k==="ell"){const[a,b]=P,mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2;return[[a[0],a[1],0],[b[0],b[1],1],[b[0],a[1],2],[a[0],b[1],3],[mx,Math.min(a[1],b[1]),4],[mx,Math.max(a[1],b[1]),5],[Math.min(a[0],b[0]),my,6],[Math.max(a[0],b[0]),my,7]]}if(d.k==="chan"){const dy=cdy(d,P[0]);return[...P.map((q,i)=>[q[0],q[1],i]),[(P[0][0]+P[1][0])/2,(P[0][1]+P[1][1])/2+dy,2]]}return P.map((q,i)=>[q[0],q[1],i])}
