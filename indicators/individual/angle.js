/* ATAS indicator module: Study Angle (Angle) | source: Technical/Angle.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const base = IND["atas_lrslope"];
  if (base) IND["atas_item_angle"] = { ...base, n: "Study Angle", d: "Dùng phép tính gần nhất trong QuantLab, không bảo đảm tương đương 1:1 với bản ATAS. Đã có bản JavaScript chạy trên OHLCV trong chart. Đây là bản port thuật toán, không dùng assembly/runtime của ATAS. [Shared implementation: atas_lrslope]", p: (base.p||[]).map(x => Array.isArray(x) ? x.slice() : x), c: (base.c||[]).slice(), L: (base.L||[]).slice() };
  window.ATASIndicatorFiles["angle"] = { ...{"id": "angle", "name": "Study Angle", "sourceClass": "Angle", "sourceFile": "Technical/Angle.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_item_angle"}, moduleFile: "indicators/individual/angle.js", moduleType: "alias" };
})();
