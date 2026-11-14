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

  const DEFAULT_BINS = Object.freeze([-20, -15, -10, -5, 0, 5, 10, 15, 20]);
  const DAY_MS = 86400000;
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
    // 5%-wide buckets: do not drag a far-wing contract into an unrelated bucket.
    return gap <= 2.500001 ? best : -1;
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

  function build({ spot, symbol = '', expiries = [], now = Date.now(), bins = DEFAULT_BINS, metric = 'iv', side = 'both', exposureMetric = 'gamma' } = {}) {
    const underlying = toNum(spot);
    const key = String(symbol || '').trim().toUpperCase();
    const api = typeof globalThis !== 'undefined' ? globalThis.StockOptionsVolatility : null;
    const vol = api || {};
    const qYield = typeof vol.dividendYieldForSymbol === 'function' ? vol.dividendYieldForSymbol(key) : (key === 'QQQ' ? 0.0045 : 0);
    const rate = 0; // explicit fallback: no live risk-free curve is supplied by current feed.
    const selectedMetric = metric === 'exposure' ? exposureMetric : metric;
    const config = METRICS[selectedMetric] || METRICS.iv;
    const centers = (Array.isArray(bins) ? bins : DEFAULT_BINS).map(Number).filter(Number.isFinite);
    if (!(underlying > 0) || !centers.length || !METRICS[selectedMetric]) {
      return { spot: underlying, symbol: key, bins: centers, rows: [], metric: selectedMetric, config, dividendYield: qYield, rate, loadedExpiries: 0, quoteCount: 0 };
    }

    const surfaceRows = [];
    let totalQuotes = 0;
    for (const input of (Array.isArray(expiries) ? expiries : [])) {
      const expiry = String(input?.expiry || '');
      const quotes = Array.isArray(input?.quotes) ? input.quotes : [];
      const time = typeof vol.timeToExpiry === 'function' ? vol.timeToExpiry(expiry, now, key) : null;
      if (!(time > 0)) continue;
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
        // Resolve IV only when the selected surface metric actually needs it.
        // Volume/OI and provider Vega/Theta are quote aggregates and should not
        // spend time running a BSM inversion for every contract.
        const needsSigma = selectedMetric === 'iv' || selectedMetric === 'vanna' || selectedMetric === 'charm' ||
          (selectedMetric === 'gamma' && providerGamma === null) ||
          (selectedMetric === 'delta' && providerDelta === null);
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
        if (selectedMetric === 'iv') {
          value = sigma;
        } else if (selectedMetric === 'volume') {
          value = volume;
        } else if (selectedMetric === 'oi') {
          value = oi;
        } else if (oi !== null && oi > 0 && m !== null) {
          const model = (selectedMetric === 'vanna' || selectedMetric === 'charm') && sigma !== null && typeof vol.bsmVannaCharm === 'function'
            ? vol.bsmVannaCharm(underlying, strike, time, sigma, optionSide, rate, qYield)
            : null;
          if (selectedMetric === 'gamma') {
            const gamma = providerGamma !== null
              ? providerGamma
              : sigma !== null ? bsmGamma(underlying, strike, time, sigma, rate, qYield) : null;
            if (gamma !== null) {
              value = gamma * oi * m * underlying * underlying * 0.01 * (optionSide === 'P' ? -1 : 1);
              cell.sources[providerGamma !== null ? 'providerGreek' : 'bsmDerivedGreek']++;
            }
          } else if (selectedMetric === 'delta') {
            let delta = providerDelta;
            if (delta === null && sigma !== null && typeof vol.bsmDelta === 'function') delta = vol.bsmDelta(underlying, strike, time, sigma, optionSide, rate, qYield);
            if (delta !== null) {
              value = delta * oi * m * underlying;
              cell.sources[providerDelta !== null ? 'providerGreek' : 'bsmDerivedGreek']++;
            }
          } else if (selectedMetric === 'vega') {
            const vega = toNum(q?.vega);
            if (vega !== null) { value = vega * oi * m; cell.sources.providerGreek++; }
          } else if (selectedMetric === 'theta') {
            const theta = toNum(q?.theta);
            if (theta !== null) { value = theta * oi * m; cell.sources.providerGreek++; }
          } else if (selectedMetric === 'vanna' && model) {
            value = model.vanna * oi * m * underlying * 0.01; cell.sources.bsmDerivedGreek++;
          } else if (selectedMetric === 'charm' && model) {
            value = model.charm * oi * m * underlying / 365.25; cell.sources.bsmDerivedGreek++;
          }
        }
        if (Number.isFinite(value)) {
          cell.usableCount++;
          if (selectedMetric === 'iv') {
            if (!Array.isArray(cell._values)) cell._values = [];
            cell._values.push(value);
          } else {
            cell.value = (cell.value ?? 0) + value;
          }
        } else {
          cell.skippedCount++;
        }
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
      // An explicit partial/error flag must win even if counts happen to match;
      // e.g. invalid OCC symbols can make loaded==expected without a valid chain.
      const complete = input?.complete === true || (input?.complete !== false && Number.isFinite(expected) && expected > 0 && loaded >= expected);
      surfaceRows.push({ expiry, dte: time * 365.25, cells, expectedContracts: Number.isFinite(expected) ? expected : null, loadedContracts: loaded, complete, status: input?.status || (complete ? 'complete' : 'partial'), error: input?.error || '' });
    }
    return {
      spot: underlying, symbol: key, bins: centers, rows: surfaceRows, metric: selectedMetric, config,
      dividendYield: qYield, riskFreeRate: rate, loadedExpiries: surfaceRows.length,
      quoteCount: totalQuotes, side
    };
  }

  return { DEFAULT_BINS, METRICS, build, median, dividendYieldForSymbol: symbol => String(symbol || '').toUpperCase() === 'QQQ' ? 0.0045 : 0 };
});
