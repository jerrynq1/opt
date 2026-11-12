/* ================= KẾT NỐI cTrader (nhập key trực tiếp, không qua worker) ================= */
const cMsg=(t,bad)=>{const e=$("cMsg");e.textContent=t;e.style.color=bad?"var(--loss)":""};
const FIELDS={cId:"clientId",cSec:"clientSecret",cTok:"accessToken",cAcc:"accountId",cEnv:"env"};
function fillConn(){
  const c=ctCfg();
  for(const [id,k] of Object.entries(FIELDS))$(id).value=c[k];
  const i=CT.info;
  if(CT.ready&&i)cMsg("Đang kết nối: tài khoản "+i.accounts.find(x=>x.includes("id "+i.id))+" · máy chủ "+i.host+" · "+(CT.symbols||[]).length+" mã.");
  else if(!ctHasKey())cMsg("Chưa có key. Điền 3 ô đầu rồi bấm \"Lưu & kết nối\".");
}
const readConn=()=>{const o={};for(const [id,k] of Object.entries(FIELDS))o[k]=$(id).value.trim();return o};
$("cSave").onclick=async()=>{
  const o=readConn();
  if(!o.clientId||!o.clientSecret||!o.accessToken){cMsg("Cần nhập đủ Client ID, Client Secret và Access Token.",true);return}
  ctSaveCfg(o);cMsg("Đang kết nối...");$("cSave").disabled=true;ctClose();
  try{
    await ctEnsure();
    const i=CT.info;cMsg("Kết nối được: tài khoản "+i.accounts.find(x=>x.includes("id "+i.id))+" · "+(CT.symbols||[]).length+" mã. Vào mục Chart để xem.");
    loadM1();
  }catch(e){cMsg("Không kết nối được: "+why(e),true)}
  finally{$("cSave").disabled=false}
};
$("cClear").onclick=()=>{ctClose();ctClearCfg();fillConn();for(const id of Object.keys(FIELDS))if(id!=="cEnv")$(id).value="";$("cEnv").value="auto";cMsg("Đã xoá key khỏi trình duyệt này.")};
/* Xoá cache của web: ép trình duyệt tải lại từng file của trang (cache:"reload" ghi đè bản cũ trong HTTP cache), xoá Cache Storage + Service Worker, rồi tải lại.
   Không đụng localStorage nên key cTrader và cài đặt vẫn còn. */
$("cacheClr").onclick=async()=>{
  const b=$("cacheClr"),m=$("cacheMsg");b.disabled=true;m.textContent="Đang xoá cache…";
  try{
    try{if(window.caches)for(const k of await caches.keys())await caches.delete(k)}catch{}
    try{if(navigator.serviceWorker)for(const r of await navigator.serviceWorker.getRegistrations())await r.unregister()}catch{}
    const u=new Set([location.pathname+location.search,location.href.split("#")[0]]);
    document.querySelectorAll("script[src],link[rel=stylesheet][href],link[rel~=icon][href],img[src]").forEach(e=>{const x=e.src||e.href;if(x&&x.startsWith(location.origin))u.add(x)});
    await Promise.all([...u].map(x=>fetch(x,{cache:"reload"}).catch(()=>{})));
    m.textContent="Xong, đang tải lại trang…";
    setTimeout(()=>{const q=new URL(location.href);q.searchParams.set("_",Date.now());q.hash="#conn";location.replace(q.toString())},300);
  }catch(e){m.textContent="Không xoá được: "+(e&&e.message||e);b.disabled=false}
};
document.querySelectorAll("[data-show]").forEach(b=>b.onclick=()=>{const i=$(b.dataset.show),h=i.type==="password";i.type=h?"text":"password";b.textContent=h?"Ẩn":"Hiện"});

/* ================= GIAO DIỆN: sidebar, theme, bầu trời sao ================= */
const IC={chart:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4v16h16"/><path d="M8 15l3-4 3 2 5-6"/></svg>',conn:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3v5M15 3v5M6 8h12v4a6 6 0 0 1-12 0z"/><path d="M12 18v3"/></svg>'};
IC.ind='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17c3-8 5-8 8-3s5 3 10-8"/><path d="M3 21h18"/></svg>';
IC.qqqOptions='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 18V6M4 18h16"/><path d="m7 15 3-4 3 2 5-7"/><circle cx="18" cy="6" r="1.5"/></svg>';
IC.gldOptions='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17M3.5 12h17"/><path d="m8 8 8 8m0-8-8 8"/></svg>';
const V=[["chart","Chart"],["qqqOptions","QQQ Options"],["gldOptions","GLD Options"],["ind","Kho Indicator"],["conn","Kết nối cTrader"]];
// Mobile navigation follows the iOS watchlist pattern: QQQ, GLD, primary Chart, Indicators, Connection.
const MOBILE_V=[["qqqOptions","QQQ","QQQ Options"],["gldOptions","GLD","GLD Options"],["chart","Chart","Chart"],["ind","Indicators","Kho Indicator"],["conn","Connection","Kết nối cTrader"]];
let cur="chart";
function renderMobileNav(v){
  const nav=$("mobileBottomNav");if(!nav)return;
  nav.innerHTML=MOBILE_V.map(([k,label,title])=>`<button class="mobile-tab${k===v?" on":""}${k==="chart"?" is-center":""}" data-v="${k}" type="button" title="${title}" aria-label="${title}"${k===v?' aria-current="page"':''}><span class="mobile-tab-icon">${IC[k]}</span><span class="mobile-tab-label">${label}</span></button>`).join("");
}
function show(v){
  cur=v;document.body.dataset.v=v;const titles={chart:"Chart",qqqOptions:"QQQ Options",gldOptions:"GLD Options",ind:"Kho Indicator",conn:"Kết nối cTrader"};if($("workspaceTitle"))$("workspaceTitle").textContent=titles[v]||v;
  if(typeof stockOptionsSetActive==="function")stockOptionsSetActive(v==="qqqOptions"||v==="gldOptions"?v:null);
  V.forEach(([k])=>$("v-"+k).classList.toggle("on",k===v));
  $("nav").innerHTML=V.map(([k,n])=>`${k==="chart"?'<div class="nav-sep" role="separator"><span>MARKET</span></div>':''}<button class="sb${k===v?" on":""}" data-v="${k}" title="${n}" type="button"${k===v?' aria-current="page"':''}><span class="ic">${IC[k]}</span><span class="lb">${n}</span></button>`).join("");
  renderMobileNav(v);
  if(v==="ind"){buildInd()}
  if(v==="conn")fillConn();
  document.body.classList.remove("so");
  try{history.replaceState(null,"","#"+v)}catch(e){}
}
$("nav").onclick=e=>{const b=e.target.closest("[data-v]");if(b)show(b.dataset.v)};
$("mobileBottomNav")?.addEventListener("click",e=>{const b=e.target.closest("[data-v]");if(b)show(b.dataset.v)});
const mob=()=>matchMedia("(max-width:760px)").matches;
function setSide(){document.body.classList.toggle("sc",!mob()&&P.sc)}
const tgl=()=>{if(mob())document.body.classList.toggle("so");else{P.sc=!P.sc;sv("tp_sc",P.sc?"1":"0");setSide()}};
$("tg").onclick=tgl;$("tg2").onclick=tgl;$("scrim").onclick=()=>document.body.classList.remove("so");
function setTheme(){
  document.documentElement.dataset.theme=P.theme;sv("tp_theme",P.theme);sv("gx-theme",P.theme);
  $("th").innerHTML=P.theme==="dark"?'<span class="ic">☀</span><span class="lb">Sáng</span>':'<span class="ic">🌙</span><span class="lb">Tối</span>';
  themeChart();
}
$("th").onclick=()=>{P.theme=P.theme==="dark"?"light":"dark";setTheme()};

/* Simple workspace: decorative starfield removed for a cleaner, lighter interface. */
