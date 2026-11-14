/* ATAS indicator module: Donchian Channel (Donchian) | source: Technical/Donchian.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_dc', 'Donchian Channel', 'ov', 'Highest High và Lowest Low trong cửa sổ N nến; có đường midpoint.', period(), [C.a, C.b], ['Upper / Mid', 'Lower'], (A, p) => {
    const up = atMax(A.h, p.period), lo = atMin(A.l, p.period), mid = up.map((v, i) => v == null || lo[i] == null ? null : (v + lo[i]) / 2);
    return [line(up, 0), line(mid, 0, 1), line(lo, 1), fill(up, lo, 1, .045)];
  });
  window.ATASIndicatorFiles["donchian"] = { ...{"id": "donchian", "name": "Donchian Channel", "sourceClass": "Donchian", "sourceFile": "Technical/Donchian.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_dc"}, moduleFile: "indicators/individual/donchian.js", moduleType: "primary" };
})();
