/* ATAS indicator module: Dynamic Levels (DynamicLevels) | source: Technical/DynamicLevels.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { K, I, line, hist, pxHist, mean, num, params, getMinute, inferredStep, cachedKey, tickBars, markerLine, barMarkers, activeTickIndicator, tickNote } = window.ATASQuoteTickRuntime;
    I('atas_dynamic_levels_footprint', 'Dynamic Levels (footprint proxy)', 'ov', `${tickNote} POC, VAH và VAL theo price-level quote-event profile từng nến; không phải profile giao dịch thật.`, params.levels, [K.gold, K.buy, K.sell], ['POC', 'VAH', 'VAL'], (A, p) => { const s = tickBars(A, p.valueArea); return [line(s.map(x => x ? x.poc : null), 0, 2), line(s.map(x => x ? x.vah : null), 1), line(s.map(x => x ? x.val : null), 2)]; });
  window.ATASIndicatorFiles["dynamiclevels"] = { ...{"id": "dynamiclevels", "name": "Dynamic Levels", "sourceClass": "DynamicLevels", "sourceFile": "Technical/DynamicLevels.cs", "group": "market", "requirement": "quote_footprint", "status": "ported_tick", "conversion": "quote_tick_proxy", "addKey": "atas_dynamic_levels_footprint"}, moduleFile: "indicators/individual/dynamiclevels.js", moduleType: "primary" };
})();
