/* ATAS indicator module: Bar Difference (BarDifference) | source: Technical/BarDifference.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const base = IND["atas_mom"];
  if (base) IND["atas_item_bardifference"] = { ...base, n: "Bar Difference", d: "Dùng phép tính gần nhất trong QuantLab, không bảo đảm tương đương 1:1 với bản ATAS. Đã có bản JavaScript chạy trên OHLCV trong chart. Đây là bản port thuật toán, không dùng assembly/runtime của ATAS. [Shared implementation: atas_mom]", p: (base.p||[]).map(x => Array.isArray(x) ? x.slice() : x), c: (base.c||[]).slice(), L: (base.L||[]).slice() };
  window.ATASIndicatorFiles["bardifference"] = { ...{"id": "bardifference", "name": "Bar Difference", "sourceClass": "BarDifference", "sourceFile": "Technical/BarDifference.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_item_bardifference"}, moduleFile: "indicators/individual/bardifference.js", moduleType: "alias" };
})();
