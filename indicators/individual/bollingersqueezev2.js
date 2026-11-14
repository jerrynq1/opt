/* ATAS indicator module: Bollinger Squeeze 2 (BollingerSqueezeV2) | source: Technical/BollingerSqueezeV2.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const base = IND["atas_squeeze"];
  if (base) IND["atas_item_bollingersqueezev2"] = { ...base, n: "Bollinger Squeeze 2", d: "Dùng phép tính gần nhất trong QuantLab, không bảo đảm tương đương 1:1 với bản ATAS. Đã có bản JavaScript chạy trên OHLCV trong chart. Đây là bản port thuật toán, không dùng assembly/runtime của ATAS. [Shared implementation: atas_squeeze]", p: (base.p||[]).map(x => Array.isArray(x) ? x.slice() : x), c: (base.c||[]).slice(), L: (base.L||[]).slice() };
  window.ATASIndicatorFiles["bollingersqueezev2"] = { ...{"id": "bollingersqueezev2", "name": "Bollinger Squeeze 2", "sourceClass": "BollingerSqueezeV2", "sourceFile": "Technical/BollingerSqueezeV2.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_item_bollingersqueezev2"}, moduleFile: "indicators/individual/bollingersqueezev2.js", moduleType: "alias" };
})();
