/* ATAS indicator module: Heiken Ashi (HeikenAshi) | source: Technical/HeikenAshi.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_heikenashi', 'Heiken Ashi', 'ov', 'Nến Heiken Ashi tính từ OHLC gốc; không thay đổi dữ liệu nến thị trường.', [], [C.up, C.dn], ['HA candles'], A => {
    const out = Array(A.c.length).fill(null); let prevO = null, prevC = null;
    for (let i = 0; i < A.c.length; i++) {
      const c = (A.o[i] + A.h[i] + A.l[i] + A.c[i]) / 4, o = prevO == null ? (A.o[i] + A.c[i]) / 2 : (prevO + prevC) / 2;
      const h = Math.max(A.h[i], o, c), l = Math.min(A.l[i], o, c); out[i] = { o, h, l, v: c, col: c >= o ? C.up : C.dn }; prevO = o; prevC = c;
    }
    return [{ k: 'c', d: out, ci: 0 }];
  });
  window.ATASIndicatorFiles["heikenashi"] = { ...{"id": "heikenashi", "name": "Heiken Ashi", "sourceClass": "HeikenAshi", "sourceFile": "Technical/HeikenAshi.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_heikenashi"}, moduleFile: "indicators/individual/heikenashi.js", moduleType: "primary" };
})();
