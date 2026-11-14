/* ATAS indicator module: VWMA (VWMA) | source: Technical/VWMA.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_vwma', 'Volume Weighted MA', 'ov', 'VWMA theo Volume của nến cTrader; CFD volume có thể là tick volume.', period(), [C.a], ['VWMA'], (A, p) => [line(maF('VWMA', A.c, P_(p.period), A))]);
  window.ATASIndicatorFiles["vwma"] = { ...{"id": "vwma", "name": "VWMA", "sourceClass": "VWMA", "sourceFile": "Technical/VWMA.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_vwma"}, moduleFile: "indicators/individual/vwma.js", moduleType: "primary" };
})();
