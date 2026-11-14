/* ATAS indicator module: Stacked Imbalance (quote footprint adaptation) | source: Technical/StackedImbalance.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { K, I, tickBars, inferredStep, tickNote, num, line } = window.ATASQuoteTickRuntime;
  I('atas_stacked_imbalance_quote_fp', 'Stacked Imbalance (quote footprint proxy)', 'ov', `${tickNote} Ask imbalance so sánh buy events level trên với sell events level dưới; Bid imbalance làm ngược lại. Chỉ dùng các level kề nhau theo tick size.`, [
    ['ratio','Imbalance ratio (%)',300,'i',{min:100,max:2000}],
    ['minEvents','Quote events tối thiểu mỗi level',2,'i',{min:1,max:1000}],
    ['stack','Số level imbalance liên tiếp',3,'i',{min:2,max:20}],
    ['tickStep','Tick size (0 = theo symbol)',0,'n',{min:0,step:.00001}],
    ['ignoreZero','Bỏ qua mức đối ứng bằng 0',true,'b']
  ], [K.buy,K.sell], ['Stacked Ask', 'Stacked Bid'], (A,p) => {
    const stats=tickBars(A), step=inferredStep(p), ratio=Math.max(1,num(p.ratio,300))/100, min=Math.max(1,num(p.minEvents,2)), need=Math.max(2,Math.round(num(p.stack,3)));
    const askOut=Array(A.c.length).fill(null), bidOut=Array(A.c.length).fill(null);
    function strongestRun(flags, prices, scores) {
      let best=null, run=[];
      const finish=()=>{ if(run.length>=need){ const score=run.reduce((s,k)=>s+scores[k],0); if(!best||score>best.score)best={score,price:run.reduce((s,k)=>s+prices[k],0)/run.length}; } run=[]; };
      for(let i=0;i<flags.length;i++){ if(flags[i])run.push(i); else finish(); } finish(); return best&&best.price;
    }
    for(let i=0;i<stats.length;i++){
      const x=stats[i]; if(!x||!x.levels.length)continue;
      const lv=x.levels, askFlags=[],bidFlags=[], askPx=[],bidPx=[],askScore=[],bidScore=[];
      for(let j=0;j<lv.length-1;j++){
        const low=lv[j], high=lv[j+1], adjacent=Math.abs((high.p-low.p)-step)<=Math.max(step*.25,1e-8);
        const askOpp=low.sell, bidOpp=high.buy;
        const askOK=adjacent && high.buy>=min && high.buy>askOpp*ratio && (!p.ignoreZero || askOpp>0);
        const bidOK=adjacent && low.sell>=min && low.sell>bidOpp*ratio && (!p.ignoreZero || bidOpp>0);
        askFlags.push(askOK); askPx.push(high.p); askScore.push(high.buy);
        bidFlags.push(bidOK); bidPx.push(low.p); bidScore.push(low.sell);
      }
      askOut[i]=strongestRun(askFlags,askPx,askScore); bidOut[i]=strongestRun(bidFlags,bidPx,bidScore);
    }
    return [line(askOut,0,2),line(bidOut,1,2)];
  });
  window.ATASIndicatorFiles['stackedimbalance'] = { id:'stackedimbalance', name:'Stacked Imbalance', sourceClass:'StackedImbalance', sourceFile:'Technical/StackedImbalance.cs', group:'orderflow', requirement:'quote_footprint', status:'ported_tick', conversion:'quote_tick_proxy', addKey:'atas_stacked_imbalance_quote_fp', moduleFile:'indicators/individual/stackedimbalance.js', moduleType:'primary' };
})();
