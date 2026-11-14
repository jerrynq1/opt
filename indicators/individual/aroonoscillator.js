/* ATAS indicator module: Aroon Oscillator (AroonOscillator) | source: Technical/AroonOscillator.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const base = IND["atas_aroon"];
  if (base) IND["atas_item_aroonoscillator"] = { ...base, n: "Aroon Oscillator", d: "Dùng phép tính gần nhất trong QuantLab, không bảo đảm tương đương 1:1 với bản ATAS. Đã có bản JavaScript chạy trên OHLCV trong chart. Đây là bản port thuật toán, không dùng assembly/runtime của ATAS. [Shared implementation: atas_aroon]", p: (base.p||[]).map(x => Array.isArray(x) ? x.slice() : x), c: (base.c||[]).slice(), L: (base.L||[]).slice() };
  window.ATASIndicatorFiles["aroonoscillator"] = { ...{"id": "aroonoscillator", "name": "Aroon Oscillator", "sourceClass": "AroonOscillator", "sourceFile": "Technical/AroonOscillator.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_item_aroonoscillator"}, moduleFile: "indicators/individual/aroonoscillator.js", moduleType: "alias" };
})();
