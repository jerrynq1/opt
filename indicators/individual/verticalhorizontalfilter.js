/* ATAS indicator module: Vertical Horizontal Filter | source: Technical/VerticalHorizontalFilter.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, line } = window.ATASIndicatorRuntime;
  const tick = window.ATASQuoteTickRuntime;
  const num = (v,d=0) => Number.isFinite(+v) ? +v : d;
  I('atas_vhf', 'Vertical Horizontal Filter', 'osc', 'VHF = (Highest − Lowest) / tổng biến động tuyệt đối của input. Mặc định dùng Volume/OHLCV; có thể chọn quote-event sources dưới dạng proxy.', [
    ['period','Period',10,'i',{min:1,max:1000}],
    ['source','Input source','volume','s',{o:[['volume','Candle Volume'],['ticks_quote','Quote Ticks (proxy)'],['ask_quote','Ask-side quote events (proxy)'],['bid_quote','Bid-side quote events (proxy)'],['open','Open'],['high','High'],['low','Low'],['close','Close'],['ohlc','OHLC Average'],['hlc','HLC Average'],['hl2','HL Average']]}]
  ], [C.a], ['VHF'], (A,p) => {
    let src;
    if (['ticks_quote','ask_quote','bid_quote'].includes(p.source)) {
      const s=tick.tickBars(A);
      src=s.map(x=>!x?null:p.source==='ticks_quote'?x.total:p.source==='ask_quote'?x.buy:x.sell);
    } else if (p.source==='open') src=A.o;
    else if (p.source==='high') src=A.h;
    else if (p.source==='low') src=A.l;
    else if (p.source==='close') src=A.c;
    else if (p.source==='ohlc') src=A.c.map((v,i)=>(A.o[i]+A.h[i]+A.l[i]+v)/4);
    else if (p.source==='hlc') src=A.c.map((v,i)=>(A.h[i]+A.l[i]+v)/3);
    else if (p.source==='hl2') src=A.c.map((v,i)=>(A.h[i]+A.l[i])/2);
    else src=A.v;
    const out=Array(src.length).fill(null), n=Math.max(1,Math.round(num(p.period,10)));
    for(let i=n-1;i<src.length;i++){
      const w=src.slice(i-n+1,i+1); if(w.some(v=>!Number.isFinite(v)))continue;
      let hi=-Infinity,lo=Infinity,sum=0; for(let j=0;j<w.length;j++){hi=Math.max(hi,w[j]);lo=Math.min(lo,w[j]);if(j)sum+=Math.abs(w[j]-w[j-1]);}
      if(sum>0)out[i]=(hi-lo)/sum;
    }
    return [line(out)];
  });
  window.ATASIndicatorFiles['verticalhorizontalfilter'] = { id:'verticalhorizontalfilter', name:'Vertical Horizontal Filter', sourceClass:'VerticalHorizontalFilter', sourceFile:'Technical/VerticalHorizontalFilter.cs', group:'technical', requirement:'ohlcv', status:'ported', conversion:'approx_proxy', addKey:'atas_vhf', moduleFile:'indicators/individual/verticalhorizontalfilter.js', moduleType:'primary' };
})();
