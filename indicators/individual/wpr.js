/* ATAS indicator module: WPR (WPR) | source: Technical/WPR.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const base = IND["atas_williamsr"];
  if (base) IND["atas_item_wpr"] = { ...base, n: "WPR", d: "Dùng phép tính gần nhất trong QuantLab, không bảo đảm tương đương 1:1 với bản ATAS. Đã có bản JavaScript chạy trên OHLCV trong chart. Đây là bản port thuật toán, không dùng assembly/runtime của ATAS. [Shared implementation: atas_williamsr]", p: (base.p||[]).map(x => Array.isArray(x) ? x.slice() : x), c: (base.c||[]).slice(), L: (base.L||[]).slice() };
  window.ATASIndicatorFiles["wpr"] = { ...{"id": "wpr", "name": "WPR", "sourceClass": "WPR", "sourceFile": "Technical/WPR.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_item_wpr"}, moduleFile: "indicators/individual/wpr.js", moduleType: "alias" };
})();
