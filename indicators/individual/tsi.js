/* ATAS indicator module: True Strength Index (TSI) | source: Technical/TSI.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_tsi', 'True Strength Index', 'osc', 'TSI = EMA(EMA(momentum, slow), fast) / EMA(EMA(abs(momentum), slow), fast).', [['slow', 'Slow', 25, 'i', { min: 1, max: 200 }], ['fast', 'Fast', 13, 'i', { min: 1, max: 100 }]], [C.a], ['TSI'], (A, p) => {
    const m = atMom(A.c, 1), am = m.map(v => v == null ? null : Math.abs(v));
    const nume = ema(ema(m, p.slow), p.fast), den = ema(ema(am, p.slow), p.fast);
    return [line(nume.map((v, i) => v == null || !den[i] ? null : 100 * v / den[i]))];
  }, { hl: [{ y: 0, al: .5 }] });
  window.ATASIndicatorFiles["tsi"] = { ...{"id": "tsi", "name": "True Strength Index", "sourceClass": "TSI", "sourceFile": "Technical/TSI.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_tsi"}, moduleFile: "indicators/individual/tsi.js", moduleType: "primary" };
})();
