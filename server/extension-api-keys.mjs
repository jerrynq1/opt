import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync, renameSync, statSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_KEY_STORE_PATH = path.join(moduleDir, 'extension-api-keys.json');
const KEY_PATTERN = /^ql_live_[a-f0-9]{64}$/i;
const DEFAULT_RATE_LIMIT = 60;
const MAX_RATE_LIMIT = 120;

function sha256(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function safeEqualHex(left, right) {
  if (!/^[a-f0-9]{64}$/i.test(String(left || '')) || !/^[a-f0-9]{64}$/i.test(String(right || ''))) return false;
  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

function readDatabase(filePath) {
  if (!existsSync(filePath)) return { version: 1, keys: [] };
  const parsed = JSON.parse(readFileSync(filePath, 'utf8'));
  if (parsed?.version !== 1 || !Array.isArray(parsed.keys)) {
    throw new Error(`Invalid Extension API key store format: ${filePath}`);
  }
  return parsed;
}

function writeDatabase(filePath, database) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${randomBytes(5).toString('hex')}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(database, null, 2)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  try {
    renameSync(temporary, filePath);
  } catch (error) {
    // Windows may reject replacement when the target already exists. Remove only
    // the database file, never a token/key material file, then complete the atomic move.
    if (existsSync(filePath)) {
      const backup = `${filePath}.${process.pid}.bak`;
      renameSync(filePath, backup);
      try {
        renameSync(temporary, filePath);
        try { rmSync(backup, { force: true }); } catch {}
      } catch (moveError) {
        try { renameSync(backup, filePath); } catch {}
        throw moveError;
      }
    } else {
      throw error;
    }
  }
}

function activeRecord(record, now) {
  return record && !record.revokedAt && (!record.expiresAt || Date.parse(record.expiresAt) > now);
}

export function createExtensionApiKey({ name, scopes = ['market:read'], rateLimitPerMinute = DEFAULT_RATE_LIMIT, expiresInDays = null, now = new Date() }) {
  const cleanName = String(name || '').trim().replace(/[\r\n\t]/g, ' ').slice(0, 80);
  if (!cleanName) throw new Error('API key name is required.');
  const allowedScopes = new Set(['market:read']);
  const normalizedScopes = [...new Set((Array.isArray(scopes) ? scopes : [scopes]).map(x => String(x).trim()).filter(Boolean))];
  if (!normalizedScopes.length || normalizedScopes.some(scope => !allowedScopes.has(scope))) {
    throw new Error('Allowed scope: market:read.');
  }
  const rate = Number(rateLimitPerMinute);
  if (!Number.isInteger(rate) || rate < 1 || rate > MAX_RATE_LIMIT) {
    throw new Error(`Rate limit must be an integer between 1 and ${MAX_RATE_LIMIT} requests/minute.`);
  }
  const key = `ql_live_${randomBytes(32).toString('hex')}`;
  const id = `qak_${randomBytes(6).toString('hex')}`;
  const createdAt = new Date(now).toISOString();
  const days = expiresInDays === null || expiresInDays === undefined || expiresInDays === '' ? null : Number(expiresInDays);
  if (days !== null && (!Number.isInteger(days) || days < 1 || days > 3650)) throw new Error('expiresInDays must be between 1 and 3650.');
  const expiresAt = days === null ? null : new Date(new Date(now).getTime() + days * 86_400_000).toISOString();
  return {
    key,
    record: {
      id,
      name: cleanName,
      keyHash: sha256(key),
      keyPrefix: `${key.slice(0, 15)}…${key.slice(-6)}`,
      scopes: normalizedScopes,
      rateLimitPerMinute: rate,
      createdAt,
      expiresAt,
      revokedAt: null,
    }
  };
}

export function createExtensionApiKeyStore({ filePath = DEFAULT_KEY_STORE_PATH, clock = () => Date.now() } = {}) {
  const rateWindows = new Map();
  let cachedSignature = '';
  let cachedDatabase = { version: 1, keys: [] };

  function database({ force = false } = {}) {
    if (!existsSync(filePath)) {
      cachedSignature = '';
      cachedDatabase = { version: 1, keys: [] };
      return cachedDatabase;
    }
    const stat = statSync(filePath, { bigint: true });
    const signature = `${stat.mtimeNs}:${stat.ctimeNs}:${stat.size}`;
    if (force || signature !== cachedSignature) {
      cachedDatabase = readDatabase(filePath);
      cachedSignature = signature;
    }
    return cachedDatabase;
  }

  function authenticate(token) {
    const candidate = String(token || '').trim();
    if (!KEY_PATTERN.test(candidate)) return { ok: false, reason: 'invalid_key' };
    const candidateHash = sha256(candidate);
    const db = database();
    let match = null;
    for (const record of db.keys) {
      if (safeEqualHex(candidateHash, record.keyHash)) match = record;
    }
    if (!match) return { ok: false, reason: 'invalid_key' };
    const now = clock();
    if (!activeRecord(match, now)) return { ok: false, reason: 'revoked_or_expired' };
    return { ok: true, key: match };
  }

  function consumeRateLimit(record) {
    const now = clock();
    const windowMs = 60_000;
    let window = rateWindows.get(record.id);
    if (!window || now >= window.resetAt) window = { count: 0, resetAt: now + windowMs };
    if (rateWindows.size > 4096) {
      for (const [id, entry] of rateWindows) if (now >= entry.resetAt) rateWindows.delete(id);
      while (rateWindows.size > 4096) rateWindows.delete(rateWindows.keys().next().value);
    }
    if (window.count >= record.rateLimitPerMinute) {
      rateWindows.set(record.id, window);
      return { allowed: false, limit: record.rateLimitPerMinute, remaining: 0, resetAt: window.resetAt };
    }
    window.count++;
    rateWindows.set(record.id, window);
    return { allowed: true, limit: record.rateLimitPerMinute, remaining: Math.max(0, record.rateLimitPerMinute - window.count), resetAt: window.resetAt };
  }

  function authorize(request, requiredScope = 'market:read') {
    const token = request.headers.get('x-api-key') || '';
    const result = authenticate(token);
    if (!result.ok) return { ok: false, status: 401, error: 'Invalid or inactive API key.' };
    if (!Array.isArray(result.key.scopes) || !result.key.scopes.includes(requiredScope)) {
      return { ok: false, status: 403, error: `API key is missing the ${requiredScope} permission.` };
    }
    const rate = consumeRateLimit(result.key);
    if (!rate.allowed) return { ok: false, status: 429, error: 'API rate limit exceeded.', rate };
    return { ok: true, key: result.key, rate };
  }

  function saveKeys(keys) {
    const next = { version: 1, keys };
    writeDatabase(filePath, next);
    cachedDatabase = next;
    const stat = statSync(filePath, { bigint: true });
    cachedSignature = `${stat.mtimeNs}:${stat.ctimeNs}:${stat.size}`;
  }

  function create(options) {
    const generated = createExtensionApiKey(options);
    const db = database({ force: true });
    db.keys.push(generated.record);
    saveKeys(db.keys);
    return { key: generated.key, record: { ...generated.record, keyHash: undefined } };
  }

  function list() {
    const db = database({ force: true });
    const now = clock();
    return db.keys.map(({ keyHash, ...record }) => ({ ...record, active: activeRecord(record, now) }));
  }

  function revoke(id) {
    const db = database({ force: true });
    const record = db.keys.find(item => item.id === id);
    if (!record) return false;
    if (!record.revokedAt) record.revokedAt = new Date(clock()).toISOString();
    saveKeys(db.keys);
    return true;
  }

  return { filePath, authenticate, authorize, create, list, revoke };
}

export function formatApiKeyForDisplay(record) {
  return {
    id: record.id,
    name: record.name,
    keyPrefix: record.keyPrefix,
    scopes: record.scopes,
    rateLimitPerMinute: record.rateLimitPerMinute,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
    revokedAt: record.revokedAt,
    active: record.active ?? !record.revokedAt
  };
}
