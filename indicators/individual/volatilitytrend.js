/* ATAS indicator module: Volatility Trend (VolatilityTrend) | source: Technical/VolatilityTrend.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_volatility_trend', 'Volatility Trend (proxy)', 'ov', 'ATR trailing volatility trend with direction-persistence lookback. Source-specific dynamic counter is approximated in the browser port.', [['atr', 'ATR period', 10, 'i', { min: 1 }], ['maxPeriod', 'Max dynamic period', 15, 'i', { min: 1 }]], [C.d, C.e], ['Volatility Trend'], (A, p) => {
    const atr = atATR(A, p.atr), out = Array(A.c.length).fill(null); let dir = 0, run = 0, prev = null;
    for (let i = 0; i < A.c.length; i++) { if (i === 0 || prev == null || atr[i] == null) { prev = A.c[i]; continue; } const nextDir = A.c[i] > prev ? 1 : -1; run = nextDir === dir ? Math.min(P_(p.maxPeriod), run + 1) : 1; dir = nextDir; const win = Math.max(1, run); const hi = Math.max(...A.h.slice(Math.max(0, i - win + 1), i + 1)), lo = Math.min(...A.l.slice(Math.max(0, i - win + 1), i + 1)); out[i] = dir > 0 ? hi - atr[i] : lo + atr[i]; prev = A.c[i]; }
    return [line(out)];
  });
  window.ATASIndicatorFiles["volatilitytrend"] = { ...{"id": "volatilitytrend", "name": "Volatility Trend", "sourceClass": "VolatilityTrend", "sourceFile": "Technical/VolatilityTrend.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_volatility_trend"}, moduleFile: "indicators/individual/volatilitytrend.js", moduleType: "primary" };
})();
