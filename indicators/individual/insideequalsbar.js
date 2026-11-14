/* ATAS indicator module: Inside Bar (InsideEqualsBar) | source: Technical/InsideEqualsBar.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const base = IND["atas_insidebar"];
  if (base) IND["atas_item_insideequalsbar"] = { ...base, n: "Inside Bar", d: "Đã có bản JavaScript chạy trên OHLCV trong chart. Đây là bản port thuật toán, không dùng assembly/runtime của ATAS. [Shared implementation: atas_insidebar]", p: (base.p||[]).map(x => Array.isArray(x) ? x.slice() : x), c: (base.c||[]).slice(), L: (base.L||[]).slice() };
  window.ATASIndicatorFiles["insideequalsbar"] = { ...{"id": "insideequalsbar", "name": "Inside Bar", "sourceClass": "InsideEqualsBar", "sourceFile": "Technical/InsideEqualsBar.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_item_insideequalsbar"}, moduleFile: "indicators/individual/insideequalsbar.js", moduleType: "alias" };
})();
