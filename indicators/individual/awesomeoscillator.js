/* ATAS indicator module: Awesome Oscillator (AwesomeOscillator) | source: Technical/AO.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_ao', 'Awesome Oscillator', 'osc', 'AO = SMA( median, 5 ) − SMA( median, 34 ).', [], [C.a, C.e], ['AO'], A => {
    const m = atMedian(A), a = sma(m, 5), b = sma(m, 34);
    return [hist(a.map((v, i) => v == null || b[i] == null ? null : v - b[i]))];
  }, { hl: [{ y: 0, al: .5 }] });
  window.ATASIndicatorFiles["awesomeoscillator"] = { ...{"id": "awesomeoscillator", "name": "Awesome Oscillator", "sourceClass": "AwesomeOscillator", "sourceFile": "Technical/AO.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_ao"}, moduleFile: "indicators/individual/awesomeoscillator.js", moduleType: "primary" };
})();
