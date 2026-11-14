/* Daily Change — source default is change from previous session close. */
(function(){'use strict';
 const {I,hist,n}=window.ATASIndicatorRuntime, S=window.ATASSessionRuntime;
 const params=[['mode','Mốc so sánh','previous','s',{o:[['previous','Đóng cửa phiên trước (ATAS default)'],['open','Giá mở phiên hiện tại']]}],['format','Đơn vị','percent','s',{o:[['percent','Phần trăm'],['price','Giá'],['ticks','Ticks']]}],['sessionStartHour','Giờ bắt đầu phiên (server)',0,'i',{min:0,max:23}],['sessionStartMinute','Phút bắt đầu phiên',0,'i',{min:0,max:59}],['tickSize','Tick size (0 = tự lấy)',0,'n',{min:0,step:.00001}]];
 I('atas_daily_change','Daily Change','osc','Thay đổi so với đóng cửa phiên trước (mặc định ATAS) hoặc open phiên hiện tại. Phiên được nhóm theo trục server-time của QuantLab; không tự áp lịch nghỉ/holiday của broker.',params,['#43b6d5'],['Daily Change'],(A,p)=>{
  const x=S.currentAndPrevious(A,p),out=Array(A.c.length).fill(null);let step=n(p.tickSize,0);
  if(!(step>0)){try{step=10**(-Math.max(0,Math.min(8,PDIG())))}catch{step=.0001}}
  x.groups.forEach((g,gi)=>{const prev=x.groups[gi-1],mode=p.mode||'previous',base=mode==='previous'?(prev?prev.close:null):g.open;if(!(base>0))return;
   for(const i of g.indices){const d=n(A.c[i])-base;out[i]=p.format==='price'?d:p.format==='ticks'?d/step:d/base*100;}});
  return [hist(out)];
 });
 window.ATASIndicatorFiles.dailychange={id:'dailychange',name:'Daily Change',sourceClass:'DailyChange',sourceFile:'Technical/DailyChange.cs',group:'technical',requirement:'session',status:'ported',conversion:'approx_proxy',addKey:'atas_daily_change',moduleFile:'indicators/individual/dailychange.js',moduleType:'primary'};
})();
