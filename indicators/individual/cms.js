/* ATAS indicator module: Clear Method Swing Line (CMS) | source: Technical/CMS.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const base = IND["atas_swing_high_low"];
  if (base) IND["atas_item_cms"] = { ...base, n: "Clear Method Swing Line", d: "Dùng swing high/low đã xác nhận làm proxy cho Clear Method Swing Line; không tái tạo toàn bộ state machine ATAS. [Shared implementation: atas_swing_high_low]", p: (base.p||[]).map(x => Array.isArray(x) ? x.slice() : x), c: (base.c||[]).slice(), L: (base.L||[]).slice() };
  window.ATASIndicatorFiles["cms"] = { ...{"id": "cms", "name": "Clear Method Swing Line", "sourceClass": "CMS", "sourceFile": "Technical/CMS.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_item_cms"}, moduleFile: "indicators/individual/cms.js", moduleType: "alias" };
})();
