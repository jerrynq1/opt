/* ===== Quarterly Theory [QT] (indicator "qt") =====
   Port từ Pine Script "Quarterly Theory [QT]" (MPL-2.0) sang JS thuần cho chart này. Mỗi chu kỳ (Năm, Tháng, Tuần, Ngày, 90 phút, 22.5 phút)
   chia thành 4 phần A (Accumulation), M (Manipulation), D (Distribution), X (Reversal / Continuation) và vẽ thành một làn ngang.
   Khác bản Pine: không mở pane riêng mà vẽ thành thanh các làn nằm trên chart (dưới hoặc trên), thẳng hàng với trục thời gian của nến,
   nên nhìn được nến đang ở phần nào của từng chu kỳ; ô hiện tại được viền nổi, có chú giải; "bây giờ" lấy theo nến cuối.
   Sửa so với bản Pine: tuần bắt đầu đúng 00:00 thứ Hai (bản Pine giữ nguyên giờ trong ngày), ngày giao dịch bắt đầu 18:00 New York
   nên sau 18:00 vẫn thấy đúng ô đang chạy. Mọi mốc tính theo giờ New York (server = New York + 7 giờ).
   Kiểu "Box trên chart" (mặc định): mỗi phiên 6 giờ (Asia 18:00, London 00:00, NY AM 06:00, NY PM 12:00 giờ New York) vẽ khung nét đứt theo High/Low của phiên,
   bên trong chia 4 ô 90 phút A-M-D-X tô màu theo High/Low từng ô, kèm đường giá mở cửa từng phiên (AO/LO/NYO/PMO) và True Day Open (TDO).
   Phần trên (đến mốc "vẽ") là hàm thuần, được kiểm thử bằng tests/qt.test.js; phần dưới vẽ lên canvas của chart. */

const QT_OFF=25200,QT_DAY=86400,QT_LN={y:"Năm",mo:"Tháng",w:"Tuần",d:"Ngày",m90:"90p",mc:"22.5p"};
const QT_Q=["A","M","D","X"],QT_NM=["Accum","Manip","Distrib","Rev/Con"];

const qtUTC=(y,m,d)=>Date.UTC(y,m,d)/1000;                                   // m tính từ 0; kết quả là "giờ treo tường" New York dạng giây
const qtNthMon=(y,m,n)=>{const dow=new Date(Date.UTC(y,m,1)).getUTCDay();return qtUTC(y,m,1+(8-dow)%7+(n-1)*7)};
const qtMonday=w=>{const d0=Math.floor(w/QT_DAY)*QT_DAY,dow=new Date(d0*1000).getUTCDay();return d0-((dow+6)%7)*QT_DAY};

/* Các làn cho thời điểm nowW (giây, giờ New York). o: {hist,y,mo,w,d,m90,mc}. Mỗi làn: {id, S:[{a,b,q}]}, q = 1..4 */
function qtCycles(nowW,o){
  const L=[],dt=new Date(nowW*1000),yr=dt.getUTCFullYear(),mon=dt.getUTCMonth(),
    tb0=Math.floor((nowW+6*3600)/QT_DAY)*QT_DAY;                              // ngày giao dịch bắt đầu 18:00 hôm trước
  const four=(b,S)=>{for(let q=0;q<4;q++)S.push({a:b[q],b:b[q+1],q:q+1})};
  if(o.y){const S=[];for(let y=o.hist?yr-3:yr;y<=yr;y++)four([0,3,6,9,12].map(m=>qtUTC(y,m,1)),S);L.push({id:"y",S})}
  if(o.mo){const S=[];
    for(let k=o.hist?6:1;k>=0;k--){let m=mon-k,y=yr;while(m<0){m+=12;y--}
      let nm=m+1,ny=y;if(nm>11){nm=0;ny++}
      four([qtNthMon(y,m,1),qtNthMon(y,m,2),qtNthMon(y,m,3),qtNthMon(y,m,4),qtNthMon(ny,nm,1)],S)}
    L.push({id:"mo",S})}
  if(o.w){const S=[],m0=qtMonday(nowW);
    for(let k=o.hist?10:0;k>=0;k--){const t=m0-k*7*QT_DAY;four([0,1,2,3,4].map(i=>t+i*QT_DAY),S)}
    L.push({id:"w",S})}
  if(o.d){const S=[];
    for(let k=o.hist?10:0;k>=0;k--){const t=tb0-k*QT_DAY;four([-6,0,6,12,18].map(i=>t+i*3600),S)}
    L.push({id:"d",S})}
  if(o.m90){const S=[];
    for(let k=o.hist?5:0;k>=0;k--){const t=tb0-k*QT_DAY-6*3600;for(let s=0;s<16;s++)S.push({a:t+s*5400,b:t+(s+1)*5400,q:s%4+1})}
    L.push({id:"m90",S})}
  if(o.mc){const S=[];
    for(let k=o.hist?2:0;k>=0;k--){const t=tb0-k*QT_DAY-6*3600;for(let s=0;s<64;s++)S.push({a:t+s*1350,b:t+(s+1)*1350,q:s%4+1})}
    L.push({id:"mc",S})}
  return L}

/* Giờ server (giây) -> vị trí logic trên trục nến. A = mảng giờ bắt đầu từng nến (tăng dần), tf = độ dài nến.
   Cạnh trái nến i là i-0.5. Trong khoảng trống (cuối tuần) giữ ở cạnh phải của nến trước; sau nến cuối và trước nến đầu suy ra tuyến tính. */
function qtLogical(A,t,tf){
  const n=A.length;if(!n)return 0;
  if(t>=A[n-1])return n-1-.5+(t-A[n-1])/tf;
  if(t<A[0])return -.5-(A[0]-t)/tf;
  let lo=0,hi=n-1;while(lo<hi){const k=(lo+hi+1)>>1;A[k]<=t?lo=k:hi=k-1}
  return lo-.5+Math.min(1,(t-A[lo])/tf)}

/* ===== vẽ ===== */
const qtOn=()=>ACT.find(x=>x.key==="qt"&&isOn(x));
let QTA=null,QTS="";
function drawQT(w,h){
  const a=qtOn();if(!a||!agg.length)return;
  const Q=Object.assign(pdef(IND.qt),a.p),N=agg.length,tf=C.tf,sig=N+"|"+agg[0].st+"|"+agg[N-1].st;
  if(sig!==QTS||!QTA){QTA=agg.map(b=>b.st);QTS=sig}
  if(Q.style!=="lane")return drawQTBox(a,Q,w,h);
  const nowSt=agg[N-1].st,lanes=qtCycles(nowSt-QT_OFF,{hist:Q.hist,y:Q.cy,mo:Q.cmo,w:Q.cw,d:Q.cd,m90:Q.c90,mc:Q.cmc});
  if(!lanes.length)return;
  if(Q.pos==="top")lanes.reverse();
  const dark=P.theme==="dark",lh=Math.max(10,Math.round(15*(+Q.size||1))),gap=2,pad=8,total=lanes.length*(lh+gap)-gap,top=Q.pos==="top"?pad:h-pad-total;
  const cardBg=dark?"rgba(14,10,30,.78)":"rgba(255,251,240,.9)",col=j=>cres(a,j),fs=Math.max(8,Math.min(12,lh-5));
  const X=st=>{const x=ts.logicalToCoordinate(qtLogical(QTA,st,tf));return x==null?null:x};
  ctx.save();
  try{
    if(Q.bg){ctx.fillStyle=dark?"rgba(14,10,30,.5)":"rgba(255,251,240,.55)";ctx.beginPath();ctx.roundRect(2,top-3,w-4,total+6,6);ctx.fill()}
    ctx.setLineDash([]);ctx.font=font(fs,1);ctx.textBaseline="middle";ctx.textAlign="center";
    lanes.forEach((ln,idx)=>{
      const y0=top+idx*(lh+gap);
      for(const s of ln.S){
        const xa0=X(s.a+QT_OFF),xb0=X(s.b+QT_OFF);if(xa0==null||xb0==null)continue;
        if(xb0<-30||xa0>w+30||xb0-xa0<1.5)continue;
        const xa=Math.max(-30,xa0),xb=Math.min(w+30,xb0),c=col(s.q-1),cur=Q.now&&nowSt-QT_OFF>=s.a&&nowSt-QT_OFF<s.b;
        ctx.fillStyle=hexA(c,Math.min(1,Q.op+(cur?.3:0)));ctx.beginPath();ctx.roundRect(xa,y0,xb-xa,lh,3);ctx.fill();
        if(cur){ctx.lineWidth=1.5;ctx.strokeStyle=ink();ctx.stroke()}
        else if(Q.brd){ctx.lineWidth=1;ctx.strokeStyle=hexA(c,Math.min(1,Q.op+.35));ctx.stroke()}
        if(Q.lbl){const v0=Math.max(xa,0),v1=Math.min(xb,w),vw=v1-v0;
          if(vw>=14){let t=QT_Q[s.q-1];if(Q.full&&vw>26+ctx.measureText(QT_NM[s.q-1]).width)t=QT_Q[s.q-1]+" · "+QT_NM[s.q-1];
            ctx.fillStyle=cur?ink():dark?"#fff4d9":"#2a1c06";ctx.fillText(t,(v0+v1)/2,y0+lh/2+.5)}}}
      // tên làn
      const nm=QT_LN[ln.id],tw=ctx.measureText(nm).width+10;
      ctx.fillStyle=cardBg;ctx.beginPath();ctx.roundRect(4,y0+1,tw,lh-2,(lh-2)/2);ctx.fill();ctx.lineWidth=1;ctx.strokeStyle=hexA(col(0),.5);ctx.stroke();
      ctx.fillStyle=dark?"#c4b79a":"#7a6740";ctx.fillText(nm,4+tw/2,y0+lh/2+.5)});
    // chú giải
    if(Q.leg){
      ctx.font=font(10,1);const items=QT_Q.map((q,i)=>({t:q+" "+QT_NM[i],c:col(i),w:ctx.measureText(q+" "+QT_NM[i]).width+18}));
      let x=w-6-items.reduce((s,i)=>s+i.w+4,-4);const y=Q.pos==="top"?top+total+6+8:top-6-8;
      ctx.textAlign="left";
      for(const it of items){ctx.fillStyle=cardBg;ctx.beginPath();ctx.roundRect(x,y-8,it.w,16,8);ctx.fill();ctx.lineWidth=1;ctx.strokeStyle=hexA(it.c,.7);ctx.stroke();
        ctx.fillStyle=it.c;ctx.beginPath();ctx.arc(x+8,y,3,0,7);ctx.fill();ctx.fillStyle=dark?"#fff4d9":"#2a1c06";ctx.fillText(it.t,x+14,y+.5);x+=it.w+4}}
  }finally{ctx.restore()}}

/* ===== Kiểu "Box trên chart": phiên 6 giờ + 4 ô 90 phút + đường giá mở cửa ===== */
const QT_SES=["AO","LO","NYO","PMO"];
let QTB=null,QTBS="";
const qtPd=()=>typeof pd==="function"?pd():2;
function qtHL(a,b){                                  // High/Low/Open của các nến có giờ bắt đầu trong [a,b) (giờ server)
  let lo=0,hi=QTA.length;while(lo<hi){const m=(lo+hi)>>1;QTA[m]<a?lo=m+1:hi=m}
  let e=lo;while(e<QTA.length&&QTA[e]<b)e++;if(lo>=e)return null;
  let H=-Infinity,L=Infinity;for(let k=lo;k<e;k++){const x=agg[k];if(x.high>H)H=x.high;if(x.low<L)L=x.low}
  return{hi:H,lo:L,o:agg[lo].open}}
function qtBoxModel(Q,nowSt){
  const nowW=nowSt-QT_OFF,tb0=Math.floor((nowW+6*3600)/QT_DAY)*QT_DAY,nd=Math.max(1,Math.min(30,Math.round(+Q.bdays||3))),out=[];
  for(let k=nd-1;k>=0;k--){
    const t0=tb0-k*QT_DAY-6*3600,D={t0,end:t0+QT_DAY,last:k===0,S:[],tdo:null,tdoT:0};
    for(let s=0;s<4;s++){
      const a=t0+s*21600,b=a+21600,S={s,a,b,hl:qtHL(a+QT_OFF,b+QT_OFF),Q:[]};
      for(let j=0;j<4;j++){const qa=a+j*5400;S.Q.push({j,a:qa,b:qa+5400,hl:qtHL(qa+QT_OFF,qa+5400+QT_OFF)})}
      D.S.push(S)}
    D.tdoT=Q.tdo==="open"?t0:tb0-k*QT_DAY;                       // 00:00 (True Day Open) hoặc 18:00 (đầu ngày giao dịch)
    const td=qtHL(D.tdoT+QT_OFF,t0+QT_DAY+QT_OFF);D.tdo=td?td.o:null;
    out.push(D)}
  return out}
function drawQTBox(a,Q,w,h){
  const N=agg.length,tf=C.tf,last=agg[N-1],nowSt=last.st,dg=qtPd();
  const sig=[QTS,last.high,last.low,last.close,Q.bdays,Q.tdo].join("|");
  if(sig!==QTBS||!QTB){QTB=qtBoxModel(Q,nowSt);QTBS=sig}
  const col=j=>cres(a,j),X=st=>{const x=ts.logicalToCoordinate(qtLogical(QTA,st,tf));return x==null||!isFinite(x)?null:x},Y=p=>{const y=cs.priceToCoordinate(p);return y==null||!isFinite(y)?null:y};
  const capW=nowSt-QT_OFF+tf;                         // không vẽ vào tương lai: phiên đang chạy dừng ở nến cuối
  ctx.save();
  try{
    ctx.textBaseline="middle";ctx.lineJoin="miter";
    for(const D of QTB){
      for(const S of D.S){
        if(!S.hl)continue;
        const xa=X(S.a+QT_OFF),xb=X(Math.min(S.b,capW)+QT_OFF);if(xa==null||xb==null||xb<0||xa>w||xb-xa<1.5)continue;
        const c=col(S.s);
        // 4 ô 90 phút theo High/Low từng ô
        if(Q.bq){for(const q of S.Q){if(!q.hl||q.a>=capW)continue;
          const qa=X(q.a+QT_OFF),qb=X(Math.min(q.b,capW)+QT_OFF),yt=Y(q.hl.hi),yb=Y(q.hl.lo);if(qa==null||qb==null||yt==null||yb==null||qb<0||qa>w||qb-qa<1)continue;
          const qc=col(q.j);ctx.fillStyle=hexA(qc,Math.min(1,+Q.bop||.18));ctx.fillRect(qa,Math.min(yt,yb),qb-qa,Math.max(1,Math.abs(yb-yt)));
          if(Q.lbl&&qb-qa>=14){ctx.font=font(9,1);ctx.textAlign="center";ctx.fillStyle=hexA(qc,.95);ctx.fillText(QT_Q[q.j],(Math.max(qa,0)+Math.min(qb,w))/2,Math.min(yt,yb)+7)}}}
        // khung phiên nét đứt
        const yt=Y(S.hl.hi),yb=Y(S.hl.lo);if(yt==null||yb==null)continue;
        if(Q.bsess){ctx.setLineDash([5,4]);ctx.lineWidth=1;ctx.strokeStyle=hexA(c,.85);ctx.fillStyle=hexA(c,.035);
          ctx.fillRect(xa,Math.min(yt,yb),xb-xa,Math.max(1,Math.abs(yb-yt)));ctx.strokeRect(xa+.5,Math.min(yt,yb)+.5,Math.max(1,xb-xa-1),Math.max(1,Math.abs(yb-yt)-1));ctx.setLineDash([])}
        // đường giá mở cửa phiên + nhãn
        if(Q.bol){const yo=Y(S.hl.o);if(yo!=null){ctx.setLineDash([2,3]);ctx.lineWidth=1;ctx.strokeStyle=hexA(c,.9);ctx.beginPath();ctx.moveTo(xa,yo);ctx.lineTo(xb,yo);ctx.stroke();ctx.setLineDash([]);
          if(Q.bnm){const t=QT_SES[S.s]+" ("+S.hl.o.toFixed(dg)+")";ctx.font=font(10,1);const tw=ctx.measureText(t).width;let x=xb-tw-4;if(x<xa+4)x=xa+4;if(x<4)x=Math.min(4,xb-tw-4);
            if(x+tw>0&&x<w){ctx.textAlign="left";ctx.textBaseline="bottom";ctx.fillStyle=hexA(c,1);ctx.fillText(t,x,yo-2);ctx.textBaseline="middle"}}}}
      }
      // True Day Open: kéo đến hết ngày giao dịch, ngày hiện tại kéo hết chart
      if(Q.tdo!=="off"&&D.tdo!=null){
        const xa=X(D.tdoT+QT_OFF),xe=D.last?w:X(D.end+QT_OFF),yo=Y(D.tdo);
        if(xa!=null&&xe!=null&&yo!=null&&xe>0&&xa<w){const x1=Math.min(xe,w);ctx.setLineDash([1,3]);ctx.lineWidth=1;ctx.strokeStyle=hexA(ink(),.75);ctx.beginPath();ctx.moveTo(Math.max(0,xa),yo);ctx.lineTo(x1,yo);ctx.stroke();ctx.setLineDash([]);
          if(Q.bnm){const t="TDO ("+D.tdo.toFixed(dg)+")";ctx.font=font(10,1);const tw=ctx.measureText(t).width;ctx.textAlign="left";ctx.textBaseline="bottom";ctx.fillStyle=hexA(ink(),.9);ctx.fillText(t,Math.max(4,x1-tw-6),yo-2);ctx.textBaseline="middle"}}}
    }
  }finally{ctx.restore()}}
