/* ATAS indicator module: Relative Volume (RelativeVolume) | source: Technical/RelativeVolume.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_relvol', 'Relative Volume', 'osc', 'Volume hiện tại chia SMA Volume; trên CFD có thể là tick volume.', period(), [C.a], ['Relative Volume'], (A, p) => {
    const m = sma(A.v, p.period); return [hist(A.v.map((v, i) => m[i] ? v / m[i] : null))];
  }, { hl: [{ y: 1, al: .5 }] });
  window.ATASIndicatorFiles["relativevolume"] = { ...{"id": "relativevolume", "name": "Relative Volume", "sourceClass": "RelativeVolume", "sourceFile": "Technical/RelativeVolume.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_relvol"}, moduleFile: "indicators/individual/relativevolume.js", moduleType: "primary" };
})();
