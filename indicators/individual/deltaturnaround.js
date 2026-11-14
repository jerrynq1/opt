/* ATAS indicator module: Delta Turnaround (DeltaTurnaround) | source: Technical/DeltaTurnaround.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { K, I, line, hist, pxHist, mean, num, params, getMinute, inferredStep, cachedKey, tickBars, markerLine, barMarkers, activeTickIndicator, tickNote } = window.ATASQuoteTickRuntime;
    I('atas_delta_turnaround_tick', 'Delta Turnaround (quote proxy)', 'ov', `${tickNote} Đánh dấu nến tạo higher-high/lower-low nhưng quote delta đảo chiều so với nến trước.`, [], [K.buy, K.sell], ['Bull / Bear turnaround'], A => { const s = tickBars(A), m = barMarkers(A, s, (x, i) => { if (i < 1 || !s[i - 1]) return null; const prev = s[i - 1]; if (A.l[i] < A.l[i - 1] && A.c[i] > A.o[i] && x.delta > 0 && prev.delta < 0) return { position: 'belowBar', color: K.buy, shape: 'arrowUp', text: 'Δ turn' }; if (A.h[i] > A.h[i - 1] && A.c[i] < A.o[i] && x.delta < 0 && prev.delta > 0) return { position: 'aboveBar', color: K.sell, shape: 'arrowDown', text: 'Δ turn' }; return null; }); return [markerLine(A, m)]; });
  window.ATASIndicatorFiles["deltaturnaround"] = { ...{"id": "deltaturnaround", "name": "Delta Turnaround", "sourceClass": "DeltaTurnaround", "sourceFile": "Technical/DeltaTurnaround.cs", "group": "orderflow", "requirement": "quote_ticks", "status": "ported_tick", "conversion": "quote_tick_proxy", "addKey": "atas_delta_turnaround_tick"}, moduleFile: "indicators/individual/deltaturnaround.js", moduleType: "primary" };
})();
