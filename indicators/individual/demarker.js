/* ATAS indicator module: DeMarker (DeMarker) | source: Technical/DeMarker.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_demarker', 'DeMarker', 'osc', 'DeMarker đo mức mở rộng high/low so với nến trước.', period(), [C.a], ['DeMarker'], (A, p) => {
    const up = A.h.map((v, i) => i ? Math.max(0, v - A.h[i - 1]) : 0), dn = A.l.map((v, i) => i ? Math.max(0, A.l[i - 1] - v) : 0), u = sma(up, p.period), d = sma(dn, p.period);
    return [line(u.map((v, i) => v == null || d[i] == null || v + d[i] === 0 ? null : v / (v + d[i])))];
  }, { hl: [{ y: .7, al: .4 }, { y: .3, al: .4 }] });
  window.ATASIndicatorFiles["demarker"] = { ...{"id": "demarker", "name": "DeMarker", "sourceClass": "DeMarker", "sourceFile": "Technical/DeMarker.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_demarker"}, moduleFile: "indicators/individual/demarker.js", moduleType: "primary" };
})();
