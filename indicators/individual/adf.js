/* ATAS indicator module: Accumulation / Distribution Flow (ADF) | source: Technical/ADF.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_adl', 'Accumulation / Distribution Line', 'osc', 'A/D Line dùng Close Location Value nhân Volume của nến.', [], [C.a], ['A/D'], A => [line(atADL(A))]);
  window.ATASIndicatorFiles["adf"] = { ...{"id": "adf", "name": "Accumulation / Distribution Flow", "sourceClass": "ADF", "sourceFile": "Technical/ADF.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_adl"}, moduleFile: "indicators/individual/adf.js", moduleType: "primary" };
})();
