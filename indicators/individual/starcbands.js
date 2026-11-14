/* ATAS indicator module: Starc Bands (StarcBands) | source: Technical/StarcBands.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_starc', 'STARC Bands', 'ov', 'SMA basis ± ATR × multiplier.', [['period', 'SMA period', 20, 'i', { min: 1 }], ['atrPeriod', 'ATR period', 15, 'i', { min: 1 }], ['mult', 'ATR multiplier', 2, 'n', { min: .1, step: .1 }]], [C.a, C.b], ['Upper', 'Lower'], (A, p) => {
    const mid = sma(A.c, p.period), atr = atATR(A, p.atrPeriod), u = mid.map((v, i) => v == null || atr[i] == null ? null : v + atr[i] * p.mult), l = mid.map((v, i) => v == null || atr[i] == null ? null : v - atr[i] * p.mult);
    return [line(u), line(l, 1), fill(u, l, 1, .07)];
  });
  window.ATASIndicatorFiles["starcbands"] = { ...{"id": "starcbands", "name": "Starc Bands", "sourceClass": "StarcBands", "sourceFile": "Technical/StarcBands.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_starc"}, moduleFile: "indicators/individual/starcbands.js", moduleType: "primary" };
})();
