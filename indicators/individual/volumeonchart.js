/* ATAS indicator module: Volume On The Chart (VolumeOnChart) | source: Technical/VolumeOnChart.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_volume_on_chart', 'Volume On The Chart', 'osc', 'Plots the chart volume as a histogram; CFDs may expose broker tick volume, not centralized traded volume.', [], [C.a], ['Volume'], A => [hist(A.v.map(v => Math.max(0, n(v))))], { pf: 'vol' });
  window.ATASIndicatorFiles["volumeonchart"] = { ...{"id": "volumeonchart", "name": "Volume On The Chart", "sourceClass": "VolumeOnChart", "sourceFile": "Technical/VolumeOnChart.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_volume_on_chart"}, moduleFile: "indicators/individual/volumeonchart.js", moduleType: "primary" };
})();
