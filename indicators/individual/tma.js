/* ATAS indicator module: Triangular Moving Average (TMA) | source: Technical/TMA.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_tma', 'Triangular Moving Average', 'ov', 'Triangular MA built from two sequential SMAs. Small boundary differences may occur versus ATAS internal series indexing.', period(), [C.a], ['TMA'], (A, p) => {
    const n1 = Math.ceil(P_(p.period) / 2), n2 = P_(p.period) % 2 ? n1 : n1 + 1;
    return [line(sma(sma(A.c, n1), n2))];
  });
  window.ATASIndicatorFiles["tma"] = { ...{"id": "tma", "name": "Triangular Moving Average", "sourceClass": "TMA", "sourceFile": "Technical/TMA.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_tma"}, moduleFile: "indicators/individual/tma.js", moduleType: "primary" };
})();
