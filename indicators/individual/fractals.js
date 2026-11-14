/* ATAS indicator module: Fractals (Fractals) | source: Technical/Fractals.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_fractals', 'Fractals', 'ov', 'Đánh dấu swing high/low với số nến xác nhận đối xứng.', [['left', 'Left bars', 2, 'i', { min: 1, max: 20 }], ['right', 'Right bars', 2, 'i', { min: 1, max: 20 }]], [C.e, C.d], ['Fractal'], (A, p) => {
    const mk = [], l = P_(p.left), r = P_(p.right);
    for (let i = l; i < A.c.length - r; i++) {
      const h = A.h[i], lo = A.l[i], hs = A.h.slice(i - l, i + r + 1), ls = A.l.slice(i - l, i + r + 1);
      if (h === Math.max(...hs) && hs.indexOf(h) === l) mk.push({ time: A.t[i], position: 'aboveBar', shape: 'arrowDown', color: C.e, text: 'F' });
      if (lo === Math.min(...ls) && ls.indexOf(lo) === l) mk.push({ time: A.t[i], position: 'belowBar', shape: 'arrowUp', color: C.d, text: 'F' });
    }
    return [{ k: 'l', sp: true, d: [], mk, ci: 0, lg: false }];
  });
  window.ATASIndicatorFiles["fractals"] = { ...{"id": "fractals", "name": "Fractals", "sourceClass": "Fractals", "sourceFile": "Technical/Fractals.cs", "group": "market", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_fractals"}, moduleFile: "indicators/individual/fractals.js", moduleType: "primary" };
})();
