/* ================= KHO INDICATOR =================
   Mỗi indicator: {n,t:"of"|"mm"|"ov"|"osc",ver,p,c,L,hl,f}
   - p  : thông số [khóa, nhãn, mặc định, kiểu, {min,max,step,o,g,tt,on}]  kiểu: "n" số | "i" số nguyên | "s" chọn | "b" bật/tắt
   - c/L: màu mặc định và tên từng ô màu. Màu "@up"/"@dn" = theo màu nến tăng/giảm (tự đổi theo theme và Chart Setting)
   - hl : đường ngang tham chiếu (hline trong Pine)
   - f  : (A,p,E,a)=>[series]; series {k:"l" đường | "h" cột | "f" vùng tô giữa 2 đường | "c" nến, d, ci (ô màu), lw, ls, al, g, ...} */
const P_=n=>Math.max(1,Math.round(n));
const sma=(a,p)=>{const st=a.findIndex(v=>v!=null),o=Array(a.length).fill(null);if(st<0)return o;let s=0;for(let i=st;i<a.length;i++){s+=a[i];if(i-st>=p)s-=a[i-p];if(i-st>=p-1)o[i]=s/p}return o};
const mav=(a,p,k)=>{const st=a.findIndex(v=>v!=null),o=Array(a.length).fill(null);if(st<0)return o;let e=null,s=0;for(let i=st;i<a.length;i++){if(i-st<p-1){s+=a[i];continue}if(e===null){s+=a[i];e=s/p}else e=a[i]*k+e*(1-k);o[i]=e}return o};
const rma=(a,p)=>mav(a,p,1/p);                                   // ta.rma: mồi bằng SMA
const ema=(a,p)=>{const k=2/(p+1);let e=null;return a.map(v=>{if(v==null)return null;e=e===null?v:v*k+e*(1-k);return e})};   // ta.ema: mồi bằng giá trị đầu tiên, giống Pine
const wma=(a,p)=>{const o=Array(a.length).fill(null),st=a.findIndex(v=>v!=null);if(st<0)return o;const w=p*(p+1)/2;for(let i=st+p-1;i<a.length;i++){let s=0;for(let j=0;j<p;j++)s+=a[i-j]*(p-j);o[i]=s/w}return o};
const sdv=(a,p)=>{const o=Array(a.length).fill(null),st=a.findIndex(v=>v!=null);if(st<0)return o;for(let i=st+p-1;i<a.length;i++){let m=0;for(let j=i-p+1;j<=i;j++)m+=a[j];m/=p;let v=0;for(let j=i-p+1;j<=i;j++)v+=(a[j]-m)**2;o[i]=Math.sqrt(v/p)}return o};   // ta.stdev (độ lệch chuẩn tổng thể)
const rolling=(a,p,fn)=>a.map((_,i)=>i<p-1?null:fn.apply(null,a.slice(i-p+1,i+1)));
const trg=(A,h)=>A.h.map((hh,i)=>i?Math.max(hh-A.l[i],Math.abs(hh-A.c[i-1]),Math.abs(A.l[i]-A.c[i-1])):(h===false?null:hh-A.l[i]));   // ta.tr(true); h=false: nến đầu là na
const L1=d=>[{k:"l",d,ci:0}];
const hexA=(h,a)=>{h=String(h||"#ffffff");if(h[0]!=="#"||h.length<7)return h;const n=parseInt(h.slice(1,7),16);return`rgba(${n>>16&255},${n>>8&255},${n&255},${a})`};
const cres=(a,j,E)=>{const v=a.c[j];E=E||eff();return v==="@up"?E.up:v==="@dn"?E.dn:(v||"#ffffff")};
const SRC=[["open","Open"],["high","High"],["low","Low"],["close","Close"],["hl2","HL2"],["hlc3","HLC3"],["ohlc4","OHLC4"],["hlcc4","HLCC4"]];
const srcOf=(A,k)=>{A._s=A._s||{};if(A._s[k])return A._s[k];const{o,h,l,c}=A;let r;
  switch(k){case"open":r=o;break;case"high":r=h;break;case"low":r=l;break;case"hl2":r=h.map((x,i)=>(x+l[i])/2);break;case"hlc3":r=h.map((x,i)=>(x+l[i]+c[i])/3);break;case"ohlc4":r=h.map((x,i)=>(o[i]+x+l[i]+c[i])/4);break;case"hlcc4":r=h.map((x,i)=>(x+l[i]+2*c[i])/4);break;default:r=c}
  return A._s[k]=r};
const shiftA=(d,n)=>{n=Math.round(n)||0;if(!n)return d;const o=Array(d.length).fill(null);for(let i=0;i<d.length;i++){const j=i+n;if(j>=0&&j<d.length)o[j]=d[i]}return o};
const MAS=["SMA","EMA","SMMA (RMA)","WMA","VWMA"];
const maF=(t,a,n,A)=>t==="EMA"?ema(a,n):t==="SMMA (RMA)"?rma(a,n):t==="WMA"?wma(a,n):t==="VWMA"?(()=>{const pv=sma(a.map((x,i)=>x==null?null:x*A.v[i]),n),vv=sma(A.v,n);return pv.map((x,i)=>x==null||!vv[i]?null:x/vv[i])})():sma(a,n);
// Khóa chu kỳ neo (VWAP, CVD): đổi khóa = bắt đầu chu kỳ mới. s = giờ server (giây) coi như UTC
const perKey=t=>{const Y=s=>new Date(s*1000).getUTCFullYear(),M=s=>new Date(s*1000).getUTCMonth();
  switch(t){case"Week":return s=>Math.floor((s-345600)/604800);case"Month":return s=>Y(s)*12+M(s);case"Quarter":return s=>Y(s)*4+Math.floor(M(s)/3);case"Year":return Y;case"Decade":return s=>Math.floor(Y(s)/10);case"Century":return s=>Math.floor(Y(s)/100);default:return s=>Math.floor(s/86400)}};
const ANCH=[["Session","Phiên (ngày)"],["Week","Tuần"],["Month","Tháng"],["Quarter","Quý"],["Year","Năm"]];
// Cụm thông số "Làm mượt" dùng chung cho EMA và RSI (đường MA của chính chỉ báo, tùy chọn kèm Bollinger Bands)
const SMP=dt=>[
  ["mt","Loại MA",dt,"s",{g:"Làm mượt",o:[["None","Không"],["SMA","SMA"],["SMA + Bollinger Bands","SMA + Bollinger Bands"],["EMA","EMA"],["SMMA (RMA)","SMMA (RMA)"],["WMA","WMA"],["VWMA","VWMA"]]}],
  ["ml","Chu kỳ MA",14,"i",{g:"Làm mượt",min:1,on:p=>p.mt!=="None"}],
  ["bm","Độ lệch chuẩn BB",2,"n",{g:"Làm mượt",min:.001,max:50,step:.5,on:p=>p.mt==="SMA + Bollinger Bands",tt:"Khoảng cách giữa SMA và hai dải, tính theo độ lệch chuẩn."}]];
function smooth(A,p,x,iMA,iBB){
  const t=p.mt;if(!t||t==="None")return[];
  const ml=P_(p.ml),isB=t==="SMA + Bollinger Bands",m=maF(isB?"SMA":t,x,ml,A),S=[{k:"l",d:m,ci:iMA}];
  if(isB){const sd=sdv(x,ml),up=m.map((v,i)=>v==null||sd[i]==null?null:v+sd[i]*p.bm),lo=m.map((v,i)=>v==null||sd[i]==null?null:v-sd[i]*p.bm);
    S.push({k:"l",d:up,ci:iBB,lw:1},{k:"l",d:lo,ci:iBB,lw:1},{k:"f",ci:iBB,al:.1,d:up.map((v,i)=>v==null?null:{top:v,bottom:lo[i]})})}
  return S}
const rsiOf=(x,n)=>{const g=[null],l=[null];for(let i=1;i<x.length;i++){const d=x[i]-x[i-1];g.push(Math.max(d,0));l.push(Math.max(-d,0))}
  const ag=rma(g,n),al=rma(l,n);return ag.map((v,i)=>v==null||al[i]==null?null:al[i]===0?100:v===0?0:100-100/(1+v/al[i]))};
// Phân kỳ RSI (pivot 5/5, khoảng cách 5–60 nến) như script gốc: đường nối 2 đáy/đỉnh + nhãn Bull/Bear
function rsiDiv(A,r,E){
  const LB=5,RB=5,n=r.length,bu=[],be=[],mk=[],tr="rgba(0,0,0,0)";let pl=null,ph=null;
  for(let i=LB+RB;i<n;i++){const q=i-RB,v=r[q];if(v==null)continue;let isL=true,isH=true;
    for(let j=q-LB;j<=i;j++){if(j===q)continue;const w=r[j];if(w==null){isL=isH=false;break}
      if(j<q){if(v>w)isL=false;if(v<w)isH=false}else{if(v>=w)isL=false;if(v<=w)isH=false}}
    if(isL){let c=false;if(pl){const bs=i-pl.i-1;c=v>pl.r&&bs>=5&&bs<=60&&A.l[q]<pl.px}
      bu.push({t:A.t[q],v,c:c?E.up:tr});if(c)mk.push({time:A.t[q],position:"belowBar",shape:"arrowUp",color:E.up,text:"Bull"});pl={i,r:v,px:A.l[q]}}
    if(isH){let c=false;if(ph){const bs=i-ph.i-1;c=v<ph.r&&bs>=5&&bs<=60&&A.h[q]>ph.px}
      be.push({t:A.t[q],v,c:c?E.dn:tr});if(c)mk.push({time:A.t[q],position:"aboveBar",shape:"arrowDown",color:E.dn,text:"Bear"});ph={i,r:v,px:A.h[q]}}}
  return{S:[{k:"l",sp:true,d:bu,lw:2,lg:false},{k:"l",sp:true,d:be,lw:2,lg:false}],mk}}
// Nến delta từ nến M1 (tick volume của MT5): mỗi M1 tính là mua nếu đóng>mở, bán nếu đóng<mở; bằng nhau thì so với đóng nến trước, vẫn bằng thì giữ hướng nến trước.
// keyFn=null: delta tính lại từ 0 ở mỗi nến (Volume Delta); có keyFn: cộng dồn và reset khi sang chu kỳ neo mới (CVD).
function dCandles(A,keyFn,a,E,isUp){
  const n=A.c.length,O=Array(n).fill(null),H=Array(n).fill(null),Lo=Array(n).fill(null),La=Array(n).fill(null);
  let p=0,cum=0,pd=1,cur=-1,lk=null,go=false;
  const B=baseArr();for(let j=0;j<B.length;j++){const x=B[j],o=x[1],c=x[4],v=x[5]||0,pc=j?B[j-1][4]:o;
    const dir=c>o?1:c<o?-1:c>pc?1:c<pc?-1:pd;pd=dir;
    const k=bucket(x[0],C.tf);while(p<n&&A.s[p]<k)p++;if(p>=n)break;if(A.s[p]!==k)continue;
    if(p!==cur){cur=p;const key=keyFn?keyFn(A.s[p]):p;if(!go||key!==lk)cum=0;go=true;lk=key;O[p]=H[p]=Lo[p]=cum}
    cum+=dir*v;if(cum>H[p])H[p]=cum;if(cum<Lo[p])Lo[p]=cum;La[p]=cum}
  const up=cres(a,0,E),dn=cres(a,1,E);
  return[{k:"c",d:O.map((o,i)=>o==null?null:{v:La[i],o,h:H[i],l:Lo[i],col:isUp(La[i],o)?up:dn})}]}
const IND={
 fpr:{n:"Footprint",t:"of",ver:2,d:"Khối lượng mua/bán tại từng mức giá trong mỗi nến. Zoom vào để thấy các ô. Với CFD là số ước lượng từ chuỗi báo giá bid/ask (mua đặt ở Ask, bán đặt ở Bid).",
  p:[["ty","Kiểu","ab","s",{g:"Dữ liệu",mn:1,o:[["ab","Ask / Bid"],["vol","Volume"],["dl","Delta"],["dv","Delta + Volume"]]}],
     ["md","Chế độ","box","s",{o:[["box","Box"],["prof","Profile"]]}],
     ["step","Bước giá",0.5,"n",{mn:1,min:0.01,step:0.01,tt:"Gộp các mức giá thành từng hàng có độ cao này (đơn vị giá). Vàng thường dùng 0.5 hoặc 1."}],
     ["auto","Tự gộp hàng khi zoom ra",true,"b",{tt:"Khi zoom ra, tự gộp các mức giá thành hàng cao hơn để ô luôn đủ lớn, dễ nhìn."}],
     ["fmt","Định dạng số","auto","s",{o:[["auto","Tự động"],["n","Đầy đủ"],["k","K (nghìn)"]]}],
     ["zero","Hiện số 0",false,"b"],["dyn","Cỡ chữ động",false,"b"],
     ["ratio","Imbalance ≥",3,"n",{g:"Imbalance",mn:1,min:1.5,step:0.5,hp:["Imbalance là gì?", "Imbalance (mất cân bằng) là khi một bên mua hoặc bán áp đảo hẳn bên đối diện. Ở đây so theo đường chéo: Mua (Ask) ở một mức giá được so với Bán (Bid) ở mức giá thấp hơn 1 hàng; Bán ở một mức giá được so với Mua ở mức giá cao hơn 1 hàng.", "Nếu bên này lớn hơn bên kia từ ngưỡng này trở lên (ví dụ 3 lần), ô đó sáng lên và chữ đậm.", "Ví dụ ngưỡng 3: Mua 90 tại 2000.5 và Bán 20 tại 2000.0 → 90 ≥ 3 × 20, nên ô Mua 90 là imbalance mua.", "Ngưỡng càng cao thì càng ít ô sáng nhưng tín hiệu càng mạnh. Hay dùng 3."]}],
     ["imv","Volume tối thiểu của ô imbalance",0,"i",{min:0,tt:"Ô chỉ được tính là imbalance khi volume của nó từ mức này trở lên. Dùng để loại các imbalance giả do volume quá nhỏ (vd 3 so với 1). 0 = không lọc."}],
     ["stk","Stacked imbalance (số hàng liên tiếp, 0 = tắt)",3,"i",{min:0,max:20,tt:"Từ chừng này hàng liên tiếp cùng một phía imbalance trở lên thì đánh dấu thanh màu ở mép ô. Thường là vùng giá có phe mua/bán áp đảo mạnh."}],
     ["cm","Chế độ","fade","s",{g:"Màu nền",o:[["none","Không"],["fix","Cố định"],["fade","Mờ dần"]]}],
     ["cc","Tính theo","imb","s",{o:[["imb","Imbalance"],["vol","Volume"],["dl","Delta"],["dom","Volume áp đảo"]],on:p=>p.cm!=="none"}],
     ["op","Độ mờ",0.6,"n",{min:0.1,max:1,step:0.05,on:p=>p.cm!=="none"}],
     ["poc","POC volume",true,"b",{g:"POC"}],["dpoc","POC delta",false,"b"],
     ["va","Bật Value Area",false,"b",{g:"Value Area"}],
     ["vap","Phần trăm Value Area (%)",70,"i",{min:10,max:100,on:p=>p.va}],
     ["vaout","Làm mờ ngoài vùng",true,"b",{on:p=>p.va}],
     ["valn","Đường VAH/VAL",true,"b",{on:p=>p.va}]],
  c:["#26c882","#ba32c4","#ffd700"],L:["Ask (mua)","Bid (bán)","Màu viền POC"],lab:p=>(p.ty==="ab"?"Ask/Bid":p.ty==="vol"?"Volume":p.ty==="dl"?"Delta":"Delta+Vol")+" "+p.step,f:()=>[]},
 bt:{n:"Big Trade",t:"of",d:"Bong bóng đánh dấu các lệnh mua hoặc bán lớn bất thường (chuỗi tick cùng chiều), kèm vùng ngang tùy chọn. Với CFD là số ước lượng từ chuỗi báo giá bid/ask.",
  p:[["step","Bước giá",0.5,"n",{g:"Dữ liệu",mn:1,min:0.01,step:0.01}],
     ["bm","Cách xác định lệnh lớn","run","s",{mn:1,o:[["run","Chuỗi tick cùng chiều"],["lvl","Volume tại mức giá trong 1 phút"]],hp:["Hai cách xác định lệnh lớn","Chuỗi tick cùng chiều (khuyên dùng): một lệnh là chuỗi tick liên tiếp cùng chiều mua hoặc cùng chiều bán, không bị ngắt quá lâu. Gần với một lệnh thị trường quét sổ lệnh nhất, không bị cắt đôi ở ranh giới phút.","Volume tại mức giá trong 1 phút: tổng volume mua hoặc bán tại một mức giá trong một phút M1 (cách cũ). Nhiều lệnh nhỏ rải rác trong phút vẫn có thể bị gộp thành một lệnh lớn.","CFD không có dữ liệu khớp lệnh thật nên cả hai đều là số ước lượng."]}],
     ["gap","Ngắt chuỗi khi nghỉ quá (ms)",300,"i",{min:50,max:5000,tt:"Hai tick liên tiếp cùng chiều cách nhau quá thời gian này thì tính là hai lệnh khác nhau. Nhỏ hơn: lệnh ngắn hơn, nhiều hơn. Đổi giá trị sẽ tải lại dữ liệu tick.",on:p=>p.bm!=="lvl"}],
     ["fm","Chế độ lọc","auto","s",{g:"Lọc",mn:1,hp:["Big Trade là gì?", "Big Trade là lệnh lớn bất thường: khối lượng của một lệnh Mua (Ask) hoặc Bán (Bid) vượt ngưỡng lọc (số tick của chuỗi, hoặc volume tại một mức giá trong một phút, tùy cách xác định). Mỗi bong bóng là một lệnh như vậy; bóng càng to và đậm thì volume càng lớn.", "Tự động: ngưỡng tính theo phân vị của các lệnh đã đóng (Thấp ≈ top 3%, Vừa ≈ top 1%, Mạnh ≈ top 0.3%), tự thích nghi với từng mã. Thủ công: bạn tự đặt volume Min và Max.", "Vùng (Zones) là đường ngang kéo dài từ lệnh lớn sang các nến sau, thường là vùng giá có phản ứng."],o:[["auto","Tự động"],["man","Thủ công"]]}],
     ["lv","Cường độ","med","s",{mn:1,o:[["low","Thấp"],["med","Vừa"],["str","Mạnh"]],on:p=>p.fm==="auto"}],
     ["mn","Min",15,"i",{min:1,on:p=>p.fm==="man"}],
     ["mx","Max (0 = không giới hạn)",0,"i",{min:0,on:p=>p.fm==="man"}],
     ["cap","Tối đa mỗi nến (0 = không giới hạn)",2,"i",{min:0,tt:"Chỉ giữ các lệnh lớn nhất trong mỗi nến để chart đỡ rối."}],
     ["hol","Rỗng ruột",false,"b",{g:"Bong bóng"}],
     ["smin","Cỡ nhỏ nhất",8,"i",{min:2}],["smax","Cỡ lớn nhất",34,"i",{min:4}],
     ["sdk","Độ lệch chuẩn",1,"n",{min:0.5,step:0.5}],
     ["omin","Độ mờ nhỏ nhất",0.25,"n",{min:0.05,max:1,step:0.05}],["omax","Độ mờ lớn nhất",0.85,"n",{min:0.05,max:1,step:0.05}],
     ["txt","Hiện số volume",true,"b",{g:"Chữ"}],["ins","Chỉ hiện trong thân nến",false,"b",{on:p=>p.txt}],["tsz","Cỡ chữ",11,"i",{min:7,max:20,on:p=>p.txt}],
     ["zon","Bật",false,"b",{g:"Vùng (Zones)"}],["zbig","Chỉ lệnh lớn nhất mỗi nến",true,"b",{on:p=>p.zon}],
     ["zsh","Ở râu nến","all","s",{o:[["all","Tất cả"],["rev","Đảo chiều"],["trend","Theo xu hướng"],["none","Không vẽ"]],on:p=>p.zon}],["zbo","Ở thân nến","all","s",{o:[["all","Tất cả"],["rev","Đảo chiều"],["trend","Theo xu hướng"],["none","Không vẽ"]],on:p=>p.zon}],
     ["zop","Độ mờ",0.16,"n",{min:0.02,max:1,step:0.02,on:p=>p.zon}],["zbar","Kéo dài (nến)",20,"i",{min:1,max:200,on:p=>p.zon}],["ztr","Cắt vùng khi giá chạm lại",true,"b",{on:p=>p.zon}]],
  c:["#26c882","#ba32c4","#ffffff"],L:["Màu Mua (Ask)","Màu Bán (Bid)","Màu chữ"],lab:p=>String(p.step),f:()=>[]},
 dst:{n:"Statistic",t:"of",d:"Bảng số liệu nằm dưới chart, mỗi nến một cột: volume Mua/Bán, delta, CVD, COT, tỉ lệ cạn lực, effort và các chỉ số orderflow khác. Tô sáng ô vượt ngưỡng bạn đặt. Dùng độc lập, không cần bật Footprint. Với CFD là số ước lượng.",
  p:[["step","Bước giá",0.5,"n",{g:"Dữ liệu",mn:1,min:0.01,step:0.01}],
     ["tot","Tổng volume",true,"b",{g:"Dòng cơ bản"}],["ask","Ask (mua)",true,"b"],["bid","Bid (bán)",true,"b"],
     ["dl","Delta",true,"b"],["dp","Delta %",true,"b"],["cvd","CVD (cộng dồn theo ngày)",true,"b"],
     ["mxd","Max Delta",false,"b",{g:"Dòng nâng cao",hp:["Các dòng nâng cao là gì?", "Max Delta / Min Delta: delta cao nhất và thấp nhất đạt được trong nến (tính theo từng phút nên chỉ là ước lượng).", "COT H: delta cộng dồn từ lần cuối nến chạm đáy tới giá đóng. COT L: từ lần cuối chạm đỉnh tới giá đóng. Nến giảm mà COT H dương (hoặc nến tăng mà COT L âm) cho thấy bên chủ động đang bị hấp thụ. Tính theo phút nên khung M1 luôn bằng 0.", "High Ratio: Ask ở hàng sát đỉnh chia Ask ở hàng đỉnh. Low Ratio: Bid ở hàng sát đáy chia Bid ở hàng đáy. Số lớn nghĩa là hàng cuối có rất ít người chủ động, dấu hiệu cạn lực.", "Effort: tổng volume (hoặc delta) chia biên độ nến. Cao nghĩa là tốn nhiều volume mới đẩy giá đi được một bước.", "Số lệnh: dùng tick volume M1 của MT5 (số lần giá đổi), không phải số lệnh thật. Chưa có Delta NT vì dữ liệu không tách số lệnh Ask/Bid.", "Bar Ratio: hiện High Ratio ở nến giảm và Low Ratio ở nến tăng. Thời gian nến: thời lượng nến; nến đang chạy là số giây đã trôi qua."]}],["mnd","Min Delta",false,"b"],["nt","Số lệnh (tick MT5)",false,"b"],["hl","Biên độ (số bước giá)",false,"b"],
     ["vps","Volume mỗi giây",false,"b"],["cth","COT H",false,"b"],["ctl","COT L",false,"b"],["ctb","COT Bar",false,"b"],["tm","Thời gian nến (giây)",false,"b"],["br","Bar Ratio",false,"b"],
     ["hr","High Ratio",false,"b"],["lr","Low Ratio",false,"b"],["te","Total Effort",false,"b"],["de","Delta Effort",false,"b"],
     ["fmn","Min filter",0,"n",{g:"Lọc dữ liệu",min:0,step:1,tt:"Chỉ tính volume Mua hoặc Bán tại mỗi mức giá trong mỗi phút nếu nằm trong khoảng Min–Max. Dữ liệu gộp theo phút nên đây là lọc xấp xỉ, không phải lọc từng lệnh. Để 0 là không lọc."}],["fmx","Max filter (0 = không giới hạn)",0,"n",{min:0,step:1}],...[["tot","Tổng volume",1],["ask","Ask (mua)",1],["bid","Bid (bán)",1],["dl","Delta",1],["dp","Delta %",5],["cvd","CVD (cộng dồn theo ngày)",10],["mxd","Max Delta",1],["mnd","Min Delta",1],["nt","Số lệnh (tick MT5)",10],["hl","Biên độ (số bước giá)",1],["vps","Volume mỗi giây",0.5],["cth","COT H",1],["ctl","COT L",1],["ctb","COT Bar",1],["br","Bar Ratio",0.5],["hr","High Ratio",0.5],["lr","Low Ratio",0.5],["te","Total Effort",1],["de","Delta Effort",1]].map(([k,l,st],j)=>["th_"+k,l,0,"n",j?{min:0,step:st}:{g:"Ngưỡng tô sáng (0 = tắt)",min:0,step:st,tt:"Ô nào có giá trị tuyệt đối từ ngưỡng trở lên sẽ được tô bằng màu ngưỡng (đổi ở tab Kiểu dáng) để dễ thấy. Để 0 là tắt."}]),["rh","Chiều cao dòng",18,"i",{g:"Hiển thị",min:12,max:40}],["fs","Cỡ chữ",10,"i",{min:7,max:16}],
     ["cmp","Số gọn (K/M)",true,"b"],["inv","Đảo thứ tự dòng",false,"b"],["lbl","Hiện tên dòng",true,"b"],["hs","Cỡ chữ tên dòng",10,"i",{min:7,max:16,on:p=>p.lbl}],["hbg","Nền cho tên dòng",true,"b",{on:p=>p.lbl}],
     ["sdk","Độ lệch chuẩn tô màu",2,"n",{min:0.5,step:0.5,hp:["Độ lệch chuẩn tô màu là gì?", "Mỗi ô được tô đậm dần theo giá trị của nó so với mức trung bình của cả dòng.", "Giá trị này là số độ lệch chuẩn cộng thêm vào mức trung bình để đạt độ đậm tối đa. Nhỏ hơn thì nhiều ô đậm hơn; lớn hơn thì chỉ những ô thật nổi bật mới đậm. Ô đạt mức tối đa có thêm viền sáng."]}],["op","Độ mờ nền",0.6,"n",{min:0.1,max:1,step:0.05}]],
  c:["#26c882","#ba32c4","#ffd700"],L:["Màu dương / Ask","Màu âm / Bid","Màu ngưỡng tô sáng"],lab:p=>String(p.step),f:()=>[]},
 sma:{n:"SMA",t:"ov",d:"Trung bình động đơn giản. Làm mượt giá, nhìn xu hướng.",p:[["period","Chu kỳ",20,"i",{min:1}]],c:["#ffb02e"],L:["SMA"],f:(A,p)=>L1(sma(A.c,P_(p.period)))},
 ema:{n:"EMA",t:"ov",ver:2,d:"Trung bình động hàm mũ, nhạy với giá gần đây hơn SMA. Có thêm đường MA làm mượt (tùy chọn, kèm Bollinger Bands) và dịch chuyển.",
  p:[["period","Chu kỳ",9,"i",{min:1}],["src","Nguồn","close","s",{o:SRC}],["offset","Dịch chuyển (nến)",0,"i",{min:-500,max:500}],...SMP("None")],
  c:["#35b6ff","#ffb02e","@up"],L:["EMA","MA làm mượt","Dải BB"],lab:p=>`${p.period} ${p.src}${p.offset?" "+p.offset:""}`,
  f:(A,p)=>{const out=ema(srcOf(A,p.src),P_(p.period));return[{k:"l",d:out,ci:0},...smooth(A,p,out,1,2)]}},
 wma:{n:"WMA",t:"ov",d:"Trung bình động có trọng số, nến mới nặng hơn.",p:[["period","Chu kỳ",20,"i",{min:1}]],c:["#ff8a5c"],L:["WMA"],f:(A,p)=>L1(wma(A.c,P_(p.period)))},
 bb:{n:"Bollinger Bands",t:"ov",ver:2,d:"Dải biến động quanh đường MA, rộng/hẹp theo độ lệch chuẩn. Chọn được loại MA, nguồn giá và dịch chuyển.",
  p:[["period","Chu kỳ",20,"i",{min:1,tt:"Số nến dùng để tính đường MA gốc (Basis) và độ lệch chuẩn."}],
     ["mt","Loại MA của Basis","SMA","s",{o:MAS}],["src","Nguồn","close","s",{o:SRC}],
     ["mult","Độ lệch chuẩn",2,"n",{min:.001,max:50,step:.5,tt:"Số lần độ lệch chuẩn từ Basis tới dải trên/dưới."}],
     ["offset","Dịch chuyển (nến)",0,"i",{min:-500,max:500}]],
  c:["#ffb02e","#35b6ff","#35b6ff"],L:["Basis","Dải trên","Dải dưới"],lab:p=>`${p.period} ${p.mt} ${p.mult}${p.offset?" "+p.offset:""}`,
  f:(A,p)=>{const x=srcOf(A,p.src),n=P_(p.period),b=maF(p.mt,x,n,A),s=sdv(x,n),
    up=b.map((v,i)=>v==null||s[i]==null?null:v+p.mult*s[i]),lo=b.map((v,i)=>v==null||s[i]==null?null:v-p.mult*s[i]);
    return[{k:"l",d:b,ci:0},{k:"l",d:up,ci:1,lw:1},{k:"l",d:lo,ci:2,lw:1},{k:"f",ci:1,al:.08,d:up.map((v,i)=>v==null?null:{top:v,bottom:lo[i]})}]}},
 dc:{n:"Donchian Channel",t:"ov",d:"Kênh đỉnh/đáy của N nến gần nhất, hay dùng cho breakout.",p:[["period","Chu kỳ",20,"i",{min:1}]],c:["#35b6ff","#98a2d8","#35b6ff"],L:["Trên","Giữa","Dưới"],
  f:(A,p)=>{const n=P_(p.period),hh=rolling(A.h,n,Math.max),ll=rolling(A.l,n,Math.min);return[{k:"l",d:hh},{k:"l",d:hh.map((v,i)=>v==null?null:(v+ll[i])/2)},{k:"l",d:ll}]}},
 vwap:{n:"VWAP",t:"ov",ver:2,d:"Giá trung bình theo khối lượng, reset theo chu kỳ neo (phiên/tuần/tháng/quý/năm…), kèm tối đa 3 dải. Dùng tick volume của MT5.",
  p:[["anchor","Chu kỳ neo","Session","s",{g:"VWAP",o:[...ANCH,["Decade","Thập kỷ"],["Century","Thế kỷ"]],tt:"VWAP được tính lại từ đầu mỗi khi sang chu kỳ mới (theo giờ server MT5)."}],
     ["src","Nguồn","hlc3","s",{g:"VWAP",o:SRC}],["offset","Dịch chuyển (nến)",0,"i",{g:"VWAP",min:-500,max:500}],
     ["hide","Ẩn ở khung D1 trở lên",false,"b",{g:"VWAP"}],
     ["bmode","Cách tính dải","Standard Deviation","s",{g:"Dải",o:[["Standard Deviation","Độ lệch chuẩn"],["Percentage","Phần trăm"]],tt:"Khi chọn Phần trăm, hệ số 1 nghĩa là 1% giá VWAP."}],
     ["s1","Hiện dải #1",true,"b",{g:"Dải"}],["m1","Hệ số dải #1",1,"n",{g:"Dải",min:0,step:.5,on:p=>p.s1}],
     ["s2","Hiện dải #2",false,"b",{g:"Dải"}],["m2","Hệ số dải #2",2,"n",{g:"Dải",min:0,step:.5,on:p=>p.s2}],
     ["s3","Hiện dải #3",false,"b",{g:"Dải"}],["m3","Hệ số dải #3",3,"n",{g:"Dải",min:0,step:.5,on:p=>p.s3}]],
  c:["#8b7cff","#2fe0b0","#ffb02e","#35b6ff"],L:["VWAP","Dải #1","Dải #2","Dải #3"],lab:p=>`${p.anchor} ${p.src}`,
  f:(A,p)=>{const n=A.c.length,x=srcOf(A,p.src),kf=perKey(p.anchor),vw=Array(n).fill(null),sd=Array(n).fill(null);
    if(!(p.hide&&C.tf>=86400)){let key=null,sv=0,sp=0,sq=0;
      for(let i=0;i<n;i++){const k=kf(A.s[i]);if(i===0||k!==key){key=k;sv=0;sp=0;sq=0}
        const v=A.v[i]||0;sv+=v;sp+=x[i]*v;sq+=x[i]*x[i]*v;
        if(sv>0){const m=sp/sv;vw[i]=m;sd[i]=Math.sqrt(Math.max(sq/sv-m*m,0))}}}
    const S=[{k:"l",d:vw,ci:0}];
    [[p.s1,p.m1],[p.s2,p.m2],[p.s3,p.m3]].forEach(([on,m],b)=>{if(!on)return;
      const bs=vw.map((v,i)=>v==null?null:p.bmode==="Percentage"?v*.01:sd[i]),
        up=vw.map((v,i)=>bs[i]==null?null:v+bs[i]*m),lo=vw.map((v,i)=>bs[i]==null?null:v-bs[i]*m);
      S.push({k:"l",d:up,ci:b+1,lw:1},{k:"l",d:lo,ci:b+1,lw:1},{k:"f",ci:b+1,al:.08,d:up.map((v,i)=>v==null?null:{top:v,bottom:lo[i]})})});
    return S}},
 st:{n:"Supertrend",t:"ov",ver:2,rc:true,d:"Đường xu hướng theo ATR, đổi màu khi đảo chiều, có vùng tô giữa thân nến và đường. Màu mặc định theo màu nến tăng/giảm.",
  p:[["period","Chu kỳ ATR",10,"i",{min:1}],["mult","Hệ số",3,"n",{min:.01,step:.01}]],
  c:["@up","@dn"],L:["Xu hướng tăng","Xu hướng giảm"],lab:p=>`${p.period} ${p.mult}`,
  f:(A,p,E,a)=>{const n=A.c.length,atr=rma(trg(A),P_(p.period)),f=+p.mult,lb=Array(n).fill(null),ub=Array(n).fill(null),st=Array(n).fill(null),dr=Array(n).fill(null);
    // đúng thuật toán ta.supertrend: nguồn hl2, dải bị "kẹp" theo dải trước và giá đóng cửa trước; direction -1 = xu hướng tăng
    for(let i=0;i<n;i++){if(atr[i]==null)continue;const m=(A.h[i]+A.l[i])/2;let u=m+f*atr[i],l=m-f*atr[i];
      const pl=i>0&&lb[i-1]!=null?lb[i-1]:0,pu=i>0&&ub[i-1]!=null?ub[i-1]:0,pc=i>0?A.c[i-1]:A.c[i];
      l=(l>pl||pc<pl)?l:pl;u=(u<pu||pc>pu)?u:pu;
      let d;if(i===0||atr[i-1]==null)d=1;else if(st[i-1]===ub[i-1])d=A.c[i]>u?-1:1;else d=A.c[i]<l?1:-1;
      lb[i]=l;ub[i]=u;dr[i]=d;st[i]=d===-1?l:u}
    const cu=hexA(cres(a,0,E),.12),cd=hexA(cres(a,1,E),.12);
    return[{k:"l",d:st.map((v,i)=>dr[i]===-1?v:null),ci:0},{k:"l",d:st.map((v,i)=>dr[i]===1?v:null),ci:1},
      {k:"f",pc:true,ci:0,d:st.map((v,i)=>v==null?null:{top:(A.o[i]+A.c[i])/2,bottom:v,col:dr[i]===-1?cu:cd})}]}},
 rsi:{n:"RSI",t:"osc",ver:2,rc:true,d:"Chỉ số sức mạnh tương đối 0–100 (quá mua >70, quá bán <30), có gradient vùng quá mua/quá bán, đường MA làm mượt và tùy chọn phân kỳ.",
  p:[["period","Chu kỳ RSI",14,"i",{g:"RSI",min:1}],["src","Nguồn","close","s",{g:"RSI",o:SRC}],
     ["div","Tính phân kỳ",false,"b",{g:"RSI",tt:"Bật để hiện nhãn Bull/Bear khi giá và RSI phân kỳ (pivot 5 nến mỗi bên)."}],...SMP("SMA")],
  c:["#8b7cff","#ffb02e","@up","@up","@dn"],L:["RSI","MA làm mượt","Dải BB","Gradient quá mua","Gradient quá bán"],
  hl:[{y:70,al:.5},{y:50,al:.28},{y:30,al:.5}],lab:p=>`${p.period} ${p.src}`,
  f:(A,p,E)=>{const r=rsiOf(srcOf(A,p.src),P_(p.period)),S=[{k:"l",d:r,ci:0},...smooth(A,p,r,1,2)];
    S.push({k:"f",ci:0,al:.09,d:r.map(v=>v==null?null:{top:70,bottom:30})},
      {k:"f",ci:3,g:{y1:100,y2:70,a1:.8,a2:0},d:r.map(v=>v==null?null:{top:v,bottom:50})},
      {k:"f",ci:4,g:{y1:30,y2:0,a1:0,a2:.8},d:r.map(v=>v==null?null:{top:v,bottom:50})});
    if(p.div){const dv=rsiDiv(A,r,E);S.push(...dv.S);S[0].mk=dv.mk}
    return S}},
 macd:{n:"MACD",t:"osc",ver:2,d:"Hội tụ/phân kỳ trung bình động: histogram 4 sắc độ, đường MACD và Signal. Chọn được loại MA (EMA/SMA).",
  p:[["src","Nguồn","close","s",{o:SRC}],["fast","Chu kỳ nhanh",12,"i",{min:1}],["slow","Chu kỳ chậm",26,"i",{min:1}],["signal","Chu kỳ Signal",9,"i",{min:1}],
     ["ot","Loại MA của dao động","EMA","s",{o:["EMA","SMA"]}],["sgt","Loại MA của Signal","EMA","s",{o:["EMA","SMA"]}]],
  c:["#35b6ff","#ffb02e"],L:["MACD","Signal"],hl:[{y:0,al:.5}],pf:"auto",lab:p=>`${p.fast} ${p.slow} ${p.src} ${p.signal}`,
  f:(A,p,E)=>{const x=srcOf(A,p.src),m=(t,a,n)=>t==="SMA"?sma(a,n):ema(a,n),af=m(p.ot,x,P_(p.fast)),as=m(p.ot,x,P_(p.slow)),
      mc=af.map((v,i)=>v==null||as[i]==null?null:v-as[i]),sg=m(p.sgt,mc,P_(p.signal)),hv=mc.map((v,i)=>v==null||sg[i]==null?null:v-sg[i]);
    // 4 sắc độ như bản gốc: dương tăng (đậm) / dương giảm (nhạt) / âm hồi (nhạt) / âm giảm sâu (đậm)
    const hc=hv.map((h,i)=>{if(h==null)return null;const pv=i?hv[i-1]:null,rise=pv!=null&&h>pv,strong=h>=0?rise:!rise;return{v:h,c:(h>=0?E.up:E.dn)+(strong?"cc":"55")}});
    return[{k:"h",d:hc},{k:"l",d:mc,ci:0},{k:"l",d:sg,ci:1}]}},
 stoch:{n:"Stochastic",t:"osc",ver:2,d:"So giá đóng cửa với biên độ N nến. Quá mua >80, quá bán <20.",
  p:[["k","Chu kỳ %K",14,"i",{min:1}],["sk","Làm mượt %K",1,"i",{min:1}],["d","Làm mượt %D",3,"i",{min:1}]],
  c:["#35b6ff","#ffb02e"],L:["%K","%D"],hl:[{y:80,al:.5},{y:50,al:.28},{y:20,al:.5}],lab:p=>`${p.k} ${p.sk} ${p.d}`,
  f:(A,p)=>{const n=P_(p.k),r=A.c.map((c,i)=>{if(i<n-1)return null;let hh=-Infinity,ll=Infinity;for(let j=i-n+1;j<=i;j++){if(A.h[j]>hh)hh=A.h[j];if(A.l[j]<ll)ll=A.l[j]}return hh===ll?50:(c-ll)/(hh-ll)*100}),
      K=sma(r,P_(p.sk)),D=sma(K,P_(p.d));
    return[{k:"l",d:K,ci:0},{k:"l",d:D,ci:1},{k:"f",ci:0,al:.07,d:K.map(v=>v==null?null:{top:80,bottom:20})}]}},
 atr:{n:"ATR",t:"osc",ver:2,d:"Biên độ dao động trung bình thực. Dùng để đặt SL theo biến động. Chọn được kiểu làm mượt.",
  p:[["period","Chu kỳ",14,"i",{min:1}],["ms","Làm mượt","RMA","s",{o:["RMA","SMA","EMA","WMA"]}]],
  c:["#ff8a5c"],L:["ATR"],pf:"auto",lab:p=>`${p.ms} ${p.period}`,
  f:(A,p)=>L1(maF(p.ms==="RMA"?"SMMA (RMA)":p.ms,trg(A),P_(p.period),A))},
 adx:{n:"ADX",t:"osc",ver:2,d:"Average Directional Index: đo độ mạnh của xu hướng (không phân biệt chiều). Có thể bật thêm +DI / −DI.",
  p:[["adx","ADX làm mượt",14,"i",{min:1}],["di","Chu kỳ DI",14,"i",{min:1}],["sdi","Hiện +DI / −DI",false,"b"]],
  c:["#ffb02e","@up","@dn"],L:["ADX","+DI","−DI"],lab:p=>`${p.adx} ${p.di}`,
  f:(A,p)=>{const n=A.c.length,dl=P_(p.di),al=P_(p.adx),up=[null],dn=[null];
    for(let i=1;i<n;i++){up.push(A.h[i]-A.h[i-1]);dn.push(-(A.l[i]-A.l[i-1]))}
    const pdm=up.map((u,i)=>u==null?null:(u>dn[i]&&u>0?u:0)),mdm=dn.map((d,i)=>d==null?null:(d>up[i]&&d>0?d:0)),
      tr=rma(trg(A,false),dl),pp=rma(pdm,dl),mm=rma(mdm,dl),
      fix=a=>{let l=null;return a.map(v=>{if(v==null||!isFinite(v))return l;l=v;return v})},      // fixnan
      plus=fix(pp.map((v,i)=>v==null||!tr[i]?null:100*v/tr[i])),minus=fix(mm.map((v,i)=>v==null||!tr[i]?null:100*v/tr[i])),
      dx=plus.map((v,i)=>{if(v==null||minus[i]==null)return null;const s=v+minus[i];return Math.abs(v-minus[i])/(s===0?1:s)}),
      adx=rma(dx,al).map(v=>v==null?null:100*v),S=[{k:"l",d:adx,ci:0}];
    if(p.sdi)S.push({k:"l",d:plus,ci:1,lw:1},{k:"l",d:minus,ci:2,lw:1});
    return S}},
 cci:{n:"CCI",t:"osc",d:"Commodity Channel Index. Vượt ±100 là giá lệch mạnh khỏi trung bình.",p:[["period","Chu kỳ",20,"i",{min:1}]],c:["#8b7cff"],L:["CCI"],hl:[{y:-100,al:.5},{y:100,al:.5}],
  f:(A,p)=>{const n=P_(p.period),tp=A.c.map((c,i)=>(A.h[i]+A.l[i]+c)/3),m=sma(tp,n);return L1(tp.map((v,i)=>{if(m[i]==null)return null;let s=0;for(let j=i-n+1;j<=i;j++)s+=Math.abs(tp[j]-m[i]);const md=s/n;return md?(v-m[i])/(0.015*md):0}))}},
 vd:{n:"Volume Delta",t:"osc",ver:2,rc:true,fm:"vol",pf:"vol",d:"Chênh lệch khối lượng mua – bán trong từng nến, vẽ dạng nến delta. Ước lượng từ nến M1 (tick volume MT5), không phải dữ liệu tick thật.",
  p:[],c:["@up","@dn"],L:["Delta dương","Delta âm"],hl:[{y:0,al:.5}],
  f:(A,p,E,a)=>dCandles(A,null,a,E,l=>l>0)},
 cvd:{n:"CVD",t:"osc",ver:2,rc:true,fm:"vol",pf:"vol",d:"Cumulative Volume Delta: delta cộng dồn theo chu kỳ neo, vẽ dạng nến. Ước lượng từ nến M1 (tick volume MT5), không phải dữ liệu tick thật.",
  p:[["anchor","Chu kỳ neo","Session","s",{o:ANCH,tt:"CVD được đặt lại về 0 mỗi khi sang chu kỳ mới (theo giờ server MT5)."}]],
  c:["@up","@dn"],L:["CVD tăng","CVD giảm"],hl:[{y:0,al:.5}],lab:p=>p.anchor,
  f:(A,p,E,a)=>dCandles(A,perKey(p.anchor),a,E,(l,o)=>l>=o)},


};
