import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DB_PATH = process.env.VOLUME_FLOW_DB_PATH || path.join(moduleDir, 'data', 'gexadecimal-volume-flow.sqlite');
const ALLOWED = new Set(['GLD', 'QQQ']);

function cleanSymbol(value) {
  const symbol = String(value || '').toUpperCase();
  if (!ALLOWED.has(symbol)) throw new Error('symbol must be GLD or QQQ.');
  return symbol;
}

function asDate(value) {
  const date = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('expiry must use YYYY-MM-DD.');
  return date;
}

function newYorkDate(timestamp) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date(timestamp));
}

function preserveNonNull(oldValue, newValue) {
  if (newValue === null || newValue === undefined || newValue === '') return oldValue;
  return newValue;
}

function timestampMs(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'number' && Number.isFinite(value)) return value < 1e12 ? Math.round(value * 1000) : Math.round(value);
  if (typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value.trim())) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? (numeric < 1e12 ? Math.round(numeric * 1000) : Math.round(numeric)) : fallback;
  }
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function hasUsableOptionQuote(item = {}) {
  const value = keys => {
    for (const key of keys) {
      const raw = item?.[key];
      if (raw !== null && raw !== undefined && raw !== '' && Number.isFinite(Number(raw)) && Number(raw) > 0) return Number(raw);
    }
    return null;
  };
  const bid = value(['bid', 'bidPrice', 'bp']);
  const ask = value(['ask', 'askPrice', 'ap']);
  const mid = value(['mid', 'midPrice', 'mp']);
  const last = value(['last', 'lastPrice', 'p', 'l']);
  return (bid !== null && ask !== null && ask >= bid) || mid !== null || last !== null;
}

export class OptionsChainStore {
  constructor({ dbPath = DEFAULT_DB_PATH, now = () => Date.now() } = {}) {
    this.dbPath = dbPath;
    this.now = now;
    if (dbPath !== ':memory:') mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.quoteSeenAt = new Map();
    this.db.exec(`
      PRAGMA journal_mode=WAL;
      PRAGMA synchronous=NORMAL;
      PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS option_chain_expiries (
        symbol TEXT NOT NULL,
        expiry TEXT NOT NULL,
        contract_count INTEGER NOT NULL DEFAULT 0,
        quote_count INTEGER NOT NULL DEFAULT 0,
        updated_at_ms INTEGER NOT NULL,
        source TEXT NOT NULL,
        PRIMARY KEY(symbol, expiry)
      );
      CREATE TABLE IF NOT EXISTS option_chain_contracts (
        option_symbol TEXT PRIMARY KEY,
        symbol TEXT NOT NULL,
        expiry TEXT NOT NULL,
        strike REAL NOT NULL,
        option_type TEXT NOT NULL CHECK(option_type IN ('C','P')),
        volume REAL,
        updated_at_ms INTEGER NOT NULL,
        source TEXT NOT NULL,
        data_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_option_chain_contracts_expiry
        ON option_chain_contracts(symbol, expiry, strike, option_type);
      CREATE INDEX IF NOT EXISTS idx_option_chain_contracts_updated
        ON option_chain_contracts(updated_at_ms DESC);
    `);
    for (const row of this.db.prepare('SELECT option_symbol,data_json FROM option_chain_contracts').all()) {
      try {
        const data = JSON.parse(row.data_json) || {};
        const quoteAt = timestampMs(data.quoteUpdatedAt, null);
        if (quoteAt !== null) this.quoteSeenAt.set(row.option_symbol, quoteAt);
      } catch {}
    }
  }

  replaceExpiryInventory(symbolValue, expiries, { source = 'exchange-info', updatedAt = this.now() } = {}) {
    const symbol = cleanSymbol(symbolValue);
    const rows = [...new Map((Array.isArray(expiries) ? expiries : []).map(item => {
      const expiry = asDate(item.expiry ?? item.date);
      return [expiry, { expiry, contractCount: Math.max(0, Number(item.contract_count ?? item.contractCount) || 0) }];
    })).values()].sort((a, b) => a.expiry.localeCompare(b.expiry));
    this.db.exec('SAVEPOINT replace_expiry_inventory');
    try {
      // Merge inventory instead of deleting the previous list. If Binance's
      // webpage is temporarily unavailable and Exchange Info returns only a
      // short list, already-cached long-dated expiries must remain accessible.
      const insert = this.db.prepare(`INSERT INTO option_chain_expiries
        (symbol,expiry,contract_count,quote_count,updated_at_ms,source) VALUES (?,?,?,?,?,?)
        ON CONFLICT(symbol,expiry) DO UPDATE SET
          contract_count=CASE WHEN excluded.contract_count>0 THEN excluded.contract_count ELSE option_chain_expiries.contract_count END,
          updated_at_ms=excluded.updated_at_ms,source=excluded.source`);
      for (const row of rows) insert.run(symbol, row.expiry, row.contractCount, 0, updatedAt, source);
      this.db.exec('RELEASE SAVEPOINT replace_expiry_inventory');
    } catch (error) {
      this.db.exec('ROLLBACK TO SAVEPOINT replace_expiry_inventory');
      this.db.exec('RELEASE SAVEPOINT replace_expiry_inventory');
      throw error;
    }
    return rows.length;
  }

  saveChainSnapshot(snapshot, { source = 'rest-bootstrap', updatedAt = this.now() } = {}) {
    const symbol = cleanSymbol(snapshot?.symbol);
    const expiry = asDate(snapshot?.expiry);
    const contracts = Array.isArray(snapshot?.contracts) ? snapshot.contracts : [];
    const valid = contracts.filter(item => item && item.optionSymbol && Number(item.strike) > 0 && ['C','P'].includes(item.side));
    this.db.exec('SAVEPOINT save_chain_snapshot');
    try {
      this.db.prepare('INSERT INTO option_chain_expiries(symbol,expiry,contract_count,quote_count,updated_at_ms,source) VALUES(?,?,?,?,?,?)\n        ON CONFLICT(symbol,expiry) DO UPDATE SET contract_count=excluded.contract_count,quote_count=excluded.quote_count,updated_at_ms=excluded.updated_at_ms,source=excluded.source')
        .run(symbol, expiry, Number(snapshot.total_contracts) || valid.length, Number(snapshot.quote_count) || 0, updatedAt, source);
      this.db.prepare('DELETE FROM option_chain_contracts WHERE symbol=? AND expiry=?').run(symbol, expiry);
      const insert = this.db.prepare(`INSERT INTO option_chain_contracts
        (option_symbol,symbol,expiry,strike,option_type,volume,updated_at_ms,source,data_json)
        VALUES(?,?,?,?,?,?,?,?,?)`);
      for (const item of valid) {
        const data = { ...item, symbol, expiry, expiration: expiry };
        if (hasUsableOptionQuote(item)) {
          data.quoteUpdatedAt = item.quoteUpdatedAt ?? updatedAt;
          this.quoteSeenAt.set(String(item.optionSymbol).toUpperCase(), timestampMs(data.quoteUpdatedAt, updatedAt));
        }
        insert.run(item.optionSymbol, symbol, expiry, Number(item.strike), item.side,
          Number.isFinite(Number(item.volume)) ? Number(item.volume) : null, updatedAt, source, JSON.stringify(data));
      }
      this.db.exec('RELEASE SAVEPOINT save_chain_snapshot');
    } catch (error) {
      this.db.exec('ROLLBACK TO SAVEPOINT save_chain_snapshot');
      this.db.exec('RELEASE SAVEPOINT save_chain_snapshot');
      throw error;
    }
    return { saved: valid.length, total: Number(snapshot.total_contracts) || valid.length };
  }

  hasChain(symbolValue, expiryValue) {
    const symbol = cleanSymbol(symbolValue), expiry = asDate(expiryValue);
    const row = this.db.prepare('SELECT COUNT(*) AS n FROM option_chain_contracts WHERE symbol=? AND expiry=?').get(symbol, expiry);
    return Number(row?.n || 0) > 0;
  }

  needsHydration(symbolValue, expiryValue) {
    const symbol = cleanSymbol(symbolValue), expiry = asDate(expiryValue);
    const meta = this.db.prepare('SELECT contract_count FROM option_chain_expiries WHERE symbol=? AND expiry=?').get(symbol, expiry);
    const stored = Number(this.db.prepare('SELECT COUNT(*) AS n FROM option_chain_contracts WHERE symbol=? AND expiry=?').get(symbol, expiry)?.n || 0);
    return !meta || stored === 0 || stored < Number(meta.contract_count || 0);
  }

  // Merge a refreshed full-expiry snapshot into the cache. Existing rows are
  // compared field-by-field and only inserted/updated when values actually differ.
  // This is the REST scanner's incremental write path; it never deletes/reinserts
  // an unchanged option chain every time an expiry is checked.
  mergeChainSnapshot(snapshot, { source = 'rest-scan', updatedAt = this.now() } = {}) {
    const symbol = cleanSymbol(snapshot?.symbol);
    const expiry = asDate(snapshot?.expiry);
    const contracts = Array.isArray(snapshot?.contracts) ? snapshot.contracts : [];
    const valid = contracts.filter(item => item && item.optionSymbol && Number(item.strike) > 0 && ['C', 'P'].includes(item.side));
    const select = this.db.prepare('SELECT data_json FROM option_chain_contracts WHERE option_symbol=?');
    const insert = this.db.prepare(`INSERT INTO option_chain_contracts
      (option_symbol,symbol,expiry,strike,option_type,volume,updated_at_ms,source,data_json)
      VALUES(?,?,?,?,?,?,?,?,?)`);
    const update = this.db.prepare(`UPDATE option_chain_contracts
      SET strike=?,option_type=?,volume=?,updated_at_ms=?,source=?,data_json=? WHERE option_symbol=?`);
    let inserted = 0, changed = 0, unchanged = 0;
    this.db.exec('SAVEPOINT merge_chain_snapshot');
    try {
      for (const item of valid) {
        const optionSymbol = String(item.optionSymbol).toUpperCase();
        const existing = select.get(optionSymbol);
        const incoming = { ...item, optionSymbol, symbol, expiry, expiration: expiry };
        if (!existing) {
          if (hasUsableOptionQuote(item)) {
            incoming.quoteUpdatedAt = item.quoteUpdatedAt ?? updatedAt;
            this.quoteSeenAt.set(optionSymbol, timestampMs(incoming.quoteUpdatedAt, updatedAt));
          }
          insert.run(optionSymbol, symbol, expiry, Number(item.strike), item.side,
            Number.isFinite(Number(item.volume)) ? Number(item.volume) : null,
            updatedAt, source, JSON.stringify(incoming));
          inserted++;
          continue;
        }
        let previous = {};
        try { previous = JSON.parse(existing.data_json) || {}; } catch {}
        const merged = { ...previous };
        for (const [key, value] of Object.entries(incoming)) {
          if (value !== null && value !== undefined && value !== '') merged[key] = value;
        }
        if (hasUsableOptionQuote(item)) {
          const observedQuoteAt = timestampMs(item.quoteUpdatedAt, updatedAt);
          this.quoteSeenAt.set(optionSymbol, observedQuoteAt);
          const quoteFields = ['bid', 'ask', 'mid', 'last'];
          const quoteChanged = quoteFields.some(field => {
            const before = previous[field] == null ? null : Number(previous[field]);
            const after = merged[field] == null ? null : Number(merged[field]);
            return before !== after;
          });
          // Do not turn an unchanged REST snapshot into a quote refresh merely
          // because the scanner fetched it again. Preserve the original quote
          // timestamp unless the actual quote values changed.
          if (quoteChanged || !merged.quoteUpdatedAt) merged.quoteUpdatedAt = observedQuoteAt;
        }
        const nextJson = JSON.stringify(merged);
        if (nextJson === existing.data_json) {
          unchanged++;
          continue;
        }
        update.run(Number(merged.strike), merged.side, Number.isFinite(Number(merged.volume)) ? Number(merged.volume) : null,
          updatedAt, source, nextJson, optionSymbol);
        changed++;
      }
      const meta = this.db.prepare('SELECT contract_count,quote_count FROM option_chain_expiries WHERE symbol=? AND expiry=?').get(symbol, expiry);
      const total = Number(snapshot.total_contracts) || valid.length;
      const quoteCount = Number(snapshot.quote_count) || 0;
      if (!meta) {
        this.db.prepare(`INSERT INTO option_chain_expiries
          (symbol,expiry,contract_count,quote_count,updated_at_ms,source) VALUES(?,?,?,?,?,?)`)
          .run(symbol, expiry, total, quoteCount, updatedAt, source);
      } else if (inserted || changed || Number(meta.contract_count) !== total || Number(meta.quote_count) !== quoteCount) {
        this.db.prepare(`UPDATE option_chain_expiries SET contract_count=?,quote_count=?,updated_at_ms=?,source=?
          WHERE symbol=? AND expiry=?`).run(total, quoteCount, updatedAt, source, symbol, expiry);
      }
      this.db.exec('RELEASE SAVEPOINT merge_chain_snapshot');
    } catch (error) {
      this.db.exec('ROLLBACK TO SAVEPOINT merge_chain_snapshot');
      this.db.exec('RELEASE SAVEPOINT merge_chain_snapshot');
      throw error;
    }
    return { checked: valid.length, inserted, changed, unchanged, total: Number(snapshot.total_contracts) || valid.length };
  }

  mergeLiveContracts(symbolValue, expiryValue, contracts, { source = 'websocket', updatedAt = this.now() } = {}) {
    const symbol = cleanSymbol(symbolValue), expiry = asDate(expiryValue);
    const select = this.db.prepare('SELECT data_json FROM option_chain_contracts WHERE option_symbol=?');
    const update = this.db.prepare(`UPDATE option_chain_contracts
      SET strike=?,option_type=?,volume=?,updated_at_ms=?,source=?,data_json=? WHERE option_symbol=?`);
    let changed = 0, unchanged = 0, missing = 0;
    this.db.exec('SAVEPOINT merge_live_contracts');
    try {
      for (const raw of Array.isArray(contracts) ? contracts : []) {
        const optionSymbol = String(raw?.optionSymbol ?? raw?.os ?? raw?.symbol ?? '').toUpperCase();
        if (!optionSymbol) continue;
        const row = select.get(optionSymbol);
        if (!row) { missing++; continue; }
        let previous;
        try { previous = JSON.parse(row.data_json); } catch { previous = {}; }
        const next = { ...previous };
        const mapping = {
          side: ['side','contractType','optionType','t'], strike: ['strike','strikePrice','sp','k'],
          volume: ['volume','v'], openInterest: ['openInterest','oi'], multiplier: ['multiplier','m'],
          iv: ['iv','impliedVolatility','markIV','markIv','mark_iv'], gamma: ['gamma','ga'], delta: ['delta','de'],
          theta: ['theta','th'], vega: ['vega','ve'], last: ['last','lastPrice','p','l'],
          bid: ['bid','bidPrice','bp'], ask: ['ask','askPrice','ap'], mid: ['mid','midPrice','mp'],
          bidSize: ['bidSize','bs'], askSize: ['askSize','as'], previousClose: ['previousClose','pcp']
        };
        for (const [field, keys] of Object.entries(mapping)) {
          for (const key of keys) {
            if (Object.prototype.hasOwnProperty.call(raw, key)) {
              if (raw[key] !== null && raw[key] !== undefined && raw[key] !== '') next[field] = raw[key];
              break;
            }
          }
        }
        if (hasUsableOptionQuote(raw)) {
          next.quoteUpdatedAt = updatedAt;
          this.quoteSeenAt.set(optionSymbol, updatedAt);
        }
        const nextJson = JSON.stringify(next);
        if (nextJson === row.data_json) { unchanged++; continue; }
        const volume = Number.isFinite(Number(next.volume)) ? Number(next.volume) : null;
        update.run(Number(next.strike) || 0, next.side || 'C', volume, updatedAt, source, nextJson, optionSymbol);
        changed++;
      }
      if (changed) this.db.prepare('UPDATE option_chain_expiries SET updated_at_ms=?,source=? WHERE symbol=? AND expiry=?').run(updatedAt, source, symbol, expiry);
      this.db.exec('RELEASE SAVEPOINT merge_live_contracts');
    } catch (error) {
      this.db.exec('ROLLBACK TO SAVEPOINT merge_live_contracts');
      this.db.exec('RELEASE SAVEPOINT merge_live_contracts');
      throw error;
    }
    return { changed, unchanged, missing };
  }

  listExpiries(symbolValue) {
    const symbol = cleanSymbol(symbolValue);
    return this.db.prepare(`SELECT e.expiry,e.contract_count AS contractCount,e.quote_count AS quoteCount,
      e.updated_at_ms AS updatedAt,e.source,
      (SELECT COUNT(*) FROM option_chain_contracts c WHERE c.symbol=e.symbol AND c.expiry=e.expiry) AS storedContracts
      FROM option_chain_expiries e WHERE e.symbol=? AND e.expiry>=? ORDER BY e.expiry`)
      .all(symbol, newYorkDate(this.now())).map(row => ({ ...row, updatedAt: Number(row.updatedAt), storedContracts: Number(row.storedContracts), ready: Number(row.storedContracts) > 0 }));
  }

  getContract(optionSymbolValue) {
    const optionSymbol = String(optionSymbolValue || '').trim().toUpperCase();
    if (!optionSymbol) return null;
    const row = this.db.prepare('SELECT data_json,updated_at_ms AS updatedAt,source FROM option_chain_contracts WHERE option_symbol=?').get(optionSymbol);
    if (!row) return null;
    try {
      const data = JSON.parse(row.data_json);
      const quoteUpdatedAt = this.quoteSeenAt.get(optionSymbol) ?? timestampMs(data.quoteUpdatedAt, null);
      return { ...data, ...(quoteUpdatedAt !== null ? { quoteUpdatedAt } : {}), optionSymbol, cacheUpdatedAt: Number(row.updatedAt), cacheSource: row.source };
    } catch {
      return null;
    }
  }

  getChain(symbolValue, expiryValue) {
    const symbol = cleanSymbol(symbolValue), expiry = asDate(expiryValue);
    const meta = this.db.prepare(`SELECT contract_count AS totalContracts,quote_count AS quoteCount,
      updated_at_ms AS updatedAt,source FROM option_chain_expiries WHERE symbol=? AND expiry=?`).get(symbol, expiry);
    if (!meta) return null;
    const rows = this.db.prepare(`SELECT data_json FROM option_chain_contracts WHERE symbol=? AND expiry=?
      ORDER BY strike,option_type`).all(symbol, expiry);
    if (!rows.length) return null;
    return {
      ok: true, symbol, expiry, updated_at: new Date(Number(meta.updatedAt)).toISOString(),
      total_contracts: Number(meta.totalContracts), quote_count: Number(meta.quoteCount),
      stored_contracts: rows.length, source: meta.source,
      contracts: rows.map(row => {
        try {
          const data = JSON.parse(row.data_json);
          const optionSymbol = String(data.optionSymbol || '').toUpperCase();
          const quoteUpdatedAt = this.quoteSeenAt.get(optionSymbol) ?? timestampMs(data.quoteUpdatedAt, null);
          return { ...data, ...(quoteUpdatedAt !== null ? { quoteUpdatedAt } : {}) };
        } catch { return null; }
      }).filter(Boolean)
    };
  }

  status() {
    const expiries = this.db.prepare('SELECT COUNT(*) AS n FROM option_chain_expiries').get().n;
    const contracts = this.db.prepare('SELECT COUNT(*) AS n FROM option_chain_contracts').get().n;
    const symbols = {};
    for (const symbol of ALLOWED) {
      symbols[symbol] = {
        expiries: Number(this.db.prepare('SELECT COUNT(*) AS n FROM option_chain_expiries WHERE symbol=?').get(symbol).n),
        contracts: Number(this.db.prepare('SELECT COUNT(*) AS n FROM option_chain_contracts WHERE symbol=?').get(symbol).n)
      };
    }
    return { dbPath: this.dbPath, expiries: Number(expiries), contracts: Number(contracts), symbols };
  }

  close() { this.db.close(); }
}

export { DEFAULT_DB_PATH };
