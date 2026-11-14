/* ATAS indicator module: Ichimoku Kinko Hyo (Ichimoku) | source: Technical/Ichimoku.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_ichimoku', 'Ichimoku Kinko Hyo', 'ov', 'Tenkan, Kijun, Senkou A/B và Chikou; Senkou dịch về trước, Chikou dịch lùi.', [['tenkan', 'Tenkan', 9, 'i', { min: 1 }], ['kijun', 'Kijun', 26, 'i', { min: 1 }], ['senkou', 'Senkou B', 52, 'i', { min: 1 }], ['shift', 'Displacement', 26, 'i', { min: 0, max: 100 }]], [C.a, C.b, C.d, C.e, C.c], ['Tenkan', 'Kijun', 'Senkou A', 'Senkou B', 'Chikou'], (A, p) => {
    const mid = k => { const h = atMax(A.h, k), l = atMin(A.l, k); return h.map((v, i) => v == null || l[i] == null ? null : (v + l[i]) / 2); };
    const ten = mid(p.tenkan), kij = mid(p.kijun), sa0 = ten.map((v, i) => v == null || kij[i] == null ? null : (v + kij[i]) / 2), sb0 = mid(p.senkou);
    const sa = shiftA(sa0, p.shift), sb = shiftA(sb0, p.shift), chikou = shiftA(A.c, -p.shift);
    return [line(ten, 0), line(kij, 1), line(sa, 2), line(sb, 3), fill(sa, sb, 2, .07), line(chikou, 4)];
  });
  window.ATASIndicatorFiles["ichimoku"] = { ...{"id": "ichimoku", "name": "Ichimoku Kinko Hyo", "sourceClass": "Ichimoku", "sourceFile": "Technical/Ichimoku.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_ichimoku"}, moduleFile: "indicators/individual/ichimoku.js", moduleType: "primary" };
})();
