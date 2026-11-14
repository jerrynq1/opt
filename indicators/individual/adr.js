/* ATAS indicator module: Average Daily Range (ADR) | source: Technical/ADR.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_adr', 'Average Daily Range (bar range)', 'osc', 'Rolling average của High−Low trên khung chart hiện tại; không tự đổi sang daily timeframe.', period(), [C.a], ['Average Range'], (A, p) => [line(sma(A.h.map((v, i) => v - A.l[i]), p.period))]);
  window.ATASIndicatorFiles["adr"] = { ...{"id": "adr", "name": "Average Daily Range", "sourceClass": "ADR", "sourceFile": "Technical/ADR.cs", "group": "technical", "requirement": "session", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_adr"}, moduleFile: "indicators/individual/adr.js", moduleType: "primary" };
})();
