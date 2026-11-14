/* ATAS indicator module: Spread Volumes Indicator (SpreadVolume) | source: Technical/SpreadVolume.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { K, I, line, hist, pxHist, mean, num, params, getMinute, inferredStep, cachedKey, tickBars, markerLine, barMarkers, activeTickIndicator, tickNote } = window.ATASQuoteTickRuntime;
    I('atas_spread_volume_tick', 'Spread Volumes Indicator (quote proxy)', 'osc', `${tickNote} Ước lượng spread exposure = quote events × spread trung bình; không phải volume khớp tại từng spread.`, [], [K.gold], ['Spread × quote events'], A => { const s = tickBars(A); return [hist(s.map(x => x && x.spread != null ? x.spread * x.total : null))]; }, { pf: 'auto' });
  window.ATASIndicatorFiles["spreadvolume"] = { ...{"id": "spreadvolume", "name": "Spread Volumes Indicator", "sourceClass": "SpreadVolume", "sourceFile": "Technical/SpreadVolume.cs", "group": "orderflow", "requirement": "quote_ticks", "status": "ported_tick", "conversion": "quote_tick_proxy", "addKey": "atas_spread_volume_tick"}, moduleFile: "indicators/individual/spreadvolume.js", moduleType: "primary" };
})();
