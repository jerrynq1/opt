/* ATAS indicator module: Simple Moving Average - Skip Zeros (SZMA) | source: Technical/SZMA.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_szma', 'Simple Moving Average – Skip Zeros', 'ov', 'SMA cửa sổ N bỏ qua các giá trị nguồn bằng 0, theo logic SZMA của ATAS.', period(), [C.a], ['SZMA'], (A, p) => [line(A.c.map((v, i) => {
    const w = A.c.slice(Math.max(0, i - P_(p.period)), i + 1).filter(x => x !== 0);
    return w.length ? w.reduce((s, x) => s + x, 0) / w.length : 0;
  }))]);
  window.ATASIndicatorFiles["szma"] = { ...{"id": "szma", "name": "Simple Moving Average - Skip Zeros", "sourceClass": "SZMA", "sourceFile": "Technical/SZMA.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_szma"}, moduleFile: "indicators/individual/szma.js", moduleType: "primary" };
})();
