/* ATAS indicator module: Bands/Envelope (BandsEnvelope) | source: Technical/BandsEnvelope.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const base = IND["atas_maenvelope"];
  if (base) IND["atas_item_bandsenvelope"] = { ...base, n: "Bands/Envelope", d: "Dùng phép tính gần nhất trong QuantLab, không bảo đảm tương đương 1:1 với bản ATAS. Đã có bản JavaScript chạy trên OHLCV trong chart. Đây là bản port thuật toán, không dùng assembly/runtime của ATAS. [Shared implementation: atas_maenvelope]", p: (base.p||[]).map(x => Array.isArray(x) ? x.slice() : x), c: (base.c||[]).slice(), L: (base.L||[]).slice() };
  window.ATASIndicatorFiles["bandsenvelope"] = { ...{"id": "bandsenvelope", "name": "Bands/Envelope", "sourceClass": "BandsEnvelope", "sourceFile": "Technical/BandsEnvelope.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_item_bandsenvelope"}, moduleFile: "indicators/individual/bandsenvelope.js", moduleType: "alias" };
})();
