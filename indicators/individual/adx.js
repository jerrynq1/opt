/* ATAS indicator module: ADX (ADX) | source: Technical/ADX.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_adx', 'Average Directional Index', 'osc', 'ADX Wilder; DI+/DI− được tính nội bộ, hiển thị ADX.', period(), [C.a], ['ADX'], (A, p) => [line(atDMI(A, p.period).adx)], { hl: [{ y: 20, al: .4 }, { y: 25, al: .25 }] });
  window.ATASIndicatorFiles["adx"] = { ...{"id": "adx", "name": "ADX", "sourceClass": "ADX", "sourceFile": "Technical/ADX.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_adx"}, moduleFile: "indicators/individual/adx.js", moduleType: "primary" };
})();
