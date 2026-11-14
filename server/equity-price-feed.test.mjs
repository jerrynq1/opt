import assert from 'node:assert/strict';
import { createEquityPriceFeed } from './equity-price-feed.mjs';

class FakeWebSocket extends EventTarget {
  static instances = [];
  constructor(url) {
    super();
    this.url = url;
    this.readyState = 0;
    this.sent = [];
    FakeWebSocket.instances.push(this);
  }
  send(value) { this.sent.push(value); }
  open() { this.readyState = 1; this.dispatchEvent(new Event('open')); }
  message(data) { const event = new Event('message'); event.data = data; this.dispatchEvent(event); }
  close(code = 1000, reason = '') {
    this.readyState = 3;
    const event = new Event('close'); event.code = code; event.reason = reason;
    this.dispatchEvent(event);
  }
}

const feed = createEquityPriceFeed({
  WebSocketImpl: FakeWebSocket,
  reconnectMinMs: 10,
  reconnectMaxMs: 20,
  staleAfterMs: 5 * 60_000,
  quoteFreshMs: 60_000,
  lastPricePreferredMs: 15_000
});
const pendingGLD = feed.get('GLD', { timeoutMs: 500 });
const pendingQQQ = feed.get('QQQ', { timeoutMs: 500 });
assert.equal(FakeWebSocket.instances.length, 1, 'GLD and QQQ share one upstream socket');
const socket = FakeWebSocket.instances[0];
assert.equal(socket.url, 'wss://nbstream.binance.com/equity/stream');
socket.open();
assert.deepEqual(JSON.parse(socket.sent[0]), {
  method: 'SUBSCRIBE', params: ['price', 'GLD@quote', 'QQQ@quote'], id: 1
});

// Push-all snapshots can omit the ETF tickers without erasing cached symbols.
socket.message(JSON.stringify({ stream: 'price', data: { e: 'price', rates: [
  { s: 'AAPL', ac: 'EQ_AAPL', p: '225.10', t: Date.now(), mp: 'O' }
] } }));
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(feed.status().state, 'symbol-missing');

// Per-symbol quote streams supply midpoint fallback when the push-all frame lacks GLD/QQQ.
const now = Date.now();
socket.message(JSON.stringify({ stream: 'GLD@quote', data: {
  e: 'quote', E: now, s: 'GLD', bp: '354.90', ap: '355.10', bs: 10, as: 20, T: now
} }));
await new Promise(resolve => setTimeout(resolve, 0));
socket.message(JSON.stringify({ stream: 'QQQ@quote', data: {
  e: 'quote', E: now, s: 'QQQ', bp: '673.90', ap: '674.10', bs: 30, as: 40, T: now
} }));
await new Promise(resolve => setTimeout(resolve, 0));
const [gldMid, qqqMid] = await Promise.all([pendingGLD, pendingQQQ]);
assert.equal(gldMid.price, 355);
assert.equal(gldMid.priceType, 'midquote');
assert.equal(gldMid.feedState, 'live-midquote');
assert.equal(gldMid.source, 'binance-equity-quote-stream');
assert.equal(qqqMid.price, 674);
assert.equal(qqqMid.feedState, 'live-midquote');
assert.equal(FakeWebSocket.instances.length, 1);

// A fresh Last Price remains preferred over a nearby midpoint.
const tradeTime = Date.now() - 2_000;
socket.message(JSON.stringify({ stream: 'price', data: { e: 'price', rates: [
  { s: 'GLD', ac: 'EQ_GLD', p: '355.02', pc: '354.80', t: tradeTime, mp: 'O' }
] } }));
await new Promise(resolve => setTimeout(resolve, 0));
const gldLast = feed.snapshot('GLD');
assert.equal(gldLast.price, 355.02);
assert.equal(gldLast.priceType, 'last');
assert.equal(gldLast.feedState, 'live');
assert.ok(gldLast.priceAgeMs >= 1_000 && gldLast.priceAgeMs < 10_000);

// Closed-market values keep their actual exchange timestamp; receiving a repeated
// snapshot must not make an old price appear fresh.
const closeTime = Date.now() - 12 * 60 * 60 * 1000;
socket.message(JSON.stringify({ stream: 'GLD@quote', data: {
  e: 'quote', E: closeTime, s: 'GLD', bp: '355.49', ap: '355.51', bs: 10, as: 20, T: closeTime
} }));
socket.message(JSON.stringify({ e: 'price', rates: [
  { s: 'GLD', ac: 'EQ_GLD', p: '355.502', pc: '354.8448', t: closeTime, mp: 'C' }
] }));
await new Promise(resolve => setTimeout(resolve, 0));
const gldClosed = feed.snapshot('GLD');
assert.equal(gldClosed.feedState, 'closed');
assert.ok(gldClosed.priceAgeMs >= 11 * 60 * 60 * 1000);
assert.ok(gldClosed.receivedAgeMs < 2_000);
assert.equal(gldClosed.ageMs, gldClosed.priceAgeMs, 'legacy ageMs now represents actual price age');

feed.close();

// If Binance sends a valid quote but T is null, return it with unknown-age;
// never replace the missing exchange timestamp with receive/event time.
const feedWithoutQuoteTime = createEquityPriceFeed({ WebSocketImpl: FakeWebSocket, reconnectMinMs: 10, reconnectMaxMs: 20 });
const pendingUnknownAge = feedWithoutQuoteTime.get('GLD', { timeoutMs: 500 });
const socketWithoutQuoteTime = FakeWebSocket.instances.at(-1);
socketWithoutQuoteTime.open();
const eventTime = Date.now();
socketWithoutQuoteTime.message(JSON.stringify({ stream: 'GLD@quote', data: {
  e: 'quote', E: eventTime, s: 'GLD', bp: '355.00', ap: '355.10', bs: 10, as: 10, T: null
} }));
await new Promise(resolve => setTimeout(resolve, 0));
const unknownAgeQuote = await pendingUnknownAge;
assert.equal(unknownAgeQuote.price, 355.05);
assert.equal(unknownAgeQuote.priceTime, null);
assert.equal(unknownAgeQuote.feedState, 'unknown-age');
assert.equal(unknownAgeQuote.receivedAgeMs <= 1000, true);
feedWithoutQuoteTime.close();

console.log('Node shared Equity Price + Quote Feed tests: passed');
