/* ATAS indicator module: Positive/Negative Volume Index (VolumeIndex) | source: Technical/VolumeIndex.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_volindex', 'Positive / Negative Volume Index', 'osc', 'PVI/NVI: chỉ cập nhật chỉ số khi Volume tăng/giảm so với nến trước.', [], [C.d, C.e], ['PVI', 'NVI'], A => {
    let pvi = 1000, nvi = 1000; const p = [], n = [];
    for (let i = 0; i < A.c.length; i++) { if (i && A.c[i - 1]) { const r = (A.c[i] - A.c[i - 1]) / A.c[i - 1] * 100; if (A.v[i] > A.v[i - 1]) pvi *= 1 + r / 100; if (A.v[i] < A.v[i - 1]) nvi *= 1 + r / 100; } p.push(pvi); n.push(nvi); }
    return [line(p, 0), line(n, 1)];
  });
  window.ATASIndicatorFiles["volumeindex"] = { ...{"id": "volumeindex", "name": "Positive/Negative Volume Index", "sourceClass": "VolumeIndex", "sourceFile": "Technical/VolumeIndex.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_volindex"}, moduleFile: "indicators/individual/volumeindex.js", moduleType: "primary" };
})();
