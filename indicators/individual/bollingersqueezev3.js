/* ATAS indicator module: Bollinger Squeeze 3 (BollingerSqueezeV3) | source: Technical/BollingerSqueezeV3.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const base = IND["atas_squeeze"];
  if (base) IND["atas_item_bollingersqueezev3"] = { ...base, n: "Bollinger Squeeze 3", d: "Dùng phép tính gần nhất trong QuantLab, không bảo đảm tương đương 1:1 với bản ATAS. Đã có bản JavaScript chạy trên OHLCV trong chart. Đây là bản port thuật toán, không dùng assembly/runtime của ATAS. [Shared implementation: atas_squeeze]", p: (base.p||[]).map(x => Array.isArray(x) ? x.slice() : x), c: (base.c||[]).slice(), L: (base.L||[]).slice() };
  window.ATASIndicatorFiles["bollingersqueezev3"] = { ...{"id": "bollingersqueezev3", "name": "Bollinger Squeeze 3", "sourceClass": "BollingerSqueezeV3", "sourceFile": "Technical/BollingerSqueezeV3.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_item_bollingersqueezev3"}, moduleFile: "indicators/individual/bollingersqueezev3.js", moduleType: "alias" };
})();
