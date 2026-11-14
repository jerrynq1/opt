/* ATAS indicator module: AC DC Histogram (ACDC) | source: Technical/ACDC.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_acdc', 'AC DC Histogram (ATAS)', 'osc', 'Port Technical/ACDC.cs: AO = SMA(HL2, 5) − SMA(HL2, 34); output = SMA(AO − SMA(AO, 5), 10).', [['sma1', 'SMA period 1', 34, 'i', { min: 1, max: 10000 }], ['sma2', 'SMA period 2', 5, 'i', { min: 1, max: 10000 }], ['sma3', 'SMA period 3', 10, 'i', { min: 1, max: 10000 }], ['sma4', 'SMA period 4', 5, 'i', { min: 1, max: 10000 }]], [C.d, C.e], ['AC DC'], (A, p) => {
    const midpoint = atMedian(A), slow = sma(midpoint, p.sma1), fast = sma(midpoint, p.sma2);
    const ao = fast.map((v, i) => v == null || slow[i] == null ? null : v - slow[i]);
    const aoSma = sma(ao, p.sma4);
    const ac = ao.map((v, i) => v == null || aoSma[i] == null ? null : v - aoSma[i]);
    return [hist(sma(ac, p.sma3))];
  }, { hl: [{ y: 0, al: .5 }] });
  window.ATASIndicatorFiles["acdc"] = { ...{"id": "acdc", "name": "AC DC Histogram", "sourceClass": "ACDC", "sourceFile": "Technical/ACDC.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_acdc"}, moduleFile: "indicators/individual/acdc.js", moduleType: "primary" };
})();
