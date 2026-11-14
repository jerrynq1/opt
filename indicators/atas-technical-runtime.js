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
  // Mirrors ATAS Technical/AMA.cs, including its prior-source-price seed.
  const atATAS_AMA = (a, p = 15, fast = 3, slow = 20) => {
    p = P_(p); const out = Array(a.length).fill(null);
    const f = 2 / (fast + 1), s = 2 / (slow + 1);
    const diffs = Array(a.length).fill(null);
    for (let i = 1; i < a.length; i++) diffs[i] = Math.abs(a[i] - a[i - 1]);
    for (let i = p; i < a.length; i++) {
      if (a[i] == null || a[i - p] == null) continue;
      let volatility = 0;
      for (let j = i - p + 1; j <= i; j++) volatility += diffs[j] || 0;
      const dir = a[i] - a[i - p];
      const denominator = volatility === 0 ? 0.000001 : volatility;
      const sc = (Math.abs(dir / denominator) * (f - s) + s) ** 2;
      const prior = out[i - 1] != null && out[i - 1] !== 0 ? out[i - 1] : a[i - 1];
      out[i] = prior + sc * (a[i] - prior);
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












  // ── Momentum / oscillators ───────────────────────────────────────────────





















  // ── Volume / money-flow indicators (cTrader volume semantics are disclosed) ──











  // ── Volatility / price channels ─────────────────────────────────────────








  // ── Additional classic ATAS technical studies ───────────────────────────
























  // ── Trend / market structure ────────────────────────────────────────────
















  // ── Simple ICT/price-level overlays that can be derived from chart OHLC ───



  // ── Re-register core technical indicators pruned by the Pine-only registry ──
  // These are browser-native implementations so ATAS catalogue links never point
  // to keys that were removed by the existing Pine registry filter.













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























































  window.ATASIndicatorRuntime = {C, I, period, srcParam, line, hist, fill, n, safe, atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi};
  window.ATASIndicatorPorts = { helpers: {atRoll, atSum, atMax, atMin, atMeanDev, atTR, atATR, atROC, atMom, atHLC3, atMedian, atEMA, atDEMA, atTEMA, atHMA, atZLEMA, atKAMA, atATAS_AMA, atCCI, atStoch, atDMI, atOBV, atADL, atSAR, atMedianWin, atLinRegEnd, atPFE, atVHF, atStochRsi}, registeredKeys: [] };
})();
