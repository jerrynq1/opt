/* ATAS indicator module: Delta Strength (DeltaStrength) | source: Technical/DeltaStrength.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { K, I, line, hist, pxHist, mean, num, params, getMinute, inferredStep, cachedKey, tickBars, markerLine, barMarkers, activeTickIndicator, tickNote } = window.ATASQuoteTickRuntime;
    I('atas_delta_strength_tick', 'Delta Strength (quote proxy)', 'osc', `${tickNote} Chuẩn hóa delta theo biên running quote-run delta trong nến.`, [], [K.blue], ['Quote delta strength %'], A => { const s = tickBars(A); return [hist(s.map(x => { if (!x) return null; const scale = Math.max(1, Math.abs(x.maxRunDelta), Math.abs(x.minRunDelta), Math.abs(x.delta)); const v = 100 * x.delta / scale; return { v, c: v >= 0 ? K.buy : K.sell }; }))]; }, { hl: [{ y: 0, al: .3 }] });
  window.ATASIndicatorFiles["deltastrength"] = { ...{"id": "deltastrength", "name": "Delta Strength", "sourceClass": "DeltaStrength", "sourceFile": "Technical/DeltaStrength.cs", "group": "technical", "requirement": "quote_ticks", "status": "ported_tick", "conversion": "quote_tick_proxy", "addKey": "atas_delta_strength_tick"}, moduleFile: "indicators/individual/deltastrength.js", moduleType: "primary" };
})();
