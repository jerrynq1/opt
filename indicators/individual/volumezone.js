/* ATAS indicator module: Volume Zone Oscillator (VolumeZone) | source: Technical/VolumeZone.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_vzo', 'Volume Zone Oscillator', 'osc', 'VZO dùng EMA volume có dấu theo hướng giá / tổng EMA volume.', period(), [C.a], ['VZO'], (A, p) => { const sv = A.c.map((v, i) => i ? n(A.v[i]) * (v > A.c[i - 1] ? 1 : v < A.c[i - 1] ? -1 : 0) : 0), pos = ema(sv, p.period), vol = ema(A.v, p.period); return [line(pos.map((v, i) => vol[i] ? 100 * v / vol[i] : null))]; }, { hl: [{ y: 60, al: .3 }, { y: 0, al: .5 }, { y: -60, al: .3 }] });
  window.ATASIndicatorFiles["volumezone"] = { ...{"id": "volumezone", "name": "Volume Zone Oscillator", "sourceClass": "VolumeZone", "sourceFile": "Technical/VolumeZone.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_vzo"}, moduleFile: "indicators/individual/volumezone.js", moduleType: "primary" };
})();
