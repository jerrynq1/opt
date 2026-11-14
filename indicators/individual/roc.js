/* ATAS indicator module: Rate of Change (ROC) | source: Technical/ROC.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_roc', 'Rate of Change (ROC)', 'osc', 'Tốc độ thay đổi phần trăm so với Close cách đây N nến.', period(), [C.a], ['ROC'], (A, p) => [line(atROC(A.c, P_(p.period)))], { hl: [{ y: 0, al: .5 }] });
  window.ATASIndicatorFiles["roc"] = { ...{"id": "roc", "name": "Rate of Change", "sourceClass": "ROC", "sourceFile": "Technical/ROC.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_roc"}, moduleFile: "indicators/individual/roc.js", moduleType: "primary" };
})();
