/* ATAS indicator module: Block Moving Average (BlockMA) | source: Technical/BlockMA.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_block_ma', 'Block Moving Average', 'ov', 'Stair-step average of fixed non-overlapping blocks; block is defined in bars because the browser port has no ATAS aggregation object.', [['block', 'Block bars', 5, 'i', { min: 1, max: 500 }]], [C.a], ['Block MA'], (A, p) => { const z = P_(p.block), out = A.c.map((_, i) => { const start = Math.floor(i / z) * z, w = A.c.slice(start, i + 1); return w.reduce((s, x) => s + x, 0) / w.length; }); return [line(out)]; });
  window.ATASIndicatorFiles["blockma"] = { ...{"id": "blockma", "name": "Block Moving Average", "sourceClass": "BlockMA", "sourceFile": "Technical/BlockMA.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_block_ma"}, moduleFile: "indicators/individual/blockma.js", moduleType: "primary" };
})();
