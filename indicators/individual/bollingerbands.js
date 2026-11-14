/* ATAS indicator module: Bollinger Bands (BollingerBands) | source: Technical/BollingerBands.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_bb', 'Bollinger Bands', 'ov', 'SMA ± độ lệch chuẩn tổng thể nhân hệ số.', [['period', 'Period', 20, 'i', { min: 1 }], ['mult', 'Deviation', 2, 'n', { min: .1, step: .1 }]], [C.a, C.b], ['Basis / Upper', 'Lower'], (A, p) => {
    const mid = sma(A.c, p.period), sd = sdv(A.c, p.period), up = mid.map((v, i) => v == null || sd[i] == null ? null : v + p.mult * sd[i]), lo = mid.map((v, i) => v == null || sd[i] == null ? null : v - p.mult * sd[i]);
    return [line(mid, 0), line(up, 1), line(lo, 1), fill(up, lo, 1, .07)];
  });
  window.ATASIndicatorFiles["bollingerbands"] = { ...{"id": "bollingerbands", "name": "Bollinger Bands", "sourceClass": "BollingerBands", "sourceFile": "Technical/BollingerBands.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_bb"}, moduleFile: "indicators/individual/bollingerbands.js", moduleType: "primary" };
})();
