/*
 * ICT QuantLab · ATAS tick / footprint adaptations
 *
 * IMPORTANT DATA SEMANTICS
 * The current cTrader connector exposes historical/live BID and ASK quote updates.
 * The existing footprint engine classifies quote-price changes and stores one event
 * per changed quote at its bid/ask-derived price. It does NOT receive exchange trade
 * prints, executed size, or a verified aggressor side. The studies below therefore
 * consume quote-tick footprint counts and are explicitly labelled proxy adaptations.
 * They must not be interpreted as exchange-volume or ATAS trade-tape parity.
 *
 * Load after the shared indicator registry/runtime and before individual tick-port modules.
 * FPM/BTE are referenced lazily because orderflow-footprint initializes later in index.html.
 */
(function () {
  'use strict';
  if (typeof IND !== 'object') throw new Error('ATAS tick ports: IND registry is not loaded');

  const K = {
    buy: '#26a987', sell: '#e56b75', gold: '#f0bd59', blue: '#43b6d5', purple: '#8b83d8', gray: '#a7b1c2'
  };
  const I = (key, name, type, desc, params, colors, labels, fn, extra = {}) => {
    if (IND[key]) return;
    IND[key] = { n: name, t: type, cat: 'at', ver: 1, d: desc, p: params || [], c: colors || [K.blue], L: labels || [name], f: fn, ...extra };
  };
  const line = (d, ci = 0, lw) => ({ k: 'l', d, ci, ...(lw ? { lw } : {}) });
  const hist = (d, ci = 0) => ({ k: 'h', d, ci });
  const pxHist = (a, b) => a.map((v, i) => v == null ? null : ({ v, c: v >= 0 ? K.buy : K.sell }));
  const mean = (a, p) => {
    p = Math.max(1, Math.round(+p || 1));
    const out = Array(a.length).fill(null); let sum = 0, count = 0;
    for (let i = 0; i < a.length; i++) {
      const v = a[i];
      if (Number.isFinite(v)) { sum += v; count++; }
      if (i >= p && Number.isFinite(a[i - p])) { sum -= a[i - p]; count--; }
      if (i >= p - 1 && count === p) out[i] = sum / p;
    }
    return out;
  };
  const num = (v, d = 0) => Number.isFinite(+v) ? +v : d;
  const params = {
    period: [['period', 'Chu kỳ làm mượt', 14, 'i', { min: 1, max: 500 }]],
    ratio: [['ratio', 'Imbalance ratio', 3, 'n', { min: 1, max: 20, step: .1 }], ['minEvents', 'Số quote events tối thiểu', 2, 'i', { min: 1, max: 1000 }], ['tickStep', 'Tick size (0 = tự suy từ digits)', 0, 'n', { min: 0, step: .00001 }]],
    levels: [['valueArea', 'Value Area %', 70, 'n', { min: 50, max: 99, step: 1 }], ['tickStep', 'Tick size (0 = tự suy từ digits)', 0, 'n', { min: 0, step: .00001 }]],
    marker: [['minRun', 'Quote events / run tối thiểu', 5, 'i', { min: 1, max: 1000 }]],
  };

  function getMinute(map, t) {
    if (!map) return null;
    return map.get(t) || map.get(String(t)) || null;
  }
  function inferredStep(p) {
    if (+p.tickStep > 0) return +p.tickStep;
    try {
      const digits = typeof CT !== 'undefined' && CT.sym ? Math.max(0, Math.min(8, +CT.sym.digits || 0)) : 0;
      return digits ? Math.pow(10, -digits) : .0001;
    } catch { return .0001; }
  }
  let cachedKey = '', cachedData = null;
  function tickBars(A, valueAreaPct = 70) {
    const fpm = typeof FPM !== 'undefined' && FPM instanceof Map ? FPM : null;
    const bte = typeof BTE !== 'undefined' && BTE instanceof Map ? BTE : null;
    if (!fpm || !Array.isArray(A.s)) return Array(A.c.length).fill(null);
    const tf = Math.max(60, Math.floor(num(typeof C !== 'undefined' ? C.tf : 60, 60) / 60) * 60);
    const ver = [typeof FPV !== 'undefined' ? FPV : 0, typeof FPH !== 'undefined' ? FPH : 0,
      typeof FPLV !== 'undefined' ? FPLV : 0, typeof C !== 'undefined' ? C.sym : '', tf,
      A.s.length, A.s[0], A.s[A.s.length - 1], valueAreaPct].join('|');
    if (cachedKey === ver && cachedData) return cachedData;

    const out = Array(A.c.length).fill(null);
    for (let i = 0; i < A.c.length; i++) {
      const start = Math.floor(num(A.s[i], NaN));
      if (!Number.isFinite(start)) continue;
      const profile = new Map(), runs = [];
      let seen = false, buy = 0, sell = 0, spreadSum = 0, spreadWeight = 0;
      let firstTs = Infinity, lastTs = -Infinity;
      for (let t = start; t < start + tf; t += 60) {
        const rows = getMinute(fpm, t);
        if (!rows) continue;
        seen = true;
        for (const row of rows) {
          if (!row || row.length < 3) continue;
          const price = num(row[0], NaN), b = Math.max(0, num(row[1])), s = Math.max(0, num(row[2]));
          if (!Number.isFinite(price)) continue;
          buy += b; sell += s;
          const pk = Math.round(price * 1e5);
          let z = profile.get(pk);
          if (!z) { z = { p: pk / 1e5, buy: 0, sell: 0 }; profile.set(pk, z); }
          z.buy += b; z.sell += s;
        }
        if (Number.isFinite(rows.sp) && Number.isFinite(rows.sn) && rows.sn > 0) {
          spreadSum += rows.sp * rows.sn; spreadWeight += rows.sn;
        }
        const rs = getMinute(bte, t);
        if (rs) for (const r of rs) {
          if (!r || r.length < 4) continue;
          const ts = num(r[0], NaN), price = num(r[1], NaN), side = num(r[2]), v = Math.max(0, num(r[3]));
          if (!Number.isFinite(ts) || !Number.isFinite(price) || !v) continue;
          runs.push({ ts, price, side: side >= 0 ? 1 : -1, v, endTs: num(r[4], ts) });
          firstTs = Math.min(firstTs, ts); lastTs = Math.max(lastTs, num(r[4], ts));
        }
      }
      if (!seen) continue;
      const levels = [...profile.values()].sort((a, b) => a.p - b.p).map(z => ({ ...z, total: z.buy + z.sell, delta: z.buy - z.sell }));
      const total = buy + sell, delta = buy - sell;
      let poc = null, maxTotal = -1, maxBuy = null, maxSell = null, maxBuyN = -1, maxSellN = -1;
      for (const z of levels) {
        if (z.total > maxTotal) { maxTotal = z.total; poc = z.p; }
        if (z.buy > maxBuyN) { maxBuyN = z.buy; maxBuy = z.p; }
        if (z.sell > maxSellN) { maxSellN = z.sell; maxSell = z.p; }
      }
      let vah = null, val = null;
      if (levels.length && total > 0) {
        const pi = levels.findIndex(z => z.p === poc);
        let lo = pi, hi = pi, acc = levels[pi].total, target = total * Math.max(50, Math.min(99, num(valueAreaPct, 70))) / 100;
        while (acc < target && (lo > 0 || hi < levels.length - 1)) {
          const up = hi < levels.length - 1 ? levels[hi + 1].total : -1;
          const dn = lo > 0 ? levels[lo - 1].total : -1;
          if (up >= dn) { hi++; acc += Math.max(0, up); }
          else { lo--; acc += Math.max(0, dn); }
        }
        val = levels[lo].p; vah = levels[hi].p;
      }
      runs.sort((a, b) => a.ts - b.ts);
      let runDelta = 0, maxRunDelta = 0, minRunDelta = 0;
      for (const r of runs) { runDelta += r.side * r.v; maxRunDelta = Math.max(maxRunDelta, runDelta); minRunDelta = Math.min(minRunDelta, runDelta); }
      out[i] = {
        available: true, buy, sell, total, delta, deltaPct: total ? 100 * delta / total : 0,
        levels, runs, poc, vah, val, maxBuy, maxSell, maxTotal,
        maxRunDelta, minRunDelta, spread: spreadWeight ? spreadSum / spreadWeight : null,
        firstTs: Number.isFinite(firstTs) ? firstTs : null, lastTs: Number.isFinite(lastTs) ? lastTs : null
      };
    }
    cachedKey = ver; cachedData = out; return out;
  }
  function markerLine(A, markers) {
    const s = line(Array(A.c.length).fill(null), 0);
    s.mk = markers;
    return s;
  }
  function barMarkers(A, stats, fn) {
    const out = [];
    stats.forEach((s, i) => { if (!s) return; const x = fn(s, i); if (x) out.push(...(Array.isArray(x) ? x : [x]).map(m => ({ time: A.t[i], ...m }))); });
    return out;
  }
  function activeTickIndicator() {
    const keys = new Set([
      'atas_ask_bid_bars_tick', 'atas_average_delta_tick', 'atas_bid_ask_tick',
      'atas_bid_ask_ratio_tick', 'atas_candle_stats_tick', 'atas_cvd_quote_tick', 'atas_delta_candles_tick',
      'atas_delta_strength_tick', 'atas_delta_turnaround_tick', 'atas_dynamic_levels_footprint',
      'atas_dynamic_channel_footprint', 'atas_exhaustion_footprint', 'atas_imbalance_footprint',
      'atas_max_levels_footprint', 'atas_speed_tape_tick',
      'atas_spread_volume_tick', 'atas_unfinished_auction_fp',
      'atas_bar_volume_filter_tick', 'atas_bars_pattern_quote_fp', 'atas_stacked_imbalance_quote_fp',
      'atas_cluster_search_quote_fp', 'atas_ratio_quote_fp', 'atas_vhf'
    ]);
    const needsQuoteTicks = a => {
      if (a.key === 'atas_bar_volume_filter_tick') return !!a.p && a.p.type !== 'volume';
      if (a.key === 'atas_bars_pattern_quote_fp') return !!a.p && (['minTrades','maxTrades','minBid','maxBid','minAsk','maxAsk','minDelta','maxDelta'].some(k => num(a.p[k]) !== 0) || (a.p.maxVolLocation && a.p.maxVolLocation !== 'any'));
      if (a.key === 'atas_vhf') return !!a.p && ['ticks_quote','bid_quote','ask_quote'].includes(a.p.source);
      return true;
    };
    try { return typeof ACT !== 'undefined' && ACT.some(a => a && a.on && keys.has(a.key) && needsQuoteTicks(a) && (!a.vis || !a.vis.length || (typeof C !== 'undefined' && a.vis.includes(C.tf)))); }
    catch { return false; }
  }
  window.atasTickIndicatorActive = activeTickIndicator;
  window.ATASQuoteTickPorts = { keys: [
    'atas_ask_bid_bars_tick', 'atas_average_delta_tick', 'atas_bid_ask_tick',
    'atas_bid_ask_ratio_tick', 'atas_candle_stats_tick', 'atas_cvd_quote_tick', 'atas_delta_candles_tick',
    'atas_delta_strength_tick', 'atas_delta_turnaround_tick', 'atas_dynamic_levels_footprint',
    'atas_dynamic_channel_footprint', 'atas_exhaustion_footprint', 'atas_imbalance_footprint',
    'atas_max_levels_footprint', 'atas_speed_tape_tick',
    'atas_spread_volume_tick', 'atas_unfinished_auction_fp',
    'atas_bar_volume_filter_tick', 'atas_bars_pattern_quote_fp', 'atas_stacked_imbalance_quote_fp',
    'atas_cluster_search_quote_fp', 'atas_ratio_quote_fp', 'atas_vhf'
  ] };

  const tickNote = 'Dùng BID/ASK quote-tick footprint của cTrader: mỗi lần báo giá đổi được tính 1 event và phân loại hướng theo biến động bid/ask. Đây là proxy theo quote, không phải trade print, traded size hay aggressor volume xác thực.';
  window.ATASQuoteTickRuntime = {K, I, line, hist, pxHist, mean, num, params, getMinute, inferredStep, cachedKey, tickBars, markerLine, barMarkers, activeTickIndicator, tickNote};
})();
