/* ATAS indicator module: Bollinger Bands: Percentage (BollingerBandsPercent) | source: Technical/BollingerBandsPercent.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_bbpct', 'Bollinger %B', 'osc', '%B = (Close − Lower) / (Upper − Lower).', [['period', 'Period', 20, 'i', { min: 1 }], ['mult', 'Deviation', 2, 'n', { min: .1, step: .1 }]], [C.a], ['%B'], (A, p) => { const m = sma(A.c, p.period), sd = sdv(A.c, p.period); return [line(A.c.map((v, i) => m[i] == null || !sd[i] ? null : (v - (m[i] - p.mult * sd[i])) / (2 * p.mult * sd[i])))]; }, { hl: [{ y: 1, al: .3 }, { y: 0, al: .3 }] });
  window.ATASIndicatorFiles["bollingerbandspercent"] = { ...{"id": "bollingerbandspercent", "name": "Bollinger Bands: Percentage", "sourceClass": "BollingerBandsPercent", "sourceFile": "Technical/BollingerBandsPercent.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_bbpct"}, moduleFile: "indicators/individual/bollingerbandspercent.js", moduleType: "primary" };
})();
