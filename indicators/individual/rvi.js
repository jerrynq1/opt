/* ATAS indicator module: RVI V1 (RVI) | source: Technical/RVI.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const base = IND["atas_rvi"];
  if (base) IND["atas_item_rvi"] = { ...base, n: "RVI V1", d: "Dùng phép tính gần nhất trong QuantLab, không bảo đảm tương đương 1:1 với bản ATAS. Đã có bản JavaScript chạy trên OHLCV trong chart. Đây là bản port thuật toán, không dùng assembly/runtime của ATAS. [Shared implementation: atas_rvi]", p: (base.p||[]).map(x => Array.isArray(x) ? x.slice() : x), c: (base.c||[]).slice(), L: (base.L||[]).slice() };
  window.ATASIndicatorFiles["rvi"] = { ...{"id": "rvi", "name": "RVI V1", "sourceClass": "RVI", "sourceFile": "Technical/RVI.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_item_rvi"}, moduleFile: "indicators/individual/rvi.js", moduleType: "alias" };
})();
