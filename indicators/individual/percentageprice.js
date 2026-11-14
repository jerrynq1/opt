/* ATAS indicator module: Percentage Price Oscillator (PercentagePrice) | source: Technical/PercentagePrice.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_ppo', 'Percentage Price Oscillator', 'osc', 'PPO = (EMA ngắn − EMA dài) / EMA dài × 100.', [['short', 'Short EMA', 12, 'i', { min: 1 }], ['long', 'Long EMA', 26, 'i', { min: 2 }], ['signal', 'Signal', 9, 'i', { min: 1 }]], [C.a, C.b], ['PPO', 'Signal'], (A, p) => { const a = ema(A.c, p.short), b = ema(A.c, p.long), x = a.map((v, i) => b[i] ? 100 * (v - b[i]) / b[i] : null); return [line(x), line(ema(x, p.signal), 1)]; }, { hl: [{ y: 0, al: .5 }] });
  window.ATASIndicatorFiles["percentageprice"] = { ...{"id": "percentageprice", "name": "Percentage Price Oscillator", "sourceClass": "PercentagePrice", "sourceFile": "Technical/PercentagePrice.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_ppo"}, moduleFile: "indicators/individual/percentageprice.js", moduleType: "primary" };
})();
