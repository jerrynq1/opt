/* ATAS indicator module: Chaikin Money Flow (CMF) | source: Technical/CMF.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_cmf', 'Chaikin Money Flow', 'osc', 'CMF = tổng Money Flow Volume / tổng Volume trong cửa sổ.', period(), [C.a], ['CMF'], (A, p) => {
    const mfv = A.c.map((v, i) => { const den = A.h[i] - A.l[i]; return den ? ((v - A.l[i]) - (A.h[i] - v)) / den * n(A.v[i]) : 0; });
    const m = atSum(mfv, p.period), v = atSum(A.v, p.period);
    return [line(m.map((x, i) => x == null || !v[i] ? null : x / v[i]))];
  }, { hl: [{ y: 0, al: .5 }] });
  window.ATASIndicatorFiles["cmf"] = { ...{"id": "cmf", "name": "Chaikin Money Flow", "sourceClass": "CMF", "sourceFile": "Technical/CMF.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_cmf"}, moduleFile: "indicators/individual/cmf.js", moduleType: "primary" };
})();
