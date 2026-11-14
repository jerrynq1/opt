/* ATAS indicator module: Relative Vigor Index (RelativeVigorIndex) | source: Technical/RelativeVigorIndex.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_rvi', 'Relative Vigor Index', 'osc', 'RVI dùng chênh lệch Close−Open chuẩn hóa với biên độ High−Low, kèm signal.', period(), [C.a, C.b], ['RVI', 'Signal'], (A, p) => {
    const nume = sma(A.c.map((v, i) => v - A.o[i]), p.period), den = sma(A.h.map((v, i) => v - A.l[i]), p.period);
    const r = nume.map((v, i) => v == null || !den[i] ? null : v / den[i]); return [line(r), line(sma(r, 4), 1)];
  }, { hl: [{ y: 0, al: .5 }] });
  window.ATASIndicatorFiles["relativevigorindex"] = { ...{"id": "relativevigorindex", "name": "Relative Vigor Index", "sourceClass": "RelativeVigorIndex", "sourceFile": "Technical/RelativeVigorIndex.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_rvi"}, moduleFile: "indicators/individual/relativevigorindex.js", moduleType: "primary" };
})();
