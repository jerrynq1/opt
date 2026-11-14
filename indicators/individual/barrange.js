/* ATAS indicator module: Bar Range (BarRange) | source: Technical/BarRange.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const base = IND["atas_adr"];
  if (base) IND["atas_item_barrange"] = { ...base, n: "Bar Range", d: "Dùng phép tính gần nhất trong QuantLab, không bảo đảm tương đương 1:1 với bản ATAS. Đã có bản JavaScript chạy trên OHLCV trong chart. Đây là bản port thuật toán, không dùng assembly/runtime của ATAS. [Shared implementation: atas_adr]", p: (base.p||[]).map(x => Array.isArray(x) ? x.slice() : x), c: (base.c||[]).slice(), L: (base.L||[]).slice() };
  window.ATASIndicatorFiles["barrange"] = { ...{"id": "barrange", "name": "Bar Range", "sourceClass": "BarRange", "sourceFile": "Technical/BarRange.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_item_barrange"}, moduleFile: "indicators/individual/barrange.js", moduleType: "alias" };
})();
