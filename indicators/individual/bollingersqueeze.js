/* ATAS indicator module: Bollinger Squeeze (BollingerSqueeze) | source: Technical/BollingerSqueeze.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_squeeze', 'Bollinger Squeeze', 'osc', 'BB nằm trong Keltner channel được đánh dấu là squeeze; dữ liệu tính từ OHLC.', [['bbPeriod', 'BB period', 20, 'i', { min: 1 }], ['bbMult', 'BB multiplier', 2, 'n', { min: .1, step: .1 }], ['kcPeriod', 'KC period', 20, 'i', { min: 1 }], ['kcMult', 'KC multiplier', 1.5, 'n', { min: .1, step: .1 }]], [C.a, C.e], ['Squeeze', 'Momentum'], (A, p) => {
    const mid = sma(A.c, p.bbPeriod), sd = sdv(A.c, p.bbPeriod), atr = atATR(A, p.kcPeriod), em = ema(A.c, p.kcPeriod);
    const on = mid.map((v, i) => v != null && sd[i] != null && atr[i] != null && em[i] != null && v + p.bbMult * sd[i] < em[i] + p.kcMult * atr[i] && v - p.bbMult * sd[i] > em[i] - p.kcMult * atr[i] ? 1 : 0);
    const hh = atMax(A.h, p.kcPeriod), ll = atMin(A.l, p.kcPeriod), mom = A.c.map((v, i) => hh[i] == null || ll[i] == null ? null : v - (hh[i] + ll[i] + em[i]) / 3);
    return [hist(on.map(v => v ? 1 : 0), 0), line(mom, 1)];
  }, { hl: [{ y: 0, al: .3 }] });
  window.ATASIndicatorFiles["bollingersqueeze"] = { ...{"id": "bollingersqueeze", "name": "Bollinger Squeeze", "sourceClass": "BollingerSqueeze", "sourceFile": "Technical/BollingerSqueeze.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_squeeze"}, moduleFile: "indicators/individual/bollingersqueeze.js", moduleType: "primary" };
})();
