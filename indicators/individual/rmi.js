/* ATAS indicator module: Relative Momentum Index (RMI) | source: Technical/RMI.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_rmi', 'Relative Momentum Index', 'osc', 'RMI thay đổi RSI bằng momentum cách N nến.', [['period', 'Period', 14, 'i', { min: 1 }], ['momentum', 'Momentum lag', 5, 'i', { min: 1 }]], [C.a], ['RMI'], (A, p) => {
    const up = Array(A.c.length).fill(null), dn = Array(A.c.length).fill(null), k = P_(p.momentum);
    for (let i = k; i < A.c.length; i++) { const d = A.c[i] - A.c[i - k]; up[i] = Math.max(0, d); dn[i] = Math.max(0, -d); }
    const u = rma(up, p.period), d = rma(dn, p.period); return [line(u.map((v, i) => v == null || d[i] == null ? null : d[i] === 0 ? 100 : 100 - 100 / (1 + v / d[i])))];
  }, { hl: [{ y: 70, al: .4 }, { y: 30, al: .4 }] });
  window.ATASIndicatorFiles["rmi"] = { ...{"id": "rmi", "name": "Relative Momentum Index", "sourceClass": "RMI", "sourceFile": "Technical/RMI.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_rmi"}, moduleFile: "indicators/individual/rmi.js", moduleType: "primary" };
})();
