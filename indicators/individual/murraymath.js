/* ATAS indicator module: Murrey Math (MurrayMath) | source: Technical/MurrayMath.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_murray_math', 'Murrey Math Levels (proxy)', 'ov', 'Eight-part octave levels from rolling high/low; simplified adaptive range, not a byte-for-byte port of ATAS Murray Math.', [['period', 'Range period', 64, 'i', { min: 8, max: 500 }]], [C.a, C.b], ['Octave levels'], (A, p) => {
    const hi = atMax(A.h, p.period), lo = atMin(A.l, p.period), levels = Array.from({ length: 9 }, () => Array(A.c.length).fill(null));
    for (let i = 0; i < A.c.length; i++) if (hi[i] != null && lo[i] != null) for (let j = 0; j <= 8; j++) levels[j][i] = lo[i] + (hi[i] - lo[i]) * j / 8;
    return levels.map((x, i) => line(x, i % 2, i === 4 ? 2 : 1));
  });
  window.ATASIndicatorFiles["murraymath"] = { ...{"id": "murraymath", "name": "Murrey Math", "sourceClass": "MurrayMath", "sourceFile": "Technical/MurrayMath.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_murray_math"}, moduleFile: "indicators/individual/murraymath.js", moduleType: "primary" };
})();
