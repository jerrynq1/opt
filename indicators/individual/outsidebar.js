/* ATAS indicator module: Outside Bar (OutsideBar) | source: Technical/OutsideBar.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_insidebar', 'Inside / Outside Bar', 'ov', 'Đánh dấu nến nằm trong range trước đó hoặc vượt cả high và low trước đó.', [['mode', 'Pattern', 'inside', 's', { o: [['inside', 'Inside bar'], ['outside', 'Outside bar'], ['both', 'Both']] }]], [C.a, C.e], ['Pattern'], (A, p) => {
    const mk = []; for (let i = 1; i < A.c.length; i++) {
      const inside = A.h[i] <= A.h[i - 1] && A.l[i] >= A.l[i - 1], outside = A.h[i] > A.h[i - 1] && A.l[i] < A.l[i - 1];
      if ((p.mode === 'inside' && inside) || (p.mode === 'outside' && outside) || (p.mode === 'both' && (inside || outside))) mk.push({ time: A.t[i], position: inside ? 'aboveBar' : 'belowBar', shape: inside ? 'circle' : 'square', color: inside ? C.a : C.e, text: inside ? 'IB' : 'OB' });
    }
    return [{ k: 'l', sp: true, d: [], mk, lg: false }];
  });
  window.ATASIndicatorFiles["outsidebar"] = { ...{"id": "outsidebar", "name": "Outside Bar", "sourceClass": "OutsideBar", "sourceFile": "Technical/OutsideBar.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_insidebar"}, moduleFile: "indicators/individual/outsidebar.js", moduleType: "primary" };
})();
