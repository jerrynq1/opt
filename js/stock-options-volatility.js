/* ================= STOCK OPTIONS VOLATILITY ANALYTICS =================
   Pure IV/skew/term-structure calculations for the Binance Equity Options UI.
   Provider IV is preferred. Mid-derived BSM IV is an explicitly labelled fallback.
   Rates/dividend yield are assumed zero only for model-derived delta/IV fallback.
*/
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.StockOptionsVolatility = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DAY_MS = 86400000;
  const SQRT_2PI = Math.sqrt(2 * Math.PI);

  function n(value) {
    if (value === null || value === undefined || value === '') return null;
    const valueNumber = Number(value);
    return Number.isFinite(valueNumber) ? valueNumber : null;
  }

  function ivSigma(value) {
    let sigma = n(value);
    if (sigma === null || sigma <= 0) return null;
    if (sigma > 3) sigma /= 100;
    return sigma > 0 && sigma <= 5 ? sigma : null;
  }

  const LATE_CLOSE_SYMBOLS = new Set(['GLD', 'QQQ']);

  // GLD and QQQ are listed among the ETF options with a 4:15 p.m. ET late close.
  // Other underlyings retain the standard 4:00 p.m. ET assumption. The broker's
  // contract screen remains authoritative for holiday/early-close exceptions.
  function expiryAtNewYorkClose(expiry, symbol = '') {
    const match = String(expiry || '').slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const closeMinute = LATE_CLOSE_SYMBOLS.has(String(symbol || '').toUpperCase()) ? 16 * 60 + 15 : 16 * 60;
    const closeHour = Math.floor(closeMinute / 60);
    const closeMinutePart = closeMinute % 60;
    const targetWall = Date.UTC(+match[1], +match[2] - 1, +match[3], closeHour, closeMinutePart, 0);
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
      });
      let guess = targetWall;
      for (let i = 0; i < 4; i++) {
        const parts = Object.fromEntries(formatter.formatToParts(new Date(guess)).map(part => [part.type, part.value]));
        const represented = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
        const correction = targetWall - represented;
        guess += correction;
        if (Math.abs(correction) < 1000) break;
      }
      return guess;
    } catch {
      return targetWall + 5 * 60 * 60 * 1000;
    }
  }

  function timeToExpiry(expiry, now = Date.now(), symbol = '') {
    const end = expiryAtNewYorkClose(expiry, symbol);
    if (end === null) return null;
    const years = (end - now) / (365.25 * DAY_MS);
    return Number.isFinite(years) && years > 0 ? years : null;
  }

  // Abramowitz-Stegun erf approximation; adequate for option delta/price interpolation.
  function erf(x) {
    const sign = x < 0 ? -1 : 1;
    const z = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * z);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z);
    return sign * y;
  }

  function cdf(x) {
    return 0.5 * (1 + erf(x / Math.SQRT2));
  }

  function d1Value(spot, strike, time, sigma) {
    if (!(spot > 0 && strike > 0 && time > 0 && sigma > 0)) return null;
    return (Math.log(spot / strike) + 0.5 * sigma * sigma * time) / (sigma * Math.sqrt(time));
  }

  function bsmDelta(spot, strike, time, sigma, side) {
    const d1 = d1Value(spot, strike, time, sigma);
    if (d1 === null) return null;
    const callDelta = cdf(d1); // r = q = 0 approximation
    return side === 'P' ? callDelta - 1 : callDelta;
  }

  function bsmPrice(spot, strike, time, sigma, side) {
    if (!(spot > 0 && strike > 0 && time > 0 && sigma > 0)) return null;
    const rootTime = Math.sqrt(time);
    const d1 = (Math.log(spot / strike) + 0.5 * sigma * sigma * time) / (sigma * rootTime);
    const d2 = d1 - sigma * rootTime;
    return side === 'P'
      ? strike * cdf(-d2) - spot * cdf(-d1)
      : spot * cdf(d1) - strike * cdf(d2);
  }

  function quoteMid(q) {
    const directMid = n(q?.mid);
    const bid = n(q?.bid), ask = n(q?.ask);
    if (bid !== null && ask !== null && bid > 0 && ask >= bid) {
      // Do not invert a provider Mid that contradicts its own two-sided book.
      // A valid in-book Mid is retained; otherwise use the contemporaneous NBBO midpoint.
      if (directMid !== null && directMid > 0 && directMid >= bid && directMid <= ask) {
        return { price: directMid, source: 'mid' };
      }
      const midpoint = (bid + ask) / 2;
      return midpoint > 0 ? { price: midpoint, source: 'bid-ask midpoint' } : null;
    }
    if (directMid !== null && directMid > 0) return { price: directMid, source: 'mid' };
    return null;
  }

  function impliedVolFromMid(price, spot, strike, time, side) {
    if (!(price > 0 && spot > 0 && strike > 0 && time > 0 && (side === 'C' || side === 'P'))) return null;
    const intrinsic = side === 'C' ? Math.max(spot - strike, 0) : Math.max(strike - spot, 0);
    if (price + Math.max(0.01, spot * 1e-6) < intrinsic) return null;
    let low = 0.0001, high = 5;
    const maxPrice = bsmPrice(spot, strike, time, high, side);
    if (maxPrice === null || price > maxPrice) return null;
    for (let i = 0; i < 72; i++) {
      const mid = (low + high) / 2;
      const model = bsmPrice(spot, strike, time, mid, side);
      if (model === null) return null;
      if (model < price) low = mid;
      else high = mid;
    }
    const sigma = (low + high) / 2;
    return Number.isFinite(sigma) && sigma > 0.0001001 && sigma <= 5 ? sigma : null;
  }

  function resolveQuoteIV(q, spot, time) {
    const provider = ivSigma(q?.iv);
    if (provider !== null) return { iv: provider, source: 'provider', providerSource: q?.providerIVSource || 'mark' };
    const mid = quoteMid(q);
    if (!mid) return { iv: null, source: 'missing' };
    const derived = impliedVolFromMid(mid.price, spot, Number(q.strike), time, q.side);
    return derived === null
      ? { iv: null, source: 'missing' }
      : { iv: derived, source: 'mid-derived' };
  }

  // Display-only quality screen for the Clean Volatility Skew. It never alters
  // the raw IV used by ATM/RR/BF/Expected Move calculations.
  function skewQuoteQuality(q) {
    const bid = n(q?.bid), ask = n(q?.ask);
    const volume = Math.max(0, n(q?.volume) ?? 0);
    const openInterest = Math.max(0, n(q?.openInterest) ?? 0);
    const directMid = n(q?.mid);
    const hasBid = bid !== null;
    const hasAsk = ask !== null;
    let spreadPct = null;

    if (hasBid && hasAsk) {
      if (bid <= 0 && ask <= 0) return { clean: false, reason: 'empty-book', spreadPct: null };
      if (bid <= 0 && ask > 0) return { clean: false, reason: 'zero-bid', spreadPct: null };
      if (ask < bid) return { clean: false, reason: 'crossed-market', spreadPct: null };
      if (bid > 0 && ask > 0) {
        const mid = (bid + ask) / 2;
        spreadPct = mid > 0 ? (ask - bid) / mid : null;
        if (spreadPct !== null && spreadPct > 1.0) {
          return { clean: false, reason: 'spread-over-100pct', spreadPct };
        }
        if (spreadPct !== null && spreadPct > 0.60 && volume < 5 && openInterest < 25) {
          return { clean: false, reason: 'wide-spread-low-liquidity', spreadPct };
        }
        if (spreadPct !== null && spreadPct > 0.40 && volume < 1 && openInterest < 10) {
          return { clean: false, reason: 'wide-spread-no-activity', spreadPct };
        }
      }
    } else {
      // Without a two-sided book, require independent activity evidence. A
      // mid-derived IV needs an actual two-sided market; a single bidIV/askIV
      // is not treated as a clean, balanced volatility observation.
      const hasActivity = volume > 0 || openInterest > 0;
      if (!hasActivity) return { clean: false, reason: 'no-market-or-liquidity', spreadPct };
      if (q?.ivSource === 'mid-derived') {
        return { clean: false, reason: 'mid-derived-no-liquidity', spreadPct };
      }
      if (q?.providerIVSource === 'bid-only' || q?.providerIVSource === 'ask-only') {
        return { clean: false, reason: 'one-sided-provider-iv', spreadPct };
      }
    }

    return { clean: true, reason: 'accepted', spreadPct };
  }

  function average(values) {
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  }

  function normalizedProviderDelta(q) {
    let delta = n(q?.delta);
    if (delta === null) return null;
    if (Math.abs(delta) > 1.5) delta /= 100;
    if (Math.abs(delta) > 1.001) return null;
    return q.side === 'P' ? -Math.abs(delta) : Math.abs(delta);
  }

  function normalizedDelta(q, spot, time, sigma) {
    const provider = normalizedProviderDelta(q);
    return provider !== null ? provider : bsmDelta(spot, Number(q.strike), time, sigma, q.side);
  }

  function strikeFromOcc(symbol) {
    const match = String(symbol || '').match(/[CP](\d{8})$/i);
    return match ? Number(match[1]) / 1000 : null;
  }

  function interpolateAtSpot(rows, spot, maxBracketLogWidth = 0.06) {
    if (!(spot > 0)) return null;
    const valid = rows.filter(row => row.iv !== null && Number.isFinite(row.iv) && row.strike > 0)
      .map(row => ({ ...row, x: Math.log(row.strike / spot) }))
      .sort((a, b) => a.x - b.x);
    if (!valid.length) return null;

    const exact = valid.find(row => Math.abs(row.x) < 1e-9);
    if (exact) return exact.iv;

    const lower = [...valid].reverse().find(row => row.x < 0);
    const upper = valid.find(row => row.x > 0);
    // ATM must be bracketed by observations around Spot. Do not silently label a
    // far-OTM/ITM single quote as ATM when one side of the smile is absent.
    if (!lower || !upper) return null;
    const width = upper.x - lower.x;
    if (!(width > 0) || width > maxBracketLogWidth) return null;
    const weight = (0 - lower.x) / width;
    return lower.iv + (upper.iv - lower.iv) * weight;
  }

  function interpolateAtDelta(rows, side, target) {
    const wantedSign = side === 'P' ? -1 : 1;
    const grouped = new Map();
    for (const row of rows) {
      if (row.side !== side || !Number.isFinite(row.iv) || !Number.isFinite(row.delta)) continue;
      const absDelta = Math.abs(row.delta);
      if (!(absDelta > 0 && absDelta <= 1)) continue;
      const key = absDelta.toFixed(5);
      if (!grouped.has(key)) grouped.set(key, { delta: absDelta, ivs: [], strikes: [], rows: [] });
      const group = grouped.get(key);
      group.ivs.push(row.iv);
      if (Number.isFinite(row.strike) && row.strike > 0) group.strikes.push(row.strike);
      group.rows.push(row);
    }
    const points = [...grouped.values()].map(group => ({
      delta: group.delta,
      iv: average(group.ivs),
      strike: average(group.strikes),
      rows: group.rows
    })).filter(point => Number.isFinite(point.iv)).sort((a, b) => a.delta - b.delta);
    if (!points.length) return null;

    const exact = points.find(point => Math.abs(point.delta - target) <= 0.001);
    if (exact) return { iv: exact.iv, strike: exact.strike, delta: wantedSign * target, method: 'observed' };

    const lower = [...points].reverse().find(point => point.delta < target);
    const upper = points.find(point => point.delta > target);
    // No extrapolation: a 17-delta quote is not a 25-delta quote just because
    // it happens to be the nearest available contract.
    if (!lower || !upper) return null;
    const lowerGap = target - lower.delta;
    const upperGap = upper.delta - target;
    const maxSideGap = target >= 0.20 ? 0.06 : 0.035;
    const totalGap = upper.delta - lower.delta;
    if (lowerGap > maxSideGap || upperGap > maxSideGap || totalGap > maxSideGap * 2) return null;

    const weight = lowerGap / totalGap;
    const iv = lower.iv + (upper.iv - lower.iv) * weight;
    const strike = Number.isFinite(lower.strike) && Number.isFinite(upper.strike)
      ? lower.strike + (upper.strike - lower.strike) * weight : null;
    return { iv, strike, delta: wantedSign * target, method: 'delta-interpolated' };
  }

  function expiryMetrics(expiry, quotes, spot, now, symbol = '') {
    const time = timeToExpiry(expiry, now, symbol);
    if (!(spot > 0) || time === null) return null;
    const valid = [];
    let providerIVCount = 0, midDerivedIVCount = 0, providerDeltaCount = 0, modelDeltaCount = 0;
    for (const raw of Array.isArray(quotes) ? quotes : []) {
      const strike = n(raw?.strike) ?? strikeFromOcc(raw?.optionSymbol);
      const side = raw?.side === 'C' || raw?.side === 'P' ? raw.side : null;
      if (!(strike > 0) || !side) continue;
      const q = { ...raw, strike, side };
      const resolved = resolveQuoteIV(q, spot, time);
      if (resolved.iv === null) continue;
      const suppliedDelta = normalizedProviderDelta(q);
      const delta = suppliedDelta !== null ? suppliedDelta : bsmDelta(spot, strike, time, resolved.iv, side);
      if (resolved.source === 'provider') providerIVCount++;
      else midDerivedIVCount++;
      if (suppliedDelta !== null) providerDeltaCount++;
      else modelDeltaCount++;
      valid.push({ ...q, iv: resolved.iv, ivSource: resolved.source, delta });
    }

    const calls = valid.filter(row => row.side === 'C');
    const puts = valid.filter(row => row.side === 'P');
    const atmCall = interpolateAtSpot(calls, spot);
    const atmPut = interpolateAtSpot(puts, spot);
    const atmValues = [atmCall, atmPut].filter(value => Number.isFinite(value));
    const atmIV = atmValues.length ? atmValues.reduce((sum, value) => sum + value, 0) / atmValues.length : null;
    const put25 = interpolateAtDelta(valid, 'P', 0.25);
    const call25 = interpolateAtDelta(valid, 'C', 0.25);
    const put10 = interpolateAtDelta(valid, 'P', 0.10);
    const call10 = interpolateAtDelta(valid, 'C', 0.10);
    const atmSideCount = atmValues.length;
    const rr25 = put25 && call25 ? call25.iv - put25.iv : null;
    const bf25 = put25 && call25 && atmIV !== null ? (call25.iv + put25.iv) / 2 - atmIV : null;
    // Keep the actual strike-by-strike IV observations for the simple smile/skew chart.
    // If duplicate rows exist at the same strike/side, average only those observed values.
    const curveByStrike = new Map();
    const skewQualityCounts = {
      accepted: 0, rejected: 0, 'zero-bid': 0, 'empty-book': 0, 'crossed-market': 0,
      'spread-over-100pct': 0, 'wide-spread-low-liquidity': 0,
      'wide-spread-no-activity': 0, 'no-market-or-liquidity': 0,
      'mid-derived-no-liquidity': 0, 'one-sided-provider-iv': 0
    };
    for (const row of valid) {
      const key = row.strike;
      if (!curveByStrike.has(key)) curveByStrike.set(key, { strike: key, calls: [], puts: [] });
      const quality = skewQuoteQuality(row);
      row.skewClean = quality.clean;
      row.skewCleanReason = quality.reason;
      row.skewSpreadPct = quality.spreadPct;
      if (quality.clean) skewQualityCounts.accepted++;
      else {
        skewQualityCounts.rejected++;
        skewQualityCounts[quality.reason] = (skewQualityCounts[quality.reason] || 0) + 1;
      }
      curveByStrike.get(key)[row.side === 'C' ? 'calls' : 'puts'].push(row);
    }
    const skewCurve = [...curveByStrike.values()].sort((a, b) => a.strike - b.strike).map(item => {
      const avg = rows => average(rows.map(row => row.iv));
      const cleanAvg = rows => average(rows.filter(row => row.skewClean).map(row => row.iv));
      const callCleanCount = item.calls.filter(row => row.skewClean).length;
      const putCleanCount = item.puts.filter(row => row.skewClean).length;
      return {
        strike: item.strike,
        callIV: avg(item.calls),
        putIV: avg(item.puts),
        callCleanIV: cleanAvg(item.calls),
        putCleanIV: cleanAvg(item.puts),
        callCount: item.calls.length,
        putCount: item.puts.length,
        callCleanCount,
        putCleanCount,
        callRejectedCount: item.calls.length - callCleanCount,
        putRejectedCount: item.puts.length - putCleanCount
      };
    });
    const cleanIVCount = skewCurve.reduce((sum, item) => sum + item.callCleanCount + item.putCleanCount, 0);
    const rawSkewIVCount = skewCurve.reduce((sum, item) => sum + item.callCount + item.putCount, 0);
    const cleanValid = valid.filter(row => row.skewClean);
    const cleanAtmCall = interpolateAtSpot(cleanValid.filter(row => row.side === 'C'), spot);
    const cleanAtmPut = interpolateAtSpot(cleanValid.filter(row => row.side === 'P'), spot);
    const cleanAtmValues = [cleanAtmCall, cleanAtmPut].filter(Number.isFinite);
    const cleanAtmIV = cleanAtmValues.length
      ? cleanAtmValues.reduce((sum, value) => sum + value, 0) / cleanAtmValues.length : null;
    const cleanPut25 = interpolateAtDelta(cleanValid, 'P', 0.25);
    const cleanCall25 = interpolateAtDelta(cleanValid, 'C', 0.25);
    const dte = time * 365.25;
    const expectedMove = atmIV !== null ? spot * atmIV * Math.sqrt(time) : null;
    const expectedMovePct = atmIV !== null ? atmIV * Math.sqrt(time) : null;

    return {
      expiry, time, dte, quoteCount: Array.isArray(quotes) ? quotes.length : 0,
      ivCount: valid.length, providerIVCount, midDerivedIVCount, providerDeltaCount, modelDeltaCount,
      ivCoverage: quotes?.length ? valid.length / quotes.length : 0,
      atmIV, atmCallIV: atmCall, atmPutIV: atmPut, atmSideCount,
      atmMethod: atmSideCount === 2 ? 'call-put-bracketed' : atmSideCount === 1 ? 'single-side-bracketed' : 'unavailable',
      put10IV: put10?.iv ?? null, put25IV: put25?.iv ?? null,
      call25IV: call25?.iv ?? null, call10IV: call10?.iv ?? null,
      put25Delta: put25?.delta ?? null, call25Delta: call25?.delta ?? null,
      put25Method: put25?.method ?? null, call25Method: call25?.method ?? null,
      rr25, bf25,
      putSkew: put25 && atmIV !== null ? put25.iv - atmIV : null,
      callSkew: call25 && atmIV !== null ? call25.iv - atmIV : null,
      put25Strike: put25?.strike ?? null, call25Strike: call25?.strike ?? null,
      cleanAtmIV, cleanPut25IV: cleanPut25?.iv ?? null, cleanCall25IV: cleanCall25?.iv ?? null,
      cleanPut25Strike: cleanPut25?.strike ?? null, cleanCall25Strike: cleanCall25?.strike ?? null,
      cleanAtmSideCount: cleanAtmValues.length,
      expectedMove, expectedMovePct, skewCurve, cleanIVCount, rawSkewIVCount, skewRejectedCount: skewQualityCounts.rejected, skewQualityCounts,
      sourceLabel: midDerivedIVCount ? (providerIVCount ? 'Provider IV + Mid-derived fallback' : 'Mid-derived BSM IV') : 'Provider IV',
      surface: { put10: put10?.iv ?? null, put25: put25?.iv ?? null, atm: atmIV, call25: call25?.iv ?? null, call10: call10?.iv ?? null }
    };
  }

  function calculate({ spot, symbol = '', expiries = [], now = Date.now() } = {}) {
    const underlying = n(spot);
    const underlyingSymbol = String(symbol || '').toUpperCase();
    const rows = (Array.isArray(expiries) ? expiries : [])
      .map(item => expiryMetrics(item?.expiry, item?.quotes, underlying, now, underlyingSymbol))
      .filter(Boolean)
      .sort((a, b) => a.expiry.localeCompare(b.expiry));
    return {
      spot: underlying,
      expiries: rows,
      loadedExpiries: rows.length,
      quoteCount: rows.reduce((sum, row) => sum + row.quoteCount, 0),
      ivCount: rows.reduce((sum, row) => sum + row.ivCount, 0),
      providerIVCount: rows.reduce((sum, row) => sum + row.providerIVCount, 0),
      midDerivedIVCount: rows.reduce((sum, row) => sum + row.midDerivedIVCount, 0)
    };
  }

  return { calculate, ivSigma, timeToExpiry, expiryAtNewYorkClose, bsmDelta, bsmPrice, impliedVolFromMid, normalizedProviderDelta, interpolateAtSpot, interpolateAtDelta };
});
