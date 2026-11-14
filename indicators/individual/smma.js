/* ATAS indicator module: SMMA (SMMA) | source: Technical/SMMA.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_smma', 'SMMA / Wilder MA', 'ov', 'Smoothed Moving Average (RMA/Wilder), dùng dữ liệu Close.', period(), [C.a], ['SMMA'], (A, p) => [line(rma(A.c, P_(p.period)))]);
  window.ATASIndicatorFiles["smma"] = { ...{"id": "smma", "name": "SMMA", "sourceClass": "SMMA", "sourceFile": "Technical/SMMA.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_smma"}, moduleFile: "indicators/individual/smma.js", moduleType: "primary" };
})();
