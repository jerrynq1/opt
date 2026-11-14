/* ATAS indicator module: Moving Average Envelope (MaEnvelope) | source: Technical/MaEnvelope.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_maenvelope', 'Moving Average Envelope', 'ov', 'Hai dải phần trăm quanh SMA.', [['period', 'MA period', 20, 'i', { min: 1 }], ['pct', 'Envelope %', 2.5, 'n', { min: .01, max: 50, step: .1 }]], [C.a, C.b], ['Upper', 'Lower'], (A, p) => {
    const m = sma(A.c, p.period), u = m.map(v => v == null ? null : v * (1 + p.pct / 100)), l = m.map(v => v == null ? null : v * (1 - p.pct / 100));
    return [line(u), line(l, 1), fill(u, l, 1, .06)];
  });
  window.ATASIndicatorFiles["maenvelope"] = { ...{"id": "maenvelope", "name": "Moving Average Envelope", "sourceClass": "MaEnvelope", "sourceFile": "Technical/MaEnvelope.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_maenvelope"}, moduleFile: "indicators/individual/maenvelope.js", moduleType: "primary" };
})();
