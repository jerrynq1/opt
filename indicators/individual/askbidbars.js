/* ATAS indicator module: Ask/Bid Volume Difference Bars (AskBidBars) | source: Technical/AskBidBars.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { K, I, line, hist, pxHist, mean, num, params, getMinute, inferredStep, cachedKey, tickBars, markerLine, barMarkers, activeTickIndicator, tickNote } = window.ATASQuoteTickRuntime;
    I('atas_ask_bid_bars_tick', 'Ask/Bid Volume Difference Bars (quote proxy)', 'osc', `${tickNote} Histogram là Buy events − Sell events, không phải traded volume delta.`, [], [K.buy, K.sell], ['Quote delta'], A => [hist(tickBars(A).map(x => x ? ({ v: x.delta, c: x.delta >= 0 ? K.buy : K.sell }) : null))], { hl: [{ y: 0, al: .3 }] });
  window.ATASIndicatorFiles["askbidbars"] = { ...{"id": "askbidbars", "name": "Ask/Bid Volume Difference Bars", "sourceClass": "AskBidBars", "sourceFile": "Technical/AskBidBars.cs", "group": "orderflow", "requirement": "quote_ticks", "status": "ported_tick", "conversion": "quote_tick_proxy", "addKey": "atas_ask_bid_bars_tick"}, moduleFile: "indicators/individual/askbidbars.js", moduleType: "primary" };
})();
