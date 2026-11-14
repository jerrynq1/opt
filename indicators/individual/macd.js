/* ATAS indicator module: MACD (MACD) | source: Technical/MACD.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_macd', 'MACD', 'osc', 'MACD = EMA nhanh − EMA chậm, kèm Signal và Histogram.', [['fast', 'Fast', 12, 'i', { min: 1 }], ['slow', 'Slow', 26, 'i', { min: 2 }], ['signal', 'Signal', 9, 'i', { min: 1 }]], [C.a, C.b, C.d], ['MACD', 'Signal', 'Histogram'], (A, p) => {
    const f = ema(A.c, p.fast), sl = ema(A.c, p.slow), m = f.map((v, i) => v == null || sl[i] == null ? null : v - sl[i]), sig = ema(m, p.signal);
    return [line(m, 0), line(sig, 1), hist(m.map((v, i) => v == null || sig[i] == null ? null : v - sig[i]), 2)];
  }, { hl: [{ y: 0, al: .4 }] });
  window.ATASIndicatorFiles["macd"] = { ...{"id": "macd", "name": "MACD", "sourceClass": "MACD", "sourceFile": "Technical/MACD.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_macd"}, moduleFile: "indicators/individual/macd.js", moduleType: "primary" };
})();
