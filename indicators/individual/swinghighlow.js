/* ATAS indicator module: Swing High and Low (SwingHighLow) | source: Technical/SwingHighLow.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_swing_high_low', 'Swing High and Low', 'ov', 'Confirmed swing levels with left/right bars; confirmation occurs only after right-side bars close.', [['left', 'Left bars', 3, 'i', { min: 1, max: 20 }], ['right', 'Right bars', 3, 'i', { min: 1, max: 20 }]], [C.d, C.e], ['Swing High', 'Swing Low'], (A, p) => {
    const hi = Array(A.c.length).fill(null), lo = Array(A.c.length).fill(null), l = P_(p.left), r = P_(p.right);
    for (let i = l; i + r < A.c.length; i++) { const k = i + r, h = A.h[k], low = A.l[k]; let okH = true, okL = true; for (let j = k - l; j <= k + r; j++) { if (j !== k && A.h[j] >= h) okH = false; if (j !== k && A.l[j] <= low) okL = false; } if (okH) hi[k] = h; if (okL) lo[k] = low; }
    return [line(hi, 0), line(lo, 1)];
  });
  window.ATASIndicatorFiles["swinghighlow"] = { ...{"id": "swinghighlow", "name": "Swing High and Low", "sourceClass": "SwingHighLow", "sourceFile": "Technical/SwingHighLow.cs", "group": "market", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_swing_high_low"}, moduleFile: "indicators/individual/swinghighlow.js", moduleType: "primary" };
})();
