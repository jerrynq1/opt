/* ATAS indicator module: Rahul Mohindar Oscillator (RMO) | source: Technical/RMO.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_rmo', 'Rahul Mohindar Oscillator', 'osc', 'Port theo logic source: chuỗi 10 SMA lồng nhau, swing-trade normalized by rolling high-low, kèm EMA signal và hai EMA smooth.', [['period', 'SMA periods', 10, 'i', { min: 1 }], ['range', 'High/Low period', 10, 'i', { min: 1 }], ['ema', 'EMA smooth', 10, 'i', { min: 1 }], ['signal', 'Signal EMA', 15, 'i', { min: 1 }]], [C.a, C.b, C.d], ['RMO', 'EMA 1', 'EMA 2'], (A, p) => {
    const n0 = P_(p.period), hi = atMax(A.h, p.range), lo = atMin(A.l, p.range); let chain = A.c.slice();
    for (let j = 0; j < 10; j++) chain = sma(chain, n0);
    const st = A.c.map((v, i) => hi[i] == null || lo[i] == null || hi[i] === lo[i] ? 0 : 100 * (v - chain[i]) / (hi[i] - lo[i]));
    const e1 = ema(st, p.ema), e2 = ema(e1, p.ema), sig = ema(st, p.signal);
    return [line(sig, 0), line(e1, 1), line(e2, 2)];
  }, { hl: [{ y: 0, al: .3 }] });
  window.ATASIndicatorFiles["rmo"] = { ...{"id": "rmo", "name": "Rahul Mohindar Oscillator", "sourceClass": "RMO", "sourceFile": "Technical/RMO.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_rmo"}, moduleFile: "indicators/individual/rmo.js", moduleType: "primary" };
})();
