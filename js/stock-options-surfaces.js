/* ================= STOCK OPTIONS MULTI-EXPIRY SURFACES =================
   Pure surface aggregation for IV, GEX/DEX/Greek exposure, Volume and OI.
   Axis is expiry (rows) x spot-relative strike/moneyness buckets (columns).
   OI is unsigned open contracts; it is not dealer long/short positioning.
*/
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.StockOptionsSurfaces = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DEFAULT_BINS = Object.freeze([-20, -17.5, -15, -12.5, -10, -7.5, -5, -2.5, 0, 2.5, 5, 7.5, 10, 12.5, 15, 17.5, 20]);
  const DAY_MS = 86400000;
  const GREEK_METRICS = Object.freeze({
    delta: { label: 'Delta', unit: 'Δ per share', kind: 'signed' },
    gamma: { label: 'Gamma', unit: 'Γ per $1 underlying move', kind: 'positive' },
    vega: { label: 'Vega', unit: 'per +1 implied-volatility point', kind: 'positive' },
    theta: { label: 'Theta', unit: 'per calendar day', kind: 'signed' },
    vanna: { label: 'Vanna', unit: 'Δ change per +1 volatility point', kind: 'signed' },
    charm: { label: 'Charm', unit: 'Δ change per calendar day', kind: 'signed' },
    rho: { label: 'Rho', unit: 'per +1 percentage-point risk-free rate', kind: 'signed' }
  });
  const METRICS = Object.freeze({
    iv: { label: 'IV', unit: 'Median implied volatility', kind: 'rate' },
    gamma: { label: 'GEX', unit: 'USD notional per 1% underlying move · Calls + / Puts −', kind: 'signed' },
    delta: { label: 'DEX', unit: 'USD delta notional · signed Delta × OI × multiplier × Spot', kind: 'signed' },
    vega: { label: 'Vega Exposure', unit: 'Provider Vega × OI × multiplier', kind: 'signed' },
    theta: { label: 'Theta Exposure', unit: 'Provider Theta × OI × multiplier', kind: 'signed' },
    vanna: { label: 'Vanna Exposure', unit: 'USD delta-notional change per +1 IV point · BSM model', kind: 'signed' },
    charm: { label: 'Charm Exposure', unit: 'USD delta-notional change per calendar day · BSM model', kind: 'signed' },
    volume: { label: 'Volume', unit: 'Provider-reported contract volume; not signed flow or time-and-sales', kind: 'count' },
    oi: { label: 'Open Interest', unit: 'Outstanding contracts', kind: 'count' }
  });

  const toNum = value => {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };
  const normalPdf = x => Number.isFinite(x) ? Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI) : null;
  function nearestBin(moneyness, bins) {
    let best = -1, gap = Infinity;
    for (let i = 0; i < bins.length; i++) {
      const next = Math.abs(moneyness - bins[i]);
      if (next < gap) { gap = next; best = i; }
    }
    // Bucket tolerance is half the smallest spacing, so quotes cannot be
    // stretched across adjacent buckets when the surface resolution changes.
    const spacings = bins.slice(1).map((v, i) => Math.abs(v - bins[i])).filter(v => v > 0);
    const tolerance = spacings.length ? Math.min(...spacings) / 2 + 1e-6 : 0;
    return gap <= tolerance ? best : -1;
  }
  function contractMultiplier(q, symbol) {
    const explicit = toNum(q?.multiplier);
    if (explicit !== null && explicit > 0) return { value: explicit, assumed: false };
    const occ = String(q?.optionSymbol || '').toUpperCase();
    const escaped = String(symbol || '').toUpperCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (escaped && new RegExp(`^${escaped}\\d{6}[CP]\\d{8}$`).test(occ)) return { value: 100, assumed: true };
    return { value: null, assumed: false };
  }
  function normalizedDelta(value, side) {
    let delta = toNum(value);
    if (delta === null) return null;
    if (Math.abs(delta) > 1.5) delta /= 100;
    if (Math.abs(delta) > 1.001) return null;
    return side === 'P' ? -Math.abs(delta) : Math.abs(delta);
  }
  function bsmGamma(spot, strike, time, sigma, rate, dividendYield) {
    if (!(spot > 0 && strike > 0 && time > 0 && sigma > 0)) return null;
    const rootTime = Math.sqrt(time);
    const d1 = (Math.log(spot / strike) + (rate - dividendYield + 0.5 * sigma * sigma) * time) / (sigma * rootTime);
    return Math.exp(-dividendYield * time) * normalPdf(d1) / (spot * sigma * rootTime);
  }
  function bsmGreeks(spot, strike, time, sigma, side, rate, dividendYield) {
    if (!(spot > 0 && strike > 0 && time > 0 && sigma > 0) || !['C', 'P'].includes(side)) return null;
    const sqrtT = Math.sqrt(time);
    const d1 = (Math.log(spot / strike) + (rate - dividendYield + 0.5 * sigma * sigma) * time) / (sigma * sqrtT);
    const d2 = d1 - sigma * sqrtT;
    const pdf = normalPdf(d1);
    const cdf = x => 0.5 * (1 + erfApprox(x / Math.SQRT2));
    const dq = Math.exp(-dividendYield * time), dr = Math.exp(-rate * time);
    const delta = side === 'C' ? dq * cdf(d1) : dq * (cdf(d1) - 1);
    const gamma = dq * pdf / (spot * sigma * sqrtT);
    const vega = spot * dq * pdf * sqrtT / 100;
    const thetaYear = side === 'C'
      ? -(spot * dq * pdf * sigma) / (2 * sqrtT) - rate * strike * dr * cdf(d2) + dividendYield * spot * dq * cdf(d1)
      : -(spot * dq * pdf * sigma) / (2 * sqrtT) + rate * strike * dr * cdf(-d2) - dividendYield * spot * dq * cdf(-d1);
    const theta = thetaYear / 365.25;
    const rho = side === 'C' ? strike * time * dr * cdf(d2) / 100 : -strike * time * dr * cdf(-d2) / 100;
    return [delta, gamma, vega, theta, rho].every(Number.isFinite) ? { delta, gamma, vega, theta, rho } : null;
  }
  function erfApprox(x) {
    const sign = x < 0 ? -1 : 1, z = Math.abs(x), t = 1 / (1 + 0.3275911 * z);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z);
    return sign * y;
  }
  function sideAllowed(side, filter) {
    const selected = String(filter || 'both').toLowerCase();
    if (selected === 'both' || selected === 'all') return true;
    if (selected === 'call' || selected === 'c') return side === 'C';
    if (selected === 'put' || selected === 'p') return side === 'P';
    return false;
  }
  function makeCell() {
    return { value: null, contractCount: 0, usableCount: 0, assumedCount: 0, assumedOICount: 0, assumedVolumeCount: 0, assumedMultiplierCount: 0, skippedCount: 0, strikes: [], sources: { providerIV: 0, midDerivedIV: 0, providerGreek: 0, bsmDerivedGreek: 0 } };
  }
  function median(values) {
    if (!values.length) return null;
    const sorted = values.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }


  // A single same-day expiry has no observed second expiry row. For a useful 3D
  // view, project the same contracts through a decreasing time-to-expiry grid.
  // This is a model scenario, not additional market observations.
  function buildIntradayTimeSlices(baseTime, count = 9) {
    const baseDte = Number(baseTime) * 365.25;
    if (!(baseDte > 0 && baseDte <= 1.000001) || !Number.isFinite(baseDte)) return null;
    const minimumDte = Math.min(baseDte * 0.5, Math.max(5 / 1440, baseDte * 0.08));
    const slices = [];
    for (let i = 0; i < count; i++) {
      const dte = minimumDte + (baseDte - minimumDte) * i / Math.max(1, count - 1);
      slices.push({ time: dte / 365.25, dte, index: i, fractionOfCurrent: dte / baseDte, projected: i < count - 1 });
    }
    return slices;
  }

  function cloneCell(cell) {
    return {
      ...cell,
      strikes: Array.isArray(cell?.strikes) ? cell.strikes.slice() : [],
      sources: { ...(cell?.sources || {}) }
    };
  }

  function projectionRow(baseRow, cells, slice, baseDte, expiry) {
    return {
      ...baseRow,
      expiry,
      dte: slice.dte,
      cells,
      status: baseRow.complete ? 'time-decay-projection' : 'time-decay-projection-partial',
      projection: {
        type: 'time-decay',
        projected: slice.projected,
        sliceIndex: slice.index,
        sliceCount: 9,
        baseDte,
        remainingDte: slice.dte,
        elapsedDte: Math.max(0, baseDte - slice.dte),
        assumptions: 'Spot, observed IV, OI and contract multiplier held constant; BSM Greeks repriced at shorter time-to-expiry.'
      }
    };
  }

  function buildProjectedExposureCells({ quotes, spot, baseTime, sliceTime, rate, dividendYield, symbol, bins, metric, side, vol }) {
    const cells = bins.map(() => makeCell());
    for (const q of quotes) {
      const strike = toNum(q?.strike);
      const optionSide = q?.side === 'C' || q?.side === 'P' ? q.side : null;
      if (!(strike > 0) || !optionSide || !sideAllowed(optionSide, side)) continue;
      const binIndex = nearestBin((strike / spot - 1) * 100, bins);
      if (binIndex < 0) continue;
      const cell = cells[binIndex];
      cell.contractCount++;
      if (!cell.strikes.includes(strike)) cell.strikes.push(strike);

      const oiRaw = toNum(q?.openInterest), oi = oiRaw !== null && oiRaw >= 0 ? oiRaw : null;
      if (oi === null) { cell.assumedCount++; cell.assumedOICount++; }
      const multiplier = contractMultiplier(q, symbol), m = multiplier.value;
      if (multiplier.assumed) cell.assumedMultiplierCount++;
      if (!(oi > 0) || !(m > 0)) { cell.skippedCount++; continue; }

      // Resolve IV once at the observed snapshot and hold it fixed across the
      // time-decay slices. Re-solving a fixed option mid at every T would create
      // artificial IV movement and mix time decay with volatility repricing.
      const sigmaResult = typeof vol.resolveQuoteIV === 'function'
        ? vol.resolveQuoteIV(q, spot, baseTime, rate, dividendYield)
        : { iv: typeof vol.ivSigma === 'function' ? vol.ivSigma(q?.iv) : null };
      const sigma = toNum(sigmaResult?.iv);
      if (!(sigma > 0)) { cell.skippedCount++; continue; }

      const model = bsmGreeks(spot, strike, sliceTime, sigma, optionSide, rate, dividendYield);
      const vc = (metric === 'vanna' || metric === 'charm') && typeof vol.bsmVannaCharm === 'function'
        ? vol.bsmVannaCharm(spot, strike, sliceTime, sigma, optionSide, rate, dividendYield)
        : null;
      let value = null;
      if (metric === 'gamma' && model) value = model.gamma * oi * m * spot * spot * 0.01 * (optionSide === 'P' ? -1 : 1);
      else if (metric === 'delta' && model) value = model.delta * oi * m * spot;
      else if (metric === 'vega' && model) value = model.vega * oi * m;
      else if (metric === 'theta' && model) value = model.theta * oi * m;
      else if (metric === 'vanna' && vc) value = vc.vanna * 0.01 * oi * m * spot;
      else if (metric === 'charm' && vc) value = vc.charm / 365.25 * oi * m * spot;
      if (Number.isFinite(value)) {
        cell.value = (cell.value ?? 0) + value;
        cell.usableCount++;
        cell.sources.bsmDerivedGreek++;
      } else cell.skippedCount++;
    }
    for (const cell of cells) {
      cell.coverage = cell.contractCount ? cell.usableCount / cell.contractCount : null;
      cell.strikeMin = cell.strikes.length ? Math.min(...cell.strikes) : null;
      cell.strikeMax = cell.strikes.length ? Math.max(...cell.strikes) : null;
    }
    return cells;
  }

  function buildProjectedGreekCells({ quotes, spot, baseTime, sliceTime, rate, dividendYield, symbol, bins, metric, side, vol }) {
    const cells = bins.map(() => ({ value: null, contractCount: 0, usableCount: 0, skippedCount: 0, values: [], providerCount: 0, modelCount: 0, strikes: [] }));
    for (const q of quotes) {
      const strike = toNum(q?.strike), optionSide = q?.side === 'C' || q?.side === 'P' ? q.side : null;
      if (!(strike > 0) || !optionSide || !sideAllowed(optionSide, side)) continue;
      const binIndex = nearestBin((strike / spot - 1) * 100, bins);
      if (binIndex < 0) continue;
      const cell = cells[binIndex]; cell.contractCount++;
      if (!cell.strikes.includes(strike)) cell.strikes.push(strike);
      const sigmaResult = typeof vol.resolveQuoteIV === 'function'
        ? vol.resolveQuoteIV(q, spot, baseTime, rate, dividendYield)
        : { iv: typeof vol.ivSigma === 'function' ? vol.ivSigma(q?.iv) : null };
      const sigma = toNum(sigmaResult?.iv);
      if (!(sigma > 0)) { cell.skippedCount++; continue; }
      let value = null;
      if (metric === 'vanna' || metric === 'charm') {
        const vc = typeof vol.bsmVannaCharm === 'function' ? vol.bsmVannaCharm(spot, strike, sliceTime, sigma, optionSide, rate, dividendYield) : null;
        if (vc) value = metric === 'vanna' ? vc.vanna * 0.01 : vc.charm / 365.25;
      } else {
        const model = bsmGreeks(spot, strike, sliceTime, sigma, optionSide, rate, dividendYield);
        if (model) value = model[metric] ?? null;
      }
      if (Number.isFinite(value)) { cell.values.push(value); cell.usableCount++; cell.modelCount++; }
      else cell.skippedCount++;
    }
    for (const cell of cells) {
      cell.value = median(cell.values); delete cell.values;
      cell.coverage = cell.contractCount ? cell.usableCount / cell.contractCount : null;
      cell.strikes.sort((a, b) => a - b); cell.strikeMin = cell.strikes[0] ?? null; cell.strikeMax = cell.strikes.at(-1) ?? null;
    }
    return cells;
  }

  function build({ spot, symbol = '', expiries = [], now = Date.now(), bins = DEFAULT_BINS, metric = 'iv', side = 'both', exposureMetric = 'gamma' } = {}) {
    const underlying = toNum(spot);
    const key = String(symbol || '').trim().toUpperCase();
    const api = typeof globalThis !== 'undefined' ? globalThis.StockOptionsVolatility : null;
    const vol = api || {};
    const qYield = typeof vol.dividendYieldForSymbol === 'function' ? vol.dividendYieldForSymbol(key) : (key === 'QQQ' ? 0.0045 : 0);
    const rate = 0;
    const selectedMetric = metric === 'exposure' ? exposureMetric : metric;
    const config = METRICS[selectedMetric] || METRICS.iv;
    const centers = (Array.isArray(bins) ? bins : DEFAULT_BINS).map(Number).filter(Number.isFinite);
    if (!(underlying > 0) || !centers.length || !METRICS[selectedMetric]) {
      return { spot: underlying, symbol: key, bins: centers, rows: [], metric: selectedMetric, config, dividendYield: qYield, rate, loadedExpiries: 0, quoteCount: 0, projection: null };
    }

    const preparedInputs = (Array.isArray(expiries) ? expiries : []).map(input => {
      const expiry = String(input?.expiry || ''), quotes = Array.isArray(input?.quotes) ? input.quotes : [];
      const time = typeof vol.timeToExpiry === 'function' ? vol.timeToExpiry(expiry, now, key) : null;
      return { input, expiry, quotes, time };
    }).filter(item => item.time > 0);
    const isSingle0Dte = preparedInputs.length === 1 && preparedInputs[0].time * 365.25 <= 1.000001;
    const projectionSlices = isSingle0Dte ? buildIntradayTimeSlices(preparedInputs[0].time, 9) : null;
    const projectionInfo = projectionSlices ? {
      type: 'time-decay', method: 'BSM time-to-expiry repricing', baseExpiry: preparedInputs[0].expiry,
      baseDte: preparedInputs[0].time * 365.25, sliceCount: projectionSlices.length,
      assumptions: 'Spot, observed IV, OI and contract multiplier held constant. Greek/exposure metrics are repriced with BSM at decreasing time-to-expiry. IV, Volume and OI remain fixed.'
    } : null;

    const surfaceRows = [];
    let totalQuotes = 0;
    for (const prepared of preparedInputs) {
      const { input, expiry, quotes, time } = prepared;
      totalQuotes += quotes.length;
      const cells = centers.map(() => makeCell());
      for (const q of quotes) {
        const strike = toNum(q?.strike);
        const optionSide = q?.side === 'C' || q?.side === 'P' ? q.side : null;
        if (!(strike > 0) || !optionSide || !sideAllowed(optionSide, side)) continue;
        const moneyness = (strike / underlying - 1) * 100;
        const binIndex = nearestBin(moneyness, centers);
        if (binIndex < 0) continue;
        const cell = cells[binIndex];
        cell.contractCount++;
        if (!cell.strikes.includes(strike)) cell.strikes.push(strike);
        const oiRaw = toNum(q?.openInterest);
        const volRaw = toNum(q?.volume);
        const oiValid = oiRaw !== null && oiRaw >= 0;
        const volumeValid = volRaw !== null && volRaw >= 0;
        const oi = oiValid ? oiRaw : null;
        const volume = volumeValid ? volRaw : null;
        if (!oiValid) { cell.assumedCount++; cell.assumedOICount++; }
        if (!volumeValid) cell.assumedVolumeCount++;
        const multiplier = contractMultiplier(q, key);
        const m = multiplier.value;
        if (multiplier.assumed) cell.assumedMultiplierCount++;
        const providerGammaRaw = toNum(q?.gamma);
        const providerGamma = providerGammaRaw !== null && Math.abs(providerGammaRaw) > 0 ? Math.abs(providerGammaRaw) : null;
        const providerDelta = normalizedDelta(q?.delta, optionSide);
        const needsSigma = selectedMetric === 'iv' || selectedMetric === 'vanna' || selectedMetric === 'charm' ||
          (selectedMetric === 'gamma' && providerGamma === null) || (selectedMetric === 'delta' && providerDelta === null);
        const sigmaResolved = needsSigma
          ? (typeof vol.resolveQuoteIV === 'function'
            ? vol.resolveQuoteIV(q, underlying, time, rate, qYield)
            : { iv: typeof vol.ivSigma === 'function' ? vol.ivSigma(q?.iv) : null, source: 'missing' })
          : { iv: null, source: 'not-needed' };
        const sigma = sigmaResolved?.iv !== null && sigmaResolved?.iv !== undefined ? Number(sigmaResolved.iv) : null;
        if (needsSigma && sigma !== null && sigma > 0 && Number.isFinite(sigma)) {
          cell.sources[sigmaResolved.source === 'provider' ? 'providerIV' : 'midDerivedIV']++;
        }

        let value = null;
        if (selectedMetric === 'iv') value = sigma;
        else if (selectedMetric === 'volume') value = volume;
        else if (selectedMetric === 'oi') value = oi;
        else if (oi !== null && oi > 0 && m !== null) {
          const model = (selectedMetric === 'vanna' || selectedMetric === 'charm') && sigma !== null && sigma > 0 && typeof vol.bsmVannaCharm === 'function'
            ? vol.bsmVannaCharm(underlying, strike, time, sigma, optionSide, rate, qYield) : null;
          if (selectedMetric === 'gamma') {
            const gamma = providerGamma !== null ? providerGamma : sigma !== null ? bsmGamma(underlying, strike, time, sigma, rate, qYield) : null;
            if (gamma !== null) { value = gamma * oi * m * underlying * underlying * 0.01 * (optionSide === 'P' ? -1 : 1); cell.sources[providerGamma !== null ? 'providerGreek' : 'bsmDerivedGreek']++; }
          } else if (selectedMetric === 'delta') {
            let delta = providerDelta;
            if (delta === null && sigma !== null && typeof vol.bsmDelta === 'function') delta = vol.bsmDelta(underlying, strike, time, sigma, optionSide, rate, qYield);
            if (delta !== null) { value = delta * oi * m * underlying; cell.sources[providerDelta !== null ? 'providerGreek' : 'bsmDerivedGreek']++; }
          } else if (selectedMetric === 'vega') {
            const vega = toNum(q?.vega);
            if (vega !== null) { value = vega * oi * m; cell.sources.providerGreek++; }
          } else if (selectedMetric === 'theta') {
            const theta = toNum(q?.theta);
            if (theta !== null) { value = theta * oi * m; cell.sources.providerGreek++; }
          } else if (selectedMetric === 'vanna' && model) { value = model.vanna * oi * m * underlying * 0.01; cell.sources.bsmDerivedGreek++; }
          else if (selectedMetric === 'charm' && model) { value = model.charm / 365.25 * oi * m * underlying; cell.sources.bsmDerivedGreek++; }
        }
        if (Number.isFinite(value)) {
          cell.usableCount++;
          if (selectedMetric === 'iv') { if (!Array.isArray(cell._values)) cell._values = []; cell._values.push(value); }
          else cell.value = (cell.value ?? 0) + value;
        } else cell.skippedCount++;
      }
      for (const cell of cells) {
        if (selectedMetric === 'iv') cell.value = median(cell._values || []);
        delete cell._values;
        cell.coverage = cell.contractCount ? cell.usableCount / cell.contractCount : null;
        cell.strikeMin = cell.strikes.length ? Math.min(...cell.strikes) : null;
        cell.strikeMax = cell.strikes.length ? Math.max(...cell.strikes) : null;
      }
      const expected = Number(input?.expectedContracts);
      const loaded = Number(input?.loadedContracts ?? quotes.length);
      const complete = input?.complete === true || (input?.complete !== false && Number.isFinite(expected) && expected > 0 && loaded >= expected);
      const baseRow = { expiry, dte: time * 365.25, cells, expectedContracts: Number.isFinite(expected) ? expected : null, loadedContracts: loaded, complete, status: input?.status || (complete ? 'complete' : 'partial'), error: input?.error || '' };
      surfaceRows.push(baseRow);

      if (projectionSlices) {
        for (const slice of projectionSlices.slice(0, -1)) {
          const projectedCells = ['iv', 'volume', 'oi'].includes(selectedMetric)
            ? cells.map(cloneCell)
            : buildProjectedExposureCells({ quotes, spot: underlying, baseTime: time, sliceTime: slice.time, rate, dividendYield: qYield, symbol: key, bins: centers, metric: selectedMetric, side, vol });
          surfaceRows.push(projectionRow(baseRow, projectedCells, slice, projectionSlices.at(-1).dte, expiry));
        }
      }
    }
    if (projectionInfo) surfaceRows.sort((a, b) => a.dte - b.dte);
    return {
      spot: underlying, symbol: key, bins: centers, rows: surfaceRows, metric: selectedMetric, config,
      dividendYield: qYield, riskFreeRate: rate, loadedExpiries: preparedInputs.length,
      displayRows: surfaceRows.length, quoteCount: totalQuotes, side, projection: projectionInfo
    };
  }

  function buildGreeks({ spot, symbol = '', expiries = [], now = Date.now(), bins = DEFAULT_BINS, metric = 'delta', side = 'call' } = {}) {
    const underlying = toNum(spot), key = String(symbol || '').trim().toUpperCase();
    const vol = typeof globalThis !== 'undefined' ? globalThis.StockOptionsVolatility : null;
    const qYield = typeof vol?.dividendYieldForSymbol === 'function' ? vol.dividendYieldForSymbol(key) : (key === 'QQQ' ? 0.0045 : 0);
    const rate = 0, config = GREEK_METRICS[metric];
    const centers = (Array.isArray(bins) ? bins : DEFAULT_BINS).map(Number).filter(Number.isFinite);
    if (!(underlying > 0) || !config || !centers.length) return { spot: underlying, symbol: key, bins: centers, rows: [], metric, config: config || null, side, dividendYield: qYield, rate, projection: null };
    const preparedInputs = (Array.isArray(expiries) ? expiries : []).map(input => {
      const expiry = String(input?.expiry || ''), quotes = Array.isArray(input?.quotes) ? input.quotes : [];
      const time = typeof vol?.timeToExpiry === 'function' ? vol.timeToExpiry(expiry, now, key) : null;
      return { input, expiry, quotes, time };
    }).filter(item => item.time > 0);
    const isSingle0Dte = preparedInputs.length === 1 && preparedInputs[0].time * 365.25 <= 1.000001;
    const projectionSlices = isSingle0Dte ? buildIntradayTimeSlices(preparedInputs[0].time, 9) : null;
    const projectionInfo = projectionSlices ? {
      type: 'time-decay', method: 'BSM time-to-expiry repricing', baseExpiry: preparedInputs[0].expiry,
      baseDte: preparedInputs[0].time * 365.25, sliceCount: projectionSlices.length,
      assumptions: 'Spot and observed IV held constant; each Greek is recalculated with BSM as time-to-expiry decreases. Current provider Greeks are used only for the observed base slice.'
    } : null;

    const surfaceRows = []; let totalQuotes = 0;
    for (const prepared of preparedInputs) {
      const { input, expiry, quotes, time } = prepared;
      totalQuotes += quotes.length;
      const cells = centers.map(() => ({ value: null, contractCount: 0, usableCount: 0, skippedCount: 0, values: [], providerCount: 0, modelCount: 0, strikes: [] }));
      for (const q of quotes) {
        const strike = toNum(q?.strike), optionSide = q?.side === 'C' || q?.side === 'P' ? q.side : null;
        if (!(strike > 0) || !optionSide || !sideAllowed(optionSide, side)) continue;
        const binIndex = nearestBin((strike / underlying - 1) * 100, centers);
        if (binIndex < 0) continue;
        const cell = cells[binIndex]; cell.contractCount++;
        if (!cell.strikes.includes(strike)) cell.strikes.push(strike);
        const provider = {
          delta: normalizedDelta(q?.delta, optionSide), rho: null,
          gamma: (() => { const x = toNum(q?.gamma); return x !== null && x >= 0 ? x : null; })(),
          vega: toNum(q?.vega), theta: toNum(q?.theta)
        };
        let value = null, source = 'provider';
        if (metric === 'vanna' || metric === 'charm' || provider[metric] === null || provider[metric] === undefined) {
          const sigmaResult = typeof vol?.resolveQuoteIV === 'function' ? vol.resolveQuoteIV(q, underlying, time, rate, qYield) : { iv: null };
          const sigma = toNum(sigmaResult?.iv);
          if (sigma !== null && sigma > 0) {
            if (metric === 'vanna' || metric === 'charm') {
              const vc = typeof vol?.bsmVannaCharm === 'function' ? vol.bsmVannaCharm(underlying, strike, time, sigma, optionSide, rate, qYield) : null;
              if (vc) value = metric === 'vanna' ? vc.vanna * 0.01 : vc.charm / 365.25;
            } else {
              const model = bsmGreeks(underlying, strike, time, sigma, optionSide, rate, qYield);
              if (model) value = model[metric] ?? null;
            }
            source = 'model';
          }
        } else value = provider[metric];
        if (Number.isFinite(value)) { cell.values.push(value); cell.usableCount++; if (source === 'provider') cell.providerCount++; else cell.modelCount++; }
        else cell.skippedCount++;
      }
      for (const cell of cells) {
        cell.value = median(cell.values); delete cell.values;
        cell.coverage = cell.contractCount ? cell.usableCount / cell.contractCount : null;
        cell.strikes.sort((a, b) => a - b); cell.strikeMin = cell.strikes[0] ?? null; cell.strikeMax = cell.strikes.at(-1) ?? null;
      }
      const expected = Number(input?.expectedContracts), loaded = Number(input?.loadedContracts ?? quotes.length);
      const complete = input?.complete === true || (input?.complete !== false && Number.isFinite(expected) && expected > 0 && loaded >= expected);
      const baseRow = { expiry, dte: time * 365.25, cells, expectedContracts: Number.isFinite(expected) ? expected : null, loadedContracts: loaded, complete, status: input?.status || (complete ? 'complete' : 'partial'), error: input?.error || '' };
      surfaceRows.push(baseRow);

      if (projectionSlices) {
        for (const slice of projectionSlices.slice(0, -1)) {
          const projectedCells = buildProjectedGreekCells({ quotes, spot: underlying, baseTime: time, sliceTime: slice.time, rate, dividendYield: qYield, symbol: key, bins: centers, metric, side, vol: vol || {} });
          surfaceRows.push(projectionRow(baseRow, projectedCells, slice, projectionSlices.at(-1).dte, expiry));
        }
      }
    }
    if (projectionInfo) surfaceRows.sort((a, b) => a.dte - b.dte);
    return { spot: underlying, symbol: key, bins: centers, rows: surfaceRows, metric, config, side, dividendYield: qYield, riskFreeRate: rate, loadedExpiries: preparedInputs.length, displayRows: surfaceRows.length, quoteCount: totalQuotes, projection: projectionInfo };
  }

  return { DEFAULT_BINS, METRICS, GREEK_METRICS, build, buildGreeks, median, buildIntradayTimeSlices, dividendYieldForSymbol: symbol => String(symbol || '').toUpperCase() === 'QQQ' ? 0.0045 : 0 };
});
