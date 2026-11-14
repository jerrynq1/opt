/* ATAS indicator module: Average Candle Range (ACR) | source: Technical/ACR.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const base = IND["atas_adr"];
  if (base) IND["atas_item_acr"] = { ...base, n: "Average Candle Range", d: "Dùng phép tính gần nhất trong QuantLab, không bảo đảm tương đương 1:1 với bản ATAS. Đã có bản JavaScript chạy trên OHLCV trong chart. Đây là bản port thuật toán, không dùng assembly/runtime của ATAS. [Shared implementation: atas_adr]", p: (base.p||[]).map(x => Array.isArray(x) ? x.slice() : x), c: (base.c||[]).slice(), L: (base.L||[]).slice() };
  window.ATASIndicatorFiles["acr"] = { ...{"id": "acr", "name": "Average Candle Range", "sourceClass": "ACR", "sourceFile": "Technical/ACR.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_item_acr"}, moduleFile: "indicators/individual/acr.js", moduleType: "alias" };
})();
