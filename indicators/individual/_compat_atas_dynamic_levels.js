/* Compatibility indicator registration retained from the prior QuantLab catalogue. */
(function(){'use strict';
const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
  I('atas_dynamic_levels', 'Dynamic Levels (proxy)', 'ov', 'Adaptive rolling support/resistance from recent extremes; original ATAS implementation also includes advanced volume/cluster logic.', [['period', 'Lookback', 50, 'i', { min: 2 }]], [C.d, C.e], ['Dynamic High', 'Dynamic Low'], (A, p) => [line(atMax(A.h, p.period), 0), line(atMin(A.l, p.period), 1)]);
})();
