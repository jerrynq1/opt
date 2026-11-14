/* ATAS indicator module: DX (DX) | source: Technical/DX.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const base = IND["atas_dmi"];
  if (base) IND["atas_item_dx"] = { ...base, n: "DX", d: "Dùng phép tính gần nhất trong QuantLab, không bảo đảm tương đương 1:1 với bản ATAS. Đã có bản JavaScript chạy trên OHLCV trong chart. Đây là bản port thuật toán, không dùng assembly/runtime của ATAS. [Shared implementation: atas_dmi]", p: (base.p||[]).map(x => Array.isArray(x) ? x.slice() : x), c: (base.c||[]).slice(), L: (base.L||[]).slice() };
  window.ATASIndicatorFiles["dx"] = { ...{"id": "dx", "name": "DX", "sourceClass": "DX", "sourceFile": "Technical/DX.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_item_dx"}, moduleFile: "indicators/individual/dx.js", moduleType: "alias" };
})();
