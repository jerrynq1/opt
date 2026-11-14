/* ATAS indicator module: True Range (TrueRange) | source: Technical/TrueRange.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_tr', 'True Range', 'osc', 'True Range của mỗi nến, gồm gap so với Close trước.', [], [C.a], ['TR'], A => [hist(atTR(A))], { pf: 'vol' });
  window.ATASIndicatorFiles["truerange"] = { ...{"id": "truerange", "name": "True Range", "sourceClass": "TrueRange", "sourceFile": "Technical/TrueRange.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_tr"}, moduleFile: "indicators/individual/truerange.js", moduleType: "primary" };
})();
