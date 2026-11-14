/* Compatibility indicator registration retained from the prior QuantLab catalogue. */
(function(){'use strict';
const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
  I('atas_cvd_proxy', 'Cumulative Delta (OHLCV proxy)', 'osc', 'CVD proxy: volume gán dấu theo hướng nến rồi cộng dồn theo anchor. Không phải bid/ask aggressor flow hoặc exchange trade tape.', [['anchor', 'Reset', 'Session', 's', { o: [['Session', 'Daily (UTC)'], ['Week', 'Week'], ['Month', 'Month'], ['Quarter', 'Quarter'], ['Year', 'Year']] }]], [C.a], ['CVD proxy'], (A, p) => {
    const keyFn = perKey(p.anchor), out = []; let key = null, cum = 0, prevDir = 1;
    for (let i = 0; i < A.c.length; i++) {
      const k = keyFn(A.s?.[i] ?? A.t[i]); if (key !== null && k !== key) cum = 0;
      const dir = A.c[i] > A.o[i] ? 1 : A.c[i] < A.o[i] ? -1 : i && A.c[i] > A.c[i - 1] ? 1 : i && A.c[i] < A.c[i - 1] ? -1 : prevDir;
      prevDir = dir; cum += dir * Math.max(0, n(A.v[i])); out.push(cum); key = k;
    }
    return [line(out)];
  }, { pf: 'vol' });
})();
