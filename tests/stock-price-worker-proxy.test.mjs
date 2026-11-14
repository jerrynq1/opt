import assert from 'node:assert/strict';
import worker from '../worker/index.js';

const allowedOrigin = 'https://quantlab.example';
const env = { ALLOWED_ORIGINS: allowedOrigin };

let response = await worker.fetch(new Request('https://worker.example/api/stock-price-feed', {
  method: 'GET', headers: { Origin: allowedOrigin }
}), env);
assert.equal(response.status, 426, 'price relay must require an Upgrade: websocket request');

response = await worker.fetch(new Request('https://worker.example/api/stock-price-feed', {
  method: 'GET', headers: { Origin: 'https://not-allowed.example', Upgrade: 'websocket' }
}), env);
assert.equal(response.status, 403, 'price relay must enforce configured origins');

class MockSocket extends EventTarget {
  constructor() { super(); this.readyState = 1; this.sent = []; this.accepted = false; this.closeCalls = []; }
  accept(options) { this.accepted = true; this.acceptOptions = options; }
  send(value) { this.sent.push(value); }
  close(code = 1000, reason = '') {
    this.closeCalls.push({ code, reason });
    if (this.readyState === 3) return;
    this.readyState = 3;
    const event = new Event('close'); event.code = code; event.reason = reason;
    this.dispatchEvent(event);
  }
}
class MockWebSocketPair {
  constructor() { this[0] = new MockSocket(); this[1] = new MockSocket(); globalThis.__lastPair = this; }
}
class MockUpgradeResponse {
  constructor(body, init = {}) { this.body = body; this.status = init.status; this.webSocket = init.webSocket; this.headers = new Headers(init.headers || {}); }
}

const originalFetch = globalThis.fetch;
const originalResponse = globalThis.Response;
const originalPair = globalThis.WebSocketPair;
let upstream;
globalThis.WebSocketPair = MockWebSocketPair;
globalThis.Response = MockUpgradeResponse;
globalThis.fetch = async (url, init) => {
  assert.equal(String(url), 'wss://nbstream.binance.com/equity/ws/price');
  assert.equal(init.headers.Upgrade, 'websocket');
  upstream = new MockSocket();
  return { status: 101, webSocket: upstream };
};
try {
  response = await worker.fetch(new Request('https://worker.example/api/stock-price-feed', {
    method: 'GET', headers: { Origin: allowedOrigin, Upgrade: 'websocket' }
  }), env);
  assert.equal(response.status, 101);
  assert.ok(response.webSocket, 'Worker should return the downstream WebSocket client');
  const [, relay] = Object.values(globalThis.__lastPair);
  assert.equal(relay.accepted, true);
  assert.equal(upstream.accepted, true);

  const open = new Event('open');
  upstream.dispatchEvent(open);
  assert.ok(relay.sent.some(value => JSON.parse(value).__quantlab === 'spot-feed'));

  const payload = JSON.stringify({ e: 'price', rates: [{ s: 'GLD', ac: 'EQ_GLD', p: '382.15', pc: '381.40', mp: 'C', t: null }] });
  const message = new Event('message'); message.data = payload;
  upstream.dispatchEvent(message);
  assert.ok(relay.sent.includes(payload), 'Worker should relay Binance price snapshots unchanged');

  relay.close(1000, 'test client close');
  assert.ok(upstream.closeCalls.length > 0, 'downstream close should close upstream socket');
} finally {
  globalThis.fetch = originalFetch;
  globalThis.Response = originalResponse;
  if (originalPair === undefined) delete globalThis.WebSocketPair;
  else globalThis.WebSocketPair = originalPair;
  delete globalThis.__lastPair;
}

console.log('Stock Price Worker WebSocket proxy tests: passed');
