/* ATAS indicator module: Stochastic (Stochastic) | source: Technical/Stochastic.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_stoch', 'Stochastic Oscillator', 'osc', 'Stochastic %K và %D từ high/low range.', [['period', 'Lookback', 14, 'i', { min: 1 }], ['smoothK', 'Smooth K', 3, 'i', { min: 1 }], ['smoothD', 'Smooth D', 3, 'i', { min: 1 }]], [C.a, C.b], ['%K', '%D'], (A, p) => { const x = atStoch(A, p.period, p.smoothK, p.smoothD); return [line(x.k, 0), line(x.d, 1)]; }, { hl: [{ y: 80, al: .35 }, { y: 20, al: .35 }] });
  window.ATASIndicatorFiles["stochastic"] = { ...{"id": "stochastic", "name": "Stochastic", "sourceClass": "Stochastic", "sourceFile": "Technical/Stochastic.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_stoch"}, moduleFile: "indicators/individual/stochastic.js", moduleType: "primary" };
})();
