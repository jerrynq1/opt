/* ATAS indicator module: Average Delta (AverageDelta) | source: Technical/AverageDelta.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { K, I, line, hist, pxHist, mean, num, params, getMinute, inferredStep, cachedKey, tickBars, markerLine, barMarkers, activeTickIndicator, tickNote } = window.ATASQuoteTickRuntime;
    I('atas_average_delta_tick', 'Average Delta (quote proxy)', 'osc', `${tickNote} Moving average của delta quote events trên các nến chart.`, params.period, [K.gold], ['Average quote delta'], (A, p) => [line(mean(tickBars(A).map(x => x ? x.delta : null), p.period))], { hl: [{ y: 0, al: .3 }] });
  window.ATASIndicatorFiles["averagedelta"] = { ...{"id": "averagedelta", "name": "Average Delta", "sourceClass": "AverageDelta", "sourceFile": "Technical/AverageDelta.cs", "group": "orderflow", "requirement": "quote_ticks", "status": "ported_tick", "conversion": "quote_tick_proxy", "addKey": "atas_average_delta_tick"}, moduleFile: "indicators/individual/averagedelta.js", moduleType: "primary" };
})();
