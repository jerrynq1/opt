import assert from 'node:assert/strict';
import { createEquityPriceFeed } from './equity-price-feed.mjs';

class FakeWebSocket extends EventTarget {
  static instances = [];
  constructor(url) {
    super();
    this.url = url;
    this.readyState = 0;
    FakeWebSocket.instances.push(this);
  }
  open() { this.readyState = 1; this.dispatchEvent(new Event('open')); }
  message(data) { const event = new Event('message'); event.data = data; this.dispatchEvent(event); }
  close(code = 1000, reason = '') {
    this.readyState = 3;
    const event = new Event('close'); event.code = code; event.reason = reason;
    this.dispatchEvent(event);
  }
}

const feed = createEquityPriceFeed({ WebSocketImpl: FakeWebSocket, reconnectMinMs: 10, reconnectMaxMs: 20 });
const pending = feed.get('GLD', { timeoutMs: 500 });
assert.equal(FakeWebSocket.instances.length, 1, 'one shared connection should be opened lazily');
const socket = FakeWebSocket.instances[0];
assert.equal(socket.url, 'wss://nbstream.binance.com/equity/ws/price');
socket.open();
socket.message(JSON.stringify({ e: 'price', rates: [
  { s: 'GLD', ac: 'EQ_GLD', p: '382.15', pc: '381.40', t: null, mp: 'C' },
  { s: 'QQQ', ac: 'EQ_QQQ', p: '610.25', pc: '609.90', t: 1794672000000, mp: 'C' }
] }));
const gld = await pending;
assert.equal(gld.price, 382.15);
assert.equal(gld.previousClose, 381.4);
assert.equal(gld.priceTime, null, 'do not fabricate the exchange trade timestamp when Binance sends null');
assert.equal(gld.marketPhase, 'C');
assert.equal(gld.feedState, 'ok');
const qqq = await feed.get('QQQ');
assert.equal(qqq.price, 610.25, 'the same push-all stream should supply QQQ');
assert.equal(FakeWebSocket.instances.length, 1, 'GLD and QQQ must share one upstream socket');
assert.equal(feed.status().state, 'ok');
feed.close();
console.log('Node shared Equity Price Feed tests: passed');
