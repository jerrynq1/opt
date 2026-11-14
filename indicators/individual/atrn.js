/* ATAS indicator module: ATR Normalized (ATRN) | source: Technical/ATRN.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_atrn', 'Normalized ATR', 'osc', 'ATR chia Close × 100, biểu diễn biến động tương đối.', period(), [C.a], ['ATR %'], (A, p) => { const a = atATR(A, p.period); return [line(a.map((v, i) => v == null || !A.c[i] ? null : 100 * v / A.c[i]))]; });
  window.ATASIndicatorFiles["atrn"] = { ...{"id": "atrn", "name": "ATR Normalized", "sourceClass": "ATRN", "sourceFile": "Technical/ATRN.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_atrn"}, moduleFile: "indicators/individual/atrn.js", moduleType: "primary" };
})();
