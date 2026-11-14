/* ATAS indicator module: DI- (DINeg) | source: Technical/DINeg.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const base = IND["atas_dmi"];
  if (base) IND["atas_item_dineg"] = { ...base, n: "DI-", d: "Dùng phép tính gần nhất trong QuantLab, không bảo đảm tương đương 1:1 với bản ATAS. Đã có bản JavaScript chạy trên OHLCV trong chart. Đây là bản port thuật toán, không dùng assembly/runtime của ATAS. [Shared implementation: atas_dmi]", p: (base.p||[]).map(x => Array.isArray(x) ? x.slice() : x), c: (base.c||[]).slice(), L: (base.L||[]).slice() };
  window.ATASIndicatorFiles["dineg"] = { ...{"id": "dineg", "name": "DI-", "sourceClass": "DINeg", "sourceFile": "Technical/DINeg.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_item_dineg"}, moduleFile: "indicators/individual/dineg.js", moduleType: "alias" };
})();
