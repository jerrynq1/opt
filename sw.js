/* ICT QuantLab offline shell. Bump CACHE_VERSION whenever the app shell changes. */
const CACHE_VERSION = "ict-quantlab-shell-v1";
const SHELL = [
  "./", "./index.html", "./manifest.webmanifest",
  "./img/logo.png", "./img/pwa-192.png", "./img/pwa-512.png",
  "./img/pwa-maskable-512.png", "./img/apple-touch-icon.png",
  "./css/style.css", "./css/options.css", "./css/stock-options.css",
  "./css/cross-asset-map.css", "./css/simple-workspace.css",
  "./css/simple-options-polish.css", "./css/ict-quantlab-theme.css", "./css/pwa.css",
  "./js/core.js", "./js/symbols.js", "./js/timezone.js", "./js/ctrader.js",
  "./js/chart.js", "./js/candle-style.js", "./js/indicators-defs.js",
  "./js/indicators-custom.js", "./js/pine-indicators-defs.js", "./js/indicators-engine.js",
  "./js/connection-ui.js", "./js/stock-options-config.js", "./js/stock-options.js",
  "./js/cross-asset-map.js", "./js/init.js", "./js/drawings-core.js",
  "./js/market-model-indicators.js", "./js/volume-profile.js", "./js/hvn-profile.js",
  "./js/killzones.js", "./js/ict-2022.js", "./js/crt.js", "./js/tpo.js",
  "./js/goldbach.js", "./js/qt.js", "./js/orderflow-footprint.js",
  "./js/orderflow-bigtrade.js", "./js/orderflow-statistic.js",
  "./js/orderflow-absorption.js", "./js/orderflow-dom.js",
  "./js/drawings-interact.js", "./js/mobile.js", "./js/tpo-advanced.js", "./js/pwa.js"
];
const STATIC_PATH = /\/(?:css|js|img)\/[^?#]+$/;
const EXTERNAL_STATIC = /^(?:https:\/\/cdn\.jsdelivr\.net\/|https:\/\/fonts\.googleapis\.com\/|https:\/\/fonts\.gstatic\.com\/)/;

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    await cache.addAll(SHELL);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith("ict-quantlab-") && key !== CACHE_VERSION).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Cache only pinned, static third-party assets. Market APIs and cTrader sockets remain live-only.
  if (EXTERNAL_STATIC.test(url.href)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_VERSION);
      const cached = await cache.match(request);
      const update = fetch(request).then(response => {
        if (response && (response.ok || response.type === "opaque")) cache.put(request, response.clone()).catch(() => {});
        return response;
      }).catch(() => null);
      return cached || await update || Response.error();
    })());
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_VERSION);
      try {
        const response = await fetch(request);
        if (response && response.ok) cache.put("./index.html", response.clone()).catch(() => {});
        return response;
      } catch (error) {
        return (await cache.match("./index.html")) || Response.error();
      }
    })());
    return;
  }

  if (STATIC_PATH.test(url.pathname) || url.pathname.endsWith("/manifest.webmanifest")) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_VERSION);
      const cached = await cache.match(request, {ignoreSearch: true});
      if (cached) return cached;
      const response = await fetch(request);
      if (response && response.ok) cache.put(request, response.clone()).catch(() => {});
      return response;
    })());
  }
});
