/* ATAS indicator module: Arms Ease of Movement (EMV) | source: Technical/EMV.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_emv', 'Ease of Movement', 'osc', 'EMV so sánh midpoint change với volume đã scale theo range.', [['period', 'Smoothing', 14, 'i', { min: 1 }], ['scale', 'Volume scale', 10000, 'n', { min: 1 }]], [C.a], ['EMV'], (A, p) => {
    const raw = A.c.map((v, i) => { if (!i) return null; const mid = (A.h[i] + A.l[i]) / 2, prev = (A.h[i - 1] + A.l[i - 1]) / 2, box = n(A.v[i]) / Math.max(1, p.scale) / Math.max(1e-9, A.h[i] - A.l[i]); return box ? (mid - prev) / box : null; });
    return [line(sma(raw, p.period))];
  }, { hl: [{ y: 0, al: .5 }] });
  window.ATASIndicatorFiles["emv"] = { ...{"id": "emv", "name": "Arms Ease of Movement", "sourceClass": "EMV", "sourceFile": "Technical/EMV.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_emv"}, moduleFile: "indicators/individual/emv.js", moduleType: "primary" };
})();
