/* ATAS indicator module: TRIX (TRIX) | source: Technical/TRIX.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_trix', 'TRIX', 'osc', 'TRIX là ROC 1 kỳ của EMA ba lần.', period(), [C.a], ['TRIX'], (A, p) => [line(atROC(atTEMA(A.c, p.period), 1))], { hl: [{ y: 0, al: .5 }] });
  window.ATASIndicatorFiles["trix"] = { ...{"id": "trix", "name": "TRIX", "sourceClass": "TRIX", "sourceFile": "Technical/TRIX.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_trix"}, moduleFile: "indicators/individual/trix.js", moduleType: "primary" };
})();
