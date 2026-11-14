/* ATAS indicator module: Maximum Levels (MaxLevels) | source: Technical/MaxLevels.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { K, I, line, hist, pxHist, mean, num, params, getMinute, inferredStep, cachedKey, tickBars, markerLine, barMarkers, activeTickIndicator, tickNote } = window.ATASQuoteTickRuntime;
    I('atas_max_levels_footprint', 'Maximum Levels (quote footprint proxy)', 'ov', `${tickNote} Giá level có tổng, buy hoặc sell quote events lớn nhất trong nến.`, [['level', 'Level source', 'total', 's', { o: [['total', 'Total events'], ['buy', 'Buy events'], ['sell', 'Sell events']] }]], [K.gold, K.buy, K.sell], ['Max activity level'], (A, p) => { const s = tickBars(A); return [line(s.map(x => { if (!x || !x.levels.length) return null; const k = p.level === 'buy' ? 'buy' : p.level === 'sell' ? 'sell' : 'total'; return x.levels.reduce((a, b) => b[k] > a[k] ? b : a).p; }), 0, 2)]; });
  window.ATASIndicatorFiles["maxlevels"] = { ...{"id": "maxlevels", "name": "Maximum Levels", "sourceClass": "MaxLevels", "sourceFile": "Technical/MaxLevels.cs", "group": "market", "requirement": "quote_footprint", "status": "ported_tick", "conversion": "quote_tick_proxy", "addKey": "atas_max_levels_footprint"}, moduleFile: "indicators/individual/maxlevels.js", moduleType: "primary" };
})();
