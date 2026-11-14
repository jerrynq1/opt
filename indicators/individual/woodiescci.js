/* ATAS indicator module: Woodies CCI (WoodiesCCI) | source: Technical/WoodiesCCI.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_woodies_cci', 'Woodies CCI (proxy)', 'osc', 'CCI(14) with a longer CCI trend line; Woodies-specific pattern rules are not replicated.', [['fast', 'CCI fast', 14, 'i', { min: 1 }], ['slow', 'CCI slow', 6, 'i', { min: 1 }]], [C.a, C.b], ['CCI', 'Turbo CCI'], (A, p) => { const tp = atHLC3(A), calc = per => { const m = sma(tp, per), d = atMeanDev(tp, per); return tp.map((v, i) => m[i] == null || !d[i] ? null : (v - m[i]) / (.015 * d[i])); }; return [line(calc(p.fast), 0), line(calc(p.slow), 1)]; }, { hl: [{ y: 100, al: .3 }, { y: 0, al: .2 }, { y: -100, al: .3 }] });
  window.ATASIndicatorFiles["woodiescci"] = { ...{"id": "woodiescci", "name": "Woodies CCI", "sourceClass": "WoodiesCCI", "sourceFile": "Technical/WoodiesCCI.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_woodies_cci"}, moduleFile: "indicators/individual/woodiescci.js", moduleType: "primary" };
})();
