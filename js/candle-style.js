/* ================= MÀU NẾN ================= */
let CSx={};try{CSx=JSON.parse(ld("tp_cs","{}"))||{}}catch{}
const saveCS=()=>sv("tp_cs",JSON.stringify(CSx));
/* Đường Bid / Ask trên chart (giống "Show Bid/Ask line" của MT5): vẽ bằng price line của series nến, cập nhật mỗi lần poll() nhận giá */
const BAD={bid:"#2196f3",ask:"#ff5252"};
let BA={sym:"",bid:0,ask:0};const BL={bid:null,ask:null};
function baUpdate(sym,bid,ask){
  if(sym!==undefined)BA={sym,bid:+bid,ask:+ask};
  for(const k of["bid","ask"]){
    const on=CSx[k+"L"]!==false&&BA.sym===C.sym&&BA[k]>0&&agg.length>0;
    if(!on){if(BL[k]){cs.removePriceLine(BL[k]);BL[k]=null}continue}
    const o={price:BA[k],color:CSx[k+"C"]||BAD[k],lineWidth:1,lineStyle:2,axisLabelVisible:true,title:k==="bid"?"Bid":"Ask"};
    if(BL[k])BL[k].applyOptions(o);else BL[k]=cs.createPriceLine(o);
  }
}
function eff(){
  const c=COL(),s=CSx,up=s.up||c.up,dn=s.dn||c.dn,lk=s.link!==false;
  return{up,dn,bu:lk?up:(s.bu||up),bd:lk?dn:(s.bd||dn),wu:lk?up:(s.wu||up),wd:lk?dn:(s.wd||dn),hollow:!!s.hollow,vol:s.vol!==false,grid:s.grid!==false};
}
function applyCand(){
  const e=eff(),c=COL(),g=e.grid?c.gr:"rgba(0,0,0,0)";
  cs.applyOptions({upColor:e.hollow?"rgba(0,0,0,0)":e.up,downColor:e.dn,borderVisible:true,borderUpColor:e.bu,borderDownColor:e.bd,wickUpColor:e.wu,wickDownColor:e.wd});
  vs.applyOptions({visible:e.vol});
  if(window.FPHIDE){const T="rgba(0,0,0,0)";cs.applyOptions({upColor:T,downColor:T,borderUpColor:T,borderDownColor:T,wickUpColor:T,wickDownColor:T})}
  allCh().forEach(x=>x.applyOptions({grid:{vertLines:{color:g},horzLines:{color:g}}}));
  baUpdate();
}
function recolor(){if(agg.length)vs.setData(agg.map(c=>({time:c.time,value:c.v,color:vcol(c.open,c.close)})))}
const CFLD=[["up","Thân nến tăng"],["dn","Thân nến giảm"],["bu","Viền nến tăng"],["bd","Viền nến giảm"],["wu","Bấc nến tăng"],["wd","Bấc nến giảm"]];
const PRE=[["Mặc định (theo theme)",{}],["Classic",{up:"#26a69a",dn:"#ef5350"}],["Xanh / Đỏ",{up:"#00c853",dn:"#ff1744"}],["Vàng / Tím",{up:"#ffc107",dn:"#9c27b0"}],["Xanh dương / Cam",{up:"#2196f3",dn:"#ff9800"}],["Đơn sắc",{up:"#ffffff",dn:"#6b7280"}]];
function csPrev(){
  const e=eff(),B=[[50,62,44,58],[58,70,52,66],[66,72,56,60],[60,64,46,50],[50,60,48,57],[57,68,55,66],[66,78,64,75],[75,80,66,70],[70,72,58,61],[61,66,52,64],[64,76,62,73],[73,82,70,80]],y=v=>100-v;
  return `<svg viewBox="0 0 ${B.length*16+8} 100" style="width:100%;height:auto;max-height:200px">`+B.map(([o,h,l,c],i)=>{
    const u=c>=o,x=16+i*16;
    return `<line x1="${x}" x2="${x}" y1="${y(h)}" y2="${y(l)}" stroke="${u?e.wu:e.wd}" stroke-width="1.6"/><rect x="${x-5}" y="${y(Math.max(o,c))}" width="10" height="${Math.max(Math.abs(c-o),1)}" fill="${u?(e.hollow?"none":e.up):e.dn}" stroke="${u?e.bu:e.bd}" stroke-width="1.4"/>`}).join("")+`</svg>`;
}
function buildCS(){
  const e=eff(),lk=CSx.link!==false;
  $("csBody").innerHTML=`<div class="grid"><div class="card"><h2>Màu nến</h2>`+
   CFLD.map(([k,l])=>`<div class="f"><label for="cs_${k}">${l}</label><input type="color" id="cs_${k}" data-k="${k}" value="${e[k]}"${lk&&["bu","bd","wu","wd"].includes(k)?" disabled":""}></div>`).join("")+
   [["link","Viền và bấc theo màu thân nến",lk],["hollow","Nến tăng rỗng (chỉ viền)",e.hollow],["vol","Hiện volume",e.vol],["grid","Hiện lưới",e.grid]].map(([k,l,v])=>`<div class="f"><label for="cb_${k}">${l}</label><input type="checkbox" id="cb_${k}" data-t="${k}"${v?" checked":""}></div>`).join("")+
   `<h2 style="margin-top:16px">Đường Bid / Ask</h2>`+
   [["bidL","Hiện đường Bid",CSx.bidL!==false],["askL","Hiện đường Ask",CSx.askL!==false]].map(([k,l,v])=>`<div class="f"><label for="cb_${k}">${l}</label><input type="checkbox" id="cb_${k}" data-t="${k}"${v?" checked":""}></div>`).join("")+
   [["bidC","Màu đường Bid"],["askC","Màu đường Ask"]].map(([k,l])=>`<div class="f"><label for="cs_${k}">${l}</label><input type="color" id="cs_${k}" data-k="${k}" value="${CSx[k]||BAD[k.slice(0,3)]}"></div>`).join("")+
   `</div><div class="card"><h2>Xem trước</h2><div id="csPrev">${csPrev()}</div><h2 style="margin-top:16px">Bộ màu có sẵn</h2><div class="bar">${PRE.map(([n],i)=>`<button class="btn ghost sm" data-pre="${i}">${n}</button>`).join("")}</div><div class="bar" style="margin-top:14px"><button class="btn ghost sm" data-reset="1">Về mặc định</button><span class="msg">Tự lưu trong trình duyệt.</span></div></div></div>`;
}
let rq=0;
$("csBody").oninput=e=>{const k=e.target.dataset.k;if(!k)return;CSx[k]=e.target.value;saveCS();applyCand();$("csPrev").innerHTML=csPrev();if(!rq)rq=requestAnimationFrame(()=>{rq=0;recolor();renderInd()})};
$("csBody").onchange=e=>{const t=e.target.dataset.t;if(!t)return;CSx[t]=e.target.checked;saveCS();applyCand();recolor();buildCS()};
$("csBody").onclick=e=>{
  const b=e.target.closest("[data-pre],[data-reset]");if(!b)return;
  const keep={link:CSx.link,hollow:CSx.hollow,vol:CSx.vol,grid:CSx.grid,bidL:CSx.bidL,askL:CSx.askL,bidC:CSx.bidC,askC:CSx.askC};
  CSx=b.dataset.reset?{}:Object.assign(keep,PRE[+b.dataset.pre][1]);
  saveCS();applyCand();recolor();renderInd();buildCS();
};
