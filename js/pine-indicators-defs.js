/* ===== User-supplied Pine Script v6 ports: Market Models =====
   These definitions are shown in Kho Indicator. Calculations and canvas rendering
   live in market-model-indicators.js. Original Pine names/options are retained
   where practical; source credits/licence notes are preserved in that module.
*/
(function(){
  'use strict';
  const ov=()=>[];
  const add=(key,d)=>{if(!IND[key])IND[key]=d};
  const sel=(key,label,def,options,g,extra={})=>[key,label,def,'s',{g,o:options,...extra}];
  const num=(key,label,def,g,min=0,step=1,max,extra={})=>[key,label,def,'n',{g,min,step,...(max==null?{}:{max}),...extra}];
  const int=(key,label,def,g,min=1,max,extra={})=>[key,label,def,'i',{g,min,max,...extra}];
  const bool=(key,label,def,g,extra={})=>[key,label,def,'b',{g,...extra}];
  const text=(key,label,def,g,extra={})=>[key,label,def,'t',{g,...extra}];
  const display=[['Minimal','Gọn'],['Full','Đầy đủ']];
  const look=[['1 Day','1 ngày'],['1 Week','1 tuần'],['1 Month','1 tháng'],['Max','Tất cả']];
  const styles=[['Dotted','Chấm'],['Dashed','Đứt'],['Solid','Liền']];
  const sizes=[['Tiny','Rất nhỏ'],['Small','Nhỏ'],['Normal','Vừa'],['Large','Lớn'],['Huge','Rất lớn']];

  add('crtSoup',{
    n:'CRT Turtle Soup+',t:'mm',ver:1,d:'CRT Turtle Soup+ · port từ Pine Script v6. Theo dõi nến CRT HTF, sweep high/low, CISD và xác nhận đóng cửa quay lại range; hiển thị entry, SL, TP1/TP2 và A-grade.',
    p:[
      sel('crtTf','CRT timeframe','3600',[['1800','30 phút'],['3600','1 giờ'],['7200','2 giờ'],['14400','4 giờ'],['21600','6 giờ'],['28800','8 giờ'],['43200','12 giờ'],['86400','1 ngày']],'Model',{mn:1}),
      bool('useLong','Longs',true,'Model'),bool('useShort','Shorts',true,'Model'),
      int('bufTicks','Stop buffer (ticks)',2,'Risk',0,100),num('maxStop','Max stop (points)',0,'Risk',0,.1,100000),num('minRR','Min R to far side',1.5,'Risk',.5,.25,20),num('riskUsd','Risk ($)',350,'Risk',1,1,1000000,{tt:'Giữ tham số từ Pine gốc; bản port hiện chưa tự tính số hợp đồng vì chưa có point value / contract sizing đáng tin cậy cho mọi symbol cTrader.'}),int('maxTrades','Max trades per day',3,'Risk',1,10),bool('beAfter','Move stop to BE once TP1 hits',true,'Risk'),bool('delOut','Delete stopped-out setups',true,'Risk'),
      bool('limitWin','Limit to window',false,'Window'),text('win','Window (NY)','0200-1600','Window'),
      sel('disp','Display','Minimal',display,'Display',{mn:1}),bool('showPend','Pending setup preview',false,'Display'),bool('aMark','Mark A-grade',true,'Display'),int('maxVis','Max visible',10,'Display',1,50),int('extMin','Entry extension (minutes)',15,'Display',0,120),
      sel('lineStyle','Level style','Dotted',styles,'Level style'),int('lvW','Level width',1,'Level style',1,4),
      int('eWidth','Entry width',2,'Entry style',1,4),sel('eSize','Entry label size','Tiny',sizes,'Entry style'),sel('lvSize','Level label size','Tiny',sizes,'Level style')
    ],c:['#2962FF','#F23645','#FF9800','#000000'],L:['Long','Short','Break-even','CRT levels'],f:ov
  });

  add('ssmtPlus',{
    n:'SSMT+',t:'mm',ver:1,d:'Smart Money Technique · divergence giữa chart hiện tại và một mã tương quan trên Micro 22.5m, 90m, Daily quarter, Weekly và Monthly. Cần feed lịch sử mã đối chiếu từ cTrader.',
    p:[
      sel('pairMode','Pair mode','Auto',[['Auto','Tự động'],['Manual','Thủ công']],'Correlated Symbol',{mn:1}),
      text('pairSymbol','Manual symbol','US500','Correlated Symbol',{tt:'Tên symbol phải tồn tại trong danh sách mã của tài khoản cTrader. Có thể nhập ES, US500, SPX500… tùy broker.'}),
      bool('showMicro','Micro (22.5m)',false,'Cycles'),bool('show90','90-Minute',true,'Cycles'),bool('showDaily','Daily',true,'Cycles'),
      bool('showQ1','Q1',true,'Daily quarters'),bool('showQ2','Q2',true,'Daily quarters'),bool('showQ3','Q3',true,'Daily quarters'),bool('showQ4','Q4',true,'Daily quarters'),
      bool('showWeek','Weekly',true,'Cycles'),bool('showMonth','Monthly',true,'Cycles'),
      int('maxShown','Max visible',20,'Display',1,100),sel('lookback','Lookback Period','1 Week',look,'Display'),sel('lineStyle','Line style','Dotted',styles,'Display'),sel('labelSize','Label size','Small',sizes.slice(0,4),'Display'),
      bool('boxDaily','Daily quarter boxes',false,'Boxes'),bool('box90m','90m boxes',false,'Boxes')
    ],c:['#f4c15d'],L:['SSMT lines'],f:ov
  });

  add('sdRangePlus',{
    n:'SDRange+',t:'mm',ver:1,d:'Session Deviation Range+ · dựng high/low/open của range New York, EQ/25–75, projection theo bội số range, vùng deviation và liquidity pivots của các phiên tùy chọn.',
    p:[
      text('rngSess','Range session (NY)','0600-0900','Range',{mn:1}),int('shown','Ranges shown',1,'Range',1,10),int('pastHour','Older ranges end (hour)',17,'Range',10,23),int('extBars','Extend right (bars)',8,'Range',1,50),
      text('projStr','Projections','0.5 1 2 2.5','Projections'),bool('zoneOn','Shaded zone',true,'Projections'),num('zoneA','Zone lower multiple',1.33,'Projections',.1,.01,10),num('zoneB','Zone upper multiple',1.66,'Projections',.1,.01,10),text('pzStr','Zone lines','0.1 0.2 0.3','Projections'),
      bool('showHL','High / low',true,'Levels'),bool('showMid','50%',true,'Levels'),bool('showQuart','25% / 75%',true,'Levels'),bool('showOpen','Range open',false,'Levels'),bool('showProj','Projections',true,'Levels'),bool('showPz','Zone lines',true,'Levels'),bool('showVline','Range end line',true,'Levels'),
      bool('pvOn1','Session 1 pivots',false,'Liquidity map'),text('pvSess1','Session 1 (NY)','2000-0000','Liquidity map'),bool('pvOn2','Session 2 pivots',false,'Liquidity map'),text('pvSess2','Session 2 (NY)','0200-0500','Liquidity map'),text('pvName1','Session 1 name','Asia','Liquidity map'),text('pvName2','Session 2 name','London','Liquidity map'),int('pvBack','Sessions back',3,'Liquidity map',1,10),bool('pvKeep','Keep swept pivots',true,'Liquidity map'),
      bool('showLabels','Labels',true,'Style'),bool('showPrices','Prices',false,'Style'),int('hlWidth','High / low width',2,'Style',1,5),sel('textSize','Text size','Small',sizes.slice(0,4),'Style'),bool('monoFont','Monospace labels',true,'Style'),sel('tableSize','Table text','Normal',sizes.slice(0,4),'Style'),bool('showTable','Table',true,'Style'),sel('tableSpot','Table position','Bottom Center',[['Top Right','Top right'],['Bottom Right','Bottom right'],['Top Left','Top left'],['Bottom Left','Bottom left'],['Bottom Center','Bottom center'],['Top Center','Top center']],'Style')
    ],c:['#131722','#2E7D32','#E24B4B','#000000','#26A65B','#6F8F78','#F23645','#787B86','#089981'],L:['High / low','50%','25 / 75','Projections','Zone border','Zone fill','Zone lines','Session 1 pivots','Session 2 pivots'],f:ov
  });

  add('wyckoffPlus',{
    n:'Wyckoff+',t:'mm',ver:1,d:'Wyckoff+ · nhận diện climax, automatic rally/reaction, secondary test, spring/UTAD hoặc sweep/volume trigger; quản lý entry, SL, BE, TP và range ACC/DIST.',
    p:[
      sel('mode','Version','Spring',[['Spring','Spring'],['Sweep','Sweep'],['Volume','Volume']],'Setup',{mn:1}),sel('preset','Rules','Core',[['Core','Core'],['Filtered','Filtered']],'Setup'),sel('dirMode','Direction','Both',[['Both','Both'],['Long','Long'],['Short','Short']],'Setup'),
      int('swingLen','Swing strength (bars)',5,'Setup',2,20),int('trendMin','Markdown lookback (minutes)',240,'Setup',15,10000),num('depthAtr','Markdown depth (ATR)',3,'Setup',.5,.5,30),int('atrLen','ATR length',14,'Setup',2,100),num('minH','Range min height (ATR)',2,'Setup',.5,.5,30),num('maxH','Range max height (ATR)',12,'Setup',1,1,100),num('stTol','Retest tolerance (ATR)',.5,'Setup',.1,.1,10),num('rngHours','Range expires (hours)',48,'Setup',1,1,720),int('winMin','Recovery window (minutes)',120,'Setup',5,5,10000),
      sel('springVol','Break candle volume','Low volume',[['Low volume','Low volume'],['Any','Any']],'Volume'),sel('trigger','Trigger','Intent candle',[['Intent candle','Intent candle'],['Test then intent','Test then intent']],'Volume'),int('volLen','Volume average length',20,'Volume',2,200),num('lowVol','Low volume (x average)',.8,'Volume',.1,.1,10),num('highVol','High volume (x average)',1,'Volume',.5,.1,20),num('wideAtr','Wide candle (ATR)',1.2,'Volume',.3,.1,10),num('medAtr','Medium candle (ATR)',.8,'Volume',.2,.1,10),num('narrowAtr','Narrow candle (ATR)',.7,'Volume',.1,.1,10),num('climaxAtr','Climax candle (ATR)',1.5,'Volume',.5,.1,10),num('climaxVol','Climax volume (x average)',1.5,'Volume',.5,.1,20),
      sel('sosSrc','Break level','Range high',[['Range high','Range high'],['Swing high','Swing high']],'Sweep'),int('sosMin','Break window (minutes)',480,'Sweep',5,10000),sel('entryAt','Entry at','Zone top',[['Zone top','Zone top'],['Zone midpoint','Zone midpoint']],'Sweep'),sel('stopAt','Stop at','Sweep low',[['Sweep low','Sweep low'],['Zone low','Zone low']],'Sweep'),int('pullMin','Limit expires (minutes)',240,'Sweep',5,10000),bool('zoneExit','Exit on close through zone',true,'Sweep'),
      int('bufTicks','Stop buffer (ticks)',2,'Entry and exit',0,50),num('fixedR','Second target (R)',2,'Entry and exit',.5,.5,20),num('minR','Min first target (R)',1,'Entry and exit',.5,.5,20),bool('useBE','Stop to entry',true,'Entry and exit'),num('beR','BE trigger (R)',1,'Entry and exit',.1,.1,10),bool('showBeLine','BE marker',true,'Entry and exit'),num('maxHold','Trade expires (hours)',24,'Entry and exit',1,1,720),num('riskPerTrade','Risk per trade ($)',300,'Entry and exit',1,1,1000000,{tt:'Giữ tham số từ Pine gốc; bản port hiện chưa tự tính khối lượng hợp đồng vì point value khác nhau theo broker và symbol.'}),bool('showSizing','Sizing on entry label',false,'Entry and exit'),
      int('minRangeMin','Min range time (minutes)',60,'Filtered',0,5,10000),num('maxSweepAtr','Max sweep depth (ATR)',3,'Filtered',.5,.5,30),
      sel('viewMode','View','Minimal',[['Minimal','Minimal'],['Full','Full'],['Entries only','Entries only']],'Display',{mn:1}),bool('showRange','Range',true,'Display'),bool('showEvents','Stage labels',true,'Display'),bool('showPending','Pending setups',true,'Display'),sel('sltpText','SL and TP text','Off',[['Off','Off'],['R only','R only'],['Price','Price']],'Display'),bool('delStopped','Delete stopped setups',true,'Display'),bool('showPrices','Prices',true,'Display'),bool('showLabels','Labels',true,'Display'),int('pastSetups','Past setups shown',6,'Display',1,20),sel('lookback','Lookback','Max',look,'Display'),sel('textSize','Text size','Small',sizes.slice(0,4),'Display'),sel('tableSize','Table text','Normal',sizes.slice(0,4),'Display'),bool('showTable','Table',true,'Display'),sel('tableSpot','Table position','Top Right',[['Top Right','Top right'],['Bottom Right','Bottom right'],['Top Left','Top left'],['Bottom Left','Bottom left']],'Display')
    ],c:['#2962FF','#F23645','#FF9800','#787B86','#787B86'],L:['Long','Short','Break-even','Range fill','Range text'],f:ov
  });

  add('po3Plus',{
    n:'PO3 Plus',t:'mm',ver:1,d:'Power of Three · tìm accumulation range trong PO3 candle, đợi manipulation sweep, close quay lại range rồi xác nhận IFVG inversion hoặc retest; quản lý entry, SL và các target.',
    p:[
      sel('po3Tf','PO3 timeframe','4H',[['30m','30m'],['1H','1H'],['4H','4H'],['Daily','Daily'],['Weekly','Weekly']],'PO3',{mn:1}),bool('po3Gate','Sweep must pass the PO3 open',true,'PO3'),
      sel('entryMode','Entry','Inversion',[['Inversion','Inversion'],['Retest','Retest'],['Either','Either']],'Setup'),sel('targetMode','Target','2R',[['2R','2R'],['Prior liquidity','Prior liquidity'],['SD projection','SD projection']],'Setup'),num('rr','R multiple',2,'Setup',.5,.5,20),
      int('rangeMin','Range min bars',8,'Range',3,60),int('rangeMax','Range max bars',60,'Range',10,200),num('rangeAtr','Range height max (ATR)',5,'Range',1,.5,30),int('driftPct','Range max drift %',50,'Range',10,100),num('dispAtr','Return body min (ATR)',.8,'Range',0,.1,10),int('manipMin','Manipulation expiry (min)',30,'Range',1,10000),int('entryWin','Entry window (min)',60,'Range',1,10000),int('legStrength','Swing bars each side',3,'Range',1,10),
      bool('useBE','Stop to entry after TP1',false,'Risk'),num('riskPerTrade','Risk per trade ($)',300,'Risk',1,1,1000000,{tt:'Giữ tham số từ Pine gốc; bản port hiện chưa tự tính khối lượng hợp đồng vì point value khác nhau theo broker và symbol.'}),int('tfLimit','Timeframe limit (min)',15,'Display',1,240),
      sel('viewMode','View','Minimal',display,'Display',{mn:1}),bool('showFrame','Candle frame',true,'Display'),bool('showOpen','PO3 open',true,'Display'),bool('showBoxes','Stage boxes',true,'Display'),bool('showLeg','Manipulation leg',true,'Display'),bool('showTrades','Entries',true,'Display'),bool('showProj','SD projection',false,'Display'),bool('showPending','Pending setups',true,'Display'),bool('showPrices','Prices',false,'Display'),bool('showLabels','Labels',true,'Display'),int('framesKept','Candles kept',3,'Display',1,10),int('maxSetups','Setups kept',4,'Display',1,20),sel('textSize','Text','Small',sizes,'Display'),sel('tableSize','Table text','Normal',sizes.slice(0,4),'Display'),bool('showTable','Table',true,'Display'),sel('tableSpot','Table position','Top Left',[['Top Right','Top right'],['Bottom Right','Bottom right'],['Top Left','Top left'],['Bottom Left','Bottom left']],'Display')
    ],c:['#2962FF','#F23645','#FF9800','#4CAF50','#F23645','#2962FF','#787B86','#F23645','#787B86'],L:['Long','Short','Break-even','Accumulation','Manipulation','Distribution','Gaps and SD','Manipulation leg','Candle frame'],f:ov
  });
})();

// Simple Workspace policy: chỉ cung cấp indicator thuộc Orderflow và Market Model.
for (const key of Object.keys(IND)) {
  if (!['of', 'mm'].includes(IND[key]?.t)) delete IND[key];
}
