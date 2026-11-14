/* ATAS indicator module: Stochastic RSI (StochasticRsi) | source: Technical/StochasticRsi.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_stochrsi', 'Stochastic RSI', 'osc', 'Stochastic transform của RSI.', [['rsi', 'RSI period', 14, 'i', { min: 1 }], ['period', 'Stochastic period', 14, 'i', { min: 1 }], ['smooth', 'Smooth K', 3, 'i', { min: 1 }], ['signal', 'Smooth D', 3, 'i', { min: 1 }]], [C.a, C.b], ['%K', '%D'], (A, p) => {
    const r = rsiOf(A.c, p.rsi), hh = atMax(r, p.period), ll = atMin(r, p.period);
    const raw = r.map((v, i) => v == null || hh[i] == null || hh[i] === ll[i] ? null : 100 * (v - ll[i]) / (hh[i] - ll[i]));
    const k = sma(raw, p.smooth), d = sma(k, p.signal); return [line(k, 0), line(d, 1)];
  }, { hl: [{ y: 80, al: .5 }, { y: 20, al: .5 }] });
  window.ATASIndicatorFiles["stochasticrsi"] = { ...{"id": "stochasticrsi", "name": "Stochastic RSI", "sourceClass": "StochasticRsi", "sourceFile": "Technical/StochasticRsi.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_stochrsi"}, moduleFile: "indicators/individual/stochasticrsi.js", moduleType: "primary" };
})();
