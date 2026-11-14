/* ATAS indicator module: Guppy Multiple Moving Average (GMMA) | source: Technical/GMMA.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_gmma', 'Guppy Multiple MA', 'ov', 'Cụm 6 EMA ngắn và 6 EMA dài để quan sát đồng thuận xu hướng.', [], [C.a, C.b], ['Short GMMA', 'Long GMMA'], A => {
    const S = [3, 5, 8, 10, 12, 15].map(x => line(ema(A.c, x), 0, 1));
    S.push(...[30, 35, 40, 45, 50, 60].map(x => line(ema(A.c, x), 1, 1))); return S;
  });
  window.ATASIndicatorFiles["gmma"] = { ...{"id": "gmma", "name": "Guppy Multiple Moving Average", "sourceClass": "GMMA", "sourceFile": "Technical/GMMA.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_gmma"}, moduleFile: "indicators/individual/gmma.js", moduleType: "primary" };
})();
