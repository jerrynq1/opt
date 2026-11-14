/* ATAS indicator module: TD Sequential (TDSequential) | source: Technical/TDSequential.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_td_sequential', 'TD Sequential', 'osc', 'TD Setup count approximation: consecutive closes relative to close four bars earlier; setup count is not a full TD Countdown.', [], [C.d, C.e], ['Buy Setup', 'Sell Setup'], A => {
    const buy = Array(A.c.length).fill(null), sell = Array(A.c.length).fill(null); let b = 0, s = 0;
    for (let i = 0; i < A.c.length; i++) { if (i < 4) continue; if (A.c[i] < A.c[i - 4]) { b = Math.min(9, b + 1); s = 0; } else if (A.c[i] > A.c[i - 4]) { s = Math.min(9, s + 1); b = 0; } else { b = s = 0; } buy[i] = b || null; sell[i] = s || null; }
    return [line(buy, 0), line(sell, 1)];
  });
  window.ATASIndicatorFiles["tdsequential"] = { ...{"id": "tdsequential", "name": "TD Sequential", "sourceClass": "TDSequential", "sourceFile": "Technical/TDSequential.cs", "group": "market", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_td_sequential"}, moduleFile: "indicators/individual/tdsequential.js", moduleType: "primary" };
})();
