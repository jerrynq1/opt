/* ATAS indicator module: Williams' %R (WilliamsR) | source: Technical/WilliamsR.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_williamsr', "Williams' %R", 'osc', 'Williams %R, thang −100 đến 0.', period(), [C.a], ['%R'], (A, p) => {
    const hh = atMax(A.h, p.period), ll = atMin(A.l, p.period);
    return [line(A.c.map((v, i) => hh[i] == null || hh[i] === ll[i] ? null : -100 * (hh[i] - v) / (hh[i] - ll[i])))];
  }, { hl: [{ y: -20, al: .5 }, { y: -80, al: .5 }] });
  window.ATASIndicatorFiles["williamsr"] = { ...{"id": "williamsr", "name": "Williams' %R", "sourceClass": "WilliamsR", "sourceFile": "Technical/WilliamsR.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_williamsr"}, moduleFile: "indicators/individual/williamsr.js", moduleType: "primary" };
})();
