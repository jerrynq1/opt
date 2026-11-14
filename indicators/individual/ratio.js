/* ATAS indicator module: Ratio (quote footprint adaptation) | source: Technical/Ratio.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { K, I, tickBars, inferredStep, markerLine, tickNote, num } = window.ATASQuoteTickRuntime;
  I('atas_ratio_quote_fp', 'Ratio (quote footprint proxy)', 'ov', `${tickNote} Nến tăng: sell-side events ở level Low+1 tick / Low; nến giảm: buy-side events ở High−1 tick / High. ATAS dùng Bid/Ask trade volume at price.`, [
    ['tickStep','Tick size (0 = theo symbol)',0,'n',{min:0,step:.00001}],
    ['minBaseEvents','Events tối thiểu ở level gốc',1,'i',{min:1,max:1000}]
  ], [K.buy,K.sell], ['Bull ratio', 'Bear ratio'], (A,p) => {
    const stats=tickBars(A), step=inferredStep(p), min=Math.max(1,num(p.minBaseEvents,1)), marks=[];
    for(let i=0;i<stats.length;i++){
      const x=stats[i]; if(!x||x.levels.length<2)continue;
      const lv=x.levels;
      if(A.c[i]>A.o[i]){
        const a=lv[0], b=lv.find(z=>Math.abs((z.p-a.p)-step)<=Math.max(step*.25,1e-8));
        if(a&&b&&a.sell>=min){const r=b.sell/a.sell;if(Number.isFinite(r)&&r>0)marks.push({time:A.t[i],position:'belowBar',color:K.buy,shape:'circle',text:`Call ${r.toFixed(2)}`});}
      }else if(A.c[i]<A.o[i]){
        const a=lv[lv.length-1], b=lv.slice(0,-1).reverse().find(z=>Math.abs((a.p-z.p)-step)<=Math.max(step*.25,1e-8));
        if(a&&b&&a.buy>=min){const r=b.buy/a.buy;if(Number.isFinite(r)&&r>0)marks.push({time:A.t[i],position:'aboveBar',color:K.sell,shape:'circle',text:`Put ${r.toFixed(2)}`});}
      }
    }
    return [markerLine(A,marks)];
  });
  window.ATASIndicatorFiles['ratio'] = { id:'ratio', name:'Ratio', sourceClass:'Ratio', sourceFile:'Technical/Ratio.cs', group:'orderflow', requirement:'quote_footprint', status:'ported_tick', conversion:'quote_tick_proxy', addKey:'atas_ratio_quote_fp', moduleFile:'indicators/individual/ratio.js', moduleType:'primary' };
})();
