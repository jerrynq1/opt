# QuantLab — Single-expiry / 0DTE 3D profile fix

## What changed

- A selected scope containing one expiry is no longer rejected because a full 2D area mesh needs at least two expiry rows.
- The renderer now treats one expiry as a **3D strike profile**: X = moneyness/strike, Y = that expiry's actual DTE, Z = selected Greek or surface metric.
- It draws a line only between adjacent valid moneyness buckets and shows valid observations as points. Missing buckets remain gaps.
- No synthetic expiry row, time interpolation, or artificial mesh faces are created.
- The gold Spot marker is supported on a single-expiry profile, using the observed zero-moneyness bucket or interpolation between valid buckets that bracket Spot.
- For a fractional same-day expiry (e.g. 0.25 DTE), the single-expiry Y display domain is 0..1D so the profile sits near the 0DTE origin while preserving its exact DTE coordinate. Exact DTE=0 remains at the origin.
- When more than one expiry exists and valid cells overlap across adjacent strikes, the regular multi-expiry surface mesh is rendered as before.

## Install

For an existing deployment, merge these two files from the patch:

- `opt-main/js/stock-options-3d.js`
- `opt-main/sw.js`

Publish the website, then reload the PWA / hard-refresh the browser. The service-worker cache is `ict-quantlab-shell-v38`.

No Node.js, Cloudflare Worker, Task Scheduler, or Cloudflare Tunnel restart is required.

## Validation

- 0DTE exact single-expiry profile.
- Fractional 0DTE (0.25D) on a 0..1D axis with exact DTE retained.
- Single-expiry Spot marker resolution.
- Sparse strike buckets remain disconnected; no false bridging.
- Empty one-expiry input remains an empty state.
- Multi-expiry mesh and prior 0DTE ordering behavior remain unchanged.
