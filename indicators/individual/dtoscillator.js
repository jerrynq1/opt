/* ATAS indicator module: DT Oscillator (DtOscillator) | source: Technical/DtOscillator.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_dt_oscillator', 'DT Oscillator', 'osc', 'Double-smoothed Stochastic RSI (%K/%D), dùng RSI và SMA smoothing theo các tham số source.', [['rsi', 'RSI period', 14, 'i', { min: 1 }], ['period', 'Stoch period', 14, 'i', { min: 1 }], ['smoothK', 'K smoothing', 3, 'i', { min: 1 }], ['smoothD', 'D smoothing', 3, 'i', { min: 1 }]], [C.a, C.b], ['SK', 'SD'], (A, p) => { const x = atStochRsi(A.c, p.rsi, p.period, p.smoothK, p.smoothD); return [line(x.k, 0), line(x.d, 1)]; }, { hl: [{ y: 80, al: .35 }, { y: 20, al: .35 }] });
  window.ATASIndicatorFiles["dtoscillator"] = { ...{"id": "dtoscillator", "name": "DT Oscillator", "sourceClass": "DtOscillator", "sourceFile": "Technical/DtOscillator.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_dt_oscillator"}, moduleFile: "indicators/individual/dtoscillator.js", moduleType: "primary" };
})();
