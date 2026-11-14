/* Floor Pivot Points — previous server day/week/month, default ATAS HighLow formula. */
(function(){'use strict';
 const {I,line,n}=window.ATASIndicatorRuntime,S=window.ATASSessionRuntime;
 const params=[['period','Pivot range','day','s',{o:[['day','Daily (ATAS default)'],['week','Weekly'],['month','Monthly']]}],['sessionStartHour','Giờ bắt đầu phiên (server)',0,'i',{min:0,max:23}],['sessionStartMinute','Phút bắt đầu phiên',0,'i',{min:0,max:59}],['levels','Số tầng mỗi phía',3,'i',{min:1,max:3}],['showMidpoints','Hiện M1–M4',true,'b']];
 I('atas_pivots','Pivots','ov','Floor Pivots từ H/L/C của period trước. Default formula HighLow: R3/S3 = PP ± 2 × (H − L). Hỗ trợ Daily/Weekly/Monthly theo server calendar; không giả lập các period intraday ATAS.',params,['#f0bd59','#43b6d5','#8b83d8','#d978b7'],['PP','Resistance','Support','Midpoints'],(A,p)=>{
  const x=S.collectPeriods(A,p,p.period||'day'),N=A.c.length,lev=Math.max(1,Math.min(3,Math.round(n(p.levels,3))));
  const v=Array.from({length:11},()=>Array(N).fill(null));
  x.groups.forEach((g,gi)=>{const prev=x.groups[gi-1];if(!prev)return;
   const P=(prev.high+prev.low+prev.close)/3,range=prev.high-prev.low;
   const r1=2*P-prev.low,s1=2*P-prev.high,r2=P+range,s2=P-range,r3=P+2*range,s3=P-2*range;
   const levels=[P,r1,s1,r2,s2,r3,s3,(s1+s2)/2,(s1+P)/2,(r1+P)/2,(r1+r2)/2];
   for(const i of g.indices)for(let j=0;j<levels.length;j++)v[j][i]=levels[j];
  });
  const out=[line(v[0],0,2),line(v[1],1),line(v[2],2)];if(lev>=2)out.push(line(v[3],1),line(v[4],2));if(lev>=3)out.push(line(v[5],1),line(v[6],2));if(p.showMidpoints!==false)for(let i=7;i<11;i++)out.push(line(v[i],3,1));return out;
 });
 window.ATASIndicatorFiles.pivots={id:'pivots',name:'Pivots',sourceClass:'Pivots',sourceFile:'Technical/Pivots.cs',group:'technical',requirement:'session',status:'ported',conversion:'approx_proxy',addKey:'atas_pivots',moduleFile:'indicators/individual/pivots.js',moduleType:'primary'};
})();
