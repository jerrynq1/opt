/* ATAS indicator module: Moving Median (MMed) | source: Technical/MMed.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_moving_median', 'Moving Median', 'ov', 'Median của cửa sổ giá N; xử lý đúng median giữa hai phần tử khi số mẫu chẵn.', period(), [C.a], ['Median'], (A, p) => [line(atMedianWin(A.c, P_(p.period)))]);
  window.ATASIndicatorFiles["mmed"] = { ...{"id": "mmed", "name": "Moving Median", "sourceClass": "MMed", "sourceFile": "Technical/MMed.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_moving_median"}, moduleFile: "indicators/individual/mmed.js", moduleType: "primary" };
})();
