/* ATAS indicator module: Round Numbers (RoundNr) | source: Technical/RoundNr.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_round_numbers', 'Round Numbers', 'ov', 'Nearest round-number levels around current price. Step is configurable and independent of broker tick size.', [['step', 'Price step', 100, 'n', { min: .000001 }], ['levels', 'Levels each side', 3, 'i', { min: 1, max: 10 }]], [C.b], ['Round Levels'], (A, p) => Array.from({ length: P_(p.levels) * 2 + 1 }, (_, j) => { const off = j - P_(p.levels); return line(A.c.map(v => Math.round(v / p.step) * p.step + off * p.step), j % 2); }));
  window.ATASIndicatorFiles["roundnr"] = { ...{"id": "roundnr", "name": "Round Numbers", "sourceClass": "RoundNr", "sourceFile": "Technical/RoundNr.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_round_numbers"}, moduleFile: "indicators/individual/roundnr.js", moduleType: "primary" };
})();
