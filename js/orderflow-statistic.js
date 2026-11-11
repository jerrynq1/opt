/* ===== Orderflow: Statistic (indicator "dst") =====
   Bảng số liệu dưới chart: mỗi nến một cột, mỗi dòng một chỉ số (volume, delta, CVD, COT, ratio, effort...). Dùng chung dữ liệu tick (độ phân giải 1 phút). */
const stOn=()=>ACT.find(x=>x.key==="dst"&&isOn(x));
const STR=[                                   // khóa, nhãn ngắn [vi,en,zh], kiểu số (v vol | p % | i nguyên | d thập phân | r tỉ lệ), có dấu
 ["tot",["Tổng","Total","总量"],"v",0],["ask",["Ask","Ask","Ask"],"v",0],["bid",["Bid","Bid","Bid"],"v",0],
 ["dl",["Delta","Delta","Delta"],"v",1],["dp",["Delta %","Delta %","Delta %"],"p",1],["cvd",["CVD","CVD","CVD"],"v",1],
 ["mxd",["Max Δ","Max Δ","最大Δ"],"v",1],["mnd",["Min Δ","Min Δ","最小Δ"],"v",1],["nt",["Tick","Ticks","Tick"],"i",0],
 ["hl",["Biên độ","Range","区间"],"i",0],["vps",["Vol/s","Vol/s","量/秒"],"d",0],
 ["cth",["COT H","COT H","COT H"],"v",1],["ctl",["COT L","COT L","COT L"],"v",1],["ctb",["COT Bar","COT Bar","COT Bar"],"v",1],["tm",["Time(s)","Time(s)","时间(s)"],"i",0],["br",["Bar R","Bar R","Bar R"],"r",0],
 ["hr",["High R","High R","High R"],"r",0],["lr",["Low R","Low R","Low R"],"r",0],
 ["te",["Effort","Effort","努力"],"d",0],["de",["Δ Effort","Δ Effort","Δ努力"],"d",1]];
const stEl=document.createElement("div");stEl.id="stp";stEl.className="stp";stEl.style.display="none";stEl.innerHTML="<canvas></canvas>";$("panes").after(stEl);
let STC=null;
/* Statistic: số liệu của MỖI nến được cache riêng trên chính nến đó (c._st), chỉ tính lại khi dữ liệu của nến đó đổi:
   nến cũ chỉ tính lại khi nạp thêm lịch sử (FPH) hoặc đổi cài đặt; nến cuối mới tính lại theo từng tick live (FPLV).
   Trước đây MỖI tick live (4 lần/giây) đều tính lại TOÀN BỘ lịch sử (14 ngày ≈ 1.5 giây/lần) làm đơ cả chart.
   Giờ mỗi tick chỉ tốn: tính nến cuối + 1 vòng cộng dồn CVD / chuẩn hoá màu (rẻ). */
function stCandle(c,i,step,cot,fl,Q,M,ck){
  const last=i===agg.length-1,lb=last&&m1.length?m1[m1.length-1]:null;
  const key=ck+(last?"|L"+FPLV+","+m1.length+(cot&&lb?","+lb[2]+","+lb[3]:""):"");
  if(c._st&&c._st.k===key&&fpSigOk(c,"_ss",FPM))return c._st;
  fpSigSet(c,"_ss",FPM);const lv=new Map(),mins=[];let buy=0,sell=0,run=0,mx=0,mn=0;
  for(let t=c.st;t<c.st+C.tf&&t<Infinity;t+=60){const r=FPM.get(t);if(!r)continue;let d=0;
    for(let [p,b,s] of r){if(fl){if(b<Q.fmn||(Q.fmx>0&&b>Q.fmx))b=0;if(s<Q.fmn||(Q.fmx>0&&s>Q.fmx))s=0;if(!b&&!s)continue}const q=fpQ(p,step);let e=lv.get(q);if(!e){e=[0,0];lv.set(q,e)}e[0]+=s;e[1]+=b;buy+=b;sell+=s;d+=b-s}
    run+=d;if(run>mx)mx=run;if(run<mn)mn=run;mins.push([t,d])}
  if(!mins.length)return c._st={k:key,none:true};
  const hl=Math.max(1,fpQ(c.high,step)-fpQ(c.low,step)+1);
  let lo=1e12,hi=-1e12;for(const q of lv.keys()){if(q<lo)lo=q;if(q>hi)hi=q}
  const g=(q,k)=>{const e=lv.get(q);return e?e[k]:0},a1=g(hi,1),b1=g(lo,0);
  let cth=0,ctl=0;
  if(cot){let tl=-1,th=-1;for(const [t] of mins){const b=M.get(t);if(!b)continue;if(b[3]<=c.low)tl=t;if(b[2]>=c.high)th=t}
    for(const [t,d] of mins){if(t>tl)cth+=d;if(t>th)ctl+=d}}
  return c._st={k:key,buy,sell,mx,mn,hl,nm:mins.length,cth,ctl,hrv:a1>0?g(hi-1,1)/a1:null,lrv:b1>0?g(lo+1,0)/b1:null};
}
function stPrep(a){
  const Q=Object.assign(pdef(IND.dst),a.p),step=Math.max(.0001,+Q.step||.5),cot=!!(Q.cth||Q.ctl||Q.ctb),fl=Q.fmn>0||Q.fmx>0;
  const key=[C.sym,C.tf,step,agg.length,m1.length,FPV,cot,Q.sdk,Q.fmn,Q.fmx].join("|");
  if(STC&&STC.key===key)return STC;
  const M=new Map();if(cot)for(const x of m1)M.set(x[0],x);
  const ck=[C.sym,step,FPH,cot,Q.fmn,Q.fmx,C.tf].join("|");
  const out=new Array(agg.length).fill(null),lastM=m1.length?m1[m1.length-1][0]+60:0;let cum=0,day=null;
  for(let i=0;i<agg.length;i++){
    const c=agg[i],x=stCandle(c,i,step,cot,fl,Q,M,ck);
    if(x.none)continue;
    const dk=Math.floor(c.st/86400);if(dk!==day){day=dk;cum=0}
    const tot=x.buy+x.sell,dl=x.buy-x.sell;cum+=dl;
    out[i]={tot,ask:x.buy,bid:x.sell,dl,dp:tot?dl/tot*100:0,cvd:cum,mxd:x.mx,mnd:x.mn,hl:x.hl,vps:tot/(x.nm*60),cth:x.cth,ctl:x.ctl,ctb:c.close>=c.open?x.cth:x.ctl,
      hr:x.hrv,lr:x.lrv,br:c.close>=c.open?x.lrv:x.hrv,nt:c.v||0,tm:Math.max(60,Math.min(C.tf,lastM-c.st)),te:tot/x.hl,de:dl/x.hl};
  }
  const ref={};                                  // mức "đậm tối đa" của từng dòng = trung bình + k × độ lệch chuẩn của |giá trị|
  for(const [k] of STR){if(!Q[k])continue;let n=0,m=0;for(const o of out)if(o&&o[k]!=null){n++;m+=Math.abs(o[k])}
    if(!n){ref[k]=1;continue}m/=n;let v=0;for(const o of out)if(o&&o[k]!=null)v+=(Math.abs(o[k])-m)**2;ref[k]=Math.max(1e-9,m+Q.sdk*Math.sqrt(v/n))}
  return STC={key,out,ref};
}
function stFmt(v,ty,sg,cmp){
  if(v==null||!isFinite(v))return"–";
  const a=Math.abs(v),sn=v<0?"-":(sg&&v>0?"+":"");
  if(ty==="p")return sn+a.toFixed(1)+"%";
  if(ty==="r")return a.toFixed(2);
  if(ty==="i")return cmp&&a>=1e4?(a/1e3).toFixed(1)+"K":String(Math.round(a));
  if(ty==="d")return sn+(a<10?a.toFixed(2):a.toFixed(1));
  return sn+(cmp?(a>=1e6?(a/1e6).toFixed(1)+"M":a>=1e4?(a/1e3).toFixed(1)+"K":String(Math.round(a))):String(Math.round(a)));
}
function drawST(){
  const a=stOn();
  if(!a||!agg.length){if(stEl.style.display!=="none")stEl.style.display="none";return}
  const Q=Object.assign(pdef(IND.dst),a.p),rows=STR.filter(r=>Q[r[0]]);if(Q.inv)rows.reverse();
  const rh=Math.max(12,Math.round(Q.rh)),H=Math.max(rows.length,1)*rh+4;
  if(stEl.style.display==="none")stEl.style.display="";
  if(stEl.style.height!==H+"px")stEl.style.height=H+"px";
  const cvs=stEl.firstChild,dp=devicePixelRatio||1,W=stEl.clientWidth;if(!W)return;
  if(cvs.width!==Math.round(W*dp)||cvs.height!==Math.round(H*dp)){cvs.width=Math.round(W*dp);cvs.height=Math.round(H*dp)}
  const x=cvs.getContext("2d");x.setTransform(dp,0,0,dp,0,0);x.clearRect(0,0,W,H);
  const tx=COL().tx,mono="Consolas,ui-monospace,Menlo,monospace",msg=m=>{x.fillStyle=tx;x.font="12px system-ui,sans-serif";x.textAlign="left";x.textBaseline="middle";x.fillText(m,10,H/2)};
  if(!rows.length)return msg(dl("Statistic: chưa bật dòng nào","Statistic: no rows enabled","Statistic：未启用任何行"));
  if(!FPM.size)return msg(fpLast?dl("Statistic: chưa có dữ liệu tick (kiểm tra kết nối cTrader)","Statistic: no tick data yet (check the cTrader connection)","Statistic：暂无 tick 数据（请检查 cTrader 连接）"):"");
  const S=stPrep(a),lr=ts.getVisibleLogicalRange();if(!lr)return;
  const pw=chart.priceScale("right").width(),gx=Math.max(0,W-pw),i0=Math.max(0,Math.floor(lr.from)-1),i1=Math.min(agg.length-1,Math.ceil(lr.to)+1);
  const xa=ts.logicalToCoordinate(i0),xb=ts.logicalToCoordinate(i0+1),bs=xa!=null&&xb!=null?xb-xa:0;if(bs<=0)return;
  const A=fpRgb(cres(a,0)),B=fpRgb(cres(a,1)),ink_=ink(),fs=Math.min(Q.fs,rh-3),TH=fpRgb(cres(a,2)),thT=(q=>(q[0]*299+q[1]*587+q[2]*114)/1000>150?"#0b0e1a":"#ffffff")(TH.split(",").map(Number));
  x.save();x.beginPath();x.rect(0,0,gx,H);x.clip();x.textBaseline="middle";x.textAlign="center";x.font=fs+"px "+mono;
  for(let i=i0;i<=i1;i++){
    const o=S.out[i];if(!o)continue;const xc=ts.logicalToCoordinate(i);if(xc==null)continue;
    rows.forEach((r,ri)=>{
      const k=r[0],v=o[k];if(v==null)return;const y=2+ri*rh,sg=r[3];
      const col=sg?(v>=0?A:B):k==="ask"?A:k==="bid"?B:"152,162,216";
      const u=Math.min(1,Math.abs(v)/S.ref[k]);
      const ht=Q["th_"+k]>0&&Math.abs(v)>=Q["th_"+k];x.fillStyle=ht?`rgba(${TH},.9)`:`rgba(${col},${(.08+.62*u)*Q.op})`;x.fillRect(xc-bs/2+.5,y,Math.max(1,bs-1),rh-1);
      if(u>=1&&!ht){x.strokeStyle=`rgba(${col},.9)`;x.lineWidth=1;x.strokeRect(xc-bs/2+1,y+.5,Math.max(1,bs-2),rh-2)}
      if(bs>=16){if(ht)x.font="bold "+fs+"px "+mono;let s=stFmt(v,r[2],sg,Q.cmp);if(x.measureText(s).width>bs-3)s=stFmt(v,r[2],sg,true);if(x.measureText(s).width<=bs-3){x.fillStyle=ht?thT:ink_;x.fillText(s,xc,y+rh/2)}if(ht)x.font=fs+"px "+mono}
    });
  }
  x.restore();
  if(Q.lbl){const hs=Math.min(Q.hs||10,rh-2);x.save();x.beginPath();x.rect(gx,0,Math.max(0,W-gx),H);x.clip();if(Q.hbg){x.globalAlpha=.07;x.fillStyle=ink_;rows.forEach((r,ri)=>x.fillRect(gx+1,2+ri*rh,W-gx-1,rh-1));x.globalAlpha=1}x.font=hs+"px system-ui,sans-serif";x.textAlign="left";x.textBaseline="middle";x.fillStyle=tx;
    rows.forEach((r,ri)=>x.fillText(dl(r[1][0],r[1][1],r[1][2]),gx+4,2+ri*rh+rh/2));x.restore()}
}
