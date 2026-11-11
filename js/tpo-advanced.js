/* ================= TPO ADVANCED / CBOT PARTS II-V =================
   Multi-session distribution analysis built from M1 TPO rows. This is an
   educational approximation of CBOT concepts, not a replacement for futures
   trade volume, centralized order flow, LDB or CTI classifications.
*/
const TPOX_STORE_KEY="tp_tpo_advanced_v1";
const TPOX_DEFAULTS={lookbackSessions:20,intermediateSessions:5,emergingTpo:4,eventClass:"unknown",showActivity:true,referencePrice:"",flowDirection:"auto",dataSource:"auto"};
function tpoXLoadSettings(){let s={};try{s=JSON.parse(localStorage.getItem(TPOX_STORE_KEY)||"{}")||{}}catch{};return{...TPOX_DEFAULTS,...s,lookbackSessions:[5,10,20,30].includes(+s.lookbackSessions)?+s.lookbackSessions:20,intermediateSessions:[3,5,8,10].includes(+s.intermediateSessions)?+s.intermediateSessions:5,flowDirection:["auto","up","down"].includes(s.flowDirection)?s.flowDirection:"auto",emergingTpo:Math.max(2,Math.min(12,Math.round(+s.emergingTpo||4))),eventClass:["unknown","surprise","unlikely","likely"].includes(s.eventClass)?s.eventClass:"unknown",showActivity:s.showActivity!==false,referencePrice:s.referencePrice==null?"":String(s.referencePrice),dataSource:["auto","quote","tick"].includes(s.dataSource)?s.dataSource:"auto"}}
const TPOX={options:tpoXLoadSettings(),historyBars:[],loaded:false,loading:false,progress:"",error:"",symbol:"",epoch:0,version:0,tab:"single",cacheKey:"",sessions:[],composite:null,analysis:null,lastLoadAt:0,autoRequested:false};
const tpoXEsc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const tpoXNum=(v,d=2)=>Number.isFinite(+v)?(+v).toFixed(d):"—";
const tpoXFmtDate=s=>{const p=tpoTimeParts(s,TPO.options.timeZone);return`${String(p.day).padStart(2,"0")}/${String(p.month).padStart(2,"0")}`};
function tpoXMergeBars(...sets){const m=new Map();for(const a of sets)if(Array.isArray(a))for(const b of a)if(b&&Number.isFinite(+b[0]))m.set(+b[0],b);return[...m.values()].sort((a,b)=>a[0]-b[0])}
function tpoXGetBars(){return tpoXMergeBars(TPOX.historyBars,typeof m1!=="undefined"?m1:[])}
function tpoXSave(){try{localStorage.setItem(TPOX_STORE_KEY,JSON.stringify(TPOX.options))}catch{};TPOX.cacheKey="";TPOX.version++;tpoXRender()}
function tpoXSetSetting(k,v){
  if(k==="lookbackSessions")TPOX.options.lookbackSessions=[5,10,20,30].includes(+v)?+v:20;
  else if(k==="intermediateSessions")TPOX.options.intermediateSessions=[3,5,8,10].includes(+v)?+v:5;
  else if(k==="flowDirection")TPOX.options.flowDirection=["auto","up","down"].includes(v)?v:"auto";
  else if(k==="emergingTpo")TPOX.options.emergingTpo=Math.max(2,Math.min(12,Math.round(+v||4)));
  else if(k==="eventClass")TPOX.options.eventClass=["unknown","surprise","unlikely","likely"].includes(v)?v:"unknown";
  else if(k==="showActivity")TPOX.options.showActivity=!!v;
  else if(k==="referencePrice")TPOX.options.referencePrice=String(v||"").trim();
  else if(k==="dataSource")TPOX.options.dataSource=["auto","quote","tick"].includes(v)?v:"auto";
  tpoXSave();if(k==="lookbackSessions"&&TPOX.loaded)tpoXLoadHistory(true)
}
function tpoXStatus(text,kind=""){const e=$("tpoFeedStatus");if(e){e.textContent=text;e.classList.toggle("is-empty",kind==="bad")};TPOX.progress=text;if(kind==="bad")TPOX.error=text;else if(text)TPOX.error=""}
function tpoXCacheBust(){TPO.cache.clear();TPO.last=null;TPOX.cacheKey="";TPOX.version++}
async function tpoXLoadHistory(force=false){
  if(TPOX.loading)return false;
  if(!force&&TPOX.loaded&&TPOX.symbol===C.sym&&TPOX.historyBars.length){tpoXRender();return true}
  if(typeof ctEnsure!=="function"||typeof ctBars!=="function"){tpoXStatus("Không tìm thấy bộ tải M1 cTrader","bad");return false}
  TPOX.loading=true;TPOX.error="";const sym=C.sym;let epoch=0;
  try{
    tpoXStatus("Đang kiểm tra kết nối cTrader…");if(typeof ctReady==="function"&&!ctReady())await ctEnsure();
    if(typeof ctReady==="function"&&!ctReady())throw new Error("cTrader chưa sẵn sàng");
    epoch=typeof CT!=="undefined"?CT.epoch:0;const now=Math.floor(Date.now()/1000),sessions=TPOX.options.lookbackSessions;
    const days=Math.min(62,Math.max(7,Math.ceil(sessions*TPO.options.sessionHours/24*1.8+5))),from=now-days*86400,chunk=7*86400;
    const pulled=[];let hi=now+120;
    for(let end=hi;end>from;){const lo=Math.max(from,end-chunk);tpoXStatus(`Đang tải M1 lịch sử · ${Math.ceil((hi-lo)/86400)} ngày gần nhất…`);const batch=await ctBars(lo,end);if(sym!==C.sym||(typeof CT!=="undefined"&&epoch!==CT.epoch))throw new Error("Mã giao dịch hoặc kết nối đã thay đổi trong lúc tải");if(batch?.length)pulled.push(...batch);end=lo;}
    TPOX.historyBars=tpoXMergeBars(pulled,Array.isArray(m1)?m1:[]);TPOX.loaded=true;TPOX.symbol=sym;TPOX.epoch=epoch;TPOX.lastLoadAt=Date.now();tpoXCacheBust();
    tpoXStatus(`Đã tải ${TPOX.historyBars.length.toLocaleString("en-US")} nến M1 · ${days} ngày`);tpoRenderStandalone(true);tpoXRender();return true;
  }catch(e){TPOX.error=String(e?.message||e);tpoXStatus("Không tải được lịch sử: "+TPOX.error,"bad");tpoXRender();return false}
  finally{TPOX.loading=false}
}
function tpoXProfileForView(){
  const o=TPO.options,bars=tpoXGetBars();if(!o.enabled||!bars.length)return null;
  const last=bars.length-1,ts=typeof s2u==="function"?s2u(bars[last][0]):bars[last][0],base=tpoSessionForTimestamp(ts,o),session=o.sessionPick==="previous"?tpoPreviousSession(base,o):base,tail=bars[last];
  const sig=[C.sym,session.start,session.end,bars.length,tail[0],tail[2],tail[3],tail[4],tail[5],TPOX.version,typeof FPH!=="undefined"?FPH:0,typeof FPLV!=="undefined"?FPLV:0,JSON.stringify(o),"history"].join("|");
  const c=TPO.cache.get("profile");if(c&&c.sig===sig){TPO._profileSig=sig;return c.P}const P=tpoCalcProfile(bars,o,session);TPO.cache.set("profile",{sig,P});TPO.last=P;TPO._profileSig=sig;return P;
}
// Deliberately replace the single-session selector so the same standalone TPO
// page can use the longer history loaded here.
tpoProfileForView=tpoXProfileForView;
function tpoXMakeSessions(bars,count){
  if(!bars.length)return[];const last=bars[bars.length-1],ts=typeof s2u==="function"?s2u(last[0]):last[0];let session=tpoSessionForTimestamp(ts,TPO.options),out=[];
  for(let i=0;i<count;i++){const P=tpoCalcProfile(bars,TPO.options,session);if(P&&P.totalTpo)out.unshift(P);session=tpoPreviousSession(session,TPO.options)}
  return out;
}
function tpoXValueMigration(P,prev){if(!prev)return"—";const eps=Math.max(P.step,prev.step)*.5;if(P.val>prev.vah+eps)return"Dịch chuyển lên";if(P.vah<prev.val-eps)return"Dịch chuyển xuống";const delta=P.pocPrice-prev.pocPrice;if(delta>eps)return"POC cao hơn";if(delta< -eps)return"POC thấp hơn";return"Chồng lấp / cân bằng"}
function tpoXOpenRelation(open,prev){if(!prev||!Number.isFinite(open))return"Không có phiên trước";if(open>prev.vah)return"Mở trên Value";if(open<prev.val)return"Mở dưới Value";return"Mở trong Value"}
function tpoXDistributionShape(P){
  if(!P||!P.counts||!(P.n||P.counts.length))return{code:"—",name:"Chưa đủ dữ liệu",base:"—",pos:.5,temporal:"Không có ma trận bracket"};
  const n=P.counts.length,third=Math.max(1,Math.floor(n/3));
  const sum=(a,b)=>{let v=0;for(let i=a;i<b;i++)v+=P.counts[i]||0;return v};
  const lo=sum(0,third),mid=sum(third,n-third),hi=sum(n-third,n),tot=lo+mid+hi,pos=(P.poc+.5)/n;
  // Parts IV glossary: 1-2-3 starts with rotations then directional activity;
  // 3-2-1 starts directionally then develops rotations. Use bracket order when
  // the actual TPO matrix exists; a histogram alone cannot establish chronology.
  let firstDirectional=null,lastDirectional=null,firstRatio=null,lastRatio=null;
  if(P.cells&&P.nP>3&&P.n){
    const periods=[];
    for(let per=0;per<P.nP;per++){
      let a=Infinity,b=-Infinity,weight=0;
      for(let q=0;q<P.n;q++)if(P.cells[q*P.nP+per]){a=Math.min(a,q);b=Math.max(b,q);weight++}
      if(weight)periods.push({per,lo:a,hi:b,mid:(a+b)/2,width:Math.max(1,b-a+1)});
    }
    const states=[];
    for(let i=1;i<periods.length;i++){
      const x=periods[i],y=periods[i-1],overlap=Math.max(0,Math.min(x.hi,y.hi)-Math.max(x.lo,y.lo)+1),ratio=overlap/Math.max(1,Math.min(x.width,y.width)),shift=Math.abs(x.mid-y.mid)/Math.max(x.width,y.width,1);
      states.push({directional:ratio<.38&&shift>.2,rotation:ratio>.6||shift<.13,ratio,shift});
    }
    if(states.length>=4){
      const cut=Math.max(1,Math.floor(states.length/3)),head=states.slice(0,cut),tail=states.slice(-cut);
      firstRatio=head.filter(x=>x.directional).length/head.length;lastRatio=tail.filter(x=>x.directional).length/tail.length;
      firstDirectional=firstRatio>=.5;lastDirectional=lastRatio>=.5;
      if(firstRatio<=.34&&lastRatio>=.5)return{code:"1-2-3",name:"Balance → directional move (temporal bracket proxy)",base:pos>.67?"Phía trên":pos<.33?"Phía dưới":"Trung tâm",pos,shares:[lo/tot,mid/tot,hi/tot],firstRatio,lastRatio};
      if(firstRatio>=.5&&lastRatio<=.34)return{code:"3-2-1",name:"Directional move → balance (temporal bracket proxy)",base:pos>.67?"Phía trên":pos<.33?"Phía dưới":"Trung tâm",pos,shares:[lo/tot,mid/tot,hi/tot],firstRatio,lastRatio};
    }
  }
  if(pos>=.33&&pos<=.67&&mid>=lo*.85&&mid>=hi*.85)return{code:"3-1-3",name:"Balanced bell-shaped distribution · TPO-count proxy",base:"Trung tâm",pos,shares:[lo/tot,mid/tot,hi/tot],firstRatio,lastRatio};
  if(pos>.67)return{code:"J-shaped candidate",name:"TPO base proxy phía trên · chronology chưa đủ để xác nhận 1-2-3/3-2-1",base:"Phía trên",pos,shares:[lo/tot,mid/tot,hi/tot],firstRatio,lastRatio};
  if(pos<.33)return{code:"J-shaped candidate",name:"TPO base proxy phía dưới · chronology chưa đủ để xác nhận 1-2-3/3-2-1",base:"Phía dưới",pos,shares:[lo/tot,mid/tot,hi/tot],firstRatio,lastRatio};
  return{code:"Mixed",name:"Phân phối hỗn hợp",base:"Không rõ",pos,shares:[lo/tot,mid/tot,hi/tot],firstRatio,lastRatio};
}
function tpoXActivityBehaviour(side,price,prev){
  if(!prev||!Number.isFinite(+price))return"Unclassified";
  if(side==="Buyer"){
    if(price<prev.val)return"Responsive";
    if(price>prev.vah)return"Initiating";
  }else{
    if(price>prev.vah)return"Responsive";
    if(price<prev.val)return"Initiating";
  }
  return"Within value · judgment";
}
function tpoXActivity(P,prev){
  const up=(P.rangeExtensionUp||0)>P.step*.5,dn=(P.rangeExtensionDown||0)>P.step*.5;
  const top=P.topSingles>=2,bot=P.botSingles>=2;
  // A failed extension is a candidate only: final close returned through IB.
  const failedUp=up&&P.ibHigh!=null&&P.close<P.ibHigh-P.step*.5;
  const failedDown=dn&&P.ibLow!=null&&P.close>P.ibLow+P.step*.5;
  const relation=prev?tpoXOpenRelation(P.openPrice,prev):"";
  const valueSide=P.imbalance==="Buyer"||P.imbalance==="Seller"?P.imbalance:"";
  const areas={
    seller:{extreme:top?{active:true,price:P.high,behavior:tpoXActivityBehaviour("Seller",P.high,prev)}:{active:false},range:dn?{active:true,price:P.low,behavior:tpoXActivityBehaviour("Seller",P.low,prev)}:{active:false},value:valueSide==="Seller"?{active:true,price:P.fairPrice,behavior:tpoXActivityBehaviour("Seller",P.fairPrice,prev)}:{active:false}},
    buyer:{extreme:bot?{active:true,price:P.low,behavior:tpoXActivityBehaviour("Buyer",P.low,prev)}:{active:false},range:up?{active:true,price:P.high,behavior:tpoXActivityBehaviour("Buyer",P.high,prev)}:{active:false},value:valueSide==="Buyer"?{active:true,price:P.fairPrice,behavior:tpoXActivityBehaviour("Buyer",P.fairPrice,prev)}:{active:false}}
  };
  const valueBuy=valueSide==="Buyer",valueSell=valueSide==="Seller";
  return{up,dn,top,bot,failedUp,failedDown,neutral:up&&dn,openRelation:relation,valueBuy,valueSell,areas,
    sellExtreme:top,sellRange:dn,sellValue:valueSell,buyExtreme:bot,buyRange:up,buyValue:valueBuy};
}
function tpoXBracketSequence(P){
  if(!P?.cells||!P.nP||!P.n)return{periods:[],fourStep:"Chưa có ma trận bracket để phân tích"};
  const raw=[];
  for(let per=0;per<P.nP;per++){
    let lo=Infinity,hi=-Infinity,count=0,poc=-1,pocCount=-1;
    for(let q=0;q<P.n;q++)if(P.cells[q*P.nP+per]){lo=Math.min(lo,q);hi=Math.max(hi,q);count++;if((P.counts[q]||0)>pocCount){poc=q;pocCount=P.counts[q]||0}}
    if(!count)continue;
    const t=tpoTimeParts(P.session.start+per*P.periodSec,TPO.options.timeZone),letter=tpoLetter(per,t.hour*60+t.minute,P.periodMin,TPO.options.letterMode);
    raw.push({index:per,letter,time:`${String(t.hour).padStart(2,"0")}:${String(t.minute).padStart(2,"0")}`,lo,hi,low:P.base+lo*P.step,high:P.base+(hi+1)*P.step,center:(lo+hi)/2,width:Math.max(1,hi-lo+1),poc:poc>=0?P.base+(poc+.5)*P.step:null,count});
  }
  let runHi=-Infinity,runLo=Infinity;
  const periods=raw.map((x,i)=>{
    const prior=raw[i-1],overlap=prior?Math.max(0,Math.min(x.hi,prior.hi)-Math.max(x.lo,prior.lo)+1)/Math.max(1,Math.min(x.width,prior.width)):1;
    const extendsUp=x.hi>runHi+.5,extendsDown=x.lo<runLo-.5;
    let phase="Development / rotation",direction=0;
    if(i===0)phase="Beginning / pioneer range";
    else if(extendsUp&&extendsDown){phase="Neutral · extension hai phía";direction=2}
    else if(extendsUp){phase="Distribution / range extension ↑";direction=1}
    else if(extendsDown){phase="Distribution / range extension ↓";direction=-1}
    else if(overlap<.25){phase="Directional move candidate";direction=x.center>(prior?.center??x.center)?1:-1}
    else if(overlap<.58){phase="Test / transition"}
    runHi=Math.max(runHi,x.hi);runLo=Math.min(runLo,x.lo);
    return{...x,overlap,direction,phase};
  });
  const firstMove=periods.findIndex(x=>x.direction===1||x.direction===-1),balance=firstMove>=0?periods.findIndex((x,i)=>i>firstMove&&x.phase==="Development / rotation"):-1;
  const test=balance>=0?periods.findIndex((x,i)=>i>balance&&x.phase==="Test / transition"):-1;
  const resolution=test>=0?periods.find((x,i)=>i>test&&(x.direction===1||x.direction===-1||x.direction===2)):null;
  let fourStep="Chưa đủ trình tự Beginning → Balance → Test → Resolution";
  if(firstMove>=0&&balance>=0){
    fourStep=`Beginning ${periods[firstMove].letter} → Balance ${periods[balance].letter}`;
    if(test>=0){fourStep+=` → Test ${periods[test].letter}`;if(resolution){const same=periods[firstMove].direction===resolution.direction;fourStep+=` → ${same?"Continuation":"Change / opposite response"} ${resolution.letter}`}else fourStep+=" → đang chờ phản ứng tiếp theo"}
    else fourStep+=" → chưa xác nhận test";
  }
  return{periods,fourStep};
}
function tpoXSessionState(P,prev){
  if(!prev)return"Beginning / chưa có phiên đối chiếu";
  const eps=Math.max(P.step,prev.step)*.5;
  const up=P.high>prev.high+eps&&P.pocPrice>prev.pocPrice+eps;
  const down=P.low<prev.low-eps&&P.pocPrice<prev.pocPrice-eps;
  const overlap=Math.min(P.vah,prev.vah)-Math.max(P.val,prev.val)>0;
  const failed=!!(P.activity?.failedUp||P.activity?.failedDown);
  if(P.activity?.neutral)return"Neutral / range extension hai phía";
  if(failed)return"Test / failed extension candidate";
  if(up&&!down)return"Directional move up · distribution";
  if(down&&!up)return"Directional move down · distribution";
  if(overlap)return"Balance / development";
  return"Transition / new value area";
}
function tpoXEnrich(sessions,bars){
  return sessions.map((P,i)=>{
    const prev=sessions[i-1]||null,i0=tpoLowerBoundUTC(bars,P.session.start),i1=tpoLowerBoundUTC(bars,P.session.end);
    // Do not borrow the next session's open when this session has no first M1.
    const openPrice=i0<i1&&i0<bars.length?+bars[i0][1]:null;
    P.openPrice=openPrice;P.previous=prev;P.openRelation=tpoXOpenRelation(openPrice,prev);P.valueMigration=tpoXValueMigration(P,prev);P.activity=tpoXActivity(P,prev);P.shape=tpoXDistributionShape(P);P.state=tpoXSessionState(P,prev);
    P.partial=i===sessions.length-1&&P.session.end>(typeof s2u==="function"?s2u(bars[bars.length-1][0]):bars[bars.length-1][0]);return P
  });
}
function tpoXBuildUnits(sessions){
  if(!sessions?.length)return[];
  const units=[];let cur=null;
  sessions.forEach((P,i)=>{
    const prev=sessions[i-1]||null,eps=Math.max(P.step,prev?.step||P.step)*.75;
    const up=!!prev&&P.high>prev.high+eps&&P.pocPrice>prev.pocPrice+eps;
    const down=!!prev&&P.low<prev.low-eps&&P.pocPrice<prev.pocPrice-eps;
    const dir=up&&!down?1:down&&!up?-1:0;
    // A natural-unit boundary is approximated by a directional move/value shift,
    // not by forcing every fixed number of sessions into a new unit.
    if(!cur||dir&&(!cur.direction||dir!==cur.direction)){cur={index:units.length+1,direction:dir,start:P.session.start,end:P.session.end,sessions:[],high:P.high,low:P.low};units.push(cur)}
    cur.sessions.push(P);cur.end=P.session.end;cur.high=Math.max(cur.high,P.high);cur.low=Math.min(cur.low,P.low);if(dir&&!cur.direction)cur.direction=dir;
  });
  const result=units.map(u=>{
    const C=tpoXBuildComposite(u.sessions,70),widths=u.sessions.map(x=>x.vah-x.val),recent=widths.slice(-3),narrowing=recent.length>=2&&recent.at(-1)<recent[0];
    const overlaps=u.sessions.slice(1).filter((x,i)=>Math.min(x.vah,u.sessions[i].vah)-Math.max(x.val,u.sessions[i].val)>0).length;
    const balance=u.sessions.length>1&&overlaps>=u.sessions.length-1&&!narrowing;
    const patterns=u.sessions.map(x=>x.shape?.code).filter(x=>x==="1-2-3"||x==="3-2-1"),pattern=patterns.at(-1)||"—";
    return{...u,control:C?.pocPrice??null,vah:C?.vah??null,val:C?.val??null,shape:C?.shape??null,pattern,phase:balance?"Development / balanced rotations":narrowing?"Development becoming efficient":u.direction>0?"Distribution / directional up":u.direction<0?"Distribution / directional down":"Mixed / not classified",narrowing,memberCount:u.sessions.length};
  });
  for(let i=1;i<result.length;i++){
    const a=result[i-1],b=result[i],valid=(a.pattern==="3-2-1"&&b.pattern==="1-2-3")||(a.pattern==="1-2-3"&&b.pattern==="3-2-1");
    if(valid){a.compositePair="J-shaped unit paired with next J-shaped unit";b.compositePair="J-shaped unit paired with previous J-shaped unit";}
  }
  return result;
}
function tpoXBuildComposite(sessions,percent=70){
  if(!sessions?.length)return null;const min=Math.min(...sessions.map(P=>P.base)),max=Math.max(...sessions.map(P=>P.base+P.n*P.step)),tick=Math.pow(10,-Math.max(0,Math.min(8,typeof PDIG==="function"?PDIG():2))),step=tpoNiceStep(Math.max(max-min,tick),tick),n=Math.max(1,Math.min(1600,Math.ceil((max-min)/step))),counts=new Float64Array(n),metric=new Float64Array(n);
  for(const P of sessions)for(let q=0;q<P.n;q++){const price=P.base+(q+.5)*P.step,k=Math.max(0,Math.min(n-1,Math.floor((price-min)/step)));counts[k]+=P.counts[q]||0;metric[k]+=P.metric?.[q]||0}
  let poc=0,mx=-1,total=0;for(let i=0;i<n;i++){total+=counts[i];if(counts[i]>mx){mx=counts[i];poc=i}}
  const va=tpoValueArea(counts,poc,percent),fair=tpoFindFairPrice(counts,va.lo,va.hi,(n-1)/2),shape=tpoXDistributionShape({counts,poc});
  return{min,max,step,n,counts,metric,poc,va,fair,total,pocPrice:min+(poc+.5)*step,vah:min+(va.hi+1)*step,val:min+va.lo*step,fairPrice:min+(fair+.5)*step,shape,sessions:sessions.length,metricName:"TPO count summed across sessions"};
}
function tpoXMinusDevelopment(P,reference,direction,threshold){
  if(!P?.counts||!(P.n||P.counts.length)||!Number.isFinite(+reference))return{ready:false,label:"Thiếu profile hoặc giá tham chiếu"};
  const step=P.step,base=P.base,n=P.n,ref=Math.max(0,Math.min(n-1,Math.floor((reference-base)/step))),dir=direction>=0?1:-1,thresholdN=Math.max(2,Math.round(threshold||4));let q=ref+dir,gap=0,found=-1;
  while(q>=0&&q<n){if((P.counts[q]||0)>=thresholdN){found=q;break}gap++;q+=dir}
  if(found<0)return{ready:true,direction:dir>0?"Lên":"Xuống",reference,threshold:thresholdN,rows:gap,priceGap:gap*step,emergingPrice:null,label:"Chưa thấy emerging activity đạt ngưỡng trong biên profile"};
  const emergingPrice=base+(found+.5)*step;return{ready:true,direction:dir>0?"Lên":"Xuống",reference,threshold:thresholdN,rows:gap,priceGap:Math.abs(emergingPrice-reference),emergingPrice,label:gap?`Có ${gap} hàng thiếu phát triển giữa giá tham chiếu và emerging activity`:`Emerging activity ngay cạnh giá tham chiếu`};
}
function tpoXBuildAnalytics(sessions,composite,options={},units=[]){
  if(!sessions?.length)return null;
  const P=sessions[sessions.length-1],prev=sessions[sessions.length-2]||null;
  const nInt=[3,5,8,10].includes(+options.intermediateSessions)?+options.intermediateSessions:5;
  const lastInt=sessions.slice(-nInt),last3=sessions.slice(-3),mean=lastInt.reduce((s,x)=>s+x.pocPrice,0)/lastInt.length;
  const d=last3.length>1?last3[last3.length-1].pocPrice-last3[0].pocPrice:0;
  const dir=d>Math.max(P.step,0)?1:d< -Math.max(P.step,0)?-1:0;
  const overlaps=last3.slice(1).filter((x,i)=>{const y=last3[i];return Math.min(x.vah,y.vah)-Math.max(x.val,y.val)>0}).length;
  const expansions=last3.slice(1).filter((x,i)=>x.high>last3[i].high+x.step*.5||x.low<last3[i].low-x.step*.5).length;
  const control=overlaps>=Math.max(1,last3.length-1)&&expansions<=1?"Controlled by price · balance/rotation":overlaps===0&&expansions>=1&&dir!==0?"Controlled by market activity · distribution/imbalance":"Mixed / transition · chưa có bên kiểm soát rõ";
  const confidence=(dir!==0&&expansions>=1)?"Confidence proxy · directional":"Uncertainty proxy · rotations / balance";
  const phase=P.state||"Chưa xác định",current=Number.isFinite(P.close)?P.close:P.pocPrice;
  const relation=composite?(current>composite.vah?"Price above composite Value":current<composite.val?"Price below composite Value":"Price inside composite Value"):"Chưa có composite";
  const manualDirection=options.flowDirection||"auto",flowDir=manualDirection==="up"?1:manualDirection==="down"?-1:dir||((current-P.pocPrice)>=0?1:-1);
  const reference=String(options.referencePrice??"").trim()!==""&&Number.isFinite(+options.referencePrice)?+options.referencePrice:current;
  const minus=tpoXMinusDevelopment(P,reference,flowDir,options.emergingTpo||4);
  const prevMinus=prev?tpoXMinusDevelopment(prev,reference,flowDir,options.emergingTpo||4):null;
  const minusTrend=minus?.ready&&prevMinus?.ready&&Number.isFinite(minus.priceGap)&&Number.isFinite(prevMinus.priceGap)?(minus.priceGap>prevMinus.priceGap+P.step*.5?"Gap mở rộng":minus.priceGap<prevMinus.priceGap-P.step*.5?"Gap thu hẹp":"Gap ổn định"):"Chưa đủ phiên để so sánh";
  const params=composite?[
    {name:"Long-term high",price:composite.max},{name:"Composite VAH",price:composite.vah},{name:"Long-term control / POC",price:composite.pocPrice},{name:"Composite VAL",price:composite.val},{name:"Long-term low",price:composite.min},
    ...(units.at(-1)?[{name:"Current unit control",price:units.at(-1).control},{name:"Developing Value High",price:units.at(-1).vah},{name:"Developing Value Low",price:units.at(-1).val},{name:"Current unit high",price:units.at(-1).high},{name:"Current unit low",price:units.at(-1).low}]:[])
  ].filter(x=>Number.isFinite(x.price)).map(x=>{const crossed=Number.isFinite(P.openPrice)&&((P.openPrice<x.price&&P.close>x.price)||(P.openPrice>x.price&&P.close<x.price)),touched=P.high>=x.price&&P.low<=x.price;return{...x,status:crossed?"Violated · close crossed":touched?"Tested · hold candidate":P.close>x.price?"Giá đang ở trên":"Giá đang ở dưới"}}) : [];
  const eClass=options.eventClass||"unknown",eventMap={unknown:{title:"Chưa phân loại",effect:"Chưa đưa ra giả định về thay đổi Value."},surprise:{title:"Surprise event",effect:"Theo tài liệu, thường làm giá dịch chuyển nhanh khỏi Value hiện tại rồi có thể quay lại; ảnh hưởng thiên về near-term."},unlikely:{title:"Unlikely event",effect:"Theo tài liệu, giá và Value có thể dịch chuyển cùng nhau; ảnh hưởng intermediate-term và ít thời gian điều chỉnh."},likely:{title:"Likely event",effect:"Theo tài liệu, Value có thể dịch chuyển trước giá; ảnh hưởng long-term, giá có thể cần thời gian hội tụ về Value mới."}}[eClass];
  const widths=sessions.slice(-3).map(x=>x.vah-x.val),efficient=widths.length>=2&&widths.at(-1)<widths[0];
  const unit=units.at(-1)||null,brackets=tpoXBracketSequence(P);
  return{nearControl:P.pocPrice,intermediateControl:mean,longControl:composite?.pocPrice??null,intermediateSessions:lastInt.length,flowDir,flow:dir>0?"Capital flow proxy: Value/POC tăng":dir<0?"Capital flow proxy: Value/POC giảm":"Chưa có hướng migration rõ",control,confidence,phase,relation,minus,prevMinus,minusTrend,params,event:eventMap,shape:P.shape,unit,efficiency:efficient?"Rotations / Value đang thu hẹp · efficiency tăng":"Chưa thấy Value thu hẹp rõ",stateSequence:sessions.slice(-4).map(x=>({date:x.session.label,state:x.state})),activity:P.activity,brackets};
}
function tpoXRefreshAnalytics(){
  const bars=tpoXGetBars();if(!bars.length){TPOX.sessions=[];TPOX.composite=null;TPOX.units=[];TPOX.analysis=null;return}
  const sig=[C.sym,bars.length,bars[0]?.[0],bars[bars.length-1]?.[0],bars[bars.length-1]?.[4],bars[bars.length-1]?.[5],TPOX.version,JSON.stringify(TPO.options),JSON.stringify(TPOX.options),typeof FPH!=="undefined"?FPH:0,typeof FPLV!=="undefined"?FPLV:0,typeof FPV!=="undefined"?FPV:0].join("|");if(TPOX.cacheKey===sig)return;
  let sessions=tpoXMakeSessions(bars,TPOX.options.lookbackSessions);sessions=tpoXEnrich(sessions,bars);TPOX.sessions=sessions;
  TPOX.composite=tpoXBuildComposite(sessions,TPO.options.valueArea);TPOX.units=tpoXBuildUnits(sessions);TPOX.analysis=tpoXBuildAnalytics(sessions,TPOX.composite,TPOX.options,TPOX.units);TPOX.cacheKey=sig;
}
function tpoXPanelMarkup(){return`<div class="tpox-panel-head"><div><span class="tpox-kicker">CBOT STUDY GUIDE · PARTS II–V</span><h3>Multi-session Market Profile</h3><p class="msg">Theo dõi Value, phân phối và dòng tiền qua nhiều đơn vị thị trường. Các phép suy ra từ TPO/CFD được gắn nhãn proxy.</p></div><div class="tpox-head-actions"><button class="btn sm" data-tpox-action="load" type="button">${TPOX.loading?"Đang tải…":"Tải lịch sử"}</button><span class="tpox-load-status">${tpoXEsc(TPOX.progress||"Chưa tải lịch sử dài")}</span></div></div>`}
function tpoXSettingsMarkup(){const o=TPOX.options;return`<details class="tpo-settings-details tpox-settings"><summary><span><b>Thiết lập phân tích nâng cao</b><small>Số phiên · khung thời gian · dòng tiền · event context</small></span><span class="tpo-settings-caret">⌄</span></summary><div class="tpo-settings-body"><section class="tpo-setting-group"><h4>Multi-session / Natural trading units</h4><div class="tpo-config-grid"><label>Số phiên phân tích<select data-tpox="lookbackSessions">${[5,10,20,30].map(n=>`<option value="${n}"${n===o.lookbackSessions?" selected":""}>${n} phiên</option>`).join("")}</select></label><label>Số phiên intermediate-term<select data-tpox="intermediateSessions">${[3,5,8,10].map(n=>`<option value="${n}"${n===o.intermediateSessions?" selected":""}>${n} phiên</option>`).join("")}</select></label><label>Activity profile / LDB proxy<select data-tpox="dataSource"><option value="auto"${o.dataSource==="auto"?" selected":""}>Tự động theo độ phủ</option><option value="quote"${o.dataSource==="quote"?" selected":""}>Footprint quote events</option><option value="tick"${o.dataSource==="tick"?" selected":""}>M1 tick volume</option></select></label><label>Emerging activity · ngưỡng TPO<input type="number" min="2" max="12" step="1" value="${o.emergingTpo}" data-tpox="emergingTpo"></label><label>Hướng Minus Development<select data-tpox="flowDirection"><option value="auto"${o.flowDirection==="auto"?" selected":""}>Tự động theo migration</option><option value="up"${o.flowDirection==="up"?" selected":""}>Dòng tiền lên</option><option value="down"${o.flowDirection==="down"?" selected":""}>Dòng tiền xuống</option></select></label><label>Event classification<select data-tpox="eventClass">${[["unknown","Chưa phân loại"],["surprise","Surprise event"],["unlikely","Unlikely event"],["likely","Likely event"]].map(([v,n])=>`<option value="${v}"${v===o.eventClass?" selected":""}>${n}</option>`).join("")}</select></label><label>Trade location / giá tham chiếu (trống = giá hiện tại)<input type="number" step="any" data-tpox="referencePrice" value="${tpoXEsc(o.referencePrice)}" placeholder="Ví dụ: 3900.00"></label></div><div class="tpo-setting-toggles"><label class="tpo-setting-check"><input type="checkbox" data-tpox="showActivity"${o.showActivity?" checked":""}><span>Hiện bảng initiating / responsive activity</span></label></div><p class="tpo-source-note">Near-term = phiên mới nhất; intermediate-term = trung bình control price của số phiên được chọn; long-term = composite POC của số phiên nhìn lại. Natural trading units được đánh dấu bằng directional move / migration — đây là proxy theo M1/TPO, không phải phân đoạn thủ công hoàn hảo ở cấp từng trade.</p></section></div></details>`}
function tpoXSetTab(tab){if(!["single","composite","auction","analysis","data"].includes(tab))tab="single";TPOX.tab=tab;document.querySelectorAll("[data-tpox-tab]").forEach(b=>b.classList.toggle("on",b.dataset.tpoxTab===tab));document.querySelectorAll("[data-tpox-pane]").forEach(p=>p.hidden=p.dataset.tpoxPane!==tab);if(tab!=="single")tpoXRender();else tpoRenderStandalone(true)}
function tpoXRenderComposite(){const P=TPOX.composite,cv=$("tpoxCompositeCanvas"),info=$("tpoxCompositeInfo");if(!cv||!info)return;if(!P){info.textContent="Chưa có dữ liệu. Hãy tải lịch sử nhiều phiên.";cv.width=1;cv.height=1;const unitsEl=$("tpoxUnits");if(unitsEl)unitsEl.innerHTML="";return}
  const W=Math.max(320,Math.min(900,cv.parentElement?.clientWidth||760)),H=Math.max(260,Math.min(560,P.n*5)),d=Math.min(2,window.devicePixelRatio||1);cv.style.width=W+"px";cv.style.height=H+"px";cv.width=W*d;cv.height=H*d;const g=cv.getContext("2d");g.setTransform(d,0,0,d,0,0);const dark=document.documentElement.dataset.theme==="dark",bg=dark?"#121a24":"#fffaf0",ink=dark?"#e6edf3":"#3c2c16",mut=dark?"#9eb0bd":"#806a45",blue=dark?"#71b9d5":"#3785aa",gold=dark?"#edc45d":"#b17a1f",red=dark?"#e48b8b":"#b65353";g.fillStyle=bg;g.fillRect(0,0,W,H);const left=66,right=22,top=15,bottom=20,plotW=W-left-right,plotH=H-top-bottom,max=Math.max(1,...P.counts),barW=Math.max(1,plotW*.78),rh=plotH/P.n;
  for(let i=0;i<P.n;i++){const q=P.n-1-i,y=top+i*rh,v=P.counts[q],w=v/max*barW,va=q>=P.va.lo&&q<=P.va.hi;g.fillStyle=q===P.poc?gold:va?blue:(dark?"#536272":"#c7b99f");g.globalAlpha=q===P.poc?1:va?.78:.32;g.fillRect(left,y,Math.max(1,w),Math.max(1,rh-1));g.globalAlpha=1;if(q===P.poc||q%Math.max(1,Math.floor(P.n/12))===0){g.fillStyle=ink;g.font="10px system-ui";g.textAlign="right";g.textBaseline="middle";g.fillText(tpoXNum(P.min+(q+.5)*P.step),left-8,y+rh/2)}}
  const line=(price,color,dash=[])=>{const y=top+(P.max-price)/(P.max-P.min||1)*plotH;g.strokeStyle=color;g.setLineDash(dash);g.beginPath();g.moveTo(left,y);g.lineTo(W-right,y);g.stroke();g.setLineDash([])};line(P.vah,blue,[5,3]);line(P.val,blue,[5,3]);line(P.pocPrice,gold);line(P.fairPrice,"#a475ce",[2,3]);g.fillStyle=ink;g.font="11px system-ui";g.textAlign="left";g.fillText("POC "+tpoXNum(P.pocPrice),left+barW+8,top+15);g.fillText("VAH "+tpoXNum(P.vah),left+barW+8,top+31);g.fillText("VAL "+tpoXNum(P.val),left+barW+8,top+47);g.fillStyle=mut;g.textAlign="center";g.fillText("TPO count across "+P.sessions+" sessions",left+plotW/2,H-5);
  info.innerHTML=`<div class="tpox-stat"><span>Composite POC</span><b>${tpoXNum(P.pocPrice)}</b></div><div class="tpox-stat"><span>VAH / VAL</span><b>${tpoXNum(P.vah)} / ${tpoXNum(P.val)}</b></div><div class="tpox-stat"><span>Fair Price</span><b>${tpoXNum(P.fairPrice)}</b></div><div class="tpox-stat"><span>TPO tích luỹ</span><b>${Math.round(P.total).toLocaleString("en-US")}</b></div><p class="tpox-note">Composite dùng tổng TPO theo từng hàng giá, không phải volume hợp đồng. POC / Value Area là composite TPO-count.</p>`;
  const unitsEl=$("tpoxUnits"),units=TPOX.units||[];if(unitsEl)unitsEl.innerHTML=`<div class="tpox-subhead">Natural trading units · Part IV–V</div>${units.length?`<div class="tpox-table-wrap"><table class="tpox-table"><thead><tr><th>Unit</th><th>Start → End</th><th>Direction</th><th>High / Low</th><th>Control</th><th>Developing Value</th><th>Phase</th><th>Structure</th></tr></thead><tbody>${units.slice().reverse().map(u=>`<tr><td>#${u.index}</td><td>${tpoXEsc(u.sessions[0]?.session.label||"—")} → ${tpoXEsc(u.sessions.at(-1)?.session.label||"—")}</td><td>${u.direction>0?"↑ Up":u.direction<0?"↓ Down":"—"}</td><td>${tpoXNum(u.high)} / ${tpoXNum(u.low)}</td><td>${tpoXNum(u.control)}</td><td>${tpoXNum(u.vah)} / ${tpoXNum(u.val)}</td><td>${tpoXEsc(u.phase)}</td><td>${tpoXEsc(u.pattern)}${u.compositePair?" · Composite candidate":""}</td></tr>`).join("")}</tbody></table></div>`:`<p class="msg">Chưa phát hiện natural unit.</p>`}<p class="tpox-note">Mỗi unit bắt đầu khi có dấu hiệu directional move và value/control cùng dịch chuyển. Dữ liệu đang dùng phiên M1 làm đơn vị quan sát; với thị trường 24h, một unit có thể bắt đầu giữa phiên thật.</p>`;
}
function tpoXRenderAuction(){const S=TPOX.sessions,cv=$("tpoxAuctionCanvas"),wrap=$("tpoxAuctionScroll"),tbl=$("tpoxAuctionTable");if(!cv||!tbl||!wrap)return;if(!S.length){tbl.innerHTML='<p class="msg">Chưa có dữ liệu nhiều phiên. Bấm “Tải lịch sử”.</p>';cv.width=1;cv.height=1;return}
  const n=S.length,W=Math.max(760,n*44+80),H=330,d=Math.min(2,window.devicePixelRatio||1);wrap.style.width="100%";cv.style.width=W+"px";cv.style.height=H+"px";cv.width=W*d;cv.height=H*d;const g=cv.getContext("2d");g.setTransform(d,0,0,d,0,0);const dark=document.documentElement.dataset.theme==="dark",bg=dark?"#101923":"#fffaf0",ink=dark?"#dce5ec":"#3d2b15",mut=dark?"#91a4b2":"#88714d",va=dark?"rgba(65,158,198,.24)":"rgba(65,153,194,.2)",gold=dark?"#ecc35d":"#ab741b",grid=dark?"rgba(190,204,215,.13)":"rgba(112,88,49,.15)";const min=Math.min(...S.map(p=>p.low)),max=Math.max(...S.map(p=>p.high)),range=max-min||1,left=44,right=22,top=20,bottom=35,ph=H-top-bottom,stepX=(W-left-right)/n,y=p=>top+(max-p)/range*ph;
  g.fillStyle=bg;g.fillRect(0,0,W,H);for(let k=0;k<=5;k++){const p=min+range*k/5,yy=y(p);g.strokeStyle=grid;g.beginPath();g.moveTo(left,yy);g.lineTo(W-right,yy);g.stroke();g.fillStyle=mut;g.font="10px system-ui";g.textAlign="right";g.textBaseline="middle";g.fillText(tpoXNum(p),left-6,yy)}
  let prevY=null;S.forEach((p,i)=>{const x=left+stepX*(i+.5),rw=Math.max(8,stepX*.55),yH=y(p.vah),yL=y(p.val),yP=y(p.pocPrice);g.fillStyle=va;g.fillRect(x-rw/2,yH,rw,Math.max(2,yL-yH));g.strokeStyle=gold;g.lineWidth=1.6;g.beginPath();g.moveTo(x,y(p.high));g.lineTo(x,y(p.low));g.stroke();g.fillStyle=gold;g.beginPath();g.arc(x,yP,3,0,Math.PI*2);g.fill();if(prevY!=null){g.strokeStyle=gold;g.globalAlpha=.75;g.beginPath();g.moveTo(x-stepX,prevY);g.lineTo(x,yP);g.stroke();g.globalAlpha=1}prevY=yP;g.fillStyle=ink;g.font="9px system-ui";g.textAlign="center";g.fillText(tpoXFmtDate(p.session.start),x,H-14)});
  tbl.innerHTML=`<div class="tpox-table-wrap"><table class="tpox-table"><thead><tr><th>Phiên</th><th>POC</th><th>VAH</th><th>VAL</th><th>Range H/L</th><th>Value migration</th><th>Open vs prev VA</th><th>Day type</th><th>RE / Test</th><th>VA source</th><th>Unit phase</th></tr></thead><tbody>${S.slice().reverse().map(p=>`<tr><td>${tpoXEsc(p.session.label)}${p.partial?" · đang chạy":""}</td><td>${tpoXNum(p.pocPrice)}</td><td>${tpoXNum(p.vah)}</td><td>${tpoXNum(p.val)}</td><td>${tpoXNum(p.high)} / ${tpoXNum(p.low)}</td><td>${tpoXEsc(p.valueMigration)}</td><td>${tpoXEsc(p.openRelation)}</td><td>${tpoXEsc(p.dayType)}</td><td>${p.activity.failedUp?"Failed ↑ candidate":p.activity.failedDown?"Failed ↓ candidate":p.activity.neutral?"Hai phía":"—"}</td><td>${p.valueModeUsed==="quote"?"Quote proxy":p.valueModeUsed==="tick"?"M1 tick proxy":"TPO count"} · ${tpoXEsc(p.valueAreaMethod||"—")}</td><td>${tpoXEsc(p.state||"—")}</td></tr>`).join("")}</tbody></table></div>`;
}
function tpoXRenderActivity(){const el=$("tpoxActivityTable");if(!el)return;el.hidden=!TPOX.options.showActivity;if(el.hidden)return;const S=TPOX.sessions.slice(-8).reverse();if(!S.length){el.textContent="Chưa có dữ liệu";return}
  const cols=[["seller","extreme","SELL · Init extreme"],["seller","range","SELL · Init range"],["seller","value","SELL · Init value"],["seller","extreme","SELL · Resp extreme"],["seller","range","SELL · Resp range"],["seller","value","SELL · Resp value"],["buyer","extreme","BUY · Init extreme"],["buyer","range","BUY · Init range"],["buyer","value","BUY · Init value"],["buyer","extreme","BUY · Resp extreme"],["buyer","range","BUY · Resp range"],["buyer","value","BUY · Resp value"]];
  const cells=p=>cols.map(([side,area,label],i)=>{const a=p.activity?.areas?.[side]?.[area],init=i%6<3;return a?.active&&a.behavior===(init?"Initiating":"Responsive")?'<span class="tpox-yes">●</span>':'<span class="tpox-no">—</span>'});
  const within=p=>["seller","buyer"].flatMap(side=>["extreme","range","value"].map(area=>p.activity?.areas?.[side]?.[area])).filter(a=>a?.active&&a.behavior==="Within value · judgment").length;
  el.innerHTML=`<div class="tpox-table-wrap"><table class="tpox-table tpox-activity-wide"><thead><tr><th rowspan="2">Phiên</th><th colspan="6">SELLER</th><th colspan="6">BUYER</th><th rowspan="2">Within value*</th></tr><tr>${cols.map(c=>`<th>${c[2].replace(/^(SELL|BUY) · /,"")}</th>`).join("")}</tr></thead><tbody>${S.map(p=>`<tr><td>${tpoXEsc(p.session.label)}</td>${cells(p).join("")}<td>${within(p)}</td></tr>`).join("")}</tbody></table></div><p class="tpox-note">Initiating = mua trên previous Value / bán dưới previous Value; Responsive = mua dưới previous Value / bán trên previous Value. Within value* là số hoạt động nằm trong previous Value, cần phán đoán và không ép vào Init/Resp. Các event cực trị, range extension và value area được suy ra từ TPO/giá; đây không phải nhận diện trader participant thật.</p>`;
}
function tpoXRenderAnalysis(){const el=$("tpoxAnalysis");if(!el)return;const A=TPOX.analysis,P=TPOX.sessions.at(-1),C=TPOX.composite;if(!A||!P){el.innerHTML='<p class="msg">Tải dữ liệu nhiều phiên để phân tích.</p>';return}const flow=A.flowDir>0?"UP":A.flowDir<0?"DOWN":"NEUTRAL",flowClass=A.flowDir>0?"up":A.flowDir<0?"down":"flat";el.innerHTML=`<div class="tpox-analysis-grid">
    <article class="tpox-card"><span>Near-term control price</span><b>${tpoXNum(A.nearControl)}</b><small>POC của phiên gần nhất</small></article><article class="tpox-card"><span>Intermediate-term control</span><b>${tpoXNum(A.intermediateControl)}</b><small>Trung bình POC của ${A.intermediateSessions} phiên gần nhất</small></article><article class="tpox-card"><span>Long-term control price</span><b>${tpoXNum(A.longControl)}</b><small>Composite POC của ${C?.sessions||0} phiên</small></article><article class="tpox-card"><span>Capital flow proxy</span><b class="${flowClass}">${flow}</b><small>${tpoXEsc(A.flow)}</small></article><article class="tpox-card"><span>Current natural unit</span><b>${A.unit?"#"+A.unit.index:"—"}</b><small>${tpoXEsc(A.unit?.phase||"Chưa phân loại")}</small></article><article class="tpox-card"><span>Market efficiency</span><b>${A.efficiency.includes("thu hẹp")?"Narrowing":"Normal / chưa rõ"}</b><small>${tpoXEsc(A.efficiency)}</small></article></div>
    <div class="tpox-section-card"><h4>Parts III–IV · Price / Value và thị trường kiểm soát bởi Price hay Activity</h4><div class="tpox-analysis-row"><b>${tpoXEsc(A.relation)}</b><span>${tpoXEsc(A.control)}</span></div><p>${tpoXEsc(A.confidence)}. Cách diễn giải theo tài liệu: directional movement thường biểu hiện confidence; rotations thường biểu hiện uncertainty. Đây là mô tả hành vi, không phải xác suất dự báo.</p><div class="tpox-analysis-row"><b>Four-step behaviour / current state</b><span>${tpoXEsc(A.phase)}</span></div><div class="tpox-param-list">${A.stateSequence.map((x,i)=>`<div><span>${tpoXEsc(x.date)}</span><b>${tpoXEsc(x.state)}</b><small>Quan sát ${i+1}/4</small></div>`).join("")}</div><div class="tpox-analysis-row"><b>Distribution shape</b><span>${tpoXEsc(A.shape?.code||"—")} · ${tpoXEsc(A.shape?.name||"—")}</span></div><p>3-1-3 là phân phối cân bằng có volume/TPO base ở giữa; 1-2-3 bắt đầu bằng rotations rồi chuyển sang directional move; 3-2-1 đi theo chiều ngược lại. Khi có ma trận bracket, ứng dụng suy ra chronology từ vùng giá hoạt động theo từng bracket; đây vẫn là proxy OHLC/TPO, không phải phân loại CBOT volume thực.</p><div class="tpox-analysis-row"><b>Four-step behaviour trong phiên</b><span>${tpoXEsc(A.brackets?.fourStep||"—")}</span></div><div class="tpox-bracket-flow"><div class="tpox-subhead">Intraday bracket sequence · theo thứ tự thời gian</div><div class="tpox-table-wrap"><table class="tpox-table"><thead><tr><th>Bracket</th><th>Giờ</th><th>Range</th><th>Overlap</th><th>Phase / Behaviour</th></tr></thead><tbody>${(A.brackets?.periods||[]).slice(-24).map(x=>`<tr><td><b>${tpoXEsc(x.letter)}</b></td><td>${x.time}</td><td>${tpoXNum(x.high)} / ${tpoXNum(x.low)}</td><td>${(x.overlap*100).toFixed(0)}%</td><td>${tpoXEsc(x.phase)}</td></tr>`).join("")}</tbody></table></div><p class="tpox-note">Chỉ hiển thị tối đa 24 bracket gần nhất để giữ giao diện gọn trên điện thoại. Range/overlap được suy ra từ ma trận TPO M1 của bracket; các nhãn phase là cách đọc hỗ trợ, không phải phân loại participant thật.</p></div></div>
    <div class="tpox-section-card"><h4>Part V · Minus Development</h4><div class="tpox-analysis-row"><b>${A.minus.direction||"—"} · ${tpoXNum(A.minus.priceGap)}</b><span>Reference ${tpoXNum(A.minus.reference)} → Emerging ${tpoXNum(A.minus.emergingPrice)}</span></div><p>${tpoXEsc(A.minus.label)}. Ngưỡng emerging activity: ${A.minus.threshold||TPOX.options.emergingTpo} TPOs across. ${tpoXEsc(A.minusTrend)} so với phiên trước. Minus development đo khoảng thiếu phát triển giữa vị trí tham chiếu và vùng hoạt động mới; nó không tự cho biết điểm thoát lệnh.</p></div>
    <div class="tpox-section-card"><h4>Key reference points · Parameters</h4><div class="tpox-param-list">${A.params.map(x=>`<div><span>${tpoXEsc(x.name)}</span><b>${tpoXNum(x.price)}</b><small>${tpoXEsc(x.status)}</small></div>`).join("")}</div></div>
    <div class="tpox-section-card"><h4>Part III · Event classification (do trader tự đánh giá)</h4><div class="tpox-event"><b>${tpoXEsc(A.event.title)}</b><p>${tpoXEsc(A.event.effect)}</p><small>CBOT mô tả surprise = near-term; unlikely = intermediate-term; likely = long-term. Đây là khung đánh giá thủ công, không phải dự đoán của chỉ báo. Phần mềm không tự suy diễn tin tức hoặc tác động fundamental chỉ từ nến.</small></div></div>`}
function tpoXSumMetric(a){let n=0;if(a)for(const x of a)n+=Math.max(0,+x||0);return n}
function tpoXBuildDataProfile(P,requested="auto"){
  if(!P?.counts||!P.n)return null;
  const quote=P.quoteMetric||[],tick=P.metric||[],quoteTotal=tpoXSumMetric(quote),tickTotal=tpoXSumMetric(tick),coverage=Math.max(0,Math.min(1,+P.quoteCoverage||0));
  let source=requested,metric=null,sourceLabel="",caveat="";
  if(requested==="auto"){
    if(quoteTotal>0&&coverage>=.75){source="quote";metric=quote;sourceLabel="Footprint quote-event profile";caveat="Quote rows có độ phủ đủ cao trong phiên."}
    else if(tickTotal>0){source="tick";metric=tick;sourceLabel="M1 tick-volume profile";caveat=quoteTotal>0?`Quote rows chỉ phủ ${(coverage*100).toFixed(1)}%; ưu tiên M1 tick-volume để tránh profile quá thưa.`:"M1 tick volume được phân bổ đều qua các hàng giá High–Low của mỗi phút."}
    else if(quoteTotal>0){source="quote";metric=quote;sourceLabel="Footprint quote-event profile";caveat=`Chỉ có quote rows với độ phủ ${(coverage*100).toFixed(1)}%; profile có thể không đại diện toàn phiên.`}
  }else if(requested==="quote"){
    if(quoteTotal>0){source="quote";metric=quote;sourceLabel="Footprint quote-event profile";caveat=`Độ phủ quote rows: ${(coverage*100).toFixed(1)}%.`}
  }else if(requested==="tick"){
    if(tickTotal>0){source="tick";metric=tick;sourceLabel="M1 tick-volume profile";caveat="Tick volume M1 được phân bổ đều qua các hàng giá High–Low của mỗi phút."}
  }
  if(!metric)return{available:false,source:requested,quoteTotal,tickTotal,coverage,label:"Không có activity metric khả dụng",caveat:"Cần M1 tick volume hoặc footprint quote rows. TPO count không được giả làm volume."};
  let total=0,poc=0,max=-1,upper=0,lower=0,buy=0,sell=0;
  const middle=(P.n-1)/2;
  for(let q=0;q<P.n;q++){
    const v=Math.max(0,+metric[q]||0);total+=v;
    if(v>max+1e-9||(Math.abs(v-max)<=1e-9&&Math.abs(q-middle)<Math.abs(poc-middle))){max=v;poc=q}
    if(q>middle)upper+=v;else lower+=v;
    buy+=Math.max(0,+(P.buyQuote?.[q]||0));sell+=Math.max(0,+(P.sellQuote?.[q]||0));
  }
  if(!(total>0))return{available:false,source,quoteTotal,tickTotal,coverage,label:"Activity metric rỗng",caveat};
  const va=tpoLdbValueArea(metric,poc,70),basePosition=(poc+.5)/P.n;
  const baseLocation=basePosition<1/3?"Nửa dưới / lower third":basePosition>2/3?"Nửa trên / upper third":"Trung tâm / middle third";
  const rows=[];
  for(let q=P.n-1;q>=0;q--){const value=Math.max(0,+metric[q]||0);if(value<=0)continue;const bq=Math.max(0,+(P.buyQuote?.[q]||0)),sq=Math.max(0,+(P.sellQuote?.[q]||0));rows.push({q,price:P.base+(q+.5)*P.step,value,pct:value/total*100,buy:bq,sell:sq,quoteTotal:bq+sq,inValue:q>=va.lo&&q<=va.hi,isPoc:q===poc})}
  return{available:true,source,sourceLabel,caveat,metric,total,poc,pocPrice:P.base+(poc+.5)*P.step,va,vah:P.base+(va.hi+1)*P.step,val:P.base+va.lo*P.step,coveredPct:total?va.covered/total*100:0,upperPct:upper/total*100,lowerPct:lower/total*100,basePosition,baseLocation,buy,sell,rows,coverage,quoteTotal,tickTotal};
}
function tpoXCompareActivity(P,current,prev,previousProfile){
  if(!P||!current?.available||!prev||!previousProfile?.available)return{label:"Chưa đủ hai phiên có activity metric để so sánh.",change:null};
  if(P.partial)return{label:"Phiên hiện tại chưa hoàn tất; không so sánh tổng hoạt động với phiên đã đóng.",change:null};
  if(current.source!==previousProfile.source)return{label:"Nguồn metric giữa hai phiên khác nhau; không so sánh trực tiếp.",change:null};
  if(current.source==="quote"&&(current.coverage<.75||previousProfile.coverage<.75||Math.abs(current.coverage-previousProfile.coverage)>.15))return{label:"Độ phủ quote không đồng đều giữa hai phiên; chưa đủ cơ sở so sánh.",change:null};
  if(current.source==="tick"&&P.totalMinutes>0&&prev.totalMinutes>0&&Math.abs(P.totalMinutes-prev.totalMinutes)/Math.max(P.totalMinutes,prev.totalMinutes)>.15)return{label:"Số phút có dữ liệu khác nhau đáng kể; chưa đủ cơ sở so sánh tổng tick volume.",change:null};
  const change=(current.total-previousProfile.total)/Math.max(previousProfile.total,1),priceDelta=P.close-prev.close,step=Math.max(P.step,prev.step);
  if(Math.abs(priceDelta)<=step*.5)return{change,label:`Giá đóng cửa gần như đi ngang; activity proxy ${change>=0?"tăng":"giảm"} ${(Math.abs(change)*100).toFixed(1)}%.`};
  const dir=priceDelta>0?"tăng":"giảm",aligned=change>0.05,weak=change<-.05;
  if(aligned)return{change,label:`Giá ${dir} và activity proxy cũng tăng ${(change*100).toFixed(1)}%; đây là dấu hiệu cường độ cùng chiều, không xác nhận continuation.`};
  if(weak)return{change,label:`Giá ${dir} nhưng activity proxy giảm ${(Math.abs(change)*100).toFixed(1)}%; có thể là dấu hiệu facilitation suy yếu, không tự xác nhận đảo chiều.`};
  return{change,label:`Giá ${dir}; activity proxy thay đổi ít (${(change*100).toFixed(1)}%).`};
}
function tpoXRenderData(){
  const el=$("tpoxData"),S=TPOX.sessions,P=S.at(-1);if(!el)return;const renderSig=[TPOX.cacheKey,TPOX.options.dataSource,S.length].join("|");if(TPOX._dataRenderSig===renderSig)return;TPOX._dataRenderSig=renderSig;
  const requested=TPOX.options.dataSource||"auto",D=P?tpoXBuildDataProfile(P,requested):null,Prev=S.length>1?S[S.length-2]:null,PD=Prev?tpoXBuildDataProfile(Prev,D?.source||requested):null,compare=D?.available?tpoXCompareActivity(P,D,Prev,PD):{label:"Chưa có dữ liệu để so sánh.",change:null};
  const quoteTotal=P?tpoXSumMetric(P.quoteMetric):0,buy=P?tpoXSumMetric(P.buyQuote):0,sell=P?tpoXSumMetric(P.sellQuote):0,coverage=P?.quoteCoverage??0;
  if(!D?.available){el.innerHTML=`<div class="tpox-section-card"><h4>Part VI · Liquidity Data Bank / CTI</h4><p><b>Chưa có activity metric để lập LDB-style profile.</b> Hãy kết nối cTrader, tải M1 và/hoặc tải Footprint quote rows. TPO count vẫn hoạt động riêng, nhưng không được thay thế volume.</p><p>${tpoXEsc(D?.caveat||"")}</p></div>`;return}
  const sourceType=D.source==="quote"?"Quote-event proxy":"M1 tick-volume proxy",rangeLabel=`${tpoXNum(D.vah)} → ${tpoXNum(D.val)}`,maxActivity=Math.max(1,...D.rows.map(x=>x.pct)),barRows=D.rows.map(r=>`<tr class="${r.isPoc?"is-poc":""}"><td>${tpoXNum(r.price)}</td><td><div class="tpox-activity-bar"><i style="width:${Math.max(1,r.pct/maxActivity*100).toFixed(1)}%"></i></div></td><td>${r.value.toLocaleString("en-US",{maximumFractionDigits:1})}</td><td>${r.pct.toFixed(2)}%</td><td>${r.inValue?"●":"—"}</td><td>${r.buy.toLocaleString("en-US")}</td><td>${r.sell.toLocaleString("en-US")}</td></tr>`).join("");
  const directionSummary=buy+sell>0?(buy>sell?"Buy-direction quote events nhiều hơn":sell>buy?"Sell-direction quote events nhiều hơn":"Hai hướng cân bằng"):"Không có phân loại quote direction trong nguồn hiện tại";
  el.innerHTML=`
    <div class="tpox-analysis-grid">
      <article class="tpox-card"><span>Activity metric source</span><b>${sourceType}</b><small>${tpoXEsc(D.sourceLabel)}</small></article>
      <article class="tpox-card"><span>Activity total</span><b>${D.total.toLocaleString("en-US",{maximumFractionDigits:1})}</b><small>Không phải futures contract volume</small></article>
      <article class="tpox-card"><span>70% range · LDB method</span><b>${rangeLabel}</b><small>${D.coveredPct.toFixed(1)}% được bao phủ sau mở rộng</small></article>
      <article class="tpox-card"><span>Activity control / POC</span><b>${tpoXNum(D.pocPrice)}</b><small>Giá có activity metric cao nhất</small></article>
      <article class="tpox-card"><span>Activity base location</span><b>${D.baseLocation}</b><small>Giá có activity metric lớn nhất</small></article>
      <article class="tpox-card"><span>Upper / lower half</span><b>${D.upperPct.toFixed(1)}% / ${D.lowerPct.toFixed(1)}%</b><small>Activity phân bổ theo nửa trên / dưới range</small></article>
      <article class="tpox-card"><span>Buy / sell direction proxy</span><b>${buy.toLocaleString("en-US")} / ${sell.toLocaleString("en-US")}</b><small>${tpoXEsc(directionSummary)}</small></article>
      <article class="tpox-card"><span>Quote coverage</span><b>${(coverage*100).toFixed(1)}%</b><small>${P?.tickMinutes||0} / ${P?.totalMinutes||0} phút có footprint rows</small></article>
    </div>
    <div class="tpox-section-card"><h4>Part VI · Activity by price (LDB-style proxy)</h4>
      <div class="tpox-analysis-row"><b>POC ${tpoXNum(D.pocPrice)} · 70% Range ${rangeLabel}</b><span>${tpoXEsc(D.sourceLabel)}</span></div>
      <p>${tpoXEsc(D.caveat)} Phương pháp range theo tài liệu CBOT: bắt đầu từ giá có metric cao nhất, so sánh tổng hai hàng tiếp theo phía trên và hai hàng phía dưới, mở rộng theo phía lớn hơn đến khi đạt 70% tổng. Đây là áp dụng phương pháp lên proxy, không phải LDB CBOT thật.</p>
      <div id="tpoxLdbRows" class="tpox-table-wrap tpox-ldb-table"><table class="tpox-table"><thead><tr><th>Price</th><th>Relative activity</th><th>Metric</th><th>% total</th><th>70% range</th><th>Buy-dir*</th><th>Sell-dir*</th></tr></thead><tbody>${barRows}</tbody></table></div>
      <p class="tpox-note">* Buy-dir / Sell-dir là phân loại hướng thay đổi quote theo thuật toán footprint của dự án (giá Ask/Bid được dùng làm mức đặt proxy). Không phải aggressor trade volume, không phải số người mua/bán hay CTI. M1 tick volume nếu dùng sẽ được phân bổ đều qua các mức giá chạm trong OHLC của từng phút.</p>
    </div>
    <div class="tpox-section-card"><h4>Trade facilitation · so sánh activity với price</h4><div class="tpox-analysis-row"><b>${compare.change==null?"Chưa có kết luận so sánh":`${compare.change>=0?"Activity tăng":"Activity giảm"} ${(Math.abs(compare.change)*100).toFixed(1)}%`}</b><span>${tpoXEsc(compare.label)}</span></div><p>CBOT nhấn mạnh volume phải được đặt trong bối cảnh hành vi và hướng giá. Ở đây chỉ có tick/quote activity proxy, vì vậy phần mềm chỉ mô tả sự đồng biến/nghịch biến tương đối; không khẳng định continuation, reversal hay bên tham gia nào đang kiểm soát.</p></div>
    <div class="tpox-section-card"><h4>Part VI · Liquidity Data Bank / CTI</h4><p><b>Chưa thể tái tạo trung thực từ nguồn hiện tại.</b> LDB của CBOT ghi volume hợp đồng thực theo từng mức giá và CTI1–CTI4 (nhóm participant). cTrader Forex/CFD trong dự án chỉ cung cấp chuỗi Bid/Ask, không có tape giao dịch futures tập trung hay participant classification.</p><p>Đã áp dụng phần có thể dùng được: phân bố activity theo giá, percent-of-total proxy, POC, cách mở rộng 70% range, vị trí activity base và đối chiếu với hướng giá. CTI1–CTI4, spread-volume CBOT và contract volume thật vẫn cần provider phù hợp.</p></div>
    <div class="tpox-section-card"><h4>Đối chiếu phạm vi Study Guide CBOT · sáu phần</h4><div class="tpox-coverage-list"><div><b>Part I · Reading the Market Profile Graphic</b><span>Đã có TPO, Value Area, Fair Price, IB, Range Extension, Single Prints và day types. M1 OHLC là giá chạm ước lượng khi thiếu tick.</span></div><div><b>Part II · Long-Term Auction Chart</b><span>Đã có Value migration, opening relation, six-area activity, Long-Term Auction và thuật toán 70% range trên proxy.</span></div><div><b>Part III · The Perception of Value</b><span>Đã có price/value relationship và lựa chọn thủ công Surprise / Unlikely / Likely event; phần mềm không tự phán đoán tin cơ bản.</span></div><div><b>Part IV · Distribution Process</b><span>Đã có Composite, 3-1-3, 1-2-3, 3-2-1, natural units và four-step sequence theo bracket/session proxy.</span></div><div><b>Part V · Using Market Profile Tools</b><span>Đã có key reference points, near/intermediate/long-term controls và Minus Development; không phải tín hiệu vào/thoát lệnh tự động.</span></div><div class="is-limited"><b>Part VI · Liquidity Data Bank</b><span>Đã có LDB-style activity profile theo proxy; contract volume futures và CTI1–CTI4 vẫn cần nguồn dữ liệu riêng.</span></div></div><p class="tpox-note">“Đã có” nghĩa là đã triển khai khung phân tích theo tài liệu bằng nguồn dữ liệu dự án hiện tại, không đồng nghĩa với tái tạo bộ dữ liệu CBOT gốc hoặc mọi ví dụ lịch sử trong sách.</p></div>`;
}
function tpoXRender(){if(typeof document==="undefined"||document.body?.dataset?.v!=="tpo")return;tpoXRefreshAnalytics();const load=$("tpoxLoadStatus");if(load)load.textContent=TPOX.loading?TPOX.progress:(TPOX.error||`${TPOX.sessions.length} phiên đã dựng · ${TPOX.loaded?"lịch sử đã tải":"chưa tải lịch sử"}`);const action=$("tpoxLoadBtn");if(action){action.disabled=TPOX.loading;action.textContent=TPOX.loading?"Đang tải…":(TPOX.loaded?"Tải lại lịch sử":"Tải lịch sử")};if(TPOX.tab==="composite")tpoXRenderComposite();else if(TPOX.tab==="auction"){tpoXRenderAuction();tpoXRenderActivity()}else if(TPOX.tab==="analysis")tpoXRenderAnalysis();else if(TPOX.tab==="data")tpoXRenderData()}
function tpoXBuildDOM(){const root=$("v-tpo");if(!root||$("tpoxTabs"))return;const head=root.querySelector(".tpo-page-head"),summary=$("tpoSummary"),profile=root.querySelector(".tpo-profile-card"),settings=$("tpoSettings");if(!head||!summary||!profile)return;
  const tabs=document.createElement("div");tabs.id="tpoxTabs";tabs.className="tpox-tabs";tabs.innerHTML=`<button type="button" data-tpox-tab="single" class="on">Phiên đơn</button><button type="button" data-tpox-tab="composite">Composite</button><button type="button" data-tpox-tab="auction">Long-term Auction</button><button type="button" data-tpox-tab="analysis">Auction Analysis</button><button type="button" data-tpox-tab="data">Data / LDB</button>`;head.after(tabs);
  const panes=document.createElement("div");panes.id="tpoxPanes";panes.innerHTML=`<div data-tpox-pane="single" class="tpox-pane"></div><section data-tpox-pane="composite" class="tpox-pane" hidden><div class="card tpox-work-card"><div class="tpox-panel-head"><div><span class="tpox-kicker">PART IV · THE PARTS AND THE WHOLE</span><h3>Composite Profile</h3><p class="msg">Cộng dồn phân phối TPO qua nhiều phiên để xem các vùng cân bằng và vùng từ chối.</p></div></div><div id="tpoxCompositeInfo" class="tpox-composite-stats"></div><div class="tpox-canvas-wrap"><canvas id="tpoxCompositeCanvas"></canvas></div><div id="tpoxUnits" class="tpox-units-list"></div><p class="tpox-note">Composite hiện dùng TPO-count. 3-1-3 / 1-2-3 / 3-2-1 là mô tả cấu trúc phân phối theo tài liệu, nhưng không được xem là volume futures thật.</p></div></section><section data-tpox-pane="auction" class="tpox-pane" hidden><div class="card tpox-work-card"><div class="tpox-panel-head"><div><span class="tpox-kicker">PART II · THE LONG-TERM AUCTION CHART</span><h3>Value migration across sessions</h3><p class="msg">Trục dọc là giá; mỗi cột là một phiên, hiển thị range, Value Area và control price/POC.</p></div></div><div id="tpoxAuctionScroll" class="tpox-canvas-wrap tpox-auction-scroll"><canvas id="tpoxAuctionCanvas"></canvas></div><div id="tpoxAuctionTable"></div><div class="tpox-subhead">Long-term activity · six-area view</div><div id="tpoxActivityTable"></div></div></section><section data-tpox-pane="analysis" class="tpox-pane" hidden><div class="card tpox-work-card"><div class="tpox-panel-head"><div><span class="tpox-kicker">PARTS III–V · VALUE / DISTRIBUTION / DECISIONS</span><h3>Auction Analysis</h3><p class="msg">Kết hợp near-term activity với intermediate-term và long-term reference points.</p></div></div><div id="tpoxAnalysis"></div></div></section><section data-tpox-pane="data" class="tpox-pane" hidden><div class="card tpox-work-card"><div class="tpox-panel-head"><div><span class="tpox-kicker">PART VI · LIQUIDITY DATA BANK</span><h3>Data quality & availability</h3><p class="msg">Tách dữ liệu có thật khỏi những phép proxy trên feed CFD/Forex.</p></div></div><div id="tpoxData"></div></div></section>`;
  root.appendChild(panes);const singlePane=$("tpoxPanes").querySelector('[data-tpox-pane="single"]');singlePane.append(summary,profile);if(settings)singlePane.append(settings);const headActions=root.querySelector(".tpo-page-actions");if(headActions){const b=document.createElement("button");b.type="button";b.className="btn sm";b.id="tpoxLoadBtn";b.dataset.tpoxAction="load";b.textContent="Tải lịch sử";headActions.insertBefore(b,headActions.querySelector("[data-tpo-action=refresh]")||null);const s=document.createElement("span");s.id="tpoxLoadStatus";s.className="tpox-load-status";headActions.append(s)}
  root.addEventListener("click",e=>{const tab=e.target.closest("[data-tpox-tab]");if(tab){tpoXSetTab(tab.dataset.tpoxTab);return}const a=e.target.closest("[data-tpox-action]");if(!a)return;if(a.dataset.tpoxAction==="load")tpoXLoadHistory(true);else if(a.dataset.tpoxAction==="refresh"){tpoXCacheBust();tpoXRender()}});
  root.addEventListener("change",e=>{const k=e.target?.dataset?.tpox;if(!k)return;tpoXSetSetting(k,e.target.type==="checkbox"?e.target.checked:e.target.value)});
  tpoBuildSettings();tpoXRender();
}
const tpoSaveBase=tpoSave;
tpoSave=function(){tpoSaveBase();tpoXCacheBust();tpoXRender()};
const tpoBuildSettingsBase=tpoBuildSettings;
tpoBuildSettings=function(){tpoBuildSettingsBase();const el=$("tpoSettings");if(el&&!el.querySelector(".tpox-settings"))el.insertAdjacentHTML("beforeend",tpoXSettingsMarkup())};
const tpoActivateBase=tpoActivate;
tpoActivate=function(on){tpoActivateBase(on);if(on&&document.body?.dataset?.v==="tpo"){if(!TPOX.autoRequested){TPOX.autoRequested=true;tpoXLoadHistory(false)}tpoXRender()}};
(function(){tpoXBuildDOM();if(typeof window!=="undefined"){window.addEventListener("resize",()=>{if(document.body?.dataset?.v==="tpo")tpoXRender()});window.setInterval(()=>{if(document.body?.dataset?.v==="tpo"){const last=m1?.[m1.length-1];if(last&&TPOX.loaded&&last[0]!==TPOX._lastTail){TPOX.historyBars=tpoXMergeBars(TPOX.historyBars,[last]);TPOX._lastTail=last[0];tpoXCacheBust()}tpoXRender()}},5000)}})();
