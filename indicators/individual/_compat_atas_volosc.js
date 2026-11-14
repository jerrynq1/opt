/* Compatibility indicator registration retained from the prior QuantLab catalogue. */
(function(){'use strict';
const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
  I('atas_volosc', 'Volume Oscillator', 'osc', 'Phần trăm chênh lệch giữa EMA Volume ngắn và dài.', [['short', 'Short', 5, 'i', { min: 1 }], ['long', 'Long', 20, 'i', { min: 2 }]], [C.a], ['Volume Oscillator'], (A, p) => {
    const s = ema(A.v, p.short), l = ema(A.v, p.long); return [hist(s.map((v, i) => l[i] ? 100 * (v - l[i]) / l[i] : null))];
  }, { hl: [{ y: 0, al: .5 }] });
})();
