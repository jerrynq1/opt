/* ATAS indicator module: DeTrended Price Oscillator (DeTrended) | source: Technical/DeTrended.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_dpo', 'Detrended Price Oscillator', 'osc', 'DPO loại bỏ xu hướng dài hạn bằng SMA dịch lùi.', period(), [C.a], ['DPO'], (A, p) => {
    const k = Math.floor(P_(p.period) / 2) + 1, m = sma(A.c, p.period);
    return [line(A.c.map((v, i) => i + k < A.c.length && m[i + k] != null ? v - m[i + k] : null))];
  }, { hl: [{ y: 0, al: .5 }] });
  window.ATASIndicatorFiles["detrended"] = { ...{"id": "detrended", "name": "DeTrended Price Oscillator", "sourceClass": "DeTrended", "sourceFile": "Technical/DeTrended.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_dpo"}, moduleFile: "indicators/individual/detrended.js", moduleType: "primary" };
})();
