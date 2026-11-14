/* ATAS indicator module: T3 (T3) | source: Technical/T3.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_t3', 'Tillson T3', 'ov', 'Tillson T3 (6 tầng EMA), volume factor mặc định 0.7.', [['period', 'Chu kỳ', 5, 'i', { min: 1, max: 200 }], ['vfactor', 'Volume factor', .7, 'n', { min: 0, max: 1, step: .05 }]], [C.a], ['T3'], (A, p) => {
    const e1 = ema(A.c, p.period), e2 = ema(e1, p.period), e3 = ema(e2, p.period), e4 = ema(e3, p.period), e5 = ema(e4, p.period), e6 = ema(e5, p.period), v = p.vfactor;
    const c1 = -(v ** 3), c2 = 3 * v ** 2 + 3 * v ** 3, c3 = -6 * v ** 2 - 3 * v - 3 * v ** 3, c4 = 1 + 3 * v + 3 * v ** 2 + v ** 3;
    return [line(e1.map((_, i) => [e3[i], e4[i], e5[i], e6[i]].every(Number.isFinite) ? c1 * e6[i] + c2 * e5[i] + c3 * e4[i] + c4 * e3[i] : null))];
  });
  window.ATASIndicatorFiles["t3"] = { ...{"id": "t3", "name": "T3", "sourceClass": "T3", "sourceFile": "Technical/T3.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_t3"}, moduleFile: "indicators/individual/t3.js", moduleType: "primary" };
})();
