/* ATAS indicator module: Inverse Fisher Transform (FisherTransformInverse) | source: Technical/FisherTransformInverse.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_fisher_inverse', 'Inverse Fisher Transform', 'osc', 'Inverse Fisher Transform của RSI đã scale.', period(), [C.a], ['IFT'], (A, p) => { const r = rsiOf(A.c, p.period), out = r.map(v => v == null ? null : (Math.exp(2 * ((v - 50) / 10)) - 1) / (Math.exp(2 * ((v - 50) / 10)) + 1)); return [line(out)]; }, { hl: [{ y: .5, al: .3 }, { y: -.5, al: .3 }] });
  window.ATASIndicatorFiles["fishertransforminverse"] = { ...{"id": "fishertransforminverse", "name": "Inverse Fisher Transform", "sourceClass": "FisherTransformInverse", "sourceFile": "Technical/FisherTransformInverse.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_fisher_inverse"}, moduleFile: "indicators/individual/fishertransforminverse.js", moduleType: "primary" };
})();
