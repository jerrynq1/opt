/* ATAS indicator module: Price Volume Trend (VolumeTrend) | source: Technical/VolumeTrend.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_pvt', 'Price Volume Trend', 'osc', 'PVT cộng Volume × phần trăm biến động Close.', [], [C.a], ['PVT'], A => {
    let s = 0; return [line(A.c.map((v, i) => { if (i && A.c[i - 1]) s += n(A.v[i]) * (v - A.c[i - 1]) / A.c[i - 1]; return s; }))];
  });
  window.ATASIndicatorFiles["volumetrend"] = { ...{"id": "volumetrend", "name": "Price Volume Trend", "sourceClass": "VolumeTrend", "sourceFile": "Technical/VolumeTrend.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_pvt"}, moduleFile: "indicators/individual/volumetrend.js", moduleType: "primary" };
})();
