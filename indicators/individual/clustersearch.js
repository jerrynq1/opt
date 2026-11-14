/* ATAS indicator module: Cluster Search (quote footprint adaptation) | source: Technical/ClusterSearch.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { K, I, tickBars, inferredStep, tickNote, num, line } = window.ATASQuoteTickRuntime;
  I('atas_cluster_search_quote_fp', 'Cluster Search (quote footprint proxy)', 'ov', `${tickNote} Tìm price-level cluster có hoạt động quote lớn nhất theo Total/Buy/Sell/Absolute Delta. Bản này vẽ mức giá cluster tiêu biểu; không thay thế các price-selection rectangles/filters và trade-volume metrics của ATAS.`, [
    ['metric','Cluster metric','total','s',{o:[['total','Total quote events'],['buy','Buy-side quote events'],['sell','Bid-side quote events'],['delta','Absolute quote delta']]}],
    ['minEvents','Tối thiểu events',3,'i',{min:1,max:10000}],
    ['minPercent','Tỷ trọng tối thiểu (%)',0,'n',{min:0,max:100,step:.5}],
    ['barRange','Số nến gộp',1,'i',{min:1,max:30}],
    ['tickStep','Tick size (0 = theo symbol)',0,'n',{min:0,step:.00001}]
  ], [K.purple], ['Cluster price'], (A,p) => {
    const stats=tickBars(A), out=Array(A.c.length).fill(null), step=inferredStep(p), range=Math.max(1,Math.round(num(p.barRange,1)));
    for(let i=0;i<stats.length;i++){
      const levels=new Map(); let total=0;
      for(let b=Math.max(0,i-range+1);b<=i;b++){
        const x=stats[b]; if(!x)continue; total+=x.total;
        for(const z of x.levels){ const key=Math.round(z.p/step), old=levels.get(key)||{p:key*step,buy:0,sell:0}; old.buy+=z.buy; old.sell+=z.sell; levels.set(key,old); }
      }
      let best=null, bestValue=-Infinity;
      for(const z of levels.values()){
        const value=p.metric==='buy'?z.buy:p.metric==='sell'?z.sell:p.metric==='delta'?Math.abs(z.buy-z.sell):z.buy+z.sell;
        const share=total>0?100*(z.buy+z.sell)/total:0;
        if(value<num(p.minEvents)||share<num(p.minPercent))continue;
        if(value>bestValue){bestValue=value;best=z;}
      }
      if(best)out[i]=best.p;
    }
    return [line(out,0,2)];
  });
  window.ATASIndicatorFiles['clustersearch'] = { id:'clustersearch', name:'Cluster Search', sourceClass:'ClusterSearch', sourceFile:'Technical/ClusterSearch.cs', group:'orderflow', requirement:'quote_footprint', status:'ported_tick', conversion:'quote_tick_proxy', addKey:'atas_cluster_search_quote_fp', moduleFile:'indicators/individual/clustersearch.js', moduleType:'primary' };
})();
