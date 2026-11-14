/* ATAS indicator module: Chaikin Oscillator (ChaikinOscillator) | source: Technical/ChaikinOscillator.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_chaikin', 'Chaikin Oscillator', 'osc', 'Chênh lệch EMA 3 và EMA 10 của Accumulation/Distribution Line.', [], [C.a], ['Chaikin Oscillator'], A => { const ad = atADL(A); return [hist(ema(ad, 3).map((v, i) => v == null ? null : v - ema(ad, 10)[i]))]; }, { hl: [{ y: 0, al: .5 }] });
  window.ATASIndicatorFiles["chaikinoscillator"] = { ...{"id": "chaikinoscillator", "name": "Chaikin Oscillator", "sourceClass": "ChaikinOscillator", "sourceFile": "Technical/ChaikinOscillator.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_chaikin"}, moduleFile: "indicators/individual/chaikinoscillator.js", moduleType: "primary" };
})();
