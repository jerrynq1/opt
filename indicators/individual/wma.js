/* ATAS indicator module: WMA (WMA) | source: Technical/WMA.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const base = IND["atas_wma"];
  if (base) IND["atas_item_wma"] = { ...base, n: "WMA", d: "Đã có bản JavaScript chạy trên OHLCV trong chart. Đây là bản port thuật toán, không dùng assembly/runtime của ATAS. [Shared implementation: atas_wma]", p: (base.p||[]).map(x => Array.isArray(x) ? x.slice() : x), c: (base.c||[]).slice(), L: (base.L||[]).slice() };
  window.ATASIndicatorFiles["wma"] = { ...{"id": "wma", "name": "WMA", "sourceClass": "WMA", "sourceFile": "Technical/WMA.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_item_wma"}, moduleFile: "indicators/individual/wma.js", moduleType: "alias" };
})();
