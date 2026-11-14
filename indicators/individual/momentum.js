/* ATAS indicator module: Momentum (Momentum) | source: Technical/Momentum.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_mom', 'Momentum', 'osc', 'Momentum = Close hiện tại − Close N nến trước.', period(), [C.a], ['Momentum'], (A, p) => [line(atMom(A.c, P_(p.period)))], { hl: [{ y: 0, al: .5 }] });
  window.ATASIndicatorFiles["momentum"] = { ...{"id": "momentum", "name": "Momentum", "sourceClass": "Momentum", "sourceFile": "Technical/Momentum.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_mom"}, moduleFile: "indicators/individual/momentum.js", moduleType: "primary" };
})();
