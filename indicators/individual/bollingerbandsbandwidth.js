/* ATAS indicator module: Bollinger Bands: Bandwidth (BollingerBandsBandwidth) | source: Technical/BollingerBandsBandwidth.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_bbw', 'Bollinger Bandwidth', 'osc', 'Bandwidth = (Upper − Lower) / Basis × 100.', [['period', 'Period', 20, 'i', { min: 1 }], ['mult', 'Deviation', 2, 'n', { min: .1, step: .1 }]], [C.a], ['Bandwidth'], (A, p) => { const m = sma(A.c, p.period), sd = sdv(A.c, p.period); return [line(m.map((v, i) => v == null || !v ? null : 200 * p.mult * sd[i] / Math.abs(v)))]; });
  window.ATASIndicatorFiles["bollingerbandsbandwidth"] = { ...{"id": "bollingerbandsbandwidth", "name": "Bollinger Bands: Bandwidth", "sourceClass": "BollingerBandsBandwidth", "sourceFile": "Technical/BollingerBandsBandwidth.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_bbw"}, moduleFile: "indicators/individual/bollingerbandsbandwidth.js", moduleType: "primary" };
})();
