/* ATAS indicator module: Weighted Average Oscillator (WAO) | source: Technical/WAO.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_wao', 'Weighted Average Oscillator', 'osc', 'WMA ngắn trừ WMA dài, theo cấu trúc Weighted Average Oscillator của ATAS.', [['short', 'Short WMA', 10, 'i', { min: 1 }], ['long', 'Long WMA', 30, 'i', { min: 2 }]], [C.a], ['WAO'], (A, p) => {
    const x = wma(A.c, P_(p.short)), y = wma(A.c, P_(p.long)); return [hist(x.map((v, i) => v == null || y[i] == null ? null : v - y[i]))];
  }, { hl: [{ y: 0, al: .4 }] });
  window.ATASIndicatorFiles["wao"] = { ...{"id": "wao", "name": "Weighted Average Oscillator", "sourceClass": "WAO", "sourceFile": "Technical/WAO.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_wao"}, moduleFile: "indicators/individual/wao.js", moduleType: "primary" };
})();
