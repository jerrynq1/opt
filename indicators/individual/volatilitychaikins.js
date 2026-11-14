/* ATAS indicator module: Volatility - Chaikins (VolatilityChaikins) | source: Technical/VolatilityChaikins.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_volatility', 'Historical Volatility', 'osc', 'Annualization không áp dụng; rolling standard deviation của log returns × căn bậc hai số kỳ.', period(), [C.a], ['Historical Volatility'], (A, p) => {
    const r = A.c.map((v, i) => i && v > 0 && A.c[i - 1] > 0 ? Math.log(v / A.c[i - 1]) : null), sd = sdv(r, p.period);
    return [line(sd.map(v => v == null ? null : v * Math.sqrt(p.period) * 100))];
  });
  window.ATASIndicatorFiles["volatilitychaikins"] = { ...{"id": "volatilitychaikins", "name": "Volatility - Chaikins", "sourceClass": "VolatilityChaikins", "sourceFile": "Technical/VolatilityChaikins.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_volatility"}, moduleFile: "indicators/individual/volatilitychaikins.js", moduleType: "primary" };
})();
