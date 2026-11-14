/* ATAS indicator module: Bars Pattern (quote footprint adaptation) | source: Technical/BarsPattern.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { K, I, tickBars, markerLine, tickNote, num } = window.ATASQuoteTickRuntime;
  I('atas_bars_pattern_quote_fp', 'Bars Pattern (quote footprint proxy)', 'ov', `${tickNote} Kiểm tra hướng nến và candle volume; có thể bật thêm các bộ lọc quote-footprint (proxy) theo nhu cầu. Không phải trade-volume footprint.`, [
    ['direction','Hướng nến','any','s',{o:[['any','Any'],['bull','Bullish'],['bear','Bearish'],['doji','Doji']]}],
    ['minVolume','Candle volume tối thiểu',0,'n',{min:0,step:1}], ['maxVolume','Candle volume tối đa (0 = tắt)',0,'n',{min:0,step:1}],
    ['minTrades','Quote events tối thiểu',0,'n',{min:0,step:1}], ['maxTrades','Quote events tối đa (0 = tắt)',0,'n',{min:0,step:1}],
    ['minBid','Bid-side events tối thiểu',0,'n',{min:0,step:1}], ['maxBid','Bid-side events tối đa (0 = tắt)',0,'n',{min:0,step:1}],
    ['minAsk','Ask-side events tối thiểu',0,'n',{min:0,step:1}], ['maxAsk','Ask-side events tối đa (0 = tắt)',0,'n',{min:0,step:1}],
    ['minDelta','Quote delta tối thiểu',0,'n',{step:1}], ['maxDelta','Quote delta tối đa (0 = tắt)',0,'n',{step:1}],
    ['maxVolLocation','Vị trí level hoạt động lớn nhất','any','s',{o:[['any','Any'],['body','Body'],['upper','Upper wick'],['lower','Lower wick']]}]
  ], [K.blue], ['Pattern match'], (A, p) => {
    const needTicks = ['minTrades','maxTrades','minBid','maxBid','minAsk','maxAsk','minDelta','maxDelta'].some(k => num(p[k]) !== 0) || p.maxVolLocation !== 'any';
    const stats = needTicks ? tickBars(A) : null;
    const marks = [];
    for (let i=0;i<A.c.length;i++) {
      const o=num(A.o[i]), c=num(A.c[i]), h=num(A.h[i]), l=num(A.l[i]), v=num(A.v[i]);
      if (p.direction==='bull' && c<=o || p.direction==='bear' && c>=o || p.direction==='doji' && c!==o) continue;
      if (num(p.minVolume)>0 && v<num(p.minVolume)) continue;
      if (num(p.maxVolume)>0 && v>num(p.maxVolume)) continue;
      let s=null;
      if (needTicks) { s=stats[i]; if (!s || !s.available) continue; }
      const count=s?s.total:null, bid=s?s.sell:null, ask=s?s.buy:null, delta=s?s.delta:null;
      if (num(p.minTrades)>0 && count<num(p.minTrades) || num(p.maxTrades)>0 && count>num(p.maxTrades)) continue;
      if (num(p.minBid)>0 && bid<num(p.minBid) || num(p.maxBid)>0 && bid>num(p.maxBid)) continue;
      if (num(p.minAsk)>0 && ask<num(p.minAsk) || num(p.maxAsk)>0 && ask>num(p.maxAsk)) continue;
      if (num(p.minDelta)!==0 && delta<num(p.minDelta) || num(p.maxDelta)!==0 && delta>num(p.maxDelta)) continue;
      if (p.maxVolLocation!=='any') {
        if (!s || !s.levels.length) continue;
        const mx=s.levels.reduce((a,b)=>b.total>a.total?b:a), top=Math.max(o,c), bottom=Math.min(o,c);
        if (p.maxVolLocation==='body' && (mx.p<bottom || mx.p>top)) continue;
        if (p.maxVolLocation==='upper' && mx.p<=top) continue;
        if (p.maxVolLocation==='lower' && mx.p>=bottom) continue;
      }
      marks.push({time:A.t[i],position:c>=o?'belowBar':'aboveBar',color:K.blue,shape:'circle',text:'BP'});
    }
    return [markerLine(A,marks)];
  });
  window.ATASIndicatorFiles['barspattern'] = { id:'barspattern', name:'Bars Pattern', sourceClass:'BarsPattern', sourceFile:'Technical/BarsPattern.cs', group:'market', requirement:'ohlcv', status:'ported', conversion:'approx_proxy', addKey:'atas_bars_pattern_quote_fp', moduleFile:'indicators/individual/barspattern.js', moduleType:'primary' };
})();
