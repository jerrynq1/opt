/* ATAS indicator module: Linear Regression Channel (LinRegChannel) | source: Technical/LinRegChannel.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_linregchannel', 'Linear Regression Channel', 'ov', 'Linear Regression endpoint với dải độ lệch chuẩn của residual.', [['period', 'Period', 100, 'i', { min: 2, max: 1000 }], ['mult', 'Deviation', 2, 'n', { min: .1, step: .1 }]], [C.a, C.b], ['Regression', 'Channel'], (A, p) => {
    const center = [], upper = [], lower = [], len = P_(p.period);
    for (let i = 0; i < A.c.length; i++) {
      if (i < len - 1) { center.push(null); upper.push(null); lower.push(null); continue; }
      const w = A.c.slice(i - len + 1, i + 1), nn = w.length, sx = (nn - 1) * nn / 2, sy = w.reduce((s, x) => s + x, 0), sxx = (nn - 1) * nn * (2 * nn - 1) / 6;
      let sxy = 0; for (let j = 0; j < nn; j++) sxy += j * w[j]; const den = nn * sxx - sx * sx, m = den ? (nn * sxy - sx * sy) / den : 0, b = (sy - m * sx) / nn, lineNow = b + m * (nn - 1);
      let err = 0; for (let j = 0; j < nn; j++) err += (w[j] - (b + m * j)) ** 2; const sd = Math.sqrt(err / nn);
      center.push(lineNow); upper.push(lineNow + p.mult * sd); lower.push(lineNow - p.mult * sd);
    }
    return [line(center, 0), line(upper, 1), line(lower, 1), fill(upper, lower, 1, .06)];
  });
  window.ATASIndicatorFiles["linregchannel"] = { ...{"id": "linregchannel", "name": "Linear Regression Channel", "sourceClass": "LinRegChannel", "sourceFile": "Technical/LinRegChannel.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_linregchannel"}, moduleFile: "indicators/individual/linregchannel.js", moduleType: "primary" };
})();
