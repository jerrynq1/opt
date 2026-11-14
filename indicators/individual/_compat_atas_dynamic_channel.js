/* Compatibility indicator registration retained from the prior QuantLab catalogue. */
(function(){'use strict';
const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
  I('atas_dynamic_channel', 'Dynamic Levels Channel (proxy)', 'ov', 'Rolling high/low channel and midpoint; does not reproduce ATAS internal volume/cluster scoring.', [['period', 'Lookback', 50, 'i', { min: 2 }]], [C.a, C.b], ['Upper / Mid', 'Lower'], (A, p) => { const h = atMax(A.h, p.period), l = atMin(A.l, p.period), m = h.map((v, i) => v == null || l[i] == null ? null : (v + l[i]) / 2); return [line(h, 0), line(m, 0, 1), line(l, 1)]; });
})();
