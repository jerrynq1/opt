/* ATAS indicator module: Lowest (Lowest) | source: Technical/Lowest.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const base = IND["atas_highlow"];
  if (base) IND["atas_item_lowest"] = { ...base, n: "Lowest", d: "Dùng phép tính gần nhất trong QuantLab, không bảo đảm tương đương 1:1 với bản ATAS. Đã có bản JavaScript chạy trên OHLCV trong chart. Đây là bản port thuật toán, không dùng assembly/runtime của ATAS. [Shared implementation: atas_highlow]", p: (base.p||[]).map(x => Array.isArray(x) ? x.slice() : x), c: (base.c||[]).slice(), L: (base.L||[]).slice() };
  window.ATASIndicatorFiles["lowest"] = { ...{"id": "lowest", "name": "Lowest", "sourceClass": "Lowest", "sourceFile": "Technical/Lowest.cs", "group": "market", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_item_lowest"}, moduleFile: "indicators/individual/lowest.js", moduleType: "alias" };
})();
