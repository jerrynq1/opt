/* ATAS indicator module: Directional Movement Index (DmIndex) | source: Technical/DmIndex.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_dmi', 'Directional Movement / ADX', 'osc', 'Directional Movement Index (DI+/DI−/ADX) theo Wilder; đây là proxy cho các ATAS studies liên quan, không phải Dynamic Momentum Index.', period(), [C.d, C.e, C.b], ['DI+', 'DI−', 'ADX'], (A, p) => { const d = atDMI(A, p.period); return [line(d.pdi, 0), line(d.mdi, 1), line(d.adx, 2)]; }, { hl: [{ y: 20, al: .4 }] });
  window.ATASIndicatorFiles["dmindex"] = { ...{"id": "dmindex", "name": "Directional Movement Index", "sourceClass": "DmIndex", "sourceFile": "Technical/DmIndex.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_dmi"}, moduleFile: "indicators/individual/dmindex.js", moduleType: "primary" };
})();
