/* ATAS indicator module: Double Exponential Moving Average (DEMA) | source: Technical/DEMA.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_dema', 'Double EMA (DEMA)', 'ov', 'DEMA = 2×EMA − EMA(EMA).', period(), [C.a], ['DEMA'], (A, p) => [line(atDEMA(A.c, p.period))]);
  window.ATASIndicatorFiles["dema"] = { ...{"id": "dema", "name": "Double Exponential Moving Average", "sourceClass": "DEMA", "sourceFile": "Technical/DEMA.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_dema"}, moduleFile: "indicators/individual/dema.js", moduleType: "primary" };
})();
