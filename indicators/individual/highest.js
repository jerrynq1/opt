/* ATAS indicator module: Highest (Highest) | source: Technical/Highest.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const base = IND["atas_highlow"];
  if (base) IND["atas_item_highest"] = { ...base, n: "Highest", d: "Đã có bản JavaScript chạy trên OHLCV trong chart. Đây là bản port thuật toán, không dùng assembly/runtime của ATAS. [Shared implementation: atas_highlow]", p: (base.p||[]).map(x => Array.isArray(x) ? x.slice() : x), c: (base.c||[]).slice(), L: (base.L||[]).slice() };
  window.ATASIndicatorFiles["highest"] = { ...{"id": "highest", "name": "Highest", "sourceClass": "Highest", "sourceFile": "Technical/Highest.cs", "group": "market", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_item_highest"}, moduleFile: "indicators/individual/highest.js", moduleType: "alias" };
})();
