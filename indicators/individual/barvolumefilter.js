/* ATAS indicator module: Bar's Volume Filter (quote tick extension) | source: Technical/BarVolumeFilter.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  const { K, I, tickBars, markerLine, barMarkers, tickNote, num } = window.ATASQuoteTickRuntime;
  I('atas_bar_volume_filter_tick', "Bar's Volume Filter (quote-tick proxy)", 'ov', `${tickNote} Mặc định là Candle volume như ATAS; Ticks/Delta/Bid/Ask là quote-event proxy, không phải volume giao dịch. Đánh dấu candle đạt min/max.`, [
    ['type', 'Loại dữ liệu', 'volume', 's', { o: [['volume','Candle volume'],['ticks','Quote events'],['delta','Quote delta'],['bid','Bid-side quote events'],['ask','Ask-side quote events']] }],
    ['minimum', 'Giá trị tối thiểu (0 = tắt)', 0, 'n', { min: 0, step: 1 }],
    ['maximum', 'Giá trị tối đa (0 = tắt)', 0, 'n', { min: 0, step: 1 }]
  ], [K.gold], ['Filter pass'], (A, p) => {
    const useTicks = p.type !== 'volume';
    const stats = useTicks ? tickBars(A) : Array(A.c.length).fill({ available: true });
    const marks = [];
    for (let i = 0; i < A.c.length; i++) {
      const s = stats[i];
      if (useTicks && (!s || !s.available)) continue;
      const value = p.type === 'volume' ? num(A.v[i]) : p.type === 'delta' ? s.delta : p.type === 'bid' ? s.sell : p.type === 'ask' ? s.buy : s.total;
      const min = Math.max(0, num(p.minimum)), max = Math.max(0, num(p.maximum));
      if (min > 0 && value < min) continue;
      if (max > 0 && value > max) continue;
      marks.push({ time: A.t[i], position: A.c[i] >= A.o[i] ? 'belowBar' : 'aboveBar', color: K.gold, shape: 'circle', text: `F ${Number(value.toFixed(2))}` });
    }
    return [markerLine(A, marks)];
  });
  window.ATASIndicatorFiles['barvolumefilter'] = { id:'barvolumefilter', name:"Bar's Volume Filter", sourceClass:'BarVolumeFilter', sourceFile:'Technical/BarVolumeFilter.cs', group:'technical', requirement:'ohlcv', status:'ported', conversion:'approx_proxy', addKey:'atas_bar_volume_filter_tick', moduleFile:'indicators/individual/barvolumefilter.js', moduleType:'primary' };
})();
