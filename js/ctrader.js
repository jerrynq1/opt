/* ================= cTrader Open API (JSON qua WebSocket, nối THẲNG từ trình duyệt tới Spotware, KHÔNG qua worker) =================
   Client ID / Client Secret / Access Token do người dùng nhập ở mục "Kết nối" và lưu trong localStorage ("ct_cfg") của trình duyệt này.
   Luồng đăng nhập: ApplicationAuth(2100) -> GetAccountListByAccessToken(2149) -> chọn tài khoản -> (nếu tài khoản là demo/live khác máy chủ đang nối thì
   nối lại đúng máy chủ rồi ApplicationAuth lại) -> AccountAuth(2102). Sau đó giao thức như cũ:
   SymbolsList(2114) -> SubscribeSpots(2127) + SubscribeLiveTrendbar(2135). Lịch sử: GetTrendbars(2137) cho nến M1, GetTickData(2145) cho footprint.
   Giá trong Open API là số nguyên theo đơn vị 1/100000. Thời gian là UTC, app quy ra "giờ server" bằng u2s() (timezone.js).
   Giới hạn: tối đa 5 request lịch sử / giây nên mọi request lịch sử đi qua hàng đợi ctHist().
   LƯU Ý BẢO MẬT: Client Secret + Access Token nằm trong trình duyệt, chỉ dùng để test ở máy cá nhân, đừng đưa bản này lên hosting công khai. */
const CT={ws:null,ready:false,pend:new Map(),id:0,hb:null,acc:0,symbols:null,sym:null,bid:0,ask:0,digits:5,
  liveBar:null,barDirty:false,tbAt:0,tkBar:null,quoteDirty:false,epoch:0,ep:null,q:{bar:Promise.resolve(),tick:Promise.resolve()},nextSlot:0,subs:new Set(),fatal:"",gen:0,info:null,
  lastMsg:0,lastSpot:0,wd:null,probing:false,resubAt:0};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const CT_HOST={live:"wss://live.ctraderapi.com:5036",demo:"wss://demo.ctraderapi.com:5036"};
const CT_KEY="ct_cfg";
// cấu hình kết nối do người dùng nhập (mục Kết nối): {clientId, clientSecret, accessToken, accountId (tuỳ chọn), env: auto|live|demo}
function ctCfg(){
  let o={};try{o=JSON.parse(localStorage.getItem(CT_KEY)||"{}")||{}}catch{}
  const t=v=>String(v==null?"":v).trim();
  return{clientId:t(o.clientId),clientSecret:t(o.clientSecret),accessToken:t(o.accessToken),accountId:t(o.accountId),env:o.env==="live"||o.env==="demo"?o.env:"auto"};
}
function ctSaveCfg(o){try{localStorage.setItem(CT_KEY,JSON.stringify(o))}catch{}}
function ctClearCfg(){try{localStorage.removeItem(CT_KEY)}catch{}}
const ctHasKey=()=>{const c=ctCfg();return!!(c.clientId&&c.clientSecret&&c.accessToken)};
const ctReady=()=>CT.ready&&CT.sym&&CT.sym.req===C.sym;

/* ---------- gửi / nhận ---------- */
function ctSend(type,payload,timeout){
  return new Promise((res,rej)=>{
    if(!CT.ws||CT.ws.readyState!==1)return rej(new Error("NET"));
    const id="m"+(++CT.id),t=setTimeout(()=>{CT.pend.delete(id);rej(new Error("TIMEOUT"))},timeout||30000);
    CT.pend.set(id,{res,rej,t});
    CT.ws.send(JSON.stringify({clientMsgId:id,payloadType:type,payload}));
  });
}
// request lịch sử: tối đa 5 req/s cho CẢ HAI làn (mỗi request giữ 1 "suất" cách nhau ≥ 230ms), nhưng mỗi làn xếp hàng riêng:
//   "bar"  = nến M1 (ưu tiên: tải chart, bù nến, kéo trái) — chỉ chờ tối đa ~1 suất,
//   "tick" = tick footprint (nặng, có thể hàng trăm trang) — không còn chặn nến M1 nữa.
// Tự thử lại khi bị báo quá tần suất.
async function ctSlot(){
  const t=Math.max(Date.now(),CT.nextSlot);CT.nextSlot=t+230;
  const w=t-Date.now();if(w>0)await sleep(w);
}
function ctHist(type,payload,lane){
  lane=lane==="tick"?"tick":"bar";
  const run=async()=>{
    for(let k=0;;k++){
      await ctSlot();
      try{return await ctSend(type,payload)}
      catch(e){if(k<4&&/FREQUENCY|RATE|BLOCKED|TOO_MANY/i.test(e.message)){await sleep(1500);continue}throw e}
    }
  };
  const p=CT.q[lane].then(run,run);CT.q[lane]=p.catch(()=>{});return p;
}
function ctMsg(ev){
  CT.lastMsg=Date.now();
  let m;try{m=JSON.parse(ev.data)}catch{return}
  const t=m.payloadType,p=m.payload||{},q=m.clientMsgId&&CT.pend.get(m.clientMsgId);
  if(q){
    CT.pend.delete(m.clientMsgId);clearTimeout(q.t);
    if(t===2142||t===50)q.rej(new Error((p.errorCode||"ERROR")+(p.description?": "+p.description:"")));else q.res(p);
    return;
  }
  if(t===2131)ctSpot(p);
  else if(t===2155){if(typeof domFeed==="function")domFeed(p)}   // DepthEvent (sổ lệnh L2 / MBO), xem orderflow-dom.js
  else if(t===2147||t===2164){CT.fatal="CT_TOKEN";status("cTrader: "+why(new Error(CT.fatal)),"bad")}   // token bị thu hồi / tài khoản bị ngắt
  else if(t===2142||t===50)console.warn("cTrader lỗi:",p.errorCode,p.description);
}

/* ---------- kết nối + đăng nhập ---------- */
function ctClose(){
  CT.gen++;CT.ready=false;clearInterval(CT.hb);clearInterval(CT.wd);CT.probing=false;CT.subs.clear();CT.sym=null;
  for(const [,q] of CT.pend){clearTimeout(q.t);q.rej(new Error("NET"))}CT.pend.clear();
  if(CT.ws){const w=CT.ws;CT.ws=null;w.onclose=w.onerror=w.onmessage=null;try{w.close()}catch{}}
}
// mở WebSocket tới 1 máy chủ + dựng heartbeat/watchdog. g = thế hệ kết nối (ctClose() tăng CT.gen làm các callback cũ tự vô hiệu)
async function ctOpen(host,g){
  const ws=new WebSocket(host);CT.ws=ws;
  await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=()=>rej(new Error("NET"));setTimeout(()=>rej(new Error("NET")),15000)});
  ws.onmessage=ctMsg;ws.onerror=null;
  ws.onclose=()=>{if(g!==CT.gen)return;const was=CT.ready;ctClose();if(was){status("Mất kết nối cTrader, đang nối lại…","bad");ctRetry()}};
  CT.hb=setInterval(()=>{try{ws.send(JSON.stringify({payloadType:51,payload:{}}))}catch{}},10000);   // heartbeat
  CT.lastMsg=CT.lastSpot=Date.now();CT.resubAt=0;
  CT.wd=setInterval(()=>ctWatch(false),CTW.every);                                                    // watchdog: phát hiện kết nối chết ngầm
}
async function ctConnect(){
  const c=ctCfg();
  if(!(c.clientId&&c.clientSecret&&c.accessToken))throw new Error("CT_NOKEY");
  ctClose();CT.fatal="";CT.info=null;let g=CT.gen,host=c.env==="demo"?"demo":"live";
  await ctOpen(CT_HOST[host],g);
  await ctSend(2100,{clientId:c.clientId,clientSecret:c.clientSecret},20000);                 // ApplicationAuth
  const L=await ctSend(2149,{accessToken:c.accessToken},20000),accs=L.ctidTraderAccount||[];   // danh sách tài khoản của token
  const fmt=x=>"#"+(x.traderLogin||x.ctidTraderAccountId)+" ("+(x.isLive?"Live":"Demo")+", id "+x.ctidTraderAccountId+")";
  if(!accs.length)throw new Error("CT_NOACC: token này không có tài khoản giao dịch nào");
  let a;
  if(c.accountId){
    a=accs.find(x=>String(x.ctidTraderAccountId)===c.accountId||String(x.traderLogin)===c.accountId);
    if(!a)throw new Error("CT_NOACC: không thấy tài khoản "+c.accountId+" trong token. Tài khoản có sẵn: "+accs.map(fmt).join(", "));
  }else{
    a=c.env==="live"?accs.find(x=>x.isLive):c.env==="demo"?accs.find(x=>!x.isLive):accs[0];
    if(!a)throw new Error("CT_NOACC: token không có tài khoản "+(c.env==="live"?"Live":"Demo")+". Tài khoản có sẵn: "+accs.map(fmt).join(", "));
  }
  const need=a.isLive?"live":"demo";
  if(need!==host){                                                                           // tài khoản nằm ở máy chủ kia: nối lại + ApplicationAuth lại
    ctClose();g=CT.gen;host=need;
    await ctOpen(CT_HOST[host],g);
    await ctSend(2100,{clientId:c.clientId,clientSecret:c.clientSecret},20000);
  }
  const acc=+a.ctidTraderAccountId;
  await ctSend(2102,{ctidTraderAccountId:acc,accessToken:c.accessToken},20000);              // AccountAuth
  CT.acc=acc;CT.info={host,isLive:!!a.isLive,login:a.traderLogin||"",id:acc,accounts:accs.map(fmt)};
  const r=await ctSend(2114,{ctidTraderAccountId:acc});
  CT.symbols=(r.symbol||[]).filter(s=>s.enabled!==false);
  CT.ready=true;CT.epoch++;
}
const normSym=s=>String(s||"").toUpperCase().replace(/[^A-Z0-9]/g,"");
/* tìm mã trên broker: tên chính (k) rồi các tên gọi khác (symbols.js); khớp đúng trước, rồi khớp phần đầu */
function ctFind(name){
  const L=CT.symbols||[],c=typeof symCands==="function"?symCands(name):[normSym(name)];
  for(const a of c){const s=L.find(x=>normSym(x.symbolName)===a);if(s)return s}
  for(const a of c){if(a.length<3)continue;const s=L.find(x=>normSym(x.symbolName).startsWith(a));if(s)return s}
  for(const a of c){if(!a)continue;const re=new RegExp("^"+a+"(?![A-Za-z])","i"),s=L.find(x=>re.test(String(x.symbolName)));if(s)return s}
  return null}
async function ctUseSymbol(name){
  const L=CT.symbols||[],s=ctFind(name);
  if(!s)throw new Error("SYMBOL: broker không có mã '"+name+"' (đã thử: "+((typeof symCands==="function"?symCands(name):[normSym(name)]).join(", "))+")");
  const id=+s.symbolId;
  let digits=5,lotSize=0;
  try{const r=await ctSend(2116,{ctidTraderAccountId:CT.acc,symbolId:[id]}),x=(r.symbol||[])[0]||{};digits=+x.digits||5;lotSize=+x.lotSize||0}catch{}
  CT.sym={id,name:s.symbolName,digits,lotSize,req:name};CT.bid=CT.ask=0;CT.liveBar=null;CT.liveU=0;CT.tkBar=null;CT.tbAt=0;CT.barDirty=CT.quoteDirty=false;
  ctFpReset();
  if(!CT.subs.has(id)){
    await ctSend(2127,{ctidTraderAccountId:CT.acc,symbolId:[id],subscribeToSpotTimestamp:true}).catch(e=>{if(!/ALREADY/i.test(e.message))throw e});
    await ctSend(2135,{ctidTraderAccountId:CT.acc,symbolId:id,period:1}).catch(()=>{});   // nến M1 live; lỗi thì tự dựng nến từ tick
    CT.subs.add(id);
  }
}
// đảm bảo đã kết nối và đang theo dõi đúng mã C.sym (nhiều nơi gọi cùng lúc vẫn chỉ chạy 1 lần)
function ctEnsure(){
  return CT.ep||(CT.ep=(async()=>{
    if(!CT.ready)await ctConnect();
    if(!CT.sym||CT.sym.req!==C.sym)await ctUseSymbol(C.sym);
  })().finally(()=>{CT.ep=null}));
}
/* Watchdog. Trước đây app chỉ gửi heartbeat mà không kiểm tra gì: nếu WebSocket "chết ngầm" (máy ngủ, mạng chập, tab ẩn bị giãn timer)
   thì onclose không chạy, không có lỗi nào hiện ra và giá đứng im mãi. Giờ:
   - Không nhận được BẤT KỲ gói nào > 20s: gửi 1 request thăm dò (Version). Không trả lời trong 8s => coi như chết, nối lại.
     (có trả lời => kết nối còn sống, ví dụ cuối tuần thị trường đóng nên không có giá: không nối lại vô ích)
   - Kết nối sống nhưng không có giá > 60s: đăng ký lại spot + nến live của mã đang xem (đăng ký lại an toàn, lỗi ALREADY_SUBSCRIBED bị bỏ qua).
   force=true (tab hiện lại / có mạng lại): thăm dò ngay, không chờ 20s. */
const CTW={idle:20000,probe:8000,spot:60000,every:5000};   // ngưỡng watchdog (ms), tách ra để test chỉnh nhỏ lại
async function ctWatch(force){
  if(!CT.ready||CT.probing||CT.fatal)return;
  const now=Date.now(),g=CT.gen;
  if(force||now-CT.lastMsg>CTW.idle){
    CT.probing=true;
    try{await ctSend(2104,{},CTW.probe)}
    catch(e){
      if((e.message==="TIMEOUT"||e.message==="NET")&&g===CT.gen&&CT.ready){
        ctClose();status("Mất kết nối cTrader, đang nối lại…","bad");ctRetry();return;
      }
    }finally{if(g===CT.gen)CT.probing=false}
  }
  if(g===CT.gen&&CT.ready&&CT.sym&&now-CT.lastSpot>CTW.spot&&now-CT.resubAt>CTW.spot){
    CT.resubAt=now;const id=CT.sym.id;
    try{
      await ctSend(2127,{ctidTraderAccountId:CT.acc,symbolId:[id],subscribeToSpotTimestamp:true}).catch(()=>{});
      await ctSend(2135,{ctidTraderAccountId:CT.acc,symbolId:id,period:1}).catch(()=>{});
    }catch{}
  }
}
if(typeof document!=="undefined"&&document.addEventListener){
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)ctWatch(true)});
  if(typeof addEventListener==="function")addEventListener("online",()=>ctWatch(true));
}
let ctRT=0;
function ctRetry(){
  clearTimeout(ctRT);
  ctRT=setTimeout(async()=>{
    try{await ctEnsure();loadM1()}
    catch(e){if(e.message==="NET"||e.message==="TIMEOUT"){status("Mất kết nối cTrader, đang nối lại…","bad");ctRetry()}else status("cTrader: "+why(e),"bad")}
  },4000);
}

/* ---------- giá + nến live ---------- */
const px5=v=>(+v||0)/1e5;
function tbToBar(tb){
  const lo=+tb.low||0,t=(+tb.utcTimestampInMinutes||0)*60;
  return{u:t,b:[u2s(t),px5(lo+(+tb.deltaOpen||0)),px5(lo+(+tb.deltaHigh||0)),px5(lo),px5(lo+(+tb.deltaClose||0)),+tb.volume||0]};
}
function ctSpot(p){
  const s=CT.sym;if(!s||+p.symbolId!==s.id)return;
  CT.lastSpot=Date.now();
  if(p.bid!=null)CT.bid=+p.bid;if(p.ask!=null)CT.ask=+p.ask;     // 1 sự kiện có thể chỉ chứa bid hoặc ask
  const ts=+p.timestamp||Date.now();CT.quoteDirty=true;
  /* Nến M1 live. Trước đây nến chỉ cập nhật khi server gửi kèm trendbar (hoặc sau 4s im lặng mới tự dựng từ bid), nên Bid/Ask nhảy liên tục
     mà nến đứng im / giật cục. Giờ: trendbar của server (nếu có) là số liệu gốc cho phút đó, và MỌI báo giá bid đều kéo high/low/close của nến
     phút hiện tại theo, nên nến chạy theo giá ở từng tick dù server có gửi trendbar hay không. */
  const u=Math.floor(ts/60000)*60,now=Date.now();
  if(p.trendbar&&p.trendbar.length){
    const x=p.trendbar.find(x=>x.period==null||x.period===1||x.period==="M1");
    if(x){const t=tbToBar(x);if(t.u>=(CT.liveU||0)){CT.liveBar=t.b;CT.liveU=t.u;CT.barDirty=true;CT.dirtyAt=now;CT.tbAt=now}}
  }
  if(p.bid!=null&&CT.bid>0){
    const v=px5(CT.bid),L=CT.liveBar;
    if(L&&CT.liveU===u){                                  // phút hiện tại đã có nến: kéo theo giá bid mới
      if(v>L[2])L[2]=v;if(v<L[3])L[3]=v;L[4]=v;
      if(now-CT.tbAt>4000)L[5]++;                         // server không gửi trendbar: tự đếm tick volume
      CT.barDirty=true;CT.dirtyAt=now;
    }else if(!L||u>(CT.liveU||0)){                        // sang phút mới mà chưa có trendbar: mở nến mới từ bid
      /* nếu phút này đã có trong lịch sử (vừa tải xong) thì kế thừa open/high/low/volume thật, không để nến live chỉ có 1 giá che mất chúng */
      const h=typeof m1!=="undefined"&&m1.length?m1[m1.length-1]:null;
      CT.liveBar=h&&h[0]===u2s(u)?[h[0],h[1],Math.max(h[2],v),Math.min(h[3],v),v,h[5]]:[u2s(u),v,v,v,v,1];CT.liveU=u;CT.barDirty=true;CT.dirtyAt=now;
    }
  }
  if(CT.bid>0&&CT.ask>0)ctFpTick(ts,CT.bid,CT.ask);
  if(p.bid!=null&&CT.bid>0&&typeof sbLive==="function")sbLive(ts,CT.bid);   // khung giây dựng từ tick bid (chart.js)
}

/* ---------- nến M1 lịch sử ---------- */
// lấy nến M1 trong [lo, hi) (UTC giây), trả về [[giờ server,o,h,l,c,v],...] tăng dần
async function ctBars(lo,hi){
  const r=await ctHist(2137,{ctidTraderAccountId:CT.acc,symbolId:CT.sym.id,period:1,fromTimestamp:lo*1000,toTimestamp:hi*1000},"bar");
  if(r.hasMore&&hi-lo>120){const mid=Math.floor((lo+hi)/120)*60;return (await ctBars(lo,mid)).concat(await ctBars(mid,hi))}
  return (r.trendbar||[]).map(tbToBar).filter(x=>x.u>=lo&&x.u<hi).sort((a,b)=>a.u-b.u).map(x=>x.b);
}

/* ---------- footprint từ tick ----------
   cTrader (forex/CFD) KHÔNG có tape giao dịch thật, chỉ có báo giá bid/ask. Footprint ở đây là ƯỚC LƯỢNG từ chuỗi báo giá, theo các quy tắc sau
   (dùng CHUNG cho dữ liệu lịch sử và live nên hai phần khớp nhau):
   1) Mỗi sự kiện báo giá làm bid hoặc ask đổi = 1 đơn vị khối lượng (tick volume). Sự kiện không đổi giá thì bỏ. Báo giá lỗi (ask < bid) bị bỏ, không làm hỏng trạng thái.
   2) Hướng: ask/bid cùng tăng (hoặc một bên tăng, bên kia đứng yên) => MUA; cùng giảm => BÁN.
      Spread nở/co (ask và bid đi ngược chiều) => xét hướng dịch của giá giữa (mid); mid không đổi => giữ hướng cũ.
   3) Giá đặt: MUA đặt ở mức ASK (người mua khớp ở ask), BÁN đặt ở mức BID (người bán khớp ở bid).
   4) Các sự kiện cùng mili-giây gộp thành 1 (lấy bid/ask cuối cùng), giống nhau ở lịch sử và live.
   5) Lịch sử nạp theo cửa sổ kèm 5 phút "khởi động" phía trước để có sẵn bid/ask/hướng ở đầu cửa sổ (không mất tick đầu cửa sổ); phần khởi động không được cộng vào số liệu.
   Kết quả mỗi phút: [[giá,mua,bán],...] vào FPM (key = giờ server). Giá là số thực của giá nguyên 1/100000, nên làm tròn lại bằng Math.round(p*1e5) là chính xác. */
const FPL={ready:false,q:[],st:{bid:0,ask:0,side:0,run:null},min:0,map:null,last:0,dirty:false,pend:null,pendAt:0};
/* Big Trade: 1 "lệnh lớn" = chuỗi tick LIÊN TIẾP cùng chiều (mua hoặc bán) mà 2 tick kề nhau cách nhau không quá BTG.gap ms (đổi chiều hoặc nghỉ quá gap thì chuỗi kết thúc).
   Khối lượng = số tick của chuỗi, giá = bình quân giá khớp ước lượng (mua: ask, bán: bid). BTE: key giờ server của PHÚT bắt đầu chuỗi -> [[ts,giá,chiều,volume],...]. */
const BTG={gap:300};const BTE=new Map();
const FPD={trunc:0,bad:0};                      // chẩn đoán chất lượng dữ liệu: số lần tải tick bị cắt dở, số báo giá lỗi bị bỏ
const FP_WARM=300000;                           // ms khởi động trước mỗi cửa sổ lịch sử
function ctFpReset(){FPL.ready=false;FPL.q=[];FPL.st={bid:0,ask:0,side:0,run:null};FPL.min=0;FPL.map=null;FPL.last=0;FPL.dirty=false;FPL.pend=null;FPD.trunc=0;FPD.bad=0}
// Phân loại 1 sự kiện báo giá. Trả +1 (mua), -1 (bán) hoặc 0 (không đổi / chưa đủ thông tin). Luôn cập nhật trạng thái st.
function fpStep(st,bid,ask){
  let side=0;
  if(st.bid>0){
    const db=bid-st.bid,da=ask-st.ask;
    if(da||db){
      if((da>0&&db>=0)||(da>=0&&db>0))side=1;
      else if((da<0&&db<=0)||(da<=0&&db<0))side=-1;
      else{const m=da+db;side=m>0?1:m<0?-1:st.side}      // spread nở/co: xét mid
    }
  }
  st.bid=bid;st.ask=ask;if(side)st.side=side;return side;
}
const fpAdd=(map,p,side)=>{let e=map.get(p);if(!e){e=[0,0];map.set(p,e)}side>0?e[0]++:e[1]++};
// rows.sp = spread trung bình của phút (đơn vị giá), để quy giá MUA (đặt ở Ask) về cùng hệ Bid với nến (Volume Profile dùng)
const fpRows=map=>{const r=[...map].sort((a,b)=>a[0]-b[0]).map(([p,e])=>[px5(p),e[0],e[1]]);r.sp=map.sn?map.sp/map.sn/1e5:0;return r};
const fpOk=(b,a)=>b>0&&a>0&&a>=b;
// chuỗi tick cùng chiều (Big Trade). emit(run) được gọi khi chuỗi kết thúc.
function btFeed(st,ts,side,pr,emit){
  const r=st.run;
  if(r&&r.side===side&&ts-r.tl<=BTG.gap){r.tl=ts;r.v++;r.ps+=pr;r.at=performance.now();return}
  if(r)emit(r);
  st.run={side,t0:ts,tl:ts,v:1,ps:pr,at:performance.now()};
}
function btEmit(r,store){
  const m=u2s(Math.floor(r.t0/60000)*60);let L=store.get(m);if(!L){L=[];store.set(m,L)}
  L.push([r.t0,px5(Math.round(r.ps/r.v)),r.side,r.v]);
}
const btEmitLive=r=>{btEmit(r,BTE);FPL.dirty=true};
// ghi 1 sự kiện (đã hợp lệ) vào phút tương ứng. Trả true nếu có cộng khối lượng
function fpCount(st,ts,b,a,mapOf,emit){
  const side=fpStep(st,b,a);if(!side)return false;
  const pr=side>0?a:b,mp=mapOf(Math.floor(ts/60000)*60);fpAdd(mp,pr,side);mp.sp=(mp.sp||0)+(a-b);mp.sn=(mp.sn||0)+1;btFeed(st,ts,side,pr,emit);return true;
}
function ctFpFlush(){if(FPL.map&&FPL.min)FPM.set(u2s(FPL.min),fpRows(FPL.map))}
// --- live: gộp các sự kiện cùng mili-giây rồi mới tính ---
function ctFpCommit(p){
  FPL.pend=null;const ts=p[0],b=p[1],a=p[2];
  if(ts<=FPL.last)return;
  FPL.last=ts;
  if(!fpOk(b,a)){FPD.bad++;return}
  const m=Math.floor(ts/60000)*60;
  if(m!==FPL.min){ctFpFlush();FPL.min=m;FPL.map=new Map()}
  if(!FPL.map)FPL.map=new Map();
  if(fpCount(FPL.st,ts,b,a,()=>FPL.map,btEmitLive))FPL.dirty=true;
}
function ctFpTick(ts,b,a){
  if(!FPL.ready){if(FPL.q.length<200000)FPL.q.push([ts,b,a]);return}
  const p=FPL.pend;
  if(p){
    if(ts===p[0]){p[1]=b;p[2]=a;FPL.pendAt=performance.now();return}     // cùng mili-giây: lấy giá cuối
    if(ts<p[0])return;                                                    // sự kiện cũ hơn (lệch thứ tự): bỏ
    ctFpCommit(p);
  }
  if(ts<=FPL.last)return;                                                 // đã có trong dữ liệu lịch sử
  FPL.pend=[ts,b,a];FPL.pendAt=performance.now();
}
function ctFpIdle(){
  const p=FPL.pend;if(p&&performance.now()-FPL.pendAt>40)ctFpCommit(p);
  const r=FPL.ready&&FPL.st.run;if(r&&performance.now()-r.at>BTG.gap+60){FPL.st.run=null;btEmitLive(r)}   // chuỗi đã nghỉ quá gap: chốt
}   // poll() gọi: chốt sự kiện đang chờ khi không còn sự kiện cùng ms
// tick lịch sử của 1 loại (1=bid, 2=ask) trong [lo, hi] (ms), trả [[ts,giá],...] tăng dần. Dữ liệu là delta cộng dồn (phần tử đầu tuyệt đối).
// Server có thể trả mới->cũ hoặc cũ->mới: tự nhận biết hướng, mỗi trang được đưa về thứ tự thời gian tăng dần (kể cả các tick cùng ms).
async function ctTicks(type,lo,hi){
  const pages=[];let from=lo,to=hi,desc=true,k=0;
  for(;k<600;k++){
    const r=await ctHist(2145,{ctidTraderAccountId:CT.acc,symbolId:CT.sym.id,type,fromTimestamp:from,toTimestamp:to},"tick"),d=r.tickData||[];
    await sleep(0);                                          // nhường luồng chính cho chart / WebSocket live sau mỗi trang tick
    if(!d.length)break;
    let t=0,p=0;const arr=new Array(d.length);
    for(let i=0;i<d.length;i++){t+=+d[i].timestamp;p+=+d[i].tick;arr[i]=[t,p]}
    const a0=arr[0][0],a1=arr[arr.length-1][0];desc=a0>a1||(a0===a1&&desc);
    if(desc)arr.reverse();                                   // về thứ tự tăng dần
    pages.push(arr.filter(x=>x[0]>=lo&&x[0]<=hi));
    if(!r.hasMore)break;
    const mn=arr[0][0],mx=arr[arr.length-1][0];
    if(desc){if(mn<=from)break;to=mn-1}else{if(mx>=to)break;from=mx+1}   // trang kế: lùi về phía cũ hơn (hoặc tiến tới nếu server trả cũ -> mới)
  }
  if(k>=600){FPD.trunc++;console.warn("cTrader: tải tick bị cắt ở 600 trang, dữ liệu footprint của cửa sổ này có thể thiếu phần đầu")}
  if(desc)pages.reverse();                                   // các trang tới theo thứ tự mới -> cũ
  const out=[].concat(...pages);
  for(let i=1;i<out.length;i++)if(out[i][0]<out[i-1][0]){out.sort((x,y)=>x[0]-y[0]);break}   // an toàn: sort ổn định, giữ thứ tự các tick cùng ms
  return out;
}
// ghép tick bid + ask thành các sự kiện [ts,bid,ask] (cùng mili-giây thì gộp làm 1, lấy giá cuối)
function ctMergeTicks(B,A){
  const out=[];let i=0,j=0,b=0,a=0;
  while(i<B.length||j<A.length){
    const t=Math.min(i<B.length?B[i][0]:Infinity,j<A.length?A[j][0]:Infinity);
    while(i<B.length&&B[i][0]===t)b=B[i++][1];
    while(j<A.length&&A[j][0]===t)a=A[j++][1];
    out.push([t,b,a]);
  }
  return out;
}
/* Tải footprint cho cửa sổ [lo, hi) (ms, lo căn theo phút). newest=true: cửa sổ mới nhất (tới "bây giờ"), sau khi xong thì bật chế độ live,
   nối tiếp từ tick cuối cùng nên không trùng và không hở. Ghi thẳng vào FPM.
   Tick trong 5 phút trước lo chỉ dùng để dựng trạng thái bid/ask/hướng ban đầu, KHÔNG được cộng vào số liệu. */
async function ctFpWindow(lo,hi,newest){
  const sid=CT.sym&&CT.sym.id,g0=CT.gen;
  const [B,A]=await Promise.all([ctTicks(1,lo-FP_WARM,hi),ctTicks(2,lo-FP_WARM,hi)]);
  const ev=ctMergeTicks(B,A),st={bid:0,ask:0,side:0,run:null},M=new Map(),RB=new Map();let last=0;
  const mapOf=m=>{let mp=M.get(m);if(!mp){mp=new Map();M.set(m,mp)}return mp};
  let nev=0;
  for(const [t,b,a] of ev){
    if((++nev&4095)===0)await sleep(0);                       // cửa sổ lớn: cứ 4096 sự kiện nhường luồng 1 lần để UI không đơ
    if(t>=lo)last=t;
    if(!fpOk(b,a)){if(t>=lo)FPD.bad++;continue}
    if(t<lo){fpStep(st,b,a);continue}                         // khởi động: chỉ cập nhật trạng thái
    fpCount(st,t,b,a,mapOf,r=>btEmit(r,RB));
  }
  if(!CT.sym||CT.sym.id!==sid||CT.gen!==g0)return 0;       // trong lúc nhường luồng đã đổi mã / nối lại: bỏ kết quả cũ, không ghi đè
  if(!newest&&st.run){btEmit(st.run,RB);st.run=null}   // cửa sổ cũ: chốt chuỗi đang dở ở cuối cửa sổ
  for(const [m,mp] of M)FPM.set(u2s(m),fpRows(mp));
  for(const [m,L] of RB)BTE.set(m,L);                // ghi dữ liệu lịch sử TRƯỚC khi phát lại tick live (nếu không sẽ bị ghi đè)
  if(newest){                                       // phút đang chạy dở giữ lại để live cộng tiếp; chuỗi đang dở của st tiếp tục chạy ở chế độ live
    FPL.st=st;FPL.last=last;FPL.min=last?Math.floor(last/60000)*60:0;FPL.map=FPL.min?(M.get(FPL.min)||new Map()):null;
    FPL.ready=true;
    const q=FPL.q;FPL.q=[];for(const [t,b,a] of q)ctFpTick(t,b,a);
  }
  return ev.length;
}

/* Chẩn đoán: gõ ctDiag() trong Console (F12) khi chart đứng để biết đang kẹt ở đâu. */
function ctDiag(){
  const L=CT.liveBar,l=m1.length?m1[m1.length-1]:null,n=Date.now();
  const d={ketNoi:CT.ready,maDangXem:C.sym,maTrenServer:CT.sym&&CT.sym.name,
    giaCuoiCachDay_s:CT.lastSpot?((n-CT.lastSpot)/1e3).toFixed(1):null,goiBatKyCachDay_s:CT.lastMsg?((n-CT.lastMsg)/1e3).toFixed(1):null,
    trendbarServerCachDay_s:CT.tbAt?((n-CT.tbAt)/1e3).toFixed(1):"chưa từng nhận",
    nenLive:L&&{gio:L[0],o:L[1],h:L[2],l:L[3],c:L[4],v:L[5]},nenCuoiTrenChart:l&&{gio:l[0],c:l[4],v:l[5]},
    barDirty:CT.barDirty,dangTaiM1:typeof loading!=="undefined"?loading:null,soNenM1:m1.length,
    chartChoApDung_s:typeof CHW!=="undefined"?((n-CHW.applied)/1e3).toFixed(1):null,loiGanNhat:typeof CHW!=="undefined"?CHW.err:null,capHoiPhuc:typeof CHW!=="undefined"?CHW.lvl:null,
     footprintSanSang:FPL.ready,tickLive_choXuLy:FPL.q.length,fpDangTai:typeof fpBusy!=="undefined"?fpBusy:null};
  console.table(d);return d;
}
