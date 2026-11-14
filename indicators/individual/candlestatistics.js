/* ATAS indicator module: Candle Statistics (CandleStatistics) | source: Technical/CandleStatistics.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { K, I, line, hist, pxHist, mean, num, params, getMinute, inferredStep, cachedKey, tickBars, markerLine, barMarkers, activeTickIndicator, tickNote } = window.ATASQuoteTickRuntime;
    I('atas_candle_stats_tick', 'Candle Statistics (quote proxy)', 'osc', `${tickNote} Hiển thị total quote events, delta và delta % theo từng nến.`, [], [K.blue, K.gold, K.buy], ['Quote event count', 'Quote delta', 'Delta %'], A => { const s = tickBars(A); return [hist(s.map(x => x ? x.total : null), 0), line(s.map(x => x ? x.delta : null), 1), line(s.map(x => x ? x.deltaPct : null), 2)]; }, { pf: 'vol' });
  window.ATASIndicatorFiles["candlestatistics"] = { ...{"id": "candlestatistics", "name": "Candle Statistics", "sourceClass": "CandleStatistics", "sourceFile": "Technical/CandleStatistics.cs", "group": "technical", "requirement": "quote_ticks", "status": "ported_tick", "conversion": "quote_tick_proxy", "addKey": "atas_candle_stats_tick"}, moduleFile: "indicators/individual/candlestatistics.js", moduleType: "primary" };
})();
