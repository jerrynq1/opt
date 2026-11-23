import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { VolumeFlowStore } from './volume-flow-store.mjs';
import { OptionsChainStore } from './options-chain-store.mjs';
import { rowsFromOptionMessage, expiryStream, VolumeFlowCollector } from './volume-flow-collector.mjs';
import { createQuickOptionsService } from './quick-options.mjs';

// The snapshot helper uses the same existing Worker allowlist and normalises
// the per-contract volume values without exposing OI to the collector.
const fakeWorker = {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname.endsWith('/get-exchange-info')) {
      return new Response(JSON.stringify({ data: { expirations: ['2026-11-27', '2026-12-04'] } }), { status: 200 });
    }
    if (url.pathname.endsWith('/en/stocks/options/EQ_GLD')) {
      return new Response('<html><body><div data-expiry="2027-01-15">GLD options</div></body></html>', { status: 200 });
    }
    if (url.pathname.endsWith('/chain-symbols')) {
      return new Response(JSON.stringify({ data: { l: [
        { os: 'GLD261127C00385000', sp: 385, t: 'CALL' },
        { os: 'GLD261127P00385000', sp: 385, t: 'PUT' }
      ] } }), { status: 200 });
    }
    if (url.pathname.endsWith('/get-option-quote')) {
      const body = JSON.parse(await request.text());
      return new Response(JSON.stringify({ data: body.occSymbols.map((os, index) => ({
        os, sp: 385, t: os.includes('C') ? 'CALL' : 'PUT', v: index ? 17 : 42, oi: index ? 80 : 90, iv: 0.25, bp: 2.4, ap: 2.5, ga: 0.02
      })) }), { status: 200 });
    }
    return new Response(JSON.stringify({ error: 'unexpected route' }), { status: 404 });
  }
};
const quickOptions = createQuickOptionsService({ worker: fakeWorker });
const inventory = await quickOptions.getExpiries('GLD', 128);
assert.deepEqual(inventory.expiries.map(item => item.expiry), ['2026-11-27', '2026-12-04', '2027-01-15']);
assert.equal(inventory.source, 'exchange-info+options-page', 'expiry inventory merges Exchange Info with the official options page');
const fullChain = await quickOptions.getFullChainSnapshot('GLD', '2026-11-27');
assert.equal(fullChain.contracts.length, 2);
assert.equal(fullChain.contracts[0].openInterest, 90);
assert.equal(fullChain.contracts[0].bid, 2.4);
const volumeSnapshot = await quickOptions.getVolumeSnapshot('GLD', '2026-11-27');
assert.equal(volumeSnapshot.volume_contracts, 2);
assert.deepEqual(volumeSnapshot.contracts.map(item => item.volume).sort((a, b) => a - b), [17, 42]);

class MockWebSocket {
  static instances = [];
  constructor(url) { this.url = url; this.listeners = new Map(); this.sent = []; MockWebSocket.instances.push(this); }
  addEventListener(type, callback) {
    const list = this.listeners.get(type) || [];
    list.push(callback); this.listeners.set(type, list);
  }
  emit(type, data) {
    for (const callback of this.listeners.get(type) || []) callback(data);
  }
  send(value) { this.sent.push(JSON.parse(value)); }
  close() { this.emit('close', {}); }
}
const collectorNow = Date.parse('2026-11-23T15:00:00Z');
const collectorStore = new VolumeFlowStore({ dbPath: ':memory:', now: () => collectorNow });
const collectorChainStore = new OptionsChainStore({ dbPath: ':memory:', now: () => collectorNow });
const collectorService = {
  async getExpiries(symbol) { return { source: 'test-inventory', expiries: [{ expiry: '2026-11-27', contract_count: 1 }] }; },
  async getVolumeSnapshot(symbol, expiry) {
    return { contracts: [{
      optionSymbol: symbol === 'GLD' ? 'GLD261127C00385000' : 'QQQ261127C00600000',
      symbol, expiry, side: 'C', strike: symbol === 'GLD' ? 385 : 600, volume: 100
    }] };
  },
  async getFullChainSnapshot(symbol, expiry) {
    const optionSymbol = symbol === 'GLD' ? 'GLD261127C00385000' : 'QQQ261127C00600000';
    return { symbol, expiry, total_contracts: 1, quote_count: 1, contracts: [{
      optionSymbol, symbol, expiry, side: 'C', strike: symbol === 'GLD' ? 385 : 600,
      volume: 100, openInterest: 20, iv: 0.2, bid: 1.1, ask: 1.2, gamma: 0.01
    }] };
  }
};
const collector = new VolumeFlowCollector({
  optionsService: collectorService, store: collectorStore, chainStore: collectorChainStore, WebSocketImpl: MockWebSocket,
  maxExpiriesPerSymbol: 1, universeRefreshMs: 60 * 60_000, scanIntervalMs: 60_000, now: () => collectorNow + 1_000
});
const collectorStart = await collector.start();
assert.equal(collectorStart.subscribed_streams, 2, 'one expiry stream is prepared per underlying');
assert.equal(collectorChainStore.getChain('GLD', '2026-11-27').contracts.length, 1, 'collector bootstraps and stores the complete expiry chain');
assert.equal(collectorChainStore.getChain('QQQ', '2026-11-27').contracts[0].openInterest, 20);
const mockSocket = MockWebSocket.instances.at(-1);
mockSocket.emit('open', {});
assert.equal(mockSocket.sent[0].method, 'SUBSCRIBE');
assert.equal(mockSocket.sent[0].params.length, 2);
mockSocket.emit('message', { data: JSON.stringify({
  stream: 'GLD_20261127_GLD@optionChainQuoteDelayed',
  data: { q: [{ os: 'GLD261127C00385000', sp: 385, t: 'C', v: 125 }] }
}) });
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(collectorStore.listEvents({ symbol: 'GLD' }).length, 0, 'WebSocket updates are queued until the 1-second scanner flushes them');
const wsFlush = await collector.scanNow();
assert.equal(wsFlush.processedContracts, 1);
assert.equal(collectorStore.listEvents({ symbol: 'GLD' })[0].volumeDelta, 25);
const cachedLiveCall = collectorChainStore.getChain('GLD', '2026-11-27').contracts[0];
assert.equal(cachedLiveCall.volume, 125, 'WebSocket deltas update the saved full-chain snapshot');
assert.equal(collector.status().scan_interval_ms, 60_000, 'scanner interval is configurable for tests');
assert.ok(collector.status().scanner_ticks >= 1);
collector.stop();
collectorStore.close();
collectorChainStore.close();

// A one-second scanner reconciles one expiry at a time and only writes changed contracts.
let scannerVolume = 100;
const scannerStore = new VolumeFlowStore({ dbPath: ':memory:', now: () => collectorNow + 2_000 });
const scannerChainStore = new OptionsChainStore({ dbPath: ':memory:', now: () => collectorNow + 2_000 });
const scannerService = {
  async getExpiries(symbol) { return { source: 'test-inventory', expiries: [{ expiry: '2026-11-27', contract_count: 1 }] }; },
  async getVolumeSnapshot() { return { contracts: [] }; },
  async getFullChainSnapshot(symbol, expiry) {
    return { symbol, expiry, total_contracts: 1, quote_count: 1, contracts: [{
      optionSymbol: symbol === 'GLD' ? 'GLD261127C00385000' : 'QQQ261127C00600000',
      symbol, expiry, side: 'C', strike: symbol === 'GLD' ? 385 : 600,
      volume: scannerVolume, openInterest: 20, iv: 0.2, bid: 1.1, ask: 1.2, gamma: 0.01
    }] };
  }
};
const scanner = new VolumeFlowCollector({
  optionsService: scannerService, store: scannerStore, chainStore: scannerChainStore,
  WebSocketImpl: MockWebSocket, maxExpiriesPerSymbol: 1, universeRefreshMs: 60 * 60_000,
  scanIntervalMs: 60_000, now: () => collectorNow + 2_000
});
await scanner.start();
scannerVolume = 175;
const restScan = await scanner.scanNow();
assert.equal(restScan.restScanned, true);
assert.equal(restScan.restResult.changed, 1);
assert.equal(scannerStore.listEvents({ symbol: 'GLD' })[0].volumeDelta, 75);
assert.equal(scannerChainStore.getChain('GLD', '2026-11-27').contracts[0].volume, 175);
const qqqScan = await scanner.scanNow();
assert.equal(qqqScan.restResult.target.symbol, 'QQQ', 'the scanner advances to the next expiry/symbol');
assert.equal(qqqScan.restResult.changed, 1);
const noChangeScan = await scanner.scanNow();
assert.equal(noChangeScan.restResult.target.symbol, 'GLD');
assert.equal(noChangeScan.restResult.changed, 0, 'unchanged REST scans do not rewrite contract records');
assert.ok(noChangeScan.restResult.unchanged >= 1);
assert.equal(scannerStore.listEvents({ symbol: 'GLD' }).length, 1, 'unchanged cumulative volume creates no second event');
assert.equal(scanner.status().rest_scan.scans_completed, 3);
scanner.stop(); scannerStore.close(); scannerChainStore.close();

const tempDir = mkdtempSync(path.join(os.tmpdir(), 'gex-volume-flow-'));
const dbPath = path.join(tempDir, 'volume.sqlite');
let now = Date.parse('2026-11-23T15:00:00Z');
const store = new VolumeFlowStore({ dbPath, now: () => now });
const contract = {
  optionSymbol: 'GLD261127C00385000',
  symbol: 'GLD',
  expiry: '2026-11-27',
  side: 'C',
  strike: 385,
  volume: 120
};

try {
  const baseline = store.ingest(contract, { source: 'rest-bootstrap', observedAt: now });
  assert.equal(baseline.baseline, true);
  assert.equal(store.getStatusCounts().eventCount, 0, 'initial cumulative Volume is a baseline, not a trade delta');

  now += 1_000;
  const unchanged = store.ingest({ ...contract, volume: 120 }, { source: 'websocket', observedAt: now });
  assert.equal(unchanged.changed, false);
  assert.equal(store.getStatusCounts().eventCount, 0, 'unchanged Volume does not create historical rows');

  now += 1_000;
  const increased = store.ingest({ ...contract, volume: 370 }, { source: 'websocket', observedAt: now, sourceTimeMs: now });
  assert.equal(increased.event.volumeDelta, 250);
  assert.equal(increased.event.volumeTotal, 370);
  assert.equal(increased.event.captureMode, 'live');
  assert.equal(store.getStatusCounts().eventCount, 1);

  now += 1_000;
  store.ingest({ ...contract, volume: 370 }, { source: 'websocket', observedAt: now });
  assert.equal(store.getStatusCounts().eventCount, 1, 'duplicate snapshot does not create an event');

  now += 1_000;
  const reset = store.ingest({ ...contract, volume: 0 }, { source: 'websocket', observedAt: now, sourceTimeMs: now });
  assert.equal(reset.reset, true);
  assert.equal(store.getStatusCounts().eventCount, 1, 'volume reset is a new baseline, not negative flow');

  now += 1_000;
  const afterReset = store.ingest({ ...contract, volume: 18 }, { source: 'websocket', observedAt: now, sourceTimeMs: now });
  assert.equal(afterReset.event.volumeDelta, 18);

  const events = store.listEvents({ symbol: 'GLD', expiry: '2026-11-27', limit: 10 });
  assert.equal(events.length, 2);
  assert.deepEqual(events.map(item => item.volumeDelta).sort((a, b) => a - b), [18, 250]);
  assert.equal(store.listContracts({ symbol: 'GLD', expiry: '2026-11-27' })[0].volumeTotal, 18);

  const stale = store.ingest({ ...contract, volume: 50 }, { source: 'websocket', observedAt: now + 1_000, sourceTimeMs: now - 10_000 });
  assert.equal(stale.reason, 'out-of-order-source-event');

  const restored = new VolumeFlowStore({ dbPath, now: () => now });
  assert.equal(restored.getStatusCounts().eventCount, 2, 'events survive process restarts');
  assert.equal(restored.listContracts({ symbol: 'GLD' })[0].volumeTotal, 18, 'latest counters survive process restarts');
  restored.close();

  assert.equal(expiryStream('GLD', '2026-11-27'), 'GLD_20261127_GLD@optionChainQuoteDelayed');
  const rows = rowsFromOptionMessage({ stream: 'GLD_20261127_GLD@optionChainQuoteDelayed', data: { q: [{ os: 'GLD261127C00385000', v: 12 }] } });
  assert.equal(rows.length, 1);
} finally {
  store.close();
  rmSync(tempDir, { recursive: true, force: true });
}


// Premium estimates are recorded only when a recent quote and spot snapshot
// accompany the Volume increase. They remain explicitly estimated, not fills.
const quoteStore = new VolumeFlowStore({ dbPath: ':memory:', now: () => Date.parse('2026-11-23T15:00:00Z') });
try {
  const baseTime = Date.parse('2026-11-23T15:00:00Z');
  const quotedContract = {
    optionSymbol: 'GLD261127C00385000', symbol: 'GLD', expiry: '2026-11-27', side: 'C', strike: 385,
    volume: 100, bid: 2.4, ask: 2.6, multiplier: 100,
    quoteUpdatedAt: baseTime, underlyingSpot: 400, spotTimeMs: baseTime, spotAgeMs: 250
  };
  quoteStore.ingest(quotedContract, { source: 'rest-bootstrap', observedAt: baseTime });
  const withQuote = quoteStore.ingest({ ...quotedContract, volume: 150 }, { source: 'websocket', observedAt: baseTime + 1_000, sourceTimeMs: baseTime + 1_000 });
  assert.equal(withQuote.event.optionPrice, 2.5);
  assert.equal(withQuote.event.optionPriceSource, 'NBBO midpoint');
  assert.equal(withQuote.event.estimatedPremiumUsd, 12_500);
  assert.equal(withQuote.event.multiplierAssumed, false);
  assert.equal(withQuote.event.underlyingSpot, 400);
  assert.equal(withQuote.event.spotAgeMs, 250);

  quoteStore.ingest({ ...quotedContract, volume: 150, quoteUpdatedAt: baseTime - 120_000 }, { source: 'websocket', observedAt: baseTime + 2_000 });
  const staleQuote = quoteStore.ingest({ ...quotedContract, volume: 175, quoteUpdatedAt: baseTime - 120_000 }, { source: 'websocket', observedAt: baseTime + 3_000, sourceTimeMs: baseTime + 3_000 });
  assert.equal(staleQuote.event.estimatedPremiumUsd, null, 'stale quotes do not create synthetic Premium values');
  assert.equal(quoteStore.listEvents({ symbol: 'GLD', limit: 5 })[0].estimatedPremiumUsd, null);
} finally {
  quoteStore.close();
}

console.log('Volume Flow store/collector tests: passed');
