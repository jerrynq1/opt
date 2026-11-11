/* ===== Orderflow: Footprint (indicator "fpr") ===== */
const FPM=new Map();let FPV=0,FPH=0,FPLV=0,fpSym="",fpLast=0,fpBusy=false,fpEpoch=0,fpRetry=0,fpStart=0,fpCov=null,fpGap=0;
/* Gộp hàng giá bằng SỐ NGUYÊN (đơn vị 1/100000) để không bị sai số số thực ở biên hàng: hàng q phủ khoảng giá [q*step, (q+1)*step). Dùng chung cho Footprint / Big Trade / Statistic. */
/* Chữ ký dữ liệu các phút của 1 nến = [mảng dữ liệu, độ dài, ...]. Cache của nến phải kiểm tra thêm chữ ký này: phút cuối của một nến có thể được chốt
   SAU khi nến đã đóng (tick cuối chờ gộp cùng ms, chuỗi Big Trade chốt sau khi nghỉ quá gap), nếu chỉ dựa vào FPH thì nến vừa đóng giữ số liệu cũ mãi. */
const fpSigOk=(c,p,M)=>{const R=c[p];if(!R)return false;for(let k=0,t=c.st;t<c.st+C.tf&&t<Infinity;t+=60,k+=2){const v=M.get(t);if(R[k]!==v||R[k+1]!==(v?v.length:0))return false}return true};
const fpSigSet=(c,p,M)=>{const R=[];for(let t=c.st;t<c.st+C.tf&&t<Infinity;t+=60){const v=M.get(t);R.push(v,v?v.length:0)}c[p]=R};
const FPU=1e5,fpSI=step=>Math.max(1,Math.round(step*FPU));
const fpQ=(p,step)=>Math.floor(Math.round(p*FPU)/fpSI(step));      // chỉ số hàng chứa giá p
const fpYp=(q,step)=>(q+.5)*fpSI(step)/FPU;                         // giá ở tâm hàng q (để vẽ)
const fpOn=()=>ACT.find(x=>x.key==="fpr"&&isOn(x)),btOn=()=>ACT.find(x=>x.key==="bt"&&isOn(x));
// TPO can consume the same cTrader quote rows without enabling the visual Footprint indicator.
const tpoOn=()=>typeof TPO!=="undefined"&&!!TPO.options.enabled;
const fpRgb=h=>{const m=/^#?([0-9a-f]{6})$/i.exec(h||"");const n=m?parseInt(m[1],16):8421504;return(n>>16)+","+((n>>8)&255)+","+(n&255)};
const fpFm=v=>{const a=Math.abs(v);return(v<0?"-":"")+(a>=1e4?(a/1e3).toFixed(1)+"K":Math.round(a))};
const btGap=()=>{const b=btOn();return b?Math.max(50,Math.min(5000,Math.round(+b.p.gap)||300)):300};   // khoảng nghỉ tối đa (ms) giữa 2 tick của 1 chuỗi Big Trade
async function fpSync(){
  const a=fpOn()||btOn()||stOn()||haOn()||domVpOn()||tpoOn();if(!a||SUB()||fpBusy||!ctReady()||!m1.length||Date.now()<fpRetry)return;fpBusy=true;const gp=btGap();
  try{
    if(fpSym!==C.sym||fpEpoch!==CT.epoch||fpGap!==gp){FPM.clear();BTE.clear();fpSym=C.sym;fpEpoch=CT.epoch;fpGap=gp;BTG.gap=gp;fpLast=0;fpStart=0;fpCov=null;FPH++;ctFpReset()}
    const ok=()=>C.sym===fpSym&&fpEpoch===CT.epoch&&btGap()===fpGap&&ctReady();
    /* Tick tải THEO NHU CẦU, giống nến M1: chỉ tải tới nến trái nhất đang nhìn thấy (fpNeed), kéo chart sang trái thì tải thêm phần cũ hơn.
       Lần tải đầu: tick lịch sử theo từng cửa sổ MỚI -> CŨ (2 giờ, 4 giờ, 6 giờ/lần). Cửa sổ nào về là vẽ footprint ngay (FPV++).
       Cửa sổ mới nhất kết thúc ở "bây giờ" và chuyển sang chế độ live (nối tiếp từ tick cuối, không trùng, không hở). */
    const first=!fpLast,now=Date.now();
    let hi=first?now:fpStart*1000,lo0;
    if(first){lo0=Math.floor(fpNeed()/6e4)*6e4;fpStart=Math.floor(lo0/1000);status("Đang tải tick footprint…","")}
    else{
      const need=Math.floor(fpNeed()/6e4)*6e4;
      if(need>=hi-6e4)return;                               // đã đủ tick cho vùng đang xem
      lo0=Math.max(fpCap(),Math.floor(Math.min(need,hi-3600e3)/6e4)*6e4);   // tải thêm tối thiểu 1 giờ/lần để kéo chart không bị tải vụn
      if(lo0>=hi)return;
      status("Đang tải thêm tick footprint…","");
    }
    let span=first?2*3600e3:3*3600e3,isFirst=first;
    for(;;){
      const lo=Math.max(lo0,Math.floor((hi-span)/6e4)*6e4);
      await ctFpWindow(lo,isFirst?hi:hi-1,isFirst);
      if(!ok())return;                                      // đổi mã / nối lại giữa chừng: bỏ, lần sau tải lại từ đầu
      fpStart=Math.floor(lo/1000);FPV++;FPH++;fpCov=null;dirty=true;isFirst=false;
      hi=lo;span=Math.min(span*2,3*3600e3);
      if(lo<=lo0)break;
    }
    if(first)fpLast=Math.floor(now/1000);
    status(m1.length+" nến M1 · cTrader","ok");
  }catch(e){fpRetry=Date.now()+10000;status("Lỗi tải tick footprint: "+why(e),"bad")}
  finally{fpBusy=false}
}
/* Tick nặng hơn nến nhiều, nên có trần an toàn: không tải quá FP_MAXD ngày gần nhất dù kéo chart xa tới đâu. */
const FP_MAXD=3;      // trước là 14: tick 14 ngày làm tải rất lâu + tính toán nặng. Cần xem xa hơn thì tăng số này (đổi ?v= trong index.html)
const fpCap=()=>Math.floor((Date.now()-FP_MAXD*86400e3)/6e4)*6e4;
// mốc (ms UTC) cũ nhất cần có tick = nến trái nhất đang nhìn thấy (m1/agg là giờ server nên đổi lại UTC bằng s2u)
function fpNeed(){
  const lr=chart.timeScale().getVisibleLogicalRange(),b=agg.length?agg[Math.min(agg.length-1,lr?Math.max(0,Math.floor(lr.from)):0)]:null;
  return b?Math.max(fpCap(),s2u(b.st)*1000):Date.now();
}
setInterval(fpSync,2000);
/* Gom số liệu footprint của 1 nến: lv = Map(hàng -> [bán,mua]), POC, POC delta, Value Area (phương pháp CME), Imbalance chéo + Stacked.
   Cache theo phiên bản dữ liệu: nến cũ chỉ tính lại khi nạp thêm lịch sử (FPH) hoặc đổi cài đặt; chỉ nến cuối mới tính lại theo từng tick live (FPLV). */
function fpCandle(c,step,Q){
  const vap=Q.vap,ratio=Q.ratio,imv=Math.max(0,+Q.imv||0),stk=Math.max(0,Math.round(+Q.stk||0));
  const last=agg.length&&c===agg[agg.length-1],key=[step,FPH,vap,ratio,imv,stk,last?FPLV:0].join("|");if(c._fk===key&&fpSigOk(c,"_fs",FPM))return c._fl;
  fpSigSet(c,"_fs",FPM);const lv=new Map();let tot=0;
  for(let t=c.st;t<c.st+C.tf&&t<Infinity;t+=60){const r=FPM.get(t);if(!r)continue;for(const [p,b,s] of r){const q=fpQ(p,step);let e=lv.get(q);if(!e){e=[0,0];lv.set(q,e)}e[0]+=s;e[1]+=b}}
  let lo=1e12,hi=-1e12,mxs=1,mxt=1,mxd=1;
  for(const [q,e] of lv){if(q<lo)lo=q;if(q>hi)hi=q;const t=e[0]+e[1],d=Math.abs(e[1]-e[0]);tot+=t;mxs=Math.max(mxs,e[0],e[1]);mxt=Math.max(mxt,t);mxd=Math.max(mxd,d)}
  // POC: hàng volume lớn nhất; nếu bằng nhau thì lấy hàng gần giữa nến nhất (không thiên về hàng thấp nhất). POC delta tương tự theo |delta|
  const mid=(fpQ(c.high,step)+fpQ(c.low,step))/2;let poc=null,pm=-1,dpoc=null,dm=-1;
  for(const [q,e] of lv){const t=e[0]+e[1],d=Math.abs(e[1]-e[0]);
    if(t>pm||(t===pm&&Math.abs(q-mid)<Math.abs(poc-mid))){pm=t;poc=q}
    if(d>dm||(d===dm&&Math.abs(q-mid)<Math.abs(dpoc-mid))){dm=d;dpoc=q}}
  // Value Area theo CME: từ POC, mỗi bước so tổng 2 hàng phía trên với tổng 2 hàng phía dưới, thêm bên lớn hơn, đến khi đủ vap% tổng volume
  let vl=poc,vh=poc;
  if(poc!=null){
    const g=q=>{const e=lv.get(q);return e?e[0]+e[1]:0};let sm=g(poc);const need=tot*vap/100;
    while(sm<need&&(vl>lo||vh<hi)){
      const nu=Math.min(2,hi-vh),nd=Math.min(2,vl-lo);let su=0,sd=0;
      for(let k=1;k<=nu;k++)su+=g(vh+k);for(let k=1;k<=nd;k++)sd+=g(vl-k);
      if(nu&&(su>=sd||!nd)){vh+=nu;sm+=su}else{vl-=nd;sm+=sd}
    }
  }
  // Imbalance chéo: MUA tại hàng q so với BÁN tại hàng q-1; BÁN tại hàng q so với MUA tại hàng q+1. Cần ≥ ratio lần và ≥ imv volume.
  // Stacked: từ stk hàng LIÊN TIẾP trở lên cùng một phía imbalance. imb: hàng -> [muaImb, bánImb, muaStacked, bánStacked]
  const imb=new Map();
  for(const [q,e] of lv){
    const dn=lv.get(q-1),up=lv.get(q+1);
    imb.set(q,[e[1]>0&&e[1]>=imv&&e[1]>=ratio*Math.max(dn?dn[0]:0,1),e[0]>0&&e[0]>=imv&&e[0]>=ratio*Math.max(up?up[1]:0,1),false,false]);
  }
  if(stk>1)for(const k of [0,1]){
    let run=0;
    const mark=(from,to)=>{if(to-from+1>=stk)for(let q=from;q<=to;q++)imb.get(q)[k+2]=true};
    for(let q=lo;q<=hi+1;q++){const m=imb.get(q);if(m&&m[k]){if(!run)run=q;}else{if(run)mark(run,q-1);run=0}}
  }
  c._fk=key;return c._fl={lv,lo,hi,mxs,mxt,mxd,poc,dpoc,vl,vh,imb,tot};
}
/* Độ phủ dữ liệu: bao nhiêu % phút có nến M1 (có volume) trong khoảng đã chọn thì có số liệu footprint. Thấp = broker không lưu đủ tick lịch sử, hoặc tải bị cắt. */
function fpCoverage(){
  const key=FPH+"|"+FPLV+"|"+m1.length;if(fpCov&&fpCov.k===key)return fpCov;
  let n=0,ok=0;
  for(let i=m1.length-2;i>=0;i--){const x=m1[i];if(x[0]<fpStart)break;if(!(x[5]>0))continue;n++;if(FPM.has(x[0]))ok++}
  return fpCov={k:key,n,ok,pct:n?ok/n*100:100};
}
function drawFP(w,h){
  const a=fpOn();let show=false;
  const lr=a&&agg.length?ts.getVisibleLogicalRange():null;
  if(lr){
    const Q=Object.assign(pdef(IND.fpr),a.p),base=Math.max(.0001,+Q.step||.5),i0=Math.max(0,Math.floor(lr.from)-1),i1=Math.min(agg.length-1,Math.ceil(lr.to)+1);
    const xa=ts.logicalToCoordinate(i0),xb=ts.logicalToCoordinate(i0+1),bs=xa!=null&&xb!=null?xb-xa:0;
    const last=agg[agg.length-1].close,pa=cs.priceToCoordinate(last),pb=cs.priceToCoordinate(last+base),rhB=pa!=null&&pb!=null?Math.abs(pa-pb):0;
    let kk=1;if(Q.auto!==false)for(const m of [1,2,5,10,20,50,100,200,500,1000]){kk=m;if(rhB*m>=10)break}   // gộp hàng cho tới khi mỗi hàng cao ≥ 10px
    const step=base*kk,rh=rhB*kk;
    show=bs>=26&&rh>=5;                                   // zoom đủ gần mới hiện ô, nếu không thì giữ nến thường
    if(show){
      const E=eff(),cA=cres(a,0),cB=cres(a,1),cP=a.c[2]||"#ffd700",A=fpRgb(cA),B=fpRgb(cB),ty=Q.ty,two=ty==="ab",prof=Q.md==="prof",tx=ink(),fs=Math.min(rh-2,11.5),txt=rh>=9,bw=Math.min(8,bs*.12),mono="Consolas,ui-monospace,Menlo,monospace";
      const fm=v=>{const x=Math.abs(v);if(Q.fmt==="n")return String(Math.round(x));if(Q.fmt==="k")return x>=1e3?(x/1e3).toFixed(1)+"K":String(Math.round(x));return x>=1e6?(x/1e6).toFixed(1)+"M":x>=1e4?(x/1e3).toFixed(1)+"K":String(Math.round(x))};
      const sg=v=>(v>0?"+":v<0?"-":"")+fm(v);
      const ia=(x,imb)=>Q.cm==="fade"?(Q.cc==="imb"?(imb?1:.15):.12+.88*Math.min(1,x)):(Q.cc==="imb"?(imb?1:.3):.8);
      ctx.textBaseline="middle";
      for(let i=i0;i<=i1;i++){
        const c=agg[i],xc=ts.logicalToCoordinate(i);if(xc==null)continue;
        const x0=xc-bs/2+2,cx=x0+bw/2,xs=x0+bw+2,cwid=bs-bw-(bs<40?4:6),hw=cwid/2,col=c.close>=c.open?E.up:E.dn;
        const yo=cs.priceToCoordinate(c.open),yc=cs.priceToCoordinate(c.close),yh=cs.priceToCoordinate(c.high),yl=cs.priceToCoordinate(c.low);
        if(yo==null||yc==null||yh==null||yl==null)continue;
        ctx.strokeStyle=col;ctx.beginPath();ctx.moveTo(cx,yh);ctx.lineTo(cx,yl);ctx.stroke();
        ctx.fillStyle=col;ctx.fillRect(x0,Math.min(yo,yc),bw,Math.max(1,Math.abs(yo-yc)));
        const F=fpCandle(c,step,Q);if(!F.lv.size)continue;
        const ln=two?fm(F.mxs).length:ty==="vol"?fm(F.mxt).length:ty==="dl"?fm(F.mxd).length+1:Math.max(fm(F.mxd).length+1,fm(F.mxt).length),fit=((two||ty==="dv")?hw-3:cwid-4)/(ln*.62),tOK=txt&&fit>=6.5,fz=Math.min(fs,fit);
        for(let q=F.lo;q<=F.hi;q++){
          const y=cs.priceToCoordinate(fpYp(q,step));if(y==null||y<-rh||y>h+rh)continue;
          const e=F.lv.get(q),yt=y-rh/2+.5,hg=Math.max(1,rh-1);
          if(!e){if(tOK&&Q.zero){ctx.globalAlpha=.45;ctx.fillStyle=tx;ctx.font=fz+"px "+mono;ctx.textAlign="center";ctx.fillText("0",xs+hw,y+1);ctx.globalAlpha=1}continue}
          const s=e[0],b=e[1],t=s+b,d=b-s,dim=(!Q.va||(q>=F.vl&&q<=F.vh))?1:(Q.vaout?.4:1);
          const im=F.imb.get(q),bi=im[0],si=im[1];
          if(Q.cm!=="none"){
            const rc=(x,wd,cl,al)=>{if(wd<=0)return;ctx.fillStyle=`rgba(${cl},${Math.min(1,al*Q.op*dim)})`;ctx.fillRect(x,yt,wd,hg)};
            if(two){
              const ai=ia(b/F.mxs,bi),bj=ia(s/F.mxs,si);
              if(prof){rc(xs+hw-hw*s/F.mxs,hw*s/F.mxs,B,bj*.9);rc(xs+hw,hw*b/F.mxs,A,ai*.9)}
              else{rc(xs,hw,B,bj);rc(xs+hw,hw,A,ai)}
            }else{
              const k=ty==="dl"?Math.abs(d)/F.mxd:t/F.mxt,x=Q.cc==="vol"?t/F.mxt:Q.cc==="dl"?Math.abs(d)/F.mxd:Q.cc==="dom"?Math.max(s,b)/F.mxs:0;
              const cl=Q.cc==="imb"?(bi&&!si?A:si&&!bi?B:(d>=0?A:B)):Q.cc==="dl"?(d>=0?A:B):(ty==="dl"?(d>=0?A:B):(b>=s?A:B));
              rc(xs,prof?cwid*Math.min(1,k):cwid,cl,prof?.9*ia(x,bi||si):ia(x,bi||si));
            }
          }
          if(Q.poc&&q===F.poc){ctx.strokeStyle=cP;ctx.lineWidth=1.5;ctx.strokeRect(xs+.5,yt,cwid-1,hg);ctx.lineWidth=1}
          if(Q.dpoc&&q===F.dpoc){ctx.strokeStyle=d>=0?cA:cB;ctx.lineWidth=1.5;ctx.strokeRect(xs+2,yt+1,cwid-4,Math.max(1,hg-2));ctx.lineWidth=1}
          if(Q.va&&Q.valn&&(q===F.vh||q===F.vl)){ctx.strokeStyle="#35b6ff";ctx.beginPath();const ly=q===F.vh?yt:yt+hg;ctx.moveTo(xs,ly);ctx.lineTo(xs+cwid,ly);ctx.stroke()}
          if(Q.stk>1){ctx.fillStyle=`rgb(${A})`;if(im[2])ctx.fillRect(xs+cwid-2,yt,2,hg);ctx.fillStyle=`rgb(${B})`;if(im[3])ctx.fillRect(xs,yt,2,hg)}   // đánh dấu stacked imbalance ở mép ô
          if(!tOK)continue;
          const a2=Math.min(1,Math.max(s,b)/F.mxs),f2=Q.dyn?Math.min(rh-1,fit,fs*(.85+.5*a2)):fz;
          const T=(v,x,al,hl,cl)=>{ctx.textAlign=al;ctx.fillStyle=cl;ctx.font=(hl?"bold ":"")+f2+"px "+mono;ctx.fillText(v,x,y+1)};
          const zs=v=>v>0?fm(v):(Q.zero?"0":"");
          ctx.globalAlpha=dim;
          if(two){T(zs(s),xs+hw-3,"right",si,si?cB:tx);T(zs(b),xs+hw+3,"left",bi,bi?cA:tx)}
          else if(ty==="vol")T(fm(t),xs+hw,"center",bi||si,tx);
          else if(ty==="dl")T(sg(d),xs+hw,"center",bi||si,d>=0?cA:cB);
          else{T(sg(d),xs+hw-3,"right",false,d>=0?cA:cB);T(fm(t),xs+hw+3,"left",false,tx)}
          ctx.globalAlpha=1;
        }
      }
    }
  }
  if(a&&agg.length){let m=!FPM.size?(fpLast?dl("Footprint: chưa có dữ liệu tick (kiểm tra kết nối cTrader)","Footprint: no tick data yet (check the cTrader connection)","Footprint：暂无 tick 数据（请检查 cTrader 连接）"):""):(!show?dl("Footprint: zoom vào để thấy các ô","Footprint: zoom in to see the cells","Footprint：放大可查看格子"):"");
    if(!m&&show&&FPM.size){const cv=fpCoverage();if(cv.n>=5&&(cv.pct<97||FPD.trunc)){const pc=cv.pct.toFixed(0);
      m=FPD.trunc?dl("Footprint: tải tick bị cắt dở, dữ liệu có thể thiếu (phủ "+pc+"% số phút)","Footprint: tick download was cut short, data may be incomplete ("+pc+"% of minutes covered)","Footprint：tick 下载被截断，数据可能不完整（覆盖 "+pc+"% 分钟）")
        :dl("Footprint: có tick cho "+pc+"% số phút (broker chỉ lưu tick gần đây, giảm số ngày hoặc chấp nhận phần cũ thiếu)","Footprint: tick data for "+pc+"% of minutes (broker keeps only recent ticks)","Footprint：仅 "+pc+"% 分钟有 tick（经纪商只保留近期 tick）")}}
    if(m){ctx.save();ctx.textAlign="right";ctx.textBaseline="top";ctx.font="12px system-ui,sans-serif";ctx.globalAlpha=.6;ctx.fillStyle=ink();ctx.fillText(m,w-10,8);ctx.restore()}}
  if(show!==!!window.FPHIDE){window.FPHIDE=show;applyCand()}     // đang hiện ô thì làm trong suốt nến gốc
}
