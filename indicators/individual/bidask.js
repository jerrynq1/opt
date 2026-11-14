/* ATAS indicator module: Bid Ask (BidAsk) | source: Technical/BidAsk.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { K, I, line, hist, pxHist, mean, num, params, getMinute, inferredStep, cachedKey, tickBars, markerLine, barMarkers, activeTickIndicator, tickNote } = window.ATASQuoteTickRuntime;
    I('atas_bid_ask_tick', 'Bid Ask (quote proxy)', 'osc', `${tickNote} Hai histogram đếm quote changes được phân loại buy/sell.`, [], [K.buy, K.sell], ['Buy quote events', 'Sell quote events'], A => { const s = tickBars(A); return [hist(s.map(x => x ? x.buy : null), 0), hist(s.map(x => x ? -x.sell : null), 1)]; }, { pf: 'vol' });
  window.ATASIndicatorFiles["bidask"] = { ...{"id": "bidask", "name": "Bid Ask", "sourceClass": "BidAsk", "sourceFile": "Technical/BidAsk.cs", "group": "orderflow", "requirement": "quote_ticks", "status": "ported_tick", "conversion": "quote_tick_proxy", "addKey": "atas_bid_ask_tick"}, moduleFile: "indicators/individual/bidask.js", moduleType: "primary" };
})();
