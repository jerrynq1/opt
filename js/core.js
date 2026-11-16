const $=id=>document.getElementById(id);
/* Lưu cài đặt (mã, khung giờ, indicator, theme...) trong localStorage của trình duyệt. */
const kk=k=>k;
const ld=(k,d)=>{try{return localStorage.getItem(kk(k))??d}catch{return d}};
const ld0=(k,d)=>{try{return localStorage.getItem(k)??d}catch{return d}};
const sv=(k,v)=>{try{localStorage.setItem(kk(k),v)}catch{}};
const TFS=[["M1",60],["M5",300],["M15",900],["M30",1800],["H1",3600],["H4",14400],["D1",86400],["W1",604800]]; // thanh nhanh, giữ bố cục quen thuộc
const TF_EXTRA=[["S1",1],["S2",2],["S3",3],["S5",5],["S10",10],["S15",15],["S20",20],["S30",30],
  ["M2",120],["M3",180],["M4",240],["M10",600],["M20",1200],["M45",2700],
  ["H2",7200],["H3",10800],["H6",21600],["H8",28800],["H12",43200],
  ["D2",172800],["D3",259200],["W2",1209600],["W3",1814400],["W4",2419200]];
const TF_PRESETS=[...TFS,...TF_EXTRA];
const isPresetTf=s=>TF_PRESETS.some(t=>t[1]===s);
/* ===== Khung giờ tuỳ chọn =====
   Quick row giữ các khung quen thuộc; menu More có thêm preset, favorite và custom timeframe.
   Khung giây lấy từ tick (lịch sử tick hiện có giới hạn riêng); từ M1 trở lên tổng hợp từ nến M1.
   Custom interval lưu chung localStorage và được dùng cho mọi chart. */
const TF_MAX=2419200,TF_UNIT={s:1,m:60,h:3600,d:86400,w:604800},TF_CAP=24,TF_FAV_CAP=6;
const okTf=s=>Number.isInteger(s)&&s>=1&&s<=TF_MAX&&(s<60||s%60===0);
const tfName=s=>{const p=TF_PRESETS.find(t=>t[1]===s);if(p)return p[0];
  if(s<60)return"S"+s;if(s%604800===0)return"W"+s/604800;if(s%86400===0)return"D"+s/86400;if(s%3600===0)return"H"+s/3600;if(s%60===0)return"M"+s/60;return s+"s"};
let CTF=[],TFF=[];
const loadCtf=()=>{try{CTF=[...new Set((JSON.parse(ld0("tp_ctf","[]"))||[]).map(Number).filter(s=>okTf(s)&&!isPresetTf(s)))].sort((a,b)=>a-b).slice(0,TF_CAP)}catch{CTF=[]}};
const saveCtf=()=>{try{localStorage.setItem("tp_ctf",JSON.stringify(CTF))}catch{}};
const loadTfFavs=()=>{try{TFF=[...new Set((JSON.parse(ld0("tp_tffav","[]"))||[]).map(Number).filter(s=>okTf(s)&&(isPresetTf(s)||CTF.includes(s))))].slice(0,TF_FAV_CAP)}catch{TFF=[]}};
const saveTfFavs=()=>{try{localStorage.setItem("tp_tffav",JSON.stringify(TFF))}catch{}};
const allTfs=()=>[...TF_PRESETS,...CTF.map(s=>[tfName(s),s])].sort((a,b)=>a[1]-b[1]);
loadCtf();loadTfFavs();
let C={sym:ld("tp_sym","NAS100"),tf:+ld("tp_tf",900)};
if(!okTf(C.tf))C.tf=900;
let P={theme:ld("gx-theme","")||ld("tp_theme","")||"dark",sc:ld("tp_sc","")==="1"};

/* ================= LỖI cTrader -> tiếng Việt (kết nối + dữ liệu nằm ở ctrader.js) ================= */
const why=e=>{
  const m=String(e&&e.message||e);
  if(m==="NET")return"không kết nối được tới cTrader (kiểm tra mạng; wss://...ctraderapi.com:5036 có thể bị chặn bởi mạng/VPN/tường lửa)";
  if(m==="TIMEOUT")return"cTrader không phản hồi (quá thời gian chờ)";
  if(m==="CT_NOKEY")return"chưa có key cTrader, vào mục Kết nối để nhập Client ID, Client Secret và Access Token";
  if(/^CH_CLIENT_AUTH_FAILURE/.test(m))return"Client ID hoặc Client Secret không đúng ("+m+")";
  if(/^CH_ACCESS_TOKEN_INVALID/.test(m))return"Access Token không hợp lệ hoặc đã hết hạn, hãy lấy token mới ("+m+")";
  if(/^CT_NOACC/.test(m))return m.replace(/^CT_NOACC:?\s*/,"không tìm được tài khoản: ");
  if(/^CT_TOKEN/.test(m))return"Access Token bị thu hồi hoặc tài khoản mất quyền truy cập, hãy lấy token mới ở mục Kết nối";
  return m;
};
