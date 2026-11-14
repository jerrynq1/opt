/* ATAS indicator module: Vortex (Vortex) | source: Technical/Vortex.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_vortex', 'Vortex Indicator', 'osc', 'VI+ / VI− từ directional movement và true range.', period(), [C.d, C.e], ['VI+', 'VI−'], (A, p) => {
    const vmP = [null], vmM = [null], tr = atTR(A);
    for (let i = 1; i < A.c.length; i++) { vmP[i] = Math.abs(A.h[i] - A.l[i - 1]); vmM[i] = Math.abs(A.l[i] - A.h[i - 1]); }
    const tp = atSum(tr, p.period), a = atSum(vmP, p.period), b = atSum(vmM, p.period);
    return [line(a.map((v, i) => v == null || !tp[i] ? null : v / tp[i]), 0), line(b.map((v, i) => v == null || !tp[i] ? null : v / tp[i]), 1)];
  }, { hl: [{ y: 1, al: .4 }] });
  window.ATASIndicatorFiles["vortex"] = { ...{"id": "vortex", "name": "Vortex", "sourceClass": "Vortex", "sourceFile": "Technical/Vortex.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_vortex"}, moduleFile: "indicators/individual/vortex.js", moduleType: "primary" };
})();
