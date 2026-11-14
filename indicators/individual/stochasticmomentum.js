/* ATAS indicator module: Stochastic Momentum (StochasticMomentum) | source: Technical/StochasticMomentum.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_smi', 'Stochastic Momentum Index', 'osc', 'SMI chuẩn hóa vị trí Close quanh midpoint rolling high-low và làm mượt.', [['period', 'Lookback', 14, 'i', { min: 1 }], ['smooth', 'Smooth', 3, 'i', { min: 1 }], ['signal', 'Signal', 3, 'i', { min: 1 }]], [C.a, C.b], ['SMI', 'Signal'], (A, p) => {
    const h = atMax(A.h, p.period), l = atMin(A.l, p.period), rel = A.c.map((v, i) => h[i] == null || l[i] == null ? null : v - (h[i] + l[i]) / 2), rng = h.map((v, i) => v == null || l[i] == null ? null : v - l[i]);
    const nume = ema(ema(rel, p.smooth), p.smooth), den = ema(ema(rng, p.smooth), p.smooth); const smi = nume.map((v, i) => v == null || !den[i] ? null : 200 * v / den[i]); return [line(smi), line(ema(smi, p.signal), 1)];
  }, { hl: [{ y: 40, al: .3 }, { y: -40, al: .3 }] });
  window.ATASIndicatorFiles["stochasticmomentum"] = { ...{"id": "stochasticmomentum", "name": "Stochastic Momentum", "sourceClass": "StochasticMomentum", "sourceFile": "Technical/StochasticMomentum.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_smi"}, moduleFile: "indicators/individual/stochasticmomentum.js", moduleType: "primary" };
})();
