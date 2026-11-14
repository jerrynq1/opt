/* ATAS indicator module: EMA (EMA) | source: Technical/EMA.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_ema', 'Exponential Moving Average', 'ov', 'EMA trên Close; khởi tạo từ quan sát đầu tiên.', period(), [C.a], ['EMA'], (A, p) => [line(ema(A.c, p.period))]);
  window.ATASIndicatorFiles["ema"] = { ...{"id": "ema", "name": "EMA", "sourceClass": "EMA", "sourceFile": "Technical/EMA.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_ema"}, moduleFile: "indicators/individual/ema.js", moduleType: "primary" };
})();
