/* ATAS indicator module: Standard Deviation Bands (StdDevBands) | source: Technical/StdDevBands.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_stddevbands', 'Standard Deviation Bands', 'ov', 'SMA ± độ lệch chuẩn nhân hệ số.', [['period', 'Period', 20, 'i', { min: 1 }], ['mult', 'Deviation', 2, 'n', { min: .1, step: .1 }]], [C.a, C.b], ['Upper', 'Lower'], (A, p) => {
    const m = sma(A.c, p.period), sd = sdv(A.c, p.period), u = m.map((v, i) => v == null || sd[i] == null ? null : v + sd[i] * p.mult), l = m.map((v, i) => v == null || sd[i] == null ? null : v - sd[i] * p.mult);
    return [line(u), line(l, 1), fill(u, l, 1, .07)];
  });
  window.ATASIndicatorFiles["stddevbands"] = { ...{"id": "stddevbands", "name": "Standard Deviation Bands", "sourceClass": "StdDevBands", "sourceFile": "Technical/StdDevBands.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_stddevbands"}, moduleFile: "indicators/individual/stddevbands.js", moduleType: "primary" };
})();
