/* ATAS indicator module: Coppock Curve (CoppockCurve) | source: Technical/CoppockCurve.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_coppock', 'Coppock Curve', 'osc', 'WMA 10 của tổng ROC 14 và ROC 11.', [], [C.a], ['Coppock'], A => { const r = atROC(A.c, 14).map((v, i) => v == null || atROC(A.c, 11)[i] == null ? null : v + atROC(A.c, 11)[i]); return [line(wma(r, 10))]; }, { hl: [{ y: 0, al: .5 }] });
  window.ATASIndicatorFiles["coppockcurve"] = { ...{"id": "coppockcurve", "name": "Coppock Curve", "sourceClass": "CoppockCurve", "sourceFile": "Technical/CoppockCurve.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_coppock"}, moduleFile: "indicators/individual/coppockcurve.js", moduleType: "primary" };
})();
