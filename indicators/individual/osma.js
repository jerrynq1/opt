/* ATAS indicator module: Moving Average of Oscillator (OSMA) | source: Technical/OSMA.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_macd_osma', 'Moving Average of Oscillator (OSMA)', 'osc', 'OSMA = MACD − Signal line.', [['fast', 'Fast EMA', 12, 'i', { min: 1 }], ['slow', 'Slow EMA', 26, 'i', { min: 2 }], ['signal', 'Signal EMA', 9, 'i', { min: 1 }]], [C.a], ['OSMA'], (A, p) => { const f = ema(A.c, p.fast), s = ema(A.c, p.slow), m = f.map((v, i) => v == null || s[i] == null ? null : v - s[i]), sig = ema(m, p.signal); return [hist(m.map((v, i) => v == null || sig[i] == null ? null : v - sig[i]))]; }, { hl: [{ y: 0, al: .4 }] });
  window.ATASIndicatorFiles["osma"] = { ...{"id": "osma", "name": "Moving Average of Oscillator", "sourceClass": "OSMA", "sourceFile": "Technical/OSMA.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_macd_osma"}, moduleFile: "indicators/individual/osma.js", moduleType: "primary" };
})();
