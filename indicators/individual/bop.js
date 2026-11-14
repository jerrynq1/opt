/* ATAS indicator module: Balance of Power (BOP) | source: Technical/BOP.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_bop', 'Balance of Power', 'osc', 'BOP = (Close − Open) / (High − Low).', [], [C.a], ['BOP'], A => [hist(A.c.map((v, i) => A.h[i] === A.l[i] ? null : (v - A.o[i]) / (A.h[i] - A.l[i])))], { hl: [{ y: 0, al: .5 }] });
  window.ATASIndicatorFiles["bop"] = { ...{"id": "bop", "name": "Balance of Power", "sourceClass": "BOP", "sourceFile": "Technical/BOP.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_bop"}, moduleFile: "indicators/individual/bop.js", moduleType: "primary" };
})();
