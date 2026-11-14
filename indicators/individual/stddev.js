/* ATAS indicator module: Standard Deviation (StdDev) | source: Technical/StdDev.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_stddev', 'Standard Deviation', 'osc', 'Population standard deviation quanh SMA, theo cách tính của ATAS.', period(), [C.a], ['StdDev'], (A, p) => [line(sdv(A.c, P_(p.period)))], { pf: 'vol' });
  window.ATASIndicatorFiles["stddev"] = { ...{"id": "stddev", "name": "Standard Deviation", "sourceClass": "StdDev", "sourceFile": "Technical/StdDev.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_stddev"}, moduleFile: "indicators/individual/stddev.js", moduleType: "primary" };
})();
