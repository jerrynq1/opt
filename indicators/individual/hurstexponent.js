/* ATAS indicator module: Hurst Exponent (HurstExponent) | source: Technical/HurstExponent.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_hurst', 'Hurst Exponent', 'osc', 'Rolling rescaled-range Hurst estimate from Close returns; short samples are noisy and not a prediction.', [['period', 'Period', 64, 'i', { min: 16, max: 256 }]], [C.a], ['Hurst'], (A, p) => [line(atRoll(A.c, p.period, w => {
    const r = w.slice(1).map((x, i) => x - w[i]), mean = r.reduce((s, x) => s + x, 0) / r.length; let cum = 0, hi = -Infinity, lo = Infinity, ss = 0;
    for (const x of r) { cum += x - mean; hi = Math.max(hi, cum); lo = Math.min(lo, cum); ss += (x - mean) ** 2; }
    const sd = Math.sqrt(ss / r.length), rs = sd ? (hi - lo) / sd : 0; return rs > 0 && r.length > 1 ? Math.log(rs) / Math.log(r.length) : null;
  }))]);
  window.ATASIndicatorFiles["hurstexponent"] = { ...{"id": "hurstexponent", "name": "Hurst Exponent", "sourceClass": "HurstExponent", "sourceFile": "Technical/HurstExponent.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_hurst"}, moduleFile: "indicators/individual/hurstexponent.js", moduleType: "primary" };
})();
