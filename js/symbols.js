/* ================= DANH SÁCH 4 THỊ TRƯỜNG CHÍNH + Ô CHỌN MÃ =================
   Chỉ cho xem NAS100, SP500, XAUUSD và XAGUSD. Gõ mã khác sẽ không được nhận. Gõ nhầm nhẹ (xau usd, dowjones, gold, EURUDS...) sẽ tự sửa về đúng mã.
   k  = tên mã dùng trong app (C.sym), al = tên gọi khác / tên thường gặp trên các broker cTrader.
   ctFind() (ctrader.js) tìm trong danh sách mã THẬT của broker theo k rồi lần lượt các al, nên NAS100 có thể là US100 / USTEC..., ES là US500..., DOWJONE là US30... tuỳ broker. */
const SYMS=[
  {k:"NAS100",n:"Nasdaq 100",al:["USTEC","US100","USTECH100","USTECH","NASDAQ100","NASDAQ","NDX100","NDX","NQ","NAS"]},
  {k:"SP500",n:"S&P 500",al:["ES","US500","SPX500","USSPX500","SPX","S&P500","SP500CASH","USA500"]},
  {k:"XAUUSD",n:"Gold · Vàng",al:["GOLD","XAU"]},
  {k:"XAGUSD",n:"Silver · Bạc",al:["SILVER","XAG"]}
];
const symNorm=s=>String(s||"").toUpperCase().replace(/[^A-Z0-9]/g,"");
const symEntry=k=>SYMS.find(s=>s.k===k)||null;
/* danh sách tên (đã chuẩn hoá) để dò mã broker, ưu tiên k trước */
function symCands(k){const e=symEntry(k);return e?[e.k,...e.al].map(symNorm):[symNorm(k)]}
/* khoảng cách sửa chữ (có tính đổi chỗ 2 ký tự liền nhau) */
function symDist(a,b){
  const m=a.length,n=b.length,d=[];for(let i=0;i<=m;i++){d[i]=[i];for(let j=1;j<=n;j++)d[i][j]=i?0:j}
  for(let i=1;i<=m;i++)for(let j=1;j<=n;j++){
    d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
    if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])d[i][j]=Math.min(d[i][j],d[i-2][j-2]+1)}
  return d[m][n]}
/* chữ người dùng gõ -> k của mã chính, hoặc null nếu không phải mã chính */
function symCanon(text){
  const n=symNorm(text);if(!n)return null;
  const names=e=>[e.k,...e.al].map(symNorm);
  let r=SYMS.filter(e=>names(e).includes(n));if(r.length===1)return r[0].k;          // đúng tên
  r=SYMS.filter(e=>names(e).some(x=>x.startsWith(n)));if(r.length===1)return r[0].k;  // gõ dở: XAU, NAS, EURU...
  if(r.length>1)return null;
  if((n.match(/[A-Z]/g)||[]).length<4)return null;                                   // quá ngắn / toàn số: không đoán
  const tol=n.length>=8?2:1;let best=9,hit=[];
  for(const e of SYMS)for(const x of names(e)){if(x.length<4)continue;const d=symDist(n,x);if(d<best){best=d;hit=[e.k]}else if(d===best&&!hit.includes(e.k))hit.push(e.k)}
  return best<=tol&&hit.length===1?hit[0]:null}
/* mã đang lưu (localStorage / ?sym=) mà không thuộc danh sách thì đưa về mã chính gần nhất, không có thì NAS100 */
C.sym=symCanon(C.sym)||"NAS100";

(function(){
"use strict";
const inp=$("sym"),box=inp&&inp.closest(".symw");if(!inp||!box)return;
const dd=document.createElement("div");dd.id="symDd";dd.setAttribute("role","listbox");dd.setAttribute("data-no-i18n","");box.appendChild(dd);
let isOpen=false,hi=-1,items=[],filt=false,picking=false,pT=0;
const brk=k=>{try{const s=typeof ctFind==="function"&&CT.symbols?ctFind(k):null;return s?s.symbolName:""}catch{return""}};
function calc(){
  const q=filt?symNorm(inp.value):"";
  items=q?SYMS.filter(e=>symNorm([e.k,e.n,...e.al].join(" ")).includes(q)):SYMS.slice();
  if(q&&!items.length){const c=symCanon(inp.value);if(c)items=[symEntry(c)]}     // gõ nhầm nhẹ: gợi ý mã đúng
}
function render(){
  const q=filt?symNorm(inp.value):"",none=q&&!items.length,L=none?SYMS:items;
  const have=!!CT.symbols;
  dd.innerHTML=(none?`<div class="sn">Không có mã “${inp.value.replace(/[<>&"]/g,"")}”. Chỉ hỗ trợ các mã chính bên dưới.</div>`:"")
    +L.map((e,i)=>{const b=brk(e.k);
      return `<div class="so${e.k===C.sym?" on":""}${i===hi?" hi":""}${have&&!b?" na":""}" role="option" aria-selected="${e.k===C.sym}" data-k="${e.k}"><b>${e.k}</b><span>${e.n}</span>${b&&b!==e.k?`<small>${b}</small>`:(have&&!b?"<small>không có</small>":"")}</div>`}).join("");
  const h=dd.querySelector(".hi");if(h)h.scrollIntoView({block:"nearest"});
}
function show(){calc();isOpen=true;box.classList.add("open");inp.setAttribute("aria-expanded","true");render()}
function hide(){isOpen=false;box.classList.remove("open");inp.setAttribute("aria-expanded","false");hi=-1}
function commit(k){
  hide();picking=false;clearTimeout(pT);
  if(!k){inp.value=C.sym;return}
  inp.value=k;
  if(k!==C.sym){C.sym=k;sv("tp_sym",k);$("bid").textContent=$("ask").textContent="–";loadM1()}
  try{inp.blur()}catch(e){}
}
function visible(){return filt&&symNorm(inp.value)&&!items.length?SYMS:items}
inp.addEventListener("focus",()=>{filt=false;try{inp.select()}catch(e){}show()});
inp.addEventListener("click",()=>{if(!isOpen){filt=false;show()}});
inp.addEventListener("input",()=>{filt=true;show();hi=items.length?0:-1;render()});
inp.addEventListener("keydown",e=>{
  if(e.key==="ArrowDown"||e.key==="ArrowUp"){
    e.preventDefault();if(!isOpen){filt=false;show()}
    const n=visible().length;if(!n)return;hi=(hi+(e.key==="ArrowDown"?1:-1)+n)%n;render()}
  else if(e.key==="Enter"){
    e.preventDefault();const v=visible();
    commit(isOpen&&hi>=0&&v[hi]?v[hi].k:symCanon(inp.value))}
  else if(e.key==="Escape"){e.stopPropagation();commit(null)}
});
inp.addEventListener("blur",()=>{
  if(picking)return;
  setTimeout(()=>{if(picking||document.activeElement===inp)return;commit(symCanon(inp.value))},0)});
dd.addEventListener("pointerdown",e=>{if(e.target.closest(".so")){picking=true;clearTimeout(pT);pT=setTimeout(()=>{picking=false},800);if(e.pointerType!=="touch")e.preventDefault()}});
dd.addEventListener("click",e=>{const o=e.target.closest(".so");if(o)commit(o.dataset.k)});
document.addEventListener("pointerdown",e=>{if(isOpen&&!box.contains(e.target)){picking=false;commit(symCanon(inp.value))}},true);
inp.value=C.sym;
})();
