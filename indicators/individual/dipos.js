/* ATAS indicator module: DI+ (DIPos) | source: Technical/DIPos.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const base = IND["atas_dmi"];
  if (base) IND["atas_item_dipos"] = { ...base, n: "DI+", d: "Dùng phép tính gần nhất trong QuantLab, không bảo đảm tương đương 1:1 với bản ATAS. Đã có bản JavaScript chạy trên OHLCV trong chart. Đây là bản port thuật toán, không dùng assembly/runtime của ATAS. [Shared implementation: atas_dmi]", p: (base.p||[]).map(x => Array.isArray(x) ? x.slice() : x), c: (base.c||[]).slice(), L: (base.L||[]).slice() };
  window.ATASIndicatorFiles["dipos"] = { ...{"id": "dipos", "name": "DI+", "sourceClass": "DIPos", "sourceFile": "Technical/DIPos.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_item_dipos"}, moduleFile: "indicators/individual/dipos.js", moduleType: "alias" };
})();
