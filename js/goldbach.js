/* ===== Goldbach Levels, kiểu Trifecta (indicator "gb") =====
   Port từ Pine Script "Goldbach Trifecta Style" (MPL-2.0) sang JS thuần cho chart này, thiết kế lại cho hợp giao diện app:
   nhãn dạng viên thuốc theo màu từng nhóm level, vùng tô nhẹ, màu theo theme sáng/tối.
   Gồm: PO3 dealing range với các level [03]..[97], nhiều range chồng lên nhau (± N), Fractal Fib (range con = PO3/3),
   Mini Map, PO3 tự chọn theo khung giờ (Automated), Shift Range, Historic Price, bảng thông tin.
   Khác bản Pine: Decimate = 0 nghĩa là tự đoán theo mã (Forex 10000, cặp JPY 100, còn lại 1).
   Phần trên (đến mốc "vẽ") là hàm thuần, được kiểm thử bằng tests/goldbach.test.js; phần dưới vẽ lên canvas của chart. */

const GB_LVL=[3,11,17,23,29,35,41,47,53,59,65,71,77,83,89,97],GB_ALL=[0,3,11,17,23,29,35,41,47,53,59,65,71,77,83,89,97,100];
const GB_DASH={Solid:[],Dotted:[2,3],Dashed:[6,4]},GB_PX={Tiny:9,Small:10,Normal:12,Large:14};

/* nhóm level: liq = thanh khoản, gip = GIP, flow = dòng chảy (LV/BR), reb = cân bằng lại */
const gbKind=p=>p===3||p===11||p===89||p===97?"liq":p===17||p===83?"gip":(p===23||p===29||p===35||p===65||p===71||p===77)?"flow":"reb";
const gbCi=k=>({liq:1,gip:2,flow:3,reb:4})[k];                  // chỉ số ô màu
const gbLbl=p=>"["+(p<10?"0":"")+p+"]";

/* Decimate: > 0 dùng đúng giá trị đó; 0 = tự đoán theo mã và mức giá */
function gbDec(sym,price,dec){
  dec=+dec;if(dec>0)return dec;
  sym=String(sym||"").toUpperCase();
  if(/^[A-Z]{6}$/.test(sym)&&!/^X(AU|AG|PT|PD)/.test(sym))return price<20?10000:(sym.indexOf("JPY")>=0?100:1);
  return 1}

/* PO3 tự chọn theo khung giờ (giây) */
function gbAutoPo3(tf,Q){
  const v=tf>=31104000?Q.aY:tf>=7776000?Q.aQ:tf>=2592000?Q.aMo:tf>=604800?Q.aW:tf>=86400?Q.aD:tf>=14400?Q.a4:tf>=3600?Q.a1h:tf>=900?Q.a15:tf>=180?Q.a3:Q.a1;
  return +v}

/* Range chứa giá + n range phía trên và dưới. shift = dịch lưới theo tỉ lệ của một range (0.5 = nửa range) */
function gbRanges(price,po3,dec,shift,n){
  if(!isFinite(price)||!(po3>0)||!(dec>0))return null;
  const gs=(shift||0)*po3,lowS=Math.floor((price*dec-gs)/po3)*po3+gs,baseLow=lowS/dec,sz=po3/dec,list=[];
  for(let k=-n;k<=n;k++)list.push({k,lo:baseLow+k*sz});
  return{baseLow,sz,list}}

/* Các level của một range: [{p, y}], không gồm 0 và 100 */
const gbLevels=(lo,sz,eq)=>{const o=GB_LVL.map(p=>({p,y:lo+sz*p/100}));if(eq)o.push({p:50,y:lo+sz*.5});return o.sort((a,b)=>a.p-b.p)};

/* Range con (PO3/3) chứa giá */
function gbChild(price,baseLow,sz){const c=sz/3,lo=baseLow+Math.floor((price-baseLow)/c)*c;return{lo,sz:c}}

/* ===== vẽ ===== */
const gbOn=()=>ACT.find(x=>x.key==="gb"&&isOn(x));
function drawGB(w,h){
  const a=gbOn();if(!a||!agg.length)return;
  const Q=Object.assign(pdef(IND.gb),a.p),N=agg.length,last=agg[N-1];
  const live=Q.upd?last.close:(N>1?agg[N-2].close:last.close),src=Q.uh&&+Q.hp>0?+Q.hp:live;
  const dec=gbDec(C.sym,src,Q.dec),po3=Q.aut?gbAutoPo3(C.tf,Q):+Q.po3,R=gbRanges(src,po3,dec,+Q.shift||0,Math.max(0,Math.round(Q.nr)));
  if(!R)return;
  const dark=P.theme==="dark",px=GB_PX[Q.lsz]||10,col=j=>cres(a,j),dash=n=>GB_DASH[n]||[];
  const X=i=>ts.logicalToCoordinate(i),Yp=p=>cs.priceToCoordinate(p);
  const xl=X(N-1),xp=X(N-2),bw=xl!=null&&xp!=null?Math.abs(xl-xp):6;
  const xe=Q.ext||xl==null?w:Math.max(0,Math.min(w,xl+Q.lo*bw));          // đầu phải của đường
  const cardBg=dark?"rgba(14,10,30,.78)":"rgba(255,251,240,.9)";
  const labels=[];                                                      // {y, t, c, pr}
  const seg=(y,c,wd,ds)=>{if(y==null||y<-4||y>h+4)return;ctx.setLineDash(ds);ctx.lineWidth=wd;ctx.strokeStyle=c;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(xe,y);ctx.stroke()};
  const zone=(lo,hi,c)=>{const y1=Yp(hi),y2=Yp(lo);if(y1==null||y2==null||y2<0||y1>h)return;ctx.fillStyle=hexA(c,Q.zop);ctx.fillRect(0,y1,xe,Math.max(1,y2-y1))};
  ctx.save();
  try{
    ctx.lineCap="butt";
    for(const r of R.list){
      const lo=r.lo,sz=R.sz,main=r.k===0;
      if(Q.fob){zone(lo+sz*.03,lo+sz*.11,col(1));zone(lo+sz*.89,lo+sz*.97,col(1))}
      if(Q.flv){zone(lo+sz*.23,lo+sz*.35,col(3));zone(lo+sz*.65,lo+sz*.77,col(3))}
      if(Q.feq)zone(lo+sz*.41,lo+sz*.59,col(4));
      if(Q.mids)for(let i=0;i<GB_ALL.length-1;i++)seg(Yp(lo+sz*(GB_ALL[i]+GB_ALL[i+1])/200),hexA(col(6),.45),1,[2,3]);
      if(!Q.hmain)for(const L of gbLevels(lo,sz,Q.eq)){
        const k=gbKind(L.p),ci=gbCi(k),st=k==="gip"?Q.sg:(L.p===23||L.p===77)?Q.sl:L.p===50?Q.se:"Solid";
        seg(Yp(L.y),hexA(col(ci),main?.9:.55),Q.lw,dash(st));
        if(main&&Q.lbl)labels.push({y:L.y,t:gbLbl(L.p),c:col(ci),pr:L.p===50?1:2})}
      seg(Yp(lo),col(0),Q.hw,[]);
      if(main&&Q.lbl){labels.push({y:lo,t:"["+po3+" L]",c:col(0),pr:0});labels.push({y:lo+sz,t:"["+po3+" H]",c:col(0),pr:0})}}
    seg(Yp(R.baseLow+(Math.max(0,Math.round(Q.nr))+1)*R.sz),col(0),Q.hw,[]);
    // Fractal: range con PO3/3 chứa giá, có đủ level riêng
    if(Q.ffib&&po3>=3){
      const F=gbChild(src,R.baseLow,R.sz);
      for(const p of GB_ALL){const bnd=p===0||p===100,y=Yp(F.lo+F.sz*p/100);seg(y,hexA(col(5),bnd?.95:.6),bnd?2:1,bnd?[]:[6,4])}
      if(Q.lbl){const cp=Math.round(po3/3);labels.push({y:F.lo,t:"["+cp+" L]",c:col(5),pr:0});labels.push({y:F.lo+F.sz,t:"["+cp+" H]",c:col(5),pr:0})}}
    // Mini map: cột range thu nhỏ, đặt bên phải nến cuối (hoặc ghim mép trái vùng đang xem)
    if(Q.mm){
      const vr=ts.getVisibleLogicalRange(),i0=Q.mms?(N-1+Q.mmx):Math.max(0,Math.floor(vr?vr.from:0))+Q.mmx,x0=X(i0),x1=X(i0+Q.mmb);
      if(x0!=null&&x1!=null){
        for(const r of R.list){
          const yt=Yp(r.lo+R.sz),yb=Yp(r.lo);if(yt==null||yb==null)continue;
          ctx.setLineDash([]);ctx.fillStyle=r.k===0?hexA(col(3),.2):hexA(col(6),.1);ctx.fillRect(x0,yt,x1-x0,yb-yt);
          ctx.lineWidth=1;ctx.strokeStyle=hexA(col(0),.5);ctx.strokeRect(x0,yt,x1-x0,yb-yt);
          for(const[p,ci]of[[50,4],[17,2],[83,2]]){const y=Yp(r.lo+R.sz*p/100);if(y==null)continue;ctx.setLineDash([2,3]);ctx.strokeStyle=hexA(col(ci),.7);ctx.beginPath();ctx.moveTo(x0,y);ctx.lineTo(x1,y);ctx.stroke()}}
        const ys=Yp(src);if(ys!=null){ctx.setLineDash([]);ctx.lineWidth=2;ctx.strokeStyle="#ffb02e";ctx.beginPath();ctx.moveTo(x0,ys);ctx.lineTo(x1,ys);ctx.stroke()}}}
    // nhãn: ưu tiên High/Low, EQ, rồi level thường; bỏ nhãn đè lên nhãn đã đặt
    if(labels.length){
      ctx.setLineDash([]);ctx.font=font(px,1);ctx.textAlign="left";ctx.textBaseline="middle";
      const hh=px+6,placed=[];labels.sort((p,q)=>p.pr-q.pr);
      for(const L of labels){
        const y=Yp(L.y);if(y==null||y<hh/2||y>h-hh/2)continue;
        if(placed.some(q=>Math.abs(q-y)<hh-1))continue;placed.push(y);
        const tw=ctx.measureText(L.t).width,pw=tw+12,x=Q.ext?w-pw-4:Math.min(xe+3,w-pw-3);
        ctx.fillStyle=cardBg;ctx.beginPath();ctx.roundRect(x,y-hh/2,pw,hh,hh/2);ctx.fill();
        ctx.lineWidth=1;ctx.strokeStyle=hexA(L.c,.7);ctx.stroke();
        ctx.fillStyle=L.c;ctx.fillText(L.t,x+6,y+.5)}}
    // thông tin
    if(Q.info){
      const t="PO3 "+po3+(Q.aut?" · auto":"")+" · ×"+dec+" · "+C.sym;ctx.font=font(11,1);ctx.textAlign="center";ctx.textBaseline="middle";
      const tw=ctx.measureText(t).width+18,x=w/2-tw/2,y=h-22;
      ctx.fillStyle=cardBg;ctx.beginPath();ctx.roundRect(x,y-10,tw,20,10);ctx.fill();ctx.lineWidth=1;ctx.strokeStyle=hexA(col(0),.45);ctx.stroke();
      ctx.fillStyle=col(0);ctx.fillText(t,w/2,y+.5)}
  }finally{ctx.restore()}}
