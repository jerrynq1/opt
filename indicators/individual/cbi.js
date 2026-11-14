/* ATAS indicator module: Connie Brown Composite Index (CBI) | source: Technical/CBI.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_cbi', 'Connie Brown Composite Index (proxy)', 'osc', 'Composite RSI + RSI momentum, with fast/slow smoothing. Exact ATAS parameterization may differ.', [['rsi', 'RSI period', 14, 'i', { min: 1 }], ['momentum', 'RSI momentum', 9, 'i', { min: 1 }], ['fast', 'Fast SMA', 3, 'i', { min: 1 }], ['slow', 'Slow SMA', 13, 'i', { min: 1 }]], [C.a, C.b], ['CBI', 'Signal'], (A, p) => { const r = rsiOf(A.c, p.rsi), cbi = r.map((v, i) => v == null || i < p.momentum || r[i - p.momentum] == null ? null : v + (v - r[i - p.momentum])); return [line(sma(cbi, p.fast), 0), line(sma(cbi, p.slow), 1)]; }, { hl: [{ y: 0, al: .25 }] });
  window.ATASIndicatorFiles["cbi"] = { ...{"id": "cbi", "name": "Connie Brown Composite Index", "sourceClass": "CBI", "sourceFile": "Technical/CBI.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_cbi"}, moduleFile: "indicators/individual/cbi.js", moduleType: "primary" };
})();
