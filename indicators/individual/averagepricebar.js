/* ATAS indicator module: Average Price for Bar (AveragePriceBar) | source: Technical/AveragePriceBar.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_averageprice', 'Average Price per Bar', 'ov', 'Giá trung bình OHLC4 của từng nến.', [], [C.a], ['OHLC4'], A => [line(A.c.map((v, i) => (A.o[i] + A.h[i] + A.l[i] + v) / 4))]);
  window.ATASIndicatorFiles["averagepricebar"] = { ...{"id": "averagepricebar", "name": "Average Price for Bar", "sourceClass": "AveragePriceBar", "sourceFile": "Technical/AveragePriceBar.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_averageprice"}, moduleFile: "indicators/individual/averagepricebar.js", moduleType: "primary" };
})();
