/* ATAS indicator module: Mean Deviation (MeanDev) | source: Technical/MeanDeviation.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_mean_deviation', 'Mean Deviation', 'osc', 'Mean absolute deviation quanh SMA trong cửa sổ N.', period(), [C.a], ['Mean Dev'], (A, p) => [line(atMeanDev(A.c, P_(p.period)))], { pf: 'vol' });
  window.ATASIndicatorFiles["meandev"] = { ...{"id": "meandev", "name": "Mean Deviation", "sourceClass": "MeanDev", "sourceFile": "Technical/MeanDeviation.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_mean_deviation"}, moduleFile: "indicators/individual/meandev.js", moduleType: "primary" };
})();
