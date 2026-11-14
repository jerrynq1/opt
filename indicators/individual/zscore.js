/* ATAS indicator module: Z-Score (ZScore) | source: Technical/ZScore.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_zscore', 'Z-Score', 'osc', 'Độ lệch chuẩn hóa của Close so với rolling mean.', period(), [C.a], ['Z-Score'], (A, p) => {
    const m = sma(A.c, p.period), sd = sdv(A.c, p.period);
    return [line(A.c.map((v, i) => m[i] == null || !sd[i] ? null : (v - m[i]) / sd[i]))];
  }, { hl: [{ y: 0, al: .5 }, { y: 2, al: .25 }, { y: -2, al: .25 }] });
  window.ATASIndicatorFiles["zscore"] = { ...{"id": "zscore", "name": "Z-Score", "sourceClass": "ZScore", "sourceFile": "Technical/ZScore.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_zscore"}, moduleFile: "indicators/individual/zscore.js", moduleType: "primary" };
})();
