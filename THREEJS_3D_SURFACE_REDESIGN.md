# QuantLab — Three.js 3D Surface Redesign

## What changed

The Greeks 3D and Options Surface 3D workspaces now use the Three.js r128 WebGL renderer as their primary renderer. The implementation reuses the legacy surface concept supplied by the user (indexed mesh, 3D camera, axis/tick labels, pointer rotation and zoom), while applying QuantLab's dark navy / teal / indigo / gold visual system.

## Axes

- **X — Strike / Spot:** strike moneyness buckets relative to the current underlying Spot. Tick labels show percentage moneyness; the 0% bucket is highlighted as Spot and a gold ATM ridge / dot marks the underlying price across observed expiries. Hover also shows the approximate strike price.
- **Y — Expiry / DTE:** the expiry dimension, ordered by remaining days to expiry.
- **Z — Metric:** selected Greek, IV or exposure/volume/OI metric. Signed values use a symmetric zero-centered height scale and a visible zero reference plane.

Axis colors are consistent in both panels: X cyan, Y indigo, Z warm gold. The surface palette changes by metric family: signed teal/coral, IV blue/cyan/lilac, Volume violet, and OI amber.

## Interaction and performance

- Pointer drag rotates the 3D camera.
- Mouse wheel and the plus/minus controls zoom; two-finger pinch zoom is supported through Pointer Events.
- Reset restores the default camera.
- Hover identifies the nearest observed vertex and shows expiry, DTE, approximate strike, moneyness, value and coverage metadata.
- The WebGL context is retained between data refreshes; only the plotted mesh is rebuilt. This avoids creating a new GPU context for every quote refresh.
- Missing cells remain missing. Wireframe segments stop at gaps; they are not joined across absent observations.

## Runtime dependency / fallback

Three.js `0.128.0` is loaded from a pinned jsDelivr URL before `stock-options-3d.js`. The existing service worker allows and caches jsDelivr static assets. If the CDN or WebGL is unavailable, the existing lightweight Canvas projection is used and the toolbar explicitly labels it as a **2D projection fallback**, not true WebGL 3D.

## Data interpretation

The geometry is a discrete, bucketed surface. It is not a fitted or arbitrage-free continuous volatility surface. Greek surfaces show the per-contract statistic produced by the surface builder; exposure surfaces use their documented OI/multiplier aggregation. Partial and missing data are not zero-filled.

## Readability and Spot reference update

- Axis tick labels and XYZ axis titles use larger high-resolution text sprites; the footer labels are larger too.
- The Y axis includes an explicit 0DTE origin and adaptive DTE tick intervals up to the farthest loaded expiry.
- A gold Spot/ATM marker is placed on observed ATM cells for each expiry and joined only across contiguous observed rows. If the exact 0% bucket is absent, it is interpolated only from valid cells bracketing zero moneyness and is labeled EST.
- The same Spot marker and 0DTE axis behavior is provided by the Canvas fallback.

## Axis readability and Spot reference

- Tick labels and XYZ titles are enlarged on both the WebGL renderer and Canvas fallback.
- The expiry axis begins at 0DTE and is divided into adaptive readable intervals up to the farthest loaded expiry. Actual same-day options stay at their fractional DTE; no artificial T=0 data row is added.
- A gold Spot/ATM ridge and sphere markers are drawn over valid surface cells at 0% moneyness. If an exact ATM bucket is missing, the marker is interpolated only from valid observations bracketing zero moneyness and labeled EST.
