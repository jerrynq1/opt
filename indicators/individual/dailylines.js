/* Daily Lines — previous/current day, week or month OHLC levels. */
(function(){'use strict';
 const {I,line,n}=window.ATASIndicatorRuntime,S=window.ATASSessionRuntime;
 const params=[['period','Khoảng thời gian','previousDay','s',{o:[['previousDay','Previous Day (ATAS default)'],['currentDay','Current Day'],['previousWeek','Previous Week'],['currentWeek','Current Week'],['previousMonth','Previous Month'],['currentMonth','Current Month']]}],['sessionStartHour','Giờ bắt đầu phiên (server)',0,'i',{min:0,max:23}],['sessionStartMinute','Phút bắt đầu phiên',0,'i',{min:0,max:59}],['showOpen','Hiện Open',true,'b'],['showHigh','Hiện High',true,'b'],['showLow','Hiện Low',true,'b'],['showClose','Hiện Close',true,'b'],['showHalfGap','Hiện Half Gap',false,'b']];
 I('atas_daily_lines','Daily Lines','ov','Đường OHLC của Current/Previous Day, Week hoặc Month. Mặc định Previous Day như ATAS. Giá trị tính từ chart OHLCV và trục server-time QuantLab; chưa có lịch session/holiday riêng của từng exchange.',params,['#f0bd59','#43b6d5','#8b83d8','#d978b7','#9b9b9b'],['Open','High','Low','Close','Half Gap'],(A,p)=>{
  const period=p.period||'previousDay',unit=period.toLowerCase().includes('week')?'week':period.toLowerCase().includes('month')?'month':'day',current=period.startsWith('current');
  const x=S.collectPeriods(A,p,unit),N=A.c.length,arr=Array.from({length:5},()=>Array(N).fill(null));
  x.groups.forEach((g,gi)=>{
   const prev=x.groups[gi-1],src=current?g:prev;if(!src)return;
   let hi=-Infinity,lo=Infinity;
   for(const i of g.indices){hi=Math.max(hi,n(A.h[i]));lo=Math.min(lo,n(A.l[i]));
    arr[0][i]=src.open;arr[1][i]=current?hi:src.high;arr[2][i]=current?lo:src.low;arr[3][i]=current?n(A.c[i]):src.close;
    if(prev)arr[4][i]=(g.open+prev.close)/2;
   }
  });
  const out=[];if(p.showOpen!==false)out.push(line(arr[0],0,2));if(p.showHigh!==false)out.push(line(arr[1],1,2));if(p.showLow!==false)out.push(line(arr[2],2,2));if(p.showClose!==false)out.push(line(arr[3],3,2));if(p.showHalfGap===true)out.push(line(arr[4],4,1));return out;
 });
 window.ATASIndicatorFiles.dailylines={id:'dailylines',name:'Daily Lines',sourceClass:'DailyLines',sourceFile:'Technical/DailyLines.cs',group:'technical',requirement:'session',status:'ported',conversion:'approx_proxy',addKey:'atas_daily_lines',moduleFile:'indicators/individual/dailylines.js',moduleType:'primary'};
})();
