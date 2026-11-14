/* ATAS indicator module: Daily HighLow (DailyHighLow) | source: Technical/DailyHighLow.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_dailyhl', 'Previous Day High / Low', 'ov', 'Mốc high/low của ngày trước theo UTC server-day; không phải session NY.', [], [C.d, C.e], ['PDH', 'PDL'], A => {
    const hi = Array(A.c.length).fill(null), lo = Array(A.c.length).fill(null); let key = null, curH = null, curL = null, prevH = null, prevL = null;
    for (let i = 0; i < A.c.length; i++) {
      const k = Math.floor((A.s?.[i] ?? A.t[i]) / 86400);
      if (key !== null && k !== key) { prevH = curH; prevL = curL; curH = null; curL = null; }
      if (prevH != null) { hi[i] = prevH; lo[i] = prevL; }
      curH = curH == null ? A.h[i] : Math.max(curH, A.h[i]); curL = curL == null ? A.l[i] : Math.min(curL, A.l[i]); key = k;
    }
    return [line(hi, 0), line(lo, 1)];
  });
  window.ATASIndicatorFiles["dailyhighlow"] = { ...{"id": "dailyhighlow", "name": "Daily HighLow", "sourceClass": "DailyHighLow", "sourceFile": "Technical/DailyHighLow.cs", "group": "technical", "requirement": "session", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_dailyhl"}, moduleFile: "indicators/individual/dailyhighlow.js", moduleType: "primary" };
})();
