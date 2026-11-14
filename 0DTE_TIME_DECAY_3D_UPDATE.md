# 0DTE Time-Decayed 3D Surface Update

## What changed

When Analysis Scope contains exactly one expiry and its remaining time is at most one calendar day, the Greeks 3D and Options Surface 3D builders now create a nine-slice time-to-expiry projection. This replaces the former one-row/single-value Y-axis profile.

- X: Strike / Spot moneyness.
- Y: Remaining time to the selected expiry (DTE), with an explicit 0DTE origin and multiple intermediate ticks.
- Z: The selected Greek or surface metric.
- The real listed expiry is unchanged; no second expiry or T=0 contract row is fabricated.
- DTE ticks under one hour are labelled in minutes (for example `2.9m`) so separate near-expiry ticks do not all display as `0.00D`. Fractional day values are shown with up to three decimals.

## Projection methodology

The highest-DTE slice is the current observed snapshot and retains provider Greek values when available. Lower-DTE slices are model scenarios recalculated with Black-Scholes as time remaining decreases. Spot, observed IV, open interest and contract multiplier are held constant. Model inputs use the current project assumptions (risk-free rate 0%; dividend yield 0.45% for QQQ and 0% for GLD).

- Greeks: model Greeks are recalculated for each time slice.
- Exposure metrics (GEX, DEX, Vega, Theta, Vanna, Charm): recomputed from the model Greeks and held-constant OI/multiplier.
- IV, Volume and OI: held flat across the time axis; the current data does not justify inventing a future IV, volume or OI path.
- The renderer labels projected vertices as `MODELLED TIME SLICE` and the top/current row as `OBSERVED SNAPSHOT`.

The first model slice remains above mathematical T=0 to avoid singular Black-Scholes values at expiry. The displayed Y-axis still begins at 0DTE; the mesh starts at the smallest positive modelled time.

## Files changed

- `js/stock-options-surfaces.js`: creates and aggregates the nine intraday time slices for both Greeks and exposure/market surfaces.
- `js/stock-options-3d.js`: maps time slices to the Y axis; adds readable fractional DTE/minute labels and a `TIME REMAINING` axis title in projection mode.
- `js/stock-options.js`: reports the projection and model assumptions in the Greeks/Surface status and footnote.
- `sw.js`: bumps app-shell cache to `v40`.

## Installation

Merge the patch files into the current website source, publish, then hard refresh or reopen the installed PWA. No Node.js, Worker, Task Scheduler or Cloudflare Tunnel restart is required.
