/* ATAS indicator module: Moving Average Difference (MaDifference) | source: Technical/MaDifference.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_ma_difference', 'Moving Average Difference', 'osc', 'SMA nhanh trừ SMA chậm; mặc định 10 − 20 như source ATAS.', [['fast', 'SMA nhanh', 10, 'i', { min: 1 }], ['slow', 'SMA chậm', 20, 'i', { min: 2 }]], [C.a], ['MA Difference'], (A, p) => {
    const x = sma(A.c, P_(p.fast)), y = sma(A.c, P_(p.slow)); return [hist(x.map((v, i) => v == null || y[i] == null ? null : v - y[i]))];
  }, { hl: [{ y: 0, al: .4 }] });
  window.ATASIndicatorFiles["madifference"] = { ...{"id": "madifference", "name": "Moving Average Difference", "sourceClass": "MaDifference", "sourceFile": "Technical/MaDifference.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_ma_difference"}, moduleFile: "indicators/individual/madifference.js", moduleType: "primary" };
})();
