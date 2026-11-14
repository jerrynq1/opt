/* ATAS indicator module: Q Stick (QStick) | source: Technical/QStick.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_qstick', 'QStick', 'osc', 'Trung bình động của Close−Open.', period(), [C.a], ['QStick'], (A, p) => [line(sma(A.c.map((v, i) => v - A.o[i]), p.period))], { hl: [{ y: 0, al: .5 }] });
  window.ATASIndicatorFiles["qstick"] = { ...{"id": "qstick", "name": "Q Stick", "sourceClass": "QStick", "sourceFile": "Technical/QStick.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_qstick"}, moduleFile: "indicators/individual/qstick.js", moduleType: "primary" };
})();
