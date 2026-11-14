/* ATAS indicator module: Super Trend (SuperTrend) | source: Technical/SuperTrend.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_supertrend', 'SuperTrend (ATAS-style)', 'ov', 'SuperTrend dựa trên ATR; màu chuyển theo hướng trend.', [['period', 'ATR period', 14, 'i', { min: 1 }], ['mult', 'Multiplier', 1.7, 'n', { min: .1, max: 20, step: .1 }]], [C.up, C.dn], ['Trend'], (A, p) => {
    const atr = atATR(A, p.period), mid = atMedian(A), upper = mid.map((v, i) => atr[i] == null ? null : v + p.mult * atr[i]), lower = mid.map((v, i) => atr[i] == null ? null : v - p.mult * atr[i]);
    const st = Array(A.c.length).fill(null); let dir = 1, fu = null, fl = null;
    for (let i = 0; i < A.c.length; i++) {
      if (upper[i] == null) continue;
      fu = fu == null || upper[i] < fu || A.c[i - 1] > fu ? upper[i] : fu;
      fl = fl == null || lower[i] > fl || A.c[i - 1] < fl ? lower[i] : fl;
      if (dir > 0 && A.c[i] < fl) dir = -1; else if (dir < 0 && A.c[i] > fu) dir = 1;
      st[i] = dir > 0 ? fl : fu;
    }
    return [line(st)];
  });
  window.ATASIndicatorFiles["supertrend"] = { ...{"id": "supertrend", "name": "Super Trend", "sourceClass": "SuperTrend", "sourceFile": "Technical/SuperTrend.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_supertrend"}, moduleFile: "indicators/individual/supertrend.js", moduleType: "primary" };
})();
