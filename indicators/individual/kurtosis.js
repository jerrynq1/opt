/* ATAS indicator module: Kurtosis (Kurtosis) | source: Technical/Kurtosis.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_kurtosis', 'Kurtosis', 'osc', 'Excess kurtosis rolling theo cửa sổ; yêu cầu đủ N giá trị.', period('period', 'Period', 20, 4), [C.a], ['Kurtosis'], (A, p) => [line(atRoll(A.c, p.period, w => { const m = w.reduce((s, x) => s + x, 0) / w.length, v2 = w.reduce((s, x) => s + (x - m) ** 2, 0) / w.length, v4 = w.reduce((s, x) => s + (x - m) ** 4, 0) / w.length; return v2 ? v4 / (v2 * v2) - 3 : null; }))], { hl: [{ y: 0, al: .4 }] });
  window.ATASIndicatorFiles["kurtosis"] = { ...{"id": "kurtosis", "name": "Kurtosis", "sourceClass": "Kurtosis", "sourceFile": "Technical/Kurtosis.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_kurtosis"}, moduleFile: "indicators/individual/kurtosis.js", moduleType: "primary" };
})();
