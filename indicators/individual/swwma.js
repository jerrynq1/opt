/* ATAS indicator module: Sine-Wave Weighted Moving Average (SWWMA) | source: Technical/SWWMA.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_swwma', 'Sine-Wave Weighted Moving Average', 'ov', 'Sine weights sin(i·π/6) over the previous six bars, matching the ATAS fixed 5-lag window.', [], [C.a], ['SWWMA'], A => {
    const weights = Array.from({ length: 5 }, (_, i) => Math.sin((i + 1) * Math.PI / 6)), den = weights.reduce((s, x) => s + x, 0);
    return [line(A.c.map((v, i) => i < 5 ? v : weights.reduce((s, w, j) => s + w * A.c[i - j - 1], 0) / den))];
  });
  window.ATASIndicatorFiles["swwma"] = { ...{"id": "swwma", "name": "Sine-Wave Weighted Moving Average", "sourceClass": "SWWMA", "sourceFile": "Technical/SWWMA.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_swwma"}, moduleFile: "indicators/individual/swwma.js", moduleType: "primary" };
})();
