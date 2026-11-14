/* ATAS indicator module: MACD Leader (MacdLeader) | source: Technical/MacdLeader.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_macd_leader', 'MACD Leader', 'osc', 'Ehlers-style MACD Leader proxy: MACD histogram plus smoothed histogram momentum.', [['fast', 'Fast EMA', 12, 'i', { min: 1 }], ['slow', 'Slow EMA', 26, 'i', { min: 2 }], ['signal', 'Signal EMA', 9, 'i', { min: 1 }]], [C.a], ['MACD Leader'], (A, p) => { const m = ema(A.c, p.fast).map((v, i) => v == null ? null : v - ema(A.c, p.slow)[i]), sig = ema(m, p.signal), h = m.map((v, i) => v == null || sig[i] == null ? null : v - sig[i]); return [line(h.map((v, i) => v == null ? null : v + (i ? v - h[i - 1] || 0 : 0)))]; }, { hl: [{ y: 0, al: .4 }] });
  window.ATASIndicatorFiles["macdleader"] = { ...{"id": "macdleader", "name": "MACD Leader", "sourceClass": "MacdLeader", "sourceFile": "Technical/MacdLeader.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_macd_leader"}, moduleFile: "indicators/individual/macdleader.js", moduleType: "primary" };
})();
