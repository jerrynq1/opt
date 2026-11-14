/* ATAS indicator module: KDJ (KDJ) | source: Technical/KDJ.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_kd', 'KD / KDJ', 'osc', 'KD/KDJ từ Stochastic %K và %D; J = 3K−2D.', [['period', 'Lookback', 9, 'i', { min: 1 }], ['smoothK', 'K smoothing', 3, 'i', { min: 1 }], ['smoothD', 'D smoothing', 3, 'i', { min: 1 }]], [C.a, C.b, C.c], ['K', 'D', 'J'], (A, p) => { const s = atStoch(A, p.period, p.smoothK, p.smoothD), j = s.k.map((v, i) => v == null || s.d[i] == null ? null : 3 * v - 2 * s.d[i]); return [line(s.k, 0), line(s.d, 1), line(j, 2)]; }, { hl: [{ y: 80, al: .4 }, { y: 20, al: .4 }] });
  window.ATASIndicatorFiles["kdj"] = { ...{"id": "kdj", "name": "KDJ", "sourceClass": "KDJ", "sourceFile": "Technical/KDJ.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_kd"}, moduleFile: "indicators/individual/kdj.js", moduleType: "primary" };
})();
