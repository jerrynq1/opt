/* ATAS indicator module: Bill Williams AC (ACBW) | source: Technical/ACBW.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_acbw', 'Bill Williams AC (ATAS)', 'osc', 'Port Technical/ACBW.cs: SMA(Close, ShortPeriod) − SMA(Close, LongPeriod), rồi trừ SMA của chênh lệch. Default Short=50, Long=51, Signal=50.', [['long', 'Long period', 51, 'i', { min: 1, max: 10000 }], ['short', 'Short period', 50, 'i', { min: 1, max: 10000 }], ['signal', 'Signal period', 50, 'i', { min: 1, max: 10000 }]], [C.d, C.e], ['AC'], (A, p) => {
    const short = sma(A.c, p.short), long = sma(A.c, p.long);
    const diff = short.map((v, i) => v == null || long[i] == null ? null : v - long[i]);
    const signal = sma(diff, p.signal);
    return [hist(diff.map((v, i) => v == null || signal[i] == null ? null : v - signal[i]))];
  }, { hl: [{ y: 0, al: .5 }] });
  window.ATASIndicatorFiles["acbw"] = { ...{"id": "acbw", "name": "Bill Williams AC", "sourceClass": "ACBW", "sourceFile": "Technical/ACBW.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_acbw"}, moduleFile: "indicators/individual/acbw.js", moduleType: "primary" };
})();
