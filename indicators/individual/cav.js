/* ATAS indicator module: Cumulative Adjusted Value (CAV) | source: Technical/CAV.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
  I('atas_cav', 'Cumulative Adjusted Value', 'osc', 'Port Technical/CAV.cs: cumulative sum(Close − EMA(Period)); default Period=10.', [['period','Period',10,'i',{min:1,max:10000}], ['src','Nguồn giá','close','s',{o:[['close','Close'],['open','Open'],['hl2','HL2'],['hlc3','HLC3']]}]], [C.a], ['CAV'], (A,p) => { const src = p.src==='open'?A.o:p.src==='hl2'?A.c.map((v,i)=>(A.h[i]+A.l[i])/2):p.src==='hlc3'?A.c.map((v,i)=>(A.h[i]+A.l[i]+v)/3):A.c; const e=ema(src,P_(p.period)); let run=0; return [line(src.map((v,i)=>{ if(!Number.isFinite(v)||!Number.isFinite(e[i])) return null; run += v-e[i]; return run; }))]; }, {hl:[{y:0,al:.3}]});
  window.ATASIndicatorFiles["cav"] = { ...{"id": "cav", "name": "Cumulative Adjusted Value", "sourceClass": "CAV", "sourceFile": "Technical/CAV.cs", "group": "orderflow", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_cav"}, moduleFile: "indicators/individual/cav.js", moduleType: "primary" };
})();
