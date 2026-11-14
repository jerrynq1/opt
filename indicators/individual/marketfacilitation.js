/* ATAS indicator module: Market Facilitation Index (MarketFacilitation) | source: Technical/MarketFacilitation.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi } = window.ATASIndicatorRuntime;
    I('atas_mfiindex', 'Market Facilitation Index', 'osc', 'MFI = (High−Low) / Volume. Tick volume trên CFD chỉ là proxy hoạt động.', [], [C.a], ['MFI'], A => [hist(A.h.map((v, i) => n(A.v[i]) > 0 ? (v - A.l[i]) / n(A.v[i]) : null))]);
  window.ATASIndicatorFiles["marketfacilitation"] = { ...{"id": "marketfacilitation", "name": "Market Facilitation Index", "sourceClass": "MarketFacilitation", "sourceFile": "Technical/MarketFacilitation.cs", "group": "technical", "requirement": "ohlcv", "status": "ported", "conversion": "approx_proxy", "addKey": "atas_mfiindex"}, moduleFile: "indicators/individual/marketfacilitation.js", moduleType: "primary" };
})();
