# QuantLab 3D Axis & Spot Marker Update

## Visual changes
- Increased tick label and X/Y/Z axis title sizes for both Greeks 3D and Options Surface 3D.
- Increased chart stage height and enlarged axis footer labels.
- Added a gold Spot/ATM marker on the surface: markers follow the 0% moneyness ridge through valid expiry rows, with a highlighted near-expiry dot and Spot price label.
- If an exact 0% bucket is absent, the point is estimated only from valid cells bracketing zero moneyness and the label displays `EST.`. It is not drawn from a one-sided extrapolation.

## Expiry axis
- Surface rows are stably sorted by DTE ascending.
- The Y-axis starts at 0DTE, then uses adaptive intervals through the farthest loaded expiry.
- Same-day options remain at their actual fractional DTE (e.g. 0.25D). No synthetic T=0 option row is fabricated because model Greeks can be singular or discontinuous at expiry.
- Both the WebGL renderer and the Canvas fallback use the same DTE mapping and tick labels.

## Install
Merge the patch into the current `opt-main` folder, publish the website, then reload the PWA so service-worker cache `ict-quantlab-shell-v38` activates. No Node.js, Worker or Cloudflare Tunnel restart is required.


## Single-expiry / 0DTE 3D display

A single expiry is rendered as a 3D strike profile at its exact DTE; it is not rejected just because an area mesh requires two expiry rows. No second expiry row or mesh faces are fabricated. For fractional same-day expiry (e.g. 0.25 DTE), the Y display domain is 0..1D while the profile remains positioned at the exact observed DTE. Full multi-expiry mesh rendering is unchanged.
