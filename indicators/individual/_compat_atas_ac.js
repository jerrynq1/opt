/* Compatibility indicator registration retained from the prior QuantLab catalogue. */
(function(){'use strict';
const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
  I('atas_ac', 'Accelerator Oscillator', 'osc', 'AC = AO − SMA(AO, 5).', [], [C.a, C.e], ['AC'], A => {
    const m = atMedian(A), a = sma(m, 5), b = sma(m, 34), ao = a.map((v, i) => v == null || b[i] == null ? null : v - b[i]), sm = sma(ao, 5);
    return [hist(ao.map((v, i) => v == null || sm[i] == null ? null : v - sm[i]))];
  }, { hl: [{ y: 0, al: .5 }] });
})();
