/* ICT QuantLab offline shell. Bump CACHE_VERSION whenever the app shell changes. */
const CACHE_VERSION = "ict-quantlab-shell-v57";
const SHELL = [
  "./", "./index.html", "./manifest.webmanifest",
  "./img/logo.png", "./img/pwa-192.png", "./img/pwa-512.png",
  "./img/pwa-maskable-512.png", "./img/apple-touch-icon.png",
  "./css/style.css", "./css/options.css", "./css/stock-options.css",
  "./css/cross-asset-map.css", "./css/simple-workspace.css",
  "./css/simple-options-polish.css", "./css/ict-quantlab-theme.css", "./css/pwa.css", "./css/quantlab-gex.css",
  "./js/core.js", "./js/symbols.js", "./js/timezone.js", "./js/ctrader.js",
  "./js/chart.js", "./js/candle-style.js", "./js/indicators-defs.js",
  "./js/indicators-custom.js", "./js/pine-indicators-defs.js", "./indicators/atas-catalog.js", "./indicators/atas-technical-runtime.js", "./indicators/atas-session-runtime.js", "./indicators/atas-tick-runtime.js", "./indicators/individual/acbw.js", "./indicators/individual/acdc.js", "./indicators/individual/adf.js", "./indicators/individual/adr.js", "./indicators/individual/adx.js", "./indicators/individual/adxr.js", "./indicators/individual/ama.js", "./indicators/individual/awesomeoscillator.js", "./indicators/individual/atr.js", "./indicators/individual/atrn.js", "./indicators/individual/adaptiversiaverage.js", "./indicators/individual/alligator.js", "./indicators/individual/aroonindicator.js", "./indicators/individual/askbidbars.js", "./indicators/individual/averagedelta.js", "./indicators/individual/averagepricebar.js", "./indicators/individual/bop.js", "./indicators/individual/bwma.js", "./indicators/individual/bidask.js", "./indicators/individual/bidaskvr.js", "./indicators/individual/blockma.js", "./indicators/individual/bollingerbands.js", "./indicators/individual/bollingerbandsbandwidth.js", "./indicators/individual/bollingerbandspercent.js", "./indicators/individual/bollingersqueeze.js", "./indicators/individual/cav.js", "./indicators/individual/cbi.js", "./indicators/individual/cci.js", "./indicators/individual/cfo.js", "./indicators/individual/cmf.js", "./indicators/individual/cmo.js", "./indicators/individual/camarillapivots.js", "./indicators/individual/candlestatistics.js", "./indicators/individual/chaikinoscillator.js", "./indicators/individual/chandemomentum.js", "./indicators/individual/coppockcurve.js", "./indicators/individual/cumulativedailyvolume.js", "./indicators/individual/cumulativedelta.js", "./indicators/individual/dema.js", "./indicators/individual/dmi.js", "./indicators/individual/dailyhighlow.js", "./indicators/individual/demarker.js", "./indicators/individual/detrended.js", "./indicators/individual/deltacoloredcandles.js", "./indicators/individual/deltastrength.js", "./indicators/individual/deltaturnaround.js", "./indicators/individual/demand.js", "./indicators/individual/dispersion.js", "./indicators/individual/dividedbyprice.js", "./indicators/individual/dmindex.js", "./indicators/individual/donchian.js", "./indicators/individual/dtoscillator.js", "./indicators/individual/dynamiclevels.js", "./indicators/individual/dynamiclevelschannel.js", "./indicators/individual/ema.js", "./indicators/individual/emv.js", "./indicators/individual/elderray.js", "./indicators/individual/exhaustion.js", "./indicators/individual/fcv.js", "./indicators/individual/fishertransform.js", "./indicators/individual/fishertransforminverse.js", "./indicators/individual/forceindex.js", "./indicators/individual/fractals.js", "./indicators/individual/gmma.js", "./indicators/individual/gaps.js", "./indicators/individual/greatestswing.js", "./indicators/individual/hma.js", "./indicators/individual/hvr.js", "./indicators/individual/heikenashi.js", "./indicators/individual/heikenashismoothed.js", "./indicators/individual/highlow.js", "./indicators/individual/hurstexponent.js", "./indicators/individual/ichimoku.js", "./indicators/individual/imbalanceratio.js", "./indicators/individual/inertia.js", "./indicators/individual/inertia2.js", "./indicators/individual/kama.js", "./indicators/individual/kdj.js", "./indicators/individual/keltnerchannel.js", "./indicators/individual/kurtosis.js", "./indicators/individual/linregchannel.js", "./indicators/individual/linregslope.js", "./indicators/individual/linearreg.js", "./indicators/individual/macd.js", "./indicators/individual/mfi.js", "./indicators/individual/mmed.js", "./indicators/individual/madifference.js", "./indicators/individual/maenvelope.js", "./indicators/individual/macdbbimproved.js", "./indicators/individual/macdbbstandart.js", "./indicators/individual/macdleader.js", "./indicators/individual/macdvw.js", "./indicators/individual/marketfacilitation.js", "./indicators/individual/maxlevels.js", "./indicators/individual/meandev.js", "./indicators/individual/momentum.js", "./indicators/individual/momentumtrend.js", "./indicators/individual/murraymath.js", "./indicators/individual/obv.js", "./indicators/individual/osma.js", "./indicators/individual/outsidebar.js", "./indicators/individual/parabolicsar.js", "./indicators/individual/percentageprice.js", "./indicators/individual/polarizedfractal.js", "./indicators/individual/qqe.js", "./indicators/individual/qstick.js", "./indicators/individual/rmi.js", "./indicators/individual/rmo.js", "./indicators/individual/roc.js", "./indicators/individual/rsi.js", "./indicators/individual/rwi.js", "./indicators/individual/relativevigorindex.js", "./indicators/individual/relativevolume.js", "./indicators/individual/repulse.js", "./indicators/individual/roundnr.js", "./indicators/individual/sma.js", "./indicators/individual/smma.js", "./indicators/individual/spvo.js", "./indicators/individual/swwma.js", "./indicators/individual/szma.js", "./indicators/individual/schafftrendcycle.js", "./indicators/individual/speedoftape.js", "./indicators/individual/spreadvolume.js", "./indicators/individual/squeezemomentum.js", "./indicators/individual/starcbands.js", "./indicators/individual/stddev.js", "./indicators/individual/stddevbands.js", "./indicators/individual/stderrbands.js", "./indicators/individual/stochastic.js", "./indicators/individual/stochasticmomentum.js", "./indicators/individual/stochasticrsi.js", "./indicators/individual/supertrend.js", "./indicators/individual/swinghighlow.js", "./indicators/individual/t3.js", "./indicators/individual/tdsequential.js", "./indicators/individual/tema.js", "./indicators/individual/tma.js", "./indicators/individual/trix.js", "./indicators/individual/tsi.js", "./indicators/individual/tvi.js", "./indicators/individual/truerange.js", "./indicators/individual/ultimateoscillator.js", "./indicators/individual/unfinishedauctionmod.js", "./indicators/individual/updownvolumeratio.js", "./indicators/individual/vbrr.js", "./indicators/individual/vpf.js", "./indicators/individual/vwap.js", "./indicators/individual/vwma.js", "./indicators/individual/verticalhorizontalfilter.js", "./indicators/individual/volatilitychaikins.js", "./indicators/individual/volatilitytrend.js", "./indicators/individual/volumeindex.js", "./indicators/individual/volumeonchart.js", "./indicators/individual/volumesupreszones.js", "./indicators/individual/volumetrend.js", "./indicators/individual/volumezone.js", "./indicators/individual/vortex.js", "./indicators/individual/vsabettervolume.js", "./indicators/individual/vsawsd.js", "./indicators/individual/wad.js", "./indicators/individual/wao.js", "./indicators/individual/wwma.js", "./indicators/individual/wavetrend.js", "./indicators/individual/weisswave.js", "./indicators/individual/williamsr.js", "./indicators/individual/woodiescci.js", "./indicators/individual/zlema.js", "./indicators/individual/zscore.js", "./indicators/individual/zigzag.js", "./indicators/individual/acr.js", "./indicators/individual/ad.js", "./indicators/individual/adaptivebinarywavema.js", "./indicators/individual/angle.js", "./indicators/individual/aroonoscillator.js", "./indicators/individual/bandsenvelope.js", "./indicators/individual/bardifference.js", "./indicators/individual/barrange.js", "./indicators/individual/barvolumefilter.js", "./indicators/individual/barspattern.js", "./indicators/individual/bollingersqueezev2.js", "./indicators/individual/bollingersqueezev3.js", "./indicators/individual/cms.js", "./indicators/individual/dineg.js", "./indicators/individual/dipos.js", "./indicators/individual/dx.js", "./indicators/individual/detrendeddi.js", "./indicators/individual/dmoscillator.js", "./indicators/individual/doublestochastic.js", "./indicators/individual/doublestochasticbressert.js", "./indicators/individual/ergodic.js", "./indicators/individual/fishertransforminversersi.js", "./indicators/individual/highest.js", "./indicators/individual/insideequalsbar.js", "./indicators/individual/kdfast.js", "./indicators/individual/kdslow.js", "./indicators/individual/lowest.js", "./indicators/individual/momentumoscillator.js", "./indicators/individual/movingaverage.js", "./indicators/individual/rvi.js", "./indicators/individual/rvi2.js", "./indicators/individual/stochasticdinapoli.js", "./indicators/individual/stohasticpercentile.js", "./indicators/individual/volatilityhist.js", "./indicators/individual/wma.js", "./indicators/individual/wpr.js", "./indicators/individual/clusterstatistic.js", "./indicators/individual/dom.js", "./indicators/individual/clustersearch.js", "./indicators/individual/dailychange.js", "./indicators/individual/dailylines.js", "./indicators/individual/dompower.js", "./indicators/individual/initialbalance.js", "./indicators/individual/openline.js", "./indicators/individual/orderbookalerts.js", "./indicators/individual/pivots.js", "./indicators/individual/ratio.js", "./indicators/individual/stackedimbalance.js", "./indicators/individual/_compat_atas_ac.js", "./indicators/individual/_compat_atas_cvd_proxy.js", "./indicators/individual/_compat_atas_dynamic_channel.js", "./indicators/individual/_compat_atas_dynamic_levels.js", "./indicators/individual/_compat_atas_macd_bb.js", "./indicators/individual/_compat_atas_swing_levels.js", "./indicators/individual/_compat_atas_volosc.js", "./indicators/atas-registry-finalize.js", "./js/indicators-engine.js",
  "./js/connection-ui.js", "./js/stock-options-config.js", "./js/stock-options-volatility.js", "./js/stock-options-analysis.js", "./js/stock-options-surfaces.js", "./js/stock-options-3d.js", "./js/stock-options.js", "./js/quantlab-gex-model.js", "./js/quantlab-gex.js",
  "./js/cross-asset-map.js", "./js/init.js", "./js/drawings-core.js",
  "./js/market-model-indicators.js", "./js/volume-profile.js", "./js/hvn-profile.js",
  "./js/killzones.js", "./js/ict-2022.js", "./js/crt.js", "./js/tpo.js",
  "./js/goldbach.js", "./js/qt.js", "./js/orderflow-footprint.js",
  "./js/orderflow-bigtrade.js", "./js/orderflow-statistic.js",
  "./js/orderflow-absorption.js", "./js/orderflow-dom.js",
  "./js/drawings-interact.js", "./js/mobile.js", "./js/tpo-advanced.js", "./js/pwa.js"
, "./indicators/atas-session-runtime.js"];
const STATIC_PATH = /\/(?:css|js|img|indicators)\/[^?#]+$/;
const EXTERNAL_STATIC = /^(?:https:\/\/cdn\.jsdelivr\.net\/|https:\/\/fonts\.googleapis\.com\/|https:\/\/fonts\.gstatic\.com\/)/;

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    // The ATAS catalogue now has one JS module per indicator. Cache in bounded batches
    // instead of issuing 300+ static requests in one addAll() burst.
    const batchSize = 24;
    for (let i = 0; i < SHELL.length; i += batchSize) {
      await cache.addAll(SHELL.slice(i, i + batchSize));
    }
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
