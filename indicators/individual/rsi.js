/* ATAS indicator module: RSI (RSI) | source: Technical/RSI.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_rsi', 'Relative Strength Index', 'osc', 'RSI Wilder với smoothing RMA trên mức tăng/giảm Close.', period(), [C.a], ['RSI'], (A, p) => [line(rsiOf(A.c, p.period))], { hl: [{ y: 70, al: .4 }, { y: 50, al: .25 }, { y: 30, al: .4 }] });
  window.ATASIndicatorFiles["rsi"] = { ...{"id": "rsi", "name": "RSI", "sourceClass": "RSI", "sourceFile": "Technical/RSI.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_rsi"}, moduleFile: "indicators/individual/rsi.js", moduleType: "primary" };
})();
