import assert from 'node:assert/strict';
import { OptionsChainStore } from './options-chain-store.mjs';

const storeNow = Date.parse('2026-11-23T15:00:00Z');
const store = new OptionsChainStore({ dbPath: ':memory:', now: () => storeNow });
try {
  store.replaceExpiryInventory('GLD', [
    { expiry: '2026-12-04', contract_count: 2 },
    { expiry: '2026-11-27', contract_count: 2 }
  ], { source: 'exchange-info', updatedAt: storeNow });
  const snapshot = {
    symbol: 'GLD', expiry: '2026-11-27', total_contracts: 2, quote_count: 2,
    contracts: [
      { optionSymbol: 'GLD261127C00385000', side: 'C', strike: 385, volume: 120, openInterest: 90, iv: 0.24, bid: 2.4, ask: 2.5 },
      { optionSymbol: 'GLD261127P00385000', side: 'P', strike: 385, volume: 70, openInterest: 80, iv: 0.27, bid: 2.3, ask: 2.4 }
    ]
  };
  assert.deepEqual(store.saveChainSnapshot(snapshot), { saved: 2, total: 2 });
  assert.equal(store.listExpiries('GLD').length, 2);
  // Temporary upstream inventory omissions do not hide a previously cached expiry.
  store.replaceExpiryInventory('GLD', [{ expiry: '2026-12-04' }], { source: 'exchange-info-fallback', updatedAt: storeNow + 1_000 });
  assert.deepEqual(store.listExpiries('GLD').map(row => row.expiry), ['2026-11-27', '2026-12-04']);
  const saved = store.getChain('GLD', '2026-11-27');
  assert.equal(saved.stored_contracts, 2);
  assert.equal(saved.contracts[0].iv, 0.24);

  const unchangedSnapshot = store.mergeChainSnapshot(snapshot, { updatedAt: storeNow + 1_500 });
  assert.equal(unchangedSnapshot.changed, 0, 'unchanged full-chain comparisons do not rewrite contract rows');
  assert.equal(unchangedSnapshot.unchanged, 2);
  assert.equal(store.getContract('GLD261127C00385000').quoteUpdatedAt, storeNow + 1_500, 'the latest REST observation refreshes in-memory quote freshness without rewriting unchanged contract data');
  const deltaSnapshot = {
    ...snapshot,
    contracts: snapshot.contracts.map(item => item.optionSymbol === 'GLD261127C00385000'
      ? { ...item, volume: 145, bid: 2.45, ask: 2.55 }
      : item)
  };
  const deltaMerge = store.mergeChainSnapshot(deltaSnapshot, { updatedAt: storeNow + 2_000 });
  assert.equal(deltaMerge.changed, 1, 'only the contract with changed quote/volume fields is updated');
  assert.equal(deltaMerge.unchanged, 1);
  const updated = store.mergeLiveContracts('GLD', '2026-11-27', [
    { os: 'GLD261127C00385000', v: 155, bp: 2.46, ap: 2.56 }
  ], { updatedAt: storeNow + 3_000 });
  assert.equal(updated.changed, 1);
  const after = store.getChain('GLD', '2026-11-27');
  const call = after.contracts.find(item => item.optionSymbol.endsWith('C00385000'));
  assert.equal(call.volume, 155);
  assert.equal(call.bid, 2.46);
  assert.equal(call.ask, 2.56);
  assert.equal(call.quoteUpdatedAt, storeNow + 3_000, 'a new live quote refreshes the cached quote timestamp');
  assert.equal(call.openInterest, 90, 'partial websocket rows preserve cached fields');
  assert.equal(store.status().symbols.GLD.contracts, 2);
} finally {
  store.close();
}
console.log('Options Chain SQLite store tests: passed');
