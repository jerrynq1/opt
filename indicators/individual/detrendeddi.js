/* ATAS indicator module: Detrended Oscillator - DiNapoli (DeTrendedDi) | source: Technical/DeTrendedDi.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const base = IND["atas_dpo"];
  if (base) IND["atas_item_detrendeddi"] = { ...base, n: "Detrended Oscillator - DiNapoli", d: "Dùng phép tính gần nhất trong QuantLab, không bảo đảm tương đương 1:1 với bản ATAS. Đã có bản JavaScript chạy trên OHLCV trong chart. Đây là bản port thuật toán, không dùng assembly/runtime của ATAS. [Shared implementation: atas_dpo]", p: (base.p||[]).map(x => Array.isArray(x) ? x.slice() : x), c: (base.c||[]).slice(), L: (base.L||[]).slice() };
  window.ATASIndicatorFiles["detrendeddi"] = { ...{"id": "detrendeddi", "name": "Detrended Oscillator - DiNapoli", "sourceClass": "DeTrendedDi", "sourceFile": "Technical/DeTrendedDi.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_item_detrendeddi"}, moduleFile: "indicators/individual/detrendeddi.js", moduleType: "alias" };
})();
