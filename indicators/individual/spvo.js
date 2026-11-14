/* ATAS indicator module: Simple Percentage Volume Oscillator (SPVO) | source: Technical/SPVO.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_volume_oscillator', 'Simple Percentage Volume Oscillator', 'osc', 'Percentage difference between fast and slow EMA of chart volume.', [['fast', 'Fast EMA', 5, 'i', { min: 1 }], ['slow', 'Slow EMA', 10, 'i', { min: 2 }]], [C.a], ['SPVO'], (A, p) => { const f = ema(A.v.map(n), p.fast), s = ema(A.v.map(n), p.slow); return [line(f.map((v, i) => s[i] ? 100 * (v - s[i]) / s[i] : null))]; }, { pf: 'vol', hl: [{ y: 0, al: .35 }] });
  window.ATASIndicatorFiles["spvo"] = { ...{"id": "spvo", "name": "Simple Percentage Volume Oscillator", "sourceClass": "SPVO", "sourceFile": "Technical/SPVO.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_volume_oscillator"}, moduleFile: "indicators/individual/spvo.js", moduleType: "primary" };
})();
