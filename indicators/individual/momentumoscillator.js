/* ATAS indicator module: Price Momentum Oscillator (MomentumOscillator) | source: Technical/MomentumOscillator.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const base = IND["atas_mom"];
  if (base) IND["atas_item_momentumoscillator"] = { ...base, n: "Price Momentum Oscillator", d: "Dùng phép tính gần nhất trong QuantLab, không bảo đảm tương đương 1:1 với bản ATAS. Đã có bản JavaScript chạy trên OHLCV trong chart. Đây là bản port thuật toán, không dùng assembly/runtime của ATAS. [Shared implementation: atas_mom]", p: (base.p||[]).map(x => Array.isArray(x) ? x.slice() : x), c: (base.c||[]).slice(), L: (base.L||[]).slice() };
  window.ATASIndicatorFiles["momentumoscillator"] = { ...{"id": "momentumoscillator", "name": "Price Momentum Oscillator", "sourceClass": "MomentumOscillator", "sourceFile": "Technical/MomentumOscillator.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_item_momentumoscillator"}, moduleFile: "indicators/individual/momentumoscillator.js", moduleType: "alias" };
})();
