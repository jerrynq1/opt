/* ATAS indicator module: Alligator (Alligator) | source: Technical/Alligator.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_alligator', 'Bill Williams Alligator', 'ov', 'Jaw/Teeth/Lips dùng SMMA trên Median Price, dịch lần lượt 8/5/3 nến.', [], [C.a, C.b, C.d], ['Jaw', 'Teeth', 'Lips'], A => {
    const m = atMedian(A); return [line(shiftA(rma(m, 13), 8), 0), line(shiftA(rma(m, 8), 5), 1), line(shiftA(rma(m, 5), 3), 2)];
  });
  window.ATASIndicatorFiles["alligator"] = { ...{"id": "alligator", "name": "Alligator", "sourceClass": "Alligator", "sourceFile": "Technical/Alligator.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_alligator"}, moduleFile: "indicators/individual/alligator.js", moduleType: "primary" };
})();
