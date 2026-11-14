/* ATAS indicator module: ATR (ATR) | source: Technical/ATR.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_atr', 'Average True Range', 'osc', 'ATR sử dụng True Range và Wilder RMA.', period(), [C.a], ['ATR'], (A, p) => [line(atATR(A, p.period))], { pf: 'vol' });
  window.ATASIndicatorFiles["atr"] = { ...{"id": "atr", "name": "ATR", "sourceClass": "ATR", "sourceFile": "Technical/ATR.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_atr"}, moduleFile: "indicators/individual/atr.js", moduleType: "primary" };
})();
