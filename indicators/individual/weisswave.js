/* ATAS indicator module: Weis Wave (WeissWave) | source: Technical/WeissWave.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
  I('atas_weis_wave', 'Weis Wave', 'osc', 'Port Technical/WeissWave.cs: accumulates candle volume while candle direction remains unchanged; resets on direction change. Candle volume may be broker tick volume for CFDs.', [['filter','Filter',0,'i',{min:0,max:100000000}]], [C.d,C.e,C.a], ['Weis Wave'], (A,p) => { const out=[]; let prevDir=0,run=0; for(let i=0;i<A.c.length;i++){const dir=Math.sign(A.o[i]-A.c[i]);const vol=Math.max(0,n(A.v[i]));run=i&&dir===prevDir?run+vol:vol;prevDir=dir;out.push({v:run,c:run>p.filter?C.a:(A.c[i]>A.o[i]?C.d:C.e)});} return [hist(out,0)]; }, {pf:'vol'});
  window.ATASIndicatorFiles["weisswave"] = { ...{"id": "weisswave", "name": "Weis Wave", "sourceClass": "WeissWave", "sourceFile": "Technical/WeissWave.cs", "group": "orderflow", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_weis_wave"}, moduleFile: "indicators/individual/weisswave.js", moduleType: "primary" };
})();
