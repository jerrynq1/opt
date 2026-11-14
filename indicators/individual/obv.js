/* ATAS indicator module: OBV (OBV) | source: Technical/OBV.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_obv', 'On Balance Volume', 'osc', 'OBV cộng/trừ Volume theo hướng Close so với Close trước; CFD volume thường là tick volume.', [], [C.a], ['OBV'], A => [line(atOBV(A))]);
  window.ATASIndicatorFiles["obv"] = { ...{"id": "obv", "name": "OBV", "sourceClass": "OBV", "sourceFile": "Technical/OBV.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_obv"}, moduleFile: "indicators/individual/obv.js", moduleType: "primary" };
})();
