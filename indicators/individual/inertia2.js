/* ATAS indicator module: Inertia V2 (Inertia2) | source: Technical/Inertia2.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_inertia2', 'Inertia V2 (proxy)', 'osc', 'Second Inertia variant approximated by smoothed regression slope of RSI; ATAS-specific alternate formula is not byte-identical.', [['period', 'Period', 20, 'i', { min: 2 }]], [C.a], ['Inertia V2'], (A, p) => { const r = rsiOf(A.c, p.period), lr = atLinRegEnd(r, p.period); return [line(ema(lr, Math.max(2, Math.floor(p.period / 3))))]; }, { hl: [{ y: 50, al: .25 }] });
  window.ATASIndicatorFiles["inertia2"] = { ...{"id": "inertia2", "name": "Inertia V2", "sourceClass": "Inertia2", "sourceFile": "Technical/Inertia2.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_inertia2"}, moduleFile: "indicators/individual/inertia2.js", moduleType: "primary" };
})();
