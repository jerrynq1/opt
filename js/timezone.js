/* ================= MÚI GIỜ =================
   cTrader trả thời gian UTC. App quy mọi nến về "giờ server kiểu New York close" (UTC+2 mùa đông / UTC+3 mùa hè Mỹ, giống đa số broker MT5),
   nên nến D1/W1 vẫn cắt đúng 17:00 New York. Trục thời gian và đồng hồ lại quy đổi sang múi giờ người dùng chọn bằng Intl (tên IANA),
   tự đổi theo giờ mùa (DST) của từng nước. */
const p2=n=>String(n).padStart(2,"0");
let DEVZ="UTC";try{DEVZ=Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC"}catch{}
let TZ=ld("tp_tz","")||DEVZ,SRVD=null,SRVL=null,SRVN=0,SRVH=[{from:0,off:7200}],SRVOK=false;
const PF={},OC={};let OCN=0;
const pf=z=>PF[z]||(PF[z]=new Intl.DateTimeFormat("en-US",{timeZone:z,hourCycle:"h23",year:"numeric",month:"numeric",day:"numeric",hour:"numeric",minute:"numeric",second:"numeric"}));
try{pf(TZ)}catch{TZ="UTC"}
function parts(z,ms){const o={};pf(z).formatToParts(new Date(ms)).forEach(x=>{if(x.type!=="literal")o[x.type]=+x.value});o.hour%=24;return o}
// độ lệch (giây) của múi giờ z so với UTC tại thời điểm ms, đã tính giờ mùa
function tzOff(z,ms){
  const k=z+"|"+Math.floor(ms/900000);let v=OC[k];if(v!==undefined)return v;
  const o=parts(z,ms);v=Math.round((Date.UTC(o.year,o.month-1,o.day,o.hour,o.minute,o.second)-Math.floor(ms/1000)*1000)/1000);
  if(++OCN>4000){for(const x in OC)delete OC[x];OCN=0}
  return OC[k]=v;
}
/* Lịch giờ server cố định theo giờ mùa Mỹ (không cần dò). SRVH = [{from: giờ server, off: giây lệch UTC}]; cTrader trả UTC nên chỉ cần u2s() / s2u(). */
(function(){
  const nthSun=(y,m,n)=>{const k=(7-new Date(Date.UTC(y,m,1)).getUTCDay())%7;return Date.UTC(y,m,1+k+7*(n-1))/1000};
  SRVH=[{from:0,off:7200}];
  for(let y=2010;y<=2040;y++){
    SRVH.push({from:nthSun(y,2,2)+7*3600+10800,off:10800});   // Chủ nhật thứ 2 của tháng 3, 02:00 NY -> UTC+3
    SRVH.push({from:nthSun(y,10,1)+6*3600+7200,off:7200});    // Chủ nhật đầu tiên của tháng 11, 02:00 NY -> UTC+2
  }
  SRVOK=true;
})();
const srvCur=()=>tzOff("America/New_York",Date.now())+25200;   // độ lệch giờ server hiện tại
function srvAt(t){for(let i=SRVH.length-1;i>0;i--)if(t>=SRVH[i].from)return SRVH[i].off;return SRVH[0].off}
const toUtcMs=t=>(t-srvAt(t))*1000;
const s2u=t=>t-srvAt(t);                                                    // giờ server -> UTC (giây)
const u2s=u=>u+tzOff("America/New_York",u*1000)+25200;                      // UTC (giây) -> giờ server
// Thời gian đưa vào chart = đồng hồ của múi giờ đã chọn (coi như UTC), để lưới trục (00:00, 03:00, 06:00...) khớp giờ người dùng.
// st (giờ server) vẫn giữ nguyên để gom nến D1/W1 đúng ranh giới của broker.
function disp(st){if(TZ==="srv")return st;const u=toUtcMs(st);return Math.round(u/1000+tzOff(TZ,u))}
const lp=t=>parts("UTC",t*1000);
const lbl=s=>"UTC"+(s<0?"-":"+")+Math.floor(Math.abs(s)/3600)+(Math.abs(s)%3600?":"+p2(Math.round(Math.abs(s)%3600/60)):"");
function tickFmt(t){if(typeof t!=="number")return null;const o=lp(t);if(C.tf<60&&o.second)return p2(o.hour)+":"+p2(o.minute)+":"+p2(o.second);if(C.tf<86400&&(o.hour||o.minute))return p2(o.hour)+":"+p2(o.minute);if(o.day===1)return o.month===1?String(o.year):"Th"+o.month;return String(o.day)}
function crossFmt(t){if(typeof t!=="number")return "";const o=lp(t);return p2(o.day)+"/"+p2(o.month)+"/"+String(o.year).slice(2)+(C.tf<86400?"  "+p2(o.hour)+":"+p2(o.minute)+(C.tf<60?":"+p2(o.second):""):"")}
function applyTz(){allCh().forEach(x=>x.applyOptions({localization:{timeFormatter:t=>crossFmt(t)},timeScale:{tickMarkFormatter:t=>tickFmt(t)}}))}
function clk(){
  const now=Date.now(),sv_=TZ==="srv",o=sv_?parts("UTC",now+srvCur()*1000):parts(TZ,now);
  $("clkT").textContent=p2(o.hour)+":"+p2(o.minute)+":"+p2(o.second);
  $("clkZ").textContent=sv_?"Server "+lbl(srvCur()):lbl(tzOff(TZ,now));
}
const COMMON=["UTC","Asia/Ho_Chi_Minh","Asia/Bangkok","Asia/Singapore","Asia/Hong_Kong","Asia/Shanghai","Asia/Tokyo","Asia/Seoul","Asia/Kolkata","Asia/Dubai","Europe/Moscow","Europe/Istanbul","Europe/London","Europe/Paris","Europe/Berlin","America/New_York","America/Chicago","America/Los_Angeles","Australia/Sydney","Pacific/Auckland"];
let ALLZ=[];try{ALLZ=Intl.supportedValuesOf("timeZone")}catch{}
if(!ALLZ.length)ALLZ=[...COMMON];
const zname=z=>z==="srv"?"Giờ server (New York close)":z.replace(/_/g," ").replace("/"," · ");
function tzList(){
  const q=($("tzq").value||"").trim().toLowerCase(),now=Date.now();
  let L=q?["srv","UTC",...ALLZ].filter(z=>(z+" "+zname(z)).toLowerCase().includes(q)).slice(0,80):[...new Set(["srv",DEVZ,...COMMON])];
  if(!L.includes(TZ))L.unshift(TZ);
  $("tzl").innerHTML=L.length?L.map(z=>{let off="";try{off=lbl(z==="srv"?srvCur():tzOff(z,now))}catch{return ""}
    return `<button type="button" class="tzi${z===TZ?" on":""}" data-z="${z}"><span>${zname(z)}${z===DEVZ?" (thiết bị)":""}</span><span>${off}</span></button>`}).join(""):`<span class="msg" style="padding:6px 8px">Không tìm thấy múi giờ.</span>`;
}
function srvHint(){
  const e=$("srvHint");if(!e)return;
  e.textContent="Giờ server: cTrader trả UTC, app quy đổi kiểu New York close ("+lbl(srvCur())+" hiện tại), tự đổi theo giờ mùa Mỹ.";
}
function openTz(){
  $("tzp").innerHTML=`<input id="tzq" type="search" placeholder="Tìm múi giờ (vd: Tokyo, London, New York)" aria-label="Tìm múi giờ" autocomplete="off"><div id="tzl"></div>
  <small class="msg" id="srvHint"></small>`;
  $("tzp").classList.add("on");$("clkB").setAttribute("aria-expanded","true");tzList();srvHint();
}
function closeTz(){$("tzp").classList.remove("on");$("clkB").setAttribute("aria-expanded","false")}
function tzChanged(){applyTz();clk();if(agg.length)rebuild(false);if($("tzq")){tzList();srvHint()}}
$("clkB").onclick=()=>$("tzp").classList.contains("on")?closeTz():openTz();
$("tzp").onclick=e=>{const b=e.target.closest("[data-z]");if(!b)return;TZ=b.dataset.z;sv("tp_tz",TZ);tzChanged()};
$("tzp").oninput=e=>{if(e.target.id==="tzq")tzList()};
document.addEventListener("click",e=>{if($("tzp").classList.contains("on")&&!e.composedPath().some(n=>n.id==="tzp"||n.id==="clk"))closeTz()});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&$("tzp").classList.contains("on")&&!document.querySelector(".mdl")){closeTz();$("clkB").focus()}});
