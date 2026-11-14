// Local Node.js gateway for QuantLab PWA + iOS Quick Options.
// Requires Node.js 22+ (native global WebSocket; no npm packages required).
// Start: node server/home-proxy.mjs
// Optional public access for PWA fallback: cloudflared tunnel --url http://localhost:8787
import http from 'node:http';
import worker from '../opt-main/worker/index.js';
import { createQuickOptionsService } from './quick-options.mjs';
import { createEquityPriceFeed } from './equity-price-feed.mjs';

const PORT = Number(process.env.PORT || 8787);
const env = { ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || '*' };
const spotFeed = createEquityPriceFeed();
const quickOptions = createQuickOptionsService({ worker, env, spotFeed });

function corsFor(origin = '') {
  const allowed = String(env.ALLOWED_ORIGINS || '*').split(',').map(value => value.trim()).filter(Boolean);
  const ok = allowed.includes('*') || allowed.includes(origin);
  return {
    'access-control-allow-origin': ok ? (allowed.includes('*') ? '*' : origin) : 'null',
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'Authorization, Accept, Content-Type',
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

    if (requestUrl.pathname === '/api/quick-options') {
      const quickRequest = new Request(requestUrl, { method: req.method, headers: req.headers });
      const response = await quickOptions.handle(quickRequest);
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
  console.log(`Quick Options token file: ${quickOptions.tokenFile} (keep private; do not commit or publish server/).`);
});

function shutdown() {
  spotFeed.close();
  server.close(() => process.exit(0));
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
