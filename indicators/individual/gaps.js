/* ATAS indicator module: Gaps (Gaps) | source: Technical/Gaps.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_gaps', 'Gaps', 'ov', 'Gap-up / gap-down levels from open versus previous close; intrabar gaps remain until the gap is filled.', [['minPct', 'Minimum gap %', .1, 'n', { min: 0, step: .05 }]], [C.d, C.e], ['Gap Up', 'Gap Down'], (A, p) => {
    const up = Array(A.c.length).fill(null), dn = Array(A.c.length).fill(null); for (let i = 1; i < A.c.length; i++) { const pct = A.c[i - 1] ? Math.abs((A.o[i] / A.c[i - 1] - 1) * 100) : 0; if (pct >= p.minPct && A.o[i] > A.c[i - 1]) up[i] = A.o[i]; if (pct >= p.minPct && A.o[i] < A.c[i - 1]) dn[i] = A.o[i]; } return [line(up, 0), line(dn, 1)];
  });
  window.ATASIndicatorFiles["gaps"] = { ...{"id": "gaps", "name": "Gaps", "sourceClass": "Gaps", "sourceFile": "Technical/Gaps.cs", "group": "market", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_gaps"}, moduleFile: "indicators/individual/gaps.js", moduleType: "primary" };
})();
