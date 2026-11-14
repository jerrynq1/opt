/* ATAS indicator module: Elder Ray (ElderRay) | source: Technical/ElderRay.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
  
  I('atas_elderray', 'Elder Ray', 'osc', 'Bull Power = High−EMA và Bear Power = Low−EMA.', period(), [C.d, C.e], ['Bull Power', 'Bear Power'], (A, p) => { const e = ema(A.c, p.period); return [hist(A.h.map((v, i) => e[i] == null ? null : v - e[i]), 0), hist(A.l.map((v, i) => e[i] == null ? null : v - e[i]), 1)]; }, { hl: [{ y: 0, al: .5 }] });
  window.ATASIndicatorFiles["elderray"] = { ...{"id": "elderray", "name": "Elder Ray", "sourceClass": "ElderRay", "sourceFile": "Technical/ElderRay.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_elderray"}, moduleFile: "indicators/individual/elderray.js", moduleType: "primary" };
})();
