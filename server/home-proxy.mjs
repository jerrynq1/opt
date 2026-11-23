// Local Node.js gateway for QuantLab PWA + iOS Quick Options.
// Requires Node.js 22+ (native global WebSocket; no npm packages required).
// Start: node server/home-proxy.mjs
// Public Node API is exposed through the existing Cloudflare Named Tunnel on port 8788.
import http from 'node:http';
import worker from '../worker/index.js';
import { createQuickOptionsService } from './quick-options.mjs';
import { createEquityPriceFeed } from './equity-price-feed.mjs';
import { createExtensionApiKeyStore } from './extension-api-keys.mjs';
import { createExtensionOptionsApi } from './extension-options-api.mjs';
import { createVolumeFlowCollector } from './volume-flow-collector.mjs';
import { OptionsChainStore } from './options-chain-store.mjs';

const PORT = Number(process.env.PORT || 8788);
const env = { ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || '*' };
const spotFeed = createEquityPriceFeed();
// Warm the shared Binance cache as soon as the scheduled Node gateway starts.
// Integration tests can opt out so they remain deterministic and offline.
if (process.env.DISABLE_SPOT_PREWARM !== '1') spotFeed.connect();
const quickOptions = createQuickOptionsService({ worker, env, spotFeed });
const extensionKeys = createExtensionApiKeyStore({ filePath: process.env.EXTENSION_API_KEY_STORE_PATH || undefined });
const extensionApi = createExtensionOptionsApi({ keyStore: extensionKeys, optionsService: quickOptions });
const optionsChainStore = new OptionsChainStore({ dbPath: process.env.VOLUME_FLOW_DB_PATH || undefined });
const volumeCollector = createVolumeFlowCollector({ optionsService: quickOptions, chainStore: optionsChainStore, spotFeed });
const volumeCollectorEnabled = process.env.DISABLE_VOLUME_COLLECTOR !== '1';
if (volumeCollectorEnabled) {
  volumeCollector.start().then(status => {
    console.log(`[Volume Flow] ${status.state}: ${status.detail || 'collector started'}`);
  }).catch(error => console.error('[Volume Flow] startup error:', error?.message || error));
}

function corsFor(origin = '') {
  const allowed = String(env.ALLOWED_ORIGINS || '*').split(',').map(value => value.trim()).filter(Boolean);
  const ok = allowed.includes('*') || allowed.includes(origin);
  return {
    'access-control-allow-origin': ok ? (allowed.includes('*') ? '*' : origin) : 'null',
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'Authorization, X-API-Key, Accept, Content-Type',
    'access-control-max-age': '86400',
    'vary': 'Origin'
  };
}

function jsonResponse(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      ...headers
    }
  });
}

async function sendResponse(res, response) {
  const headers = Object.fromEntries(response.headers);
  delete headers['content-encoding'];
  delete headers['content-length'];
  res.writeHead(response.status, headers);
  res.end(Buffer.from(await response.arrayBuffer()));
}

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const origin = req.headers.origin || '';
    const cors = corsFor(origin);

    if (requestUrl.pathname === '/api/spot' || requestUrl.pathname === '/api/spot/status') {
      if (req.method === 'OPTIONS') {
        if (cors['access-control-allow-origin'] === 'null') {
          await sendResponse(res, jsonResponse({ ok: false, error: 'Origin not allowed.' }, 403));
        } else {
          res.writeHead(204, cors);
          res.end();
        }
        return;
      }
      if (cors['access-control-allow-origin'] === 'null') {
        await sendResponse(res, jsonResponse({ ok: false, error: 'Origin not allowed.' }, 403));
        return;
      }
      if (req.method !== 'GET') {
        await sendResponse(res, jsonResponse({ ok: false, error: 'Only GET is allowed.' }, 405, cors));
        return;
      }
      if (requestUrl.pathname === '/api/spot/status') {
        await sendResponse(res, jsonResponse({ ok: true, feed: spotFeed.status() }, 200, cors));
        return;
      }
      const symbol = String(requestUrl.searchParams.get('symbol') || 'GLD').toUpperCase();
      if (!['GLD', 'QQQ'].includes(symbol)) {
        await sendResponse(res, jsonResponse({ ok: false, error: 'Only GLD and QQQ are supported.' }, 400, cors));
        return;
      }
      const timeoutMs = Math.max(1_000, Math.min(12_000, Number(requestUrl.searchParams.get('timeout')) || 8_000));
      try {
        const snapshot = await spotFeed.get(symbol, { timeoutMs });
        await sendResponse(res, jsonResponse({ ...snapshot, ok: true }, 200, cors));
      } catch (error) {
        await sendResponse(res, jsonResponse({
          ok: false,
          symbol,
          error: error?.message || String(error),
          feed: spotFeed.status()
        }, 503, cors));
      }
      return;
    }

    if (requestUrl.pathname.startsWith('/api/options-cache')) {
      if (req.method === 'OPTIONS') {
        if (cors['access-control-allow-origin'] === 'null') {
          await sendResponse(res, jsonResponse({ ok: false, error: 'Origin not allowed.' }, 403));
        } else { res.writeHead(204, cors); res.end(); }
        return;
      }
      if (cors['access-control-allow-origin'] === 'null') {
        await sendResponse(res, jsonResponse({ ok: false, error: 'Origin not allowed.' }, 403));
        return;
      }
      if (req.method !== 'GET') {
        await sendResponse(res, jsonResponse({ ok: false, error: 'Only GET is allowed.' }, 405, cors));
        return;
      }
      try {
        if (requestUrl.pathname === '/api/options-cache/status') {
          await sendResponse(res, jsonResponse({ ok: true, cache: optionsChainStore.status(), collector: volumeCollector.status() }, 200, cors));
          return;
        }
        const symbol = String(requestUrl.searchParams.get('symbol') || '').toUpperCase();
        if (!['GLD', 'QQQ'].includes(symbol)) {
          await sendResponse(res, jsonResponse({ ok: false, error: 'symbol must be GLD or QQQ.' }, 400, cors));
          return;
        }
        if (requestUrl.pathname === '/api/options-cache/expiries') {
          const expiries = optionsChainStore.listExpiries(symbol);
          await sendResponse(res, jsonResponse({ ok: true, symbol, count: expiries.length, expiries }, 200, cors));
          return;
        }
        if (requestUrl.pathname === '/api/options-cache/chain') {
          const expiry = String(requestUrl.searchParams.get('expiry') || '');
          if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry)) {
            await sendResponse(res, jsonResponse({ ok: false, error: 'expiry must use YYYY-MM-DD.' }, 400, cors));
            return;
          }
          const chain = optionsChainStore.getChain(symbol, expiry);
          if (!chain) {
            await sendResponse(res, jsonResponse({ ok: false, syncing: true, error: 'Expiry chưa được đồng bộ vào local database.', symbol, expiry }, 503, cors));
            return;
          }
          await sendResponse(res, jsonResponse(chain, 200, cors));
          return;
        }
        await sendResponse(res, jsonResponse({ ok: false, error: 'Not found.' }, 404, cors));
      } catch (error) {
        await sendResponse(res, jsonResponse({ ok: false, error: error?.message || String(error) }, 400, cors));
      }
      return;
    }

    if (requestUrl.pathname.startsWith('/api/volume-flow')) {
      if (req.method === 'OPTIONS') {
        if (cors['access-control-allow-origin'] === 'null') {
          await sendResponse(res, jsonResponse({ ok: false, error: 'Origin not allowed.' }, 403));
        } else {
          res.writeHead(204, cors);
          res.end();
        }
        return;
      }
      if (cors['access-control-allow-origin'] === 'null') {
        await sendResponse(res, jsonResponse({ ok: false, error: 'Origin not allowed.' }, 403));
        return;
      }
      if (req.method !== 'GET') {
        await sendResponse(res, jsonResponse({ ok: false, error: 'Only GET is allowed.' }, 405, cors));
        return;
      }
      try {
        if (requestUrl.pathname === '/api/volume-flow/status') {
          await sendResponse(res, jsonResponse(volumeCollector.status(), 200, cors));
          return;
        }
        const symbol = String(requestUrl.searchParams.get('symbol') || '').toUpperCase();
        const expiry = String(requestUrl.searchParams.get('expiry') || '');
        if (symbol && !['GLD', 'QQQ'].includes(symbol)) {
          await sendResponse(res, jsonResponse({ ok: false, error: 'symbol must be GLD or QQQ.' }, 400, cors));
          return;
        }
        if (expiry && !/^\d{4}-\d{2}-\d{2}$/.test(expiry)) {
          await sendResponse(res, jsonResponse({ ok: false, error: 'expiry must use YYYY-MM-DD.' }, 400, cors));
          return;
        }
        if (requestUrl.pathname === '/api/volume-flow/events') {
          const events = volumeCollector.store.listEvents({
            symbol,
            expiry,
            from: requestUrl.searchParams.get('from'),
            to: requestUrl.searchParams.get('to'),
            limit: requestUrl.searchParams.get('limit') || 500
          });
          await sendResponse(res, jsonResponse({ ok: true, count: events.length, events }, 200, cors));
          return;
        }
        if (requestUrl.pathname === '/api/volume-flow/contracts') {
          const contracts = volumeCollector.store.listContracts({ symbol, expiry, limit: requestUrl.searchParams.get('limit') || 2000 });
          await sendResponse(res, jsonResponse({ ok: true, count: contracts.length, contracts }, 200, cors));
          return;
        }
        await sendResponse(res, jsonResponse({ ok: false, error: 'Not found.' }, 404, cors));
      } catch (error) {
        await sendResponse(res, jsonResponse({ ok: false, error: error?.message || String(error) }, 400, cors));
      }
      return;
    }

    if (requestUrl.pathname === '/api/quick-options') {
      const quickRequest = new Request(requestUrl, { method: req.method, headers: req.headers });
      const response = await quickOptions.handle(quickRequest);
      await sendResponse(res, response);
      return;
    }

    if (requestUrl.pathname.startsWith('/api/extension/v1/')) {
      if (!['GET', 'OPTIONS'].includes(req.method)) req.resume();
      const extensionRequest = new Request(requestUrl, { method: req.method, headers: req.headers });
      const response = await extensionApi.handle(extensionRequest, cors);
      await sendResponse(res, response);
      return;
    }

    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const request = new Request(`http://${req.headers.host || 'localhost'}${req.url}`, {
      method: req.method,
      headers: req.headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : body
    });
    const response = await worker.fetch(request, env);
    await sendResponse(res, response);
  } catch (error) {
    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ error: 'home proxy error', detail: String(error?.message || error) }));
  }
});

server.listen(PORT, () => {
  console.log(`QuantLab home proxy: http://localhost:${PORT}/api/health`);
  console.log(`Spot diagnostics: http://localhost:${PORT}/api/spot/status`);
  console.log(`Spot GLD: http://localhost:${PORT}/api/spot?symbol=GLD`);
  console.log(`Spot QQQ: http://localhost:${PORT}/api/spot?symbol=QQQ`);
  console.log(`Quick Options GLD: http://localhost:${PORT}/api/quick-options?symbol=GLD`);
  console.log(`Options cache status: http://localhost:${PORT}/api/options-cache/status`);
  console.log(`Options cache expiries: http://localhost:${PORT}/api/options-cache/expiries?symbol=GLD`);
  console.log(`Options cache chain: http://localhost:${PORT}/api/options-cache/chain?symbol=GLD&expiry=YYYY-MM-DD`);
  console.log(`Volume Flow status: http://localhost:${PORT}/api/volume-flow/status`);
  console.log(`Volume Flow events: http://localhost:${PORT}/api/volume-flow/events?symbol=GLD`);
  console.log(`Extension API: http://localhost:${PORT}/api/extension/v1/health (API key required)`);
  console.log(`Quick Options token file: ${quickOptions.tokenFile} (keep private; do not commit or publish server/).`);
});

function shutdown() {
  volumeCollector.close();
  optionsChainStore.close();
  spotFeed.close();
  server.close(() => process.exit(0));
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
