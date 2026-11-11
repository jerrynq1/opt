/* ===== ICT Killzones & Pivots (indicator "kz") =====
   Port từ Pine Script "ICT Killzones & Pivots [TFO]" (tradeforopp, MPL-2.0) sang JS thuần cho chart này.
   Gồm: hộp Killzone theo phiên, pivot High/Low (kéo sang phải đến khi bị phá), midpoint, Range Levels (open ± k × range trung bình/trung vị/độ lệch chuẩn),
   Day/Week/Month (open, high/low/mid kỳ trước, đường chia, nhãn thứ trong tuần), giá mở cửa theo giờ, đường timestamp, bảng thống kê hit rate.
   Khác bản Pine: giá mở cửa lấy từ nến M1 đúng phút nên đúng cả khi khung lớn hơn M1; tooltip nhãn thay bằng tooltip của bảng thống kê (rê chuột lên ô).
   Phần trên (đến mốc "vẽ") là hàm thuần, được kiểm thử bằng tests/killzones.test.js; phần dưới vẽ lên canvas của chart. */

const KZN=6,KZ_DASH={Solid:[],Dotted:[2,3],Dashed:[6,4]},KZ_PX={Tiny:9,Small:11,Normal:13,Large:15,Huge:18};
const KZ_COL={aqua:"#00bcd4",black:"#363a45",blue:"#2962ff",fuchsia:"#e040fb",gray:"#787b86",grey:"#787b86",green:"#4caf50",lime:"#00e676",maroon:"#880e4f",navy:"#311b92",olive:"#808000",orange:"#ff9800",purple:"#9c27b0",red:"#f23645",silver:"#b2b5be",teal:"#089981",white:"#ffffff",yellow:"#fdd835"};
const KZ_DOW=["","SUNDAY","MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY"];

/* ---- đọc cài đặt ---- */
function kzMin(t){let s=String(t==null?"":t).replace(/[\s:]/g,"");if(s.length===3)s="0"+s;if(!/^\d{4}$/.test(s))return null;const h=+s.slice(0,2),m=+s.slice(2);return h<=23&&m<=59?h*60+m:null}
function kzSes(s){                                              // "2000-0000" -> [phút bắt đầu, phút kết thúc] (24:00 = 1440)
  const m=/^\s*(\d{1,2}:?\d{2})\s*-\s*(\d{1,2}:?\d{2})\s*$/.exec(String(s==null?"":s));if(!m)return null;
  const a=kzMin(m[1]),b=/^24:?00$/.test(m[2])?1440:kzMin(m[2]);return a==null||b==null?null:[a,b]}
const kzIn=(m,r)=>{const a=r[0],b=r[1];return a<b?m>=a&&m<b:a>b?(m>=a||m<b):true};
function kzColor(s,def){s=String(s==null?"":s).trim().toLowerCase();if(!s)return def;if(s[0]==="#"){const x=s.slice(1);return/^[0-9a-f]{6}([0-9a-f]{2})?$/.test(x)?"#"+x.slice(0,6):def}return KZ_COL[s]||def}
function kzLines(t){const o=[];for(const raw of String(t==null?"":t).split("\n")){const l=raw.trim();if(!l||l.startsWith("//"))continue;o.push(l.split(",").map(x=>x.trim()))}return o}
/* P = thông số, dc = [màu giờ mở cửa mặc định, màu timestamp mặc định]. Trả về Q: P + danh sách đã phân tích; bad = số dòng không đọc được */
function kzParse(P,dc){
  const bad={ses:0,opens:0,stamps:0,levels:0},kz=[];
  for(let k=1;k<=KZN;k++){const rg=kzSes(P["s"+k]);if(P["u"+k]&&!rg)bad.ses++;kz.push({on:!!P["u"+k],name:String(P["n"+k]||"").trim()||("KZ"+k),rg})}
  const lv=[];for(const f of kzLines(P.lvl)){const m=parseFloat(f[0]);if(isFinite(m)&&m>0)lv.push({mult:m,col:f[1]?kzColor(f[1],null):null});else bad.levels++}
  const op=[];for(const f of kzLines(P.otxt)){const mn=kzMin(f[0]);if(mn==null){bad.opens++;continue}
    const lb=f.slice(2).join(",").trim();op.push({min:mn,col:kzColor(f[1],dc[0]),txt:lb,tip:lb||(String(f[0]).replace(/[\s:]/g,"").padStart(4,"0")+" Open")})}
  const st=[];for(const f of kzLines(P.ttxt)){const mn=kzMin(f[0]);if(mn==null){bad.stamps++;continue}st.push({min:mn,col:kzColor(f[1],dc[1])})}
  const gm=/^GMT([+-]\d+)$/.exec(String(P.tz||""));
  return Object.assign({},P,{kz,lv,op,st,bad,cutR:P.cut?kzSes(P.cutS):null,gmt:gm?+gm[1]:null,tfl:+P.tfl||1800})}

/* ---- chuẩn bị mảng theo nến ---- */
function kzPrep(B,wall){
  const n=B.length,sod=new Float64Array(n),dayk=new Float64Array(n),wl=new Float64Array(n);
  for(let i=0;i<n;i++){const w=wall(B[i].st);wl[i]=w;sod[i]=(((w%86400)+86400)%86400)/60;dayk[i]=Math.floor(w/86400)}
  return{n,sod,dayk,wl}}

/* ---- phiên Killzone: nến đầu tiên (not in[1] and in) bắt đầu phiên mới; cao/thấp lấy lần đầu chạm đỉnh/đáy ---- */
function kzSessions(B,X,rg,inS){
  const S=[];let cur=null;
  for(let i=0;i<X.n;i++){
    if(!inS[i]){cur=null;continue}
    const b=B[i],key=X.dayk[i]-(rg[0]>rg[1]&&X.sod[i]<rg[1]?1:0);
    if(!cur||cur.key!==key){cur={key,i0:i,i1:i,open:b.open,hi:b.high,lo:b.low,hiI:i,loI:i,sd:[b.close-b.open]};S.push(cur)}
    else{cur.i1=i;if(b.high>cur.hi){cur.hi=b.high;cur.hiI=i}if(b.low<cur.lo){cur.lo=b.low;cur.loI=i}cur.sd.push(b.close-cur.open)}}
  for(const s of S)s.rg=s.hi-s.lo;
  return S}

/* Số đo biên độ từ tối đa lb phiên đã xong nằm trước chỉ số end. Average/Median: từ range (high-low) từng phiên; SD: độ lệch chuẩn (tổng thể) của close - open phiên, lấy mẫu trên mọi nến */
function kzMeasure(S,end,lb,kind){
  const L=S.slice(Math.max(0,end-lb),end);if(!L.length)return null;
  if(kind==="Average"){let s=0;for(const x of L)s+=x.rg;return s/L.length}
  if(kind==="Median"){const v=L.map(x=>x.rg).sort((p,q)=>p-q),h=v.length>>1;return v.length%2?v[h]:(v[h-1]+v[h])/2}
  let c=0,s=0,q=0;for(const x of L)for(const d of x.sd){c++;s+=d;q+=d*d}
  if(c<2)return null;const mu=s/c;return Math.sqrt(Math.max(0,q/c-mu*mu))}

/* ---- pivot: quét sau khi phiên kết thúc. Most Recent: đến hết trước phiên kế; All: đến khi bị loại bởi Session Limit; dừng ở nến đầu tiên thuộc giờ cutoff (tính cả nến đó) ---- */
function kzPivots(B,X,S,Q,inS,cutA){
  const n=X.n;
  S.forEach((s,k)=>{
    const nxt=k+1<S.length?S[k+1].i0:n,pop=k+Q.maxd<S.length?S[k+Q.maxd].i0:n;
    let end=(Q.extw==="recent"?nxt:pop)-1;
    if(Q.cut)for(let j=s.i1+1;j<=end;j++)if(cutA[j]){end=j;break}
    s.hiB=-1;s.loB=-1;
    for(let j=s.i1+1;j<=end;j++){
      if(s.hiB<0&&B[j].high>s.hi)s.hiB=j;
      if(s.loB<0&&B[j].low<s.lo)s.loB=j;
      if(s.hiB>=0&&s.loB>=0)break}
    s.scan=Math.max(end,s.i1);
    s.hiE=Q.ext==="mit"&&s.hiB>=0?s.hiB:s.scan;
    s.loE=Q.ext==="mit"&&s.loB>=0?s.loB:s.scan;
    s.mid=(s.hi+s.lo)/2;let me=s.scan;while(me>s.i1&&inS[me])me--;s.midE=Math.max(me,s.i1)})}

/* ---- Range Levels: open ± mult × số đo, chỉ sống trong phiên (đến cutoff nếu có) ---- */
function kzLevels(B,X,S,Q,cutA){
  const H=Q.lv.map(()=>({hi:[],lo:[]}));
  S.forEach((s,k)=>{
    const m=kzMeasure(S,k,Q.lbk,Q.meas);s.m=m;s.lv=null;if(!(m>0))return;
    let end=s.i1;if(Q.cut)for(let j=s.i0;j<=s.i1;j++)if(cutA[j]){end=j;break}
    s.lv=Q.lv.map((L,j)=>{
      const hiP=s.open+L.mult*m,loP=s.open-L.mult*m;let hB=-1,lB=-1;
      for(let i=s.i0;i<=end;i++){if(hB<0&&B[i].high>=hiP)hB=i;if(lB<0&&B[i].low<=loP)lB=i;if(hB>=0&&lB>=0)break}
      H[j].hi.push(hB>=0);H[j].lo.push(lB>=0);
      return{mult:L.mult,hiP,loP,hB,lB,end}})});
  return H}

/* ---- Day / Week / Month ---- */
function kzPeriods(B,keyFn){
  const P=[];let cur=null,ck=null;
  for(let i=0;i<B.length;i++){
    const k=keyFn(B[i].st),b=B[i];
    if(cur&&k===ck){cur.i1=i;if(b.high>cur.h)cur.h=b.high;if(b.low<cur.l)cur.l=b.low}
    else{ck=k;cur={i0:i,i1:i,o:b.open,h:b.high,l:b.low};P.push(cur)}}
  for(let p=1;p<P.length;p++){
    const c=P[p],pr=P[p-1];c.ph=pr.h;c.pl=pr.l;c.pm=(pr.h+pr.l)/2;c.pt=B[pr.i0].st;c.hB=-1;c.lB=-1;
    for(let i=c.i0;i<=c.i1;i++){if(c.hB<0&&B[i].high>c.ph)c.hB=i;if(c.lB<0&&B[i].low<c.pl)c.lB=i;if(c.hB>=0&&c.lB>=0)break}}
  return P}
const kzLim=(h,maxd)=>h==="recent"?1:h==="unl"?Infinity:maxd;

/* ---- nến chứa phút tMin của ngày (giờ của múi giờ đã chọn) ---- */
function kzHits(X,tf,tMin){
  const o=[],w=tf/60;if(tf>=86400)return o;
  for(let i=0;i<X.n;i++){const d=(((tMin-X.sod[i])%1440)+1440)%1440;if(d<w-1e-9)o.push({i,off:d})}
  return o}

/* env: wall(st) -> giây đồng hồ múi giờ, bucket(st,tf), monthKey(st), lookup(T) -> giá mở M1 hoặc null, tf (giây khung đang xem) */
function kzBuild(B,Q,env){
  const X=kzPrep(B,env.wall),n=X.n,cutA=new Uint8Array(n);
  if(Q.cut&&Q.cutR)for(let i=0;i<n;i++)cutA[i]=kzIn(X.sod[i],Q.cutR)?1:0;
  const M={n,X,kz:[],dwm:{},opens:[],stamps:[],dow:[],bad:Q.bad,cutA};
  Q.kz.forEach((z,k)=>{
    if(!z.on||!z.rg){M.kz.push(null);return}
    const inS=new Uint8Array(n);for(let i=0;i<n;i++)inS[i]=kzIn(X.sod[i],z.rg)?1:0;
    const S=kzSessions(B,X,z.rg,inS),o={k,name:z.name,S,inS,H:null,LH:null};
    if(Q.piv)kzPivots(B,X,S,Q,inS,cutA);
    if(Q.lv_on&&Q.lv.length)o.LH=kzLevels(B,X,S,Q,cutA);
    const last=S[S.length-1];
    o.rangeNow=last?last.rg:null;
    const ended=!last||!inS[n-1]||last.i1<n-1;
    o.mNow=kzMeasure(S,Q.meas==="Standard Deviation"?S.length-1:(ended?S.length:S.length-1),Q.lbk,Q.meas);
    if(Q.piv){o.H={hi:S.map(s=>s.hiB>=0),lo:S.map(s=>s.loB>=0)}}
    M.kz.push(o)});
  const dwmDefs=[["D",Q.dopen,Q.dhl,Q.dmid,Q.dsep,Q.dalrt,st=>Math.floor(st/86400)],["W",Q.wopen,Q.whl,Q.wmid,Q.wsep,Q.dalrt,st=>env.bucket(st,604800)],["M",Q.mopen,Q.mhl,Q.mmid,Q.msep,Q.dalrt,st=>env.monthKey(st)]];
  for(const[tf,op,hl,md,sp,al,fn]of dwmDefs){
    if(!(op||hl||sp))continue;
    const P=kzPeriods(B,fn),pp=P.filter(c=>c.ph!=null);
    M.dwm[tf]={P,op,hl,md,sp,hiH:pp.map(c=>c.hB>=0),loH:pp.map(c=>c.lB>=0),cur:P[P.length-1],prev:P.length>1?P[P.length-2]:null}}
  const resolve=hits=>hits.map(h=>{let T=B[h.i].st+h.off*60,pr=env.lookup?env.lookup(T):null;if(pr==null&&h.off===0)pr=B[h.i].open;return pr==null?null:{i:h.i,price:pr}}).filter(Boolean);
  if(Q.opn)for(const e of Q.op){
    const H=resolve(kzHits(X,env.tf,e.min)),lim=kzLim(Q.ohist,Q.maxd),L=[];
    H.forEach((h,j)=>{let end=j+1<H.length?H[j+1].i-1:n-1;
      if(Q.cut)for(let q=h.i+1;q<=end;q++)if(cutA[q]){end=q;break}
      L.push({i0:h.i,i1:Math.max(end,h.i),price:h.price})});
    M.opens.push({e,L:L.slice(-Math.min(L.length,lim))})}
  if(Q.tsh)for(const e of Q.st){const H=kzHits(X,env.tf,e.min),lim=kzLim(Q.thist,Q.maxd);M.stamps.push({e,L:H.slice(-Math.min(H.length,lim)).map(h=>h.i)})}
  if(Q.dow){const sh=Q.dowx==="mid"?43200:0;let pd=null;
    for(let i=0;i<n;i++){const d=Math.floor((X.wl[i]-sh)/86400);if(pd!=null&&d!==pd){const dw=(((d%7)+7)%7+4)%7+1;if(!(Q.dowh&&(dw===1||dw===7)))M.dow.push({i,txt:KZ_DOW[dw]})}pd=d}}
  return M}

const kzPct=(a,b)=>b>0?Math.round(a/b*100)+"%":"-";
const kzSucc=a=>a.reduce((s,v)=>s+(v?1:0),0);
function kzEvents(arr,N){const L=arr.slice(-N);let t="";L.forEach((v,i)=>{t+=v?"🟩":"🟥";if((i+1)%10===0&&i+1<L.length)t+="\n"});return t}

/* ===== vẽ ===== */
const KZ_POS={"Top Left":["t","l"],"Top Center":["t","c"],"Top Right":["t","r"],"Middle Left":["m","l"],"Middle Center":["m","c"],"Middle Right":["m","r"],"Bottom Left":["b","l"],"Bottom Center":["b","c"],"Bottom Right":["b","r"]};
const kzOn=()=>ACT.find(x=>x.key==="kz"&&isOn(x));
let KZM=null,KZS="",KZH="";const KZAL=new Set();
let KZE=null;
function kzEl(){if(!KZE){KZE=document.createElement("div");KZE.id="kzTbl";$("chart").appendChild(KZE)}return KZE}
const kzWall=Q=>Q.tz==="ny"||Q.gmt==null?(st=>st-25200):(st=>s2u(st)+Q.gmt*3600);
function kzLookup(T){let lo=0,hi=m1.length;while(lo<hi){const k=(lo+hi)>>1;m1[k][0]<T?lo=k+1:hi=k}return lo<m1.length&&m1[lo][0]===T?m1[lo][1]:null}
const kzMonth=st=>{const d=new Date(st*1000);return d.getUTCFullYear()*12+d.getUTCMonth()};

function kzModel(a,Q){
  const N=agg.length,from=Math.max(0,N-Math.max(500,Math.round(Q.maxb))),B=from?agg.slice(from):agg,last=agg[N-1];
  const sig=[N,from,C.tf,C.sym,B[0].st,last.high,last.low,last.close,m1.length,m1.length?m1[m1.length-1][4]:0,JSON.stringify(a.p)].join("|");
  if(KZM&&KZS===sig)return KZM;
  const M=kzBuild(B,Q,{wall:kzWall(Q),bucket,monthKey:kzMonth,lookup:kzLookup,tf:C.tf});M.off=from;M.B=B;
  KZM=M;KZS=sig;return M}

function kzAlert(msg){
  try{status("Killzones: "+msg,"ok")}catch{}
  try{const A=new (window.AudioContext||window.webkitAudioContext)(),o=A.createOscillator(),g=A.createGain();o.frequency.value=660;g.gain.value=.05;o.connect(g);g.connect(A.destination);o.start();o.stop(A.currentTime+.15)}catch{}}

const kzEsc=s=>String(s).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/\n/g,"&#10;");
function kzTable(a,Q,M,w,h){
  const el=kzEl();
  if(!Q.tbl){el.style.display="none";return}
  const fs=KZ_PX[Q.tsz]||11,sP=Q.spv&&Q.piv,sD=Q.sdw&&(Q.dhl||Q.whl||Q.mhl),sL=Q.slv&&Q.lv_on,N=Q.lbk,dg=pd();
  const cl=j=>cres(a,j),bg=(c,al)=>hexA(c,al),cell=(t,o={})=>`<td style="${o.bg?`background:${o.bg};`:""}"${o.tip?` title="${kzEsc(o.tip)}"`:""}>${t}</td>`;
  const mults=Q.lv;let hd=`<td></td>${cell("Range")}`;
  if(sP||sD)hd+=cell("High")+cell("Low");
  if(sL)for(const L of mults)hd+=cell("±"+L.mult+Q.sfx);
  let rows=`<tr>${hd}</tr>`;
  M.kz.forEach((o,k)=>{
    if(!o||!o.S.length)return;const c=cl(k),last=o.S[o.S.length-1];
    const avg=o.mNow,pct=avg>0?o.rangeNow/avg:null;
    let r=cell(o.name,{bg:bg(c,.45)});
    const rt=avg==null?`Range hiện tại: ${o.rangeNow.toFixed(dg)}\nChưa đủ phiên đã xong để tính ${Q.meas}`:`Range hiện tại: ${o.rangeNow.toFixed(dg)}, bằng ${Math.round(pct*100)}% của ${Q.meas} (${avg.toFixed(dg)}) tính từ ${Q.lbk} phiên gần nhất\nÔ tô màu: phiên hiện tại đã vượt giá trị đo`;
    r+=cell(o.rangeNow.toFixed(dg),{bg:pct!=null&&pct>=1?bg(c,.45):null,tip:rt});
    if(sP){for(const[nm,arr,bk]of[["High",o.H.hi,last.hiB],["Low",o.H.lo,last.loB]]){
      const T=arr.length,S=kzSucc(arr);
      r+=T?cell(kzPct(S,T),{bg:bk>=0?bg(c,.45):null,tip:`${o.name} ${nm}: ${kzPct(S,T)} hit rate trên ${T} phiên\n\n${N} lần gần nhất (cũ → mới):\n${kzEvents(arr,N)}`}):cell("-")}}
    else if(sD)r+=cell("")+cell("");
    if(sL){mults.forEach((L,j)=>{
      const hh=o.LH&&o.LH[j];
      if(hh&&hh.hi.length){const T=hh.hi.length,lv=last.lv&&last.lv[j],now=lv&&(lv.hB>=0||lv.lB>=0);
        r+=cell(kzPct(kzSucc(hh.hi),T)+"<br>"+kzPct(kzSucc(hh.lo),T),{bg:now?bg(c,.45):null,tip:`+${L.mult}${Q.sfx}: ${kzPct(kzSucc(hh.hi),T)} trên ${T} phiên\n${kzEvents(hh.hi,N)}\n\n-${L.mult}${Q.sfx}: ${kzPct(kzSucc(hh.lo),T)}\n${kzEvents(hh.lo,N)}\n\nÔ tô màu: mức đã bị chạm trong phiên hiện tại`})}
      else r+=cell("-")})}
    rows+=`<tr>${r}</tr>`});
  if(sD)for(const[tf,txt,jc,per]of[["D","PD",6,"ngày"],["W","PW",7,"tuần"],["M","PM",8,"tháng"]]){
    const d=M.dwm[tf];if(!d||!d.hl||!d.hiH.length)continue;
    const c=cl(jc),cur=d.cur,rg=cur.h-cur.l,pr=d.prev,prg=pr?pr.h-pr.l:0,pc=prg>0?rg/prg:0;
    let r=cell(txt,{bg:bg(c,.45)})+cell(rg.toFixed(dg),{bg:pc>=1?bg(c,.45):null,tip:`Range ${per} hiện tại ${rg.toFixed(dg)}, bằng ${Math.round(pc*100)}% range ${per} trước (${prg.toFixed(dg)})\nÔ tô màu: đã vượt range kỳ trước`});
    for(const[nm,arr,bk]of[["H",d.hiH,cur.hB],["L",d.loH,cur.lB]])r+=cell(kzPct(kzSucc(arr),arr.length),{bg:bk>=0?bg(c,.45):null,tip:`P${tf}${nm}: ${kzPct(kzSucc(arr),arr.length)} hit rate trên ${arr.length} ${per}\n\n${N} lần gần nhất (cũ → mới):\n${kzEvents(arr,N)}`});
    if(sL)for(let j=0;j<mults.length;j++)r+=cell("");
    rows+=`<tr>${r}</tr>`}
  const B=M.bad,nb=B.ses+B.opens+B.stamps+B.levels;
  const warn=nb?`<tr><td colspan="9" title="${kzEsc(`Có dòng cài đặt không đọc được: phiên ${B.ses}, giá mở cửa ${B.opens}, timestamp ${B.stamps}, range level ${B.levels}.\nĐịnh dạng: phiên 'HHMM-HHMM'; giờ mở cửa '0930, màu, nhãn'; timestamp '1200, màu'; level '1.5, màu'.`)}" style="text-align:left">⚠ ${nb} dòng cài đặt không đọc được</td></tr>`:"";
  const html=`<table>${rows}${warn}</table>`;
  if(html!==KZH){el.innerHTML=html;KZH=html}
  const[v,hz]=KZ_POS[Q.tpos]||KZ_POS["Top Right"],cw=$("chart").getBoundingClientRect(),st=el.style;
  st.display="block";st.fontSize=fs+"px";st.top=st.bottom=st.left=st.right="auto";st.transform="";
  const tr=[];
  if(v==="t")st.top="8px";else if(v==="b")st.bottom=(cw.height-h+8)+"px";else{st.top="50%";tr.push("translateY(-50%)")}
  if(hz==="l")st.left="8px";else if(hz==="r")st.right=(cw.width-w+8)+"px";else{st.left=(w/2)+"px";tr.push("translateX(-50%)")}
  if(tr.length)st.transform=tr.join(" ")}

function drawKZ(w,h){
  const a=kzOn(),el=kzEl();
  if(!a||!agg.length||!m1.length){el.style.display="none";return}
  const Q=kzParse(Object.assign(pdef(IND.kz),a.p),[cres(a,9),cres(a,10)]);
  if(C.tf>Q.tfl||C.tf>=86400){el.style.display="none";return}
  Q.sfx=Q.meas==="Average"?" avg":Q.meas==="Median"?" med":"σ";
  const M=kzModel(a,Q),off=M.off,lastI=M.n-1,px=KZ_PX[Q.lsz]||9,dash=n=>KZ_DASH[n]||[];
  const X=i=>ts.logicalToCoordinate(i+off),Y=p=>cs.priceToCoordinate(p),col=j=>cres(a,j);
  const x0b=X(0),x1b=X(1),bw=x0b!=null&&x1b!=null?Math.abs(x1b-x0b):6;
  const seg=(x0,x1,y,c,wd,ds)=>{if(x0==null||x1==null||y==null)return;if(Math.max(x0,x1)<-5||Math.min(x0,x1)>w+5)return;ctx.setLineDash(ds);ctx.lineWidth=wd;ctx.strokeStyle=c;ctx.beginPath();ctx.moveTo(x0,y);ctx.lineTo(x1,y);ctx.stroke()};
  const txt=(t,x,y,c,al,bl)=>{if(x==null||y==null||x<-200||x>w+300)return;ctx.fillStyle=c;ctx.textAlign=al;ctx.textBaseline=bl;ctx.fillText(t,x,y)};
  ctx.save();ctx.font=font(px,0);
  try{
    // đường chia + timestamp (toàn chiều cao)
    const vline=(i,c,wd,ds)=>{const x=X(i);if(x==null||x<-2||x>w+2)return;ctx.setLineDash(ds);ctx.lineWidth=wd;ctx.strokeStyle=c;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke()};
    for(const[tf,jc,hv]of[["D",6,Q.dsep],["W",7,Q.wsep],["M",8,Q.msep]]){const d=M.dwm[tf];if(!d||!hv)continue;
      d.P.slice(-Math.min(d.P.length,kzLim(Q.dhist,Q.maxd))).forEach(p=>vline(p.i0,col(jc),Q.hw,dash(Q.hst)))}
    for(const s of M.stamps)for(const i of s.L)vline(i,s.e.col,Q.tw,dash(Q.tstyle));
    // hộp killzone
    if(Q.kzbox)M.kz.forEach((o,k)=>{if(!o)return;const c=col(k);
      for(const s of o.S.slice(-Q.maxd)){const xa=X(s.i0),xb=X(s.i1),ya=Y(s.hi),yb=Y(s.lo);if(xa==null||xb==null||ya==null||yb==null)continue;
        const L=xa-bw/2,R=xb+bw/2;if(R<0||L>w)continue;
        ctx.fillStyle=hexA(c,Q.bxo);ctx.fillRect(L,ya,R-L,Math.max(1,yb-ya));ctx.setLineDash([]);ctx.lineWidth=1;ctx.strokeStyle=hexA(c,Math.min(1,Q.bxo+.3));ctx.strokeRect(L,ya,R-L,Math.max(1,yb-ya))}});
    // pivot, midpoint, nhãn
    if(Q.piv)M.kz.forEach((o,k)=>{if(!o)return;const c=col(k);
      for(const s of o.S.slice(-Q.maxd)){
        for(const[nm,pr,iA,iE,brk,sg]of[[" High",s.hi,s.hiI,s.hiE,s.hiB,-1],[" Low",s.lo,s.loI,s.loE,s.loB,1]]){
          const y=Y(pr),xa=X(iA),xe=X(iE);if(y==null)continue;
          seg(xa,xe,y,c,Q.pw,dash(Q.pst));
          if(Q.lbl){if(Q.lblr==="r"){if(brk>=0)txt(o.name+nm,xe,y+sg*3,c,"center",sg<0?"bottom":"top");else txt(o.name+nm,xe==null?null:xe+4,y,c,"left","middle")}
            else txt(o.name+nm,xa,y+sg*3,c,"center",sg<0?"bottom":"top")}}
        if(Q.mid){const y=Y(s.mid);seg(X(s.i1),X(s.midE),y,c,Q.mw,dash(Q.mst))}
        if(Q.alrt&&s===o.S[o.S.length-1]){
          for(const[nm,b]of[["High",s.hiB],["Low",s.loB]]){const key=C.sym+"|"+o.name+"|"+M.B[s.i0].st+"|"+nm;
            if(b===lastI&&!KZAL.has(key)){KZAL.add(key);kzAlert("giá phá "+o.name+" "+nm)}}}}});
    // range levels
    if(Q.lv_on)M.kz.forEach((o,k)=>{if(!o)return;
      for(const s of o.S.slice(-Q.maxd)){if(!s.lv)continue;
        s.lv.forEach((L,j)=>{const lc=Q.lv[j].col||col(k);
          for(const[pr,sg,tx]of[[L.hiP,-1,"+"+L.mult+Q.sfx],[L.loP,1,"-"+L.mult+Q.sfx]]){const y=Y(pr),xa=X(s.i0),xe=X(L.end);
            seg(xa,xe,y,lc,Q.lw,dash(Q.lst));txt(tx,xe==null?null:xe+4,y,lc,"left","middle")}})}});
    // D / W / M
    const merge=[];
    for(const[tf,jc,nm]of[["D",6,"D"],["W",7,"W"],["M",8,"M"]]){const d=M.dwm[tf];if(!d)continue;const c=col(jc),lim=kzLim(Q.dhist,Q.maxd),ds=dash(Q.hst),P=d.P;
      P.slice(-Math.min(P.length,lim)).forEach(p=>{
        const isLast=p===P[P.length-1];
        if(d.op){const y=Y(p.o);seg(X(p.i0),X(p.i1),y,c,Q.hw,ds);if(isLast)merge.push({y:p.o,x:X(p.i1),t:nm+" OPEN",c});else txt(nm+" OPEN",X(p.i1)==null?null:X(p.i1)+4,y,c,"left","middle")}
        if(d.hl&&p.ph!=null){
          for(const[pr,t]of[[p.ph,"P"+nm+"H"],[p.pl,"P"+nm+"L"],...(d.md?[[p.pm,"P"+nm+"M"]]:[])]){const y=Y(pr);seg(X(p.i0),X(p.i1),y,c,Q.hw,ds);
            if(isLast)merge.push({y:pr,x:X(p.i1),t,c});else txt(t,X(p.i1)==null?null:X(p.i1)+4,y,c,"left","middle")}}});
      if(d.hl&&Q.dalrt&&d.cur.ph!=null)for(const[nm2,b]of[["H",d.cur.hB],["L",d.cur.lB]]){const key=C.sym+"|P"+tf+nm2+"|"+M.B[d.cur.i0].st;if(b===lastI&&!KZAL.has(key)){KZAL.add(key);kzAlert("giá chạm P"+tf+nm2)}}}
    // nhãn D/W/M trùng giá thì gộp thành một (vd. "D OPEN / W OPEN")
    const done=new Set(),tk=Math.pow(10,-pd())/2;
    merge.forEach((m,i)=>{if(done.has(i))return;let t=m.t;merge.forEach((n2,j)=>{if(j>i&&!done.has(j)&&Math.abs(n2.y-m.y)<tk){done.add(j);t+=" / "+n2.t}});
      txt(t,m.x==null?null:m.x+4,Y(m.y),m.c,"left","middle")});
    // giá mở cửa theo giờ
    for(const g of M.opens)for(const L of g.L){const y=Y(L.price),xe=X(L.i1);
      seg(X(L.i0),xe,y,g.e.col,Q.ow,dash(Q.ost));if(g.e.txt)txt(g.e.txt,xe==null?null:xe+4,y,g.e.col,"left","middle")}
    // thứ trong tuần
    if(Q.dow)for(const d of M.dow){const x=X(d.i);txt(d.txt,x,Q.dowy==="top"?4:h-4,ink(),"center",Q.dowy==="top"?"top":"bottom")}
  }finally{ctx.restore()}
  kzTable(a,Q,M,w,h)}
