/* ================= ETF OPTIONS VOLUME FLOW OVERLAY =================
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
  const CACHE_API_BASE=String(window.BINANCE_STOCK_CACHE_API||window.BINANCE_STOCK_SPOT_API||'').replace(/\/+$/,'');
  let flowTimer=null,flowFetchToken=0;
  const DEFAULTS={source:'qqq',bubbles:true,bubbleLabelMode:'volume',bubbleCount:200,filterBy:'volume',minVolumeContracts:0,minPremiumUSD:0,sizeScaling:'auto',absoluteScaleMaxQqq:1000,absoluteScaleMaxGld:1000,sizeFactor:1,minBubblePx:0,maxBubblePx:0,showPremiumOnBubble:false,bubbleStyle:'flat',bubbleShape:'circle',bubbleOpacity:.9,autoFilter:'off',biggestPerCandle:false,horizontalPosition:'time',zones:false,zoneHeightPct:.2,zoneLengthCandles:0,zoneMinSize:0,showCalls:true,showPuts:true,moneynessFilter:'all',expiryDteFilter:'all',showRings:true,showUnlinked:true,showMultiLeg:true,showLargeEvents:true,walls:true,gexWalls:true,gammaFlip:true,maxPain:true,gexCount:10,showSourceTag:true};
  const XMAP=window.XMAP=window.XMAP||{};
  Object.assign(XMAP,{enabled:false,source:'qqq',settings:{...DEFAULTS},version:0,snapshot:null,locked:null,events:[],flowUpdatedAt:null,error:'',started:false,indicatorId:null,visibleBubbles:[],selectedTrade:null,tradeChainCache:new Map()});

  const num=x=>(x===null||x===undefined||x==='')?null:(Number.isFinite(+x)?+x:null);
  const compact=x=>{const v=+x;if(!Number.isFinite(v))return'—';const a=Math.abs(v);return a>=1e6?(v/1e6).toFixed(1)+'m':a>=1e3?(v/1e3).toFixed(1)+'k':String(Math.round(v));};
  const fmt=(x,d=2)=>Number.isFinite(+x)?(+x).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
  const timestampMs=x=>{const t=num(x);return t===null?null:(t<1e12?t*1000:t)};
  const ageLabel=ms=>ms===null?'—':ms<60000?Math.max(0,Math.round(ms/1000))+'s':ms<3600000?Math.round(ms/60000)+'m':Math.round(ms/3600000)+'h';
  // Convert an event timestamp (seconds) into a fractional candle logical index.
  // This lets a 10:32:17 event render inside the 10:32 M1 candle even though
  // Lightweight Charts only has candle timestamps, not a data point per second.
  function flowEventLogicalTime(timeSec){
    const bars=Array.isArray(agg)?agg:[],n=bars.length,tf=Math.max(1,Number(C?.tf)||60);
    if(!n||!Number.isFinite(timeSec))return null;
    if(timeSec>=bars[n-1].st)return n-1-.5+(timeSec-bars[n-1].st)/tf;
    if(timeSec<bars[0].st)return -.5-(bars[0].st-timeSec)/tf;
    let lo=0,hi=n-1;while(lo<hi){const mid=(lo+hi+1)>>1;if(bars[mid].st<=timeSec)lo=mid;else hi=mid-1;}
    return lo-.5+Math.max(0,Math.min(1,(timeSec-bars[lo].st)/tf));
  }
  function flowEventCoordinate(timeMs){
    const logical=flowEventLogicalTime(timeMs/1000);
    if(logical===null)return null;
    try{return ts.logicalToCoordinate(logical)}catch{return null;}
  }
  function flowEventCandleIndex(timeSec,bars=Array.isArray(agg)?agg:[],timeframe=Math.max(1,Number(C?.tf)||60)){
    const rows=Array.isArray(bars)?bars:[],n=rows.length;
    if(!Number.isFinite(timeSec))return null;
    if(!n)return Math.floor(timeSec/Math.max(1,timeframe));
    if(timeSec<=rows[0].st)return 0;
    if(timeSec>=rows[n-1].st)return n-1;
    let lo=0,hi=n-1;
    while(lo<hi){const mid=(lo+hi+1)>>1;if(rows[mid].st<=timeSec)lo=mid;else hi=mid-1;}
    return lo;
  }
  function newYorkDateKey(timestamp){
    const ms=timestampMs(timestamp);if(ms===null)return null;
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(ms));
    const pick=type=>parts.find(part=>part.type===type)?.value;
    return `${pick('year')}-${pick('month')}-${pick('day')}`;
  }
  function eventDteDays(event){
    const expiry=String(event?.expiry||'').slice(0,10),date=newYorkDateKey(event?.observedAt);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(expiry)||!date)return null;
    const toUtc=value=>{const [y,m,d]=value.split('-').map(Number);return Date.UTC(y,m-1,d);};
    return Math.round((toUtc(expiry)-toUtc(date))/86400000);
  }
  function eventMoneyness(event){
    const strike=num(event?.strike),spot=num(event?.underlyingSpot),observed=timestampMs(event?.observedAt);
    let age=num(event?.spotAgeMs);
    if(age===null){
      const spotTime=timestampMs(event?.spotTimeMs);
      if(spotTime!==null&&observed!==null)age=Math.max(0,observed-spotTime);
    }
    const side=String(event?.optionType||'').toUpperCase();
    if(!(strike>0&&spot>0)||!['C','P'].includes(side)||age===null||age>60_000)return null;
    if(Math.abs(strike-spot)/spot<=0.01)return 'atm';
    return (side==='C'?strike<spot:strike>spot)?'itm':'otm';
  }
  function percentileThreshold(values,topFraction){
    const rows=(Array.isArray(values)?values:[]).map(Number).filter(value=>Number.isFinite(value)&&value>0).sort((a,b)=>a-b);
    if(!rows.length)return null;
    const fraction=Math.max(0.001,Math.min(1,Number(topFraction)||1));
    const index=Math.max(0,Math.min(rows.length-1,Math.floor((1-fraction)*rows.length)));
    return rows[index];
  }
  function filterFlowEventData(events,settings,bars=Array.isArray(agg)?agg:[],timeframe=Math.max(1,Number(C?.tf)||60)){
    const source=Array.isArray(events)?events:[],p=settings||{};
    const eligible=[];
    for(const event of source){
      const side=String(event?.optionType||'').toUpperCase()==='C'?'C':'P';
      if(side==='C'&&p.showCalls===false||side==='P'&&p.showPuts===false)continue;
      const dte=eventDteDays(event),dteFilter=p.expiryDteFilter||'all';
      if(dteFilter==='0dte'&&dte!==0)continue;
      if(dteFilter==='7d'&&!(dte>=0&&dte<=7))continue;
      if(dteFilter==='7_30d'&&!(dte>7&&dte<=30))continue;
      if(dteFilter==='30d_plus'&&!(dte>30))continue;
      const moneyFilter=p.moneynessFilter||'all';
      if(moneyFilter!=='all'&&eventMoneyness(event)!==moneyFilter)continue;
      const delta=num(event?.volumeDelta);if(!(delta>0))continue;
      const premium=num(event?.estimatedPremiumUsd);
      const metric=p.filterBy==='premium'?premium:delta;
      if(!(metric>0))continue;
      const min=p.filterBy==='premium'?Math.max(0,num(p.minPremiumUSD)||0):Math.max(0,num(p.minVolumeContracts)||0);
      if(metric<min)continue;
      const stamp=timestampMs(event?.observedAt);if(stamp===null)continue;
      const candleIndex=flowEventCandleIndex(stamp/1000,bars,timeframe);
      eligible.push({event,side,delta,premium,metric,stamp,candleIndex,sessionKey:newYorkDateKey(stamp)});
    }
    const bySession=new Map();
    for(const item of eligible){if(!bySession.has(item.sessionKey))bySession.set(item.sessionKey,[]);bySession.get(item.sessionKey).push(item.metric);}
    const largeThresholds=new Map(),filterThresholds=new Map();
    const topFraction=({strong:0.05,medium:0.10,weak:0.20})[p.autoFilter]||null;
    for(const [key,values] of bySession){
      largeThresholds.set(key,percentileThreshold(values,0.05));
      if(topFraction)filterThresholds.set(key,percentileThreshold(values,topFraction));
    }
    let filtered=eligible.filter(item=>!topFraction||item.metric>=(filterThresholds.get(item.sessionKey)??Infinity));
    if(p.biggestPerCandle){
      const best=new Map();
      for(const item of filtered){
        const key=`${item.sessionKey}|${item.candleIndex}`;
        const old=best.get(key);
        if(!old||item.metric>old.metric||(item.metric===old.metric&&item.stamp>old.stamp))best.set(key,item);
      }
      filtered=[...best.values()];
    }
    return filtered.sort((a,b)=>a.stamp-b.stamp).map(item=>({...item,largeThreshold:largeThresholds.get(item.sessionKey)??null}));
  }
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
    const excluded=(Array.isArray(excludedStrikes)?excludedStrikes:[]).map(v=>typeof v==='object'&&v!==null?num(v.strike):num(v)).filter(v=>v!==null);
    return (Array.isArray(dist)?dist:[]).filter(x=>Number.isFinite(+x.gex)&&Math.abs(+x.gex)>0&&
      !excluded.some(level=>Math.abs((num(x.strike)??NaN)-level)<=1e-4))
      .slice().sort((a,b)=>Math.abs(+b.gex)-Math.abs(+a.gex)).slice(0,Math.max(0,Math.min(10,+count||0)));
  }
  function excludedKeyLevelStrikes(snapshot={}){
    const values=[];
    const add=(value)=>{const n=num(value);if(n!==null&&n>0&&!values.some(x=>Math.abs(x-n)<=1e-4))values.push(n);};
    add(snapshot.callOIWall?.strike??snapshot.callWall?.strike);
    add(snapshot.putOIWall?.strike??snapshot.putWall?.strike);
    add(snapshot.oiWall?.strike);
    add(snapshot.gexCallWall?.strike);
    add(snapshot.gexPutWall?.strike);
    add(snapshot.maxPain?.strike);
    for(const strike of (Array.isArray(snapshot.maxPain?.tiedStrikes)?snapshot.maxPain.tiedStrikes:[]))add(strike);
    add(snapshot.gammaFlip);
    return values;
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
    if(!snapshot||snapshot.complete!==true||snapshot.expiryMismatch===true||!Array.isArray(snapshot.dist)||!snapshot.dist.length)return null; // never map data whose expiry differs from the displayed one
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
    // Keep a level's prior mapping by source strike, not by its ladder rank.
    // Removing duplicate Key Levels may shift ranks without changing that level's price.
    const oldGex=new Map((prev?.gexLevels||[]).map(g=>[String(num(g.sourceLevel??g.strike)),g]));
    const excludedGexStrikes=excludedKeyLevelStrikes(snapshot);
    // Build the ladder from the full strike distribution, then exclude every other
    // plotted price level before taking the strongest ten remaining Net-GEX strikes.
    let gexUniverse;
    if(Array.isArray(snapshot.gexRankedCandidates)&&snapshot.gexRankedCandidates.length){
      gexUniverse=snapshot.gexRankedCandidates;
    }else{
      // Compatibility with snapshots made before full ranked candidates were exposed:
      // merge all available rows by strike so filtering a previous top-10 never leaves gaps.
      const byStrike=new Map();
      for(const row of [...(snapshot.dist||[]),...(snapshot.gexLevels||[])]){
        const strike=num(row?.strike);if(!(strike>0))continue;
        const key=strike.toFixed(6),old=byStrike.get(key);
        if(!old||(!Number.isFinite(+old.gex)&&Number.isFinite(+row.gex)))byStrike.set(key,row);
      }
      gexUniverse=[...byStrike.values()];
    }
    const eligibleGex=snapshot.gexComplete!==false?rankGexLevels(gexUniverse,10,excludedGexStrikes):[];
    const gexLevels=eligibleGex.map((g,i)=>{const rank=i+1,previous=oldGex.get(String(num(g.strike)));return track(mapLevel(g.strike,previous,sourcePrice,targetPrice,mappedAt,{...g,rank,strike:g.strike}),`GEX ${rank}`)}).filter(Boolean);
    const changed=changedCount>0;
    const mappedCount=dist.length+[callOIWall,putOIWall,gexCallWall,gexPutWall,gammaFlip,maxPain].filter(x=>x?.target!==null&&x?.target!==undefined).length+gexLevels.filter(x=>x.target!==null).length;
    const pendingCount=mappedDist.filter(x=>x&&!Number.isFinite(x.target)).length+[callOIWall,putOIWall,gexCallWall,gexPutWall,gammaFlip,maxPain].filter(x=>x&&x.target==null).length+gexLevels.filter(x=>x.target==null).length;
    const mappingSignature=JSON.stringify({dist:dist.map(r=>[r.strike,r.sourceLevel,r.target]),callOIWall:callOIWall&&[callOIWall.sourceLevel,callOIWall.target],putOIWall:putOIWall&&[putOIWall.sourceLevel,putOIWall.target],gexCallWall:gexCallWall&&[gexCallWall.sourceLevel,gexCallWall.target],gexPutWall:gexPutWall&&[gexPutWall.sourceLevel,gexPutWall.target],gammaFlip:gammaFlip&&[gammaFlip.sourceLevel,gammaFlip.target],maxPain:maxPain&&[maxPain.sourceLevel,maxPain.target],gexExcluded:excludedGexStrikes,gex:gexLevels.map(g=>[g.rank,g.sourceLevel,g.target])});
    const target=num(targetPrice),source=num(sourcePrice);
    return Object.freeze({source:snapshot.key||snapshot.symbol||'',symbol:snapshot.symbol||'',target:TARGET[snapshot.key]||pair(),expiry:snapshot.expiry||'',mappingSignature,
      // These spot anchors describe the most recent level-change mapping only; they are not live inputs to existing levels.
      sourcePrice:changed?source:(prev?.sourcePrice??source),targetPrice:changed?target:(prev?.targetPrice??target),
      ratio:lastRatio, lastRatio, lastLevelChangeAt:changed?mappedAt:(prev?.lastLevelChangeAt??mappedAt),
      changedCount:(prev?.changedCount||0)+changedCount,mappedCount,pendingCount,complete:!!snapshot.complete,gexComplete:!!snapshot.gexComplete,coverage:num(snapshot.coverage),gexCoverage:num(snapshot.gexCoverage),updatedAt:snapshot.updatedAt||null,
      dist:Object.freeze(dist),callOIWall,putOIWall,gexCallWall,gexPutWall,gammaFlip,maxPain,gexRatio:num(snapshot.gexRatio),gexRatioState:snapshot.gexRatioState||null,gexRatioBias:snapshot.gexRatioBias||null,callGexTotal:num(snapshot.callGexTotal),putGexAbsTotal:num(snapshot.putGexAbsTotal),gexLevels:Object.freeze(gexLevels),gexExcludedStrikes:Object.freeze(excludedGexStrikes)});
  }
  function buildLockedMap(snapshot,sourcePrice,targetPrice,lockedAt=Date.now()){
    return buildMappedMap(snapshot,sourcePrice,targetPrice,null,lockedAt);
  }
  window.crossAssetMapMath=Object.freeze({mapStrike,rankGexLevels,excludedKeyLevelStrikes,buildLockedMap,buildMappedMap,sameLevel});
  window.crossAssetFlowMath=Object.freeze({eventDteDays,eventMoneyness,percentileThreshold,filterFlowEventData});
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
    p.bubbleLabelMode=p.bubbleLabelMode==='cp'?'cp':'volume';
    p.bubbleCount=Math.max(5,Math.min(2000,Math.round(+p.bubbleCount||200)));
    p.filterBy=p.filterBy==='premium'?'premium':'volume';
    p.sizeScaling=p.sizeScaling==='absolute'?'absolute':'auto';
    p.absoluteScaleMaxQqq=Math.max(1,num(p.absoluteScaleMaxQqq??p.absoluteScaleMax)||1000);
    p.absoluteScaleMaxGld=Math.max(1,num(p.absoluteScaleMaxGld??p.absoluteScaleMax)||1000);
    p.sizeFactor=Math.max(.25,Math.min(4,num(p.sizeFactor)||1));
    p.minBubblePx=Math.max(0,Math.min(80,num(p.minBubblePx)||0));
    p.maxBubblePx=Math.max(0,Math.min(100,num(p.maxBubblePx)||0));
    p.bubbleStyle=p.bubbleStyle==='glossy'?'glossy':'flat';
    p.bubbleShape=['rectangle','diamond'].includes(p.bubbleShape)?p.bubbleShape:'circle';
    p.bubbleOpacity=Math.max(.1,Math.min(1,num(p.bubbleOpacity)??.9));
    p.autoFilter=['strong','medium','weak'].includes(p.autoFilter)?p.autoFilter:'off';
    p.horizontalPosition=p.horizontalPosition==='candle'?'candle':'time';
    p.zoneHeightPct=Math.max(.01,Math.min(10,num(p.zoneHeightPct)||.2));
    p.zoneLengthCandles=Math.max(0,Math.min(500,Math.round(num(p.zoneLengthCandles)||0)));
    p.zoneMinSize=Math.max(0,num(p.zoneMinSize)||0);
    p.expiryDteFilter=['0dte','7d','7_30d','30d_plus'].includes(p.expiryDteFilter)?p.expiryDteFilter:'all';
    p.moneynessFilter=['itm','atm','otm'].includes(p.moneynessFilter)?p.moneynessFilter:'all';
    p.minVolumeContracts=Math.max(0,num(p.minVolumeContracts)||0);
    p.minPremiumUSD=Math.max(0,num(p.minPremiumUSD)||0);
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
    if(!XMAP.enabled){el.textContent='Thêm “ETF Options Volume Flow” trong Kho Indicator → Orderflow, sau đó bật bằng nút mắt. Bubble được dựng từ Volume Delta đã lưu trên server, theo timestamp và strike.';setState('Indicator inactive');return;}
    if(!currentMatchesTarget()){
      el.textContent=`Đang chọn ${SOURCE_NAME[XMAP.source]} → ${pair()}. Chart hiện tại là ${C.sym}; mở chart ${pair()} để đặt các level lên đúng trục giá.`;
      setState('Chờ chart đích','warn');return;
    }
    const s=XMAP.snapshot,m=XMAP.locked;
    syncExpiryControl(s);
    if(s?.error){el.textContent=`Binance ${SOURCE_NAME[XMAP.source]}: ${s.error}`;setState('Lỗi nguồn dữ liệu','warn');return;}
    if(!s||!sourceSpot()){el.textContent=`Đang chờ Spot ${SOURCE_NAME[XMAP.source]} từ server cache…`;setState('Đang tải','loading');return;}
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
    el.textContent=`VOLUME FLOW · ${SOURCE_NAME[XMAP.source]} → ${pair()} · ${XMAP.events.length} events đã lưu · ${m.mappedCount||0} key levels · chain ${m.expiry||'—'} · last flow update ${XMAP.flowUpdatedAt?new Date(XMAP.flowUpdatedAt).toLocaleTimeString('vi-VN'):'—'}. Bubble đặt theo thời điểm server phát hiện Volume Delta và strike quy đổi; không đại diện limit/stop hoặc từng lệnh riêng lẻ.`;
    setState(XMAP.events.length?'Volume history loaded':'Đang chờ Volume events',XMAP.events.length?'ok':'warn');
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
  async function refreshFlowEvents(){
    if(!XMAP.enabled||!CACHE_API_BASE)return;
    const token=++flowFetchToken;
    try{
      const symbol=SOURCE_NAME[XMAP.source];
      const response=await fetch(`${CACHE_API_BASE}/api/volume-flow/events?symbol=${encodeURIComponent(symbol)}&limit=20000`,{cache:'no-store',headers:{Accept:'application/json'}});
      const payload=await response.json();
      if(token!==flowFetchToken||!XMAP.enabled)return;
      if(!response.ok||payload?.ok===false)throw new Error(payload?.error||`Volume Flow API HTTP ${response.status}`);
      XMAP.events=(Array.isArray(payload.events)?payload.events:[]).slice().sort((a,b)=>Number(a.observedAt)-Number(b.observedAt));
      XMAP.flowUpdatedAt=Date.now();XMAP.error='';XMAP.version++;
      try{if(typeof dirty!=='undefined')dirty=true}catch{}
      updateMeta();
    }catch(error){
      XMAP.error=error?.message||String(error);
      updateMeta();
    }
  }
  function startFlowPolling(){
    if(flowTimer)clearInterval(flowTimer);
    refreshFlowEvents();
    flowTimer=setInterval(()=>{if(XMAP.enabled)refreshFlowEvents()},5000);
  }
  function stopFlowPolling(){
    flowFetchToken++;
    if(flowTimer)clearInterval(flowTimer);
    flowTimer=null;
  }

  // ---------------- Trade Structure Analyzer ----------------
  const tradeMath=()=>window.tradeStructureAnalyzer||null;
  const escHtml=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const tradeMoney=value=>value===null||value===undefined||!Number.isFinite(Number(value))?'Unlimited':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(value));
  const etTime=value=>{const ms=timestampMs(value);return ms===null?'—':new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(ms))+' ET'};
  function contractType(contract){return String(contract?.side??contract?.optionType??contract?.type??'').toUpperCase().startsWith('C')?'C':String(contract?.side??contract?.optionType??contract?.type??'').toUpperCase().startsWith('P')?'P':'';}
  function contractStrike(contract){return num(contract?.strike??contract?.strikePrice);}
  function quotePremium(contract){
    if(!contract)return{price:null,source:'unavailable'};
    const bid=num(contract.bid),ask=num(contract.ask),mid=num(contract.mid),last=num(contract.last);
    if(bid!==null&&ask!==null&&bid>0&&ask>=bid)return{price:(bid+ask)/2,source:'NBBO midpoint'};
    if(mid!==null&&mid>0)return{price:mid,source:'cached midpoint'};
    if(last!==null&&last>0)return{price:last,source:'last price'};
    return{price:null,source:'no valid quote'};
  }
  function findTradeContract(contracts,type,strike,optionSymbol=''){
    const rows=Array.isArray(contracts)?contracts:[];
    if(optionSymbol){const exact=rows.find(item=>String(item.optionSymbol||'').toUpperCase()===String(optionSymbol).toUpperCase());if(exact)return exact;}
    return rows.find(item=>contractType(item)===type&&Math.abs((contractStrike(item)??NaN)-strike)<1e-5)||null;
  }
  function strikeList(contracts,type){return [...new Set((contracts||[]).filter(c=>contractType(c)===type).map(contractStrike).filter(v=>v>0))].sort((a,b)=>a-b);}
  function closestStrike(contracts,type,anchor,direction){
    const values=strikeList(contracts,type).filter(value=>direction==='above'?value>anchor+1e-6:value<anchor-1e-6);
    if(!values.length)return null;
    return direction==='above'?Math.min(...values):Math.max(...values);
  }
  async function loadTradeChain(event){
    const symbol=String(event?.symbol||'').toUpperCase(),expiry=String(event?.expiry||'').slice(0,10),key=`${symbol}|${expiry}`;
    if(!CACHE_API_BASE)throw new Error('Chưa cấu hình Node cache API.');
    const cached=XMAP.tradeChainCache.get(key);
    if(cached&&Date.now()-cached.fetchedAt<8000)return cached.payload;
    const response=await fetch(`${CACHE_API_BASE}/api/options-cache/chain?symbol=${encodeURIComponent(symbol)}&expiry=${encodeURIComponent(expiry)}`,{cache:'no-store',headers:{Accept:'application/json'}});
    const payload=await response.json();
    if(!response.ok||payload?.ok===false||!Array.isArray(payload?.contracts))throw new Error(payload?.error||`Không đọc được Option Chain cache (HTTP ${response.status}).`);
    XMAP.tradeChainCache.set(key,{payload,fetchedAt:Date.now()});
    return payload;
  }
  function relatedActivity(event){
    const base=timestampMs(event?.observedAt),symbol=String(event?.symbol||'').toUpperCase(),expiry=String(event?.expiry||'');
    if(base===null)return[];
    return (XMAP.events||[]).filter(other=>other&&other!==event&&String(other.symbol||'').toUpperCase()===symbol&&String(other.expiry||'')===expiry&&
      !(String(other.optionSymbol||'')===String(event.optionSymbol||'')&&timestampMs(other.observedAt)===base&&num(other.volumeDelta)===num(event.volumeDelta)))
      .map(other=>({...other,_eventIndex:(XMAP.events||[]).indexOf(other),_dt:Math.abs((timestampMs(other.observedAt)||0)-base)})).filter(other=>other._dt<=5000&&num(other.volumeDelta)>0)
      .sort((a,b)=>a._dt-b._dt).slice(0,8).map(other=>{
        const sameType=String(other.optionType||'').toUpperCase()===String(event.optionType||'').toUpperCase();
        const sameStrike=Math.abs((num(other.strike)||0)-(num(event.strike)||0))<1e-5;
        const relation=sameType&&!sameStrike?'possible vertical':!sameType&&sameStrike?'possible straddle':!sameType?'possible strangle':'related same-side activity';
        const ratio=(num(other.volumeDelta)||0)/Math.max(1,num(event.volumeDelta)||1);
        const confidence=other._dt<=1000&&ratio>=0.7&&ratio<=1.3?'MEDIUM':'LOW';
        return{...other,relation,confidence};
      });
  }
  function makeTradeLeg(contract,side,ratio,baseQuantity){
    if(!contract)return null;
    const quote=quotePremium(contract),multiplier=num(contract.multiplier);
    return{
      optionSymbol:String(contract.optionSymbol||''),type:contractType(contract),strike:contractStrike(contract),side,
      quantity:Math.max(1,Number(baseQuantity)||1)*ratio,ratio,premium:quote.price,premiumSource:quote.source,
      multiplier:multiplier>0?multiplier:100,multiplierAssumed:!(multiplier>0),bid:num(contract.bid),ask:num(contract.ask),last:num(contract.last),
      quoteUpdatedAt:contract.updatedAt||contract.updated_at||null
    };
  }
  function buildScenarioLegs(event,chain,strategy,baseQuantity){
    const contracts=chain?.contracts||[],anchor=num(event?.strike),selectedType=String(event?.optionType||'').toUpperCase()==='P'?'P':'C';
    const legs=[],errors=[];
    const add=(type,strike,side,ratio=1,optionSymbol='')=>{
      const contract=findTradeContract(contracts,type,strike,optionSymbol);
      if(!contract){errors.push(`Không tìm thấy ${type==='C'?'Call':'Put'} ${strike}.`);return;}
      const leg=makeTradeLeg(contract,side,ratio,baseQuantity);
      if(!leg||leg.premium===null)errors.push(`Contract ${type}${strike} chưa có Bid/Ask hoặc Last Price hợp lệ.`);
      if(leg)legs.push(leg);
    };
    const callAt=(strike,side,ratio=1)=>add('C',strike,side,ratio);
    const putAt=(strike,side,ratio=1)=>add('P',strike,side,ratio);
    const higherCall=closestStrike(contracts,'C',anchor,'above'),lowerCall=closestStrike(contracts,'C',anchor,'below');
    const higherPut=closestStrike(contracts,'P',anchor,'above'),lowerPut=closestStrike(contracts,'P',anchor,'below');
    const exactSelected=findTradeContract(contracts,selectedType,anchor,event.optionSymbol);
    switch(strategy){
      case 'single-short': case 'single-long':
        if(!exactSelected)errors.push('Không tìm thấy contract được click trong Option Chain cache.');
        else {const leg=makeTradeLeg(exactSelected,strategy==='single-short'?'sell':'buy',1,baseQuantity);if(leg?.premium===null)errors.push('Không có quote hợp lệ để tính premium.');if(leg)legs.push(leg);}
        break;
      case 'bull-call': if(higherCall===null)errors.push('Không có Call strike cao hơn để tạo spread.');else{callAt(anchor,'buy');callAt(higherCall,'sell');}break;
      case 'bear-call': if(higherCall===null)errors.push('Không có Call strike cao hơn để tạo spread.');else{callAt(anchor,'sell');callAt(higherCall,'buy');}break;
      case 'bear-put': if(lowerPut===null)errors.push('Không có Put strike thấp hơn để tạo spread.');else{putAt(anchor,'buy');putAt(lowerPut,'sell');}break;
      case 'bull-put': if(lowerPut===null)errors.push('Không có Put strike thấp hơn để tạo spread.');else{putAt(anchor,'sell');putAt(lowerPut,'buy');}break;
      case 'long-straddle': callAt(anchor,'buy');putAt(anchor,'buy');break;
      case 'long-strangle':
        {const ref=sourceSpot()||anchor,p=closestStrike(contracts,'P',ref,'below'),c=closestStrike(contracts,'C',ref,'above');
          if(p===null||c===null)errors.push('Không đủ OTM Put/Call quanh underlying để tạo Strangle.');else{putAt(p,'buy');callAt(c,'buy');}}
        break;
      case 'iron-condor':
        {const spot=sourceSpot()||anchor,puts=strikeList(contracts,'P').filter(v=>v<spot).sort((a,b)=>b-a),calls=strikeList(contracts,'C').filter(v=>v>spot).sort((a,b)=>a-b);
          if(puts.length<2||calls.length<2)errors.push('Không đủ bốn strike OTM để tạo Iron Condor.');
          else{putAt(puts[0],'sell');putAt(puts[1],'buy');callAt(calls[0],'sell');callAt(calls[1],'buy');}}
        break;
      case 'call-butterfly': case 'put-butterfly':
        {const type=strategy==='call-butterfly'?'C':'P',lower=closestStrike(contracts,type,anchor,'below'),upper=closestStrike(contracts,type,anchor,'above');
          if(lower===null||upper===null)errors.push('Không đủ strike hai phía để tạo Butterfly.');
          else if(type==='C'){callAt(lower,'buy');callAt(anchor,'sell',2);callAt(upper,'buy');}
          else{putAt(lower,'buy');putAt(anchor,'sell',2);putAt(upper,'buy');}}
        break;
      default: errors.push('Payoff scenario không được hỗ trợ.');
    }
    return{legs,errors};
  }
  function selectedTradeModel(){
    const trade=XMAP.selectedTrade;if(!trade?.chain)return null;
    const quantity=Math.max(1,Math.min(10000,Math.round(Number(trade.quantity)||1)));
    const built=trade.strategy==='custom'&&Array.isArray(trade.customLegs)
      ?{legs:trade.customLegs.map(leg=>({...leg,quantity:quantity*(Number(leg.ratio)||1)})),errors:[]}
      :buildScenarioLegs(trade.event,trade.chain,trade.strategy,quantity);
    const legs=built.legs.map(leg=>{
      const override=trade.legOverrides?.[leg.optionSymbol];
      return override?{...leg,...override,quantity:quantity*(Number(leg.ratio)||1)}:leg;
    });
    const math=tradeMath(),payoff=math&&legs.length===built.legs.length&&!built.errors.length?math.analyzePayoff(legs,{underlyingSpot:sourceSpot()}):null;
    trade.legs=legs;trade.errors=built.errors;trade.payoff=payoff?.ok?payoff:null;trade.payoffError=built.errors.length?built.errors.join(' '):payoff?.error||(!math?'Trade Structure math engine chưa được tải.':'');
    return trade;
  }
  function renderTradePanel(){
    const panel=$('xmapTradePanel'),trade=XMAP.selectedTrade;if(!panel||!trade)return;
    const event=trade.event,contracts=trade.chain?.contracts||[],eventContract=findTradeContract(contracts,String(event.optionType||'C').toUpperCase()==='P'?'P':'C',num(event.strike),event.optionSymbol);
    const quote=quotePremium(eventContract),expiry=String(event.expiry||'');
    $('xmapTradeTitle').textContent=`${event.symbol||SOURCE_NAME[XMAP.source]} ${event.strike}${String(event.optionType||'C').toUpperCase()}`;
    $('xmapTradeSubtitle').textContent=`${expiry} · ${etTime(event.observedAt)} · ${event.captureMode==='interval'?'Interval observation':'Live observation'}`;
    $('xmapTradeEvent').innerHTML=[
      ['VOLUME DELTA',`+${compact(event.volumeDelta)}`,'volume'],['CUMULATIVE VOLUME',compact(event.volumeTotal),''],['EXPIRY',expiry,''],
      ['CONTRACT',event.optionSymbol||'—',''],['EST. PREMIUM',quote.price===null?'—':`$${fmt(quote.price,2)}`,''],['BID / ASK',`${eventContract?.bid??'—'} / ${eventContract?.ask??'—'}`,'']
    ].map(([label,value,cls])=>`<div class="xmap-trade-kv ${cls}"><small>${label}</small><strong>${escHtml(value)}</strong></div>`).join('');
    $('xmapTradeQuote').innerHTML=eventContract
      ?`<strong>Cached option quote:</strong> Bid ${escHtml(eventContract.bid??'—')} · Ask ${escHtml(eventContract.ask??'—')} · Last ${escHtml(eventContract.last??'—')} · ${escHtml(quote.source)}. <span>Expiry cache last changed: ${escHtml(trade.chain.updated_at||'unknown')} (not an execution timestamp).</span>`
      :'Không tìm thấy quote hiện tại của contract trong chain cache.';
    const strategy=$('xmapTradeStrategy'),quantity=$('xmapTradeQuantity');
    if(strategy.value!==trade.strategy)strategy.value=trade.strategy;
    if(String(quantity.value)!==String(trade.quantity))quantity.value=trade.quantity;
    selectedTradeModel();
    $('xmapTradeLegs').innerHTML=trade.legs.length?trade.legs.map((leg,index)=>`<div class="xmap-trade-leg" data-leg-index="${index}">
      <select aria-label="Position side" data-leg-side="${index}"><option value="buy"${leg.side==='buy'?' selected':''}>BUY</option><option value="sell"${leg.side==='sell'?' selected':''}>SELL</option></select>
      <span class="contract">${leg.type}${fmt(leg.strike,2).replace(/\.00$/,'')} ×${leg.quantity}</span>
      <input aria-label="Premium" data-leg-premium="${index}" type="number" min="0" step="0.01" value="${leg.premium===null?'':Number(leg.premium).toFixed(2)}" placeholder="Price">
      <span class="contract" title="${escHtml(leg.premiumSource)}">${leg.multiplierAssumed?'×100*':'×'+leg.multiplier}</span>
    </div>`).join(''):`<div class="xmap-trade-candidate">Chưa tạo được legs.</div>`;
    if(trade.payoff){
      const mapped=trade.payoff.breakevens.map(value=>targetSpot()>0&&sourceSpot()>0?mapStrike(value,sourceSpot(),targetSpot()):null);
      const breakEvenLabel=trade.payoff.breakevens.length?trade.payoff.breakevens.map((value,index)=>`${fmt(value,2)} ETF${mapped[index]!==null?` · ${fmt(mapped[index],2)} ${pair()}`:''}`).join(' / '):'Không có breakeven trong miền underlying không âm';
      $('xmapTradeResults').innerHTML=`<div class="xmap-trade-stat profit"><small>MAX PROFIT</small><strong>${trade.payoff.unlimitedProfit?'Unlimited':tradeMoney(trade.payoff.maxProfit)}</strong></div>
        <div class="xmap-trade-stat loss"><small>MAX LOSS</small><strong>${trade.payoff.unlimitedLoss?'Unlimited':'−'+tradeMoney(trade.payoff.maxLoss)}</strong></div>
        <div class="xmap-trade-stat"><small>NET ${trade.payoff.netDebit>=0?'DEBIT':'CREDIT'}</small><strong>${tradeMoney(Math.abs(trade.payoff.netDebit))}</strong></div>
        <div class="xmap-trade-stat"><small>SCENARIO SIZE</small><strong>${trade.quantity} strategy unit${trade.quantity>1?'s':''}</strong></div>
        <div class="xmap-trade-breakeven"><strong>BREAKEVEN</strong><br>${escHtml(breakEvenLabel)}</div>`;
    }else{
      $('xmapTradeResults').innerHTML=`<div class="xmap-trade-breakeven" style="grid-column:1/-1"><strong>PAYOFF NOT AVAILABLE</strong><br>${escHtml(trade.payoffError||'Thiếu dữ liệu premium.')}</div>`;
    }
    const related=relatedActivity(event);
    $('xmapTradeRelated').innerHTML=`<h4>RELATED OPTION ACTIVITY <small>±5 seconds · same expiry</small></h4>`+(related.length?related.map(item=>{
      return`<div class="xmap-trade-candidate"><strong>${item.confidence}</strong> · ${escHtml(item.relation)} · ${escHtml(item.optionSymbol||`${item.strike}${item.optionType}`)} · Δ ${compact(item.volumeDelta)} · ${(item._dt/1000).toFixed(1)}s<br><button type="button" data-trade-candidate="${item._eventIndex}">Model this pair · assumptions</button></div>`;
    }).join(''):'<div class="xmap-trade-candidate">Không có hoạt động gần thời điểm này.</div>');
    $('xmapTradeDisclaimer').textContent='Payoff là kịch bản tại expiration, chưa gồm phí/thuế. BUY/SELL là giả định có thể chỉnh sửa, không suy ra từ Volume. Premium lấy từ quote cache hiện tại (Mid nếu Bid/Ask hợp lệ, nếu không dùng Last), không phải execution price lịch sử. *Multiplier ×100 là giả định khi contract không cung cấp multiplier.';
    panel.hidden=false;
    try{if(typeof dirty!=='undefined')dirty=true}catch{}
  }
  async function openTradeAnalyzer(event){
    const panel=$('xmapTradePanel');if(!panel||!event)return;
    XMAP.selectedTrade={event,chain:null,strategy:'single-long',quantity:1,legs:[],customLegs:null,legOverrides:{},payoff:null,payoffError:'Đang đọc Option Chain cache…'};
    panel.hidden=false;try{if(typeof dirty!=='undefined')dirty=true}catch{};$('xmapTradeTitle').textContent=`${event.symbol||''} ${event.strike}${event.optionType||''}`;$('xmapTradeSubtitle').textContent='Đang tải quote từ Node Server cache…';$('xmapTradeEvent').innerHTML='<div class="xmap-trade-candidate">Loading cached Option Chain…</div>';
    $('xmapTradeQuote').textContent='Website chỉ đọc dữ liệu từ Node Server.';$('xmapTradeLegs').innerHTML='';$('xmapTradeResults').innerHTML='';$('xmapTradeRelated').innerHTML='';
    try{const chain=await loadTradeChain(event);if(XMAP.selectedTrade?.event!==event)return;XMAP.selectedTrade.chain=chain;renderTradePanel();}
    catch(error){if(XMAP.selectedTrade?.event!==event)return;$('xmapTradeSubtitle').textContent='Không tải được Option Chain cache';$('xmapTradeEvent').innerHTML=`<div class="xmap-trade-candidate">${escHtml(error?.message||error)}</div>`;$('xmapTradeResults').innerHTML='';$('xmapTradeDisclaimer').textContent='Không có quote cache nên chưa thể tính payoff. Hãy kiểm tra Node Server và trạng thái đồng bộ expiry.';}
  }
  function closeTradeAnalyzer(){XMAP.selectedTrade=null;const panel=$('xmapTradePanel');if(panel)panel.hidden=true;try{if(typeof dirty!=='undefined')dirty=true}catch{}}
  function applyRelatedCandidate(eventIndex){
    const trade=XMAP.selectedTrade;if(!trade?.chain)return;
    const related=relatedActivity(trade.event).find(item=>item._eventIndex===eventIndex);if(!related)return;
    const contracts=trade.chain.contracts||[],baseType=String(trade.event.optionType||'C').toUpperCase()==='P'?'P':'C';
    const relatedType=String(related.optionType||'C').toUpperCase()==='P'?'P':'C';
    const first=findTradeContract(contracts,baseType,num(trade.event.strike),trade.event.optionSymbol);
    const second=findTradeContract(contracts,relatedType,num(related.strike),related.optionSymbol);
    if(!first||!second){trade.payoffError='Không tìm thấy đủ cả hai contracts trong cached Option Chain.';renderTradePanel();return;}
    const vertical=baseType===relatedType&&Math.abs((num(trade.event.strike)||0)-(num(related.strike)||0))>1e-6;
    const primary=makeTradeLeg(first,'buy',1,trade.quantity),secondary=makeTradeLeg(second,vertical?'sell':'buy',1,trade.quantity);
    if(!primary||!secondary||primary.premium===null||secondary.premium===null){trade.payoffError='Một hoặc cả hai contract chưa có premium hợp lệ trong cache.';renderTradePanel();return;}
    trade.strategy='custom';trade.customLegs=[primary,secondary];trade.legOverrides={};trade.candidate=related;
    selectedTradeModel();renderTradePanel();
  }
  function recalculateTradeFromControls(){
    const trade=XMAP.selectedTrade;if(!trade?.chain)return;
    const nextStrategy=$('xmapTradeStrategy')?.value||'single-long';
    if(nextStrategy!==trade.strategy){trade.legOverrides={};if(nextStrategy!=='custom')trade.customLegs=null;}
    else{
      // Preserve manual leg-side and premium edits before rebuilding the scenario.
      for(const [index,leg] of (trade.legs||[]).entries()){
        const side=$('xmapTradeLegs')?.querySelector(`[data-leg-side="${index}"]`);
        const price=$('xmapTradeLegs')?.querySelector(`[data-leg-premium="${index}"]`);
        const override={...(trade.legOverrides?.[leg.optionSymbol]||{})};
        if(side)override.side=side.value==='sell'?'sell':'buy';
        if(price&&price.value!==''){const premium=num(price.value);if(premium!==null&&premium>=0)override.premium=premium;}
        if(Object.keys(override).length)trade.legOverrides[leg.optionSymbol]=override;
      }
    }
    trade.strategy=nextStrategy;
    trade.quantity=Math.max(1,Math.min(10000,Math.round(Number($('xmapTradeQuantity')?.value)||1)));
    selectedTradeModel();
    renderTradePanel();
  }
  function onTradePanelInput(event){
    if(event.target?.id==='xmapTradeStrategy'||event.target?.id==='xmapTradeQuantity')recalculateTradeFromControls();
    else if(event.target?.dataset?.legSide!==undefined||event.target?.dataset?.legPremium!==undefined)recalculateTradeFromControls();
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
    refreshSnapshot();startFlowPolling();updateMeta();
  }
  function stop(){
    const wasOn=XMAP.enabled;
    XMAP.enabled=false;XMAP.started=false;XMAP.snapshot=null;XMAP.locked=null;XMAP.events=[];XMAP.visibleBubbles=[];XMAP.selectedTrade=null;const tradePanel=$('xmapTradePanel');if(tradePanel)tradePanel.hidden=true;stopFlowPolling();XMAP.version++;
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
    $('xmapTradeClose')?.addEventListener('click',closeTradeAnalyzer);
    $('xmapTradePanel')?.addEventListener('change',onTradePanelInput);
    $('xmapTradePanel')?.addEventListener('click',event=>{const button=event.target?.closest?.('[data-trade-candidate]');if(button)applyRelatedCandidate(Number(button.dataset.tradeCandidate));});
    $('chart')?.addEventListener('click',event=>{
      if(!XMAP.enabled||!activeOnChart(activeIndicator())||!currentMatchesTarget())return;
      const rect=$('chart').getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;
      let best=null,bestDistance=Infinity;
      for(const bubble of XMAP.visibleBubbles||[]){const distance=Math.hypot(x-bubble.x,y-bubble.y);if(distance<=bubble.radius+9&&distance<bestDistance){best=bubble;bestDistance=distance;}}
      if(best)openTradeAnalyzer(best.event);
    });
    document.addEventListener?.('keydown',event=>{if(event.key==='Escape'&&XMAP.selectedTrade)closeTradeAnalyzer()});
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
  function bubbleEventKey(event,index){
    return String(event?.id??`${event?.optionSymbol||''}|${event?.observedAt||''}|${event?.volumeDelta||''}|${index}`);
  }
  function possibleStructureEventKeys(events){
    const rows=Array.isArray(events)?events:[],buckets=new Map(),keys=rows.map(bubbleEventKey),candidate=new Set();
    rows.forEach((event,index)=>{
      const stamp=timestampMs(event?.observedAt);if(stamp===null)return;
      const second=Math.floor(stamp/1000),bucket=`${String(event.symbol||'').toUpperCase()}|${event.expiry||''}|${second}`;
      if(!buckets.has(bucket))buckets.set(bucket,[]);
      buckets.get(bucket).push(index);
    });
    rows.forEach((event,index)=>{
      const stamp=timestampMs(event?.observedAt);if(stamp===null)return;
      const second=Math.floor(stamp/1000),symbol=String(event.symbol||'').toUpperCase(),expiry=String(event.expiry||''),delta=num(event.volumeDelta)||0;
      if(!(delta>0))return;
      for(let offset=-5;offset<=5;offset++){
        const bucket=buckets.get(`${symbol}|${expiry}|${second+offset}`)||[];
        for(const otherIndex of bucket){
          if(otherIndex===index)continue;
          const other=rows[otherIndex];
          if(String(other.optionSymbol||'')===String(event.optionSymbol||''))continue;
          const otherStamp=timestampMs(other.observedAt),otherDelta=num(other.volumeDelta)||0;
          if(otherStamp===null||Math.abs(otherStamp-stamp)>5000||!(otherDelta>0))continue;
          const ratio=otherDelta/delta;
          if(ratio>=.7&&ratio<=1.3){candidate.add(keys[index]);candidate.add(keys[otherIndex]);}
        }
      }
    });
    return candidate;
  }
  function drawBubblePath(context,x,y,radius,shape){
    context.beginPath();
    if(shape==='rectangle'){
      const width=radius*2.15,height=radius*1.72,left=x-width/2,top=y-height/2;
      if(context.roundRect)context.roundRect(left,top,width,height,Math.max(3,radius*.28));
      else context.rect(left,top,width,height);
    }else if(shape==='diamond'){
      context.moveTo(x,y-radius*1.2);context.lineTo(x+radius*1.2,y);context.lineTo(x,y+radius*1.2);context.lineTo(x-radius*1.2,y);context.closePath();
    }else{
      context.arc(x,y,radius,0,Math.PI*2);
    }
  }
  function drawActivityZones(items,w,h,settings){
    const P=settings,bars=Array.isArray(agg)?agg:[];
    if(!P.zones||!items.length)return;
    ctx.save();ctx.beginPath();ctx.rect(0,0,w,h);ctx.clip();
    for(const item of items){
      if(item.metric<Math.max(0,num(P.zoneMinSize)||0))continue;
      const center=item.mappedPrice,pct=Math.max(.01,num(P.zoneHeightPct)||.2)/100;
      const low=center*(1-pct/2),high=center*(1+pct/2);
      let y1=null,y2=null;
      try{y1=cs.priceToCoordinate(high);y2=cs.priceToCoordinate(low)}catch{}
      if(!Number.isFinite(y1)||!Number.isFinite(y2))continue;
      let endX=w;
      if(P.zoneLengthCandles>0){
        try{const logicalEnd=item.candleIndex+P.zoneLengthCandles;const coord=ts.logicalToCoordinate(logicalEnd);if(Number.isFinite(coord))endX=Math.min(w,Math.max(item.x+2,coord));}catch{}
      }else if(bars.length&&Number.isFinite(item.candleIndex)){
        for(let index=Math.max(0,item.candleIndex+1);index<bars.length;index++){
          const bar=bars[index],barHigh=num(bar.high),barLow=num(bar.low);
          if(barHigh!==null&&barLow!==null&&barHigh>=low&&barLow<=high){
            try{const coord=ts.logicalToCoordinate(index+.5);if(Number.isFinite(coord))endX=Math.min(w,Math.max(item.x+2,coord));}catch{}
            break;
          }
        }
      }
      const top=Math.max(-2,Math.min(h,Math.min(y1,y2))),bottom=Math.max(-2,Math.min(h,Math.max(y1,y2)));
      const height=Math.max(2,bottom-top),width=Math.max(2,endX-item.x);
      if(width<=2)continue;
      ctx.globalAlpha=Math.max(.04,Math.min(.22,(num(P.bubbleOpacity)||.9)*.14));ctx.fillStyle=item.color;ctx.fillRect(item.x,top,width,height);
      ctx.globalAlpha=Math.max(.08,Math.min(.42,(num(P.bubbleOpacity)||.9)*.28));ctx.strokeStyle=item.color;ctx.lineWidth=.8;ctx.setLineDash([3,3]);ctx.strokeRect(item.x,top,width,height);ctx.setLineDash([]);
    }
    ctx.restore();
  }
  function drawFlowBubbles(w,h,indicator){
    const events=Array.isArray(XMAP.events)?XMAP.events:[];
    const sp=sourceSpot(),tp=targetSpot();
    if(!events.length||!(sp>0&&tp>0)){XMAP.visibleBubbles=[];return;}
    let timeScale=null;try{timeScale=chart.timeScale()}catch{XMAP.visibleBubbles=[];return;}
    const P=XMAP.settings,tf=Math.max(1,Number(C?.tf)||60),bars=Array.isArray(agg)?agg:[];
    const filtered=filterFlowEventData(events,P,bars,tf);
    if(!filtered.length){XMAP.visibleBubbles=[];return;}
    const recent=filtered.slice(-P.bubbleCount);
    const metricsBySession=new Map();
    for(const item of filtered){if(!metricsBySession.has(item.sessionKey))metricsBySession.set(item.sessionKey,[]);metricsBySession.get(item.sessionKey).push(item.metric);}
    const sessionScaleByKey=new Map([...metricsBySession].map(([key,values])=>[key,percentileThreshold(values,.05)||Math.max(1,...values)]));
    const absoluteScale=Math.max(1,num(P.source==='gld'?P.absoluteScaleMaxGld:P.absoluteScaleMaxQqq)||1000);
    const labelMode=P.bubbleLabelMode==='cp'?'cp':'volume';
    const shape=P.bubbleShape||'circle',glossy=P.bubbleStyle==='glossy';
    const callColor=indicator?.c?.[2]||'#35e59a',putColor=indicator?.c?.[3]||'#ff536b';
    const multiLegKeys=P.showRings&&P.showMultiLeg?possibleStructureEventKeys(events):new Set();
    const visible=[];
    for(const item of recent){
      const event=item.event,stamp=item.stamp,strike=num(event.strike);
      if(!(strike>0))continue;
      const logicalTime=flowEventLogicalTime(stamp/1000),candleIndex=item.candleIndex;
      const logical=P.horizontalPosition==='candle'?candleIndex:logicalTime;
      if(logical===null||!Number.isFinite(logical))continue;
      let x=null,y=null,mappedPrice=null;
      try{mappedPrice=tp*(strike/sp);x=ts.logicalToCoordinate(logical);y=cs.priceToCoordinate(mappedPrice)}catch{continue;}
      if(!Number.isFinite(x)||!Number.isFinite(y)||x<-60||x>w+60||y<-60||y>h+60)continue;
      const scaleBase=P.sizeScaling==='absolute'?absoluteScale:(sessionScaleByKey.get(item.sessionKey)||absoluteScale);
      const norm=Math.max(0,Math.min(1,item.metric/scaleBase));
      let diameter=10+28*Math.sqrt(norm);
      const sizeFactor=Math.max(.25,Math.min(4,num(P.sizeFactor)||1));
      diameter*=sizeFactor;
      const smallest=Math.max(0,num(P.minBubblePx)||0),biggest=Math.max(0,num(P.maxBubblePx)||0);
      if(smallest>0)diameter=Math.max(diameter,smallest);
      if(biggest>0)diameter=Math.min(diameter,biggest);
      if(smallest>0&&biggest>0&&biggest<smallest)diameter=biggest;
      const radius=Math.max(4,Math.min(50,diameter/2));
      const key=bubbleEventKey(event,events.indexOf(event)),isMulti=multiLegKeys.has(key);
      const large=item.largeThreshold!==null&&item.largeThreshold!==undefined&&item.metric>=item.largeThreshold;
      if(P.showRings&&isMulti&&!P.showMultiLeg)continue;
      if(P.showRings&&!isMulti&&!large&&!P.showUnlinked)continue;
      visible.push({...item,event,x,y,mappedPrice,logical,radius,side:item.side,color:item.side==='C'?callColor:putColor,isMulti,large,isUnlinked:!isMulti});
    }
    if(!visible.length){XMAP.visibleBubbles=[];return;}
    drawActivityZones(visible,w,h,P);
    ctx.save();ctx.textBaseline='middle';
    for(const item of visible){
      const isInterval=item.event.captureMode==='interval'||Number(item.event.gapMs)>5000;
      item.hitRadius=item.radius+9;
      const selected=XMAP.selectedTrade?.event;
      if(selected&&String(selected.optionSymbol||'')===String(item.event.optionSymbol||'')&&Number(selected.observedAt)===Number(item.event.observedAt)&&Number(selected.volumeDelta)===Number(item.event.volumeDelta)){
        ctx.save();ctx.globalAlpha=.98;ctx.strokeStyle='#f7fbff';ctx.lineWidth=2;drawBubblePath(ctx,item.x,item.y,item.radius+5,shape);ctx.stroke();ctx.restore();
      }
      ctx.save();ctx.globalAlpha=(num(P.bubbleOpacity)??.9)*(isInterval?.68:1);
      drawBubblePath(ctx,item.x,item.y,item.radius,shape);
      if(glossy&&typeof ctx.createRadialGradient==='function'){
        const gradient=ctx.createRadialGradient(item.x-item.radius*.35,item.y-item.radius*.4,item.radius*.05,item.x,item.y,item.radius*1.35);
        gradient.addColorStop(0,'rgba(255,255,255,.96)');gradient.addColorStop(.22,item.color);gradient.addColorStop(1,'rgba(4,12,22,.96)');ctx.fillStyle=gradient;
      }else ctx.fillStyle=item.color;
      ctx.fill();ctx.globalAlpha=Math.min(1,(num(P.bubbleOpacity)??.9)+.08);ctx.lineWidth=1.1;ctx.strokeStyle=glossy?'rgba(230,245,255,.78)':'rgba(5,12,20,.95)';ctx.stroke();
      if(glossy){ctx.globalAlpha=.48;ctx.fillStyle='#fff';ctx.beginPath();ctx.ellipse(item.x-item.radius*.28,item.y-item.radius*.32,Math.max(1,item.radius*.22),Math.max(1,item.radius*.13),-.45,0,Math.PI*2);ctx.fill();}
      ctx.restore();
      if(P.showRings){
        if(item.isMulti&&P.showMultiLeg){ctx.save();ctx.globalAlpha=.9;ctx.strokeStyle='#d5b5ff';ctx.lineWidth=1.7;ctx.setLineDash([4,3]);drawBubblePath(ctx,item.x,item.y,item.radius+4,shape);ctx.stroke();ctx.restore();}
        else if(item.isUnlinked&&P.showUnlinked){ctx.save();ctx.globalAlpha=.62;ctx.strokeStyle='rgba(204,220,235,.82)';ctx.lineWidth=1;ctx.setLineDash([1,3]);drawBubblePath(ctx,item.x,item.y,item.radius+3,shape);ctx.stroke();ctx.restore();}
        if(item.large&&P.showLargeEvents){ctx.save();ctx.globalAlpha=.96;ctx.strokeStyle='#f4f8ff';ctx.lineWidth=1.7;ctx.setLineDash([]);drawBubblePath(ctx,item.x,item.y,item.radius+6,shape);ctx.stroke();ctx.restore();}
      }
      const centerLabel=labelMode==='volume'?compact(item.delta):item.side;
      const centerFont=labelMode==='volume'?(centerLabel.length>=6?7:centerLabel.length>=5?7.5:centerLabel.length>=4?8:9):9;
      ctx.save();ctx.globalAlpha=1;ctx.font=`700 ${centerFont}px "Space Grotesk",sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=glossy?'#07111c':'#061018';ctx.fillText(centerLabel,item.x,item.y+.5);ctx.restore();
      const strikeLabel=Number.isInteger(item.event.strike)?String(item.event.strike):Number(item.event.strike).toFixed(2).replace(/0+$/,'').replace(/\.$/,'');
      const strikeText=`${isInterval?'~':''}${strikeLabel}`;
      const labelX=item.x>w-142?item.x-item.radius-5:item.x+item.radius+5;
      ctx.save();ctx.font='700 10px "Space Grotesk",sans-serif';ctx.textAlign=item.x>w-142?'right':'left';ctx.textBaseline='middle';ctx.fillStyle=item.color;ctx.fillText(strikeText,labelX,item.y-4);
      if(P.showPremiumOnBubble&&item.premium>0){
        const premiumText=`EST $${compact(item.premium)}`;ctx.font='600 8px "Space Grotesk",sans-serif';ctx.fillStyle='#d5e1eb';ctx.fillText(premiumText,labelX,item.y+8);
      }
      ctx.restore();
    }
    XMAP.visibleBubbles=visible;
    ctx.restore();
  }

  function drawTradePayoffOverlay(w,h){
    const trade=XMAP.selectedTrade,payoff=trade?.payoff,math=tradeMath();
    if(!payoff||!math||!Array.isArray(trade.legs)||!trade.legs.length)return;
    const sp=sourceSpot(),tp=targetSpot();if(!(sp>0&&tp>0))return;
    const stamp=timestampMs(trade.event?.observedAt),logical=stamp?flowEventLogicalTime(stamp/1000):null;
    let startX=logical===null?0:ts.logicalToCoordinate(logical);if(!Number.isFinite(startX))startX=0;startX=Math.max(0,Math.min(w-4,startX));
    ctx.save();ctx.beginPath();ctx.rect(0,0,w,h);ctx.clip();
    // Paint expiry P/L bands along the price axis, projected to the right of the selected flow event.
    const step=4;for(let y=0;y<h;y+=step){let targetPrice=null;try{targetPrice=cs.coordinateToPrice(y+step/2)}catch{}if(!(targetPrice>0))continue;
      const etfPrice=sp*(targetPrice/tp),pnl=math.payoffAt(trade.legs,etfPrice);if(!Number.isFinite(pnl)||Math.abs(pnl)<0.01)continue;
      ctx.fillStyle=pnl>0?'rgba(32,190,130,.115)':'rgba(236,75,105,.12)';ctx.fillRect(startX,y,w-startX,step+1);
    }
    // Anchor line at the event time.
    ctx.strokeStyle='rgba(231,241,250,.68)';ctx.lineWidth=1;ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(startX,0);ctx.lineTo(startX,h);ctx.stroke();ctx.setLineDash([]);
    const drawPayoffLine=(sourcePrice,label,color,dash=[7,4])=>{
      const targetPrice=mapStrike(sourcePrice,sp,tp),y=cs.priceToCoordinate(targetPrice);if(!Number.isFinite(y)||y<-20||y>h+20)return;
      ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.setLineDash(dash);ctx.beginPath();ctx.moveTo(startX,y);ctx.lineTo(w,y);ctx.stroke();ctx.setLineDash([]);
      ctx.font='700 9px "Space Grotesk",sans-serif';const text=`${label} ${fmt(targetPrice,2)}`,width=ctx.measureText(text).width+10,x=Math.max(startX+3,w-width-5);
      ctx.fillStyle='rgba(5,12,20,.86)';ctx.fillRect(x,y-9,width,17);ctx.fillStyle=color;ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillText(text,x+5,y);
    };
    (payoff.breakevens||[]).forEach((value,index)=>drawPayoffLine(value,`BREAKEVEN ${index+1}`,'#65dff0',[5,3]));
    for(const leg of trade.legs)drawPayoffLine(leg.strike,`${leg.side==='buy'?'BUY':'SELL'} ${leg.type}${fmt(leg.strike,2).replace(/\.00$/,'')}`,'rgba(185,205,224,.72)',[2,5]);
    // Compact chart-native summary tags, similar to the reference experience.
    const firstBE=payoff.breakevens?.[0],mappedBE=firstBE!==undefined?mapStrike(firstBE,sp,tp):null;
    const metrics=[
      ...(mappedBE!==null?[{text:`Breakeven ${fmt(mappedBE,2)}`,color:'#66dff0'}]:[]),
      {text:`Max profit ${payoff.unlimitedProfit?'Unlimited':'+'+tradeMoney(payoff.maxProfit)}`,color:'#55dca6'},
      {text:`Max loss ${payoff.unlimitedLoss?'Unlimited':'−'+tradeMoney(payoff.maxLoss)}`,color:'#ff7188'}
    ];
    ctx.font='700 9px "Space Grotesk",sans-serif';ctx.textBaseline='middle';let tagX=8;const tagY=Math.max(12,h-15);
    for(const metric of metrics){const tagW=ctx.measureText(metric.text).width+15;if(tagX+tagW>w-4)break;
      ctx.fillStyle='rgba(7,15,25,.9)';ctx.strokeStyle=metric.color;ctx.lineWidth=.8;ctx.beginPath();if(ctx.roundRect)ctx.roundRect(tagX,tagY-9,tagW,18,8);else ctx.rect(tagX,tagY-9,tagW,18);ctx.fill();ctx.stroke();
      ctx.fillStyle=metric.color;ctx.textAlign='left';ctx.fillText(metric.text,tagX+7,tagY+.5);tagX+=tagW+6;
    }
    ctx.restore();
  }

  function drawCrossAssetMap(w,h){
    if(XMAP.enabled&&(!XMAP.locked||(XMAP.locked.pendingCount>0&&sourceSpot()>0&&targetSpot()>0)))reconcileLevels();
    if(lastMetaSymbol!==C.sym){lastMetaSymbol=C.sym;updateMeta()}
    const a=activeIndicator();if(!XMAP.enabled||!activeOnChart(a)||!currentMatchesTarget())return;
    const P=XMAP.settings;
    // Flow bubbles are independent of the selected expiry snapshot: events cover every
    // expiry collected by the server and use event-time X + mapped strike-price Y.
    if(XMAP.selectedTrade)drawTradePayoffOverlay(w,h);
    if(P.bubbles)drawFlowBubbles(w,h,a);else XMAP.visibleBubbles=[];
    const s=XMAP.locked;
    if(!s||s.target!==pair())return;
    const rows=Array.isArray(s.dist)?s.dist.map(r=>({...r})).filter(r=>Number.isFinite(r.target)):[];
    const col=(i,fb)=>{const c=a?.c?.[i];return typeof c==='string'&&c?c:fb};
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
    if(P.gammaFlip&&s.gammaFlip?.target!=null){const price=s.gammaFlip.target;drawLine(cs.priceToCoordinate(price),col(6,'#43c7e8'),'GAMMA FLIP / ZERO GAMMA · BSM',price,w,h,1.8,[8,3]);}
    if(P.maxPain&&s.maxPain?.target!=null){const price=s.maxPain.target;drawLine(cs.priceToCoordinate(price),col(7,'#b68cff'),'MAX PAIN',price,w,h,1.6,[10,4,2,4]);}
    if(P.gexCount>0){
      const levels=Array.isArray(s.gexLevels)&&s.gexLevels.length?s.gexLevels:rankGexLevels(rows,10,excludedKeyLevelStrikes({callOIWall:s.callOIWall,putOIWall:s.putOIWall,gexCallWall:s.gexCallWall,gexPutWall:s.gexPutWall,maxPain:s.maxPain,gammaFlip:s.gammaFlip?.sourceLevel})).map((r,i)=>({rank:i+1,strike:r.strike,gex:r.gex}));
      levels.slice(0,P.gexCount).forEach((g,i)=>{const price=g.target;if(price==null)return;const color=(g.gex||0)>=0?col(0,'#35d59a'):col(1,'#ec557c');drawLine(cs.priceToCoordinate(price),color,`GEX ${g.rank||i+1}`,price,w,h,i<3?1.7:1.1,[3,4]);});
    }
    if(P.showSourceTag){
      ctx.save();ctx.font='600 10px "Space Grotesk",sans-serif';ctx.textAlign='left';ctx.textBaseline='top';
      const status=!s.complete?'PARTIAL CHAIN':!s.gexComplete?'FULL CHAIN · GEX INCOMPLETE':'FULL CHAIN';
      ctx.fillStyle='rgba(4,10,18,.76)';ctx.fillRect(8,8,Math.min(350,w-16),17);
      ctx.fillStyle='#a8d9e8';ctx.fillText(`${SOURCE_NAME[XMAP.source]} VOLUME FLOW → ${pair()} · ${XMAP.events.length} SAVED EVENTS · ${status}`,13,11);ctx.restore();
    }
  }
  window.drawCrossAssetMap=drawCrossAssetMap;
  bind();
  // The chart renderer runs after this file loads; sync again here so a saved active indicator
  // can establish its ETF option session without requiring the user to open the settings dialog.
  try{syncIndicator()}catch(e){console.warn('cross asset indicator initial sync',e)}
})();
