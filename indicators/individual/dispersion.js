/* ATAS indicator module: Dispersion (Dispersion) | source: Technical/Dispersion.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_meandev', 'Mean Deviation', 'osc', 'Mean absolute deviation của Close so với mean trong cửa sổ.', period(), [C.a], ['Mean Deviation'], (A, p) => [line(atMeanDev(A.c, p.period))]);
  window.ATASIndicatorFiles["dispersion"] = { ...{"id": "dispersion", "name": "Dispersion", "sourceClass": "Dispersion", "sourceFile": "Technical/Dispersion.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_meandev"}, moduleFile: "indicators/individual/dispersion.js", moduleType: "primary" };
})();
