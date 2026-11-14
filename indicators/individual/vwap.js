/* ATAS indicator module: VWAP (basic; source indicator also supports TWAP) | source: Technical/VWAP.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_vwap', 'Volume Weighted Average Price', 'ov', 'VWAP tích lũy theo anchor; dùng HLC3 × volume của chart. Với CFD, volume là tick volume nếu broker chỉ cung cấp tick volume.', [['anchor', 'Reset', 'Session', 's', { o: [['Session', 'Daily (UTC)'], ['Week', 'Week'], ['Month', 'Month'], ['Quarter', 'Quarter'], ['Year', 'Year']] }]], [C.b], ['VWAP'], (A, p) => {
    const keyFn = perKey(p.anchor), pv = [], vv = []; let key = null, sumPV = 0, sumV = 0;
    for (let i = 0; i < A.c.length; i++) {
      const k = keyFn(A.s?.[i] ?? A.t[i]); if (key !== null && k !== key) { sumPV = 0; sumV = 0; }
      const price = (A.h[i] + A.l[i] + A.c[i]) / 3, vol = Math.max(0, n(A.v[i])); sumPV += price * vol; sumV += vol;
      pv.push(sumV > 0 ? sumPV / sumV : null); vv.push(sumV); key = k;
    }
    return [line(pv)];
  });
  window.ATASIndicatorFiles["vwap"] = { ...{"id": "vwap", "name": "VWAP (basic)", "sourceClass": "VWAP", "sourceFile": "Technical/VWAP.cs", "group": "technical", "requirement": "session", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_vwap"}, moduleFile: "indicators/individual/vwap.js", moduleType: "primary" };
})();
