/* ATAS indicator module: Speed of Tape (SpeedOfTape) | source: Technical/SpeedOfTape.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { K, I, line, hist, pxHist, mean, num, params, getMinute, inferredStep, cachedKey, tickBars, markerLine, barMarkers, activeTickIndicator, tickNote } = window.ATASQuoteTickRuntime;
    I('atas_speed_tape_tick', 'Speed of Tape (quote proxy)', 'osc', `${tickNote} Đếm quote events/giây dựa trên thời gian đầu-cuối chuỗi quote đã gom; độ phân giải bị giới hạn bởi dữ liệu footprint theo phút.`, [['smooth', 'Smoothing', 5, 'i', { min: 1, max: 200 }]], [K.blue, K.gold], ['Quote events / second', 'Average'], (A, p) => { const s = tickBars(A), rate = s.map(x => { if (!x) return null; const sec = x.firstTs != null && x.lastTs != null ? Math.max(1, (x.lastTs - x.firstTs) / 1000) : Math.max(1, 60); return x.total / sec; }); return [hist(rate), line(mean(rate, p.smooth), 1)]; }, { pf: 'vol' });
  window.ATASIndicatorFiles["speedoftape"] = { ...{"id": "speedoftape", "name": "Speed of Tape", "sourceClass": "SpeedOfTape", "sourceFile": "Technical/SpeedOfTape.cs", "group": "orderflow", "requirement": "quote_ticks", "status": "ported_tick", "conversion": "quote_tick_proxy", "addKey": "atas_speed_tape_tick"}, moduleFile: "indicators/individual/speedoftape.js", moduleType: "primary" };
})();
