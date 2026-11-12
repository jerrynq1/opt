/* ================= ETF OPTIONS LIQUIDITY MAP INDICATOR =================
   QQQ -> NAS100 and GLD -> XAUUSD. Every source level is mapped independently
   and persisted. Live ETF/CFD ticks never move an existing level; only a change
   to that source level causes its individual CFD mapping to be recalculated.
   All user-facing controls live in IND.xmap (the native indicator catalogue).

   Important: OI/GEX/Max Pain/GEX ranks are ETF-option-derived proxies. They are
   not native futures/CFD order-book data or verified dealer positioning.
*/
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const TARGET={qqq:'NAS100',gld:'XAUUSD'};
  const SOURCE_NAME={qqq:'QQQ',gld:'GLD'};
  const DEFAULTS={source:'qqq',metric:'gex',heat:true,opacity:.48,bubbles:true,bubbleCount:36,walls:true,gexWalls:true,gammaFlip:true,maxPain:true,gexCount:10,showSourceTag:true};
  const XMAP=window.XMAP=window.XMAP||{};
  Object.assign(XMAP,{enabled:false,source:'qqq',settings:{...DEFAULTS},version:0,snapshot:null,locked:null,error:'',started:false,indicatorId:null});

  const num=x=>(x===null||x===undefined||x==='')?null:(Number.isFinite(+x)?+x:null);
  const compact=x=>{const v=+x;if(!Number.isFinite(v))return'—';const a=Math.abs(v);return a>=1e6?(v/1e6).toFixed(1)+'m':a>=1e3?(v/1e3).toFixed(1)+'k':String(Math.round(v));};
  const fmt=(x,d=2)=>Number.isFinite(+x)?(+x).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
  const timestampMs=x=>{const t=num(x);return t===null?null:(t<1e12?t*1000:t)};
  const ageLabel=ms=>ms===null?'—':ms<60000?Math.max(0,Math.round(ms/1000))+'s':ms<3600000?Math.round(ms/60000)+'m':Math.round(ms/3600000)+'h';
  const pair=()=>TARGET[XMAP.source]||'NAS100';
  const currentMatchesTarget=()=>String(C?.sym||'').toUpperCase()===pair();
  const sourceSpot=()=>num(XMAP.snapshot?.price);
  function targetSpot(){
    try{
      if(typeof CT!=='undefined'&&CT.sym&&CT.sym.req!==C.sym)return null;
      if(typeof CT!=='undefined'&&CT.bid>0&&CT.sym&&CT.sym.req===C.sym)return CT.bid/1e5;
    }catch{}
    try{const b=agg&&agg[agg.length-1];if(b&&Number.isFinite(+b.close))return +b.close}catch{}
    return null;
  }
  function mapStrike(sourceStrike,sourcePrice,targetPrice){
    const strike=num(sourceStrike),source=num(sourcePrice),target=num(targetPrice);
    if(!(strike>0&&source>0&&target>0))return null;
    return target*(strike/source);
  }
  function rankGexLevels(dist,count=10,excludedStrikes=[]){
    const excluded=new Set((Array.isArray(excludedStrikes)?excludedStrikes:[]).map(v=>num(v)).filter(v=>v!==null).map(v=>v.toFixed(6)));
    return (Array.isArray(dist)?dist:[]).filter(x=>Number.isFinite(+x.gex)&&Math.abs(+x.gex)>0&&!excluded.has((num(x.strike)??NaN).toFixed(6)))
      .slice().sort((a,b)=>Math.abs(+b.gex)-Math.abs(+a.gex)).slice(0,Math.max(0,Math.min(10,+count||0)));
  }
  function sameLevel(a,b){
    const x=num(a),y=num(b);
    return x!==null&&y!==null&&Math.abs(x-y)<1e-4;
  }
  function mapLevel(sourceLevel,previous,sourcePrice,targetPrice,mappedAt,extra={}){
    const source=num(sourceLevel);
    if(!(source>0))return null;
    const prevSource=num(previous?.sourceLevel??previous?.strike);
    const unchanged=previous&&sameLevel(prevSource,source)&&num(previous.target)>0;
    const ratio=unchanged?num(previous.ratio):(num(sourcePrice)>0&&num(targetPrice)>0?num(targetPrice)/num(sourcePrice):null);
    const target=unchanged?num(previous.target):ratio!==null?mapStrike(source,sourcePrice,targetPrice):null;
    return Object.freeze({...extra,sourceLevel:source,target,ratio:target!==null?ratio:null,
      mappedAt:target===null?(previous?.mappedAt||null):(unchanged?previous.mappedAt:mappedAt),
      changed:!unchanged&&target!==null});
  }
  // Each source level owns its own CFD mapping. Live ETF/CFD ticks do not move it;
  // a mapping is recalculated only when that particular source level changes.
  function buildMappedMap(snapshot,sourcePrice,targetPrice,previousMap=null,mappedAt=Date.now()){
    if(!snapshot||snapshot.complete!==true||!Array.isArray(snapshot.dist)||!snapshot.dist.length)return null;
    const sessionMatches=previousMap&&previousMap.source===(snapshot.key||snapshot.symbol||'')&&
      previousMap.target===(TARGET[snapshot.key]||pair())&&previousMap.expiry===(snapshot.expiry||'');
    const prev=sessionMatches?previousMap:null;
    let changedCount=0,lastRatio=prev?.lastRatio??null;
    const track=(entry,label)=>{
      if(entry?.changed){changedCount++;lastRatio=entry.ratio;}
      return entry;
    };
    const oldDist=new Map((prev?.dist||[]).map(r=>[String(r.strike),r]));
    const mappedDist=snapshot.dist.map(r=>track(mapLevel(r.strike,oldDist.get(String(r.strike)),sourcePrice,targetPrice,mappedAt,{...r,strike:r.strike}),`STRIKE ${r.strike}`));
    const dist=mappedDist.filter(r=>r&&Number.isFinite(r.target));
    // OI walls and Gamma Exposure walls are separate level families.
    // Legacy callWall/putWall aliases are accepted as OI walls only.
    const callOIWall=track((snapshot.callOIWall||snapshot.callWall)?mapLevel((snapshot.callOIWall||snapshot.callWall).strike,prev?.callOIWall||prev?.callWall,sourcePrice,targetPrice,mappedAt,{...(snapshot.callOIWall||snapshot.callWall),strike:(snapshot.callOIWall||snapshot.callWall).strike}):null,'CALL OI WALL');
    const putOIWall=track((snapshot.putOIWall||snapshot.putWall)?mapLevel((snapshot.putOIWall||snapshot.putWall).strike,prev?.putOIWall||prev?.putWall,sourcePrice,targetPrice,mappedAt,{...(snapshot.putOIWall||snapshot.putWall),strike:(snapshot.putOIWall||snapshot.putWall).strike}):null,'PUT OI WALL');
    const gexCallWall=track(snapshot.gexComplete!==false&&snapshot.gexCallWall?mapLevel(snapshot.gexCallWall.strike,prev?.gexCallWall,sourcePrice,targetPrice,mappedAt,{...snapshot.gexCallWall,strike:snapshot.gexCallWall.strike}):null,'CW GEX');
    const gexPutWall=track(snapshot.gexComplete!==false&&snapshot.gexPutWall?mapLevel(snapshot.gexPutWall.strike,prev?.gexPutWall,sourcePrice,targetPrice,mappedAt,{...snapshot.gexPutWall,strike:snapshot.gexPutWall.strike}):null,'PW GEX');
    const gammaFlipSource=snapshot.gammaFlip;
    const gammaFlip=track(gammaFlipSource==null?null:mapLevel(gammaFlipSource,prev?.gammaFlip,sourcePrice,targetPrice,mappedAt,{sourceValue:gammaFlipSource,method:snapshot.gammaFlipMethod||'BSM repricing · Net GEX zero-cross'}),'GAMMA FLIP / ZERO GAMMA');
    const maxPain=track(snapshot.maxPain?mapLevel(snapshot.maxPain.strike,prev?.maxPain,sourcePrice,targetPrice,mappedAt,{...snapshot.maxPain,strike:snapshot.maxPain.strike}):null,'MAX PAIN');
    const oldGex=new Map((prev?.gexLevels||[]).map((g,i)=>[Number(g.rank)||i+1,g]));
    // GEX 1–10 excludes only the two Net-GEX Gamma Walls (CW/PW), never OI walls.
    const gammaWallStrikes=[snapshot.gexCallWall?.strike,snapshot.gexPutWall?.strike];
    const eligibleGex=snapshot.gexComplete!==false?(snapshot.gexLevels||[]).filter(g=>!gammaWallStrikes.some(w=>sameLevel(w,g.strike))):[];
    const gexLevels=eligibleGex.slice(0,10).map((g,i)=>{const rank=i+1;return track(mapLevel(g.strike,oldGex.get(rank),sourcePrice,targetPrice,mappedAt,{...g,rank,strike:g.strike}),`GEX ${rank}`)}).filter(Boolean);
    const changed=changedCount>0;
    const mappedCount=dist.length+[callOIWall,putOIWall,gexCallWall,gexPutWall,gammaFlip,maxPain].filter(x=>x?.target!==null&&x?.target!==undefined).length+gexLevels.filter(x=>x.target!==null).length;
    const pendingCount=mappedDist.filter(x=>x&&!Number.isFinite(x.target)).length+[callOIWall,putOIWall,gexCallWall,gexPutWall,gammaFlip,maxPain].filter(x=>x&&x.target==null).length+gexLevels.filter(x=>x.target==null).length;
    const mappingSignature=JSON.stringify({dist:dist.map(r=>[r.strike,r.sourceLevel,r.target]),callOIWall:callOIWall&&[callOIWall.sourceLevel,callOIWall.target],putOIWall:putOIWall&&[putOIWall.sourceLevel,putOIWall.target],gexCallWall:gexCallWall&&[gexCallWall.sourceLevel,gexCallWall.target],gexPutWall:gexPutWall&&[gexPutWall.sourceLevel,gexPutWall.target],gammaFlip:gammaFlip&&[gammaFlip.sourceLevel,gammaFlip.target],maxPain:maxPain&&[maxPain.sourceLevel,maxPain.target],gex:gexLevels.map(g=>[g.rank,g.sourceLevel,g.target])});
    const target=num(targetPrice),source=num(sourcePrice);
    return Object.freeze({source:snapshot.key||snapshot.symbol||'',symbol:snapshot.symbol||'',target:TARGET[snapshot.key]||pair(),expiry:snapshot.expiry||'',mappingSignature,
      // These spot anchors describe the most recent level-change mapping only; they are not live inputs to existing levels.
      sourcePrice:changed?source:(prev?.sourcePrice??source),targetPrice:changed?target:(prev?.targetPrice??target),
      ratio:lastRatio, lastRatio, lastLevelChangeAt:changed?mappedAt:(prev?.lastLevelChangeAt??mappedAt),
      changedCount:(prev?.changedCount||0)+changedCount,mappedCount,pendingCount,complete:!!snapshot.complete,gexComplete:!!snapshot.gexComplete,coverage:num(snapshot.coverage),gexCoverage:num(snapshot.gexCoverage),updatedAt:snapshot.updatedAt||null,
      dist:Object.freeze(dist),callOIWall,putOIWall,gexCallWall,gexPutWall,gammaFlip,maxPain,gexRatio:num(snapshot.gexRatio),gexRatioState:snapshot.gexRatioState||null,gexRatioBias:snapshot.gexRatioBias||null,callGexTotal:num(snapshot.callGexTotal),putGexAbsTotal:num(snapshot.putGexAbsTotal),gexLevels:Object.freeze(gexLevels)});
  }
  function buildLockedMap(snapshot,sourcePrice,targetPrice,lockedAt=Date.now()){
    return buildMappedMap(snapshot,sourcePrice,targetPrice,null,lockedAt);
  }
  window.crossAssetMapMath=Object.freeze({mapStrike,rankGexLevels,buildLockedMap,buildMappedMap,sameLevel});
  function activeIndicator(){
    try{return typeof ACT!=='undefined'?ACT.find(a=>a&&a.key==='xmap')||null:null}catch{return null;}
  }
  function activeOnChart(a){
    if(!a||!a.on)return false;
    try{return !a.vis||a.vis.includes(C.tf)}catch{return true;}
  }
  function indicatorSettings(a){
    const p={...DEFAULTS,...(a?.p||{})};
    if(a?.p&&Object.prototype.hasOwnProperty.call(a.p,'flip')&&!Object.prototype.hasOwnProperty.call(a.p,'gammaFlip'))p.gammaFlip=!!a.p.flip;
    p.source=p.source==='gld'?'gld':'qqq';
    p.metric=['oi','vol'].includes(p.metric)?p.metric:'gex';
    p.opacity=Math.max(.1,Math.min(.9,Number.isFinite(+p.opacity)?+p.opacity:.48));
    p.bubbleCount=Math.max(5,Math.min(100,Math.round(+p.bubbleCount||36)));
    p.gexCount=Math.max(0,Math.min(10,Math.round(+p.gexCount||0)));
    return p;
  }
  function setState(text,kind=''){
    const el=$('xmapState');if(!el)return;
    el.textContent=text;el.className='xmap-state'+(kind?' '+kind:'');
  }
  function updateTargetButton(){
    const b=$('xmapTarget');if(!b)return;
    const t=pair();b.textContent=currentMatchesTarget()?'Chart '+t+' đang mở':'Mở chart '+t;
    b.disabled=currentMatchesTarget();
  }
  function updateMeta(){
    const el=$('xmapMeta');if(!el)return;
    updateTargetButton();
    if(!XMAP.enabled){el.textContent='Thêm “ETF Options Liquidity Map” trong Kho Indicator → Orderflow, sau đó bật bằng nút mắt. Dùng bánh răng để chọn QQQ/GLD và các lớp hiển thị.';setState('Indicator inactive');return;}
    if(!currentMatchesTarget()){
      el.textContent=`Đang chọn ${SOURCE_NAME[XMAP.source]} → ${pair()}. Chart hiện tại là ${C.sym}; mở chart ${pair()} để đặt các level lên đúng trục giá.`;
      setState('Chờ chart đích','warn');return;
    }
    const s=XMAP.snapshot,m=XMAP.locked;
    syncExpiryControl(s);
    if(s?.error){el.textContent=`Binance ${SOURCE_NAME[XMAP.source]}: ${s.error}`;setState('Lỗi nguồn dữ liệu','warn');return;}
    if(!s||!sourceSpot()){el.textContent=`Đang chờ giá underlying ${SOURCE_NAME[XMAP.source]} và Option Chain từ Binance…`;setState('Đang tải','loading');return;}
    if(!m){
      if(!s.complete){el.textContent=`Đang nhận full Option Chain ${SOURCE_NAME[XMAP.source]} (${s.oiKnown||0}/${s.totalContracts||0} OI). Các level sẽ được ánh xạ khi source sẵn sàng.`;setState('Chờ full chain','loading');return;}
      el.textContent=`Đã có levels từ ${SOURCE_NAME[XMAP.source]}, đang chờ giá chart ${pair()} để quy đổi.`;setState('Chờ giá CFD','warn');return;
    }
    const coverage=Number.isFinite(m.coverage)?(m.coverage*100).toFixed(1)+'%':'—';
    const gexCoverage=Number.isFinite(s.gexCoverage)?(s.gexCoverage*100).toFixed(1)+'%':'—';
    const updated=m.updatedAt?new Date(m.updatedAt).toLocaleTimeString('vi-VN'):'—';
    const changedAt=m.lastLevelChangeAt?new Date(m.lastLevelChangeAt).toLocaleTimeString('vi-VN'):'—';
    const flip=m.gammaFlip?.target==null?'Gamma Flip / Zero Gamma: unavailable':`Gamma Flip / Zero Gamma ${fmt(m.gammaFlip.target,2)} CFD`;
    const ratio=m.gexRatioState==='call-only'?'GEX Ratio ∞ · chỉ có Call GEX':m.gexRatio==null?'GEX Ratio: —':`GEX Ratio ${m.gexRatio.toFixed(2)}x · ${m.gexRatioBias==='call-dominant'?'Call Gamma trội':m.gexRatioBias==='put-dominant'?'Put Gamma trội':'cân bằng'}`;
    el.textContent=`THEO DÕI LEVEL TỰ ĐỘNG · ${SOURCE_NAME[XMAP.source]} → ${pair()} · ${m.expiry||'—'} · ${m.mappedCount||0} mức đang theo dõi · OI ${coverage} · GEX ${gexCoverage} · ${flip} · ${ratio} · level gần nhất thay đổi lúc ${changedAt} · feed ${updated}. Giá ETF/CFD tick không làm level dịch chuyển; chỉ khi giá trị level nguồn đổi thì riêng level đó được quy đổi lại.`;
    setState(s.complete&&s.gexComplete?'Auto-level mapping':s.complete?'OI ready · GEX coverage incomplete':'Giữ level cũ · chờ full chain',s.complete&&s.gexComplete?'ok':'warn');
  }
  function syncExpiryControl(snapshot){
    const select=$('xmapExpiry');if(!select)return;
    const expirations=Array.isArray(snapshot?.expirations)?snapshot.expirations:[];
    const key=expirations.map(x=>x.date).join(',');
    if(select.dataset.expiries!==key){
      select.dataset.expiries=key;
      select.innerHTML=expirations.length?expirations.map(x=>`<option value="${String(x.date).replace(/[^0-9-]/g,'')}">${String(x.date).replace(/[^0-9-]/g,'')} · ${String(x.root||'')}</option>`).join(''):'<option value="">Đang tải kỳ hạn…</option>';
    }
    if(snapshot?.expiry&&select.value!==snapshot.expiry)select.value=snapshot.expiry;
    select.disabled=!XMAP.enabled||!expirations.length;
  }
  function sameSessionMap(map,snapshot){
    return !!map&&map.source===(snapshot.key||snapshot.symbol||'')&&
      map.target===(TARGET[snapshot.key]||pair())&&map.expiry===(snapshot.expiry||'');
  }
  function mapStorageKey(snapshot){
    return `tp_xmap_levels_v7:${snapshot.key||snapshot.symbol||''}:${TARGET[snapshot.key]||pair()}:${snapshot.expiry||'none'}`;
  }
  function restoreMappedLevels(snapshot){
    try{
      const raw=localStorage.getItem(mapStorageKey(snapshot));if(!raw)return null;
      const saved=JSON.parse(raw);
      if(!sameSessionMap(saved,snapshot)||!Array.isArray(saved.dist)||!Array.isArray(saved.gexLevels))return null;
      return saved;
    }catch{return null;}
  }
  function persistMappedLevels(snapshot,map){
    try{localStorage.setItem(mapStorageKey(snapshot),JSON.stringify(map));}catch(e){console.warn('ETF level map persistence unavailable',e)}
  }
  function reconcileLevels(){
    if(!XMAP.enabled||!XMAP.snapshot||!currentMatchesTarget())return false;
    const s=XMAP.snapshot,sp=sourceSpot(),tp=targetSpot();
    let previous=sameSessionMap(XMAP.locked,s)?XMAP.locked:restoreMappedLevels(s);
    // Do not leave levels from a previously selected expiry on the chart while a new one loads.
    XMAP.locked=previous;
    if(!s.complete||!Array.isArray(s.dist)||!s.dist.length)return !!previous;
    const next=buildMappedMap(s,sp,tp,previous,Date.now());
    if(!next)return !!previous;
    XMAP.locked=next;
    if(!previous||next.mappingSignature!==previous.mappingSignature)persistMappedLevels(s,next);
    try{if(typeof dirty!=='undefined')dirty=true}catch{}
    return true;
  }
  function refreshSnapshot(){
    if(!XMAP.enabled)return;
    try{XMAP.snapshot=window.stockOptionsCrossAssetSnapshot?.(XMAP.source)||null;XMAP.error=''}catch(e){XMAP.error=e?.message||String(e)}
    reconcileLevels();
    XMAP.version++;
    updateMeta();
    try{if(typeof dirty!=='undefined')dirty=true}catch{}
  }
  window.crossAssetMapDataUpdated=(key)=>{if(XMAP.enabled&&key===XMAP.source)refreshSnapshot()};
  window.crossAssetMapRenderKey=()=>XMAP.version+'|'+(XMAP.enabled?1:0)+'|'+C.sym;

  function start(){
    XMAP.enabled=true;XMAP.started=true;XMAP.error='';XMAP.locked=null;
    try{window.stockOptionsCrossAssetStart?.(XMAP.source)}catch(e){XMAP.error=e?.message||String(e)}
    refreshSnapshot();updateMeta();
  }
  function stop(){
    const wasOn=XMAP.enabled;
    XMAP.enabled=false;XMAP.started=false;XMAP.snapshot=null;XMAP.locked=null;XMAP.version++;
    if(wasOn){try{window.stockOptionsCrossAssetStop?.()}catch{}}
    updateMeta();
    try{if(typeof dirty!=='undefined')dirty=true}catch{}
  }
  let settingsSignature='';
  function syncIndicator(){
    const a=activeIndicator(),on=activeOnChart(a);
    if(!on){if(XMAP.enabled)stop();XMAP.indicatorId=null;settingsSignature='';return;}
    const next=indicatorSettings(a),signature=JSON.stringify({settings:next,colors:a.c||[]}),sourceChanged=XMAP.enabled&&next.source!==XMAP.source;
    const settingsChanged=signature!==settingsSignature;
    XMAP.settings=next;XMAP.indicatorId=a.id;
    if(!XMAP.enabled||sourceChanged){if(XMAP.enabled)stop();XMAP.source=next.source;settingsSignature=signature;start();}
    else{
      XMAP.source=next.source;
      if(settingsChanged){settingsSignature=signature;XMAP.version++;try{if(typeof dirty!=='undefined')dirty=true}catch{};updateMeta()}
    }
  }
  window.crossAssetMapIndicatorSync=syncIndicator;
  function switchTarget(){
    const target=pair();
    if(C.sym!==target){C.sym=target;sv('tp_sym',target);$('sym').value=target;$('bid').textContent=$('ask').textContent='–';
      try{loadM1()}catch(e){XMAP.error=e?.message||String(e);updateMeta()}}
    else updateMeta();
  }
  function bind(){
    const toggle=$('xmapToggle'),panel=$('xmapPanel');
    toggle?.addEventListener('click',()=>{const open=panel.hidden;panel.hidden=!open;toggle.setAttribute('aria-expanded',String(open));if(open)updateMeta()});
    $('xmapExpiry')?.addEventListener('change',e=>{
      const expiry=e.target.value;if(!expiry||!XMAP.enabled)return;
      Promise.resolve(window.stockOptionsCrossAssetSetExpiry?.(XMAP.source,expiry)).then(()=>refreshSnapshot()).catch(err=>{XMAP.error=err?.message||String(err);updateMeta()});
    });
    $('xmapTarget')?.addEventListener('click',switchTarget);
    $('xmapAddIndicator')?.addEventListener('click',()=>{
      panel.hidden=true;toggle?.setAttribute('aria-expanded','false');
      document.querySelector('[data-go="ind"]')?.click();
    });
    updateMeta();
  }

  function drawLine(y,color,label,price,w,h,width=1.35,dash=[7,4]){
    if(!Number.isFinite(y)||y<-30||y>h+30)return;
    ctx.save();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.beginPath();ctx.moveTo(0,Math.round(y)+.5);ctx.lineTo(w,Math.round(y)+.5);ctx.stroke();ctx.setLineDash([]);
    const text=`${label}  ${fmt(price,2)}`;ctx.font='600 10px "Space Grotesk",sans-serif';const tw=ctx.measureText(text).width+12,x=Math.max(4,w-tw-8);
    ctx.fillStyle='rgba(5,12,20,.82)';ctx.fillRect(x,y-9,tw,18);ctx.fillStyle=color;ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillText(text,x+6,y);
    ctx.restore();
  }
  let lastMetaSymbol='';
  function drawCrossAssetMap(w,h){
    if(XMAP.enabled&&(!XMAP.locked||(XMAP.locked.pendingCount>0&&sourceSpot()>0&&targetSpot()>0)))reconcileLevels();
    if(lastMetaSymbol!==C.sym){lastMetaSymbol=C.sym;updateMeta()}
    const a=activeIndicator();if(!XMAP.enabled||!activeOnChart(a)||!XMAP.snapshot||!currentMatchesTarget())return;
    const locked=XMAP.locked;if(!locked||locked.target!==pair())return;
    const s=locked,P=XMAP.settings,ratio=locked.lastRatio||1,opacity=P.opacity;
    if(!Array.isArray(s.dist)||!s.dist.length)return;
    const rows=s.dist.map(r=>({...r})).filter(r=>Number.isFinite(r.target));
    if(!rows.length)return;
    const col=(i,fb)=>{const c=a?.c?.[i];return typeof c==='string'&&c?c:fb};
    let metricValue=r=>P.metric==='oi'?(r.callOI||0)+(r.putOI||0):P.metric==='vol'?(r.callVol||0)+(r.putVol||0):Math.abs(r.gex||0);
    const maxMetric=Math.max(0,...rows.map(metricValue));
    if(P.heat&&maxMetric>0){
      const candidates=rows.filter(r=>{const y=cs.priceToCoordinate(r.target);return Number.isFinite(y)&&y>=-30&&y<=h+30;})
        .sort((a,b)=>metricValue(b)-metricValue(a)).slice(0,64);
      const gaps=rows.slice(1).map((r,i)=>Math.abs(r.target-rows[i].target)).filter(v=>v>0).sort((a,b)=>a-b);
      const step=gaps.length?gaps[Math.floor(gaps.length/2)]:ratio;
      const ya=cs.priceToCoordinate(locked.targetPrice),yb=cs.priceToCoordinate(locked.targetPrice+step),rowH=Math.max(6,Math.min(24,Math.abs((ya??0)-(yb??0))||10));
      ctx.save();const x0=w*.48,xw=w*.50;
      for(const r of candidates){
        const val=metricValue(r);if(!(val>0))continue;
        const y=cs.priceToCoordinate(r.target);if(y==null)continue;
        const intensity=Math.min(1,Math.pow(val/maxMetric,.62));let color='64,174,221';
        if(P.metric==='gex')color=(r.gex||0)>=0?'53,210,157':'235,83,123';
        else if(P.metric==='oi'){const total=(r.callOI||0)+(r.putOI||0),p=total?(r.callOI||0)/total:.5;color=p>=.62?'53,185,154':p<=.38?'218,83,129':'88,153,213';}
        else{const total=(r.callVol||0)+(r.putVol||0),p=total?(r.callVol||0)/total:.5;color=p>=.62?'53,185,154':p<=.38?'218,83,129':'88,153,213';}
        ctx.fillStyle=`rgba(${color},${Math.min(.48,opacity*(.16+.6*intensity))})`;ctx.fillRect(x0,y-rowH/2,xw,rowH);
        ctx.fillStyle=`rgba(${color},${Math.min(.9,opacity*(.28+.58*intensity))})`;ctx.fillRect(x0,y-rowH/2,Math.max(2,xw*intensity),2);
      }
      ctx.restore();
    }
    if(P.walls){
      const cwall=s.callOIWall?.target??null,pwall=s.putOIWall?.target??null;
      if(cwall!=null)drawLine(cs.priceToCoordinate(cwall),col(4,'#ff5c8a'),'CALL OI WALL',cwall,w,h,1.5,[7,4]);
      if(pwall!=null)drawLine(cs.priceToCoordinate(pwall),col(5,'#35d6b0'),'PUT OI WALL',pwall,w,h,1.5,[7,4]);
    }
    if(P.gexWalls){
      const cw=s.gexCallWall?.target??null,pw=s.gexPutWall?.target??null;
      if(cw!=null)drawLine(cs.priceToCoordinate(cw),col(10,'#65d6e8'),'CW · MAX +NET GEX',cw,w,h,1.8,[2,4]);
      if(pw!=null)drawLine(cs.priceToCoordinate(pw),col(11,'#e8bd73'),'PW · MAX |−NET GEX|',pw,w,h,1.8,[2,4]);
    }
    if(P.gammaFlip&&s.gammaFlip?.target!=null){const p=s.gammaFlip.target;drawLine(cs.priceToCoordinate(p),col(6,'#43c7e8'),'GAMMA FLIP / ZERO GAMMA · BSM',p,w,h,1.8,[8,3]);}
    if(P.maxPain&&s.maxPain?.target!=null){const p=s.maxPain.target;if(p!=null)drawLine(cs.priceToCoordinate(p),col(7,'#b68cff'),'MAX PAIN',p,w,h,1.6,[10,4,2,4]);}
    if(P.gexCount>0){
      const levels=Array.isArray(s.gexLevels)&&s.gexLevels.length?s.gexLevels:rankGexLevels(s.dist,10,[s.gexCallWall?.sourceLevel,s.gexPutWall?.sourceLevel]).map((r,i)=>({rank:i+1,strike:r.strike,gex:r.gex}));
      levels.slice(0,P.gexCount).forEach((g,i)=>{const p=g.target;if(p==null)return;const color=(g.gex||0)>=0?col(0,'#35d59a'):col(1,'#ec557c');drawLine(cs.priceToCoordinate(p),color,`GEX ${g.rank||i+1}`,p,w,h,i<3?1.7:1.1,[3,4]);});
    }
    if(P.bubbles){
      const vols=[];for(const r of rows){if((r.callVol||0)>0)vols.push({r,side:'C',v:r.callVol});if((r.putVol||0)>0)vols.push({r,side:'P',v:r.putVol});}
      const maxV=Math.max(0,...vols.map(x=>x.v));
      if(maxV>0){
        vols.sort((a,b)=>b.v-a.v);ctx.save();ctx.textBaseline='middle';
        for(const item of vols.slice(0,P.bubbleCount)){
          const y=cs.priceToCoordinate(item.r.target);if(y==null||y<-22||y>h+22)continue;
          const radius=4+13*Math.sqrt(item.v/maxV),x=item.side==='C'?w*.70:w*.87,color=item.side==='C'?col(2,'#35e59a'):col(3,'#ff536b');
          ctx.globalAlpha=.78;ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fill();ctx.globalAlpha=.95;ctx.lineWidth=1.2;ctx.strokeStyle='rgba(5,12,20,.92)';ctx.stroke();
          if(radius>=8){ctx.font='700 9px "Space Grotesk",sans-serif';ctx.fillStyle='#071018';ctx.textAlign='center';ctx.fillText(item.side,x,y+.5);}
          ctx.globalAlpha=.95;ctx.font='600 9px "Space Grotesk",sans-serif';ctx.fillStyle=color;ctx.textAlign='left';ctx.fillText(compact(item.v),x+radius+3,y);
        }
        ctx.restore();
      }
    }
    if(P.showSourceTag){
      ctx.save();ctx.font='600 10px "Space Grotesk",sans-serif';ctx.textAlign='left';ctx.textBaseline='top';
      const status=!s.complete?'PARTIAL CHAIN':!s.gexComplete?'FULL CHAIN · GEX INCOMPLETE':'FULL CHAIN';ctx.fillStyle='rgba(4,10,18,.76)';ctx.fillRect(8,8,Math.min(350,w-16),17);
      ctx.fillStyle='#a8d9e8';ctx.fillText(`${SOURCE_NAME[XMAP.source]} OPTIONS → ${pair()} · LEVELS AUTO-UPDATE ON SOURCE CHANGE · ${status}`,13,11);ctx.restore();
    }
  }
  window.drawCrossAssetMap=drawCrossAssetMap;
  bind();
  // The chart renderer runs after this file loads; sync again here so a saved active indicator
  // can establish its ETF option session without requiring the user to open the settings dialog.
  try{syncIndicator()}catch(e){console.warn('cross asset indicator initial sync',e)}
})();
