/* ATAS indicator module: Chaikin Money Oscillator (CMO) | source: Technical/CMO.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_chaikin_cmo', 'Chaikin Money Oscillator (ATAS)', 'osc', 'ATAS CMO: daily/session high-low money-flow volume; EMA(long) − EMA(short) theo đúng recurrence trong source. Browser dùng UTC-day reset làm proxy cho IsNewSession; cần đối chiếu session timezone của broker.', [['long', 'Long period', 10, 'i', { min: 1, max: 10000 }], ['short', 'Short period', 3, 'i', { min: 1, max: 10000 }]], [C.a], ['Chaikin CMO'], (A, p) => {
    const out = Array(A.c.length).fill(0), ad = Array(A.c.length).fill(0);
    let day = null, hi = 0, lo = 0;
    for (let i = 0; i < A.c.length; i++) {
      const ts = Number(A.s?.[i] ?? A.t[i]), k = Number.isFinite(ts) ? Math.floor(ts / 86400) : day;
      if (i === 0) { day = k; continue; }
      if (k !== day) { day = k; hi = 0; lo = 0; }
      hi = hi === 0 ? A.h[i] : Math.max(hi, A.h[i]);
      lo = lo === 0 ? A.l[i] : Math.min(lo, A.l[i]);
      if (hi !== lo) ad[i] = ((A.c[i] - lo - (hi - A.c[i])) / (hi - lo)) * n(A.v[i]);
      if (i >= P_(p.long) && Number.isFinite(ad[i - 1])) {
        const al = 2 / (P_(p.long) + 1), as = 2 / (P_(p.short) + 1);
        const el = ad[i] * al + (1 - al) * ad[i - 1];
        const es = ad[i] * as + (1 - as) * ad[i - 1];
        out[i] = el - es;
      }
    }
    return [line(out)];
  }, { pf: 'vol' });
  window.ATASIndicatorFiles["cmo"] = { ...{"id": "cmo", "name": "Chaikin Money Oscillator", "sourceClass": "CMO", "sourceFile": "Technical/CMO.cs", "group": "technical", "requirement": "session", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_chaikin_cmo"}, moduleFile: "indicators/individual/cmo.js", moduleType: "primary" };
})();
