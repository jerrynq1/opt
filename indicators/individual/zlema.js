/* ATAS indicator module: Zero Lag Exponential Moving Average (ZLEMA) | source: Technical/ZLEMA.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_zlema', 'Zero Lag EMA', 'ov', 'EMA của chuỗi đã bù lag bằng chênh lệch với giá quá khứ.', period(), [C.a], ['ZLEMA'], (A, p) => [line(atZLEMA(A.c, p.period))]);
  window.ATASIndicatorFiles["zlema"] = { ...{"id": "zlema", "name": "Zero Lag Exponential Moving Average", "sourceClass": "ZLEMA", "sourceFile": "Technical/ZLEMA.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_zlema"}, moduleFile: "indicators/individual/zlema.js", moduleType: "primary" };
})();
