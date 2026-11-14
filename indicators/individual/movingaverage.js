/* ATAS indicator module: Moving Average (MovingAverage) | source: Technical/MovingAverage.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const base = IND["atas_smma"];
  if (base) IND["atas_item_movingaverage"] = { ...base, n: "Moving Average", d: "Dùng phép tính gần nhất trong QuantLab, không bảo đảm tương đương 1:1 với bản ATAS. Đã có bản JavaScript chạy trên OHLCV trong chart. Đây là bản port thuật toán, không dùng assembly/runtime của ATAS. [Shared implementation: atas_smma]", p: (base.p||[]).map(x => Array.isArray(x) ? x.slice() : x), c: (base.c||[]).slice(), L: (base.L||[]).slice() };
  window.ATASIndicatorFiles["movingaverage"] = { ...{"id": "movingaverage", "name": "Moving Average", "sourceClass": "MovingAverage", "sourceFile": "Technical/MovingAverage.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_item_movingaverage"}, moduleFile: "indicators/individual/movingaverage.js", moduleType: "alias" };
})();
