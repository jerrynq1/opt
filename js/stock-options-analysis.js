/* ================= OPTIONS MARKET INTELLIGENCE / ANALYSIS =================
   Separate interpretation layer for QQQ / GLD Options.
   IMPORTANT: This module does not change the core chain/GEX/DEX calculations.
   It consumes their outputs and treats received-contract null OI/Volume as zero
   exactly as the primary QuantLab engine does. Missing OCC quotes remain missing.
   All OI-signed exposures are convention-based proxies, never verified dealer positions.
*/
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.StockOptionsAnalysis = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const n = value => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const fmt = (value, digits = 2) => n(value) === null ? '—' : Number(value).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const compact = value => n(value) === null ? '—' : Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(Number(value));
  const pct = (value, digits = 2) => n(value) === null ? '—' : `${(Number(value) * 100).toFixed(digits)}%`;
  const volPts = value => n(value) === null ? '—' : `${Number(value) >= 0 ? '+' : ''}${(Number(value) * 100).toFixed(2)} vol pts`;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const distancePct = (level, spot) => spot > 0 && n(level) !== null ? (level / spot - 1) * 100 : null;
  const moneyDistance = (level, spot) => n(level) === null || n(spot) === null ? '—' : `${level >= spot ? '+' : '−'}${fmt(Math.abs(level - spot), 2)} (${Math.abs(distancePct(level, spot)).toFixed(2)}%)`;

  function multiplierOf(quote, symbol) {
    const explicit = n(quote?.multiplier);
    if (explicit !== null && explicit > 0) return explicit;
    const occ = String(quote?.optionSymbol || '').toUpperCase();
    const root = String(symbol || '').toUpperCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return root && new RegExp(`^${root}\\d{6}[CP]\\d{8}$`).test(occ) ? 100 : null;
  }

  function bsmGamma(spot, strike, time, sigma, rate = 0, dividendYield = 0) {
    if (!(spot > 0 && strike > 0 && time > 0 && sigma > 0) || !Number.isFinite(rate) || !Number.isFinite(dividendYield)) return null;
    const rootTime = Math.sqrt(time);
    const d1 = (Math.log(spot / strike) + (rate - dividendYield + 0.5 * sigma * sigma) * time) / (sigma * rootTime);
    const value = Math.exp(-dividendYield * time) * Math.exp(-0.5 * d1 * d1) / (spot * sigma * rootTime * Math.sqrt(2 * Math.PI));
    return Number.isFinite(value) ? value : null;
  }

  function simulateGex(rows, { symbol, spot, now, expiry: fallbackExpiry, spotShock = 0, volShock = 0, volatilityApi } = {}) {
    const stressedSpot = spot * (1 + spotShock);
    const dividendYield = volatilityApi?.dividendYieldForSymbol?.(symbol) ?? (/^QQQ$/i.test(symbol) ? 0.0045 : 0);
    let call = 0, putAbs = 0, dex = 0, vanna = 0, charm = 0;
    let usable = 0, required = 0, zeroOi = 0, missingInputs = 0;
    for (const quote of Array.isArray(rows) ? rows : []) {
      const side = quote?.side === 'C' || quote?.side === 'P' ? quote.side : null;
      const strike = n(quote?.strike);
      const rawOi = n(quote?.openInterest);
      // Keep the same assumption as the core: a received contract with null OI contributes zero.
      const oi = rawOi !== null && rawOi >= 0 ? rawOi : 0;
      if (!side || !(strike > 0)) { missingInputs++; continue; }
      if (!(oi > 0)) { zeroOi++; continue; }
      required++;
      const multiplier = multiplierOf(quote, symbol);
      if (!(multiplier > 0)) { missingInputs++; continue; }
      const expiryValue = quote?._expiry || fallbackExpiry || (typeof quote?.expiration === 'string' && /^\d{4}-\d{2}-\d{2}/.test(quote.expiration) ? quote.expiration : '');
      const time = volatilityApi?.timeToExpiry?.(expiryValue, now, symbol) ?? null;
      if (!(time > 0)) { missingInputs++; continue; }
      let sigma = volatilityApi?.ivSigma?.(quote?.iv) ?? null;
      if (sigma === null && volatilityApi?.resolveQuoteIV) {
        const resolved = volatilityApi.resolveQuoteIV(quote, spot, time, 0, dividendYield);
        sigma = n(resolved?.iv);
      }
      if (!(sigma > 0)) { missingInputs++; continue; }
      sigma = Math.max(0.0001, sigma + volShock);
      const gamma = bsmGamma(stressedSpot, strike, time, sigma, 0, dividendYield);
      const model = volatilityApi?.bsmVannaCharm?.(stressedSpot, strike, time, sigma, side, 0, dividendYield) ?? null;
      const delta = model?.delta ?? volatilityApi?.bsmDelta?.(stressedSpot, strike, time, sigma, side, 0, dividendYield) ?? null;
      if (gamma === null || !Number.isFinite(delta)) { missingInputs++; continue; }
      const contribution = gamma * oi * multiplier * stressedSpot * stressedSpot * 0.01;
      if (side === 'C') call += contribution;
      else putAbs += contribution;
      dex += delta * oi * multiplier * stressedSpot;
      if (model && Number.isFinite(model.vanna)) vanna += model.vanna * oi * multiplier * stressedSpot * 0.01;
      if (model && Number.isFinite(model.charm)) charm += model.charm * oi * multiplier * stressedSpot / 365.25;
      usable++;
    }
    const gross = call + putAbs;
    return {
      spot: stressedSpot,
      callGex: call,
      putGexAbs: putAbs,
      netGex: call - putAbs,
      grossGex: gross,
      netToGrossPct: gross > 0 ? (call - putAbs) / gross * 100 : null,
      dex,
      vannaPerVolPoint: vanna,
      charmPerCalendarDay: charm,
      usableContracts: usable,
      requiredContracts: required,
      coverage: required > 0 ? usable / required : null,
      missingInputs,
      zeroOi,
      method: 'BSM Delta/Gamma/Vanna/Charm × received-contract OI × multiplier; Call+/Put− only for type-signed GEX; OI, expiry and baseline IV held fixed except explicit shocks'
    };
  }

  function buildStressGrid(input) {
    const rows = input?.calc?.rows || [];
    const spot = n(input?.spot);
    if (!(spot > 0) || !rows.length) return { rows: [], coverage: null, note: 'Cần Spot và option quotes đã nhận để mô phỏng.' };
    const volatilityApi = input.volatilityApi || (typeof globalThis !== 'undefined' ? globalThis.StockOptionsVolatility : null);
    const now = n(input.now) ?? Date.now();
    const shocks = [-0.01, 0, 0.01];
    const volShocks = [-0.01, 0, 0.01];
    const grid = [];
    let weightedCoverage = 0, totalRequired = 0;
    for (const volShock of volShocks) {
      for (const spotShock of shocks) {
        const sim = simulateGex(rows, { symbol: input.symbol, spot, now, expiry: input.expiry, spotShock, volShock, volatilityApi });
        if (sim.requiredContracts > 0 && sim.coverage !== null) {
          weightedCoverage += sim.coverage * sim.requiredContracts;
          totalRequired += sim.requiredContracts;
        }
        grid.push({ spotShock, volShock, ...sim });
      }
    }
    return {
      rows: grid,
      coverage: totalRequired ? weightedCoverage / totalRequired : null,
      note: 'BSM stress grid; mỗi ô repricing Gamma từ Spot/IV giả định, giữ OI và thời gian còn lại cố định. Đây không phải forecast hay dealer hedge estimate.'
    };
  }

  function collectLevels(calc, spot) {
    const raw = [];
    const add = (label, value, source, detail = '') => {
      const level = n(value);
      if (level === null || !(level > 0)) return;
      raw.push({ label, level, source, detail, side: level > spot ? 'above' : level < spot ? 'below' : 'at' });
    };
    add('Call OI Wall', calc?.callOIWall?.strike, 'OI', `Call OI ${compact(calc?.callOIWall?.callOI)}`);
    add('Put OI Wall', calc?.putOIWall?.strike, 'OI', `Put OI ${compact(calc?.putOIWall?.putOI)}`);
    add('GEX Call Wall', calc?.gexCallWall?.strike, 'GEX', `Net +GEX ${compact(calc?.gexCallWall?.gex)}`);
    add('GEX Put Wall', calc?.gexPutWall?.strike, 'GEX', `Net −GEX ${compact(Math.abs(calc?.gexPutWall?.gex || 0))}`);
    add('Gamma Flip', calc?.gammaFlip, 'Model', 'BSM repriced zero-cross');
    add('Max Pain', calc?.maxPain?.strike, 'OI model', 'Per-expiry payout minimum');
    for (const item of (calc?.gexLevels || []).slice(0, 10)) add(`GEX #${item.rank}`, item.strike, 'GEX ladder', `Net GEX ${item.gex >= 0 ? '+' : '−'}${compact(Math.abs(item.gex))}`);
    raw.sort((a, b) => a.level - b.level);
    const deduped = [];
    const tolerance = Math.max(0.0001, spot * 0.00001);
    for (const row of raw) {
      const existing = deduped.find(item => Math.abs(item.level - row.level) <= tolerance);
      if (existing) {
        existing.sources.push(row.label);
        existing.details.push(row.detail);
      } else deduped.push({ level: row.level, side: row.side, sources: [row.label], details: row.detail ? [row.detail] : [] });
    }
    return deduped;
  }

  function buildConfluence(levels, spot, strikeRows = []) {
    if (!levels.length) return [];
    const strikes = [...new Set(strikeRows.map(x => n(x?.strike)).filter(value => value !== null && value > 0))].sort((a, b) => a - b);
    const gaps = strikes.slice(1).map((value, i) => value - strikes[i]).filter(value => value > 0);
    const sortedGaps = gaps.slice().sort((a, b) => a - b);
    const medianGap = sortedGaps.length ? sortedGaps[Math.floor(sortedGaps.length / 2)] : 0;
    const threshold = Math.max(spot * 0.0025, medianGap * 1.25, 0.01);
    const clusters = [];
    for (const level of levels.slice().sort((a, b) => a.level - b.level)) {
      let cluster = clusters[clusters.length - 1];
      if (!cluster || level.level - cluster.maxLevel > threshold) {
        cluster = { minLevel: level.level, maxLevel: level.level, levels: [], sources: [] };
        clusters.push(cluster);
      }
      cluster.levels.push(level);
      cluster.maxLevel = level.level;
      cluster.sources.push(...level.sources);
    }
    return clusters.map(cluster => {
      const uniqueSources = [...new Set(cluster.sources)];
      const midpoint = (cluster.minLevel + cluster.maxLevel) / 2;
      return {
        ...cluster,
        midpoint,
        uniqueSources,
        confluenceCount: uniqueSources.length,
        side: midpoint > spot ? 'above' : midpoint < spot ? 'below' : 'at',
        distancePct: distancePct(midpoint, spot),
        threshold,
        strength: uniqueSources.length >= 3 ? 'multi-source' : uniqueSources.length === 2 ? 'two-source' : 'single-source'
      };
    }).sort((a, b) => b.confluenceCount - a.confluenceCount || Math.abs(a.distancePct ?? 999) - Math.abs(b.distancePct ?? 999));
  }

  function analyse(input = {}) {
    const calc = input.calc || {};
    const symbol = String(input.symbol || '').toUpperCase();
    const spot = n(input.spot);
    const now = n(input.now) ?? Date.now();
    const volatilityRows = Array.isArray(input.volatility?.expiries) ? input.volatility.expiries : [];
    const selectedVol = volatilityRows.find(row => row.expiry === input.expiry) || (input.scope === 'selected' ? volatilityRows[0] : null);
    const volatilityApi = input.volatilityApi || (typeof globalThis !== 'undefined' ? globalThis.StockOptionsVolatility : null);
    const complete = calc.complete === true;
    const gexComplete = calc.gexComplete === true;
    const rows = Array.isArray(calc.rows) ? calc.rows : [];
    const dist = Array.isArray(calc.dist) ? calc.dist : [];
    const change = spot !== null && n(input.previousClose) > 0 ? spot - Number(input.previousClose) : null;
    const changePct = change !== null ? change / Number(input.previousClose) : null;
    const callOi = n(calc.callOI) ?? 0, putOi = n(calc.putOI) ?? 0;
    const totalOi = callOi + putOi;
    const oiRatio = putOi > 0 ? callOi / putOi : callOi > 0 ? Infinity : null;
    const callVolume = n(calc.callVol) ?? 0, putVolume = n(calc.putVol) ?? 0;
    const totalVolume = callVolume + putVolume;
    const callVolOi = callOi > 0 ? callVolume / callOi : null;
    const putVolOi = putOi > 0 ? putVolume / putOi : null;
    const positiveOiRows = rows.filter(row => (n(row?.openInterest) ?? 0) > 0);
    const providerVegaRows = positiveOiRows.filter(row => n(row?.vega) !== null);
    const providerThetaRows = positiveOiRows.filter(row => n(row?.theta) !== null);
    const greekExposure = {
      deltaNotional: n(calc.delta),
      typeSignedGex: n(calc.gamma),
      providerVegaOiWeighted: n(calc.vega),
      providerThetaOiWeighted: n(calc.theta),
      vannaPerVolPoint: n(calc.vannaExposure),
      charmPerCalendarDay: n(calc.charmExposure),
      vannaCoverage: n(calc.vannaCoverage),
      charmCoverage: n(calc.charmCoverage),
      providerVegaCoverage: positiveOiRows.length ? providerVegaRows.length / positiveOiRows.length : null,
      providerThetaCoverage: positiveOiRows.length ? providerThetaRows.length / positiveOiRows.length : null,
      positiveOiContracts: positiveOiRows.length
    };
    const callGex = n(calc.callGexTotal);
    const putGexAbs = n(calc.putGexAbsTotal);
    const grossGex = callGex !== null && putGexAbs !== null ? callGex + putGexAbs : null;
    const netGex = n(calc.gamma);
    const netGrossPct = grossGex > 0 && netGex !== null ? netGex / grossGex * 100 : null;
    const gammaFlip = n(calc.gammaFlip);
    const gammaFlipDistance = gammaFlip !== null && spot !== null ? distancePct(gammaFlip, spot) : null;
    const grossCallDominance = grossGex > 0 && callGex !== null ? callGex / grossGex : null;
    const putCallGexRatio = n(calc.gexRatio);

    let regime = { label: 'Chưa đủ dữ liệu', tone: 'muted', explanation: 'Cần Spot và GEX để phân loại cấu trúc exposure.' };
    if (spot > 0 && netGex !== null && grossGex > 0) {
      const netShare = Math.abs(netGrossPct ?? 0);
      const provisional = !gexComplete;
      if (netShare < 5) regime = { label: `${provisional ? 'Provisional · ' : ''}Type-signed GEX cân bằng`, tone: 'neutral', explanation: `Net GEX chỉ bằng ${netShare.toFixed(1)}% Gross GEX. Theo sign convention Call+/Put−, hai phía exposure tương đối cân bằng; không suy ra dealer gamma.` };
      else if (netGex > 0) regime = { label: `${provisional ? 'Provisional · ' : ''}Type-signed GEX dương`, tone: 'positive', explanation: `Call-positive GEX lớn hơn Put-negative GEX; Net/Gross = +${netGrossPct.toFixed(1)}%. Đây là cấu trúc OI-weighted theo quy ước, không chứng minh dealer Long Gamma hay hedging làm dịu giá.` };
      else regime = { label: `${provisional ? 'Provisional · ' : ''}Type-signed GEX âm`, tone: 'negative', explanation: `Put-negative GEX lớn hơn Call-positive GEX; Net/Gross = ${netGrossPct.toFixed(1)}%. Đây là cấu trúc OI-weighted theo quy ước, không chứng minh dealer Short Gamma hay hedging khuếch đại giá.` };
    }

    const levels = spot > 0 ? collectLevels(calc, spot) : [];
    const clusters = spot > 0 ? buildConfluence(levels, spot, dist) : [];
    const above = clusters.filter(x => x.midpoint > spot).sort((a, b) => a.midpoint - b.midpoint);
    const below = clusters.filter(x => x.midpoint < spot).sort((a, b) => b.midpoint - a.midpoint);
    const supports = below.slice(0, 4);
    const resistances = above.slice(0, 4);
    const nearestBelow = below[0] || null, nextBelow = below[1] || null;
    const nearestAbove = above[0] || null, nextAbove = above[1] || null;

    const termPoints = volatilityRows.filter(row => row && row.chainComplete !== false && row.atmSideCount === 2 && n(row.atmIV) > 0 && n(row.dte) > 0).sort((a, b) => a.dte - b.dte);
    let termStructure = { label: 'Chưa đủ expiry', tone: 'muted', explanation: 'Cần ít nhất hai expiry có ATM IV hai phía và chain hoàn chỉnh.' };
    if (termPoints.length >= 2) {
      const front = termPoints[0], back = termPoints[termPoints.length - 1];
      const diff = back.atmIV - front.atmIV;
      if (Math.abs(diff) < 0.01) termStructure = { label: 'Gần phẳng', tone: 'neutral', explanation: `ATM IV front ${pct(front.atmIV)} và back ${pct(back.atmIV)} chênh ${volPts(diff)}; term structure gần phẳng theo ngưỡng 1 vol point của module.` };
      else if (diff > 0) termStructure = { label: 'Dốc lên (front IV thấp hơn back)', tone: 'positive', explanation: `ATM IV tăng từ ${pct(front.atmIV)} tại ${front.expiry} lên ${pct(back.atmIV)} tại ${back.expiry}. Đây là term structure snapshot, không tự chỉ ra hướng giá.` };
      else termStructure = { label: 'Đảo ngược (front IV cao hơn back)', tone: 'warning', explanation: `ATM IV front ${pct(front.atmIV)} cao hơn back ${pct(back.atmIV)} (${volPts(-diff)}). Có front-end volatility premium; cần event/calendar context để xác định nguyên nhân.` };
    }

    const expectedMove = n(selectedVol?.expectedMove);
    const expectedMovePct = n(selectedVol?.expectedMovePct);
    const expectedLow = spot !== null && expectedMove !== null ? spot - expectedMove : null;
    const expectedHigh = spot !== null && expectedMove !== null ? spot + expectedMove : null;
    const rangePosition = expectedLow !== null && expectedHigh !== null ? (spot >= expectedLow && spot <= expectedHigh ? 'Spot nằm trong dải 1σ tham chiếu.' : spot > expectedHigh ? 'Spot nằm trên dải 1σ tham chiếu.' : 'Spot nằm dưới dải 1σ tham chiếu.') : 'Chưa đủ ATM IV / DTE để tính dải 1σ.';

    const distByOiCall = dist.filter(row => n(row.callOI) > 0).slice().sort((a, b) => b.callOI - a.callOI).slice(0, 5);
    const distByOiPut = dist.filter(row => n(row.putOI) > 0).slice().sort((a, b) => b.putOI - a.putOI).slice(0, 5);
    const distByGex = dist.filter(row => n(row.gex) !== null && Math.abs(row.gex) > 0).slice().sort((a, b) => Math.abs(b.gex) - Math.abs(a.gex)).slice(0, 5);

    const priceAge = n(input.priceAgeMs);
    const marketClosed = String(input.marketPhase || '').toUpperCase() === 'C' || String(input.priceFeedState || '') === 'closed';
    const priceStale = !marketClosed && priceAge !== null && priceAge > 300000;
    const missingQuotes = Array.isArray(calc.missingQuoteSymbols) ? calc.missingQuoteSymbols.length : Math.max(0, (n(calc.totalContracts) || 0) - rows.length);
    const ivCoverage = n(selectedVol?.ivCoverage);
    const qualityItems = [
      { label: 'OCC chain', value: complete ? 'Complete' : `Partial · ${rows.length}/${calc.totalContracts || '—'} received`, tone: complete ? 'good' : 'warn' },
      { label: 'GEX inputs', value: gexComplete ? `Complete · ${pct(calc.gexCoverage)}` : `Provisional · ${pct(calc.gexCoverage)}`, tone: gexComplete ? 'good' : 'warn' },
      { label: 'ATM IV', value: selectedVol?.atmSideCount === 2 ? `${pct(selectedVol.atmIV)} · two-sided` : selectedVol?.atmSideCount === 1 ? `${pct(selectedVol.atmIV)} · one-sided` : 'Unavailable', tone: selectedVol?.atmSideCount === 2 ? 'good' : 'warn' },
      { label: 'Spot', value: spot === null ? 'Unavailable' : `${marketClosed ? 'Last market price' : priceStale ? 'Stale' : 'Available'} · age ${priceAge === null ? 'unknown' : `${Math.floor(priceAge / 1000)}s`}`, tone: spot === null || priceStale ? 'warn' : 'good' },
      { label: 'OI/Volume null policy', value: `${calc.oiAssumedZero || 0} OI null→0 · ${calc.volumeAssumedZero || 0} Volume null→0`, tone: 'neutral' },
      { label: 'Unreceived OCC quotes', value: String(missingQuotes), tone: missingQuotes ? 'warn' : 'good' }
    ];
    const majorWarnings = [];
    if (!complete) majorWarnings.push('Option Chain chưa đủ OCC quotes; level tổng hợp có thể thiếu contract chưa nhận được.');
    if (!gexComplete) majorWarnings.push('GEX chưa hoàn chỉnh; Gamma Flip và các vùng GEX phải được xem là provisional hoặc unavailable.');
    if (selectedVol && selectedVol.atmSideCount !== 2) majorWarnings.push('ATM IV chưa được bracket đủ Call + Put quanh Forward; không dùng IV một phía như ATM hai phía.');
    if (priceStale) majorWarnings.push('Spot feed cũ hơn 5 phút trong trạng thái thị trường không đóng; cần thận trọng với khoảng cách level.');
    if (marketClosed) majorWarnings.push('Thị trường underlying đang đóng; Spot là giá cuối khả dụng, không phải live tick.');
    if ((calc.multiplierMissing || 0) > 0) majorWarnings.push(`${calc.multiplierMissing} contract OI dương thiếu multiplier; các exposure liên quan có thể thiếu.`);
    if ((calc.ivMissing || 0) > 0) majorWarnings.push(`${calc.ivMissing} contract cần IV nhưng chưa có IV hợp lệ.`);
    if (greekExposure.vannaCoverage !== null && greekExposure.vannaCoverage < 1) majorWarnings.push(`Vanna model coverage ${pct(greekExposure.vannaCoverage)}; Vanna/Charm exposure không bao phủ toàn bộ contract OI dương.`);
    if (greekExposure.charmCoverage !== null && greekExposure.charmCoverage < 1) majorWarnings.push(`Charm model coverage ${pct(greekExposure.charmCoverage)}; không diễn giải tổng exposure như full-chain.`);

    const scenarios = {
      base: {
        title: 'BASE / RANGE', tone: 'neutral', trigger: nearestBelow && nearestAbove ? `Spot giữ giữa ${fmt(nearestBelow.midpoint)} và ${fmt(nearestAbove.midpoint)}.` : 'Chờ hai vùng cấu trúc gần Spot được xác định.',
        confirmation: 'Range chỉ được xác nhận khi giá tiếp tục giao dịch bên trong vùng; cần price history/intraday bars để kiểm tra acceptance và thời gian ở trong range.',
        targets: [nearestBelow ? `Dưới: ${fmt(nearestBelow.midpoint)}` : null, nearestAbove ? `Trên: ${fmt(nearestAbove.midpoint)}` : null].filter(Boolean),
        invalidation: 'Giá acceptance bên ngoài một trong hai vùng biên; cần xác nhận bằng dữ liệu giá intraday.'
      },
      upside: {
        title: 'UPSIDE', tone: 'positive', trigger: nearestAbove ? `Vượt và giữ trên vùng ${fmt(nearestAbove.minLevel)}–${fmt(nearestAbove.maxLevel)} (${nearestAbove.uniqueSources.join(', ')}).` : 'Chưa có key level phía trên Spot trong dữ liệu đang tải.',
        confirmation: 'Acceptance trên vùng trigger và retest giữ được phía trên; hiện tại engine không tự tuyên bố breakout đã xảy ra nếu chưa có chuỗi giá intraday.',
        targets: [nextAbove ? fmt(nextAbove.midpoint) : null, expectedHigh !== null ? `Upper 1σ tham chiếu ${fmt(expectedHigh)}` : null].filter(Boolean),
        invalidation: nearestBelow ? `Quay lại và acceptance dưới ${fmt(nearestBelow.midpoint)} sẽ làm suy yếu kịch bản reclaim.` : 'Cần vùng hỗ trợ dưới Spot để xác lập invalidation.'
      },
      downside: {
        title: 'DOWNSIDE', tone: 'negative', trigger: nearestBelow ? `Mất và duy trì dưới vùng ${fmt(nearestBelow.minLevel)}–${fmt(nearestBelow.maxLevel)} (${nearestBelow.uniqueSources.join(', ')}).` : 'Chưa có key level phía dưới Spot trong dữ liệu đang tải.',
        confirmation: 'Acceptance dưới vùng trigger và retest thất bại từ phía dưới; hiện tại engine không tự tuyên bố breakdown nếu chưa có chuỗi giá intraday.',
        targets: [nextBelow ? fmt(nextBelow.midpoint) : null, expectedLow !== null ? `Lower 1σ tham chiếu ${fmt(expectedLow)}` : null].filter(Boolean),
        invalidation: nearestAbove ? `Reclaim và acceptance trên ${fmt(nearestAbove.midpoint)} sẽ làm suy yếu kịch bản breakdown.` : 'Cần vùng kháng cự trên Spot để xác lập invalidation.'
      }
    };

    const expiryParts = Array.isArray(calc.scopeInfo?.parts)
      ? calc.scopeInfo.parts.filter(row => row && row.contracts > 0).slice().sort((a, b) => (b.gross || 0) - (a.gross || 0))
      : input.expiry ? [{ expiry: input.expiry, dte: selectedVol?.dte ?? null, contracts: calc.totalContracts || rows.length,
          quotes: rows.length, complete: calc.complete, gexComplete: calc.gexComplete, netGex: calc.gamma,
          gross: grossGex, share: grossGex > 0 ? 1 : null, status: calc.gexComplete ? 'selected-expiry' : 'selected-expiry · provisional' }] : [];
    const constantMaturity = Array.isArray(input.volatility?.constantMaturity) ? input.volatility.constantMaturity : [];
    const stress = buildStressGrid({ ...input, calc, spot, now, volatilityApi });
    const biasNotes = [];
    if (changePct !== null) biasNotes.push(`Spot ${change >= 0 ? 'tăng' : 'giảm'} ${pct(Math.abs(changePct))} so với previous close`);
    if (gammaFlip !== null) biasNotes.push(`Spot ${spot >= gammaFlip ? 'trên' : 'dưới'} Gamma Flip ${fmt(gammaFlip)} (${moneyDistance(gammaFlip, spot)})`);
    if (netGex !== null && grossGex > 0) biasNotes.push(`Type-signed Net/Gross GEX ${netGrossPct >= 0 ? '+' : ''}${netGrossPct.toFixed(1)}%`);
    if (selectedVol?.atmIV != null) biasNotes.push(`ATM IV ${pct(selectedVol.atmIV)}${selectedVol.atmSideCount === 2 ? ' hai phía' : ' một phía'}`);
    if (selectedVol?.rr25 != null) biasNotes.push(`RR25 ${volPts(selectedVol.rr25)}`);
    const brief = spot === null || !rows.length
      ? 'Đang chờ underlying Spot và Option Chain để tạo Market Read. Engine không tự điền level hoặc tạo kịch bản khi chưa có dữ liệu.'
      : `${symbol}: ${biasNotes.join('; ') || 'dữ liệu cấu trúc đang được tải'}. ${regime.explanation} ${marketClosed ? 'Giá tham chiếu là last available price vì thị trường đóng.' : ''}`;

    const reportLines = [
      `ICT QUANTLAB · ${symbol} OPTIONS MARKET INTELLIGENCE`,
      `Generated: ${new Date(now).toISOString()} · Scope: ${input.scopeLabel || input.scope || 'Selected Expiry'} · Expiry: ${input.expiry || '—'}`,
      `BSM assumptions: r=0%; QQQ q=0.45%; GLD q=0% (approximate continuous dividend yields; no live curve).`,
      `Spot: ${fmt(spot)} · Previous close: ${fmt(input.previousClose)} · Change: ${change === null ? '—' : `${change >= 0 ? '+' : ''}${fmt(change)} (${pct(changePct)})`}`,
      `REGIME: ${regime.label} — ${regime.explanation}`,
      `GEX: Call ${compact(callGex)} · Put abs ${compact(putGexAbs)} · Net ${compact(netGex)} · Gross ${compact(grossGex)} · Net/Gross ${netGrossPct === null ? '—' : `${netGrossPct.toFixed(1)}%`} · Ratio ${putCallGexRatio === null ? '—' : putCallGexRatio === Infinity ? '∞' : `${putCallGexRatio.toFixed(2)}x`}`,
      `OI-weighted sensitivities (not dealer inventory): DEX ${compact(greekExposure.deltaNotional)} · Type-signed GEX ${compact(greekExposure.typeSignedGex)} · Vanna ${compact(greekExposure.vannaPerVolPoint)} USD Delta-notional / +1 vol pt · Charm ${compact(greekExposure.charmPerCalendarDay)} USD Delta-notional / calendar day`,
      `Provider Vega × OI × multiplier ${compact(greekExposure.providerVegaOiWeighted)} · coverage ${pct(greekExposure.providerVegaCoverage)} (provider unit not normalized); Provider Theta × OI × multiplier ${compact(greekExposure.providerThetaOiWeighted)} · coverage ${pct(greekExposure.providerThetaCoverage)} (provider unit not normalized)`,
      `Gamma Flip: ${fmt(gammaFlip)} · ${gammaFlipDistance === null ? '—' : `${gammaFlipDistance >= 0 ? '+' : ''}${gammaFlipDistance.toFixed(2)}% vs Spot`}`,
      `OI: Call ${compact(callOi)} · Put ${compact(putOi)} · Put/Call ${oiRatio === null ? '—' : oiRatio === Infinity ? '∞' : (1 / oiRatio).toFixed(2)} · Volume: Call ${compact(callVolume)} / Put ${compact(putVolume)}`,
      `Volatility: ATM ${pct(selectedVol?.atmIV)} · RR25 ${volPts(selectedVol?.rr25)} · BF25 ${volPts(selectedVol?.bf25)} · Expected Move ${expectedMove === null ? '—' : `±${fmt(expectedMove)} (${pct(expectedMovePct)})`}`,
      `Term structure: ${termStructure.label} — ${termStructure.explanation}`,
      `Constant maturity IV: ${constantMaturity.map(row => `${row.days}D ${pct(row.iv)} (${row.status})`).join(' · ') || 'unavailable'}`,
      `Call OI Wall ${fmt(calc.callOIWall?.strike)} · Put OI Wall ${fmt(calc.putOIWall?.strike)} · GEX CW ${fmt(calc.gexCallWall?.strike)} · GEX PW ${fmt(calc.gexPutWall?.strike)} · Max Pain ${fmt(calc.maxPain?.strike)}`,
      'CONFLUENCE:', ...clusters.slice(0, 6).map(x => `- ${fmt(x.minLevel)}–${fmt(x.maxLevel)} · ${x.uniqueSources.join(', ')} · ${x.confluenceCount} sources`),
      'SCENARIOS:',
      ...Object.values(scenarios).flatMap(x => [`${x.title}: ${x.trigger}`, `  Confirmation: ${x.confirmation}`, `  Targets: ${x.targets.join(' → ') || '—'}`, `  Invalidation: ${x.invalidation}`]),
      `DATA QUALITY: chain ${complete ? 'complete' : 'partial'} · OI observed ${pct(calc.coverage)} · OI analytics incl. null→0 ${pct(calc.oiAnalyticsCoverage)} · GEX ${gexComplete ? 'complete' : 'provisional'} (${pct(calc.gexCoverage)}) · IV ${pct(ivCoverage)} · received-contract null OI ${calc.oiAssumedZero || 0} treated as zero by existing QuantLab policy · unreceived quotes ${missingQuotes}`,
      'Method: observed data, model-derived values and conditional interpretations are kept separate. OI-weighted GEX/DEX is not verified dealer positioning. Scenarios require price acceptance/retest not inferred from an option-chain snapshot.',
      'Research/education only; not an execution signal or investment recommendation.'
    ];

    return {
      symbol, now, spot, change, changePct, marketClosed, priceStale,
      scope: input.scope || 'selected', scopeLabel: input.scopeLabel || input.scope || 'Selected Expiry', expiry: input.expiry,
      regime, brief, callOi, putOi, totalOi, oiRatio, callVolume, putVolume, totalVolume, callVolOi, putVolOi,
      callGex, putGexAbs, grossGex, netGex, netGrossPct, grossCallDominance, putCallGexRatio,
      gammaFlip, gammaFlipDistance, expectedMove, expectedMovePct, expectedLow, expectedHigh, rangePosition,
      selectedVol, termStructure, termPoints, constantMaturity, greekExposure, levels, clusters, supports, resistances, scenarios,
      distByOiCall, distByOiPut, distByGex, expiryParts, stress,
      qualityItems, majorWarnings, complete, gexComplete, missingQuotes,
      oiAssumedZero: calc.oiAssumedZero || 0, volumeAssumedZero: calc.volumeAssumedZero || 0,
      report: reportLines.join('\n')
    };
  }

  function levelList(rows, spot) {
    if (!rows.length) return '<div class="so-ai-empty">Chưa có key level hợp lệ trong dữ liệu hiện tại.</div>';
    return `<div class="so-ai-level-list">${rows.map(cluster => `<div class="so-ai-level-row"><div><b>${fmt(cluster.minLevel)}${Math.abs(cluster.maxLevel - cluster.minLevel) > 0.001 ? ` – ${fmt(cluster.maxLevel)}` : ''}</b><small>${esc(cluster.uniqueSources.join(' · '))}</small></div><span class="so-ai-confluence">${cluster.confluenceCount} source</span><em>${cluster.midpoint >= spot ? '+' : '−'}${Math.abs(cluster.distancePct || 0).toFixed(2)}%</em></div>`).join('')}</div>`;
  }

  function render(result) {
    if (!result) return '<div class="so-ai-empty">Analysis unavailable.</div>';
    const r = result;
    const kpi = (label, value, hint, tone = '') => `<article class="so-ai-kpi"><span>${label}</span><b class="${tone}">${value}</b><small>${hint}</small></article>`;
    const tag = (label, tone = 'muted') => `<span class="so-ai-tag is-${tone}">${label}</span>`;
    const scenarioCard = (scenario) => `<article class="so-ai-scenario is-${scenario.tone}"><div class="so-ai-scenario-head"><b>${scenario.title}</b>${tag(scenario.tone === 'positive' ? 'CONDITIONAL UPSIDE' : scenario.tone === 'negative' ? 'CONDITIONAL DOWNSIDE' : 'NEUTRAL', scenario.tone)}</div><p><strong>Trigger:</strong> ${esc(scenario.trigger)}</p><p><strong>Confirmation:</strong> ${esc(scenario.confirmation)}</p><p><strong>Targets:</strong> ${esc(scenario.targets.join(' → ') || 'Chưa có target dữ liệu')}</p><p><strong>Invalidation:</strong> ${esc(scenario.invalidation)}</p></article>`;
    const oiTable = (rows, field) => rows.length ? `<div class="so-ai-table-wrap"><table class="so-ai-table"><thead><tr><th>Strike</th><th>OI</th><th>Spot distance</th></tr></thead><tbody>${rows.map(row => `<tr><td>${fmt(row.strike)}</td><td>${compact(row[field])}</td><td>${moneyDistance(row.strike, r.spot)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="so-ai-empty">Không có OI dương trong snapshot hiện tại.</div>';
    const gexTable = rows => rows.length ? `<div class="so-ai-table-wrap"><table class="so-ai-table"><thead><tr><th>Strike</th><th>Net GEX</th><th>Distance</th></tr></thead><tbody>${rows.map(row => `<tr><td>${fmt(row.strike)}</td><td class="${row.gex >= 0 ? 'is-positive' : 'is-negative'}">${row.gex >= 0 ? '+' : '−'}${compact(Math.abs(row.gex))}</td><td>${moneyDistance(row.strike, r.spot)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="so-ai-empty">Chưa có GEX strike hợp lệ.</div>';
    const stressTable = r.stress.rows.length ? `<div class="so-ai-table-wrap"><table class="so-ai-table so-ai-stress-table"><thead><tr><th>Spot shock</th><th>IV shock</th><th>Scenario Spot</th><th>Net GEX</th><th>DEX</th><th>Vanna / +1 vol pt</th><th>Charm / day</th><th>Coverage</th></tr></thead><tbody>${r.stress.rows.map(row => `<tr class="${row.spotShock === 0 && row.volShock === 0 ? 'is-current' : ''}"><td>${row.spotShock > 0 ? '+' : ''}${(row.spotShock * 100).toFixed(1)}%</td><td>${row.volShock > 0 ? '+' : ''}${(row.volShock * 100).toFixed(1)} vol pt</td><td>${fmt(row.spot)}</td><td>${compact(row.netGex)}</td><td>${compact(row.dex)}</td><td>${compact(row.vannaPerVolPoint)}</td><td>${compact(row.charmPerCalendarDay)}</td><td>${pct(row.coverage)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="so-ai-empty">Chưa đủ dữ liệu để chạy BSM stress grid.</div>';
    const expiryRows = r.expiryParts.length ? `<div class="so-ai-table-wrap"><table class="so-ai-table"><thead><tr><th>Expiry</th><th>DTE</th><th>Net GEX</th><th>Gross share</th><th>Status</th></tr></thead><tbody>${r.expiryParts.slice(0, 12).map(row => `<tr><td>${esc(row.expiry)}</td><td>${fmt(row.dte, 1)}</td><td>${row.netGex === null ? '—' : compact(row.netGex)}</td><td>${row.share === null || row.share === undefined ? '—' : pct(row.share)}</td><td>${esc(row.status)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="so-ai-empty">Chọn Weekly hoặc All Expiries để xem exposure từng expiry. Selected Expiry không đại diện cho toàn bộ kỳ hạn.</div>';
    const quality = r.qualityItems.map(item => `<div class="so-ai-quality-item"><span>${esc(item.label)}</span><b class="is-${item.tone}">${esc(item.value)}</b></div>`).join('');
    return `<div class="so-ai-topline"><div>${tag(r.regime.label, r.regime.tone)} ${tag(r.marketClosed ? 'LAST MARKET PRICE' : r.priceStale ? 'STALE SPOT' : 'SPOT FEED', r.priceStale ? 'warning' : 'muted')} ${tag(r.gexComplete ? 'GEX COMPLETE' : 'GEX PROVISIONAL', r.gexComplete ? 'positive' : 'warning')}</div><button type="button" class="btn sm so-ai-copy" data-copy-analysis>Copy Full Analysis</button></div>
      <div class="so-ai-brief"><div><span class="so-ai-label">01 · EXECUTIVE MARKET BRIEF</span><p>${esc(r.brief)}</p></div><div class="so-ai-brief-kpis">${kpi('SPOT', fmt(r.spot), r.change === null ? 'Previous close unavailable' : `${r.change >= 0 ? '+' : ''}${fmt(r.change)} · ${pct(r.changePct)}`, r.change === null ? '' : r.change >= 0 ? 'is-positive' : 'is-negative')}${kpi('NET / GROSS GEX', r.netGrossPct === null ? '—' : `${r.netGrossPct > 0 ? '+' : ''}${r.netGrossPct.toFixed(1)}%`, 'Type-signed OI GEX convention')}${kpi('GAMMA FLIP', fmt(r.gammaFlip), r.gammaFlipDistance === null ? 'Unavailable' : `${r.gammaFlipDistance >= 0 ? 'Above' : 'Below'} Spot · ${Math.abs(r.gammaFlipDistance).toFixed(2)}%`)}${kpi('ATM IV', pct(r.selectedVol?.atmIV), r.selectedVol?.atmSideCount === 2 ? 'Two-sided Forward ATM' : r.selectedVol?.atmSideCount === 1 ? 'One-sided ATM estimate' : 'Unavailable')}</div></div>
      <div class="so-ai-kpi-grid">${kpi('CALL OI / PUT OI', `${compact(r.callOi)} / ${compact(r.putOi)}`, `Put/Call OI ${r.oiRatio === null ? '—' : r.oiRatio === Infinity ? '∞' : (1 / r.oiRatio).toFixed(2)}x`)}${kpi('CALL GEX / PUT GEX', `${compact(r.callGex)} / ${compact(r.putGexAbs)}`, 'Gross side totals · not signed holder positions')}${kpi('EXPECTED MOVE · 1σ', r.expectedMove === null ? '—' : `±${fmt(r.expectedMove)}`, r.expectedMovePct === null ? 'ATM IV / DTE needed' : `${pct(r.expectedMovePct)} · ${fmt(r.expectedLow)}–${fmt(r.expectedHigh)}`)}${kpi('CALL VOL / PUT VOL', `${compact(r.callVolume)} / ${compact(r.putVolume)}`, 'Provider volume · no trade direction')}</div>
      <details class="so-ai-section" open><summary><span>02 · MARKET REGIME & EXPOSURE STRUCTURE</span>${tag(r.regime.label, r.regime.tone)}</summary><div class="so-ai-section-body"><p>${esc(r.regime.explanation)}</p><div class="so-ai-stat-grid"><div><small>Type-signed GEX ratio</small><b>${r.putCallGexRatio === null ? '—' : r.putCallGexRatio === Infinity ? '∞' : `${r.putCallGexRatio.toFixed(2)}x`}</b></div><div><small>Gross Call share</small><b>${pct(r.grossCallDominance)}</b></div><div><small>Gamma Flip distance</small><b>${r.gammaFlipDistance === null ? '—' : `${r.gammaFlipDistance > 0 ? '+' : ''}${r.gammaFlipDistance.toFixed(2)}%`}</b></div><div><small>Net / Gross GEX</small><b>${r.netGrossPct === null ? '—' : `${r.netGrossPct > 0 ? '+' : ''}${r.netGrossPct.toFixed(1)}%`}</b></div></div><p class="so-ai-note">Không gán Positive/Negative Dealer Gamma từ OI. Đây là OI-weighted Call+/Put− proxy, vì OI không cho biết holder Long hay Short.</p></div></details>
      <details class="so-ai-section"><summary><span>03 · GREEKS & OI-WEIGHTED SENSITIVITY</span>${tag('Model / Provider', 'muted')}</summary><div class="so-ai-section-body"><div class="so-ai-stat-grid"><div><small>DEX · USD delta-notional proxy</small><b>${compact(r.greekExposure.deltaNotional)}</b></div><div><small>Type-signed GEX</small><b>${compact(r.greekExposure.typeSignedGex)}</b></div><div><small>Vanna / +1 vol point</small><b>${compact(r.greekExposure.vannaPerVolPoint)}</b></div><div><small>Charm / calendar day</small><b>${compact(r.greekExposure.charmPerCalendarDay)}</b></div><div><small>Provider Vega × OI × multiplier</small><b>${compact(r.greekExposure.providerVegaOiWeighted)}</b><em>${pct(r.greekExposure.providerVegaCoverage)} contract coverage</em></div><div><small>Provider Theta × OI × multiplier</small><b>${compact(r.greekExposure.providerThetaOiWeighted)}</b><em>${pct(r.greekExposure.providerThetaCoverage)} contract coverage</em></div></div><p class="so-ai-note">DEX là signed-Delta × OI × multiplier × Spot theo công thức core, không phải dealer net Delta. Vanna là BSM dDelta/dSigma, nhân 0.01 để biểu diễn mỗi +1 volatility point; Charm là BSM dDelta/d(calendar-time), chia 365.25 để biểu diễn mỗi ngày lịch. Vega/Theta lấy từ Provider rồi nhân OI và multiplier; đơn vị provider chưa được chuẩn hóa đồng nhất nên chỉ hiển thị giá trị và coverage, không so sánh chéo như dollar exposure.</p><p class="so-ai-note">Greeks là local sensitivities: ước lượng bậc nhất chỉ chính xác khi cú sốc nhỏ. Với biến động Spot/IV lớn, cần repricing đầy đủ; các Greek cũng thay đổi cùng lúc. OI-weighted tổng hợp không cho biết vị thế Long/Short của holder.</p></div></details>
      <details class="so-ai-section"><summary><span>04 · OPTIONS POSITIONING & ACTIVITY</span>${tag('OI ≠ DIRECTION', 'muted')}</summary><div class="so-ai-section-body"><div class="so-ai-two-col"><div><h4>Top Call OI</h4>${oiTable(r.distByOiCall, 'callOI')}</div><div><h4>Top Put OI</h4>${oiTable(r.distByOiPut, 'putOI')}</div></div><div class="so-ai-stat-grid"><div><small>Call Volume / Call OI</small><b>${r.callVolOi === null ? '—' : `${r.callVolOi.toFixed(2)}x`}</b></div><div><small>Put Volume / Put OI</small><b>${r.putVolOi === null ? '—' : `${r.putVolOi.toFixed(2)}x`}</b></div><div><small>Call / Put Volume</small><b>${compact(r.callVolume)} / ${compact(r.putVolume)}</b></div><div><small>Total OI</small><b>${compact(r.totalOi)}</b></div></div><p class="so-ai-note">Volume/OI là tỷ lệ hoạt động so với OI snapshot, không phân biệt opening/closing, buyer/seller hay aggressor direction.</p></div></details>
      <details class="so-ai-section"><summary><span>05 · VOLATILITY INTELLIGENCE</span>${tag(r.termStructure.label, r.termStructure.tone)}</summary><div class="so-ai-section-body"><p>${esc(r.termStructure.explanation)}</p><div class="so-ai-stat-grid"><div><small>25Δ Risk Reversal</small><b>${volPts(r.selectedVol?.rr25)}</b></div><div><small>25Δ Butterfly</small><b>${volPts(r.selectedVol?.bf25)}</b></div><div><small>Put 25Δ Skew</small><b>${volPts(r.selectedVol?.putSkew)}</b></div><div><small>Call 25Δ Skew</small><b>${volPts(r.selectedVol?.callSkew)}</b></div><div><small>Expected Move 1σ</small><b>${r.expectedMove === null ? '—' : `±${fmt(r.expectedMove)} (${pct(r.expectedMovePct)})`}</b></div><div><small>Range comparison</small><b>${esc(r.rangePosition)}</b></div></div><div class="so-ai-cm-grid">${r.constantMaturity.map(row => `<div><small>${row.days}D constant maturity</small><b>${pct(row.iv)}</b><em>${esc(row.status)}</em></div>`).join('')}</div><p class="so-ai-note">RR25 = Call 25Δ IV − Put 25Δ IV. BF25 = trung bình hai wing trừ ATM. Constant maturity chỉ nội suy total variance nếu có hai expiry bao quanh; không ngoại suy. IV là biến động hàm ý từ premium, không phải hướng giá và không bảo đảm realized volatility.</p></div></details>
      <details class="so-ai-section"><summary><span>06 · MULTI-EXPIRY RISK</span>${tag(`${r.expiryParts.length} expiry`, 'muted')}</summary><div class="so-ai-section-body">${expiryRows}<p class="so-ai-note">Gross GEX share là tỷ trọng exposure theo quy ước của từng expiry trong scope đã tải; không cho biết signed dealer inventory. Max Pain vẫn là metric riêng từng expiry.</p></div></details>
      <details class="so-ai-section"><summary><span>07 · STRIKE CONFLUENCE & REFERENCE LEVELS</span>${tag(`${r.clusters.length} zones`, 'muted')}</summary><div class="so-ai-section-body"><div class="so-ai-two-col"><div><h4>Resistance references</h4>${levelList(r.resistances, r.spot)}</div><div><h4>Support references</h4>${levelList(r.supports, r.spot)}</div></div><h4>Top Net GEX strikes</h4>${gexTable(r.distByGex)}<p class="so-ai-note">Confluence gom các level OI Wall, GEX Wall, Gamma Flip, Max Pain và GEX rank gần nhau. Ngưỡng gom được đặt theo 0.25% Spot hoặc 1.25 lần median strike spacing, lấy ngưỡng lớn hơn. Đây là heuristic để sắp xếp reference levels, không phải vùng hỗ trợ/kháng cự đã được price-action xác nhận.</p></div></details>
      <details class="so-ai-section"><summary><span>08 · BULL / BEAR / BASE SCENARIOS</span>${tag('Conditional', 'warning')}</summary><div class="so-ai-section-body"><div class="so-ai-scenario-grid">${scenarioCard(r.scenarios.base)}${scenarioCard(r.scenarios.upside)}${scenarioCard(r.scenarios.downside)}</div><p class="so-ai-note">Engine hiện không có đủ historical intraday price series để tự xác nhận acceptance, breakout, retest hay 30 phút cuối. Các xác nhận trên là điều kiện cần quan sát, không phải trạng thái đã xảy ra.</p></div></details>
      <details class="so-ai-section"><summary><span>09 · WHAT-IF GREEK STRESS GRID</span>${tag('BSM · OI/IV fixed', 'muted')}</summary><div class="so-ai-section-body">${stressTable}<p class="so-ai-note">${esc(r.stress.note)} Coverage mô hình: ${pct(r.stress.coverage)}. Reprice toàn bộ contract bằng BSM để so sánh các ô; vì vậy dòng 0%/0 vol pt có thể khác GEX chính dùng Provider Gamma. q và r giữ theo giả định QuantLab (r=0%; QQQ q=0.45%; GLD q=0%).</p></div></details>
      <details class="so-ai-section"><summary><span>10 · DATA QUALITY, ASSUMPTIONS & NO-TRADE CHECKS</span>${tag(r.majorWarnings.length ? `${r.majorWarnings.length} notices` : 'No major warnings', r.majorWarnings.length ? 'warning' : 'positive')}</summary><div class="so-ai-section-body"><div class="so-ai-quality-grid">${quality}</div>${r.majorWarnings.length ? `<ul class="so-ai-warning-list">${r.majorWarnings.map(item => `<li>${esc(item)}</li>`).join('')}</ul>` : '<p class="so-ai-note">Không có cảnh báo lớn từ các field hiện tại; điều này không đồng nghĩa dữ liệu không có rủi ro mô hình.</p>'}<p class="so-ai-note">OI/Volume null trên OCC quote đã nhận vẫn tuân thủ giả định 0 của core engine. OCC quote chưa nhận được không bị xem là zero-filled. BSM là xấp xỉ dùng r=0%, QQQ q=0.45%, GLD q=0%; Provider Greeks/IV được ưu tiên ở các module hiện hữu. Các kết quả BSM, 0DTE time-decay và stress grid là model-derived.</p></div></details>
      <div class="so-ai-foot">Updated ${new Date(r.now).toLocaleString('vi-VN')} · ${esc(r.scopeLabel)} · ${esc(r.expiry || '—')} · OBSERVED / MODEL-DERIVED / INTERPRETATION được phân biệt. Không phải khuyến nghị giao dịch.</div>`;
  }

  return { analyse, render, buildStressGrid, simulateGex, collectLevels, buildConfluence, bsmGamma };
});
