/* ATAS indicator module: Dynamic Levels Channel (DynamicLevelsChannel) | source: Technical/DynamicLevelsChannel.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { K, I, line, hist, pxHist, mean, num, params, getMinute, inferredStep, cachedKey, tickBars, markerLine, barMarkers, activeTickIndicator, tickNote } = window.ATASQuoteTickRuntime;
    I('atas_dynamic_channel_footprint', 'Dynamic Levels Channel (footprint proxy)', 'ov', `${tickNote} Value Area channel lấy từ quote-tick price profile. Không thay thế cumulative volume profile của ATAS.`, params.levels, [K.blue, K.gold, K.purple], ['VAH', 'POC', 'VAL'], (A, p) => { const s = tickBars(A, p.valueArea); return [line(s.map(x => x ? x.vah : null), 0), line(s.map(x => x ? x.poc : null), 1, 2), line(s.map(x => x ? x.val : null), 2)]; });
  window.ATASIndicatorFiles["dynamiclevelschannel"] = { ...{"id": "dynamiclevelschannel", "name": "Dynamic Levels Channel", "sourceClass": "DynamicLevelsChannel", "sourceFile": "Technical/DynamicLevelsChannel.cs", "group": "market", "requirement": "quote_footprint", "status": "ported_tick", "conversion": "quote_tick_proxy", "addKey": "atas_dynamic_channel_footprint"}, moduleFile: "indicators/individual/dynamiclevelschannel.js", moduleType: "primary" };
})();
