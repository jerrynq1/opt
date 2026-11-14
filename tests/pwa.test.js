'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

test('PWA manifest is installable and points to valid app icons', () => {
  const manifest = JSON.parse(read('manifest.webmanifest'));
  assert.equal(manifest.short_name, 'QuantLab');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, './#chart');
  assert.equal(manifest.scope, './');
  for (const icon of manifest.icons) {
    assert.ok(fs.existsSync(path.join(root, icon.src.replace(/^\.\//, ''))), `missing ${icon.src}`);
  }
});

test('iOS install metadata and bottom navigation mount point are present', () => {
  const html = read('index.html');
  for (const token of [
    'apple-mobile-web-app-capable', 'apple-mobile-web-app-status-bar-style',
    'apple-mobile-web-app-title', 'rel="manifest"', 'apple-touch-icon',
    'id="mobileBottomNav"', 'id="pwaHelpDialog"', 'id="pwaInstallButton"'
  ]) assert.ok(html.includes(token), `missing ${token}`);
  assert.ok(html.includes('js/pwa.js'));
});

test('mobile tab order is QQQ, GLD, Chart, Indicators, Connection with Chart centered', () => {
  const nav = read('js/connection-ui.js');
  assert.match(nav, /const MOBILE_V=\[\["qqqOptions","QQQ"[\s\S]*?\["gldOptions","GLD"[\s\S]*?\["chart","Chart"[\s\S]*?\["ind","Indicators"[\s\S]*?\["conn","Connection"/);
  assert.match(nav, /k==="chart"\?" is-center"/);
  assert.match(nav, /mobileBottomNav.*addEventListener\("click"/);
});

test('PWA service worker precaches app shell but does not cache live trading APIs', () => {
  const sw = read('sw.js');
  assert.match(sw, /ict-quantlab-shell-v21/);
  assert.match(sw, /\"\.\/js\/pwa\.js\"/);
  assert.match(sw, /if \(request\.method !== \"GET\"\) return/);
  assert.match(sw, /Market APIs and cTrader sockets remain live-only/);
  assert.match(sw, /request\.mode === \"navigate\"/);
});

test('install instructions distinguish installed state and supported install prompt', () => {
  const pwa = read('js/pwa.js');
  assert.match(pwa, /navigator\.standalone===true/);
  assert.match(pwa, /beforeinstallprompt/);
  assert.match(pwa, /showModal/);
  assert.match(pwa, /navigator\.serviceWorker\.register/);
});

test('all service-worker app-shell files exist in the deployed folder', () => {
  const sw = read('sw.js');
  const block = sw.match(/const SHELL = \[([\s\S]*?)\];/);
  assert.ok(block, 'service worker shell list found');
  const paths = [...block[1].matchAll(/"(\.\/[^\"]+)"/g)].map(m => m[1]);
  assert.ok(paths.length >= 40);
  for (const item of paths) {
    const diskPath = item === './' ? 'index.html' : item.replace(/^\.\//, '');
    assert.ok(fs.existsSync(path.join(root, diskPath)), `missing cached shell asset ${item}`);
  }
});

test('mobile app navigation is fixed above the iOS safe area and Chart is the raised center tab', () => {
  const css = read('css/pwa.css');
  assert.match(css, /\.mobile-bottom-nav\{position:fixed/);
  assert.match(css, /env\(safe-area-inset-bottom,0px\)/);
  assert.match(css, /\.mobile-tab\.is-center \.mobile-tab-icon\{[^}]*transform|\.mobile-tab\.is-center \.mobile-tab-icon\{/);
  assert.match(css, /#side\{display:none!important\}/);
});

test('fresh PWA launch opens the main Chart tab unless a valid deep-link is supplied', () => {
  const init = read('js/init.js');
  assert.match(init, /v0=V\.some\(\(\[k\]\)=>k===hv\)\?hv:"chart"/);
});
