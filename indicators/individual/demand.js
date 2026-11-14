/* ATAS indicator module: Demand Index (Demand) | source: Technical/Demand.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_demand_index', 'Demand Index (OHLCV port)', 'osc', 'Translation of ATAS pressure calculation using priceSum = High + Low + 2×Close and EMA volume/buy-sell pressure. Requires OHLCV volume; CFD volume may be tick volume.', [['period', 'EMA period', 10, 'i', { min: 1 }], ['signal', 'Signal SMA', 10, 'i', { min: 1 }]], [C.a, C.b], ['Demand Index', 'Signal'], (A, p) => {
    const vol = ema(A.v.map(n), p.period), ps = A.c.map((v, i) => A.h[i] + A.l[i] + 2 * v), bp = [], sp = [];
    const firstRange = Math.max(1e-12, A.h[0] - A.l[0]);
    for (let i = 0; i < A.c.length; i++) { if (i === 0 || !vol[i] || !vol[i - 1]) { bp.push(0); sp.push(0); continue; }
      const prev = ps[i - 1], cur = ps[i], ratio = Math.max(1e-8, n(A.v[i]) / vol[i]);
      const b = cur < prev ? ratio / Math.exp(.375 * ((cur + prev) / firstRange) * ((prev - cur) / Math.max(1e-8, cur))) : ratio;
      const q = cur <= prev ? ratio : ratio / Math.exp(.375 * ((cur + prev) / firstRange) * ((cur - prev) / Math.max(1e-8, prev)));
      bp.push(b); sp.push(q);
    }
    const eb = ema(bp, p.period), es = ema(sp, p.period), di = eb.map((v, i) => { const den = Math.max(v, es[i]); return den ? 100 * (v - es[i]) / den : 0; });
    return [line(di, 0), line(sma(di, p.signal), 1)];
  }, { pf: 'vol' });
  window.ATASIndicatorFiles["demand"] = { ...{"id": "demand", "name": "Demand Index", "sourceClass": "Demand", "sourceFile": "Technical/Demand.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_demand_index"}, moduleFile: "indicators/individual/demand.js", moduleType: "primary" };
})();
