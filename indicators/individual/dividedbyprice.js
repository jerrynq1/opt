/* ATAS indicator module: 1 Divided by Price (DividedByPrice) | source: Technical/DividedByPrice.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_divided_price', '1 Divided by Price', 'ov', 'Reciprocal 1/Close plotted as a line. ATAS draws reversed candles; this browser version does not invert the chart scale/candlesticks.', [], [C.a], ['1 / Close'], A => [line(A.c.map(v => v ? 1 / v : null))]);
  window.ATASIndicatorFiles["dividedbyprice"] = { ...{"id": "dividedbyprice", "name": "1 Divided by Price", "sourceClass": "DividedByPrice", "sourceFile": "Technical/DividedByPrice.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_divided_price"}, moduleFile: "indicators/individual/dividedbyprice.js", moduleType: "primary" };
})();
