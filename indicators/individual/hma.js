/* ATAS indicator module: Hull Moving Average (HMA) | source: Technical/HMA.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_hma', 'Hull Moving Average', 'ov', 'Hull MA sử dụng WMA với chu kỳ rút gọn để giảm độ trễ.', period(), [C.a], ['HMA'], (A, p) => [line(atHMA(A.c, p.period))]);
  window.ATASIndicatorFiles["hma"] = { ...{"id": "hma", "name": "Hull Moving Average", "sourceClass": "HMA", "sourceFile": "Technical/HMA.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_hma"}, moduleFile: "indicators/individual/hma.js", moduleType: "primary" };
})();
