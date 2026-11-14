/* ATAS indicator module: Fisher Transform (FisherTransform) | source: Technical/FisherTransform.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_fisher', 'Fisher Transform', 'osc', 'Fisher Transform từ vị trí giá trong rolling high-low, có clamp để ổn định.', period(), [C.a], ['Fisher'], (A, p) => {
    const hh = atMax(A.h, p.period), ll = atMin(A.l, p.period), x = Array(A.c.length).fill(null), out = Array(A.c.length).fill(null); let prev = 0, fish = 0;
    for (let i = 0; i < x.length; i++) {
      if (hh[i] == null || hh[i] === ll[i]) continue;
      const v = 2 * ((A.c[i] - ll[i]) / (hh[i] - ll[i]) - .5); prev = Math.max(-.999, Math.min(.999, .33 * v + .67 * prev));
      fish = .5 * Math.log((1 + prev) / (1 - prev)) + .5 * fish; x[i] = fish; out[i] = fish;
    }
    return [line(out)];
  }, { hl: [{ y: 0, al: .5 }] });
  window.ATASIndicatorFiles["fishertransform"] = { ...{"id": "fishertransform", "name": "Fisher Transform", "sourceClass": "FisherTransform", "sourceFile": "Technical/FisherTransform.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_fisher"}, moduleFile: "indicators/individual/fishertransform.js", moduleType: "primary" };
})();
