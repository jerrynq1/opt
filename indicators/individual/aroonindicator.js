/* ATAS indicator module: Aroon Indicator (AroonIndicator) | source: Technical/AroonIndicator.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_aroon', 'Aroon Indicator', 'osc', 'Aroon Up/Down xác định số nến kể từ đỉnh/đáy cao nhất/thấp nhất.', period(), [C.d, C.e], ['Aroon Up', 'Aroon Down'], (A, p) => {
    const u = Array(A.c.length).fill(null), d = Array(A.c.length).fill(null), k = P_(p.period);
    for (let i = k - 1; i < A.c.length; i++) { const hs = A.h.slice(i - k + 1, i + 1), ls = A.l.slice(i - k + 1, i + 1); u[i] = 100 * (hs.lastIndexOf(Math.max(...hs)) + 1) / k; d[i] = 100 * (ls.lastIndexOf(Math.min(...ls)) + 1) / k; }
    return [line(u, 0), line(d, 1)];
  }, { hl: [{ y: 70, al: .3 }, { y: 30, al: .3 }] });
  window.ATASIndicatorFiles["aroonindicator"] = { ...{"id": "aroonindicator", "name": "Aroon Indicator", "sourceClass": "AroonIndicator", "sourceFile": "Technical/AroonIndicator.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_aroon"}, moduleFile: "indicators/individual/aroonindicator.js", moduleType: "primary" };
})();
