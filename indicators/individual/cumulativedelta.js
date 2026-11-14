/* ATAS indicator module: CVD - Cumulative Volume Delta (CumulativeDelta) | source: Technical/CumulativeDelta.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { K, I, line, hist, pxHist, mean, num, params, getMinute, inferredStep, cachedKey, tickBars, markerLine, barMarkers, activeTickIndicator, tickNote } = window.ATASQuoteTickRuntime;
    I('atas_cvd_quote_tick', 'CVD – Cumulative Delta (quote proxy)', 'osc', `${tickNote} Cumulative buy quote events − sell quote events, reset theo ngày UTC như một session proxy.`, [], [K.gold], ['Cumulative quote delta'], A => { const s = tickBars(A), out = []; let run = 0, day = null; for (let i = 0; i < s.length; i++) { const d = Number.isFinite(A.s[i]) ? Math.floor(A.s[i] / 86400) : null; if (d !== day) { run = 0; day = d; } if (s[i]) run += s[i].delta; out.push(s[i] ? run : null); } return [line(out)]; }, { hl: [{ y: 0, al: .3 }] });
  window.ATASIndicatorFiles["cumulativedelta"] = { ...{"id": "cumulativedelta", "name": "CVD - Cumulative Volume Delta", "sourceClass": "CumulativeDelta", "sourceFile": "Technical/CumulativeDelta.cs", "group": "orderflow", "requirement": "quote_ticks", "status": "ported_tick", "conversion": "quote_tick_proxy", "addKey": "atas_cvd_quote_tick"}, moduleFile: "indicators/individual/cumulativedelta.js", moduleType: "primary" };
})();
