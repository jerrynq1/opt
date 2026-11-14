/* ATAS indicator module: Ergodic (Ergodic) | source: Technical/Ergodic.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const base = IND["atas_tsi"];
  if (base) IND["atas_item_ergodic"] = { ...base, n: "Ergodic", d: "Dùng phép tính gần nhất trong QuantLab, không bảo đảm tương đương 1:1 với bản ATAS. Đã có bản JavaScript chạy trên OHLCV trong chart. Đây là bản port thuật toán, không dùng assembly/runtime của ATAS. [Shared implementation: atas_tsi]", p: (base.p||[]).map(x => Array.isArray(x) ? x.slice() : x), c: (base.c||[]).slice(), L: (base.L||[]).slice() };
  window.ATASIndicatorFiles["ergodic"] = { ...{"id": "ergodic", "name": "Ergodic", "sourceClass": "Ergodic", "sourceFile": "Technical/Ergodic.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_item_ergodic"}, moduleFile: "indicators/individual/ergodic.js", moduleType: "alias" };
})();
