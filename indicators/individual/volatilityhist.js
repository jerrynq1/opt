/* ATAS indicator module: Volatility - Historical (VolatilityHist) | source: Technical/VolatilityHist.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const base = IND["atas_volatility"];
  if (base) IND["atas_item_volatilityhist"] = { ...base, n: "Volatility - Historical", d: "Đã có bản JavaScript chạy trên OHLCV trong chart. Đây là bản port thuật toán, không dùng assembly/runtime của ATAS. [Shared implementation: atas_volatility]", p: (base.p||[]).map(x => Array.isArray(x) ? x.slice() : x), c: (base.c||[]).slice(), L: (base.L||[]).slice() };
  window.ATASIndicatorFiles["volatilityhist"] = { ...{"id": "volatilityhist", "name": "Volatility - Historical", "sourceClass": "VolatilityHist", "sourceFile": "Technical/VolatilityHist.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_item_volatilityhist"}, moduleFile: "indicators/individual/volatilityhist.js", moduleType: "alias" };
})();
