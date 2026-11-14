/* ATAS indicator module: Voss Predictive Filter (VPF) | source: Technical/VPF.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_vpf', 'Voss Predictive Filter', 'osc', 'Voss Predictive Filter and Flit estimator translated from ATAS recurrence; warm-up requires 3×Predict bars.', [['period', 'Period', 20, 'i', { min: 2 }], ['predict', 'Predict', 3, 'i', { min: 1, max: 20 }], ['bandWidth', 'Band width', .25, 'n', { min: .01, max: .95, step: .01 }]], [C.a, C.b], ['Voss', 'Flit'], (A, p) => {
    const order = P_(p.predict) * 3, per = P_(p.period), f1 = Math.cos(2 * Math.PI / per), g1 = Math.cos(p.bandWidth * 2 * Math.PI / per);
    const root = 1 / g1, disc = Math.max(0, root * root - 1), s1 = root - Math.sqrt(disc), s2 = 1 + s1, s3 = 1 - s1;
    const flit = Array(A.c.length).fill(0), voss = Array(A.c.length).fill(0);
    for (let i = Math.max(order, 2); i < A.c.length; i++) { const x1 = A.c[i] - A.c[i - 2], x2 = (3 + order) / 2; let sum = 0; for (let j = 0; j < order; j++) sum += (j + 1) / order * voss[i - order + j]; flit[i] = .5 * s3 * x1 + f1 * s2 * flit[i - 1] - s1 * flit[i - 2]; voss[i] = x2 * flit[i] - sum; }
    return [line(voss), line(flit, 1)];
  }, { hl: [{ y: 0, al: .35 }] });
  window.ATASIndicatorFiles["vpf"] = { ...{"id": "vpf", "name": "Voss Predictive Filter", "sourceClass": "VPF", "sourceFile": "Technical/VPF.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_vpf"}, moduleFile: "indicators/individual/vpf.js", moduleType: "primary" };
})();
