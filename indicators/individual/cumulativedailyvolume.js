/* ATAS indicator module: Cumulative Daily Volume (CumulativeDailyVolume) | source: Technical/CumulativeDailyVolume.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_cumvol', 'Cumulative Volume (UTC day)', 'osc', 'Volume cộng dồn từ đầu ngày UTC; không phải reset theo phiên NY.', [], [C.a], ['Cumulative Volume'], A => {
    let key = null, total = 0; return [line(A.v.map((v, i) => { const k = Math.floor((A.s?.[i] ?? A.t[i]) / 86400); if (key !== k) { key = k; total = 0; } total += n(v); return total; }))];
  }, { pf: 'vol' });
  window.ATASIndicatorFiles["cumulativedailyvolume"] = { ...{"id": "cumulativedailyvolume", "name": "Cumulative Daily Volume", "sourceClass": "CumulativeDailyVolume", "sourceFile": "Technical/CumulativeDailyVolume.cs", "group": "technical", "requirement": "session", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_cumvol"}, moduleFile: "indicators/individual/cumulativedailyvolume.js", moduleType: "primary" };
})();
