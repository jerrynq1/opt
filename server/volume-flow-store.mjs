import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DB_PATH = path.join(moduleDir, 'data', 'gexadecimal-volume-flow.sqlite');
const ALLOWED_SYMBOLS = new Set(['GLD', 'QQQ']);

function asNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function newYorkDate(timestamp) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date(timestamp));
}

function parseOcc(optionSymbol) {
  const match = String(optionSymbol || '').toUpperCase().match(/^(GLD|QQQ)(\d{6})([CP])(\d{8})$/);
  if (!match) return null;
  const [, symbol, yymmdd, side, strike] = match;
  return {
    symbol,
    expiry: `20${yymmdd.slice(0, 2)}-${yymmdd.slice(2, 4)}-${yymmdd.slice(4, 6)}`,
    side,
    strike: Number(strike) / 1000
  };
}

function normaliseContract(input, context = {}) {
  if (!input || typeof input !== 'object') return null;
  const optionSymbol = String(input.optionSymbol ?? input.os ?? input.symbol ?? '').trim().toUpperCase();
  const occ = parseOcc(optionSymbol);
  const symbol = String(context.symbol ?? input.symbol ?? occ?.symbol ?? '').toUpperCase();
  if (!ALLOWED_SYMBOLS.has(symbol) || !optionSymbol) return null;
  const rawSide = String(input.side ?? input.contractType ?? input.optionType ?? input.t ?? '').toLowerCase();
  const side = rawSide.includes('call') || rawSide === 'c' ? 'C'
    : rawSide.includes('put') || rawSide === 'p' ? 'P' : occ?.side ?? null;
  const strike = asNumber(input.strike ?? input.strikePrice ?? input.sp ?? input.k) ?? occ?.strike ?? null;
  const expiry = String(context.expiry || input.expiration || input.expiry || occ?.expiry || '').slice(0, 10);
  const volume = asNumber(input.volume ?? input.v);
  if (!side || !Number.isFinite(strike) || strike <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(expiry) || volume === null || volume < 0) return null;
  const bid = asNumber(input.bid ?? input.bidPrice ?? input.bp);
  const ask = asNumber(input.ask ?? input.askPrice ?? input.ap);
  const mid = asNumber(input.mid ?? input.midPrice ?? input.mp);
  const last = asNumber(input.last ?? input.lastPrice ?? input.p ?? input.l);
  let optionPrice = null, optionPriceSource = null;
  if (bid !== null && ask !== null && bid >= 0 && ask > 0 && ask >= bid) {
    optionPrice = (bid + ask) / 2;
    optionPriceSource = 'NBBO midpoint';
  } else if (mid !== null && mid > 0) {
    optionPrice = mid;
    optionPriceSource = 'cached midpoint';
  } else if (last !== null && last > 0) {
    optionPrice = last;
    optionPriceSource = 'last price';
  }
  const multiplierValue = asNumber(input.multiplier ?? input.contractMultiplier ?? input.m);
  const underlyingSpot = asNumber(input.underlyingSpot ?? input.spot);
  return {
    symbol, expiry, optionSymbol, side, strike, volume,
    sourceTimeMs: asNumber(input.sourceTimeMs ?? input.eventTime ?? input.E ?? input.T ?? input.time),
    optionPrice, optionPriceSource,
    quoteUpdatedAtMs: parseTime(input.quoteUpdatedAt ?? input.quoteTime ?? input.quote_time_ms, null),
    hasInlineQuote: bid !== null || ask !== null || (mid !== null && mid > 0) || (last !== null && last > 0),
    multiplier: multiplierValue > 0 ? multiplierValue : 100,
    multiplierAssumed: !(multiplierValue > 0),
    underlyingSpot,
    spotTimeMs: parseTime(input.spotTimeMs ?? input.spotUpdatedAt, null),
    spotAgeMs: asNumber(input.spotAgeMs)
  };
}

function parseTime(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'number' && Number.isFinite(value)) return value < 1e12 ? Math.round(value * 1000) : Math.round(value);
  if (typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value.trim())) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric < 1e12 ? Math.round(numeric * 1000) : Math.round(numeric);
  }
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export class VolumeFlowStore {
  constructor({ dbPath = process.env.VOLUME_FLOW_DB_PATH || DEFAULT_DB_PATH, now = () => Date.now() } = {}) {
    this.dbPath = dbPath;
    this.now = now;
    if (dbPath !== ':memory:') mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS volume_contract_state (
        option_symbol TEXT PRIMARY KEY,
        symbol TEXT NOT NULL,
        expiry TEXT NOT NULL,
        strike REAL NOT NULL,
        option_type TEXT NOT NULL CHECK(option_type IN ('C','P')),
        volume_total REAL NOT NULL,
        session_date_ny TEXT NOT NULL,
        last_seen_at_ms INTEGER NOT NULL,
        last_source_time_ms INTEGER,
        source TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_volume_contract_lookup
        ON volume_contract_state(symbol, expiry, strike, option_type);
      CREATE TABLE IF NOT EXISTS volume_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        expiry TEXT NOT NULL,
        option_symbol TEXT NOT NULL,
        strike REAL NOT NULL,
        option_type TEXT NOT NULL CHECK(option_type IN ('C','P')),
        volume_delta REAL NOT NULL CHECK(volume_delta > 0),
        volume_total REAL NOT NULL,
        observed_at_ms INTEGER NOT NULL,
        interval_from_ms INTEGER NOT NULL,
        source_time_ms INTEGER,
        gap_ms INTEGER NOT NULL,
        source TEXT NOT NULL,
        capture_mode TEXT NOT NULL CHECK(capture_mode IN ('live','interval')),
        option_price REAL,
        option_price_source TEXT,
        estimated_premium_usd REAL,
        multiplier REAL,
        multiplier_assumed INTEGER NOT NULL DEFAULT 1,
        underlying_spot REAL,
        spot_time_ms INTEGER,
        spot_age_ms INTEGER,
        quote_time_ms INTEGER,
        quote_age_ms INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_volume_events_symbol_time
        ON volume_events(symbol, observed_at_ms DESC, id DESC);
      CREATE INDEX IF NOT EXISTS idx_volume_events_contract_time
        ON volume_events(option_symbol, observed_at_ms DESC);
      CREATE INDEX IF NOT EXISTS idx_volume_events_expiry
        ON volume_events(symbol, expiry, observed_at_ms DESC);
    `);

    // Upgrade existing local databases in place. Existing event history remains intact;
    // the new fields are nullable because older events did not capture quotes/underlying spot.
    const eventColumns = new Set(this.db.prepare('PRAGMA table_info(volume_events)').all().map(row => row.name));
    const migrations = [
      ['option_price', 'REAL'], ['option_price_source', 'TEXT'], ['estimated_premium_usd', 'REAL'],
      ['multiplier', 'REAL'], ['multiplier_assumed', 'INTEGER NOT NULL DEFAULT 1'],
      ['underlying_spot', 'REAL'], ['spot_time_ms', 'INTEGER'], ['spot_age_ms', 'INTEGER'],
      ['quote_time_ms', 'INTEGER'], ['quote_age_ms', 'INTEGER']
    ];
    for (const [name, definition] of migrations) {
      if (!eventColumns.has(name)) this.db.exec(`ALTER TABLE volume_events ADD COLUMN ${name} ${definition}`);
    }

    this.memoryState = new Map();
    for (const row of this.db.prepare('SELECT * FROM volume_contract_state').all()) {
      this.memoryState.set(row.option_symbol, {
        volume: Number(row.volume_total),
        lastSeenAt: Number(row.last_seen_at_ms),
        sourceTimeMs: row.last_source_time_ms === null ? null : Number(row.last_source_time_ms),
        sessionDate: row.session_date_ny
      });
    }

    this.insertState = this.db.prepare(`
      INSERT INTO volume_contract_state (
        option_symbol, symbol, expiry, strike, option_type, volume_total,
        session_date_ny, last_seen_at_ms, last_source_time_ms, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(option_symbol) DO UPDATE SET
        symbol=excluded.symbol, expiry=excluded.expiry, strike=excluded.strike,
        option_type=excluded.option_type, volume_total=excluded.volume_total,
        session_date_ny=excluded.session_date_ny, last_seen_at_ms=excluded.last_seen_at_ms,
        last_source_time_ms=excluded.last_source_time_ms, source=excluded.source
    `);
    this.insertEvent = this.db.prepare(`
      INSERT INTO volume_events (
        symbol, expiry, option_symbol, strike, option_type, volume_delta,
        volume_total, observed_at_ms, interval_from_ms, source_time_ms, gap_ms,
        source, capture_mode, option_price, option_price_source, estimated_premium_usd,
        multiplier, multiplier_assumed, underlying_spot, spot_time_ms, spot_age_ms,
        quote_time_ms, quote_age_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
  }

  ingest(input, { source = 'websocket', observedAt = this.now(), sourceTimeMs = null } = {}) {
    const contract = normaliseContract(input, input);
    if (!contract) return { accepted: false, reason: 'invalid-contract' };
    const observed = parseTime(observedAt, this.now());
    const sourceTime = parseTime(sourceTimeMs ?? contract.sourceTimeMs, null);
    const sessionDate = newYorkDate(observed);
    const previous = this.memoryState.get(contract.optionSymbol);

    if (!previous) {
      this.#saveState(contract, sessionDate, observed, sourceTime, source);
      this.memoryState.set(contract.optionSymbol, { volume: contract.volume, lastSeenAt: observed, sourceTimeMs: sourceTime, sessionDate });
      return { accepted: true, baseline: true, event: null };
    }

    if (sourceTime !== null && previous.sourceTimeMs !== null && sourceTime < previous.sourceTimeMs) {
      return { accepted: false, reason: 'out-of-order-source-event' };
    }

    // New New-York calendar session: establish a fresh baseline. Never carry
    // yesterday's cumulative volume into today's bubble delta.
    if (sessionDate !== previous.sessionDate) {
      this.#saveState(contract, sessionDate, observed, sourceTime, source);
      this.memoryState.set(contract.optionSymbol, { volume: contract.volume, lastSeenAt: observed, sourceTimeMs: sourceTime, sessionDate });
      return { accepted: true, baseline: true, reset: true, event: null };
    }

    if (contract.volume < previous.volume) {
      // A cumulative counter should not decrease inside a session. Treat it as
      // a provider reset/correction baseline, not a negative-volume trade.
      this.#saveState(contract, sessionDate, observed, sourceTime, source);
      this.memoryState.set(contract.optionSymbol, { volume: contract.volume, lastSeenAt: observed, sourceTimeMs: sourceTime, sessionDate });
      return { accepted: true, baseline: true, reset: true, event: null };
    }

    if (contract.volume === previous.volume) {
      // Keep the most recent observation in RAM only. No DB write and no
      // historical row when volume has not changed.
      previous.lastSeenAt = observed;
      if (sourceTime !== null) previous.sourceTimeMs = sourceTime;
      return { accepted: true, changed: false, event: null };
    }

    const delta = contract.volume - previous.volume;
    const gapMs = Math.max(0, observed - previous.lastSeenAt);
    const captureMode = source === 'websocket' && gapMs <= 5_000 ? 'live' : 'interval';
    const quoteTime = contract.quoteUpdatedAtMs ?? (contract.hasInlineQuote ? observed : null);
    const quoteAgeMs = quoteTime === null ? null : Math.max(0, observed - quoteTime);
    const quoteIsFresh = contract.optionPrice !== null && quoteAgeMs !== null && quoteAgeMs <= 60_000;
    const estimatedPremiumUsd = quoteIsFresh ? delta * contract.optionPrice * contract.multiplier : null;
    const spotTime = contract.spotTimeMs;
    const spotAgeMs = contract.spotAgeMs ?? (spotTime === null ? null : Math.max(0, observed - spotTime));
    const underlyingSpot = contract.underlyingSpot > 0 ? contract.underlyingSpot : null;
    const transaction = this.db.prepare('SAVEPOINT volume_delta_capture');
    transaction.run();
    try {
      this.insertEvent.run(
        contract.symbol, contract.expiry, contract.optionSymbol, contract.strike, contract.side,
        delta, contract.volume, observed, previous.lastSeenAt, sourceTime, gapMs, source, captureMode,
        quoteIsFresh ? contract.optionPrice : null, quoteIsFresh ? contract.optionPriceSource : null,
        estimatedPremiumUsd, contract.multiplier, contract.multiplierAssumed ? 1 : 0,
        underlyingSpot, spotTime, spotAgeMs, quoteTime, quoteAgeMs
      );
      this.#saveState(contract, sessionDate, observed, sourceTime, source);
      this.db.exec('RELEASE SAVEPOINT volume_delta_capture');
    } catch (error) {
      this.db.exec('ROLLBACK TO SAVEPOINT volume_delta_capture');
      this.db.exec('RELEASE SAVEPOINT volume_delta_capture');
      throw error;
    }
    const event = {
      symbol: contract.symbol,
      expiry: contract.expiry,
      optionSymbol: contract.optionSymbol,
      strike: contract.strike,
      optionType: contract.side,
      volumeDelta: delta,
      volumeTotal: contract.volume,
      observedAt: observed,
      intervalFrom: previous.lastSeenAt,
      sourceTimeMs: sourceTime,
      gapMs,
      source,
      captureMode,
      optionPrice: quoteIsFresh ? contract.optionPrice : null,
      optionPriceSource: quoteIsFresh ? contract.optionPriceSource : null,
      estimatedPremiumUsd,
      multiplier: contract.multiplier,
      multiplierAssumed: contract.multiplierAssumed,
      underlyingSpot,
      spotTimeMs: spotTime,
      spotAgeMs,
      quoteTimeMs: quoteTime,
      quoteAgeMs
    };
    this.memoryState.set(contract.optionSymbol, { volume: contract.volume, lastSeenAt: observed, sourceTimeMs: sourceTime, sessionDate });
    return { accepted: true, changed: true, event };
  }

  #saveState(contract, sessionDate, observed, sourceTime, source) {
    this.insertState.run(
      contract.optionSymbol, contract.symbol, contract.expiry, contract.strike,
      contract.side, contract.volume, sessionDate, observed, sourceTime, source
    );
  }

  getStatusCounts() {
    const events = this.db.prepare('SELECT COUNT(*) AS count FROM volume_events').get();
    const contracts = this.db.prepare('SELECT COUNT(*) AS count FROM volume_contract_state').get();
    const latest = this.db.prepare('SELECT MAX(observed_at_ms) AS latest FROM volume_events').get();
    return {
      eventCount: Number(events?.count || 0),
      contractCount: Number(contracts?.count || 0),
      lastEventAt: latest?.latest === null || latest?.latest === undefined ? null : Number(latest.latest)
    };
  }

  listEvents({ symbol = '', expiry = '', from = null, to = null, limit = 500 } = {}) {
    const where = [];
    const params = [];
    const normalizedSymbol = String(symbol || '').toUpperCase();
    if (normalizedSymbol) {
      if (!ALLOWED_SYMBOLS.has(normalizedSymbol)) throw new Error('symbol must be GLD or QQQ.');
      where.push('symbol = ?'); params.push(normalizedSymbol);
    }
    if (expiry) { where.push('expiry = ?'); params.push(String(expiry)); }
    const fromMs = from === null ? null : parseTime(from, null);
    const toMs = to === null ? null : parseTime(to, null);
    if (fromMs !== null) { where.push('observed_at_ms >= ?'); params.push(fromMs); }
    if (toMs !== null) { where.push('observed_at_ms <= ?'); params.push(toMs); }
    const count = Math.max(1, Math.min(20_000, Number(limit) || 500));
    const sql = `SELECT id, symbol, expiry, option_symbol AS optionSymbol, strike,
      option_type AS optionType, volume_delta AS volumeDelta, volume_total AS volumeTotal,
      observed_at_ms AS observedAt, interval_from_ms AS intervalFrom,
      source_time_ms AS sourceTimeMs, gap_ms AS gapMs, source, capture_mode AS captureMode,
      option_price AS optionPrice, option_price_source AS optionPriceSource,
      estimated_premium_usd AS estimatedPremiumUsd, multiplier, multiplier_assumed AS multiplierAssumed,
      underlying_spot AS underlyingSpot, spot_time_ms AS spotTimeMs, spot_age_ms AS spotAgeMs,
      quote_time_ms AS quoteTimeMs, quote_age_ms AS quoteAgeMs
      FROM volume_events ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY observed_at_ms DESC, id DESC LIMIT ?`;
    return this.db.prepare(sql).all(...params, count);
  }

  listContracts({ symbol = '', expiry = '', limit = 2000 } = {}) {
    const where = [];
    const params = [];
    const normalizedSymbol = String(symbol || '').toUpperCase();
    if (normalizedSymbol) {
      if (!ALLOWED_SYMBOLS.has(normalizedSymbol)) throw new Error('symbol must be GLD or QQQ.');
      where.push('symbol = ?'); params.push(normalizedSymbol);
    }
    if (expiry) { where.push('expiry = ?'); params.push(String(expiry)); }
    const count = Math.max(1, Math.min(5000, Number(limit) || 2000));
    const sql = `SELECT symbol, expiry, option_symbol AS optionSymbol, strike,
      option_type AS optionType, volume_total AS volumeTotal,
      last_seen_at_ms AS lastSeenAt, last_source_time_ms AS sourceTimeMs, source
      FROM volume_contract_state ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY symbol, expiry, strike, option_type LIMIT ?`;
    return this.db.prepare(sql).all(...params, count);
  }

  close() {
    this.db.close();
  }
}

export { DEFAULT_DB_PATH, normaliseContract };
