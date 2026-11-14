/* ATAS indicator module: Double Stochastic (DoubleStochastic) | source: Technical/DoubleStochastic.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const base = IND["atas_kd"];
  if (base) IND["atas_item_doublestochastic"] = { ...base, n: "Double Stochastic", d: "Dùng phép tính gần nhất trong QuantLab, không bảo đảm tương đương 1:1 với bản ATAS. Đã có bản JavaScript chạy trên OHLCV trong chart. Đây là bản port thuật toán, không dùng assembly/runtime của ATAS. [Shared implementation: atas_kd]", p: (base.p||[]).map(x => Array.isArray(x) ? x.slice() : x), c: (base.c||[]).slice(), L: (base.L||[]).slice() };
  window.ATASIndicatorFiles["doublestochastic"] = { ...{"id": "doublestochastic", "name": "Double Stochastic", "sourceClass": "DoubleStochastic", "sourceFile": "Technical/DoubleStochastic.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_item_doublestochastic"}, moduleFile: "indicators/individual/doublestochastic.js", moduleType: "alias" };
})();
