/* ATAS indicator module: Greatest Swing Value (GreatestSwing) | source: Technical/GreatestSwing.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_greatest_swing', 'Greatest Swing Value', 'ov', 'Highest/lowest price across the selected rolling window; proxy for ATAS swing-value overlay.', period(), [C.d, C.e], ['Swing High', 'Swing Low'], (A, p) => [line(atMax(A.h, p.period), 0), line(atMin(A.l, p.period), 1)]);
  window.ATASIndicatorFiles["greatestswing"] = { ...{"id": "greatestswing", "name": "Greatest Swing Value", "sourceClass": "GreatestSwing", "sourceFile": "Technical/GreatestSwing.cs", "group": "market", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_greatest_swing"}, moduleFile: "indicators/individual/greatestswing.js", moduleType: "primary" };
})();
