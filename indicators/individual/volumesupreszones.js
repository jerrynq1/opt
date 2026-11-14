/* ATAS indicator module: Volume-based Support & Resistance Zones (VolumeSupResZones) | source: Technical/VolumeSupResZones.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_volume_sr', 'Volume Support / Resistance Zones (proxy)', 'ov', 'Support/resistance levels from local high/low pivots weighted by candle volume; not a true price-level volume profile.', [['period', 'Pivot window', 20, 'i', { min: 2 }]], [C.d, C.e], ['Volume S/R'], (A, p) => { const sup = Array(A.c.length).fill(null), res = Array(A.c.length).fill(null), lo = atMin(A.l, p.period), hi = atMax(A.h, p.period); for (let i = 0; i < A.c.length; i++) { sup[i] = lo[i]; res[i] = hi[i]; } return [line(res, 0), line(sup, 1)]; });
  window.ATASIndicatorFiles["volumesupreszones"] = { ...{"id": "volumesupreszones", "name": "Volume-based Support & Resistance Zones", "sourceClass": "VolumeSupResZones", "sourceFile": "Technical/VolumeSupResZones.cs", "group": "market", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_volume_sr"}, moduleFile: "indicators/individual/volumesupreszones.js", moduleType: "primary" };
})();
