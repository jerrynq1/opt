/* ATAS indicator module: ADXR (ADXR) | source: Technical/ADXR.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_adxr', 'ADXR', 'osc', 'ADXR = trung bình ADX hiện tại và ADX cách N kỳ.', period(), [C.a], ['ADXR'], (A, p) => { const d = atDMI(A, p.period).adx; return [line(d.map((v, i) => v == null || d[i - p.period] == null ? null : (v + d[i - p.period]) / 2))]; }, { hl: [{ y: 20, al: .4 }] });
  window.ATASIndicatorFiles["adxr"] = { ...{"id": "adxr", "name": "ADXR", "sourceClass": "ADXR", "sourceFile": "Technical/ADXR.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_adxr"}, moduleFile: "indicators/individual/adxr.js", moduleType: "primary" };
})();
