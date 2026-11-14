/* ATAS indicator module: Historical Volatility Ratio (HVR) | source: Technical/HVR.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_hvr', 'Historical Volatility Ratio', 'osc', 'Tỷ số historical volatility ngắn hạn / dài hạn.', [['short', 'Short', 10, 'i', { min: 2 }], ['long', 'Long', 100, 'i', { min: 3 }]], [C.a], ['HVR'], (A, p) => { const r = A.c.map((v, i) => i && v > 0 && A.c[i - 1] > 0 ? Math.log(v / A.c[i - 1]) : null), s = sdv(r, p.short), l = sdv(r, p.long); return [line(s.map((v, i) => v == null || !l[i] ? null : v / l[i]))]; }, { hl: [{ y: 1, al: .4 }] });
  window.ATASIndicatorFiles["hvr"] = { ...{"id": "hvr", "name": "Historical Volatility Ratio", "sourceClass": "HVR", "sourceFile": "Technical/HVR.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_hvr"}, moduleFile: "indicators/individual/hvr.js", moduleType: "primary" };
})();
