/* ATAS indicator module: Stochastic - Percentile (StohasticPercentile) | source: Technical/StohasticPercentile.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const base = IND["atas_kd"];
  if (base) IND["atas_item_stohasticpercentile"] = { ...base, n: "Stochastic - Percentile", d: "Dùng phép tính gần nhất trong QuantLab, không bảo đảm tương đương 1:1 với bản ATAS. Đã có bản JavaScript chạy trên OHLCV trong chart. Đây là bản port thuật toán, không dùng assembly/runtime của ATAS. [Shared implementation: atas_kd]", p: (base.p||[]).map(x => Array.isArray(x) ? x.slice() : x), c: (base.c||[]).slice(), L: (base.L||[]).slice() };
  window.ATASIndicatorFiles["stohasticpercentile"] = { ...{"id": "stohasticpercentile", "name": "Stochastic - Percentile", "sourceClass": "StohasticPercentile", "sourceFile": "Technical/StohasticPercentile.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_item_stohasticpercentile"}, moduleFile: "indicators/individual/stohasticpercentile.js", moduleType: "alias" };
})();
