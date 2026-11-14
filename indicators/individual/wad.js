/* ATAS indicator module: Accumulation / Distribution - Williams (WAD) | source: Technical/WAD.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_wad', 'Williams Accumulation / Distribution', 'osc', 'WAD cộng True Range-adjusted close change theo hướng nến.', [], [C.a], ['WAD'], A => { let x = 0; return [line(A.c.map((v, i) => { if (i) { const prev = A.c[i - 1], ad = v > prev ? v - Math.min(A.l[i], prev) : v < prev ? v - Math.max(A.h[i], prev) : 0; x += ad; } return x; }))]; });
  window.ATASIndicatorFiles["wad"] = { ...{"id": "wad", "name": "Accumulation / Distribution - Williams", "sourceClass": "WAD", "sourceFile": "Technical/WAD.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_wad"}, moduleFile: "indicators/individual/wad.js", moduleType: "primary" };
})();
