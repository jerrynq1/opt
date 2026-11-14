/* ATAS indicator module: Kaufman Adaptive Moving Average (KAMA) | source: Technical/KAMA.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_kama', 'Kaufman Adaptive MA', 'ov', 'KAMA điều chỉnh hệ số làm mượt theo Efficiency Ratio.', period(), [C.a], ['KAMA'], (A, p) => [line(atKAMA(A.c, p.period))]);
  window.ATASIndicatorFiles["kama"] = { ...{"id": "kama", "name": "Kaufman Adaptive Moving Average", "sourceClass": "KAMA", "sourceFile": "Technical/KAMA.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_kama"}, moduleFile: "indicators/individual/kama.js", moduleType: "primary" };
})();
