/* Open Line — session open, optional stop on first touch. */
(function(){'use strict';
 const {I,line,n}=window.ATASIndicatorRuntime,S=window.ATASSessionRuntime;
 const params=[['sessionStartHour','Giờ bắt đầu phiên (server)',9,'i',{min:0,max:23}],['sessionStartMinute','Phút bắt đầu phiên',0,'i',{min:0,max:59}],['days','Số phiên giữ lại',5,'i',{min:1,max:1000}],['tillTouch','Kết thúc line khi giá chạm Open',false,'b']];
 I('atas_open_line','Open Line','ov','Giữ đường Open của từng phiên server-time. Có thể giới hạn số phiên và dừng line tại candle chạm mức Open; không dùng exchange calendar riêng.',params,['#f0bd59'],['Session Open'],(A,p)=>{
  const x=S.currentAndPrevious(A,p),N=A.c.length,out=Array(N).fill(null),take=Math.max(1,n(p.days,5)),start=Math.max(0,x.groups.length-take);
  x.groups.forEach((g,gi)=>{if(gi<start)return;let end=g.indices.length;
   if(p.tillTouch===true){for(let j=1;j<g.indices.length;j++){const i=g.indices[j],o=g.open;if(n(A.l[i])<=o&&n(A.h[i])>=o){end=j+1;break;}}}
   for(let j=0;j<end;j++)out[g.indices[j]]=g.open;
  });return [line(out,0,2)];
 });
 window.ATASIndicatorFiles.openline={id:'openline',name:'Open Line',sourceClass:'OpenLine',sourceFile:'Technical/OpenLine.cs',group:'technical',requirement:'session',status:'ported',conversion:'approx_proxy',addKey:'atas_open_line',moduleFile:'indicators/individual/openline.js',moduleType:'primary'};
})();
