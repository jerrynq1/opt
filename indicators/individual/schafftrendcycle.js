/* ATAS indicator module: Schaff Trend Cycle (SchaffTrendCycle) | source: Technical/SchaffTrendCycle.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_schaff', 'Schaff Trend Cycle', 'osc', 'STC: Stochastic của MACD rồi làm mượt EMA hai vòng.', [['fast', 'Fast EMA', 23, 'i', { min: 1 }], ['slow', 'Slow EMA', 50, 'i', { min: 2 }], ['cycle', 'Cycle', 10, 'i', { min: 1 }], ['smooth', 'Smoothing', 3, 'i', { min: 1 }]], [C.a], ['STC'], (A, p) => {
    const m = ema(A.c, p.fast).map((v, i) => v == null ? null : v - ema(A.c, p.slow)[i]), h = atMax(m, p.cycle), l = atMin(m, p.cycle);
    const s1 = m.map((v, i) => h[i] == null || h[i] === l[i] ? null : 100 * (v - l[i]) / (h[i] - l[i])), e1 = ema(s1, p.smooth), h2 = atMax(e1, p.cycle), l2 = atMin(e1, p.cycle);
    const s2 = e1.map((v, i) => h2[i] == null || h2[i] === l2[i] ? null : 100 * (v - l2[i]) / (h2[i] - l2[i])); return [line(ema(s2, p.smooth))];
  }, { hl: [{ y: 75, al: .4 }, { y: 25, al: .4 }] });
  window.ATASIndicatorFiles["schafftrendcycle"] = { ...{"id": "schafftrendcycle", "name": "Schaff Trend Cycle", "sourceClass": "SchaffTrendCycle", "sourceFile": "Technical/SchaffTrendCycle.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_schaff"}, moduleFile: "indicators/individual/schafftrendcycle.js", moduleType: "primary" };
})();
