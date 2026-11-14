/* ATAS indicator module: Highest High/Lowest Low Over N Bars (HighLow) | source: Technical/HighLow.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_highlow', 'Highest High / Lowest Low', 'ov', 'Rolling highest high và lowest low trong N nến.', period(), [C.d, C.e], ['Highest High', 'Lowest Low'], (A, p) => [line(atMax(A.h, p.period), 0), line(atMin(A.l, p.period), 1)]);
  window.ATASIndicatorFiles["highlow"] = { ...{"id": "highlow", "name": "Highest High/Lowest Low Over N Bars", "sourceClass": "HighLow", "sourceFile": "Technical/HighLow.cs", "group": "market", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_highlow"}, moduleFile: "indicators/individual/highlow.js", moduleType: "primary" };
})();
