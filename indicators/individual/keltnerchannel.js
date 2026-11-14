/* ATAS indicator module: Keltner Channel (KeltnerChannel) | source: Technical/KeltnerChannel.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_keltner', 'Keltner Channel', 'ov', 'EMA basis ± ATR × multiplier.', [['period', 'EMA period', 20, 'i', { min: 1 }], ['atrPeriod', 'ATR period', 10, 'i', { min: 1 }], ['mult', 'ATR multiplier', 2, 'n', { min: .1, max: 20, step: .1 }]], [C.a, C.b], ['Upper', 'Lower'], (A, p) => {
    const mid = ema(A.c, p.period), atr = atATR(A, p.atrPeriod), up = mid.map((v, i) => v == null || atr[i] == null ? null : v + atr[i] * p.mult), lo = mid.map((v, i) => v == null || atr[i] == null ? null : v - atr[i] * p.mult);
    return [line(up, 0), line(lo, 1), fill(up, lo, 1, .08)];
  });
  window.ATASIndicatorFiles["keltnerchannel"] = { ...{"id": "keltnerchannel", "name": "Keltner Channel", "sourceClass": "KeltnerChannel", "sourceFile": "Technical/KeltnerChannel.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_keltner"}, moduleFile: "indicators/individual/keltnerchannel.js", moduleType: "primary" };
})();
