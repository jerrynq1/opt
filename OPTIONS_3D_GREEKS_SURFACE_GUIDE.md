# QuantLab — Greeks 3D & Options 3D Surface Guide

## Layout

The Options page has two separate interactive 3D workspaces:

- **C · Greeks 3D**: per-contract Greek surface. Select Delta, Gamma, Vega, Theta, Vanna, Charm or Rho, and select Calls or Puts.
- **D · Options Surface 3D**: select IV, Exposure, Volume or Open Interest. Exposure metrics include GEX, DEX, Vega, Theta, Vanna and Charm.

## XYZ axes

- **X**: strike moneyness relative to Spot, `(strike / spot - 1) × 100`, in 2.5 percentage-point buckets from -20% to +20%. Hover tooltips also show the approximate strike price.
- **Y**: expiry time to maturity in calendar days (DTE), sorted from nearest to farthest. The axis always starts at **0DTE** and adds adaptive, evenly spaced expiry ticks. Same-day options remain at their real fractional DTE (for example 0.25D); the chart does not fabricate a zero-time contract row.
- **Z**: selected Greek, IV or surface metric. Signed metrics use a zero-centred symmetric Z scale.

The mesh aggregates observed contracts into expiry × moneyness buckets. Greek surfaces show the median per-contract Greek in each bucket. Options surfaces use their respective aggregation rules: IV median; exposure sums Greek × OI × multiplier; Volume/OI sum contracts.

## Interactions

- Drag on the canvas to rotate the 3D camera.
- Mouse wheel or `+` / `−` buttons to zoom.
- `Reset` restores the initial camera.
- Hover a vertex to inspect expiry, DTE, approximate strike, moneyness, metric value, quote coverage, provider/model counts, and full/partial chain status. A gold Spot marker/ridge highlights the 0% moneyness surface point across expiries; if the exact ATM bucket is missing, it is interpolated only from valid cells on both sides and labeled EST.

Select Analysis Scope → **Weekly** or **All Expiries**. At least two expiry rows and adjacent populated moneyness buckets are required to construct a 3D mesh. A single-expiry selection intentionally shows an explanatory empty state rather than presenting a line as a surface.

## Greek surfaces vs exposure surfaces

- Greek surfaces are per-contract sensitivities. Calls and Puts are selectable separately to avoid blending positive Call Delta and negative Put Delta into a misleading median.
- Provider Delta/Gamma/Vega/Theta are used when present. Missing values use a BSM fallback with `r = 0%` and `q = 0.45%` for QQQ / `q = 0%` for GLD. Vanna, Charm and Rho are model-derived in the current feed where Provider fields are absent.
- Vanna and Charm depend on the BSM assumptions; the Binance options may be American-style, so treat these as model estimates, not exchange-provided values.
- Exposure Surface is distinct: GEX/DEX/Vega/Theta/Vanna/Charm are exposure aggregates. GEX retains the displayed Call-positive / Put-negative convention; this is not verified dealer positioning because OI does not reveal holder direction.
- Volume is contract volume, not signed buyer/seller flow. Open Interest is outstanding contracts, not directional positioning.
- Missing cells are not zero-filled and faces are not drawn across gaps. Partial expiries remain marked partial.

## Rendering

The primary renderer uses Three.js r128 with WebGL: an indexed, shaded XYZ mesh, subtle row/column wireframe, floor and back-plane grids, individually colored X/Y/Z axes, tick labels and a zero plane for signed metrics. X = Strike/Spot moneyness, Y = expiry/DTE, Z = selected metric. Drag rotates the camera, the wheel / pinch / buttons zoom, and hover inspects the nearest observed vertex. Three.js is loaded from a pinned jsDelivr URL and is cached by the service worker. If WebGL or the CDN is unavailable, the app explicitly labels the Canvas 2D projected fallback instead of claiming it is true WebGL 3D. The surface remains a discrete bucketed surface, not a fitted or arbitrage-free continuous volatility surface.
