/* ATAS indicator module: Dynamic Momentum Index (DMI) | source: Technical/DMI.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_dynamic_momentum', 'Dynamic Momentum Index (ATAS)', 'osc', 'Port thuật toán ATAS DMI: RSI động với period = RsiPeriod / (StdDev / SMA(StdDev)), clamp RsiMin–RsiMax. Source mặc định Close; StdDev/SMA periods lần lượt 5/10.', [['rsiPeriod', 'RSI base period', 14, 'i', { min: 1, max: 10000 }], ['rsiMin', 'Minimum dynamic period', 3, 'i', { min: 1, max: 10000 }], ['rsiMax', 'Maximum dynamic period', 30, 'i', { min: 1, max: 10000 }], ['stdPeriod', 'StdDev period', 5, 'i', { min: 1, max: 10000 }], ['smaPeriod', 'StdDev SMA period', 10, 'i', { min: 1, max: 10000 }]], [C.a], ['Dynamic RSI'], (A, p) => {
    const std = sdv(A.c, P_(p.stdPeriod)), avg = sma(std, P_(p.smaPeriod));
    const out = Array(A.c.length).fill(0);
    let pos = 0, neg = 0, prevPos = 0, prevNeg = 0;
    const roundEven = x => { const f = Math.floor(x), d = x - f; return d < .5 ? f : d > .5 ? f + 1 : (f % 2 === 0 ? f : f + 1); };
    for (let i = 0; i < A.c.length; i++) {
      if (i === 0) { pos = neg = prevPos = prevNeg = 0; continue; }
      const diff = A.c[i] - A.c[i - 1], up = diff > 0 ? diff : 0, down = diff < 0 ? -diff : 0;
      if (std[i] == null || avg[i] == null || std[i] === 0 || avg[i] === 0) { out[i] = out[i - 1]; continue; }
      const vi = std[i] / avg[i];
      const dynamic = Math.max(P_(p.rsiMin), Math.min(P_(p.rsiMax), roundEven(P_(p.rsiPeriod) / vi)));
      pos = (prevPos * (dynamic - 1) + up) / dynamic;
      neg = (prevNeg * (dynamic - 1) + down) / dynamic;
      if (neg !== 0) { const div = pos / neg; out[i] = div === 1 ? 0 : 100 - 100 / (1 + div); }
      else out[i] = 100;
      prevPos = pos; prevNeg = neg;
    }
    return [line(out)];
  }, { hl: [{ y: 70, al: .35 }, { y: 50, al: .2 }, { y: 30, al: .35 }] });
  window.ATASIndicatorFiles["dmi"] = { ...{"id": "dmi", "name": "Dynamic Momentum Index", "sourceClass": "DMI", "sourceFile": "Technical/DMI.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_dynamic_momentum"}, moduleFile: "indicators/individual/dmi.js", moduleType: "primary" };
})();
