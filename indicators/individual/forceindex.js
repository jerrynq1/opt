/* ATAS indicator module: Force Index (ForceIndex) | source: Technical/ForceIndex.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_force', 'Force Index', 'osc', 'Force Index = thay đổi Close × Volume, có EMA smoothing.', period(), [C.a], ['Force Index'], (A, p) => [line(ema(A.c.map((v, i) => i ? (v - A.c[i - 1]) * n(A.v[i]) : null), p.period))]);
  window.ATASIndicatorFiles["forceindex"] = { ...{"id": "forceindex", "name": "Force Index", "sourceClass": "ForceIndex", "sourceFile": "Technical/ForceIndex.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_force"}, moduleFile: "indicators/individual/forceindex.js", moduleType: "primary" };
})();
