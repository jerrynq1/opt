const $=id=>document.getElementById(id);
/* Lưu cài đặt (mã, khung giờ, indicator, theme...) trong localStorage của trình duyệt. */
const kk=k=>k;
const ld=(k,d)=>{try{return localStorage.getItem(kk(k))??d}catch{return d}};
const ld0=(k,d)=>{try{return localStorage.getItem(k)??d}catch{return d}};
const sv=(k,v)=>{try{localStorage.setItem(kk(k),v)}catch{}};
const TFS=[["M1",60],["M5",300],["M15",900],["M30",1800],["H1",3600],["H4",14400],["D1",86400],["W1",604800]];
/* ===== Khung giờ tuỳ chọn =====
   TFS = các khung có sẵn. Người dùng thêm khung riêng (giây / phút / giờ / ngày / tuần) bằng nút "+" cạnh thanh khung giờ; danh sách lưu ở "tp_ctf" (DÙNG CHUNG cho mọi chart, kể cả chart phụ),
   còn khung đang chọn của từng chart vẫn lưu riêng (tp_tf / tp_tf_<id>). Hợp lệ: 1–59 giây (dựng từ tick) hoặc bội số của 60 giây (dựng từ nến M1), tối đa 4 tuần. */
const TF_MAX=2419200,TF_UNIT={s:1,m:60,h:3600,d:86400,w:604800},TF_CAP=8;
const okTf=s=>Number.isInteger(s)&&s>=1&&s<=TF_MAX&&(s<60||s%60===0);
const tfName=s=>{const p=TFS.find(t=>t[1]===s);if(p)return p[0];
  if(s<60)return"S"+s;if(s%604800===0)return"W"+s/604800;if(s%86400===0)return"D"+s/86400;if(s%3600===0)return"H"+s/3600;if(s%60===0)return"M"+s/60;return s+"s"};
let CTF=[];
const loadCtf=()=>{try{CTF=[...new Set((JSON.parse(ld0("tp_ctf","[]"))||[]).map(Number).filter(s=>okTf(s)&&!TFS.some(t=>t[1]===s)))].sort((a,b)=>a-b).slice(0,TF_CAP)}catch{CTF=[]}};
const saveCtf=()=>{try{localStorage.setItem("tp_ctf",JSON.stringify(CTF))}catch{}};
const allTfs=()=>[...TFS,...CTF.map(s=>[tfName(s),s])].sort((a,b)=>a[1]-b[1]);
loadCtf();
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
