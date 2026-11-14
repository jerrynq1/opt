/* ATAS indicator module: Adaptive RSI Moving Average (AdaptiveRsiAverage) | source: Technical/AdaptiveRsiAverage.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_adaptive_rsi_ma', 'Adaptive RSI Moving Average', 'ov', 'Giá được EMA smooth, RSI được làm mượt; adaptive factor = 2 × Scale × |RSI/100 − 0.5| như source.', [['period', 'RSI period', 14, 'i', { min: 1 }], ['priceSmooth', 'Price EMA', 10, 'i', { min: 1 }], ['rsiSmooth', 'RSI EMA', 10, 'i', { min: 1 }], ['scale', 'Scale', .5, 'n', { min: .01, max: 2, step: .05 }]], [C.a], ['Adaptive RSI MA'], (A, p) => {
    const price = ema(A.c, p.priceSmooth), r = ema(rsiOf(price, p.period), p.rsiSmooth), out = Array(A.c.length).fill(null); let prev = null;
    for (let i = 0; i < out.length; i++) { if (price[i] == null || r[i] == null) continue; const sf = 2 * p.scale * Math.abs(r[i] / 100 - .5); prev = i <= P_(p.period) || prev == null ? price[i] : prev + (price[i] - prev) * sf; out[i] = prev; } return [line(out)];
  });
  window.ATASIndicatorFiles["adaptiversiaverage"] = { ...{"id": "adaptiversiaverage", "name": "Adaptive RSI Moving Average", "sourceClass": "AdaptiveRsiAverage", "sourceFile": "Technical/AdaptiveRsiAverage.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_adaptive_rsi_ma"}, moduleFile: "indicators/individual/adaptiversiaverage.js", moduleType: "primary" };
})();
