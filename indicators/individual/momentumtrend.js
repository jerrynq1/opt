/* ATAS indicator module: Momentum Trend (MomentumTrend) | source: Technical/MomentumTrend.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_momentum_trend', 'Momentum Trend', 'osc', 'Momentum direction based on short and long EMA spread, with a smoothed signal.', [['fast', 'Fast EMA', 10, 'i', { min: 1 }], ['slow', 'Slow EMA', 30, 'i', { min: 2 }], ['signal', 'Signal', 5, 'i', { min: 1 }]], [C.a, C.b], ['Trend', 'Signal'], (A, p) => { const f = ema(A.c, p.fast), s = ema(A.c, p.slow), x = f.map((v, i) => v == null || s[i] == null ? null : v - s[i]), sig = ema(x, p.signal); return [line(x, 0), line(sig, 1)]; }, { hl: [{ y: 0, al: .35 }] });
  window.ATASIndicatorFiles["momentumtrend"] = { ...{"id": "momentumtrend", "name": "Momentum Trend", "sourceClass": "MomentumTrend", "sourceFile": "Technical/MomentumTrend.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_momentum_trend"}, moduleFile: "indicators/individual/momentumtrend.js", moduleType: "primary" };
})();
