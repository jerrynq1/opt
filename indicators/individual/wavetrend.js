/* ATAS indicator module: Wavetrend (Wavetrend) | source: Technical/Wavetrend.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_wavetrend', 'WaveTrend', 'osc', 'WaveTrend oscillator using HLC3, EMA channel and EMA signal (LazyBear-style implementation).', [['channel', 'Channel length', 10, 'i', { min: 1 }], ['average', 'Average length', 21, 'i', { min: 1 }], ['signal', 'Signal SMA', 4, 'i', { min: 1 }]], [C.a, C.b], ['WT1', 'WT2'], (A, p) => {
    const tp = atHLC3(A), esa = ema(tp, p.channel), dev = ema(tp.map((v, i) => Math.abs(v - esa[i])), p.channel), ci = tp.map((v, i) => dev[i] ? (v - esa[i]) / (.015 * dev[i]) : null), wt1 = ema(ci, p.average), wt2 = sma(wt1, p.signal); return [line(wt1, 0), line(wt2, 1)];
  }, { hl: [{ y: 60, al: .3 }, { y: -60, al: .3 }, { y: 0, al: .25 }] });
  window.ATASIndicatorFiles["wavetrend"] = { ...{"id": "wavetrend", "name": "Wavetrend", "sourceClass": "Wavetrend", "sourceFile": "Technical/Wavetrend.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_wavetrend"}, moduleFile: "indicators/individual/wavetrend.js", moduleType: "primary" };
})();
