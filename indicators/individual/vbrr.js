/* ATAS indicator module: Volume Bar Range Ratio (VBRR) | source: Technical/VBRR.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_vbrr', 'Volume Bar Range Ratio', 'osc', 'Volume / (High − Low); volume trên mỗi đơn vị range. Với CFD, volume có thể là tick volume.', [], [C.a], ['VBRR'], A => [line(A.c.map((v, i) => A.h[i] !== A.l[i] ? n(A.v[i]) / (A.h[i] - A.l[i]) : null))], { pf: 'vol' });
  window.ATASIndicatorFiles["vbrr"] = { ...{"id": "vbrr", "name": "Volume Bar Range Ratio", "sourceClass": "VBRR", "sourceFile": "Technical/VBRR.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_vbrr"}, moduleFile: "indicators/individual/vbrr.js", moduleType: "primary" };
})();
