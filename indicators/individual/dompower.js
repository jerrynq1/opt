/* DOM Power — current cTrader Level II snapshot; no fabricated historical depth. */
(function(){'use strict';
 const {I,line,hist,n}=window.ATASIndicatorRuntime;
 I('atas_dom_power_l2','DOM Power (cTrader Level II)','osc','Tổng size BID dương, ASK âm và Net DOM trong N mức giá tốt nhất. Tính theo snapshot Level II hiện tại và chỉ ghi tại bar mới nhất; historical DOM không được cTrader feed này cung cấp ngược thời gian.',[['levels','Số mức giá mỗi phía',5,'i',{min:1,max:100}]],['#26a987','#e56b75','#f0bd59'],['Bid depth','Ask depth','Net DOM'],(A,p)=>{
  const snap=window.atasDepthSnapshot?window.atasDepthSnapshot(Math.max(1,n(p.levels,5))):null;
  const b=Array(A.c.length).fill(null),a=Array(A.c.length).fill(null),d=Array(A.c.length).fill(null);if(!snap||!snap.available||!A.c.length)return [hist(b,0),hist(a,1),line(d,2)];
  const i=A.c.length-1;b[i]=snap.bidTotal;a[i]=-snap.askTotal;d[i]=snap.bidTotal-snap.askTotal;return [hist(b,0),hist(a,1),line(d,2)];
 });
 window.ATASIndicatorFiles.dompower={id:'dompower',name:'DOM Power (cTrader Level II)',sourceClass:'DomPower',sourceFile:'Technical/DomPower.cs',group:'orderflow',requirement:'depth',status:'ported',conversion:'approx_proxy',addKey:'atas_dom_power_l2',moduleFile:'indicators/individual/dompower.js',moduleType:'primary'};
})();
