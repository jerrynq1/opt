/* ATAS indicator module: Bill Williams Moving Average (BWMA) | source: Technical/BWMA.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_wma', 'Weighted Moving Average', 'ov', 'WMA tuyến tính, trọng số lớn hơn cho dữ liệu mới.', period(), [C.a], ['WMA'], (A, p) => [line(wma(A.c, P_(p.period)))]);
  window.ATASIndicatorFiles["bwma"] = { ...{"id": "bwma", "name": "Bill Williams Moving Average", "sourceClass": "BWMA", "sourceFile": "Technical/BWMA.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_wma"}, moduleFile: "indicators/individual/bwma.js", moduleType: "primary" };
})();
