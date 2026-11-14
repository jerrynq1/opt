/* ATAS indicator module: Chande Forecast Oscillator (CFO) | source: Technical/CFO.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_cfo', 'Chande Forecast Oscillator', 'osc', 'CFO = (Close − linear regression endpoint) / Close × 100.', period(), [C.a], ['CFO'], (A, p) => { const lr = atRoll(A.c, p.period, w => { const n = w.length, sx = (n - 1) * n / 2, sy = w.reduce((s, x) => s + x, 0), sxx = (n - 1) * n * (2 * n - 1) / 6; let sxy = 0; for (let i = 0; i < n; i++) sxy += i * w[i]; const m = (n * sxy - sx * sy) / (n * sxx - sx * sx); return (sy - m * sx) / n + m * (n - 1); }); return [line(A.c.map((v, i) => lr[i] == null || !v ? null : 100 * (v - lr[i]) / v))]; }, { hl: [{ y: 0, al: .5 }] });
  window.ATASIndicatorFiles["cfo"] = { ...{"id": "cfo", "name": "Chande Forecast Oscillator", "sourceClass": "CFO", "sourceFile": "Technical/CFO.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_cfo"}, moduleFile: "indicators/individual/cfo.js", moduleType: "primary" };
})();
