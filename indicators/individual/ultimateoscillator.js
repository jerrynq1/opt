/* ATAS indicator module: Ultimate Oscillator (UltimateOscillator) | source: Technical/UltimateOscillator.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_ultimate', 'Ultimate Oscillator', 'osc', 'Ultimate Oscillator kết hợp buying pressure ở 7/14/28 kỳ.', [['p1', 'Short', 7, 'i', { min: 1 }], ['p2', 'Medium', 14, 'i', { min: 2 }], ['p3', 'Long', 28, 'i', { min: 3 }]], [C.a], ['UO'], (A, p) => {
    const bp = A.c.map((v, i) => v - Math.min(A.l[i], i ? A.c[i - 1] : A.l[i]));
    const tr = A.c.map((v, i) => Math.max(A.h[i], i ? A.c[i - 1] : A.h[i]) - Math.min(A.l[i], i ? A.c[i - 1] : A.l[i]));
    const ratio = k => { const b = atSum(bp, k), t = atSum(tr, k); return b.map((v, i) => v == null || !t[i] ? null : v / t[i]); };
    const a = ratio(p.p1), b = ratio(p.p2), c = ratio(p.p3);
    return [line(a.map((v, i) => v == null || b[i] == null || c[i] == null ? null : 100 * (4 * v + 2 * b[i] + c[i]) / 7))];
  }, { hl: [{ y: 50, al: .5 }] });
  window.ATASIndicatorFiles["ultimateoscillator"] = { ...{"id": "ultimateoscillator", "name": "Ultimate Oscillator", "sourceClass": "UltimateOscillator", "sourceFile": "Technical/UltimateOscillator.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_ultimate"}, moduleFile: "indicators/individual/ultimateoscillator.js", moduleType: "primary" };
})();
