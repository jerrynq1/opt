/* ATAS indicator module: SMA (SMA) | source: Technical/SMA.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_sma', 'Simple Moving Average', 'ov', 'SMA trên Close; hỗ trợ chỉnh chu kỳ.', period(), [C.a], ['SMA'], (A, p) => [line(sma(A.c, p.period))]);
  window.ATASIndicatorFiles["sma"] = { ...{"id": "sma", "name": "SMA", "sourceClass": "SMA", "sourceFile": "Technical/SMA.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_sma"}, moduleFile: "indicators/individual/sma.js", moduleType: "primary" };
})();
