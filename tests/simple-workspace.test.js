'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

test('simple workspace exposes only Chart, QQQ, GLD, Indicators and cTrader navigation', () => {
  const html = read('index.html');
  const nav = read('js/connection-ui.js');
  for (const id of ['v-chart', 'v-qqqOptions', 'v-gldOptions', 'v-ind', 'v-conn']) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(nav, /const V=\[\["chart","Chart"\],\["qqqOptions","QQQ Options"\],\["gldOptions","GLD Options"\],\["ind","Kho Indicator"\],\["conn","Kết nối cTrader"\]\]/);
  assert.doesNotMatch(html, /<script[^>]+src=["']js\/options\.js["']/);
});

test('market picker is restricted to NAS100, SP500, XAUUSD and XAGUSD with broker aliases', () => {
  const src = read('js/symbols.js') + '\nresult = ["NAS100","US100","USTEC","SP500","US500","ES","XAUUSD","GOLD","XAGUSD","SILVER","EURUSD"].map(x => [x,symCanon(x)]);';
  const sandbox = { C: { sym: 'NAS100' }, $: () => null, document: {}, localStorage: {}, console };
  vm.runInNewContext(src, sandbox);
  assert.deepEqual(JSON.parse(JSON.stringify(sandbox.result.slice(0, 10).map(x => x[1]))), [
    'NAS100','NAS100','NAS100','SP500','SP500','SP500','XAUUSD','XAUUSD','XAGUSD','XAGUSD'
  ]);
  assert.equal(sandbox.result[10][1], null);
});

test('QQQ and GLD options, filtered indicator store and cTrader connect runtime remain loaded', () => {
  const html = read('index.html');
  for (const script of [
    'js/ctrader.js', 'js/chart.js', 'js/indicators-defs.js', 'js/indicators-custom.js',
    'js/pine-indicators-defs.js', 'js/indicators-engine.js', 'js/market-model-indicators.js',
    'js/stock-options-config.js', 'js/stock-options.js', 'js/cross-asset-map.js'
  ]) assert.ok(html.includes(`src="${script}"`), `missing ${script}`);
  for (const id of ['sym','tfs','chart','panes','cId','cSec','cTok','cSave','indGrid','actList']) {
    assert.match(html, new RegExp(`id=["']${id}["']`), `missing #${id}`);
  }
});
