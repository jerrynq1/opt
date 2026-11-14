/* ATAS indicator module: Inverse Fisher Transform with RSI (FisherTransformInverseRsi) | source: Technical/FisherTransformInverseRsi.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const base = IND["atas_fisher_inverse"];
  if (base) IND["atas_item_fishertransforminversersi"] = { ...base, n: "Inverse Fisher Transform with RSI", d: "Dùng phép tính gần nhất trong QuantLab, không bảo đảm tương đương 1:1 với bản ATAS. Đã có bản JavaScript chạy trên OHLCV trong chart. Đây là bản port thuật toán, không dùng assembly/runtime của ATAS. [Shared implementation: atas_fisher_inverse]", p: (base.p||[]).map(x => Array.isArray(x) ? x.slice() : x), c: (base.c||[]).slice(), L: (base.L||[]).slice() };
  window.ATASIndicatorFiles["fishertransforminversersi"] = { ...{"id": "fishertransforminversersi", "name": "Inverse Fisher Transform with RSI", "sourceClass": "FisherTransformInverseRsi", "sourceFile": "Technical/FisherTransformInverseRsi.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_item_fishertransforminversersi"}, moduleFile: "indicators/individual/fishertransforminversersi.js", moduleType: "alias" };
})();
