/* ATAS indicator module: Triple Exponential Moving Average (TEMA) | source: Technical/TEMA.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_tema', 'Triple EMA (TEMA)', 'ov', 'TEMA = 3×EMA − 3×EMA(EMA) + EMA(EMA(EMA)).', period(), [C.a], ['TEMA'], (A, p) => [line(atTEMA(A.c, p.period))]);
  window.ATASIndicatorFiles["tema"] = { ...{"id": "tema", "name": "Triple Exponential Moving Average", "sourceClass": "TEMA", "sourceFile": "Technical/TEMA.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_tema"}, moduleFile: "indicators/individual/tema.js", moduleType: "primary" };
})();
