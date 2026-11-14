# QuantLab — Full Updated Source (2026-11-14)

This archive is the complete project source, not a patch. It combines the supplied `opt-main (2).zip` project with the latest IV/volatility work, Skew Clean/Raw and X-axis zoom, IV Surface, Exposure Surface, Volume/OI surfaces, Vanna/Charm exposure, IV algorithm fixes, and and the Node Spot startup pre-warm. The current package also contains dedicated interactive 3D Greeks and Options Surface modules.

## Included

- Complete PWA/frontend source, assets, styles, service worker and manifest.
- Cloudflare Worker source and `wrangler.toml`.
- Node gateway and Binance Spot feed source.
- IV/volatility analytics, Skew chart, Constant Maturity IV, a dedicated Greeks 3D workspace, Options 3D Surfaces (IV/Exposure/Volume/OI), and regression tests.
- Existing project documentation and the IV audit reports.

## Greeks 3D and Options 3D Surface

The Options view contains two dedicated interactive 3D workspaces:

- **C · Greeks 3D**: choose Delta, Gamma, Vega, Theta, Vanna, Charm or Rho, and Calls or Puts.
- **D · Options Surface 3D**: choose IV, Exposure, Volume or Open Interest. Exposure metrics include GEX, DEX, Vega, Theta, Vanna and Charm.
- **Axes**: X = strike moneyness relative to Spot (2.5 percentage-point buckets), Y = expiry/DTE, Z = selected metric.
- **Controls**: drag to rotate, wheel or +/- to zoom, Reset to restore the camera, hover a mesh vertex for a tooltip.
- Use Analysis Scope → **Weekly** or **All Expiries**. At least two expiry rows and adjacent populated moneyness buckets are required to draw a 3D mesh; a single-expiry selection intentionally shows an explanatory empty state.
- Greeks are median per-contract values, not OI-weighted exposure. Exposure surfaces separately aggregate Greek × OI × contract multiplier. Missing buckets are not zero-filled and no surface face is drawn across a missing-data gap.
- Provider Greeks are preferred where present. BSM fallbacks use r=0%, q=0.45% for QQQ and q=0% for GLD; Vanna, Charm and Rho are model-derived where the current feed has no provider field. Treat model values as estimates, not exchange-provided Greeks.
- OI does not reveal dealer long/short positioning; Volume is not signed order flow. GEX Call+/Put− remains a display convention, not verified dealer positioning.

## Runtime configuration

- Node.js: 22 or newer (uses native WebSocket).
- Node gateway default port: `8788`.
- `server/start-hidden.vbs` sets `PORT=8788` for the Task Scheduler Node task.
- `server/home-proxy.mjs` pre-warms the Binance Spot feed at process startup.
- Frontend Spot API base: `https://api.gexadecimal.dev`.
- Keep the existing Cloudflare Named Tunnel pointed at `http://localhost:8788`. No new Tunnel or DNS record is required.
- The browser uses the Node gateway through the Named Tunnel as its primary Spot source; direct Binance browser WebSocket is only a fallback. The Cloudflare Worker remains responsible for Option Chain proxy routes.

## Deployment layout for the existing Windows setup

The archive contains one top-level `opt-main/` folder. For a full source checkout, preserve the folder layout. For your existing split-folder deployment:

1. Publish the static app files from `opt-main/` to your website repository/hosting root (including `index.html`, `js/`, `css/`, `img/`, `sw.js`, and `manifest.webmanifest`).
2. Copy `opt-main/server/` source files to `C:\server\` while preserving that folder layout. Keep your existing private `C:\server\quick-options-token.txt` (see token note below).
3. Copy `opt-main/worker/index.js` and `wrangler.toml` to your existing Worker project folder (`C:\worker\` or your configured Worker workspace) only when you intend to update the Worker deployment. The Spot WebSocket relay is not the primary Spot path because Binance rejected Cloudflare Worker egress; the Node gateway is primary.
4. Keep Task Scheduler's Node task pointed at `C:\server\start-hidden.vbs` (or `node C:\server\home-proxy.mjs`). The server defaults to port `8788`.
5. Keep the Named Tunnel service URL at `http://localhost:8788`. Do not change Worker and Tunnel tasks unless you are intentionally redeploying them.

## Private Quick Options token

For security, the archive deliberately does **not** include your live `server/quick-options-token.txt`. A safe placeholder `server/quick-options-token.txt.example` is included instead. Preserve your existing private token file when updating `C:\server\`; do not overwrite it with the example. If the real file is absent, `quick-options.mjs` generates a new token on first start, and any clients using the old token will need the new one. Never publish this token file in the public website repository.

## Verification

From the `opt-main/` directory:

```bash
bash tests/run-all.sh
node server/equity-price-feed.test.mjs
node server/stock-options-volatility.test.mjs
node server/stock-options-surfaces.test.mjs
node server/home-proxy.integration.test.mjs
```

The integration test disables Spot pre-warm via `DISABLE_SPOT_PREWARM=1` to avoid external WebSocket dependency. Production startup does not set that variable and therefore pre-warms Spot automatically. The service-worker shell cache is `ict-quantlab-shell-v35`; this version bump makes installed PWAs fetch the 3D renderer and updated Options UI. The browser-side regression runner currently passes 27/27 test files; the four additional Node-side feed/analytics/surface/home-proxy suites also pass.
