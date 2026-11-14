/* ATAS indicator module: Linear Regression (LinearReg) | source: Technical/LinearReg.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_linreg', 'Linear Regression', 'ov', 'Giá trị cuối đường hồi quy tuyến tính trên cửa sổ N nến.', period(), [C.a], ['LinReg'], (A, p) => [line(atRoll(A.c, p.period, w => {
    const n = w.length, sx = (n - 1) * n / 2, sy = w.reduce((s, x) => s + x, 0), sxx = (n - 1) * n * (2 * n - 1) / 6;
    let sxy = 0; for (let i = 0; i < n; i++) sxy += i * w[i]; const den = n * sxx - sx * sx;
    const m = den ? (n * sxy - sx * sy) / den : 0, b = (sy - m * sx) / n; return b + m * (n - 1);
  }))]);
  window.ATASIndicatorFiles["linearreg"] = { ...{"id": "linearreg", "name": "Linear Regression", "sourceClass": "LinearReg", "sourceFile": "Technical/LinearReg.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_linreg"}, moduleFile: "indicators/individual/linearreg.js", moduleType: "primary" };
})();
