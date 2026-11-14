/* Order Book Alerts — Level II threshold marker based on broker depth quote sizes. */
(function(){'use strict';
 const {I,n}=window.ATASIndicatorRuntime;const {markerLine}=window.ATASQuoteTickRuntime;
 const params=[['levels','Số mức giá kiểm tra mỗi phía',20,'i',{min:1,max:100}],['minSize','Size tối thiểu mỗi mức',100,'n',{min:0,step:1}],['offsetMode','Cách giới hạn vùng giá','percent','s',{o:[['percent','Phần trăm'],['ticks','Số ticks']]}],['priceOffset','Khoảng cách tối đa',1,'n',{min:0,step:.1}],['side','Phía','both','s',{o:[['both','Bid + Ask'],['bid','Bid only'],['ask','Ask only']]}],['timeFilterEnabled','Bật lọc thời gian tồn tại',false,'b'],['timeFilterSec','Thời gian tồn tại tối thiểu (giây)',1,'n',{min:0,max:6,step:.1}],['cooldownSec','Cooldown marker (giây)',1,'n',{min:0,max:30,step:.1}]];
 const active=new Map();let activeSymbol='';
 I('atas_order_book_alerts_l2','Order Book Alerts (Level II)','ov','Tạo marker khi mức giá BID/ASK Level II có size vượt ngưỡng trong vùng giá. Hỗ trợ time filter/cooldown từ thời gian quote quan sát được. Không phải lệnh khớp, MBO exchange hay alert âm thanh ATAS.',params,['#26a987','#e56b75'],['Bid alert','Ask alert'],(A,p)=>{
  const snap=window.atasDepthSnapshot?window.atasDepthSnapshot(Math.max(1,n(p.levels,20))):null;
  if(!snap||!snap.available||!A.c.length)return [markerLine(A,[])];
  let symbol='';try{symbol=String(CT&&CT.sym?CT.sym.id:'')}catch{}
  if(symbol!==activeSymbol){active.clear();activeSymbol=symbol;}
  const now=Date.now(),mid=snap.mid>0?snap.mid:n(A.c[A.c.length-1]),mode=p.offsetMode||'percent';
  const step=(()=>{try{return 10**(-PDIG())}catch{return .0001}})();
  const span=Math.max(0,n(p.priceOffset,1))*(mode==='ticks'?step:mid/100),min=Math.max(0,n(p.minSize,100)),side=p.side||'both';
  const candidates=[];
  if(side!=='ask')for(const x of snap.bids||[])candidates.push({side:'bid',...x});
  if(side!=='bid')for(const x of snap.asks||[])candidates.push({side:'ask',...x});
  const alive=new Set(),marks=[],timeFilter=p.timeFilterEnabled===true?Math.max(0,n(p.timeFilterSec,1))*1000:0,cooldown=Math.max(0,n(p.cooldownSec,1))*1000;
  for(const x of candidates){
   if(!(x.size>=min)||!(x.price>0)||(span>0&&Math.abs(mid-x.price)>span))continue;
   const key=x.side+':'+x.price;alive.add(key);let st=active.get(key);if(!st){st={firstSeen:now,lastMarker:0};active.set(key,st);}
   if(now-st.firstSeen<timeFilter||now-st.lastMarker<cooldown)continue;
   marks.push({time:A.t[A.t.length-1],position:x.side==='bid'?'belowBar':'aboveBar',color:x.side==='bid'?'#26a987':'#e56b75',shape:x.side==='bid'?'arrowUp':'arrowDown',text:`${x.side.toUpperCase()} ${Math.round(x.size)}`});
   st.lastMarker=now;
  }
  for(const k of active.keys())if(!alive.has(k))active.delete(k);
  return [markerLine(A,marks.slice(0,8))];
 });
 window.ATASIndicatorFiles.orderbookalerts={id:'orderbookalerts',name:'Order Book Alerts (Level II)',sourceClass:'OrderBookAlerts',sourceFile:'Technical/OrderBookAlerts.cs',group:'orderflow',requirement:'depth',status:'ported',conversion:'approx_proxy',addKey:'atas_order_book_alerts_l2',moduleFile:'indicators/individual/orderbookalerts.js',moduleType:'primary'};
})();
