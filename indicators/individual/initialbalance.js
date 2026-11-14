/* Initial Balance — first N minutes of each configured server session. */
(function(){'use strict';
 const {I,line,fill,n}=window.ATASIndicatorRuntime,S=window.ATASSessionRuntime;
 const params=[['minutes','Độ dài Initial Balance (phút)',60,'i',{min:1,max:1440}],['sessionStartHour','Giờ bắt đầu phiên (server)',0,'i',{min:0,max:23}],['sessionStartMinute','Phút bắt đầu phiên',0,'i',{min:0,max:59}],['x1','Extension x1',1,'n',{min:0,step:.25}],['x2','Extension x2',2,'n',{min:0,step:.25}],['x3','Extension x3',3,'n',{min:0,step:.25}],['showExtensions','Hiện extensions',true,'b'],['showMid','Hiện midpoint',true,'b'],['showFill','Tô vùng Initial Balance',true,'b']];
 I('atas_initial_balance','Initial Balance','ov','IBH/IBL, midpoint và extensions x1/x2/x3 tính từ N phút đầu mỗi phiên server-time. Cần timeframe chart không lớn hơn cửa sổ IB; nếu không đủ độ phân giải module không vẽ output thay vì ước lượng sai.',params,['#43b6d5','#f0bd59','#9b7cdb','#d978b7'],['IB High','IB Low','IB Mid','IB Extensions'],(A,p)=>{
  const x=S.collect(A,p),N=A.c.length,ts=A.s||A.t||[],mins=Math.max(1,n(p.minutes,60))*60;
  const tf=typeof C!=='undefined'&&Number.isFinite(+C.tf)?+C.tf:0;
  // A bar wider than the IB window cannot reveal the first-N-minute extrema.
  if(tf>mins)return [];
  const vals=Array.from({length:9},()=>Array(N).fill(null)),fh=Array(N).fill(null),fl=Array(N).fill(null);
  x.groups.forEach(g=>{
   let h=-Infinity,l=Infinity,started=false,ibEnd=g.start+mins;
   for(const i of g.indices){const t=n(ts[i],NaN);if(!Number.isFinite(t))continue;
    if(t<ibEnd){h=Math.max(h,n(A.h[i]));l=Math.min(l,n(A.l[i]));started=true;fh[i]=h;fl[i]=l;}
    if(!started)continue;
    const mid=(h+l)/2,range=h-l;
    vals[0][i]=h;vals[1][i]=l;vals[2][i]=mid;
    vals[3][i]=h+range*n(p.x1,1);vals[4][i]=h+range*n(p.x2,2);vals[5][i]=h+range*n(p.x3,3);
    vals[6][i]=l-range*n(p.x1,1);vals[7][i]=l-range*n(p.x2,2);vals[8][i]=l-range*n(p.x3,3);
   }
  });
  const out=[line(vals[0],0,2),line(vals[1],1,2)];if(p.showMid!==false)out.push(line(vals[2],2,1));if(p.showExtensions!==false){for(let j=3;j<6;j++)out.push(line(vals[j],3,1));for(let j=6;j<9;j++)out.push(line(vals[j],3,1));}if(p.showFill!==false)out.push(fill(fh,fl,0,.08));return out;
 });
 window.ATASIndicatorFiles.initialbalance={id:'initialbalance',name:'Initial Balance',sourceClass:'InitialBalance',sourceFile:'Technical/InitialBalance.cs',group:'technical',requirement:'session',status:'ported',conversion:'approx_proxy',addKey:'atas_initial_balance',moduleFile:'indicators/individual/initialbalance.js',moduleType:'primary'};
})();
