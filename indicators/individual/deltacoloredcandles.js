/* ATAS indicator module: Delta Colored Candles (DeltaColoredCandles) | source: Technical/DeltaColoredCandles.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { K, I, line, hist, pxHist, mean, num, params, getMinute, inferredStep, cachedKey, tickBars, markerLine, barMarkers, activeTickIndicator, tickNote } = window.ATASQuoteTickRuntime;
    I('atas_delta_candles_tick', 'Delta Colored Candles (quote proxy)', 'ov', `${tickNote} Overlay OHLC candles colored by signed quote-event delta; does not colour by executed trades.`, [], [K.buy, K.sell], ['Buy delta', 'Sell delta'], A => { const s = tickBars(A); return [{ k: 'c', d: s.map((x, i) => x ? ({ o: A.o[i], h: A.h[i], l: A.l[i], v: A.c[i], col: x.delta >= 0 ? K.buy : K.sell }) : null), ci: 0 }]; });
  window.ATASIndicatorFiles["deltacoloredcandles"] = { ...{"id": "deltacoloredcandles", "name": "Delta Colored Candles", "sourceClass": "DeltaColoredCandles", "sourceFile": "Technical/DeltaColoredCandles.cs", "group": "orderflow", "requirement": "quote_ticks", "status": "ported_tick", "conversion": "quote_tick_proxy", "addKey": "atas_delta_candles_tick"}, moduleFile: "indicators/individual/deltacoloredcandles.js", moduleType: "primary" };
})();
