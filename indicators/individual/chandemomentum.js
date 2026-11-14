/* ATAS indicator module: Chande Momentum Oscillator (ChandeMomentum) | source: Technical/ChandeMomentum.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_cmo', 'Chande Momentum Oscillator', 'osc', 'Chande CMO: tổng biến động tăng/giảm của Close trong cửa sổ; không phải Chaikin Money Oscillator.', period(), [C.a], ['Chande CMO'], (A, p) => {
    const g = [0], l = [0]; for (let i = 1; i < A.c.length; i++) { const d = A.c[i] - A.c[i - 1]; g[i] = Math.max(0, d); l[i] = Math.max(0, -d); }
    const u = atSum(g, p.period), d = atSum(l, p.period); return [line(u.map((v, i) => v == null || v + d[i] === 0 ? null : 100 * (v - d[i]) / (v + d[i])))];
  }, { hl: [{ y: 0, al: .4 }, { y: 50, al: .3 }, { y: -50, al: .3 }] });
  window.ATASIndicatorFiles["chandemomentum"] = { ...{"id": "chandemomentum", "name": "Chande Momentum Oscillator", "sourceClass": "ChandeMomentum", "sourceFile": "Technical/ChandeMomentum.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_cmo"}, moduleFile: "indicators/individual/chandemomentum.js", moduleType: "primary" };
})();
