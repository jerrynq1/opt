# Main Exposure: Vanna/Charm GEX/DEX visual parity

Vanna and Charm now use the exact same bilateral Exposure renderer as GEX and DEX. This is a markup/rendering unification, not merely a palette change.

- Same `exposure-plot`, `exposure-axis-head`, `exposure-rows`, `exposure-row`, `exposure-put-track`, `exposure-zero`, and `exposure-call-track` elements.
- Same Call-right cyan and Put-left gold styles from `ict-quantlab-theme.css`.
- Same row height, strike column, zero line, Spot marker, Call/Put OI walls, GEX wall markers, legend, responsive layout, and bar scaling.
- Vanna maps to `callVannaEx` / `putVannaEx`; Charm maps to `callCharmEx` / `putCharmEx`.
- Bar width shows absolute contribution magnitude per option side (same display convention as GEX/DEX). Original signed Vanna/Charm contributions are preserved in row hover titles, and explanatory notes continue to state that OI-weighted model Greek is not dealer positioning.
- Vanna/Charm model coverage status remains visible.
- The signed-only Vanna/Charm layout and its CSS have been removed.

Files changed:
- `js/stock-options.js`
- `css/stock-options.css`
- `sw.js` (cache version `v44`)
- `tests/exposure-vanna-charm-colors.test.mjs`

No Greek calculations, exposure scaling, Node.js, Worker, Task Scheduler, or Cloudflare Tunnel settings were changed.
