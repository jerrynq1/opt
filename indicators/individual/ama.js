/* ATAS indicator module: Adaptive Moving Average (AMA) | source: Technical/AMA.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_ama', 'Adaptive Moving Average (ATAS)', 'ov', 'Port Technical/AMA.cs: ER adaptive smoothing với default Period 15, FastConstant 3, SlowConstant 20 và seed từ Close trước đó.', [['period', 'Period', 15, 'i', { min: 1, max: 10000 }], ['fast', 'Fast constant', 3, 'i', { min: 1, max: 10000 }], ['slow', 'Slow constant', 20, 'i', { min: 1, max: 10000 }]], [C.a], ['AMA'], (A, p) => [line(atATAS_AMA(A.c, p.period, p.fast, p.slow))]);
  window.ATASIndicatorFiles["ama"] = { ...{"id": "ama", "name": "Adaptive Moving Average", "sourceClass": "AMA", "sourceFile": "Technical/AMA.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_ama"}, moduleFile: "indicators/individual/ama.js", moduleType: "primary" };
})();
