/**
 * Cloudflare Worker: narrow CORS bridge for Binance Equity Stock Options.
 * This is NOT a general-purpose proxy. Only the QQQ/GLD endpoints used by
 * js/stock-options.js are allowed. It stores no cookies, API keys or secrets.
 */
const PREFIX = '/api/binance-stock-proxy';
const UPSTREAM = 'https://www.binance.com';
const UPSTREAM_PRICE_WS = 'wss://nbstream.binance.com/equity/ws/price';
const ROUTES = [
  /^\/bapi\/equity\/v1\/public\/equity\/option\/(?:chain-symbols|get-config|get-exchange-info)$/,
  /^\/bapi\/equity\/v1\/friendly\/equity\/option\/get-option-quote$/,
  /^\/en\/stocks\/options\/EQ_(?:QQQ|GLD)$/
];
const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...headers } });
}
function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const configured = (env.ALLOWED_ORIGINS || '*').split(',').map(x => x.trim()).filter(Boolean);
  const allowed = configured.includes('*') || configured.includes(origin);
  return {
    'Access-Control-Allow-Origin': allowed ? (configured.includes('*') ? '*' : origin) : 'null',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}
function withCors(response, cors) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(cors)) headers.set(key, value);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Cache-Control', 'no-store');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

/**
 * Proxy Binance's public Stocks Trading push-all Price Stream through the same
 * Worker origin used by the PWA REST requests. This avoids depending on the
 * user's browser/network being able to open Binance's WSS host directly.
 *
 * Cloudflare Workers supports outbound WebSockets via fetch(..., Upgrade).
 */
async function handleStockPriceFeed(request, cors) {
  if (request.method !== 'GET') {
    return withCors(json({ ok: false, error: 'Only GET is allowed for the price feed.' }, 405), cors);
  }
  if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
    return withCors(json({ ok: false, error: 'Expected Upgrade: websocket.' }, 426), cors);
  }
  if (cors['Access-Control-Allow-Origin'] === 'null') {
    return json({ ok: false, error: 'Origin is not allowed.' }, 403);
  }

  let upstreamResponse;
  try {
    upstreamResponse = await fetch(UPSTREAM_PRICE_WS, {
      headers: { Upgrade: 'websocket' }
    });
  } catch (error) {
    return withCors(json({
      ok: false,
      error: 'Could not open Binance Stocks Trading Price Stream.',
      detail: String(error?.message || error)
    }, 502), cors);
  }

  const upstream = upstreamResponse?.webSocket;
  if (!upstream) {
    let detail = `Upstream did not accept WebSocket (HTTP ${upstreamResponse?.status ?? 'unknown'}).`;
    try {
      const body = await upstreamResponse?.text?.();
      if (body) detail += ` ${String(body).slice(0, 240)}`;
    } catch {}
    return withCors(json({ ok: false, error: 'Binance Price Stream handshake failed.', detail }, 502), cors);
  }

  let pair;
  try {
    pair = new WebSocketPair();
  } catch (error) {
    try { upstream.close(1011, 'Worker WebSocketPair unavailable'); } catch {}
    return withCors(json({
      ok: false,
      error: 'Worker runtime does not expose WebSocketPair.',
      detail: String(error?.message || error)
    }, 500), cors);
  }
  const [client, server] = Object.values(pair);
  server.accept();
  // Half-open is useful for a transparent proxy: mirror close events to the
  // opposite peer rather than letting the runtime close only one side.
  try { upstream.accept({ allowHalfOpen: true }); } catch { try { upstream.accept(); } catch {} }

  let closed = false;
  const closeBoth = (code = 1000, reason = 'peer closed') => {
    if (closed) return;
    closed = true;
    try { upstream.close(code, reason.slice(0, 120)); } catch {}
    try { server.close(code, reason.slice(0, 120)); } catch {}
  };
  const sendStatus = (state, detail = '') => {
    if (server.readyState !== WebSocket.OPEN) return;
    try { server.send(JSON.stringify({ __quantlab: 'spot-feed', state, detail })); } catch {}
  };

  server.addEventListener('close', event => {
    if (!closed) {
      closed = true;
      try { upstream.close(event?.code || 1000, event?.reason || 'PWA client closed'); } catch {}
    }
  });
  server.addEventListener('error', () => closeBoth(1011, 'PWA relay socket error'));
  // Price Stream is read-only. Ignore client application messages; protocol
  // control frames are handled by the WebSocket runtime.
  server.addEventListener('message', () => {});

  upstream.addEventListener('open', () => sendStatus('upstream-connected', 'Binance Price Stream connected.'));
  upstream.addEventListener('message', event => {
    if (closed || server.readyState !== WebSocket.OPEN) return;
    try { server.send(event.data); }
    catch { closeBoth(1011, 'Could not relay Binance price message'); }
  });
  upstream.addEventListener('error', () => {
    sendStatus('upstream-error', 'Binance Price Stream reported a WebSocket error.');
    closeBoth(1011, 'Binance upstream WebSocket error');
  });
  upstream.addEventListener('close', event => {
    if (closed) return;
    sendStatus('upstream-closed', event?.reason || 'Binance Price Stream closed.');
    closeBoth(1011, 'Binance upstream closed');
  });

  return new Response(null, {
    status: 101,
    webSocket: client,
    headers: cors
  });
}

function getUnderlying(path, url, body) {
  if (path.endsWith('/chain-symbols')) {
    const symbol = (url.searchParams.get('symbol') || '').toUpperCase();
    const root = (url.searchParams.get('rootSymbol') || '').toUpperCase();
    if (!['QQQ', 'GLD'].includes(symbol) || !['QQQ', 'GLD'].includes(root) || symbol !== root) {
      throw new Error('Only matching QQQ or GLD chains are supported');
    }
    return symbol;
  }
  if (path.endsWith('/get-exchange-info') || path.endsWith('/get-config')) {
    const symbol = (url.searchParams.get('symbol') || url.searchParams.get('underlying') || '').toUpperCase().replace(/^EQ_/, '');
    if (!['QQQ', 'GLD'].includes(symbol)) throw new Error('Only QQQ or GLD option metadata is supported');
    return symbol;
  }
  if (path.endsWith('/get-option-quote')) {
    let payload;
    try { payload = JSON.parse(body); } catch { throw new Error('Invalid JSON quote request'); }
    const symbols = payload?.occSymbols;
    if (!Array.isArray(symbols) || symbols.length < 1 || symbols.length > 100 ||
        symbols.some(value => typeof value !== 'string' || !/^(QQQ|GLD)/.test(value))) {
      throw new Error('Quote requests must contain 1–100 QQQ/GLD OCC symbols');
    }
    const roots = new Set(symbols.map(value => value.startsWith('QQQ') ? 'QQQ' : 'GLD'));
    if (roots.size !== 1) throw new Error('A quote batch cannot mix QQQ and GLD contracts');
    return [...roots][0];
  }
  if (path.endsWith('/EQ_QQQ')) return 'QQQ';
  if (path.endsWith('/EQ_GLD')) return 'GLD';
  return 'GLD';
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    if (url.pathname === '/api/stock-price-feed') {
      return handleStockPriceFeed(request, cors);
    }

    if (request.method === 'OPTIONS') {
      if (cors['Access-Control-Allow-Origin'] === 'null') return new Response('Origin not allowed', { status: 403 });
      return new Response(null, { status: 204, headers: cors });
    }
    if (url.pathname === '/api/health') {
      return withCors(json({ ok: true, proxy: 'Binance Equity Stock Options', assets: ['QQQ', 'GLD'] }), cors);
    }
    if (!url.pathname.startsWith(PREFIX + '/')) {
      return withCors(json({ error: 'Not found' }, 404), cors);
    }
    if (cors['Access-Control-Allow-Origin'] === 'null') {
      return json({ error: 'Origin is not allowed. Set ALLOWED_ORIGINS in Worker settings.' }, 403);
    }

    const rawPath = url.pathname.slice(PREFIX.length);
    let path;
    try { path = decodeURIComponent(rawPath); } catch { return withCors(json({ error: 'Invalid encoded path' }, 400), cors); }
    if (!ROUTES.some(route => route.test(path))) {
      return withCors(json({ error: 'Proxy route is not allow-listed' }, 403), cors);
    }

    const quoteRoute = path === '/bapi/equity/v1/friendly/equity/option/get-option-quote';
    if ((quoteRoute && request.method !== 'POST') || (!quoteRoute && request.method !== 'GET')) {
      return withCors(json({ error: quoteRoute ? 'Only POST is allowed for option quotes' : 'Only GET is allowed for this route' }, 405), cors);
    }
    if (url.search.length > 2048) return withCors(json({ error: 'Query string too long' }, 414), cors);

    let body = '';
    if (quoteRoute) {
      body = await request.text();
      if (body.length > 64 * 1024) return withCors(json({ error: 'Request body too large' }, 413), cors);
    }

    let underlying;
    try { underlying = getUnderlying(path, url, body); }
    catch (error) { return withCors(json({ error: error.message }, 400), cors); }

    const referer = path.startsWith('/en/stocks/options/')
      ? `${UPSTREAM}${path}`
      : `${UPSTREAM}/en/stocks/options/EQ_${underlying}`;
    // Binance's own browser requests (verified in the supplied HAR) include
    // these ordinary web-client headers. Generate fresh trace IDs per request;
    // do NOT forward cookies, Authorization, device fingerprints or fvideo tokens.
    const traceId = crypto.randomUUID();
    const incomingUA = request.headers.get('User-Agent') || '';
    const incomingLanguage = request.headers.get('Accept-Language') || 'en-US,en;q=0.9';
    const upstreamHeaders = new Headers({
      'Accept': '*/*',
      'Accept-Language': incomingLanguage.slice(0, 160),
      'User-Agent': incomingUA.slice(0, 300) || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      'Origin': UPSTREAM,
      'Referer': referer,
      'clienttype': 'web',
      'lang': 'en',
      'bnc-uuid': crypto.randomUUID(),
      'bnc-time-zone': 'Asia/Saigon',
      'x-trace-id': traceId,
      'x-ui-request-trace': traceId
    });
    if (quoteRoute) upstreamHeaders.set('Content-Type', 'application/json');

    const target = new URL(path + url.search, UPSTREAM);
    let upstream;
    try {
      upstream = await fetch(target.toString(), {
        method: request.method,
        headers: upstreamHeaders,
        body: quoteRoute ? body : undefined,
        redirect: 'follow'
      });
    } catch (error) {
      return withCors(json({ error: 'Binance upstream request failed', detail: error?.message || 'Network error' }, 502), cors);
    }

    const contentType = upstream.headers.get('content-type') || '';
    // Return a useful JSON diagnostic instead of passing an opaque CloudFront
    // HTML 403 page through to the dashboard. This distinguishes an upstream
    // Binance block from Worker routing/CORS failures.
    if (!upstream.ok) {
      const raw = await upstream.text();
      const snippet = raw.replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 240);
      return withCors(json({
        error: 'Binance upstream rejected the request',
        upstreamStatus: upstream.status,
        upstreamContentType: contentType || 'unknown',
        detail: snippet || 'The upstream server returned an empty error response.',
        hint: upstream.status === 403
          ? 'Binance rejected the request from the Worker egress or requires additional browser/session verification. This is not a filename or GitHub Pages CORS error.'
          : 'Check Binance endpoint availability and request parameters.'
      }, 502, { 'X-Upstream-Status': String(upstream.status) }), cors);
    }

    const responseHeaders = new Headers();
    if (contentType) responseHeaders.set('Content-Type', contentType);
    responseHeaders.set('Cache-Control', 'no-store');
    responseHeaders.set('X-Content-Type-Options', 'nosniff');
    for (const [key, value] of Object.entries(cors)) responseHeaders.set(key, value);
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  }
};
