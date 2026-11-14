/* ATAS indicator module: Camarilla Pivots (CamarillaPivots) | source: Technical/CamarillaPivots.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_camarilla', 'Camarilla Pivots', 'ov', 'Camarilla R1–R4 / S1–S4 tính từ high/low/close của ngày UTC trước.', [], [C.d, C.e, C.b, C.c], ['R levels', 'S levels'], A => {
    const levels = Array.from({ length: 8 }, () => Array(A.c.length).fill(null)); let key = null, H = null, L = null, Cl = null, pH = null, pL = null, pC = null;
    for (let i = 0; i < A.c.length; i++) {
      const k = Math.floor((A.s?.[i] ?? A.t[i]) / 86400);
      if (key !== null && k !== key) { pH = H; pL = L; pC = Cl; H = L = Cl = null; }
      if (pH != null && pL != null && pC != null) {
        const r = pH - pL; [1.1, 1.1, 1.1, 1.1].forEach((m, j) => { levels[j][i] = pC + r * m / [12, 6, 4, 2][j]; levels[j + 4][i] = pC - r * m / [12, 6, 4, 2][j]; });
      }
      H = H == null ? A.h[i] : Math.max(H, A.h[i]); L = L == null ? A.l[i] : Math.min(L, A.l[i]); Cl = A.c[i]; key = k;
    }
    return levels.map((d, i) => line(d, i < 4 ? 0 : 1, 1));
  });
  window.ATASIndicatorFiles["camarillapivots"] = { ...{"id": "camarillapivots", "name": "Camarilla Pivots", "sourceClass": "CamarillaPivots", "sourceFile": "Technical/CamarillaPivots.cs", "group": "technical", "requirement": "session", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_camarilla"}, moduleFile: "indicators/individual/camarillapivots.js", moduleType: "primary" };
})();
