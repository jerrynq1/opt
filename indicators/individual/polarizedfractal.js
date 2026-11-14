/* ATAS indicator module: Polarized Fractal Efficiency (PolarizedFractal) | source: Technical/PolarizedFractal.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_pfe', 'Polarized Fractal Efficiency', 'osc', 'PFE theo khoảng cách net/path và EMA smoothing; OHLC close-only implementation.', [['period', 'Period', 10, 'i', { min: 2 }], ['smooth', 'EMA smooth', 10, 'i', { min: 1 }]], [C.a], ['PFE'], (A, p) => [line(atPFE(A.c, p.period, p.smooth))], { hl: [{ y: 0, al: .4 }] });
  window.ATASIndicatorFiles["polarizedfractal"] = { ...{"id": "polarizedfractal", "name": "Polarized Fractal Efficiency", "sourceClass": "PolarizedFractal", "sourceFile": "Technical/PolarizedFractal.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_pfe"}, moduleFile: "indicators/individual/polarizedfractal.js", moduleType: "primary" };
})();
