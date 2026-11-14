/* ATAS indicator module: Double Stochastic - Bressert (DoubleStochasticBressert) | source: Technical/DoubleStochasticBressert.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const base = IND["atas_kd"];
  if (base) IND["atas_item_doublestochasticbressert"] = { ...base, n: "Double Stochastic - Bressert", d: "Dùng phép tính gần nhất trong QuantLab, không bảo đảm tương đương 1:1 với bản ATAS. Đã có bản JavaScript chạy trên OHLCV trong chart. Đây là bản port thuật toán, không dùng assembly/runtime của ATAS. [Shared implementation: atas_kd]", p: (base.p||[]).map(x => Array.isArray(x) ? x.slice() : x), c: (base.c||[]).slice(), L: (base.L||[]).slice() };
  window.ATASIndicatorFiles["doublestochasticbressert"] = { ...{"id": "doublestochasticbressert", "name": "Double Stochastic - Bressert", "sourceClass": "DoubleStochasticBressert", "sourceFile": "Technical/DoubleStochasticBressert.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_item_doublestochasticbressert"}, moduleFile: "indicators/individual/doublestochasticbressert.js", moduleType: "alias" };
})();
