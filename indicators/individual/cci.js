/* ATAS indicator module: CCI (CCI) | source: Technical/CCI.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_cci', 'Commodity Channel Index', 'osc', 'CCI = (Typical Price − SMA) / (0.015 × mean deviation).', period(), [C.a], ['CCI'], (A, p) => {
    const tp = A.c.map((v, i) => (A.h[i] + A.l[i] + v) / 3), mid = sma(tp, p.period), md = atMeanDev(tp, p.period);
    return [line(tp.map((v, i) => mid[i] == null || md[i] == null || md[i] === 0 ? null : (v - mid[i]) / (.015 * md[i])))];
  }, { hl: [{ y: -100, al: .35 }, { y: 0, al: .25 }, { y: 100, al: .35 }] });
  window.ATASIndicatorFiles["cci"] = { ...{"id": "cci", "name": "CCI", "sourceClass": "CCI", "sourceFile": "Technical/CCI.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_cci"}, moduleFile: "indicators/individual/cci.js", moduleType: "primary" };
})();
