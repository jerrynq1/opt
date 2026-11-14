/* ATAS indicator module: Random Walk Indicator (RWI) | source: Technical/RWI.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_rwi', 'Random Walk Indicator', 'osc', 'RWI High/Low calculated from recent extreme versus ATR × sqrt(period); simplified highest/lowest window.', [['period', 'Period', 14, 'i', { min: 2 }]], [C.d, C.e], ['RWI High', 'RWI Low'], (A, p) => { const atr = atATR(A, p.period), up = [], dn = []; for (let i = 0; i < A.c.length; i++) { const h = atMax(A.h, p.period)[i], l = atMin(A.l, p.period)[i]; up.push(i >= p.period && atr[i] ? (h - A.l[i]) / (atr[i] * Math.sqrt(p.period)) : null); dn.push(i >= p.period && atr[i] ? (A.h[i] - l) / (atr[i] * Math.sqrt(p.period)) : null); } return [line(up, 0), line(dn, 1)]; });
  window.ATASIndicatorFiles["rwi"] = { ...{"id": "rwi", "name": "Random Walk Indicator", "sourceClass": "RWI", "sourceFile": "Technical/RWI.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_rwi"}, moduleFile: "indicators/individual/rwi.js", moduleType: "primary" };
})();
