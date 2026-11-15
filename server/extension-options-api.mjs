function jsonResponse(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
      ...headers
    }
  });
}

function rateHeaders(rate) {
  if (!rate) return {};
  return {
    'x-ratelimit-limit': String(rate.limit),
    'x-ratelimit-remaining': String(rate.remaining),
    'x-ratelimit-reset': String(Math.ceil(rate.resetAt / 1000))
  };
}

export function createExtensionOptionsApi({ keyStore, optionsService }) {
  if (!keyStore || typeof keyStore.authorize !== 'function') throw new Error('Extension API requires a keyStore.');
  if (!optionsService || typeof optionsService.getMarketSummary !== 'function' || typeof optionsService.getExpiries !== 'function') {
    throw new Error('Extension API requires the Options market data service.');
  }

  async function handle(request, cors = {}) {
    const url = new URL(request.url);
    const headers = { ...cors };
    if (request.method === 'OPTIONS') {
      if (headers['access-control-allow-origin'] === 'null') {
        return jsonResponse({ ok: false, error: 'Origin not allowed.' }, 403, headers);
      }
      return new Response(null, { status: 204, headers: {
        ...headers,
        'access-control-allow-methods': 'GET, OPTIONS',
        'access-control-allow-headers': 'X-API-Key, Accept',
        'access-control-max-age': '86400'
      } });
    }
    if (request.method !== 'GET') return jsonResponse({ ok: false, error: 'Only GET is allowed.' }, 405, headers);
    if (headers['access-control-allow-origin'] === 'null') return jsonResponse({ ok: false, error: 'Origin not allowed.' }, 403, headers);

    const auth = keyStore.authorize(request, 'market:read');
    if (!auth.ok) {
      const retry = auth.status === 429 && auth.rate ? Math.max(1, Math.ceil((auth.rate.resetAt - Date.now()) / 1000)) : null;
      return jsonResponse({ ok: false, error: auth.error, code: auth.status === 429 ? 'RATE_LIMITED' : auth.status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN' }, auth.status, {
        ...headers,
        ...rateHeaders(auth.rate),
        ...(retry ? { 'retry-after': String(retry) } : {})
      });
    }

    const path = url.pathname;
    const common = {
      ...headers,
      ...rateHeaders(auth.rate),
      'x-quantlab-api-version': '1'
    };
    if (path === '/api/extension/v1/health') {
      return jsonResponse({
        ok: true,
        service: 'ICT QuantLab Extension API',
        api_version: '1',
        supported_underlyings: ['QQQ', 'GLD'],
        scopes: auth.key.scopes,
        server_time: new Date().toISOString()
      }, 200, common);
    }

    if (path === '/api/extension/v1/market/expiries') {
      const symbol = String(url.searchParams.get('symbol') || '').toUpperCase();
      if (!['QQQ', 'GLD'].includes(symbol)) return jsonResponse({ ok: false, error: 'symbol must be QQQ or GLD.' }, 400, common);
      const limit = Number(url.searchParams.get('limit') || 12);
      if (!Number.isInteger(limit) || limit < 1 || limit > 24) return jsonResponse({ ok: false, error: 'limit must be an integer from 1 to 24.' }, 400, common);
      try {
        return jsonResponse(await optionsService.getExpiries(symbol, limit), 200, common);
      } catch (error) {
        return jsonResponse({ ok: false, symbol, error: error?.message || String(error), updated_at: new Date().toISOString() }, 502, common);
      }
    }

    if (path === '/api/extension/v1/market/summary') {
      const symbol = String(url.searchParams.get('symbol') || '').toUpperCase();
      if (!['QQQ', 'GLD'].includes(symbol)) return jsonResponse({ ok: false, error: 'symbol must be QQQ or GLD.' }, 400, common);
      const expiry = url.searchParams.get('expiry') || '';
      if (expiry && !/^\d{4}-\d{2}-\d{2}$/.test(expiry)) return jsonResponse({ ok: false, error: 'expiry must use YYYY-MM-DD.' }, 400, common);
      try {
        // Extension requests use the shared server cache; do not let clients bypass
        // the upstream cache on every poll. The existing Quick Options route can
        // still request a manual refresh under its separate Bearer token.
        return jsonResponse(await optionsService.getMarketSummary(symbol, expiry, { expiryCloseMinutes: 16 * 60 + 15 }), 200, common);
      } catch (error) {
        return jsonResponse({ ok: false, symbol, expiry: expiry || null, error: error?.message || String(error), updated_at: new Date().toISOString() }, 502, common);
      }
    }

    return jsonResponse({ ok: false, error: 'Not found.' }, 404, common);
  }

  return { handle };
}
