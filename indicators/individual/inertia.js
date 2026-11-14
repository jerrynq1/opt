/* ATAS indicator module: Inertia (Inertia) | source: Technical/Inertia.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_inertia', 'Inertia', 'osc', 'Linear-regression smoothing of RSI; commonly used as a trend/momentum filter.', [['period', 'Period', 20, 'i', { min: 2 }]], [C.a], ['Inertia'], (A, p) => [line(atLinRegEnd(rsiOf(A.c, p.period), p.period))], { hl: [{ y: 50, al: .25 }] });
  window.ATASIndicatorFiles["inertia"] = { ...{"id": "inertia", "name": "Inertia", "sourceClass": "Inertia", "sourceFile": "Technical/Inertia.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_inertia"}, moduleFile: "indicators/individual/inertia.js", moduleType: "primary" };
})();
