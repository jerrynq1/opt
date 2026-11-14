/* ATAS indicator module: Parabolic SAR (ParabolicSAR) | source: Technical/ParabolicSAR.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_psar', 'Parabolic SAR', 'ov', 'Parabolic Stop and Reverse với acceleration step 0.02 và max 0.2.', [['step', 'Step', .02, 'n', { min: .001, max: .2, step: .001 }], ['max', 'Maximum', .2, 'n', { min: .01, max: 1, step: .01 }]], [C.a], ['SAR'], (A, p) => [line(atSAR(A, p.step, p.max))]);
  window.ATASIndicatorFiles["parabolicsar"] = { ...{"id": "parabolicsar", "name": "Parabolic SAR", "sourceClass": "ParabolicSAR", "sourceFile": "Technical/ParabolicSAR.cs", "group": "market", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_psar"}, moduleFile: "indicators/individual/parabolicsar.js", moduleType: "primary" };
})();
