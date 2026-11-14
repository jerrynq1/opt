/* ATAS indicator module: RVI V2 (RVI2) | source: Technical/RVI2.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const base = IND["atas_rvi"];
  if (base) IND["atas_item_rvi2"] = { ...base, n: "RVI V2", d: "Dùng phép tính gần nhất trong QuantLab, không bảo đảm tương đương 1:1 với bản ATAS. Đã có bản JavaScript chạy trên OHLCV trong chart. Đây là bản port thuật toán, không dùng assembly/runtime của ATAS. [Shared implementation: atas_rvi]", p: (base.p||[]).map(x => Array.isArray(x) ? x.slice() : x), c: (base.c||[]).slice(), L: (base.L||[]).slice() };
  window.ATASIndicatorFiles["rvi2"] = { ...{"id": "rvi2", "name": "RVI V2", "sourceClass": "RVI2", "sourceFile": "Technical/RVI2.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_item_rvi2"}, moduleFile: "indicators/individual/rvi2.js", moduleType: "alias" };
})();
