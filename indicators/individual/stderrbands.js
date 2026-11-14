/* ATAS indicator module: Standard Error Bands (StdErrBands) | source: Technical/StdErrBands.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_stderr_bands', 'Standard Error Bands', 'ov', 'Linear regression center with residual standard-error envelope; browser approximation of ATAS drawing.', [['period', 'Period', 50, 'i', { min: 2, max: 500 }], ['mult', 'Deviation', 2, 'n', { min: .1, step: .1 }]], [C.a, C.b], ['Regression / Upper', 'Lower'], (A, p) => {
    const mid = atLinRegEnd(A.c, p.period), sd = atRoll(A.c, p.period, w => { const n0 = w.length, sx = n0 * (n0 - 1) / 2, sxx = n0 * (n0 - 1) * (2 * n0 - 1) / 6, sy = w.reduce((s, x) => s + x, 0), sxy = w.reduce((s, x, i) => s + i * x, 0), den = n0 * sxx - sx * sx, slope = den ? (n0 * sxy - sx * sy) / den : 0, intercept = (sy - slope * sx) / n0, err = w.map((v, i) => v - (intercept + slope * i)); return Math.sqrt(err.reduce((s, x) => s + x * x, 0) / n0); });
    const up = mid.map((v, i) => v == null || sd[i] == null ? null : v + p.mult * sd[i]), lo = mid.map((v, i) => v == null || sd[i] == null ? null : v - p.mult * sd[i]); return [line(mid, 0), line(up, 1), line(lo, 1), fill(up, lo, 1, .05)];
  });
  window.ATASIndicatorFiles["stderrbands"] = { ...{"id": "stderrbands", "name": "Standard Error Bands", "sourceClass": "StdErrBands", "sourceFile": "Technical/StdErrBands.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_stderr_bands"}, moduleFile: "indicators/individual/stderrbands.js", moduleType: "primary" };
})();
