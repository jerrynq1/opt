/* ATAS indicator module: Money Flow Index (MFI) | source: Technical/MFI.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_mfi', 'Money Flow Index', 'osc', 'MFI dùng Typical Price × Volume để so sánh dòng tiền dương/âm.', period(), [C.a], ['MFI'], (A, p) => {
    const tp = atHLC3(A), pos = Array(A.c.length).fill(0), neg = Array(A.c.length).fill(0);
    for (let i = 1; i < tp.length; i++) { const f = tp[i] * n(A.v[i]); if (tp[i] > tp[i - 1]) pos[i] = f; else if (tp[i] < tp[i - 1]) neg[i] = f; }
    const ps = atSum(pos, p.period), ns = atSum(neg, p.period);
    return [line(ps.map((v, i) => v == null ? null : ns[i] === 0 ? 100 : 100 - 100 / (1 + v / ns[i])))];
  }, { hl: [{ y: 80, al: .5 }, { y: 20, al: .5 }] });
  window.ATASIndicatorFiles["mfi"] = { ...{"id": "mfi", "name": "Money Flow Index", "sourceClass": "MFI", "sourceFile": "Technical/MFI.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_mfi"}, moduleFile: "indicators/individual/mfi.js", moduleType: "primary" };
})();
