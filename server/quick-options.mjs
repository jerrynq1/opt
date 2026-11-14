import { randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const PREFIX = '/api/binance-stock-proxy';
const QUOTE_PATH = '/bapi/equity/v1/friendly/equity/option/get-option-quote';
const CHAIN_PATH = '/bapi/equity/v1/public/equity/option/chain-symbols';
const PRICE_WS_URL = 'wss://nbstream.binance.com/equity/ws/price';
const CACHE_TTL_MS = 60_000;
const PARTIAL_CACHE_TTL_MS = 12_000;
const MAX_EXPIRY_CANDIDATES = 24;

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const tokenFile = path.join(moduleDir, 'quick-options-token.txt');

function loadOrCreateToken() {
  const envToken = String(process.env.QUICK_OPTIONS_TOKEN || '').trim();
  if (envToken) return envToken;
  if (existsSync(tokenFile)) {
    const saved = readFileSync(tokenFile, 'utf8').trim();
    if (saved) return saved;
  }
  const generated = randomBytes(32).toString('hex');
  writeFileSync(tokenFile, `${generated}\n`, { mode: 0o600, flag: 'wx' });
  console.log(`[Quick Options] Đã tạo access token tại: ${tokenFile}`);
  console.log('[Quick Options] Mở file này để copy token vào iOS Shortcut. Không chia sẻ hoặc commit file token.');
  return generated;
}

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-allow-headers': 'Authorization, Accept',
      ...extraHeaders
    }
  });
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const num = value => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

function tokenMatches(received, expected) {
  const a = Buffer.from(String(received || ''));
  const b = Buffer.from(String(expected || ''));
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

function todayNewYork() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
}

function candidateDates(limit = MAX_EXPIRY_CANDIDATES) {
  const dates = [];
  const base = new Date(`${todayNewYork()}T12:00:00Z`);
  for (let i = 0; i < 65 && dates.length < limit; i++) {
    const date = new Date(base.getTime() + i * 86_400_000);
    const day = date.getUTCDay();
    if (day === 0 || day === 6) continue;
    dates.push(date.toISOString().slice(0, 10));
  }
  return dates;
}

function occStrike(symbol) {
  const match = String(symbol || '').match(/[CP](\d{8})$/i);
  return match ? Number(match[1]) / 1000 : null;
}

function firstNumber(...values) {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    const n = num(value);
    if (n !== null) return n;
  }
  return null;
}

function normaliseQuote(q) {
  const packs = [q, q?.quote, q?.optionQuote, q?.option, q?.data, q?.ticker, q?.greeks]
    .filter(value => value && typeof value === 'object');
  const pick = (...keys) => firstNumber(...packs.flatMap(pack => keys.map(key => pack[key])));
  const pickText = (...keys) => {
    for (const pack of packs) {
      for (const key of keys) {
        const value = pack[key];
        if (value !== null && value !== undefined && String(value).trim() !== '') return String(value).trim();
      }
    }
    return '';
  };

  const optionSymbol = pickText('os', 'optionSymbol', 'symbol', 's');
  const rawSide = pickText('t', 'contractType', 'side', 'optionType').toLowerCase();
  const occSide = (optionSymbol.match(/[0-9]([cp])[0-9]+$/i) || [])[1]?.toUpperCase();
  const side = rawSide.includes('put') || rawSide === 'p' ? 'P'
    : rawSide.includes('call') || rawSide === 'c' ? 'C'
      : occSide === 'P' ? 'P' : occSide === 'C' ? 'C' : null;
  const oiParsed = pick('oi', 'openInterest', 'open_interest', 'openInterestQty', 'open_interest_qty', 'openInterestQuantity');
  const multiplier = pick('m', 'multiplier', 'contractMultiplier', 'contract_multiplier', 'contractSize', 'contract_size');

  return {
    optionSymbol,
    side,
    expiration: pick('e', 'expiration', 'expiry'),
    strike: pick('sp', 'strikePrice', 'strike', 'k') ?? occStrike(optionSymbol),
    multiplier: multiplier !== null && multiplier > 0 ? multiplier : null,
    openInterest: oiParsed !== null && oiParsed >= 0 ? oiParsed : null,
    iv: pick('iv', 'impliedVolatility', 'impliedVol', 'markIV', 'markIv', 'mark_iv', 'bidIV', 'askIV'),
    gamma: pick('ga', 'gamma'),
    delta: pick('de', 'delta'),
    theta: pick('th', 'theta'),
    vega: pick('ve', 'vega'),
    volume: pick('v', 'volume')
  };
}

function quoteRowsFromReply(reply) {
  const isQuote = value => value && typeof value === 'object' && !Array.isArray(value)
    && (value.os || value.optionSymbol || value.symbol || value.s);
  const queue = [{ value: reply, depth: 0 }];
  const seen = new Set();
  while (queue.length) {
    const { value, depth } = queue.shift();
    if (!value || typeof value !== 'object' || seen.has(value) || depth > 6) continue;
    seen.add(value);
    if (Array.isArray(value)) {
      const rows = value.filter(isQuote);
      if (rows.length) return rows;
      for (const child of value) if (child && typeof child === 'object') queue.push({ value: child, depth: depth + 1 });
      continue;
    }
    const entries = Object.entries(value);
    const keyed = entries.filter(([key, child]) => /^(QQQ|GLD)/i.test(key)
      && child && typeof child === 'object' && !Array.isArray(child));
    if (keyed.length === entries.length && keyed.length) return keyed.map(([symbol, child]) => ({ os: symbol, ...child }));
    for (const [, child] of entries) if (child && typeof child === 'object') queue.push({ value: child, depth: depth + 1 });
  }
  return [];
}

function mergeQuoteSnapshot(previous, incoming) {
  if (!previous) return incoming;
  const merged = { ...previous, ...incoming };
  for (const field of ['openInterest', 'multiplier', 'iv', 'gamma', 'delta', 'theta', 'vega', 'strike', 'side', 'expiration']) {
    if (incoming[field] === null || incoming[field] === undefined) {
      if (previous[field] !== null && previous[field] !== undefined) merged[field] = previous[field];
    }
  }
  return merged;
}

function effectiveMultiplier(q) {
  const explicit = num(q?.multiplier);
  if (explicit !== null && explicit > 0) return { value: explicit, source: 'binance' };
  const symbol = String(q?.optionSymbol || '').toUpperCase();
  if (/^(QQQ|GLD)\d{6}[CP]\d{8}$/.test(symbol)) return { value: 100, source: 'standard-100-assumption' };
  return { value: null, source: 'missing' };
}

function ivSigma(value) {
  let v = num(value);
  if (v === null || v <= 0) return null;
  if (v > 3) v /= 100;
  return v >= 0.01 && v <= 5 ? v : null;
}

function expiryAtUsCloseUtc(expiry) {
  const match = String(expiry || '').slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const targetWall = Date.UTC(+match[1], +match[2] - 1, +match[3], 16, 0, 0);
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
}

function yearsToExpiry(expiry, now) {
  const end = expiryAtUsCloseUtc(expiry);
  if (end === null) return null;
  const time = (end - now) / (365.25 * 86_400_000);
  return Number.isFinite(time) && time > 0 ? time : null;
}

function bsmGamma(spot, strike, time, sigma) {
  if (!(spot > 0 && strike > 0 && time > 0 && sigma > 0)) return null;
  const denominator = sigma * Math.sqrt(time);
  const d1 = (Math.log(spot / strike) + 0.5 * sigma * sigma * time) / denominator;
  const gamma = Math.exp(-0.5 * d1 * d1) / (spot * denominator * Math.sqrt(2 * Math.PI));
  return Number.isFinite(gamma) ? gamma : null;
}

function resolveGamma(q, spot, time) {
  const provider = num(q.gamma);
  if (provider !== null && Math.abs(provider) > 0) return { gamma: Math.abs(provider), source: 'provider' };
  const sigma = ivSigma(q.iv);
  const derived = spot > 0 && time !== null && sigma !== null ? bsmGamma(spot, q.strike, time, sigma) : null;
  return derived !== null ? { gamma: derived, source: 'bsm-iv' } : { gamma: null, source: 'missing' };
}

function gammaFlipOf(rows, spot, expiry, now) {
  const time = yearsToExpiry(expiry, now);
  if (time === null) return { level: null, crosses: [], complete: false, reason: 'Thiếu DTE hợp lệ', coverage: 0 };
  const valid = rows.filter(q => Number.isFinite(q.strike) && q.strike > 0 && (q.side === 'C' || q.side === 'P'));
  const invalidCount = rows.length - valid.length;
  const invalidOI = valid.filter(q => q.openInterest !== null && q.openInterest !== undefined
    && (!Number.isFinite(q.openInterest) || q.openInterest < 0));
  const active = valid.filter(q => Number.isFinite(q.openInterest) && q.openInterest > 0);
  const eligible = active.filter(q => effectiveMultiplier(q).value !== null && ivSigma(q.iv) !== null);
  const coverage = active.length ? eligible.length / active.length : 1;
  if (!valid.length || invalidCount > 0 || invalidOI.length > 0 || eligible.length !== active.length) {
    return { level: null, crosses: [], complete: false,
      reason: 'Contract OI > 0 cần multiplier hợp lệ và IV hợp lệ; OI null giả định 0', coverage };
  }
  if (!eligible.length) return { level: null, crosses: [], complete: true, reason: 'Không có contract OI dương để tính Zero Gamma', coverage };

  const netAt = price => {
    let total = 0;
    for (const q of eligible) {
      const gamma = bsmGamma(price, q.strike, time, ivSigma(q.iv));
      const multiplier = effectiveMultiplier(q).value;
      if (gamma === null || multiplier === null) return null;
      const value = gamma * q.openInterest * multiplier * price * price * 0.01;
      total += q.side === 'P' ? -value : value;
    }
    return total;
  };

  const strikes = eligible.map(q => q.strike).filter(value => Number.isFinite(value) && value > 0);
  const anchors = spot > 0 ? [...strikes, spot] : strikes;
  const low = Math.min(...anchors) * 0.5;
  const high = Math.max(...anchors) * 1.5;
  const steps = 600;
  if (!(high > low)) return { level: null, crosses: [], complete: true, reason: 'Dải giá giả định không hợp lệ', coverage };
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const price = low + (high - low) * i / steps;
    points.push({ price, gex: netAt(price) });
  }
  const crosses = [];
  const addCross = value => {
    if (Number.isFinite(value) && (!crosses.length || Math.abs(crosses[crosses.length - 1] - value) > (high - low) / steps * 0.05)) crosses.push(value);
  };
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    if (a.gex === 0) { addCross(a.price); continue; }
    if (b.gex === 0) { addCross(b.price); continue; }
    if ((a.gex < 0 && b.gex > 0) || (a.gex > 0 && b.gex < 0)) {
      let left = a.price, right = b.price, fLeft = a.gex;
      for (let n = 0; n < 64; n++) {
        const mid = (left + right) / 2;
        const fMid = netAt(mid);
        if (!Number.isFinite(fMid)) break;
        if (Math.abs(fMid) < 1e-10 || right - left < Math.max(1e-10, mid * 1e-12)) {
          left = right = mid;
          break;
        }
        if ((fLeft < 0 && fMid > 0) || (fLeft > 0 && fMid < 0)) right = mid;
        else { left = mid; fLeft = fMid; }
      }
      addCross((left + right) / 2);
    }
  }
  crosses.sort((a, b) => a - b);
  const level = spot > 0 && crosses.length
    ? crosses.slice().sort((a, b) => Math.abs(a - spot) - Math.abs(b - spot))[0]
    : null;
  return { level, crosses, complete: true,
    reason: !crosses.length ? 'Không có zero-cross trong dải giá giả định'
      : 'BSM repricing · OI/IV cố định · r=q=0 · expiry 16:00 New York · bisection', coverage,
    range: [low, high], timeToExpiry: time };
}

function maxPainOf(distribution) {
  if (!Array.isArray(distribution) || !distribution.length) return null;
  const rows = distribution.filter(row => Number.isFinite(row.strike) && row.strike > 0
    && Number.isFinite(row.callPainOI) && row.callPainOI >= 0
    && Number.isFinite(row.putPainOI) && row.putPainOI >= 0);
  if (rows.length !== distribution.length || !rows.length) return null;
  if (!(rows.reduce((sum, row) => sum + row.callPainOI + row.putPainOI, 0) > 0)) return null;
  const strikes = [...new Set(rows.map(row => row.strike))].sort((a, b) => a - b);
  const payouts = strikes.map(settlement => {
    let payout = 0;
    for (const row of rows) {
      payout += Math.max(0, settlement - row.strike) * row.callPainOI;
      payout += Math.max(0, row.strike - settlement) * row.putPainOI;
    }
    return { strike: settlement, payout };
  });
  const minimum = Math.min(...payouts.map(row => row.payout));
  const tolerance = Math.max(1e-8, Math.abs(minimum) * 1e-10);
  const tiedStrikes = payouts.filter(row => Math.abs(row.payout - minimum) <= tolerance).map(row => row.strike);
  return { strike: tiedStrikes[0], payout: minimum, tiedStrikes, isTie: tiedStrikes.length > 1 };
}

function isExcludedStrike(strike, excluded) {
  return Number.isFinite(strike) && excluded.some(value => Number.isFinite(value) && Math.abs(strike - value) <= 1e-4);
}

function calculateLevels({ quotes, symbols, expiry, spot, now, invalidChainRows = 0 }) {
  const rows = [...quotes.values()].sort((a, b) => (a.strike ?? 0) - (b.strike ?? 0));
  const missingSymbols = symbols.filter(symbol => !quotes.has(symbol));
  const totalContracts = symbols.length;
  const complete = missingSymbols.length === 0 && invalidChainRows === 0 && rows.length >= totalContracts;
  const byStrike = new Map();
  let callOI = 0, putOI = 0, oiKnown = 0, oiAssumedZero = 0;
  let gexKnown = 0, gexMissing = missingSymbols.length, gammaProviderKnown = 0, gammaDerivedKnown = 0;
  let multiplierMissing = 0, maxPainMultiplierMissing = 0, invalidContractCount = 0;

  for (const q of rows) {
    const side = q.side === 'P' ? 'P' : q.side === 'C' ? 'C' : null;
    if (!Number.isFinite(q.strike) || q.strike <= 0 || !side) {
      invalidContractCount++;
      gexMissing++;
      continue;
    }
    const key = Number(q.strike).toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
    const item = byStrike.get(key) || {
      strike: q.strike, gex: 0, callGex: 0, putGex: 0, callOI: 0, putOI: 0,
      callPainOI: 0, putPainOI: 0
    };
    const oiValid = q.openInterest !== null && q.openInterest !== undefined
      && Number.isFinite(q.openInterest) && q.openInterest >= 0;
    const oi = oiValid ? q.openInterest : 0;
    if (oiValid) oiKnown++;
    else oiAssumedZero++;
    const multiplierInfo = effectiveMultiplier(q);
    const multiplier = multiplierInfo.value;
    if (side === 'C') { callOI += oi; item.callOI += oi; }
    else { putOI += oi; item.putOI += oi; }

    if (oi > 0 && multiplier === null) {
      multiplierMissing++;
      maxPainMultiplierMissing++;
    } else if (oi > 0 && multiplier !== null) {
      if (side === 'C') item.callPainOI += oi * multiplier;
      else item.putPainOI += oi * multiplier;
    }

    if (oi === 0) {
      gexKnown++;
      byStrike.set(key, item);
      continue;
    }
    if (multiplier === null || spot === null || !(spot > 0)) {
      gexMissing++;
      byStrike.set(key, item);
      continue;
    }
    const resolved = resolveGamma(q, spot, yearsToExpiry(expiry, now));
    if (resolved.gamma === null) {
      gexMissing++;
    } else {
      const raw = resolved.gamma * oi * multiplier * spot * spot * 0.01;
      const signed = side === 'P' ? -raw : raw;
      item.gex += signed;
      if (side === 'C') item.callGex += Math.abs(raw);
      else item.putGex -= Math.abs(raw);
      gexKnown++;
      if (resolved.source === 'provider') gammaProviderKnown++;
      else gammaDerivedKnown++;
    }
    byStrike.set(key, item);
  }

  const distribution = [...byStrike.values()].sort((a, b) => a.strike - b.strike);
  const oiComplete = complete && invalidContractCount === 0;
  const gexAvailable = gexKnown > 0 && spot !== null && spot > 0;
  const gexComplete = complete && gexMissing === 0 && spot !== null && spot > 0 && totalContracts > 0;
  const gexProvisional = gexAvailable && !gexComplete;
  const rawCallOIWall = distribution.filter(row => row.callOI > 0).sort((a, b) => b.callOI - a.callOI)[0] || null;
  const rawPutOIWall = distribution.filter(row => row.putOI > 0).sort((a, b) => b.putOI - a.putOI)[0] || null;
  const callOIWall = oiComplete ? rawCallOIWall : null;
  const putOIWall = oiComplete ? rawPutOIWall : null;
  const positiveGex = gexAvailable
    ? distribution.filter(row => row.gex > 0).sort((a, b) => b.gex - a.gex)
    : [];
  const negativeGex = gexAvailable
    ? distribution.filter(row => row.gex < 0).sort((a, b) => a.gex - b.gex)
    : [];
  const gexCallWall = positiveGex[0] || null;
  const gexPutWall = negativeGex[0] || null;

  const maxPainComplete = oiComplete && maxPainMultiplierMissing === 0;
  const maxPain = maxPainComplete ? maxPainOf(distribution) : null;
  let maxPainReason = !complete ? `Đang thiếu ${missingSymbols.length} quote OCC`
    : !oiComplete ? 'Có OCC contract không hợp lệ'
      : maxPainMultiplierMissing > 0 ? `Thiếu multiplier ở ${maxPainMultiplierMissing} contract OI > 0`
        : !maxPain ? 'Expiry không có OI dương để xác định Max Pain' : 'Max Pain tính từ toàn bộ expiry';

  const flipCalc = complete
    ? gammaFlipOf(rows, spot ?? 0, expiry, now)
    : { level: null, crosses: [], complete: false, reason: 'Full Option Chain chưa tải xong', coverage: 0 };
  const gammaFlip = flipCalc.complete && spot > 0 && flipCalc.crosses?.length
    ? flipCalc.crosses.slice().sort((a, b) => Math.abs(a - spot) - Math.abs(b - spot))[0]
    : null;

  const excluded = [rawCallOIWall?.strike, rawPutOIWall?.strike, gexCallWall?.strike, gexPutWall?.strike,
    maxPain?.strike, ...(maxPain?.tiedStrikes || []), gammaFlip].filter(Number.isFinite);
  const gexLevels = gexAvailable
    ? distribution.filter(row => Math.abs(row.gex) > 0)
      .sort((a, b) => Math.abs(b.gex) - Math.abs(a.gex))
      .filter(row => !isExcludedStrike(row.strike, excluded))
      .slice(0, 10)
      .map((row, index) => ({ rank: index + 1, strike: row.strike, gex: row.gex }))
    : [];

  const callGexTotal = gexAvailable ? distribution.reduce((sum, row) => sum + Math.max(0, row.callGex || 0), 0) : null;
  const putGexSignedTotal = gexAvailable ? distribution.reduce((sum, row) => sum + (row.putGex || 0), 0) : null;
  const putGexAbsTotal = putGexSignedTotal === null ? null : Math.abs(putGexSignedTotal);
  const gexRatio = gexAvailable && putGexAbsTotal > 0 ? callGexTotal / putGexAbsTotal : null;
  const gexRatioState = !gexAvailable ? 'unavailable'
    : gexProvisional ? 'provisional'
      : putGexAbsTotal === 0 ? (callGexTotal > 0 ? 'call-only' : 'no-gex') : 'ready';

  return {
    spot, callOI, putOI, oiKnown, oiAssumedZero, totalContracts, invalidContractCount,
    quotesReceived: rows.length, missingQuotes: missingSymbols.length,
    chainComplete: complete, oiComplete, gexAvailable, gexComplete, gexProvisional,
    callOIWall: callOIWall?.strike ?? null, putOIWall: putOIWall?.strike ?? null,
    cw: gexCallWall?.strike ?? null, pw: gexPutWall?.strike ?? null,
    cwGex: gexCallWall?.gex ?? null, pwGex: gexPutWall?.gex ?? null,
    gammaFlip, gammaFlipComplete: flipCalc.complete && spot !== null && spot > 0,
    gammaFlipReason: flipCalc.reason, gammaFlipCoverage: flipCalc.coverage,
    maxPain: maxPain?.strike ?? null, maxPainTiedStrikes: maxPain?.tiedStrikes || [],
    maxPainPayout: maxPain?.payout ?? null, maxPainComplete, maxPainReason,
    multiplierMissing, gammaProviderKnown, gammaDerivedKnown, gexKnown, gexMissing,
    gexCoverage: totalContracts ? gexKnown / totalContracts : 0,
    gexRatio, gexRatioState, gexLevels
  };
}

function extractSpot(payload) {
  const data = payload?.data ?? payload;
  const rows = Array.isArray(data?.rates) ? data.rates : Array.isArray(data) ? data : [data];
  const hit = rows.find(row => row && ((row.ac ?? row.assetCode) === 'EQ_GLD' || (row.s ?? row.symbol) === 'GLD'));
  if (!hit) return null;
  const price = num(hit.p ?? hit.price ?? hit.c ?? hit.close);
  if (!(price > 0)) return null;
  return { price, previousClose: num(hit.pc ?? hit.prevClose ?? hit.lastRegularClose ?? hit.prc ?? hit.prevRegularClose), time: num(hit.t ?? hit.time ?? hit.E ?? hit.eventTime), marketPhase: typeof hit.mp === 'string' ? hit.mp.toUpperCase() : null, receivedAt: Date.now() };
}

async function readSpotOnce() {
  if (typeof globalThis.WebSocket !== 'function') {
    throw new Error('Node.js hiện tại chưa hỗ trợ WebSocket toàn cục. Cần Node.js 22 trở lên cho Quick Options.');
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    let socket;
    const timeout = setTimeout(() => finish(null, new Error('Hết thời gian chờ Binance Equity Price Stream (10 giây).')), 10000);
    timeout.unref?.();
    const finish = (value, error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      try { socket?.close(); } catch {}
      if (error) reject(error);
      else resolve(value);
    };
    try {
      // Raw Price Stream is an official Binance endpoint; it starts pushing
      // all-symbol snapshots without a SUBSCRIBE RPC message.
      socket = new WebSocket(PRICE_WS_URL);
      socket.addEventListener('message', async event => {
        try {
          const raw = typeof event.data === 'string' ? event.data : await event.data.text();
          const parsed = JSON.parse(raw);
          const spot = extractSpot(parsed?.data ?? parsed);
          if (spot) finish(spot);
        } catch {
          // Ignore non-data/control WebSocket messages and keep waiting for the price event.
        }
      });
      socket.addEventListener('error', () => finish(null, new Error('Binance Equity WebSocket báo lỗi.')));
      socket.addEventListener('close', () => {
        if (!settled) finish(null, new Error('Binance Equity WebSocket đã đóng trước khi nhận Spot.'));
      });
    } catch (error) {
      finish(null, error);
    }
  });
}

export function createQuickOptionsService({ worker, env = {}, spotFeed = null }) {
  const token = loadOrCreateToken();
  const cache = new Map();
  const inFlight = new Map();

  async function callBinance(pathname, method = 'GET', body) {
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const init = { method, headers };
    if (body !== undefined) init.body = JSON.stringify(body);
    const upstreamRequest = new Request(`https://quick-options.local${PREFIX}${pathname}`, init);
    const response = await worker.fetch(upstreamRequest, env);
    const raw = await response.text();
    let payload;
    try { payload = JSON.parse(raw); }
    catch { throw new Error(`Binance proxy trả dữ liệu không phải JSON (HTTP ${response.status}).`); }
    if (!response.ok) {
      const detail = payload?.detail || payload?.error || payload?.message || raw.slice(0, 180);
      throw new Error(`Binance proxy HTTP ${response.status}: ${detail}`);
    }
    if (payload?.success === false || (payload?.code && !['0', '000000'].includes(String(payload.code)))) {
      throw new Error(payload?.message || payload?.msg || `Binance error ${payload.code}`);
    }
    return payload;
  }

  async function findExpiry(requestedExpiry) {
    if (requestedExpiry) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedExpiry)) throw new Error('Expiry phải có định dạng YYYY-MM-DD.');
      const reply = await callBinance(`${CHAIN_PATH}?${new URLSearchParams({ symbol: 'GLD', rootSymbol: 'GLD', expirationDate: requestedExpiry })}`);
      const contracts = reply?.data?.l || [];
      if (!contracts.length) throw new Error(`Binance không có GLD Option Chain cho expiry ${requestedExpiry}.`);
      return { date: requestedExpiry, contracts };
    }

    const dates = candidateDates();
    const found = [];
    let firstError = '';
    let next = 0;
    async function workerLoop() {
      while (next < dates.length) {
        const date = dates[next++];
        try {
          const reply = await callBinance(`${CHAIN_PATH}?${new URLSearchParams({ symbol: 'GLD', rootSymbol: 'GLD', expirationDate: date })}`);
          const contracts = reply?.data?.l || [];
          if (contracts.length) found.push({ date, contracts });
        } catch (error) {
          if (!firstError) firstError = error?.message || String(error);
        }
      }
    }
    await Promise.all(Array.from({ length: 4 }, workerLoop));
    found.sort((a, b) => a.date.localeCompare(b.date));
    const preferred = found.find(item => item.date >= todayNewYork()) || found[0];
    if (!preferred) throw new Error(`Không tìm thấy expiry GLD. ${firstError || 'Không có contract trong các ngày đã kiểm tra.'}`);
    return preferred;
  }

  function quoteNeedsRetry(q) {
    if (!q) return true;
    if (q.openInterest === null || q.openInterest === undefined || !Number.isFinite(q.openInterest) || q.openInterest < 0) return false;
    if (q.openInterest === 0) return false;
    if (effectiveMultiplier(q).value === null) return true;
    return ivSigma(q.iv) === null;
  }

  async function fetchAllQuotes(symbols, metadataBySymbol) {
    const quotes = new Map();
    let pending = [...new Set(symbols)];
    let lastError = '';
    for (let attempt = 0; attempt < 3 && pending.length; attempt++) {
      const batches = [];
      const size = 100;
      for (let i = 0; i < pending.length; i += size) batches.push(pending.slice(i, i + size));
      let next = 0;
      async function batchWorker() {
        while (next < batches.length) {
          const batch = batches[next++];
          try {
            const reply = await callBinance(QUOTE_PATH, 'POST', { occSymbols: batch });
            const received = quoteRowsFromReply(reply).map(normaliseQuote).filter(row => row.optionSymbol);
            for (const quote of received) {
              if (!batch.includes(quote.optionSymbol)) continue;
              const meta = metadataBySymbol.get(quote.optionSymbol);
              const enriched = meta ? mergeQuoteSnapshot(meta, quote) : quote;
              quotes.set(quote.optionSymbol, mergeQuoteSnapshot(quotes.get(quote.optionSymbol), enriched));
            }
          } catch (error) {
            lastError = error?.message || String(error);
          }
        }
      }
      await Promise.all(Array.from({ length: Math.min(2, batches.length || 1) }, batchWorker));
      pending = pending.filter(symbol => quoteNeedsRetry(quotes.get(symbol)));
      if (pending.length && attempt < 2) await sleep(350 * (attempt + 1));
    }
    return { quotes, pending, error: lastError };
  }

  async function buildSummary(requestedExpiry) {
    const spotPromise = (spotFeed ? spotFeed.get('GLD', { timeoutMs: 10_000 }) : readSpotOnce())
      .then(value => ({ value, error: '' }))
      .catch(error => ({ value: null, error: error?.message || String(error) }));
    const expiryInfo = await findExpiry(requestedExpiry);
    const canonicalBySymbol = new Map();
    let invalidChainRows = 0;
    let duplicateChainRows = 0;
    for (const contract of expiryInfo.contracts) {
      const symbol = String(contract?.os ?? contract?.optionSymbol ?? '').trim();
      if (!symbol) { invalidChainRows++; continue; }
      if (canonicalBySymbol.has(symbol)) { duplicateChainRows++; continue; }
      canonicalBySymbol.set(symbol, { ...contract, os: symbol });
    }
    const canonical = [...canonicalBySymbol.values()];
    const symbols = canonical.map(item => item.os);
    if (!symbols.length) throw new Error(`Binance trả danh sách nhưng không có OCC symbol hợp lệ cho GLD ${expiryInfo.date}.`);
    const metadataBySymbol = new Map(canonical.map(item => [item.os, normaliseQuote(item)]));
    const quoteResult = await fetchAllQuotes(symbols, metadataBySymbol);
    const spotResult = await spotPromise;
    const spot = spotResult.value;
    const spotError = spotResult.error;

    const now = Date.now();
    const levels = calculateLevels({
      quotes: quoteResult.quotes,
      symbols,
      expiry: expiryInfo.date,
      spot: spot?.price ?? null,
      now,
      invalidChainRows
    });
    const chainComplete = levels.chainComplete;
    const partialNotes = [];
    if (!chainComplete) partialNotes.push(`Thiếu ${levels.missingQuotes}/${levels.totalContracts} OCC quotes.`);
    if (levels.gexProvisional) partialNotes.push('GEX đang là provisional vì chưa đủ dữ liệu toàn expiry.');
    if (levels.gammaFlip === null) partialNotes.push(levels.gammaFlipReason || 'Chưa tính được Gamma Flip.');
    if (levels.maxPain === null) partialNotes.push(levels.maxPainReason || 'Chưa tính được Max Pain.');
    if (!spot) partialNotes.push(spotError || 'Chưa lấy được Spot từ Binance Equity WebSocket.');
    if (quoteResult.error) partialNotes.push(`Quote request warning: ${quoteResult.error}`);

    return {
      ok: true,
      symbol: 'GLD',
      spot: spot?.price ?? null,
      spot_updated_at: (spot?.priceTime ?? spot?.time) ? new Date(spot.priceTime ?? spot.time).toISOString() : null,
      spot_market_phase: spot?.marketPhase || null,
      spot_received_at: spot?.receivedAt ? new Date(spot.receivedAt).toISOString() : null,
      spot_age_ms: Number.isFinite(spot?.ageMs) ? spot.ageMs : 0,
      spot_source: spot?.source || (spotFeed ? 'node-shared-binance-price-feed' : 'binance-raw-websocket'),
      expiry: expiryInfo.date,
      cw: levels.cw,
      pw: levels.pw,
      call_oi_wall: levels.callOIWall,
      put_oi_wall: levels.putOIWall,
      gamma_flip: levels.gammaFlip,
      max_pain: levels.maxPain,
      max_pain_tied_strikes: levels.maxPainTiedStrikes,
      max_pain_payout: levels.maxPainPayout,
      vol_trigger: null,
      vol_trigger_note: 'Chưa có định nghĩa/công thức Vol Trigger trong stock-options.js hiện tại.',
      gex_ratio: levels.gexRatio,
      gex_ratio_state: levels.gexRatioState,
      gex_1_10: levels.gexLevels.map(item => ({ rank: item.rank, strike: item.strike, gex: item.gex })),
      data_status: {
        chain_complete: levels.chainComplete,
        quotes_received: levels.quotesReceived,
        total_contracts: levels.totalContracts,
        missing_quotes: levels.missingQuotes,
        oi_complete: levels.oiComplete,
        gex_available: levels.gexAvailable,
        gex_complete: levels.gexComplete,
        gex_provisional: levels.gexProvisional,
        gex_coverage: Number((levels.gexCoverage * 100).toFixed(1)),
        oi_observed: levels.oiKnown,
        oi_assumed_zero: levels.oiAssumedZero,
        multiplier_missing: levels.multiplierMissing,
        gamma_provider_contracts: levels.gammaProviderKnown,
        gamma_bsm_contracts: levels.gammaDerivedKnown,
        gamma_flip_complete: levels.gammaFlipComplete,
        max_pain_complete: levels.maxPainComplete,
        invalid_contract_rows: levels.invalidContractCount,
        invalid_chain_rows: invalidChainRows,
        duplicate_chain_rows: duplicateChainRows
      },
      methods: {
        cw_pw: 'Strike có Net GEX dương lớn nhất / Net GEX âm có trị tuyệt đối lớn nhất; Call GEX dương, Put GEX âm.',
        gamma_flip: 'BSM repricing; giữ OI/IV/DTE cố định; r=q=0; expiry 16:00 America/New_York; chọn zero-cross gần Spot nhất.',
        max_pain: 'Tối thiểu hóa tổng intrinsic payout của Call và Put OI × multiplier trên toàn expiry.',
        gex: 'Σ(Gamma × OI × multiplier × Spot² × 0.01); Gamma provider hoặc BSM suy ra từ IV.'
      },
      notes: partialNotes,
      updated_at: new Date(now).toISOString(),
      quote_error: quoteResult.error || null,
      spot_error: spotError || null
    };
  }

  async function handle(request) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-allow-headers': 'Authorization, Accept',
      'access-control-max-age': '86400'
    } });
    if (request.method !== 'GET') return json({ ok: false, error: 'Only GET is allowed.' }, 405);
    if (!tokenMatches(request.headers.get('authorization')?.replace(/^Bearer\s+/i, ''), token)) {
      return json({ ok: false, error: 'Unauthorized. Add Authorization: Bearer <token> in iOS Shortcuts.' }, 401);
    }
    const symbol = String(url.searchParams.get('symbol') || 'GLD').toUpperCase();
    if (symbol !== 'GLD') return json({ ok: false, error: 'Phiên bản Quick Options hiện chỉ bật GLD.' }, 400);
    const requestedExpiry = url.searchParams.get('expiry') || '';
    const forceRefresh = url.searchParams.get('refresh') === '1';
    const key = `GLD:${requestedExpiry || 'auto'}`;
    const existing = cache.get(key);
    if (!forceRefresh && existing && existing.expiresAt > Date.now()) {
      return json({ ...existing.payload, cache: 'HIT' });
    }
    if (inFlight.has(key)) {
      try {
        const payload = await inFlight.get(key);
        return json({ ...payload, cache: 'COALESCED' });
      } catch (error) {
        return json({ ok: false, error: error?.message || String(error) }, 502);
      }
    }
    const task = buildSummary(requestedExpiry);
    inFlight.set(key, task);
    try {
      const payload = await task;
      const ttl = payload.data_status.chain_complete && payload.data_status.gex_complete
        ? CACHE_TTL_MS : PARTIAL_CACHE_TTL_MS;
      cache.set(key, { payload, expiresAt: Date.now() + ttl });
      return json({ ...payload, cache: 'MISS' });
    } catch (error) {
      return json({ ok: false, symbol: 'GLD', error: error?.message || String(error), updated_at: new Date().toISOString() }, 502);
    } finally {
      inFlight.delete(key);
    }
  }

  return { handle, tokenFile };
}
