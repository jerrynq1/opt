import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { writeFile, unlink } from 'node:fs/promises';

const source = await readFile(new URL('../worker/index.js', import.meta.url), 'utf8');
const temp = join('/tmp', `worker-test-${process.pid}.mjs`);
await writeFile(temp, source);
const { default: worker } = await import(pathToFileURL(temp).href);
let lastUpstream = null;
globalThis.fetch = async (url, init) => {
  lastUpstream = { url: String(url), init };
  return new Response(JSON.stringify({ code: '000000', data: { l: [] } }), {
    status: 200, headers: { 'content-type': 'application/json' }
  });
};
const origin = 'https://sample-user.github.io';
const env = { ALLOWED_ORIGINS: '*' };

let response = await worker.fetch(new Request('https://worker.example/api/health', { headers: { Origin: origin } }), env);
assert.equal(response.status, 200);
assert.equal((await response.json()).ok, true);
assert.equal(response.headers.get('access-control-allow-origin'), '*');

response = await worker.fetch(new Request('https://worker.example/api/binance-stock-proxy/bapi/equity/v1/public/equity/option/chain-symbols?symbol=QQQ&rootSymbol=QQQ&expirationDate=2026-12-18', { headers: { Origin: origin, 'User-Agent': 'test-browser/1.0', 'Accept-Language': 'en-US,en;q=0.9' } }), env);
assert.equal(response.status, 200);
assert.match(lastUpstream.url, /chain-symbols\?symbol=QQQ/);
assert.equal(new URL(lastUpstream.url).hostname, 'www.binance.com');
assert.ok(lastUpstream.init.headers instanceof Headers);
assert.ok(lastUpstream.init.headers.get('bnc-uuid'));
assert.ok(lastUpstream.init.headers.get('x-trace-id'));
assert.equal(lastUpstream.init.headers.get('x-trace-id'), lastUpstream.init.headers.get('x-ui-request-trace'));
assert.equal(lastUpstream.init.headers.get('User-Agent'), 'test-browser/1.0');

response = await worker.fetch(new Request('https://worker.example/api/binance-stock-proxy/bapi/equity/v1/friendly/equity/option/get-option-quote', {
  method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
  body: JSON.stringify({ occSymbols: ['QQQ  261218C00600000'] })
}), env);
assert.equal(response.status, 200);
assert.equal(lastUpstream.init.method, 'POST');
assert.match(lastUpstream.init.body, /QQQ/);

const originalFetch = globalThis.fetch;
globalThis.fetch = async () => new Response('<html><title>403 Forbidden</title><h1>403 Forbidden</h1></html>', {
  status: 403, headers: { 'content-type': 'text/html' }
});
response = await worker.fetch(new Request('https://worker.example/api/binance-stock-proxy/bapi/equity/v1/public/equity/option/chain-symbols?symbol=GLD&rootSymbol=GLD&expirationDate=2026-12-18', { headers: { Origin: origin } }), env);
assert.equal(response.status, 502);
const diagnostic = await response.json();
assert.equal(diagnostic.upstreamStatus, 403);
assert.match(diagnostic.hint, /Binance rejected/);
globalThis.fetch = originalFetch;

response = await worker.fetch(new Request('https://worker.example/api/binance-stock-proxy/https://evil.example/', { headers: { Origin: origin } }), env);
assert.equal(response.status, 403);

response = await worker.fetch(new Request('https://worker.example/api/binance-stock-proxy/bapi/equity/v1/public/equity/option/chain-symbols?symbol=AAPL&rootSymbol=AAPL&expirationDate=2026-12-18', { headers: { Origin: origin } }), env);
assert.equal(response.status, 400);

response = await worker.fetch(new Request('https://worker.example/api/binance-stock-proxy/bapi/equity/v1/friendly/equity/option/get-option-quote', {
  method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
  body: JSON.stringify({ occSymbols: ['QQQ  261218C00600000', 'GLD  261218C00600000'] })
}), env);
assert.equal(response.status, 400);

response = await worker.fetch(new Request('https://worker.example/api/binance-stock-proxy/bapi/equity/v1/public/equity/option/chain-symbols?symbol=QQQ&rootSymbol=QQQ&expirationDate=2026-12-18', { headers: { Origin: origin } }), { ALLOWED_ORIGINS: 'https://different.example' });
assert.equal(response.status, 403);

await unlink(temp);
console.log('Cloudflare Worker regression checks: passed');
