/* ===== Orderflow: Big Trade (indicator "bt") =====
   2 cách xác định "lệnh lớn" (cTrader không có tape khớp lệnh thật nên đều là ước lượng):
   - "run" (mặc định): 1 lệnh = chuỗi tick liên tiếp CÙNG chiều, 2 tick kề nhau cách nhau ≤ gap ms (xem btFeed trong ctrader.js). Volume = số tick, giá = bình quân giá khớp ước lượng.
     Gần với 1 lệnh thị trường quét sổ lệnh nhất, không bị cắt đôi ở ranh giới phút, và không gộp nhầm nhiều lệnh nhỏ rải rác.
   - "lvl": volume MUA hoặc BÁN tại 1 mức giá trong 1 phút M1 (cách cũ).
   Ngưỡng "Tự động" theo phân vị của các lệnh ĐÃ ĐÓNG, chỉ tính lại khi có thêm dữ liệu lịch sử hoặc dữ liệu tăng >5% (không nhấp nháy theo từng tick live). */
let BTS=null;
// các lệnh [hàng, chiều, volume] của 1 phút (cache theo phút, tự làm mới khi dữ liệu phút đó đổi)
function btMin(t,S){
  if(S.mode==="run"){
    const L=BTE.get(t);if(!L)return null;
    const e=S.mc.get(t);if(e&&e.ref===L&&e.n===L.length)return e.out;
    const out=L.map(r=>[fpQ(r[1],S.step),r[2],r[3]]);S.mc.set(t,{ref:L,n:L.length,out});return out;
  }
  const rows=FPM.get(t);if(!rows)return null;
  const e=S.mc.get(t);if(e&&e.ref===rows)return e.out;
  const m=new Map();for(const [p,b,s] of rows){const q=fpQ(p,S.step);let x=m.get(q);if(!x){x=[0,0];m.set(q,x)}x[0]+=b;x[1]+=s}
  const out=[];for(const [q,x] of m){if(x[0]>0)out.push([q,1,x[0]]);if(x[1]>0)out.push([q,-1,x[1]])}
  S.mc.set(t,{ref:rows,out});return out;
}
function btPrep(a){
  const Q=Object.assign(pdef(IND.bt),a.p),step=Math.max(.0001,+Q.step||.5),mode=Q.bm==="lvl"?"lvl":"run";
  const sig=[C.sym,step,mode,Q.fm,Q.lv,Q.mn,Q.mx,Q.cap,FPH].join("|");
  let S=BTS;if(!S||S.sig!==sig){if(S&&S.step===step&&S.mode===mode&&S.sym===C.sym)var mc=S.mc;S=BTS={sig,step,mode,sym:C.sym,mc:mc||new Map(),thr:null}}
  const live=m1.length?m1[m1.length-1][0]:0,keys=mode==="run"?BTE:FPM;let n=0;
  for(const [t,v] of keys)if(t<live)n+=mode==="run"?v.length:1;      // số lệnh đã đóng: dấu hiệu để biết khi nào cần tính lại ngưỡng
  if(!S.thr||n>S.thr.n*1.05+5){
    const man=Q.fm==="man",run=mode==="run";let lo,hi=Infinity;
    if(man){lo=Math.max(1,Q.mn);if(Q.mx>0)hi=Q.mx}
    else{
      const vs=[];for(const t of keys.keys()){if(t>=live)continue;const L=btMin(t,S);if(L)for(const it of L)vs.push(it[2])}
      const f=Float64Array.from(vs).sort(),pc=({low:.97,med:.99,str:.997})[Q.lv]||.99;
      lo=f.length<50?(run?8:15):Math.max(run?3:2,Math.floor(f[Math.min(f.length-1,Math.floor(f.length*pc))])+1);   // chỉ lấy các lệnh LỚN HƠN ngưỡng phân vị (volume là số nguyên nên có nhiều giá trị bằng nhau)
    }
    let k=0,mean=0,mn=Infinity;
    for(const t of keys.keys()){const L=btMin(t,S);if(L)for(const it of L)if(it[2]>=lo&&it[2]<=hi){k++;mean+=it[2];if(it[2]<mn)mn=it[2]}}
    let sd=0;if(k){mean/=k;for(const t of keys.keys()){const L=btMin(t,S);if(L)for(const it of L)if(it[2]>=lo&&it[2]<=hi)sd+=(it[2]-mean)*(it[2]-mean)}sd=Math.sqrt(sd/k)}
    S.thr={lo,hi,n,k,st:{mean,sd,min:k?mn:0}};
  }
  S.cap=Math.round(Q.cap)||0;return S;
}
function btOf(c,S){
  const last=agg.length&&c===agg[agg.length-1],key=S.sig+"|"+S.thr.lo+"|"+S.thr.hi+"|"+(last?FPV:0);
  const SM=S.mode==="run"?BTE:FPM;if(c._bk===key&&fpSigOk(c,"_bs",SM))return c._bl;
  fpSigSet(c,"_bs",SM);const out=[],lo=S.thr.lo,hi=S.thr.hi;
  for(let t=c.st;t<c.st+C.tf&&t<Infinity;t+=60){const L=btMin(t,S);if(!L)continue;for(const it of L)if(it[2]>=lo&&it[2]<=hi)out.push({q:it[0],side:it[1],v:it[2]})}
  out.sort((x,y)=>y.v-x.v);if(S.cap>0&&out.length>S.cap)out.length=S.cap;c._bk=key;return c._bl=out;
}
function drawBT(w,h){
  const a=btOn();if(!a||!agg.length)return;
  const lr=ts.getVisibleLogicalRange();if(!lr)return;
  const Q=Object.assign(pdef(IND.bt),a.p),mono="Consolas,ui-monospace,Menlo,monospace";
  if(!FPM.size){
    if(fpLast&&!fpOn()){ctx.save();ctx.textAlign="right";ctx.textBaseline="top";ctx.font="12px system-ui,sans-serif";ctx.globalAlpha=.6;ctx.fillStyle=ink();
      ctx.fillText(dl("Big Trade: chưa có dữ liệu tick (kiểm tra kết nối cTrader)","Big Trade: no tick data yet (check the cTrader connection)","Big Trade：暂无 tick 数据（请检查 cTrader 连接）"),w-10,8);ctx.restore()}
    return;
  }
  const S=btPrep(a),step=S.step,N=Math.max(1,Math.round(Q.zbar));
  const j0=Math.max(0,Math.floor(lr.from)-1),i1=Math.min(agg.length-1,Math.ceil(lr.to)+1),i0=Math.max(0,j0-(Q.zon?N:0));
  const xa=ts.logicalToCoordinate(i0),xb=ts.logicalToCoordinate(i0+1),bs=xa!=null&&xb!=null?xb-xa:0;if(!bs)return;
  const last=agg[agg.length-1].close,pa=cs.priceToCoordinate(last),pb=cs.priceToCoordinate(last+step),rh=pa!=null&&pb!=null?Math.abs(pa-pb):0;
  const A=fpRgb(cres(a,0)),B=fpRgb(cres(a,1)),cT=a.c[2]||"#ffffff";
  // vùng ngang kéo dài N nến từ lệnh lớn
  if(Q.zon){
    const hh=Math.max(2,rh);
    for(let i=i0;i<=i1;i++){
      const c=agg[i];let L=btOf(c,S);if(!L.length)continue;
      const x0=ts.logicalToCoordinate(i);if(x0==null)continue;if(x0+N*bs<0||x0>w)continue;
      const bull=c.close>=c.open,bh=Math.max(c.open,c.close),bl=Math.min(c.open,c.close);
      L=L.filter(g=>{const pr=fpYp(g.q,step),m=(pr>bh+step/2||pr<bl-step/2)?Q.zsh:Q.zbo;if(m==="none")return false;if(m==="all")return true;return m==="rev"?(bull?g.side<0:g.side>0):(bull?g.side>0:g.side<0)});
      if(Q.zbig&&L.length)L=[L[0]];
      for(const g of L){const y=cs.priceToCoordinate(fpYp(g.q,step));if(y==null)continue;const cl=g.side>0?A:B;
        let e=N;if(Q.ztr){const rl=g.q*step,rh2=(g.q+1)*step;for(let j=1;j<=N&&i+j<agg.length;j++){const d=agg[i+j];if(d.low<=rh2&&d.high>=rl){e=j;break}}}   // giá đã quay lại chạm mức này thì vùng dừng ở nến đó
        const x1=x0+e*bs;
        ctx.fillStyle=`rgba(${cl},${Q.zop})`;ctx.fillRect(x0,y-hh/2,x1-x0,hh);
        ctx.strokeStyle=`rgba(${cl},${Math.min(1,Q.zop+.35)})`;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x0,y);ctx.lineTo(x1,y);ctx.stroke()}
    }
  }
  // bong bóng: cỡ và độ đậm co giãn theo volume (trung bình + k×độ lệch chuẩn là to nhất)
  const vis=[],fp=!!window.FPHIDE,dx=fp?1+Math.min(8,bs*.12)/2:0;
  for(let i=j0;i<=i1;i++){
    const c=agg[i],L=btOf(c,S);if(!L.length)continue;
    const xc=ts.logicalToCoordinate(i);if(xc==null)continue;
    const yo=cs.priceToCoordinate(c.open),yc=cs.priceToCoordinate(c.close);
    for(const g of L)vis.push({g,x:xc+dx,yb0:Math.min(yo,yc),yb1:Math.max(yo,yc)});
  }
  const smax=Math.max(Q.smax,Q.smin),den=S.thr.st.mean+Q.sdk*S.thr.st.sd-S.thr.st.min,fm=v=>v>=1e6?(v/1e6).toFixed(1)+"M":v>=1e4?(v/1e3).toFixed(1)+"K":String(Math.round(v));
  vis.sort((x,y)=>y.g.v-x.g.v);                                       // to vẽ trước, nhỏ vẽ đè lên
  ctx.textBaseline="middle";
  for(const o of vis){
    const g=o.g,y=cs.priceToCoordinate(fpYp(g.q,step));if(y==null||y<-100||y>h+100)continue;
    const k=den>1e-6?Math.max(0,Math.min(1,(g.v-S.thr.st.min)/den)):.5;
    let r=(Q.smin+(smax-Q.smin)*k)/2;if(fp)r=Math.min(r,Math.max(bs*.3,rh*1.6));
    const al=Math.max(0,Math.min(1,Q.omin+(Q.omax-Q.omin)*k)),cl=g.side>0?A:B;
    ctx.lineWidth=1.2;ctx.strokeStyle=`rgba(${cl},${Math.min(1,al+.3)})`;ctx.beginPath();ctx.arc(o.x,y,r,0,7);
    if(!Q.hol){ctx.fillStyle=`rgba(${cl},${al})`;ctx.fill()}
    ctx.stroke();
    if(Q.txt&&r>=Q.tsz*.8&&(!Q.ins||(y>=o.yb0&&y<=o.yb1))){ctx.fillStyle=cT;ctx.font="bold "+Q.tsz+"px "+mono;ctx.textAlign="center";ctx.fillText(fm(g.v),o.x,y+1)}
  }
  ctx.lineWidth=1;
}
