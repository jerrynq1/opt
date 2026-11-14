/* ATAS indicator module: Bid Ask Volume Ratio (BidAskVR) | source: Technical/BidAskVR.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { K, I, line, hist, pxHist, mean, num, params, getMinute, inferredStep, cachedKey, tickBars, markerLine, barMarkers, activeTickIndicator, tickNote } = window.ATASQuoteTickRuntime;
    I('atas_bid_ask_ratio_tick', 'Bid Ask Volume Ratio (quote proxy)', 'osc', `${tickNote} Tỷ số buy/sell quote events; không phải ratio khối lượng khớp lệnh.`, [['smooth', 'Làm mượt', 5, 'i', { min: 1, max: 200 }]], [K.blue], ['Buy / Sell quote ratio'], (A, p) => { const s = tickBars(A), r = s.map(x => !x || !x.sell ? (x && x.buy ? 10 : null) : x.buy / x.sell); return [line(mean(r, p.smooth))]; }, { hl: [{ y: 1, al: .3 }] });
  window.ATASIndicatorFiles["bidaskvr"] = { ...{"id": "bidaskvr", "name": "Bid Ask Volume Ratio", "sourceClass": "BidAskVR", "sourceFile": "Technical/BidAskVR.cs", "group": "orderflow", "requirement": "quote_ticks", "status": "ported_tick", "conversion": "quote_tick_proxy", "addKey": "atas_bid_ask_ratio_tick"}, moduleFile: "indicators/individual/bidaskvr.js", moduleType: "primary" };
})();
