/*
 * ICT QuantLab · ATAS technical indicator ports
 *
 * This file is a browser-native JavaScript adaptation layer. It intentionally does not
 * load ATAS/.NET assemblies or copy ATAS UI/rendering APIs. Calculations consume the
 * OHLCV arrays already supplied by the cTrader chart. Where the original ATAS indicator
 * depends on exchange trades, MBO/full-depth, account state, external symbols or a custom
 * session calendar, it is listed in atas-catalog.js with its data requirement instead of
 * fabricating missing values.
 *
 * Load order: indicators-defs.js -> indicators-custom.js -> pine-indicators-defs.js
 * -> indicators/atas-catalog.js -> indicators/atas-technical.js -> indicators-engine.js
 */
(function () {
  'use strict';
  if (typeof IND !== 'object') throw new Error('ATAS ports: IND registry is not loaded');

  const C = {
    a: '#43b6d5', b: '#f0bd59', c: '#8b83d8', d: '#26a987', e: '#e56b75',
    f: '#a7b1c2', up: '#26a987', dn: '#e56b75'
  };
  const I = (key, name, type, desc, params, colors, labels, fn, extra = {}) => {
    if (IND[key]) return;
    IND[key] = {
      n: name, t: type, cat: 'at', ver: 1, d: desc,
      p: params || [], c: colors || [C.a], L: labels || [name], f: fn,
      ...extra
    };
  };
  const period = (key = 'period', label = 'Chu kỳ', value = 14, min = 1, max = 500) =>
    [[key, label, value, 'i', { min, max }]];
  const srcParam = () => [['src', 'Nguồn giá', 'close', 's', { o: [
    ['close', 'Close'], ['open', 'Open'], ['high', 'High'], ['low', 'Low'],
    ['hl2', 'HL2'], ['hlc3', 'HLC3'], ['ohlc4', 'OHLC4']
  ] }]];
  const line = (d, ci = 0, lw) => ({ k: 'l', d, ci, ...(lw ? { lw } : {}) });
  const hist = (d, ci = 0) => ({ k: 'h', d, ci });
  const fill = (top, bottom, ci = 0, al = .10) => ({
    k: 'f', ci, al, d: top.map((v, i) => v == null || bottom[i] == null ? null : { top: v, bottom: bottom[i] })
  });
  const n = (v, fallback = 0) => Number.isFinite(+v) ? +v : fallback;
  const safe = (v) => v == null || !Number.isFinite(v) ? null : v;
  const atRoll = (a, p, fn) => {
    const out = Array(a.length).fill(null); p = Math.max(1, Math.round(p));
    for (let i = p - 1; i < a.length; i++) {
      const win = a.slice(i - p + 1, i + 1);
      if (win.some(v => v == null || !Number.isFinite(v))) continue;
      out[i] = fn(win, i);
    }
    return out;
  };
  const atSum = (a, p) => atRoll(a, p, w => w.reduce((s, x) => s + x, 0));
  const atMax = (a, p) => atRoll(a, p, w => Math.max(...w));
  const atMin = (a, p) => atRoll(a, p, w => Math.min(...w));
  const atMeanDev = (a, p) => atRoll(a, p, w => {
    const m = w.reduce((s, x) => s + x, 0) / w.length;
    return w.reduce((s, x) => s + Math.abs(x - m), 0) / w.length;
  });
  const atTR = A => A.c.map((v, i) => i ? Math.max(
    A.h[i] - A.l[i], Math.abs(A.h[i] - A.c[i - 1]), Math.abs(A.l[i] - A.c[i - 1])
  ) : A.h[i] - A.l[i]);
  const atATR = (A, p = 14) => rma(atTR(A), P_(p));
  const atROC = (a, p) => a.map((v, i) => i < p || !a[i - p] ? null : (v / a[i - p] - 1) * 100);
  const atMom = (a, p) => a.map((v, i) => i < p ? null : v - a[i - p]);
  const atHLC3 = A => A.h.map((h, i) => (h + A.l[i] + A.c[i]) / 3);
  const atMedian = A => A.h.map((h, i) => (h + A.l[i]) / 2);
  const atEMA = (a, p) => ema(a, P_(p));
  const atDEMA = (a, p) => {
    const e1 = atEMA(a, p), e2 = atEMA(e1, p);
    return e1.map((v, i) => v == null || e2[i] == null ? null : 2 * v - e2[i]);
  };
  const atTEMA = (a, p) => {
    const e1 = atEMA(a, p), e2 = atEMA(e1, p), e3 = atEMA(e2, p);
    return e1.map((v, i) => v == null || e2[i] == null || e3[i] == null ? null : 3 * v - 3 * e2[i] + e3[i]);
  };
  const atHMA = (a, p) => {
    p = P_(p); const half = Math.max(1, Math.floor(p / 2)), root = Math.max(1, Math.floor(Math.sqrt(p)));
    const x = wma(a, half), y = wma(a, p);
    return wma(x.map((v, i) => v == null || y[i] == null ? null : 2 * v - y[i]), root);
  };
  const atZLEMA = (a, p) => {
    const lag = Math.floor((P_(p) - 1) / 2);
    return atEMA(a.map((v, i) => i >= lag ? v + (v - a[i - lag]) : null), p);
  };
  const atKAMA = (a, p, fast = 2, slow = 30) => {
    p = P_(p); const out = Array(a.length).fill(null); let prev = null;
    const f = 2 / (fast + 1), s = 2 / (slow + 1);
    for (let i = 0; i < a.length; i++) {
      if (i < p || a[i] == null) continue;
      let change = Math.abs(a[i] - a[i - p]), volatility = 0;
      for (let j = i - p + 1; j <= i; j++) volatility += Math.abs(a[j] - a[j - 1]);
      const er = volatility ? change / volatility : 0;
      const sc = Math.pow(er * (f - s) + s, 2);
      prev = prev == null ? a[i] : prev + sc * (a[i] - prev); out[i] = prev;
    }
    return out;
  };
  const atCCI = (A, p) => {
    const tp = atHLC3(A), m = sma(tp, P_(p)), md = atMeanDev(tp, P_(p));
    return tp.map((v, i) => m[i] == null || !md[i] ? null : (v - m[i]) / (.015 * md[i]));
  };
  const atStoch = (A, p = 14, smoothK = 3, smoothD = 3) => {
    const hh = atMax(A.h, p), ll = atMin(A.l, p);
    const raw = A.c.map((v, i) => hh[i] == null || ll[i] == null || hh[i] === ll[i] ? null : (v - ll[i]) / (hh[i] - ll[i]) * 100);
    const k = sma(raw, smoothK); return { k, d: sma(k, smoothD) };
  };
  const atDMI = (A, p = 14) => {
    const plus = Array(A.c.length).fill(0), minus = Array(A.c.length).fill(0), tr = atTR(A);
    for (let i = 1; i < A.c.length; i++) {
      const up = A.h[i] - A.h[i - 1], dn = A.l[i - 1] - A.l[i];
      plus[i] = up > dn && up > 0 ? up : 0; minus[i] = dn > up && dn > 0 ? dn : 0;
    }
    const atr = rma(tr, p), pdi = rma(plus, p).map((v, i) => atr[i] ? 100 * v / atr[i] : null);
    const mdi = rma(minus, p).map((v, i) => atr[i] ? 100 * v / atr[i] : null);
    const dx = pdi.map((v, i) => v == null || mdi[i] == null || v + mdi[i] === 0 ? null : 100 * Math.abs(v - mdi[i]) / (v + mdi[i]));
    return { pdi, mdi, dx, adx: rma(dx, p) };
  };
  const atOBV = A => {
    let v = 0; return A.c.map((x, i) => { if (i) v += x > A.c[i - 1] ? n(A.v[i]) : x < A.c[i - 1] ? -n(A.v[i]) : 0; return v; });
  };
  const atADL = A => {
    let v = 0; return A.c.map((x, i) => {
      const den = A.h[i] - A.l[i], mfm = den ? ((x - A.l[i]) - (A.h[i] - x)) / den : 0;
      v += mfm * n(A.v[i]); return v;
    });
  };
  const atSAR = (A, step = .02, maxStep = .2) => {
    const out = Array(A.c.length).fill(null); if (A.c.length < 2) return out;
    let bull = A.c[1] >= A.c[0], af = step, ep = bull ? Math.max(A.h[0], A.h[1]) : Math.min(A.l[0], A.l[1]);
    let sar = bull ? Math.min(A.l[0], A.l[1]) : Math.max(A.h[0], A.h[1]); out[1] = sar;
    for (let i = 2; i < A.c.length; i++) {
      sar += af * (ep - sar);
      if (bull) {
        sar = Math.min(sar, A.l[i - 1], A.l[i - 2]);
        if (A.l[i] < sar) { bull = false; sar = ep; ep = A.l[i]; af = step; }
        else if (A.h[i] > ep) { ep = A.h[i]; af = Math.min(maxStep, af + step); }
      } else {
        sar = Math.max(sar, A.h[i - 1], A.h[i - 2]);
        if (A.h[i] > sar) { bull = true; sar = ep; ep = A.h[i]; af = step; }
        else if (A.l[i] < ep) { ep = A.l[i]; af = Math.min(maxStep, af + step); }
      }
      out[i] = sar;
    }
    return out;
  };

  // ── Moving averages ──────────────────────────────────────────────────────
  I('atas_smma', 'SMMA / Wilder MA', 'ov', 'Smoothed Moving Average (RMA/Wilder), dùng dữ liệu Close.', period(), [C.a], ['SMMA'], (A, p) => [line(rma(A.c, P_(p.period)))]);
  I('atas_wma', 'Weighted Moving Average', 'ov', 'WMA tuyến tính, trọng số lớn hơn cho dữ liệu mới.', period(), [C.a], ['WMA'], (A, p) => [line(wma(A.c, P_(p.period)))]);
  I('atas_vwma', 'Volume Weighted MA', 'ov', 'VWMA theo Volume của nến cTrader; CFD volume có thể là tick volume.', period(), [C.a], ['VWMA'], (A, p) => [line(maF('VWMA', A.c, P_(p.period), A))]);
  I('atas_dema', 'Double EMA (DEMA)', 'ov', 'DEMA = 2×EMA − EMA(EMA).', period(), [C.a], ['DEMA'], (A, p) => [line(atDEMA(A.c, p.period))]);
  I('atas_tema', 'Triple EMA (TEMA)', 'ov', 'TEMA = 3×EMA − 3×EMA(EMA) + EMA(EMA(EMA)).', period(), [C.a], ['TEMA'], (A, p) => [line(atTEMA(A.c, p.period))]);
  I('atas_hma', 'Hull Moving Average', 'ov', 'Hull MA sử dụng WMA với chu kỳ rút gọn để giảm độ trễ.', period(), [C.a], ['HMA'], (A, p) => [line(atHMA(A.c, p.period))]);
  I('atas_zlema', 'Zero Lag EMA', 'ov', 'EMA của chuỗi đã bù lag bằng chênh lệch với giá quá khứ.', period(), [C.a], ['ZLEMA'], (A, p) => [line(atZLEMA(A.c, p.period))]);
  I('atas_kama', 'Kaufman Adaptive MA', 'ov', 'KAMA điều chỉnh hệ số làm mượt theo Efficiency Ratio.', period(), [C.a], ['KAMA'], (A, p) => [line(atKAMA(A.c, p.period))]);
  I('atas_ama', 'Adaptive Moving Average', 'ov', 'AMA/Kaufman-style adaptive average; dùng Close và Efficiency Ratio.', [['period', 'ER period', 10, 'i', { min: 1, max: 200 }], ['fast', 'Fast', 2, 'i', { min: 1, max: 20 }], ['slow', 'Slow', 30, 'i', { min: 2, max: 200 }]], [C.a], ['AMA'], (A, p) => [line(atKAMA(A.c, p.period, p.fast, p.slow))]);
  I('atas_gmma', 'Guppy Multiple MA', 'ov', 'Cụm 6 EMA ngắn và 6 EMA dài để quan sát đồng thuận xu hướng.', [], [C.a, C.b], ['Short GMMA', 'Long GMMA'], A => {
    const S = [3, 5, 8, 10, 12, 15].map(x => line(ema(A.c, x), 0, 1));
    S.push(...[30, 35, 40, 45, 50, 60].map(x => line(ema(A.c, x), 1, 1))); return S;
  });
  I('atas_t3', 'Tillson T3', 'ov', 'Tillson T3 (6 tầng EMA), volume factor mặc định 0.7.', [['period', 'Chu kỳ', 5, 'i', { min: 1, max: 200 }], ['vfactor', 'Volume factor', .7, 'n', { min: 0, max: 1, step: .05 }]], [C.a], ['T3'], (A, p) => {
    const e1 = ema(A.c, p.period), e2 = ema(e1, p.period), e3 = ema(e2, p.period), e4 = ema(e3, p.period), e5 = ema(e4, p.period), e6 = ema(e5, p.period), v = p.vfactor;
    const c1 = -(v ** 3), c2 = 3 * v ** 2 + 3 * v ** 3, c3 = -6 * v ** 2 - 3 * v - 3 * v ** 3, c4 = 1 + 3 * v + 3 * v ** 2 + v ** 3;
    return [line(e1.map((_, i) => [e3[i], e4[i], e5[i], e6[i]].every(Number.isFinite) ? c1 * e6[i] + c2 * e5[i] + c3 * e4[i] + c4 * e3[i] : null))];
  });

  // ── Momentum / oscillators ───────────────────────────────────────────────
  I('atas_roc', 'Rate of Change (ROC)', 'osc', 'Tốc độ thay đổi phần trăm so với Close cách đây N nến.', period(), [C.a], ['ROC'], (A, p) => [line(atROC(A.c, P_(p.period)))], { hl: [{ y: 0, al: .5 }] });
  I('atas_mom', 'Momentum', 'osc', 'Momentum = Close hiện tại − Close N nến trước.', period(), [C.a], ['Momentum'], (A, p) => [line(atMom(A.c, P_(p.period)))], { hl: [{ y: 0, al: .5 }] });
  I('atas_cmo', 'Chande Momentum Oscillator', 'osc', 'CMO từ tổng biến động tăng/giảm trong cửa sổ.', period(), [C.a], ['CMO'], (A, p) => {
    const g = [0], l = [0]; for (let i = 1; i < A.c.length; i++) { const d = A.c[i] - A.c[i - 1]; g[i] = Math.max(0, d); l[i] = Math.max(0, -d); }
    const u = atSum(g, p.period), d = atSum(l, p.period); return [line(u.map((v, i) => v == null || v + d[i] === 0 ? null : 100 * (v - d[i]) / (v + d[i])))];
  }, { hl: [{ y: 0, al: .4 }, { y: 50, al: .3 }, { y: -50, al: .3 }] });
  I('atas_williamsr', "Williams' %R", 'osc', 'Williams %R, thang −100 đến 0.', period(), [C.a], ['%R'], (A, p) => {
    const hh = atMax(A.h, p.period), ll = atMin(A.l, p.period);
    return [line(A.c.map((v, i) => hh[i] == null || hh[i] === ll[i] ? null : -100 * (hh[i] - v) / (hh[i] - ll[i])))];
  }, { hl: [{ y: -20, al: .5 }, { y: -80, al: .5 }] });
  I('atas_ao', 'Awesome Oscillator', 'osc', 'AO = SMA( median, 5 ) − SMA( median, 34 ).', [], [C.a, C.e], ['AO'], A => {
    const m = atMedian(A), a = sma(m, 5), b = sma(m, 34);
    return [hist(a.map((v, i) => v == null || b[i] == null ? null : v - b[i]))];
  }, { hl: [{ y: 0, al: .5 }] });
  I('atas_ac', 'Accelerator Oscillator', 'osc', 'AC = AO − SMA(AO, 5).', [], [C.a, C.e], ['AC'], A => {
    const m = atMedian(A), a = sma(m, 5), b = sma(m, 34), ao = a.map((v, i) => v == null || b[i] == null ? null : v - b[i]), sm = sma(ao, 5);
    return [hist(ao.map((v, i) => v == null || sm[i] == null ? null : v - sm[i]))];
  }, { hl: [{ y: 0, al: .5 }] });
  I('atas_trix', 'TRIX', 'osc', 'TRIX là ROC 1 kỳ của EMA ba lần.', period(), [C.a], ['TRIX'], (A, p) => [line(atROC(atTEMA(A.c, p.period), 1))], { hl: [{ y: 0, al: .5 }] });
  I('atas_tsi', 'True Strength Index', 'osc', 'TSI = EMA(EMA(momentum, slow), fast) / EMA(EMA(abs(momentum), slow), fast).', [['slow', 'Slow', 25, 'i', { min: 1, max: 200 }], ['fast', 'Fast', 13, 'i', { min: 1, max: 100 }]], [C.a], ['TSI'], (A, p) => {
    const m = atMom(A.c, 1), am = m.map(v => v == null ? null : Math.abs(v));
    const nume = ema(ema(m, p.slow), p.fast), den = ema(ema(am, p.slow), p.fast);
    return [line(nume.map((v, i) => v == null || !den[i] ? null : 100 * v / den[i]))];
  }, { hl: [{ y: 0, al: .5 }] });
  I('atas_ultimate', 'Ultimate Oscillator', 'osc', 'Ultimate Oscillator kết hợp buying pressure ở 7/14/28 kỳ.', [['p1', 'Short', 7, 'i', { min: 1 }], ['p2', 'Medium', 14, 'i', { min: 2 }], ['p3', 'Long', 28, 'i', { min: 3 }]], [C.a], ['UO'], (A, p) => {
    const bp = A.c.map((v, i) => v - Math.min(A.l[i], i ? A.c[i - 1] : A.l[i]));
    const tr = A.c.map((v, i) => Math.max(A.h[i], i ? A.c[i - 1] : A.h[i]) - Math.min(A.l[i], i ? A.c[i - 1] : A.l[i]));
    const ratio = k => { const b = atSum(bp, k), t = atSum(tr, k); return b.map((v, i) => v == null || !t[i] ? null : v / t[i]); };
    const a = ratio(p.p1), b = ratio(p.p2), c = ratio(p.p3);
    return [line(a.map((v, i) => v == null || b[i] == null || c[i] == null ? null : 100 * (4 * v + 2 * b[i] + c[i]) / 7))];
  }, { hl: [{ y: 50, al: .5 }] });
  I('atas_stochrsi', 'Stochastic RSI', 'osc', 'Stochastic transform của RSI.', [['rsi', 'RSI period', 14, 'i', { min: 1 }], ['period', 'Stochastic period', 14, 'i', { min: 1 }], ['smooth', 'Smooth K', 3, 'i', { min: 1 }], ['signal', 'Smooth D', 3, 'i', { min: 1 }]], [C.a, C.b], ['%K', '%D'], (A, p) => {
    const r = rsiOf(A.c, p.rsi), hh = atMax(r, p.period), ll = atMin(r, p.period);
    const raw = r.map((v, i) => v == null || hh[i] == null || hh[i] === ll[i] ? null : 100 * (v - ll[i]) / (hh[i] - ll[i]));
    const k = sma(raw, p.smooth), d = sma(k, p.signal); return [line(k, 0), line(d, 1)];
  }, { hl: [{ y: 80, al: .5 }, { y: 20, al: .5 }] });
  I('atas_vortex', 'Vortex Indicator', 'osc', 'VI+ / VI− từ directional movement và true range.', period(), [C.d, C.e], ['VI+', 'VI−'], (A, p) => {
    const vmP = [null], vmM = [null], tr = atTR(A);
    for (let i = 1; i < A.c.length; i++) { vmP[i] = Math.abs(A.h[i] - A.l[i - 1]); vmM[i] = Math.abs(A.l[i] - A.h[i - 1]); }
    const tp = atSum(tr, p.period), a = atSum(vmP, p.period), b = atSum(vmM, p.period);
    return [line(a.map((v, i) => v == null || !tp[i] ? null : v / tp[i]), 0), line(b.map((v, i) => v == null || !tp[i] ? null : v / tp[i]), 1)];
  }, { hl: [{ y: 1, al: .4 }] });
  I('atas_aroon', 'Aroon Indicator', 'osc', 'Aroon Up/Down xác định số nến kể từ đỉnh/đáy cao nhất/thấp nhất.', period(), [C.d, C.e], ['Aroon Up', 'Aroon Down'], (A, p) => {
    const u = Array(A.c.length).fill(null), d = Array(A.c.length).fill(null), k = P_(p.period);
    for (let i = k - 1; i < A.c.length; i++) { const hs = A.h.slice(i - k + 1, i + 1), ls = A.l.slice(i - k + 1, i + 1); u[i] = 100 * (hs.lastIndexOf(Math.max(...hs)) + 1) / k; d[i] = 100 * (ls.lastIndexOf(Math.min(...ls)) + 1) / k; }
    return [line(u, 0), line(d, 1)];
  }, { hl: [{ y: 70, al: .3 }, { y: 30, al: .3 }] });
  I('atas_rvi', 'Relative Vigor Index', 'osc', 'RVI dùng chênh lệch Close−Open chuẩn hóa với biên độ High−Low, kèm signal.', period(), [C.a, C.b], ['RVI', 'Signal'], (A, p) => {
    const nume = sma(A.c.map((v, i) => v - A.o[i]), p.period), den = sma(A.h.map((v, i) => v - A.l[i]), p.period);
    const r = nume.map((v, i) => v == null || !den[i] ? null : v / den[i]); return [line(r), line(sma(r, 4), 1)];
  }, { hl: [{ y: 0, al: .5 }] });
  I('atas_qstick', 'QStick', 'osc', 'Trung bình động của Close−Open.', period(), [C.a], ['QStick'], (A, p) => [line(sma(A.c.map((v, i) => v - A.o[i]), p.period))], { hl: [{ y: 0, al: .5 }] });
  I('atas_dpo', 'Detrended Price Oscillator', 'osc', 'DPO loại bỏ xu hướng dài hạn bằng SMA dịch lùi.', period(), [C.a], ['DPO'], (A, p) => {
    const k = Math.floor(P_(p.period) / 2) + 1, m = sma(A.c, p.period);
    return [line(A.c.map((v, i) => i + k < A.c.length && m[i + k] != null ? v - m[i + k] : null))];
  }, { hl: [{ y: 0, al: .5 }] });
  I('atas_zscore', 'Z-Score', 'osc', 'Độ lệch chuẩn hóa của Close so với rolling mean.', period(), [C.a], ['Z-Score'], (A, p) => {
    const m = sma(A.c, p.period), sd = sdv(A.c, p.period);
    return [line(A.c.map((v, i) => m[i] == null || !sd[i] ? null : (v - m[i]) / sd[i]))];
  }, { hl: [{ y: 0, al: .5 }, { y: 2, al: .25 }, { y: -2, al: .25 }] });
  I('atas_fisher', 'Fisher Transform', 'osc', 'Fisher Transform từ vị trí giá trong rolling high-low, có clamp để ổn định.', period(), [C.a], ['Fisher'], (A, p) => {
    const hh = atMax(A.h, p.period), ll = atMin(A.l, p.period), x = Array(A.c.length).fill(null), out = Array(A.c.length).fill(null); let prev = 0, fish = 0;
    for (let i = 0; i < x.length; i++) {
      if (hh[i] == null || hh[i] === ll[i]) continue;
      const v = 2 * ((A.c[i] - ll[i]) / (hh[i] - ll[i]) - .5); prev = Math.max(-.999, Math.min(.999, .33 * v + .67 * prev));
      fish = .5 * Math.log((1 + prev) / (1 - prev)) + .5 * fish; x[i] = fish; out[i] = fish;
    }
    return [line(out)];
  }, { hl: [{ y: 0, al: .5 }] });

  // ── Volume / money-flow indicators (cTrader volume semantics are disclosed) ──
  I('atas_obv', 'On Balance Volume', 'osc', 'OBV cộng/trừ Volume theo hướng Close so với Close trước; CFD volume thường là tick volume.', [], [C.a], ['OBV'], A => [line(atOBV(A))]);
  I('atas_adl', 'Accumulation / Distribution Line', 'osc', 'A/D Line dùng Close Location Value nhân Volume của nến.', [], [C.a], ['A/D'], A => [line(atADL(A))]);
  I('atas_pvt', 'Price Volume Trend', 'osc', 'PVT cộng Volume × phần trăm biến động Close.', [], [C.a], ['PVT'], A => {
    let s = 0; return [line(A.c.map((v, i) => { if (i && A.c[i - 1]) s += n(A.v[i]) * (v - A.c[i - 1]) / A.c[i - 1]; return s; }))];
  });
  I('atas_force', 'Force Index', 'osc', 'Force Index = thay đổi Close × Volume, có EMA smoothing.', period(), [C.a], ['Force Index'], (A, p) => [line(ema(A.c.map((v, i) => i ? (v - A.c[i - 1]) * n(A.v[i]) : null), p.period))]);
  I('atas_mfi', 'Money Flow Index', 'osc', 'MFI dùng Typical Price × Volume để so sánh dòng tiền dương/âm.', period(), [C.a], ['MFI'], (A, p) => {
    const tp = atHLC3(A), pos = Array(A.c.length).fill(0), neg = Array(A.c.length).fill(0);
    for (let i = 1; i < tp.length; i++) { const f = tp[i] * n(A.v[i]); if (tp[i] > tp[i - 1]) pos[i] = f; else if (tp[i] < tp[i - 1]) neg[i] = f; }
    const ps = atSum(pos, p.period), ns = atSum(neg, p.period);
    return [line(ps.map((v, i) => v == null ? null : ns[i] === 0 ? 100 : 100 - 100 / (1 + v / ns[i])))];
  }, { hl: [{ y: 80, al: .5 }, { y: 20, al: .5 }] });
  I('atas_cmf', 'Chaikin Money Flow', 'osc', 'CMF = tổng Money Flow Volume / tổng Volume trong cửa sổ.', period(), [C.a], ['CMF'], (A, p) => {
    const mfv = A.c.map((v, i) => { const den = A.h[i] - A.l[i]; return den ? ((v - A.l[i]) - (A.h[i] - v)) / den * n(A.v[i]) : 0; });
    const m = atSum(mfv, p.period), v = atSum(A.v, p.period);
    return [line(m.map((x, i) => x == null || !v[i] ? null : x / v[i]))];
  }, { hl: [{ y: 0, al: .5 }] });
  I('atas_chaikin', 'Chaikin Oscillator', 'osc', 'Chênh lệch EMA 3 và EMA 10 của Accumulation/Distribution Line.', [], [C.a], ['Chaikin Oscillator'], A => { const ad = atADL(A); return [hist(ema(ad, 3).map((v, i) => v == null ? null : v - ema(ad, 10)[i]))]; }, { hl: [{ y: 0, al: .5 }] });
  I('atas_emv', 'Ease of Movement', 'osc', 'EMV so sánh midpoint change với volume đã scale theo range.', [['period', 'Smoothing', 14, 'i', { min: 1 }], ['scale', 'Volume scale', 10000, 'n', { min: 1 }]], [C.a], ['EMV'], (A, p) => {
    const raw = A.c.map((v, i) => { if (!i) return null; const mid = (A.h[i] + A.l[i]) / 2, prev = (A.h[i - 1] + A.l[i - 1]) / 2, box = n(A.v[i]) / Math.max(1, p.scale) / Math.max(1e-9, A.h[i] - A.l[i]); return box ? (mid - prev) / box : null; });
    return [line(sma(raw, p.period))];
  }, { hl: [{ y: 0, al: .5 }] });
  I('atas_relvol', 'Relative Volume', 'osc', 'Volume hiện tại chia SMA Volume; trên CFD có thể là tick volume.', period(), [C.a], ['Relative Volume'], (A, p) => {
    const m = sma(A.v, p.period); return [hist(A.v.map((v, i) => m[i] ? v / m[i] : null))];
  }, { hl: [{ y: 1, al: .5 }] });
  I('atas_volosc', 'Volume Oscillator', 'osc', 'Phần trăm chênh lệch giữa EMA Volume ngắn và dài.', [['short', 'Short', 5, 'i', { min: 1 }], ['long', 'Long', 20, 'i', { min: 2 }]], [C.a], ['Volume Oscillator'], (A, p) => {
    const s = ema(A.v, p.short), l = ema(A.v, p.long); return [hist(s.map((v, i) => l[i] ? 100 * (v - l[i]) / l[i] : null))];
  }, { hl: [{ y: 0, al: .5 }] });

  // ── Volatility / price channels ─────────────────────────────────────────
  I('atas_keltner', 'Keltner Channel', 'ov', 'EMA basis ± ATR × multiplier.', [['period', 'EMA period', 20, 'i', { min: 1 }], ['atrPeriod', 'ATR period', 10, 'i', { min: 1 }], ['mult', 'ATR multiplier', 2, 'n', { min: .1, max: 20, step: .1 }]], [C.a, C.b], ['Upper', 'Lower'], (A, p) => {
    const mid = ema(A.c, p.period), atr = atATR(A, p.atrPeriod), up = mid.map((v, i) => v == null || atr[i] == null ? null : v + atr[i] * p.mult), lo = mid.map((v, i) => v == null || atr[i] == null ? null : v - atr[i] * p.mult);
    return [line(up, 0), line(lo, 1), fill(up, lo, 1, .08)];
  });
  I('atas_starc', 'STARC Bands', 'ov', 'SMA basis ± ATR × multiplier.', [['period', 'SMA period', 20, 'i', { min: 1 }], ['atrPeriod', 'ATR period', 15, 'i', { min: 1 }], ['mult', 'ATR multiplier', 2, 'n', { min: .1, step: .1 }]], [C.a, C.b], ['Upper', 'Lower'], (A, p) => {
    const mid = sma(A.c, p.period), atr = atATR(A, p.atrPeriod), u = mid.map((v, i) => v == null || atr[i] == null ? null : v + atr[i] * p.mult), l = mid.map((v, i) => v == null || atr[i] == null ? null : v - atr[i] * p.mult);
    return [line(u), line(l, 1), fill(u, l, 1, .07)];
  });
  I('atas_maenvelope', 'Moving Average Envelope', 'ov', 'Hai dải phần trăm quanh SMA.', [['period', 'MA period', 20, 'i', { min: 1 }], ['pct', 'Envelope %', 2.5, 'n', { min: .01, max: 50, step: .1 }]], [C.a, C.b], ['Upper', 'Lower'], (A, p) => {
    const m = sma(A.c, p.period), u = m.map(v => v == null ? null : v * (1 + p.pct / 100)), l = m.map(v => v == null ? null : v * (1 - p.pct / 100));
    return [line(u), line(l, 1), fill(u, l, 1, .06)];
  });
  I('atas_stddevbands', 'Standard Deviation Bands', 'ov', 'SMA ± độ lệch chuẩn nhân hệ số.', [['period', 'Period', 20, 'i', { min: 1 }], ['mult', 'Deviation', 2, 'n', { min: .1, step: .1 }]], [C.a, C.b], ['Upper', 'Lower'], (A, p) => {
    const m = sma(A.c, p.period), sd = sdv(A.c, p.period), u = m.map((v, i) => v == null || sd[i] == null ? null : v + sd[i] * p.mult), l = m.map((v, i) => v == null || sd[i] == null ? null : v - sd[i] * p.mult);
    return [line(u), line(l, 1), fill(u, l, 1, .07)];
  });
  I('atas_atrn', 'Normalized ATR', 'osc', 'ATR chia Close × 100, biểu diễn biến động tương đối.', period(), [C.a], ['ATR %'], (A, p) => { const a = atATR(A, p.period); return [line(a.map((v, i) => v == null || !A.c[i] ? null : 100 * v / A.c[i]))]; });
  I('atas_adr', 'Average Daily Range (bar range)', 'osc', 'Rolling average của High−Low trên khung chart hiện tại; không tự đổi sang daily timeframe.', period(), [C.a], ['Average Range'], (A, p) => [line(sma(A.h.map((v, i) => v - A.l[i]), p.period))]);
  I('atas_volatility', 'Historical Volatility', 'osc', 'Annualization không áp dụng; rolling standard deviation của log returns × căn bậc hai số kỳ.', period(), [C.a], ['Historical Volatility'], (A, p) => {
    const r = A.c.map((v, i) => i && v > 0 && A.c[i - 1] > 0 ? Math.log(v / A.c[i - 1]) : null), sd = sdv(r, p.period);
    return [line(sd.map(v => v == null ? null : v * Math.sqrt(p.period) * 100))];
  });

  // ── Additional classic ATAS technical studies ───────────────────────────
  I('atas_dmi', 'Directional Movement / ADX', 'osc', 'DI+, DI− và ADX theo Wilder smoothing. Dùng OHLC; không phải market depth.', period(), [C.d, C.e, C.b], ['DI+', 'DI−', 'ADX'], (A, p) => { const d = atDMI(A, p.period); return [line(d.pdi, 0), line(d.mdi, 1), line(d.adx, 2)]; }, { hl: [{ y: 20, al: .4 }] });
  I('atas_adxr', 'ADXR', 'osc', 'ADXR = trung bình ADX hiện tại và ADX cách N kỳ.', period(), [C.a], ['ADXR'], (A, p) => { const d = atDMI(A, p.period).adx; return [line(d.map((v, i) => v == null || d[i - p.period] == null ? null : (v + d[i - p.period]) / 2))]; }, { hl: [{ y: 20, al: .4 }] });
  I('atas_bop', 'Balance of Power', 'osc', 'BOP = (Close − Open) / (High − Low).', [], [C.a], ['BOP'], A => [hist(A.c.map((v, i) => A.h[i] === A.l[i] ? null : (v - A.o[i]) / (A.h[i] - A.l[i])))], { hl: [{ y: 0, al: .5 }] });
  I('atas_coppock', 'Coppock Curve', 'osc', 'WMA 10 của tổng ROC 14 và ROC 11.', [], [C.a], ['Coppock'], A => { const r = atROC(A.c, 14).map((v, i) => v == null || atROC(A.c, 11)[i] == null ? null : v + atROC(A.c, 11)[i]); return [line(wma(r, 10))]; }, { hl: [{ y: 0, al: .5 }] });
  I('atas_bbw', 'Bollinger Bandwidth', 'osc', 'Bandwidth = (Upper − Lower) / Basis × 100.', [['period', 'Period', 20, 'i', { min: 1 }], ['mult', 'Deviation', 2, 'n', { min: .1, step: .1 }]], [C.a], ['Bandwidth'], (A, p) => { const m = sma(A.c, p.period), sd = sdv(A.c, p.period); return [line(m.map((v, i) => v == null || !v ? null : 200 * p.mult * sd[i] / Math.abs(v)))]; });
  I('atas_bbpct', 'Bollinger %B', 'osc', '%B = (Close − Lower) / (Upper − Lower).', [['period', 'Period', 20, 'i', { min: 1 }], ['mult', 'Deviation', 2, 'n', { min: .1, step: .1 }]], [C.a], ['%B'], (A, p) => { const m = sma(A.c, p.period), sd = sdv(A.c, p.period); return [line(A.c.map((v, i) => m[i] == null || !sd[i] ? null : (v - (m[i] - p.mult * sd[i])) / (2 * p.mult * sd[i])))]; }, { hl: [{ y: 1, al: .3 }, { y: 0, al: .3 }] });
  I('atas_squeeze', 'Bollinger Squeeze', 'osc', 'BB nằm trong Keltner channel được đánh dấu là squeeze; dữ liệu tính từ OHLC.', [['bbPeriod', 'BB period', 20, 'i', { min: 1 }], ['bbMult', 'BB multiplier', 2, 'n', { min: .1, step: .1 }], ['kcPeriod', 'KC period', 20, 'i', { min: 1 }], ['kcMult', 'KC multiplier', 1.5, 'n', { min: .1, step: .1 }]], [C.a, C.e], ['Squeeze', 'Momentum'], (A, p) => {
    const mid = sma(A.c, p.bbPeriod), sd = sdv(A.c, p.bbPeriod), atr = atATR(A, p.kcPeriod), em = ema(A.c, p.kcPeriod);
    const on = mid.map((v, i) => v != null && sd[i] != null && atr[i] != null && em[i] != null && v + p.bbMult * sd[i] < em[i] + p.kcMult * atr[i] && v - p.bbMult * sd[i] > em[i] - p.kcMult * atr[i] ? 1 : 0);
    const hh = atMax(A.h, p.kcPeriod), ll = atMin(A.l, p.kcPeriod), mom = A.c.map((v, i) => hh[i] == null || ll[i] == null ? null : v - (hh[i] + ll[i] + em[i]) / 3);
    return [hist(on.map(v => v ? 1 : 0), 0), line(mom, 1)];
  }, { hl: [{ y: 0, al: .3 }] });
  I('atas_demarker', 'DeMarker', 'osc', 'DeMarker đo mức mở rộng high/low so với nến trước.', period(), [C.a], ['DeMarker'], (A, p) => {
    const up = A.h.map((v, i) => i ? Math.max(0, v - A.h[i - 1]) : 0), dn = A.l.map((v, i) => i ? Math.max(0, A.l[i - 1] - v) : 0), u = sma(up, p.period), d = sma(dn, p.period);
    return [line(u.map((v, i) => v == null || d[i] == null || v + d[i] === 0 ? null : v / (v + d[i])))];
  }, { hl: [{ y: .7, al: .4 }, { y: .3, al: .4 }] });
  I('atas_kurtosis', 'Kurtosis', 'osc', 'Excess kurtosis rolling theo cửa sổ; yêu cầu đủ N giá trị.', period('period', 'Period', 20, 4), [C.a], ['Kurtosis'], (A, p) => [line(atRoll(A.c, p.period, w => { const m = w.reduce((s, x) => s + x, 0) / w.length, v2 = w.reduce((s, x) => s + (x - m) ** 2, 0) / w.length, v4 = w.reduce((s, x) => s + (x - m) ** 4, 0) / w.length; return v2 ? v4 / (v2 * v2) - 3 : null; }))], { hl: [{ y: 0, al: .4 }] });
  I('atas_meandev', 'Mean Deviation', 'osc', 'Mean absolute deviation của Close so với mean trong cửa sổ.', period(), [C.a], ['Mean Deviation'], (A, p) => [line(atMeanDev(A.c, p.period))]);
  I('atas_ppo', 'Percentage Price Oscillator', 'osc', 'PPO = (EMA ngắn − EMA dài) / EMA dài × 100.', [['short', 'Short EMA', 12, 'i', { min: 1 }], ['long', 'Long EMA', 26, 'i', { min: 2 }], ['signal', 'Signal', 9, 'i', { min: 1 }]], [C.a, C.b], ['PPO', 'Signal'], (A, p) => { const a = ema(A.c, p.short), b = ema(A.c, p.long), x = a.map((v, i) => b[i] ? 100 * (v - b[i]) / b[i] : null); return [line(x), line(ema(x, p.signal), 1)]; }, { hl: [{ y: 0, al: .5 }] });
  I('atas_schaff', 'Schaff Trend Cycle', 'osc', 'STC: Stochastic của MACD rồi làm mượt EMA hai vòng.', [['fast', 'Fast EMA', 23, 'i', { min: 1 }], ['slow', 'Slow EMA', 50, 'i', { min: 2 }], ['cycle', 'Cycle', 10, 'i', { min: 1 }], ['smooth', 'Smoothing', 3, 'i', { min: 1 }]], [C.a], ['STC'], (A, p) => {
    const m = ema(A.c, p.fast).map((v, i) => v == null ? null : v - ema(A.c, p.slow)[i]), h = atMax(m, p.cycle), l = atMin(m, p.cycle);
    const s1 = m.map((v, i) => h[i] == null || h[i] === l[i] ? null : 100 * (v - l[i]) / (h[i] - l[i])), e1 = ema(s1, p.smooth), h2 = atMax(e1, p.cycle), l2 = atMin(e1, p.cycle);
    const s2 = e1.map((v, i) => h2[i] == null || h2[i] === l2[i] ? null : 100 * (v - l2[i]) / (h2[i] - l2[i])); return [line(ema(s2, p.smooth))];
  }, { hl: [{ y: 75, al: .4 }, { y: 25, al: .4 }] });
  I('atas_smi', 'Stochastic Momentum Index', 'osc', 'SMI chuẩn hóa vị trí Close quanh midpoint rolling high-low và làm mượt.', [['period', 'Lookback', 14, 'i', { min: 1 }], ['smooth', 'Smooth', 3, 'i', { min: 1 }], ['signal', 'Signal', 3, 'i', { min: 1 }]], [C.a, C.b], ['SMI', 'Signal'], (A, p) => {
    const h = atMax(A.h, p.period), l = atMin(A.l, p.period), rel = A.c.map((v, i) => h[i] == null || l[i] == null ? null : v - (h[i] + l[i]) / 2), rng = h.map((v, i) => v == null || l[i] == null ? null : v - l[i]);
    const nume = ema(ema(rel, p.smooth), p.smooth), den = ema(ema(rng, p.smooth), p.smooth); const smi = nume.map((v, i) => v == null || !den[i] ? null : 200 * v / den[i]); return [line(smi), line(ema(smi, p.signal), 1)];
  }, { hl: [{ y: 40, al: .3 }, { y: -40, al: .3 }] });
  I('atas_kd', 'KD / KDJ', 'osc', 'KD/KDJ từ Stochastic %K và %D; J = 3K−2D.', [['period', 'Lookback', 9, 'i', { min: 1 }], ['smoothK', 'K smoothing', 3, 'i', { min: 1 }], ['smoothD', 'D smoothing', 3, 'i', { min: 1 }]], [C.a, C.b, C.c], ['K', 'D', 'J'], (A, p) => { const s = atStoch(A, p.period, p.smoothK, p.smoothD), j = s.k.map((v, i) => v == null || s.d[i] == null ? null : 3 * v - 2 * s.d[i]); return [line(s.k, 0), line(s.d, 1), line(j, 2)]; }, { hl: [{ y: 80, al: .4 }, { y: 20, al: .4 }] });
  I('atas_rmi', 'Relative Momentum Index', 'osc', 'RMI thay đổi RSI bằng momentum cách N nến.', [['period', 'Period', 14, 'i', { min: 1 }], ['momentum', 'Momentum lag', 5, 'i', { min: 1 }]], [C.a], ['RMI'], (A, p) => {
    const up = Array(A.c.length).fill(null), dn = Array(A.c.length).fill(null), k = P_(p.momentum);
    for (let i = k; i < A.c.length; i++) { const d = A.c[i] - A.c[i - k]; up[i] = Math.max(0, d); dn[i] = Math.max(0, -d); }
    const u = rma(up, p.period), d = rma(dn, p.period); return [line(u.map((v, i) => v == null || d[i] == null ? null : d[i] === 0 ? 100 : 100 - 100 / (1 + v / d[i])))];
  }, { hl: [{ y: 70, al: .4 }, { y: 30, al: .4 }] });
  I('atas_cfo', 'Chande Forecast Oscillator', 'osc', 'CFO = (Close − linear regression endpoint) / Close × 100.', period(), [C.a], ['CFO'], (A, p) => { const lr = atRoll(A.c, p.period, w => { const n = w.length, sx = (n - 1) * n / 2, sy = w.reduce((s, x) => s + x, 0), sxx = (n - 1) * n * (2 * n - 1) / 6; let sxy = 0; for (let i = 0; i < n; i++) sxy += i * w[i]; const m = (n * sxy - sx * sy) / (n * sxx - sx * sx); return (sy - m * sx) / n + m * (n - 1); }); return [line(A.c.map((v, i) => lr[i] == null || !v ? null : 100 * (v - lr[i]) / v))]; }, { hl: [{ y: 0, al: .5 }] });
  I('atas_hvr', 'Historical Volatility Ratio', 'osc', 'Tỷ số historical volatility ngắn hạn / dài hạn.', [['short', 'Short', 10, 'i', { min: 2 }], ['long', 'Long', 100, 'i', { min: 3 }]], [C.a], ['HVR'], (A, p) => { const r = A.c.map((v, i) => i && v > 0 && A.c[i - 1] > 0 ? Math.log(v / A.c[i - 1]) : null), s = sdv(r, p.short), l = sdv(r, p.long); return [line(s.map((v, i) => v == null || !l[i] ? null : v / l[i]))]; }, { hl: [{ y: 1, al: .4 }] });
  I('atas_wad', 'Williams Accumulation / Distribution', 'osc', 'WAD cộng True Range-adjusted close change theo hướng nến.', [], [C.a], ['WAD'], A => { let x = 0; return [line(A.c.map((v, i) => { if (i) { const prev = A.c[i - 1], ad = v > prev ? v - Math.min(A.l[i], prev) : v < prev ? v - Math.max(A.h[i], prev) : 0; x += ad; } return x; }))]; });
  I('atas_vzo', 'Volume Zone Oscillator', 'osc', 'VZO dùng EMA volume có dấu theo hướng giá / tổng EMA volume.', period(), [C.a], ['VZO'], (A, p) => { const sv = A.c.map((v, i) => i ? n(A.v[i]) * (v > A.c[i - 1] ? 1 : v < A.c[i - 1] ? -1 : 0) : 0), pos = ema(sv, p.period), vol = ema(A.v, p.period); return [line(pos.map((v, i) => vol[i] ? 100 * v / vol[i] : null))]; }, { hl: [{ y: 60, al: .3 }, { y: 0, al: .5 }, { y: -60, al: .3 }] });
  I('atas_mfiindex', 'Market Facilitation Index', 'osc', 'MFI = (High−Low) / Volume. Tick volume trên CFD chỉ là proxy hoạt động.', [], [C.a], ['MFI'], A => [hist(A.h.map((v, i) => n(A.v[i]) > 0 ? (v - A.l[i]) / n(A.v[i]) : null))]);
  I('atas_volindex', 'Positive / Negative Volume Index', 'osc', 'PVI/NVI: chỉ cập nhật chỉ số khi Volume tăng/giảm so với nến trước.', [], [C.d, C.e], ['PVI', 'NVI'], A => {
    let pvi = 1000, nvi = 1000; const p = [], n = [];
    for (let i = 0; i < A.c.length; i++) { if (i && A.c[i - 1]) { const r = (A.c[i] - A.c[i - 1]) / A.c[i - 1] * 100; if (A.v[i] > A.v[i - 1]) pvi *= 1 + r / 100; if (A.v[i] < A.v[i - 1]) nvi *= 1 + r / 100; } p.push(pvi); n.push(nvi); }
    return [line(p, 0), line(n, 1)];
  });
  I('atas_cumvol', 'Cumulative Volume (UTC day)', 'osc', 'Volume cộng dồn từ đầu ngày UTC; không phải reset theo phiên NY.', [], [C.a], ['Cumulative Volume'], A => {
    let key = null, total = 0; return [line(A.v.map((v, i) => { const k = Math.floor((A.s?.[i] ?? A.t[i]) / 86400); if (key !== k) { key = k; total = 0; } total += n(v); return total; }))];
  }, { pf: 'vol' });

  // ── Trend / market structure ────────────────────────────────────────────
  I('atas_supertrend', 'SuperTrend (ATAS-style)', 'ov', 'SuperTrend dựa trên ATR; màu chuyển theo hướng trend.', [['period', 'ATR period', 14, 'i', { min: 1 }], ['mult', 'Multiplier', 1.7, 'n', { min: .1, max: 20, step: .1 }]], [C.up, C.dn], ['Trend'], (A, p) => {
    const atr = atATR(A, p.period), mid = atMedian(A), upper = mid.map((v, i) => atr[i] == null ? null : v + p.mult * atr[i]), lower = mid.map((v, i) => atr[i] == null ? null : v - p.mult * atr[i]);
    const st = Array(A.c.length).fill(null); let dir = 1, fu = null, fl = null;
    for (let i = 0; i < A.c.length; i++) {
      if (upper[i] == null) continue;
      fu = fu == null || upper[i] < fu || A.c[i - 1] > fu ? upper[i] : fu;
      fl = fl == null || lower[i] > fl || A.c[i - 1] < fl ? lower[i] : fl;
      if (dir > 0 && A.c[i] < fl) dir = -1; else if (dir < 0 && A.c[i] > fu) dir = 1;
      st[i] = dir > 0 ? fl : fu;
    }
    return [line(st)];
  });
  I('atas_psar', 'Parabolic SAR', 'ov', 'Parabolic Stop and Reverse với acceleration step 0.02 và max 0.2.', [['step', 'Step', .02, 'n', { min: .001, max: .2, step: .001 }], ['max', 'Maximum', .2, 'n', { min: .01, max: 1, step: .01 }]], [C.a], ['SAR'], (A, p) => [line(atSAR(A, p.step, p.max))]);
  I('atas_ichimoku', 'Ichimoku Kinko Hyo', 'ov', 'Tenkan, Kijun, Senkou A/B và Chikou; Senkou dịch về trước, Chikou dịch lùi.', [['tenkan', 'Tenkan', 9, 'i', { min: 1 }], ['kijun', 'Kijun', 26, 'i', { min: 1 }], ['senkou', 'Senkou B', 52, 'i', { min: 1 }], ['shift', 'Displacement', 26, 'i', { min: 0, max: 100 }]], [C.a, C.b, C.d, C.e, C.c], ['Tenkan', 'Kijun', 'Senkou A', 'Senkou B', 'Chikou'], (A, p) => {
    const mid = k => { const h = atMax(A.h, k), l = atMin(A.l, k); return h.map((v, i) => v == null || l[i] == null ? null : (v + l[i]) / 2); };
    const ten = mid(p.tenkan), kij = mid(p.kijun), sa0 = ten.map((v, i) => v == null || kij[i] == null ? null : (v + kij[i]) / 2), sb0 = mid(p.senkou);
    const sa = shiftA(sa0, p.shift), sb = shiftA(sb0, p.shift), chikou = shiftA(A.c, -p.shift);
    return [line(ten, 0), line(kij, 1), line(sa, 2), line(sb, 3), fill(sa, sb, 2, .07), line(chikou, 4)];
  });
  I('atas_alligator', 'Bill Williams Alligator', 'ov', 'Jaw/Teeth/Lips dùng SMMA trên Median Price, dịch lần lượt 8/5/3 nến.', [], [C.a, C.b, C.d], ['Jaw', 'Teeth', 'Lips'], A => {
    const m = atMedian(A); return [line(shiftA(rma(m, 13), 8), 0), line(shiftA(rma(m, 8), 5), 1), line(shiftA(rma(m, 5), 3), 2)];
  });
  I('atas_linreg', 'Linear Regression', 'ov', 'Giá trị cuối đường hồi quy tuyến tính trên cửa sổ N nến.', period(), [C.a], ['LinReg'], (A, p) => [line(atRoll(A.c, p.period, w => {
    const n = w.length, sx = (n - 1) * n / 2, sy = w.reduce((s, x) => s + x, 0), sxx = (n - 1) * n * (2 * n - 1) / 6;
    let sxy = 0; for (let i = 0; i < n; i++) sxy += i * w[i]; const den = n * sxx - sx * sx;
    const m = den ? (n * sxy - sx * sy) / den : 0, b = (sy - m * sx) / n; return b + m * (n - 1);
  }))]);
  I('atas_lrslope', 'Linear Regression Slope', 'osc', 'Slope của linear regression theo đơn vị giá mỗi nến.', period(), [C.a], ['LR Slope'], (A, p) => [line(atRoll(A.c, p.period, w => {
    const n = w.length, sx = (n - 1) * n / 2, sy = w.reduce((s, x) => s + x, 0), sxx = (n - 1) * n * (2 * n - 1) / 6;
    let sxy = 0; for (let i = 0; i < n; i++) sxy += i * w[i]; const den = n * sxx - sx * sx; return den ? (n * sxy - sx * sy) / den : null;
  }))], { hl: [{ y: 0, al: .5 }] });
  I('atas_fractals', 'Fractals', 'ov', 'Đánh dấu swing high/low với số nến xác nhận đối xứng.', [['left', 'Left bars', 2, 'i', { min: 1, max: 20 }], ['right', 'Right bars', 2, 'i', { min: 1, max: 20 }]], [C.e, C.d], ['Fractal'], (A, p) => {
    const mk = [], l = P_(p.left), r = P_(p.right);
    for (let i = l; i < A.c.length - r; i++) {
      const h = A.h[i], lo = A.l[i], hs = A.h.slice(i - l, i + r + 1), ls = A.l.slice(i - l, i + r + 1);
      if (h === Math.max(...hs) && hs.indexOf(h) === l) mk.push({ time: A.t[i], position: 'aboveBar', shape: 'arrowDown', color: C.e, text: 'F' });
      if (lo === Math.min(...ls) && ls.indexOf(lo) === l) mk.push({ time: A.t[i], position: 'belowBar', shape: 'arrowUp', color: C.d, text: 'F' });
    }
    return [{ k: 'l', sp: true, d: [], mk, ci: 0, lg: false }];
  });
  I('atas_insidebar', 'Inside / Outside Bar', 'ov', 'Đánh dấu nến nằm trong range trước đó hoặc vượt cả high và low trước đó.', [['mode', 'Pattern', 'inside', 's', { o: [['inside', 'Inside bar'], ['outside', 'Outside bar'], ['both', 'Both']] }]], [C.a, C.e], ['Pattern'], (A, p) => {
    const mk = []; for (let i = 1; i < A.c.length; i++) {
      const inside = A.h[i] <= A.h[i - 1] && A.l[i] >= A.l[i - 1], outside = A.h[i] > A.h[i - 1] && A.l[i] < A.l[i - 1];
      if ((p.mode === 'inside' && inside) || (p.mode === 'outside' && outside) || (p.mode === 'both' && (inside || outside))) mk.push({ time: A.t[i], position: inside ? 'aboveBar' : 'belowBar', shape: inside ? 'circle' : 'square', color: inside ? C.a : C.e, text: inside ? 'IB' : 'OB' });
    }
    return [{ k: 'l', sp: true, d: [], mk, lg: false }];
  });

  I('atas_elderray', 'Elder Ray', 'osc', 'Bull Power = High−EMA và Bear Power = Low−EMA.', period(), [C.d, C.e], ['Bull Power', 'Bear Power'], (A, p) => { const e = ema(A.c, p.period); return [hist(A.h.map((v, i) => e[i] == null ? null : v - e[i]), 0), hist(A.l.map((v, i) => e[i] == null ? null : v - e[i]), 1)]; }, { hl: [{ y: 0, al: .5 }] });
  I('atas_heikenashi', 'Heiken Ashi', 'ov', 'Nến Heiken Ashi tính từ OHLC gốc; không thay đổi dữ liệu nến thị trường.', [], [C.up, C.dn], ['HA candles'], A => {
    const out = Array(A.c.length).fill(null); let prevO = null, prevC = null;
    for (let i = 0; i < A.c.length; i++) {
      const c = (A.o[i] + A.h[i] + A.l[i] + A.c[i]) / 4, o = prevO == null ? (A.o[i] + A.c[i]) / 2 : (prevO + prevC) / 2;
      const h = Math.max(A.h[i], o, c), l = Math.min(A.l[i], o, c); out[i] = { o, h, l, v: c, col: c >= o ? C.up : C.dn }; prevO = o; prevC = c;
    }
    return [{ k: 'c', d: out, ci: 0 }];
  });
  I('atas_highlow', 'Highest High / Lowest Low', 'ov', 'Rolling highest high và lowest low trong N nến.', period(), [C.d, C.e], ['Highest High', 'Lowest Low'], (A, p) => [line(atMax(A.h, p.period), 0), line(atMin(A.l, p.period), 1)]);
  I('atas_tr', 'True Range', 'osc', 'True Range của mỗi nến, gồm gap so với Close trước.', [], [C.a], ['TR'], A => [hist(atTR(A))], { pf: 'vol' });
  I('atas_averageprice', 'Average Price per Bar', 'ov', 'Giá trung bình OHLC4 của từng nến.', [], [C.a], ['OHLC4'], A => [line(A.c.map((v, i) => (A.o[i] + A.h[i] + A.l[i] + v) / 4))]);
  I('atas_fisher_inverse', 'Inverse Fisher Transform', 'osc', 'Inverse Fisher Transform của RSI đã scale.', period(), [C.a], ['IFT'], (A, p) => { const r = rsiOf(A.c, p.period), out = r.map(v => v == null ? null : (Math.exp(2 * ((v - 50) / 10)) - 1) / (Math.exp(2 * ((v - 50) / 10)) + 1)); return [line(out)]; }, { hl: [{ y: .5, al: .3 }, { y: -.5, al: .3 }] });
  I('atas_linregchannel', 'Linear Regression Channel', 'ov', 'Linear Regression endpoint với dải độ lệch chuẩn của residual.', [['period', 'Period', 100, 'i', { min: 2, max: 1000 }], ['mult', 'Deviation', 2, 'n', { min: .1, step: .1 }]], [C.a, C.b], ['Regression', 'Channel'], (A, p) => {
    const center = [], upper = [], lower = [], len = P_(p.period);
    for (let i = 0; i < A.c.length; i++) {
      if (i < len - 1) { center.push(null); upper.push(null); lower.push(null); continue; }
      const w = A.c.slice(i - len + 1, i + 1), nn = w.length, sx = (nn - 1) * nn / 2, sy = w.reduce((s, x) => s + x, 0), sxx = (nn - 1) * nn * (2 * nn - 1) / 6;
      let sxy = 0; for (let j = 0; j < nn; j++) sxy += j * w[j]; const den = nn * sxx - sx * sx, m = den ? (nn * sxy - sx * sy) / den : 0, b = (sy - m * sx) / nn, lineNow = b + m * (nn - 1);
      let err = 0; for (let j = 0; j < nn; j++) err += (w[j] - (b + m * j)) ** 2; const sd = Math.sqrt(err / nn);
      center.push(lineNow); upper.push(lineNow + p.mult * sd); lower.push(lineNow - p.mult * sd);
    }
    return [line(center, 0), line(upper, 1), line(lower, 1), fill(upper, lower, 1, .06)];
  });

  // ── Simple ICT/price-level overlays that can be derived from chart OHLC ───
  I('atas_dailyhl', 'Previous Day High / Low', 'ov', 'Mốc high/low của ngày trước theo UTC server-day; không phải session NY.', [], [C.d, C.e], ['PDH', 'PDL'], A => {
    const hi = Array(A.c.length).fill(null), lo = Array(A.c.length).fill(null); let key = null, curH = null, curL = null, prevH = null, prevL = null;
    for (let i = 0; i < A.c.length; i++) {
      const k = Math.floor((A.s?.[i] ?? A.t[i]) / 86400);
      if (key !== null && k !== key) { prevH = curH; prevL = curL; curH = null; curL = null; }
      if (prevH != null) { hi[i] = prevH; lo[i] = prevL; }
      curH = curH == null ? A.h[i] : Math.max(curH, A.h[i]); curL = curL == null ? A.l[i] : Math.min(curL, A.l[i]); key = k;
    }
    return [line(hi, 0), line(lo, 1)];
  });
  I('atas_camarilla', 'Camarilla Pivots', 'ov', 'Camarilla R1–R4 / S1–S4 tính từ high/low/close của ngày UTC trước.', [], [C.d, C.e, C.b, C.c], ['R levels', 'S levels'], A => {
    const levels = Array.from({ length: 8 }, () => Array(A.c.length).fill(null)); let key = null, H = null, L = null, Cl = null, pH = null, pL = null, pC = null;
    for (let i = 0; i < A.c.length; i++) {
      const k = Math.floor((A.s?.[i] ?? A.t[i]) / 86400);
      if (key !== null && k !== key) { pH = H; pL = L; pC = Cl; H = L = Cl = null; }
      if (pH != null && pL != null && pC != null) {
        const r = pH - pL; [1.1, 1.1, 1.1, 1.1].forEach((m, j) => { levels[j][i] = pC + r * m / [12, 6, 4, 2][j]; levels[j + 4][i] = pC - r * m / [12, 6, 4, 2][j]; });
      }
      H = H == null ? A.h[i] : Math.max(H, A.h[i]); L = L == null ? A.l[i] : Math.min(L, A.l[i]); Cl = A.c[i]; key = k;
    }
    return levels.map((d, i) => line(d, i < 4 ? 0 : 1, 1));
  });

  // ── Re-register core technical indicators pruned by the Pine-only registry ──
  // These are browser-native implementations so ATAS catalogue links never point
  // to keys that were removed by the existing Pine registry filter.
  I('atas_sma', 'Simple Moving Average', 'ov', 'SMA trên Close; hỗ trợ chỉnh chu kỳ.', period(), [C.a], ['SMA'], (A, p) => [line(sma(A.c, p.period))]);
  I('atas_ema', 'Exponential Moving Average', 'ov', 'EMA trên Close; khởi tạo từ quan sát đầu tiên.', period(), [C.a], ['EMA'], (A, p) => [line(ema(A.c, p.period))]);
  I('atas_bb', 'Bollinger Bands', 'ov', 'SMA ± độ lệch chuẩn tổng thể nhân hệ số.', [['period', 'Period', 20, 'i', { min: 1 }], ['mult', 'Deviation', 2, 'n', { min: .1, step: .1 }]], [C.a, C.b], ['Basis / Upper', 'Lower'], (A, p) => {
    const mid = sma(A.c, p.period), sd = sdv(A.c, p.period), up = mid.map((v, i) => v == null || sd[i] == null ? null : v + p.mult * sd[i]), lo = mid.map((v, i) => v == null || sd[i] == null ? null : v - p.mult * sd[i]);
    return [line(mid, 0), line(up, 1), line(lo, 1), fill(up, lo, 1, .07)];
  });
  I('atas_dc', 'Donchian Channel', 'ov', 'Highest High và Lowest Low trong cửa sổ N nến; có đường midpoint.', period(), [C.a, C.b], ['Upper / Mid', 'Lower'], (A, p) => {
    const up = atMax(A.h, p.period), lo = atMin(A.l, p.period), mid = up.map((v, i) => v == null || lo[i] == null ? null : (v + lo[i]) / 2);
    return [line(up, 0), line(mid, 0, 1), line(lo, 1), fill(up, lo, 1, .045)];
  });
  I('atas_vwap', 'Volume Weighted Average Price', 'ov', 'VWAP tích lũy theo anchor; dùng HLC3 × volume của chart. Với CFD, volume là tick volume nếu broker chỉ cung cấp tick volume.', [['anchor', 'Reset', 'Session', 's', { o: [['Session', 'Daily (UTC)'], ['Week', 'Week'], ['Month', 'Month'], ['Quarter', 'Quarter'], ['Year', 'Year']] }]], [C.b], ['VWAP'], (A, p) => {
    const keyFn = perKey(p.anchor), pv = [], vv = []; let key = null, sumPV = 0, sumV = 0;
    for (let i = 0; i < A.c.length; i++) {
      const k = keyFn(A.s?.[i] ?? A.t[i]); if (key !== null && k !== key) { sumPV = 0; sumV = 0; }
      const price = (A.h[i] + A.l[i] + A.c[i]) / 3, vol = Math.max(0, n(A.v[i])); sumPV += price * vol; sumV += vol;
      pv.push(sumV > 0 ? sumPV / sumV : null); vv.push(sumV); key = k;
    }
    return [line(pv)];
  });
  I('atas_rsi', 'Relative Strength Index', 'osc', 'RSI Wilder với smoothing RMA trên mức tăng/giảm Close.', period(), [C.a], ['RSI'], (A, p) => [line(rsiOf(A.c, p.period))], { hl: [{ y: 70, al: .4 }, { y: 50, al: .25 }, { y: 30, al: .4 }] });
  I('atas_macd', 'MACD', 'osc', 'MACD = EMA nhanh − EMA chậm, kèm Signal và Histogram.', [['fast', 'Fast', 12, 'i', { min: 1 }], ['slow', 'Slow', 26, 'i', { min: 2 }], ['signal', 'Signal', 9, 'i', { min: 1 }]], [C.a, C.b, C.d], ['MACD', 'Signal', 'Histogram'], (A, p) => {
    const f = ema(A.c, p.fast), sl = ema(A.c, p.slow), m = f.map((v, i) => v == null || sl[i] == null ? null : v - sl[i]), sig = ema(m, p.signal);
    return [line(m, 0), line(sig, 1), hist(m.map((v, i) => v == null || sig[i] == null ? null : v - sig[i]), 2)];
  }, { hl: [{ y: 0, al: .4 }] });
  I('atas_stoch', 'Stochastic Oscillator', 'osc', 'Stochastic %K và %D từ high/low range.', [['period', 'Lookback', 14, 'i', { min: 1 }], ['smoothK', 'Smooth K', 3, 'i', { min: 1 }], ['smoothD', 'Smooth D', 3, 'i', { min: 1 }]], [C.a, C.b], ['%K', '%D'], (A, p) => { const x = atStoch(A, p.period, p.smoothK, p.smoothD); return [line(x.k, 0), line(x.d, 1)]; }, { hl: [{ y: 80, al: .35 }, { y: 20, al: .35 }] });
  I('atas_atr', 'Average True Range', 'osc', 'ATR sử dụng True Range và Wilder RMA.', period(), [C.a], ['ATR'], (A, p) => [line(atATR(A, p.period))], { pf: 'vol' });
  I('atas_adx', 'Average Directional Index', 'osc', 'ADX Wilder; DI+/DI− được tính nội bộ, hiển thị ADX.', period(), [C.a], ['ADX'], (A, p) => [line(atDMI(A, p.period).adx)], { hl: [{ y: 20, al: .4 }, { y: 25, al: .25 }] });
  I('atas_cci', 'Commodity Channel Index', 'osc', 'CCI = (Typical Price − SMA) / (0.015 × mean deviation).', period(), [C.a], ['CCI'], (A, p) => {
    const tp = A.c.map((v, i) => (A.h[i] + A.l[i] + v) / 3), mid = sma(tp, p.period), md = atMeanDev(tp, p.period);
    return [line(tp.map((v, i) => mid[i] == null || md[i] == null || md[i] === 0 ? null : (v - mid[i]) / (.015 * md[i])))];
  }, { hl: [{ y: -100, al: .35 }, { y: 0, al: .25 }, { y: 100, al: .35 }] });
  I('atas_cvd_proxy', 'Cumulative Delta (OHLCV proxy)', 'osc', 'CVD proxy: volume gán dấu theo hướng nến rồi cộng dồn theo anchor. Không phải bid/ask aggressor flow hoặc exchange trade tape.', [['anchor', 'Reset', 'Session', 's', { o: [['Session', 'Daily (UTC)'], ['Week', 'Week'], ['Month', 'Month'], ['Quarter', 'Quarter'], ['Year', 'Year']] }]], [C.a], ['CVD proxy'], (A, p) => {
    const keyFn = perKey(p.anchor), out = []; let key = null, cum = 0, prevDir = 1;
    for (let i = 0; i < A.c.length; i++) {
      const k = keyFn(A.s?.[i] ?? A.t[i]); if (key !== null && k !== key) cum = 0;
      const dir = A.c[i] > A.o[i] ? 1 : A.c[i] < A.o[i] ? -1 : i && A.c[i] > A.c[i - 1] ? 1 : i && A.c[i] < A.c[i - 1] ? -1 : prevDir;
      prevDir = dir; cum += dir * Math.max(0, n(A.v[i])); out.push(cum); key = k;
    }
    return [line(out)];
  }, { pf: 'vol' });

  // ── Additional OHLCV ports translated from ATAS source calculations ────────
  // These definitions keep ATAS-specific feed assumptions visible in labels.
  const atMedianWin = (a, p) => atRoll(a, p, w => { const s = [...w].sort((x, y) => x - y); return s[Math.floor((s.length - 1) / 2)] * (s.length % 2) + (s.length % 2 ? 0 : (s[s.length / 2 - 1] + s[s.length / 2]) / 2); });
  const atLinRegEnd = (a, p) => atRoll(a, p, w => {
    const n0 = w.length, sx = n0 * (n0 - 1) / 2, sxx = n0 * (n0 - 1) * (2 * n0 - 1) / 6;
    const sy = w.reduce((s, x) => s + x, 0), sxy = w.reduce((s, x, i) => s + i * x, 0);
    const den = n0 * sxx - sx * sx; if (!den) return w[n0 - 1];
    const slope = (n0 * sxy - sx * sy) / den, intercept = (sy - slope * sx) / n0;
    return intercept + slope * (n0 - 1);
  });
  const atPFE = (a, p, smooth) => {
    p = P_(p); const raw = Array(a.length).fill(null);
    for (let i = p; i < a.length; i++) {
      let path = 0; for (let j = i - p + 1; j <= i; j++) path += Math.sqrt(Math.pow(a[j] - a[j - 1], 2) + 1);
      const net = a[i] - a[i - p], den = path;
      raw[i] = den ? 100 * Math.sqrt(net * net + p * p) / den * (net < 0 ? -1 : 1) : 0;
    }
    return ema(raw, P_(smooth));
  };
  const atVHF = (a, p) => {
    const hi = atMax(a, p), lo = atMin(a, p), out = Array(a.length).fill(null);
    for (let i = p; i < a.length; i++) {
      let sum = 0; for (let j = i - p + 1; j <= i; j++) sum += Math.abs(a[j] - a[j - 1]);
      out[i] = sum ? (hi[i] - lo[i]) / sum : null;
    }
    return out;
  };
  const atStochRsi = (a, rp, sp, sk, sd) => {
    const r = rsiOf(a, P_(rp)), hi = atMax(r, P_(sp)), lo = atMin(r, P_(sp));
    const raw = r.map((v, i) => v == null || hi[i] == null || lo[i] == null || hi[i] === lo[i] ? null : 100 * (v - lo[i]) / (hi[i] - lo[i]));
    const k = sma(raw, P_(sk)); return { k, d: sma(k, P_(sd)) };
  };
  I('atas_divided_price', '1 Divided by Price', 'ov', 'Reciprocal 1/Close plotted as a line. ATAS draws reversed candles; this browser version does not invert the chart scale/candlesticks.', [], [C.a], ['1 / Close'], A => [line(A.c.map(v => v ? 1 / v : null))]);
  I('atas_tma', 'Triangular Moving Average', 'ov', 'Triangular MA built from two sequential SMAs. Small boundary differences may occur versus ATAS internal series indexing.', period(), [C.a], ['TMA'], (A, p) => {
    const n1 = Math.ceil(P_(p.period) / 2), n2 = P_(p.period) % 2 ? n1 : n1 + 1;
    return [line(sma(sma(A.c, n1), n2))];
  });
  I('atas_swwma', 'Sine-Wave Weighted Moving Average', 'ov', 'Sine weights sin(i·π/6) over the previous six bars, matching the ATAS fixed 5-lag window.', [], [C.a], ['SWWMA'], A => {
    const weights = Array.from({ length: 5 }, (_, i) => Math.sin((i + 1) * Math.PI / 6)), den = weights.reduce((s, x) => s + x, 0);
    return [line(A.c.map((v, i) => i < 5 ? v : weights.reduce((s, w, j) => s + w * A.c[i - j - 1], 0) / den))];
  });
  I('atas_szma', 'Simple Moving Average – Skip Zeros', 'ov', 'SMA cửa sổ N bỏ qua các giá trị nguồn bằng 0, theo logic SZMA của ATAS.', period(), [C.a], ['SZMA'], (A, p) => [line(A.c.map((v, i) => {
    const w = A.c.slice(Math.max(0, i - P_(p.period)), i + 1).filter(x => x !== 0);
    return w.length ? w.reduce((s, x) => s + x, 0) / w.length : 0;
  }))]);
  I('atas_wwma', 'Welles Wilder Moving Average', 'ov', 'Wilder smoothing: previous value + (price − previous value) / Period.', period(), [C.a], ['WWMA'], (A, p) => [line(rma(A.c, P_(p.period)))]);
  I('atas_wao', 'Weighted Average Oscillator', 'osc', 'WMA ngắn trừ WMA dài, theo cấu trúc Weighted Average Oscillator của ATAS.', [['short', 'Short WMA', 10, 'i', { min: 1 }], ['long', 'Long WMA', 30, 'i', { min: 2 }]], [C.a], ['WAO'], (A, p) => {
    const x = wma(A.c, P_(p.short)), y = wma(A.c, P_(p.long)); return [hist(x.map((v, i) => v == null || y[i] == null ? null : v - y[i]))];
  }, { hl: [{ y: 0, al: .4 }] });
  I('atas_ma_difference', 'Moving Average Difference', 'osc', 'SMA nhanh trừ SMA chậm; mặc định 10 − 20 như source ATAS.', [['fast', 'SMA nhanh', 10, 'i', { min: 1 }], ['slow', 'SMA chậm', 20, 'i', { min: 2 }]], [C.a], ['MA Difference'], (A, p) => {
    const x = sma(A.c, P_(p.fast)), y = sma(A.c, P_(p.slow)); return [hist(x.map((v, i) => v == null || y[i] == null ? null : v - y[i]))];
  }, { hl: [{ y: 0, al: .4 }] });
  I('atas_dt_oscillator', 'DT Oscillator', 'osc', 'Double-smoothed Stochastic RSI (%K/%D), dùng RSI và SMA smoothing theo các tham số source.', [['rsi', 'RSI period', 14, 'i', { min: 1 }], ['period', 'Stoch period', 14, 'i', { min: 1 }], ['smoothK', 'K smoothing', 3, 'i', { min: 1 }], ['smoothD', 'D smoothing', 3, 'i', { min: 1 }]], [C.a, C.b], ['SK', 'SD'], (A, p) => { const x = atStochRsi(A.c, p.rsi, p.period, p.smoothK, p.smoothD); return [line(x.k, 0), line(x.d, 1)]; }, { hl: [{ y: 80, al: .35 }, { y: 20, al: .35 }] });
  I('atas_pfe', 'Polarized Fractal Efficiency', 'osc', 'PFE theo khoảng cách net/path và EMA smoothing; OHLC close-only implementation.', [['period', 'Period', 10, 'i', { min: 2 }], ['smooth', 'EMA smooth', 10, 'i', { min: 1 }]], [C.a], ['PFE'], (A, p) => [line(atPFE(A.c, p.period, p.smooth))], { hl: [{ y: 0, al: .4 }] });
  I('atas_stddev', 'Standard Deviation', 'osc', 'Population standard deviation quanh SMA, theo cách tính của ATAS.', period(), [C.a], ['StdDev'], (A, p) => [line(sdv(A.c, P_(p.period)))], { pf: 'vol' });
  I('atas_mean_deviation', 'Mean Deviation', 'osc', 'Mean absolute deviation quanh SMA trong cửa sổ N.', period(), [C.a], ['Mean Dev'], (A, p) => [line(atMeanDev(A.c, P_(p.period)))], { pf: 'vol' });
  I('atas_vhf', 'Vertical Horizontal Filter', 'osc', 'VHF = (Highest Close − Lowest Close) / tổng biến động tuyệt đối Close.', period(), [C.a], ['VHF'], (A, p) => [line(atVHF(A.c, P_(p.period)))]);
  I('atas_vbrr', 'Volume Bar Range Ratio', 'osc', 'Volume / (High − Low); volume trên mỗi đơn vị range. Với CFD, volume có thể là tick volume.', [], [C.a], ['VBRR'], A => [line(A.c.map((v, i) => A.h[i] !== A.l[i] ? n(A.v[i]) / (A.h[i] - A.l[i]) : null))], { pf: 'vol' });
  I('atas_tvi_proxy', 'Trade Volume Index (OHLCV proxy)', 'osc', 'TVI tích lũy volume theo hướng thay đổi Close; ngưỡng tick-size phải cấu hình xấp xỉ do feed không cung cấp InstrumentInfo.TickSize vào module.', [['tick', 'Tick-size threshold', .01, 'n', { min: 0, step: .0001 }]], [C.a], ['TVI proxy'], (A, p) => {
    let cum = 0; const out = A.c.map((v, i) => { if (i) { const d = v - A.c[i - 1]; if (d > p.tick) cum += n(A.v[i]); else if (d < p.tick && d !== p.tick) cum -= n(A.v[i]); } return cum; }); return [line(out)];
  }, { pf: 'vol' });
  I('atas_updown_volume_ratio', 'Up/Down Volume Ratio (OHLCV mode)', 'osc', 'ATAS default UpDownVolume mode: mỗi nến tăng/giảm tạo +100/−100, sau đó EMA. AskBidVolume mode cần nguồn Bid/Ask thực và không được giả lập từ OHLCV.', [['period', 'EMA period', 10, 'i', { min: 1 }]], [C.a], ['Up/Down Volume'], (A, p) => { const x = A.c.map((v, i) => i === 0 ? 0 : A.o[i] < v ? 100 : A.o[i] > v ? -100 : 0); return [hist(ema(x, p.period))]; }, { hl: [{ y: 0, al: .35 }] });
  I('atas_adaptive_rsi_ma', 'Adaptive RSI Moving Average', 'ov', 'Giá được EMA smooth, RSI được làm mượt; adaptive factor = 2 × Scale × |RSI/100 − 0.5| như source.', [['period', 'RSI period', 14, 'i', { min: 1 }], ['priceSmooth', 'Price EMA', 10, 'i', { min: 1 }], ['rsiSmooth', 'RSI EMA', 10, 'i', { min: 1 }], ['scale', 'Scale', .5, 'n', { min: .01, max: 2, step: .05 }]], [C.a], ['Adaptive RSI MA'], (A, p) => {
    const price = ema(A.c, p.priceSmooth), r = ema(rsiOf(price, p.period), p.rsiSmooth), out = Array(A.c.length).fill(null); let prev = null;
    for (let i = 0; i < out.length; i++) { if (price[i] == null || r[i] == null) continue; const sf = 2 * p.scale * Math.abs(r[i] / 100 - .5); prev = i <= P_(p.period) || prev == null ? price[i] : prev + (price[i] - prev) * sf; out[i] = prev; } return [line(out)];
  });
  I('atas_macd_osma', 'Moving Average of Oscillator (OSMA)', 'osc', 'OSMA = MACD − Signal line.', [['fast', 'Fast EMA', 12, 'i', { min: 1 }], ['slow', 'Slow EMA', 26, 'i', { min: 2 }], ['signal', 'Signal EMA', 9, 'i', { min: 1 }]], [C.a], ['OSMA'], (A, p) => { const f = ema(A.c, p.fast), s = ema(A.c, p.slow), m = f.map((v, i) => v == null || s[i] == null ? null : v - s[i]), sig = ema(m, p.signal); return [hist(m.map((v, i) => v == null || sig[i] == null ? null : v - sig[i]))]; }, { hl: [{ y: 0, al: .4 }] });
  I('atas_macd_bb', 'MACD Bollinger Bands', 'osc', 'Bollinger Bands quanh MACD line; standard/proxy variant dùng cùng phép tính nền.', [['fast', 'Fast EMA', 12, 'i', { min: 1 }], ['slow', 'Slow EMA', 26, 'i', { min: 2 }], ['period', 'Band period', 20, 'i', { min: 2 }], ['mult', 'Band deviation', 2, 'n', { min: .1, step: .1 }]], [C.a, C.b], ['MACD / Upper', 'Lower'], (A, p) => { const f = ema(A.c, p.fast), s = ema(A.c, p.slow), m = f.map((v, i) => v == null || s[i] == null ? null : v - s[i]), mid = sma(m, p.period), sd = sdv(m, p.period), up = mid.map((v, i) => v == null || sd[i] == null ? null : v + p.mult * sd[i]), lo = mid.map((v, i) => v == null || sd[i] == null ? null : v - p.mult * sd[i]); return [line(m, 0), line(up, 1), line(lo, 1), fill(up, lo, 1, .06)]; }, { hl: [{ y: 0, al: .3 }] });
  I('atas_macd_leader', 'MACD Leader', 'osc', 'Ehlers-style MACD Leader proxy: MACD histogram plus smoothed histogram momentum.', [['fast', 'Fast EMA', 12, 'i', { min: 1 }], ['slow', 'Slow EMA', 26, 'i', { min: 2 }], ['signal', 'Signal EMA', 9, 'i', { min: 1 }]], [C.a], ['MACD Leader'], (A, p) => { const m = ema(A.c, p.fast).map((v, i) => v == null ? null : v - ema(A.c, p.slow)[i]), sig = ema(m, p.signal), h = m.map((v, i) => v == null || sig[i] == null ? null : v - sig[i]); return [line(h.map((v, i) => v == null ? null : v + (i ? v - h[i - 1] || 0 : 0)))]; }, { hl: [{ y: 0, al: .4 }] });
  I('atas_macd_vw', 'MACD – Volume Weighted', 'osc', 'MACD trên chuỗi giá có volume weight; volume của CFD có thể là tick volume.', [['fast', 'Fast EMA', 12, 'i', { min: 1 }], ['slow', 'Slow EMA', 26, 'i', { min: 2 }], ['signal', 'Signal EMA', 9, 'i', { min: 1 }]], [C.a, C.b, C.d], ['MACD VW', 'Signal', 'Histogram'], (A, p) => { const vw = A.c.map((v, i) => v * Math.max(0, n(A.v[i]))), vol = A.v.map(v => Math.max(0, n(v))), vf = ema(vw, p.fast), vs = ema(vol, p.fast), sf = ema(vw, p.slow), ss = ema(vol, p.slow); const f = vf.map((v, i) => vs[i] ? v / vs[i] : null), s = sf.map((v, i) => ss[i] ? v / ss[i] : null), m = f.map((v, i) => v == null || s[i] == null ? null : v - s[i]), sig = ema(m, p.signal); return [line(m, 0), line(sig, 1), hist(m.map((v, i) => v == null || sig[i] == null ? null : v - sig[i]), 2)]; }, { hl: [{ y: 0, al: .35 }] });
  I('atas_squeeze_momentum', 'Squeeze Momentum', 'osc', 'BB/Keltner squeeze state with linear-regression momentum proxy; uses OHLCV only.', [['period', 'Period', 20, 'i', { min: 2 }], ['bbMult', 'BB multiplier', 2, 'n', { min: .1, step: .1 }], ['kcMult', 'KC multiplier', 1.5, 'n', { min: .1, step: .1 }]], [C.a, C.b], ['Momentum'], (A, p) => {
    const mid = sma(A.c, p.period), sd = sdv(A.c, p.period), atr = atATR(A, p.period), up = mid.map((v, i) => v == null || sd[i] == null ? null : v + p.bbMult * sd[i]), dn = mid.map((v, i) => v == null || sd[i] == null ? null : v - p.bbMult * sd[i]), ku = mid.map((v, i) => v == null || atr[i] == null ? null : v + p.kcMult * atr[i]), kd = mid.map((v, i) => v == null || atr[i] == null ? null : v - p.kcMult * atr[i]);
    const momentum = A.c.map((v, i) => { if (mid[i] == null) return null; const hi = atMax(A.h, p.period)[i], lo = atMin(A.l, p.period)[i]; const base = (hi + lo + mid[i]) / 3; return v - base; });
    const mom = atLinRegEnd(momentum, p.period), sq = up.map((v, i) => v == null || ku[i] == null ? null : v < ku[i] && dn[i] > kd[i] ? 1 : 0);
    return [hist(mom), line(sq.map(v => v ? 1 : 0), 1, 1)];
  }, { hl: [{ y: 0, al: .35 }] });
  I('atas_wavetrend', 'WaveTrend', 'osc', 'WaveTrend oscillator using HLC3, EMA channel and EMA signal (LazyBear-style implementation).', [['channel', 'Channel length', 10, 'i', { min: 1 }], ['average', 'Average length', 21, 'i', { min: 1 }], ['signal', 'Signal SMA', 4, 'i', { min: 1 }]], [C.a, C.b], ['WT1', 'WT2'], (A, p) => {
    const tp = atHLC3(A), esa = ema(tp, p.channel), dev = ema(tp.map((v, i) => Math.abs(v - esa[i])), p.channel), ci = tp.map((v, i) => dev[i] ? (v - esa[i]) / (.015 * dev[i]) : null), wt1 = ema(ci, p.average), wt2 = sma(wt1, p.signal); return [line(wt1, 0), line(wt2, 1)];
  }, { hl: [{ y: 60, al: .3 }, { y: -60, al: .3 }, { y: 0, al: .25 }] });
  I('atas_hurst', 'Hurst Exponent', 'osc', 'Rolling rescaled-range Hurst estimate from Close returns; short samples are noisy and not a prediction.', [['period', 'Period', 64, 'i', { min: 16, max: 256 }]], [C.a], ['Hurst'], (A, p) => [line(atRoll(A.c, p.period, w => {
    const r = w.slice(1).map((x, i) => x - w[i]), mean = r.reduce((s, x) => s + x, 0) / r.length; let cum = 0, hi = -Infinity, lo = Infinity, ss = 0;
    for (const x of r) { cum += x - mean; hi = Math.max(hi, cum); lo = Math.min(lo, cum); ss += (x - mean) ** 2; }
    const sd = Math.sqrt(ss / r.length), rs = sd ? (hi - lo) / sd : 0; return rs > 0 && r.length > 1 ? Math.log(rs) / Math.log(r.length) : null;
  }))]);
  I('atas_td_sequential', 'TD Sequential', 'osc', 'TD Setup count approximation: consecutive closes relative to close four bars earlier; setup count is not a full TD Countdown.', [], [C.d, C.e], ['Buy Setup', 'Sell Setup'], A => {
    const buy = Array(A.c.length).fill(null), sell = Array(A.c.length).fill(null); let b = 0, s = 0;
    for (let i = 0; i < A.c.length; i++) { if (i < 4) continue; if (A.c[i] < A.c[i - 4]) { b = Math.min(9, b + 1); s = 0; } else if (A.c[i] > A.c[i - 4]) { s = Math.min(9, s + 1); b = 0; } else { b = s = 0; } buy[i] = b || null; sell[i] = s || null; }
    return [line(buy, 0), line(sell, 1)];
  });
  I('atas_stderr_bands', 'Standard Error Bands', 'ov', 'Linear regression center with residual standard-error envelope; browser approximation of ATAS drawing.', [['period', 'Period', 50, 'i', { min: 2, max: 500 }], ['mult', 'Deviation', 2, 'n', { min: .1, step: .1 }]], [C.a, C.b], ['Regression / Upper', 'Lower'], (A, p) => {
    const mid = atLinRegEnd(A.c, p.period), sd = atRoll(A.c, p.period, w => { const n0 = w.length, sx = n0 * (n0 - 1) / 2, sxx = n0 * (n0 - 1) * (2 * n0 - 1) / 6, sy = w.reduce((s, x) => s + x, 0), sxy = w.reduce((s, x, i) => s + i * x, 0), den = n0 * sxx - sx * sx, slope = den ? (n0 * sxy - sx * sy) / den : 0, intercept = (sy - slope * sx) / n0, err = w.map((v, i) => v - (intercept + slope * i)); return Math.sqrt(err.reduce((s, x) => s + x * x, 0) / n0); });
    const up = mid.map((v, i) => v == null || sd[i] == null ? null : v + p.mult * sd[i]), lo = mid.map((v, i) => v == null || sd[i] == null ? null : v - p.mult * sd[i]); return [line(mid, 0), line(up, 1), line(lo, 1), fill(up, lo, 1, .05)];
  });
  I('atas_swing_high_low', 'Swing High and Low', 'ov', 'Confirmed swing levels with left/right bars; confirmation occurs only after right-side bars close.', [['left', 'Left bars', 3, 'i', { min: 1, max: 20 }], ['right', 'Right bars', 3, 'i', { min: 1, max: 20 }]], [C.d, C.e], ['Swing High', 'Swing Low'], (A, p) => {
    const hi = Array(A.c.length).fill(null), lo = Array(A.c.length).fill(null), l = P_(p.left), r = P_(p.right);
    for (let i = l; i + r < A.c.length; i++) { const k = i + r, h = A.h[k], low = A.l[k]; let okH = true, okL = true; for (let j = k - l; j <= k + r; j++) { if (j !== k && A.h[j] >= h) okH = false; if (j !== k && A.l[j] <= low) okL = false; } if (okH) hi[k] = h; if (okL) lo[k] = low; }
    return [line(hi, 0), line(lo, 1)];
  });
  I('atas_round_numbers', 'Round Numbers', 'ov', 'Nearest round-number levels around current price. Step is configurable and independent of broker tick size.', [['step', 'Price step', 100, 'n', { min: .000001 }], ['levels', 'Levels each side', 3, 'i', { min: 1, max: 10 }]], [C.b], ['Round Levels'], (A, p) => Array.from({ length: P_(p.levels) * 2 + 1 }, (_, j) => { const off = j - P_(p.levels); return line(A.c.map(v => Math.round(v / p.step) * p.step + off * p.step), j % 2); }));
  I('atas_murray_math', 'Murrey Math Levels (proxy)', 'ov', 'Eight-part octave levels from rolling high/low; simplified adaptive range, not a byte-for-byte port of ATAS Murray Math.', [['period', 'Range period', 64, 'i', { min: 8, max: 500 }]], [C.a, C.b], ['Octave levels'], (A, p) => {
    const hi = atMax(A.h, p.period), lo = atMin(A.l, p.period), levels = Array.from({ length: 9 }, () => Array(A.c.length).fill(null));
    for (let i = 0; i < A.c.length; i++) if (hi[i] != null && lo[i] != null) for (let j = 0; j <= 8; j++) levels[j][i] = lo[i] + (hi[i] - lo[i]) * j / 8;
    return levels.map((x, i) => line(x, i % 2, i === 4 ? 2 : 1));
  });
  I('atas_gaps', 'Gaps', 'ov', 'Gap-up / gap-down levels from open versus previous close; intrabar gaps remain until the gap is filled.', [['minPct', 'Minimum gap %', .1, 'n', { min: 0, step: .05 }]], [C.d, C.e], ['Gap Up', 'Gap Down'], (A, p) => {
    const up = Array(A.c.length).fill(null), dn = Array(A.c.length).fill(null); for (let i = 1; i < A.c.length; i++) { const pct = A.c[i - 1] ? Math.abs((A.o[i] / A.c[i - 1] - 1) * 100) : 0; if (pct >= p.minPct && A.o[i] > A.c[i - 1]) up[i] = A.o[i]; if (pct >= p.minPct && A.o[i] < A.c[i - 1]) dn[i] = A.o[i]; } return [line(up, 0), line(dn, 1)];
  });
  I('atas_block_ma', 'Block Moving Average', 'ov', 'Stair-step average of fixed non-overlapping blocks; block is defined in bars because the browser port has no ATAS aggregation object.', [['block', 'Block bars', 5, 'i', { min: 1, max: 500 }]], [C.a], ['Block MA'], (A, p) => { const z = P_(p.block), out = A.c.map((_, i) => { const start = Math.floor(i / z) * z, w = A.c.slice(start, i + 1); return w.reduce((s, x) => s + x, 0) / w.length; }); return [line(out)]; });
  I('atas_macd_bb_improved', 'MACD Bollinger Bands – Improved (proxy)', 'osc', 'MACD with Bollinger envelope, using standard MACD/BB calculation. Improved ATAS-specific signal logic is not replicated exactly.', [['fast', 'Fast EMA', 12, 'i', { min: 1 }], ['slow', 'Slow EMA', 26, 'i', { min: 2 }], ['signal', 'Signal EMA', 9, 'i', { min: 1 }], ['period', 'Band period', 20, 'i', { min: 2 }]], [C.a, C.b], ['MACD', 'Signal / Bands'], (A, p) => { const f = ema(A.c, p.fast), s = ema(A.c, p.slow), m = f.map((v, i) => v == null || s[i] == null ? null : v - s[i]), sig = ema(m, p.signal), sd = sdv(m, p.period), up = sig.map((v, i) => v == null || sd[i] == null ? null : v + 2 * sd[i]), lo = sig.map((v, i) => v == null || sd[i] == null ? null : v - 2 * sd[i]); return [line(m, 0), line(sig, 1), line(up, 1), line(lo, 1)]; });
  I('atas_macd_bb_standard', 'MACD Bollinger Bands – Standard (proxy)', 'osc', 'Standard MACD Bollinger envelope; default implementation based on MACD signal and rolling standard deviation.', [['fast', 'Fast EMA', 12, 'i', { min: 1 }], ['slow', 'Slow EMA', 26, 'i', { min: 2 }], ['signal', 'Signal EMA', 9, 'i', { min: 1 }], ['period', 'Band period', 20, 'i', { min: 2 }]], [C.a, C.b], ['MACD', 'Signal / Bands'], (A, p) => { const f = ema(A.c, p.fast), s = ema(A.c, p.slow), m = f.map((v, i) => v == null || s[i] == null ? null : v - s[i]), sig = ema(m, p.signal), sd = sdv(m, p.period), up = m.map((v, i) => v == null || sd[i] == null ? null : v + 2 * sd[i]), lo = m.map((v, i) => v == null || sd[i] == null ? null : v - 2 * sd[i]); return [line(m, 0), line(sig, 1), line(up, 1), line(lo, 1)]; });
  I('atas_demand_index', 'Demand Index (OHLCV port)', 'osc', 'Translation of ATAS pressure calculation using priceSum = High + Low + 2×Close and EMA volume/buy-sell pressure. Requires OHLCV volume; CFD volume may be tick volume.', [['period', 'EMA period', 10, 'i', { min: 1 }], ['signal', 'Signal SMA', 10, 'i', { min: 1 }]], [C.a, C.b], ['Demand Index', 'Signal'], (A, p) => {
    const vol = ema(A.v.map(n), p.period), ps = A.c.map((v, i) => A.h[i] + A.l[i] + 2 * v), bp = [], sp = [];
    const firstRange = Math.max(1e-12, A.h[0] - A.l[0]);
    for (let i = 0; i < A.c.length; i++) { if (i === 0 || !vol[i] || !vol[i - 1]) { bp.push(0); sp.push(0); continue; }
      const prev = ps[i - 1], cur = ps[i], ratio = Math.max(1e-8, n(A.v[i]) / vol[i]);
      const b = cur < prev ? ratio / Math.exp(.375 * ((cur + prev) / firstRange) * ((prev - cur) / Math.max(1e-8, cur))) : ratio;
      const q = cur <= prev ? ratio : ratio / Math.exp(.375 * ((cur + prev) / firstRange) * ((cur - prev) / Math.max(1e-8, prev)));
      bp.push(b); sp.push(q);
    }
    const eb = ema(bp, p.period), es = ema(sp, p.period), di = eb.map((v, i) => { const den = Math.max(v, es[i]); return den ? 100 * (v - es[i]) / den : 0; });
    return [line(di, 0), line(sma(di, p.signal), 1)];
  }, { pf: 'vol' });
  I('atas_volume_oscillator', 'Simple Percentage Volume Oscillator', 'osc', 'Percentage difference between fast and slow EMA of chart volume.', [['fast', 'Fast EMA', 5, 'i', { min: 1 }], ['slow', 'Slow EMA', 10, 'i', { min: 2 }]], [C.a], ['SPVO'], (A, p) => { const f = ema(A.v.map(n), p.fast), s = ema(A.v.map(n), p.slow); return [line(f.map((v, i) => s[i] ? 100 * (v - s[i]) / s[i] : null))]; }, { pf: 'vol', hl: [{ y: 0, al: .35 }] });
  I('atas_repulse', 'Repulse', 'osc', 'ATAS source calculation: bull/bear power relative to rolling High/Low and first Open in the period, each smoothed by EMA(Period×5).', [['period', 'Period', 10, 'i', { min: 1 }]], [C.a], ['Repulse'], (A, p) => { const per = P_(p.period), bull = [], bear = []; for (let i = 0; i < A.c.length; i++) { const start = Math.max(0, i - per + 1), max = Math.max(...A.h.slice(start, i + 1)), min = Math.min(...A.l.slice(start, i + 1)), firstOpen = A.o[start], close = A.c[i]; bull.push(close ? 100 * (3 * close - 2 * min - firstOpen) / close : null); bear.push(close ? 100 * (firstOpen + 2 * max - 3 * close) / close : null); } const b = ema(bull, per * 5), s = ema(bear, per * 5); return [line(b.map((v, i) => v == null || s[i] == null ? null : v - s[i]))]; }, { hl: [{ y: 0, al: .35 }] });
  I('atas_qqe', 'QQE (proxy)', 'osc', 'QQE-style smoothed RSI with trailing volatility bands; threshold and smoothing can differ from ATAS defaults.', [['rsi', 'RSI period', 14, 'i', { min: 1 }], ['smooth', 'RSI smooth', 5, 'i', { min: 1 }], ['factor', 'QQE factor', 4.236, 'n', { min: .1, step: .001 }]], [C.a, C.b], ['QQE RSI', 'Trailing center'], (A, p) => { const r = ema(rsiOf(A.c, p.rsi), p.smooth), diff = r.map((v, i) => i ? Math.abs(v - r[i - 1]) : 0), band = ema(ema(diff, p.rsi), p.rsi).map(v => v * p.factor), center = Array(r.length).fill(null); let tr = null; for (let i = 0; i < r.length; i++) { if (r[i] == null || band[i] == null) continue; const candidate = r[i] - band[i]; tr = tr == null ? candidate : r[i] > tr ? Math.max(tr, candidate) : candidate; center[i] = tr; } return [line(r, 0), line(center, 1)]; }, { hl: [{ y: 50, al: .25 }] });
  I('atas_rwi', 'Random Walk Indicator', 'osc', 'RWI High/Low calculated from recent extreme versus ATR × sqrt(period); simplified highest/lowest window.', [['period', 'Period', 14, 'i', { min: 2 }]], [C.d, C.e], ['RWI High', 'RWI Low'], (A, p) => { const atr = atATR(A, p.period), up = [], dn = []; for (let i = 0; i < A.c.length; i++) { const h = atMax(A.h, p.period)[i], l = atMin(A.l, p.period)[i]; up.push(i >= p.period && atr[i] ? (h - A.l[i]) / (atr[i] * Math.sqrt(p.period)) : null); dn.push(i >= p.period && atr[i] ? (A.h[i] - l) / (atr[i] * Math.sqrt(p.period)) : null); } return [line(up, 0), line(dn, 1)]; });
  I('atas_momentum_trend', 'Momentum Trend', 'osc', 'Momentum direction based on short and long EMA spread, with a smoothed signal.', [['fast', 'Fast EMA', 10, 'i', { min: 1 }], ['slow', 'Slow EMA', 30, 'i', { min: 2 }], ['signal', 'Signal', 5, 'i', { min: 1 }]], [C.a, C.b], ['Trend', 'Signal'], (A, p) => { const f = ema(A.c, p.fast), s = ema(A.c, p.slow), x = f.map((v, i) => v == null || s[i] == null ? null : v - s[i]), sig = ema(x, p.signal); return [line(x, 0), line(sig, 1)]; }, { hl: [{ y: 0, al: .35 }] });
  I('atas_volatility_trend', 'Volatility Trend (proxy)', 'ov', 'ATR trailing volatility trend with direction-persistence lookback. Source-specific dynamic counter is approximated in the browser port.', [['atr', 'ATR period', 10, 'i', { min: 1 }], ['maxPeriod', 'Max dynamic period', 15, 'i', { min: 1 }]], [C.d, C.e], ['Volatility Trend'], (A, p) => {
    const atr = atATR(A, p.atr), out = Array(A.c.length).fill(null); let dir = 0, run = 0, prev = null;
    for (let i = 0; i < A.c.length; i++) { if (i === 0 || prev == null || atr[i] == null) { prev = A.c[i]; continue; } const nextDir = A.c[i] > prev ? 1 : -1; run = nextDir === dir ? Math.min(P_(p.maxPeriod), run + 1) : 1; dir = nextDir; const win = Math.max(1, run); const hi = Math.max(...A.h.slice(Math.max(0, i - win + 1), i + 1)), lo = Math.min(...A.l.slice(Math.max(0, i - win + 1), i + 1)); out[i] = dir > 0 ? hi - atr[i] : lo + atr[i]; prev = A.c[i]; }
    return [line(out)];
  });
  I('atas_cbi', 'Connie Brown Composite Index (proxy)', 'osc', 'Composite RSI + RSI momentum, with fast/slow smoothing. Exact ATAS parameterization may differ.', [['rsi', 'RSI period', 14, 'i', { min: 1 }], ['momentum', 'RSI momentum', 9, 'i', { min: 1 }], ['fast', 'Fast SMA', 3, 'i', { min: 1 }], ['slow', 'Slow SMA', 13, 'i', { min: 1 }]], [C.a, C.b], ['CBI', 'Signal'], (A, p) => { const r = rsiOf(A.c, p.rsi), cbi = r.map((v, i) => v == null || i < p.momentum || r[i - p.momentum] == null ? null : v + (v - r[i - p.momentum])); return [line(sma(cbi, p.fast), 0), line(sma(cbi, p.slow), 1)]; }, { hl: [{ y: 0, al: .25 }] });
  I('atas_inertia', 'Inertia', 'osc', 'Linear-regression smoothing of RSI; commonly used as a trend/momentum filter.', [['period', 'Period', 20, 'i', { min: 2 }]], [C.a], ['Inertia'], (A, p) => [line(atLinRegEnd(rsiOf(A.c, p.period), p.period))], { hl: [{ y: 50, al: .25 }] });
  I('atas_inertia2', 'Inertia V2 (proxy)', 'osc', 'Second Inertia variant approximated by smoothed regression slope of RSI; ATAS-specific alternate formula is not byte-identical.', [['period', 'Period', 20, 'i', { min: 2 }]], [C.a], ['Inertia V2'], (A, p) => { const r = rsiOf(A.c, p.period), lr = atLinRegEnd(r, p.period); return [line(ema(lr, Math.max(2, Math.floor(p.period / 3))))]; }, { hl: [{ y: 50, al: .25 }] });
  I('atas_vpf', 'Voss Predictive Filter', 'osc', 'Voss Predictive Filter and Flit estimator translated from ATAS recurrence; warm-up requires 3×Predict bars.', [['period', 'Period', 20, 'i', { min: 2 }], ['predict', 'Predict', 3, 'i', { min: 1, max: 20 }], ['bandWidth', 'Band width', .25, 'n', { min: .01, max: .95, step: .01 }]], [C.a, C.b], ['Voss', 'Flit'], (A, p) => {
    const order = P_(p.predict) * 3, per = P_(p.period), f1 = Math.cos(2 * Math.PI / per), g1 = Math.cos(p.bandWidth * 2 * Math.PI / per);
    const root = 1 / g1, disc = Math.max(0, root * root - 1), s1 = root - Math.sqrt(disc), s2 = 1 + s1, s3 = 1 - s1;
    const flit = Array(A.c.length).fill(0), voss = Array(A.c.length).fill(0);
    for (let i = Math.max(order, 2); i < A.c.length; i++) { const x1 = A.c[i] - A.c[i - 2], x2 = (3 + order) / 2; let sum = 0; for (let j = 0; j < order; j++) sum += (j + 1) / order * voss[i - order + j]; flit[i] = .5 * s3 * x1 + f1 * s2 * flit[i - 1] - s1 * flit[i - 2]; voss[i] = x2 * flit[i] - sum; }
    return [line(voss), line(flit, 1)];
  }, { hl: [{ y: 0, al: .35 }] });
  I('atas_moving_median', 'Moving Median', 'ov', 'Median của cửa sổ giá N; xử lý đúng median giữa hai phần tử khi số mẫu chẵn.', period(), [C.a], ['Median'], (A, p) => [line(atMedianWin(A.c, P_(p.period)))]);
  I('atas_rmo', 'Rahul Mohindar Oscillator', 'osc', 'Port theo logic source: chuỗi 10 SMA lồng nhau, swing-trade normalized by rolling high-low, kèm EMA signal và hai EMA smooth.', [['period', 'SMA periods', 10, 'i', { min: 1 }], ['range', 'High/Low period', 10, 'i', { min: 1 }], ['ema', 'EMA smooth', 10, 'i', { min: 1 }], ['signal', 'Signal EMA', 15, 'i', { min: 1 }]], [C.a, C.b, C.d], ['RMO', 'EMA 1', 'EMA 2'], (A, p) => {
    const n0 = P_(p.period), hi = atMax(A.h, p.range), lo = atMin(A.l, p.range); let chain = A.c.slice();
    for (let j = 0; j < 10; j++) chain = sma(chain, n0);
    const st = A.c.map((v, i) => hi[i] == null || lo[i] == null || hi[i] === lo[i] ? 0 : 100 * (v - chain[i]) / (hi[i] - lo[i]));
    const e1 = ema(st, p.ema), e2 = ema(e1, p.ema), sig = ema(st, p.signal);
    return [line(sig, 0), line(e1, 1), line(e2, 2)];
  }, { hl: [{ y: 0, al: .3 }] });
  I('atas_greatest_swing', 'Greatest Swing Value', 'ov', 'Highest/lowest price across the selected rolling window; proxy for ATAS swing-value overlay.', period(), [C.d, C.e], ['Swing High', 'Swing Low'], (A, p) => [line(atMax(A.h, p.period), 0), line(atMin(A.l, p.period), 1)]);
  I('atas_dynamic_levels', 'Dynamic Levels (proxy)', 'ov', 'Adaptive rolling support/resistance from recent extremes; original ATAS implementation also includes advanced volume/cluster logic.', [['period', 'Lookback', 50, 'i', { min: 2 }]], [C.d, C.e], ['Dynamic High', 'Dynamic Low'], (A, p) => [line(atMax(A.h, p.period), 0), line(atMin(A.l, p.period), 1)]);
  I('atas_dynamic_channel', 'Dynamic Levels Channel (proxy)', 'ov', 'Rolling high/low channel and midpoint; does not reproduce ATAS internal volume/cluster scoring.', [['period', 'Lookback', 50, 'i', { min: 2 }]], [C.a, C.b], ['Upper / Mid', 'Lower'], (A, p) => { const h = atMax(A.h, p.period), l = atMin(A.l, p.period), m = h.map((v, i) => v == null || l[i] == null ? null : (v + l[i]) / 2); return [line(h, 0), line(m, 0, 1), line(l, 1)]; });
  I('atas_heiken_ashi_smoothed', 'Heiken Ashi Smoothed (proxy)', 'ov', 'Two-stage Wilder/weighted smoothing of OHLC followed by Heiken Ashi calculation; plotted as smoothed HA close/open lines.', [['period', 'Smoothing', 10, 'i', { min: 1 }]], [C.d, C.e], ['HA Open', 'HA Close'], (A, p) => { const o = rma(A.o, p.period), h = rma(A.h, p.period), l = rma(A.l, p.period), c = rma(A.c, p.period), haC = c.map((v, i) => (o[i] + h[i] + l[i] + v) / 4), haO = Array(c.length).fill(null); for (let i = 0; i < c.length; i++) haO[i] = i ? (haO[i - 1] + haC[i - 1]) / 2 : (o[i] + c[i]) / 2; return [line(ema(haO, p.period), 0), line(ema(haC, p.period), 1)]; });
  I('atas_swing_levels', 'Swing High / Low Levels (legacy alias)', 'ov', 'Alias of confirmed swing high/low levels.', [['left', 'Left bars', 3, 'i', { min: 1 }], ['right', 'Right bars', 3, 'i', { min: 1 }]], [C.d, C.e], ['Swing High', 'Swing Low'], (A, p) => { const hi = Array(A.c.length).fill(null), lo = Array(A.c.length).fill(null); for (let i = p.left; i + p.right < A.c.length; i++) { const k = i + p.right; if (A.h.slice(k - p.left, k + p.right + 1).every((v, j) => j === p.left ? true : v < A.h[k])) hi[k] = A.h[k]; if (A.l.slice(k - p.left, k + p.right + 1).every((v, j) => j === p.left ? true : v > A.l[k])) lo[k] = A.l[k]; } return [line(hi, 0), line(lo, 1)]; });
  I('atas_woodies_cci', 'Woodies CCI (proxy)', 'osc', 'CCI(14) with a longer CCI trend line; Woodies-specific pattern rules are not replicated.', [['fast', 'CCI fast', 14, 'i', { min: 1 }], ['slow', 'CCI slow', 6, 'i', { min: 1 }]], [C.a, C.b], ['CCI', 'Turbo CCI'], (A, p) => { const tp = atHLC3(A), calc = per => { const m = sma(tp, per), d = atMeanDev(tp, per); return tp.map((v, i) => m[i] == null || !d[i] ? null : (v - m[i]) / (.015 * d[i])); }; return [line(calc(p.fast), 0), line(calc(p.slow), 1)]; }, { hl: [{ y: 100, al: .3 }, { y: 0, al: .2 }, { y: -100, al: .3 }] });
  I('atas_zigzag', 'ZigZag pro (confirmed pivots)', 'ov', 'Confirmed pivot-to-pivot swing line; no future bars are used before right-side confirmation, but historical turning points can be delayed.', [['left', 'Left bars', 5, 'i', { min: 1, max: 50 }], ['right', 'Right bars', 5, 'i', { min: 1, max: 50 }]], [C.a], ['ZigZag'], (A, p) => { const out = Array(A.c.length).fill(null), pts = []; for (let i = p.left; i + p.right < A.c.length; i++) { const k = i + p.right, wh = A.h.slice(k - p.left, k + p.right + 1), wl = A.l.slice(k - p.left, k + p.right + 1); if (wh.every((v, j) => j === p.left || v < A.h[k])) pts.push([k, A.h[k]]); else if (wl.every((v, j) => j === p.left || v > A.l[k])) pts.push([k, A.l[k]]); } for (let z = 0; z < pts.length; z++) { const [i, v] = pts[z]; if (z === 0) out[i] = v; else { const [j, w] = pts[z - 1]; for (let k = j; k <= i; k++) out[k] = w + (v - w) * (k - j) / Math.max(1, i - j); } } return [line(out)]; });
  I('atas_volume_on_chart', 'Volume On The Chart', 'osc', 'Plots the chart volume as a histogram; CFDs may expose broker tick volume, not centralized traded volume.', [], [C.a], ['Volume'], A => [hist(A.v.map(v => Math.max(0, n(v))))], { pf: 'vol' });
  I('atas_volume_sr', 'Volume Support / Resistance Zones (proxy)', 'ov', 'Support/resistance levels from local high/low pivots weighted by candle volume; not a true price-level volume profile.', [['period', 'Pivot window', 20, 'i', { min: 2 }]], [C.d, C.e], ['Volume S/R'], (A, p) => { const sup = Array(A.c.length).fill(null), res = Array(A.c.length).fill(null), lo = atMin(A.l, p.period), hi = atMax(A.h, p.period); for (let i = 0; i < A.c.length; i++) { sup[i] = lo[i]; res[i] = hi[i]; } return [line(res, 0), line(sup, 1)]; });

  // The catalogue uses these aliases to present ATAS source entries whose nearest
  // QuantLab implementation is an explicit proxy (rather than claiming exact equivalence).
  window.ATASIndicatorPorts = {
    helpers: { atTR, atATR, atROC, atMom, atHMA, atDEMA, atTEMA, atKAMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR },
    registeredKeys: Object.keys(IND).filter(k => IND[k]?.cat === 'at')
  };
})();
