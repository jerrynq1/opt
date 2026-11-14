/* ATAS indicator module: AD (AD) | source: Technical/AD.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const base = IND["atas_adl"];
  if (base) IND["atas_item_ad"] = { ...base, n: "AD", d: "Đã có bản JavaScript chạy trên OHLCV trong chart. Đây là bản port thuật toán, không dùng assembly/runtime của ATAS. [Shared implementation: atas_adl]", p: (base.p||[]).map(x => Array.isArray(x) ? x.slice() : x), c: (base.c||[]).slice(), L: (base.L||[]).slice() };
  window.ATASIndicatorFiles["ad"] = { ...{"id": "ad", "name": "AD", "sourceClass": "AD", "sourceFile": "Technical/AD.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_item_ad"}, moduleFile: "indicators/individual/ad.js", moduleType: "alias" };
})();
