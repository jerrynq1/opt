/* ATAS indicator module: Linear Regression Slope (LinRegSlope) | source: Technical/LinRegSlope.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_lrslope', 'Linear Regression Slope', 'osc', 'Slope của linear regression theo đơn vị giá mỗi nến.', period(), [C.a], ['LR Slope'], (A, p) => [line(atRoll(A.c, p.period, w => {
    const n = w.length, sx = (n - 1) * n / 2, sy = w.reduce((s, x) => s + x, 0), sxx = (n - 1) * n * (2 * n - 1) / 6;
    let sxy = 0; for (let i = 0; i < n; i++) sxy += i * w[i]; const den = n * sxx - sx * sx; return den ? (n * sxy - sx * sy) / den : null;
  }))], { hl: [{ y: 0, al: .5 }] });
  window.ATASIndicatorFiles["linregslope"] = { ...{"id": "linregslope", "name": "Linear Regression Slope", "sourceClass": "LinRegSlope", "sourceFile": "Technical/LinRegSlope.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_lrslope"}, moduleFile: "indicators/individual/linregslope.js", moduleType: "primary" };
})();
