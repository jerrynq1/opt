/* ATAS indicator module: Adaptive Binary Wave (AdaptiveBinaryWaveMA) | source: Technical/AdaptiveBinaryWaveMA.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const base = IND["atas_ama"];
  if (base) IND["atas_item_adaptivebinarywavema"] = { ...base, n: "Adaptive Binary Wave", d: "Dùng phép tính gần nhất trong QuantLab, không bảo đảm tương đương 1:1 với bản ATAS. Đã có bản JavaScript chạy trên OHLCV trong chart. Đây là bản port thuật toán, không dùng assembly/runtime của ATAS. [Shared implementation: atas_ama]", p: (base.p||[]).map(x => Array.isArray(x) ? x.slice() : x), c: (base.c||[]).slice(), L: (base.L||[]).slice() };
  window.ATASIndicatorFiles["adaptivebinarywavema"] = { ...{"id": "adaptivebinarywavema", "name": "Adaptive Binary Wave", "sourceClass": "AdaptiveBinaryWaveMA", "sourceFile": "Technical/AdaptiveBinaryWaveMA.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_item_adaptivebinarywavema"}, moduleFile: "indicators/individual/adaptivebinarywavema.js", moduleType: "alias" };
})();
