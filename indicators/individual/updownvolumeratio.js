/* ATAS indicator module: Up/Down Volume Ratio (UpDownVolumeRatio) | source: Technical/UpDownVolumeRatio.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_updown_volume_ratio', 'Up/Down Volume Ratio (OHLCV mode)', 'osc', 'ATAS default UpDownVolume mode: mỗi nến tăng/giảm tạo +100/−100, sau đó EMA. AskBidVolume mode cần nguồn Bid/Ask thực và không được giả lập từ OHLCV.', [['period', 'EMA period', 10, 'i', { min: 1 }]], [C.a], ['Up/Down Volume'], (A, p) => { const x = A.c.map((v, i) => i === 0 ? 0 : A.o[i] < v ? 100 : A.o[i] > v ? -100 : 0); return [hist(ema(x, p.period))]; }, { hl: [{ y: 0, al: .35 }] });
  window.ATASIndicatorFiles["updownvolumeratio"] = { ...{"id": "updownvolumeratio", "name": "Up/Down Volume Ratio", "sourceClass": "UpDownVolumeRatio", "sourceFile": "Technical/UpDownVolumeRatio.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "direct", "addKey": "atas_updown_volume_ratio"}, moduleFile: "indicators/individual/updownvolumeratio.js", moduleType: "primary" };
})();
