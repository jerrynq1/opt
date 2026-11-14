/* ATAS indicator module: Preferred Stochastic - DiNapoli (StochasticDiNapoli) | source: Technical/StochasticDiNapoli.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const base = IND["atas_kd"];
  if (base) IND["atas_item_stochasticdinapoli"] = { ...base, n: "Preferred Stochastic - DiNapoli", d: "Dùng phép tính gần nhất trong QuantLab, không bảo đảm tương đương 1:1 với bản ATAS. Đã có bản JavaScript chạy trên OHLCV trong chart. Đây là bản port thuật toán, không dùng assembly/runtime của ATAS. [Shared implementation: atas_kd]", p: (base.p||[]).map(x => Array.isArray(x) ? x.slice() : x), c: (base.c||[]).slice(), L: (base.L||[]).slice() };
  window.ATASIndicatorFiles["stochasticdinapoli"] = { ...{"id": "stochasticdinapoli", "name": "Preferred Stochastic - DiNapoli", "sourceClass": "StochasticDiNapoli", "sourceFile": "Technical/StochasticDiNapoli.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_item_stochasticdinapoli"}, moduleFile: "indicators/individual/stochasticdinapoli.js", moduleType: "alias" };
})();
