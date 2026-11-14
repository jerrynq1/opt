/* ATAS indicator module: Trade Volume Index (TVI) | source: Technical/TVI.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_tvi_proxy', 'Trade Volume Index (OHLCV proxy)', 'osc', 'TVI tích lũy volume theo hướng thay đổi Close; ngưỡng tick-size phải cấu hình xấp xỉ do feed không cung cấp InstrumentInfo.TickSize vào module.', [['tick', 'Tick-size threshold', .01, 'n', { min: 0, step: .0001 }]], [C.a], ['TVI proxy'], (A, p) => {
    let cum = 0; const out = A.c.map((v, i) => { if (i) { const d = v - A.c[i - 1]; if (d > p.tick) cum += n(A.v[i]); else if (d < p.tick && d !== p.tick) cum -= n(A.v[i]); } return cum; }); return [line(out)];
  }, { pf: 'vol' });
  window.ATASIndicatorFiles["tvi"] = { ...{"id": "tvi", "name": "Trade Volume Index", "sourceClass": "TVI", "sourceFile": "Technical/TVI.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_tvi_proxy"}, moduleFile: "indicators/individual/tvi.js", moduleType: "primary" };
})();
