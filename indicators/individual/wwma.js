/* ATAS indicator module: Welles Wilders Moving Average (WWMA) | source: Technical/WWMA.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_wwma', 'Welles Wilder Moving Average', 'ov', 'Wilder smoothing: previous value + (price − previous value) / Period.', period(), [C.a], ['WWMA'], (A, p) => [line(rma(A.c, P_(p.period)))]);
  window.ATASIndicatorFiles["wwma"] = { ...{"id": "wwma", "name": "Welles Wilders Moving Average", "sourceClass": "WWMA", "sourceFile": "Technical/WWMA.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_wwma"}, moduleFile: "indicators/individual/wwma.js", moduleType: "primary" };
})();
