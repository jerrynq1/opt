/* ATAS indicator module: Squeeze Momentum (SqueezeMomentum) | source: Technical/SqueezeMomentum.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_squeeze_momentum', 'Squeeze Momentum', 'osc', 'BB/Keltner squeeze state with linear-regression momentum proxy; uses OHLCV only.', [['period', 'Period', 20, 'i', { min: 2 }], ['bbMult', 'BB multiplier', 2, 'n', { min: .1, step: .1 }], ['kcMult', 'KC multiplier', 1.5, 'n', { min: .1, step: .1 }]], [C.a, C.b], ['Momentum'], (A, p) => {
    const mid = sma(A.c, p.period), sd = sdv(A.c, p.period), atr = atATR(A, p.period), up = mid.map((v, i) => v == null || sd[i] == null ? null : v + p.bbMult * sd[i]), dn = mid.map((v, i) => v == null || sd[i] == null ? null : v - p.bbMult * sd[i]), ku = mid.map((v, i) => v == null || atr[i] == null ? null : v + p.kcMult * atr[i]), kd = mid.map((v, i) => v == null || atr[i] == null ? null : v - p.kcMult * atr[i]);
    const momentum = A.c.map((v, i) => { if (mid[i] == null) return null; const hi = atMax(A.h, p.period)[i], lo = atMin(A.l, p.period)[i]; const base = (hi + lo + mid[i]) / 3; return v - base; });
    const mom = atLinRegEnd(momentum, p.period), sq = up.map((v, i) => v == null || ku[i] == null ? null : v < ku[i] && dn[i] > kd[i] ? 1 : 0);
    return [hist(mom), line(sq.map(v => v ? 1 : 0), 1, 1)];
  }, { hl: [{ y: 0, al: .35 }] });
  window.ATASIndicatorFiles["squeezemomentum"] = { ...{"id": "squeezemomentum", "name": "Squeeze Momentum", "sourceClass": "SqueezeMomentum", "sourceFile": "Technical/SqueezeMomentum.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_squeeze_momentum"}, moduleFile: "indicators/individual/squeezemomentum.js", moduleType: "primary" };
})();
