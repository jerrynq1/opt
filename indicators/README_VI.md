# ATAS Indicators → ICT QuantLab (Vietnamese handoff)

## Contents

- `atas-catalog.json`: machine-readable inventory of every ATAS indicator discovered from the full `Technical/` tree, including nested folders such as `DomV3/`.
- `atas-catalog.js`: browser-loaded copy of the same catalogue for the Kho Indicator UI.
- `atas-technical.js`: browser-native JavaScript calculations added to QuantLab. It loads after `js/pine-indicators-defs.js` and before `js/indicators-engine.js`.

## Coverage

The uploaded source archive contains 254 distinct indicator declarations identified by `DisplayName`. All 254 are represented in the catalogue and searchable in the UI. QuantLab now contains 150 browser-native JavaScript indicator definitions in the added module layer; 188 source declarations are linked to those definitions or existing QuantLab modules (some source variants share the same implementation). The source-class/path audit found an exact match: 254 declarations in the ATAS Technical tree, 254 catalogue entries, no missing or extra classes. This is a full inventory integration, not a claim that all 254 have a one-to-one executable port.

Current coverage by source declaration:

| Status | Count | Meaning |
|---|---:|---|
| Ported | 184 | JavaScript calculation linked; includes 80 clearly flagged nearest/proxy adaptations |
| Existing | 4 | Reuses an existing QuantLab Orderflow / ICT module |
| Needs tick/trade/footprint feed | 27 | Requires trade tape, candle price-level volume, bid/ask or footprint data |
| Needs full depth/MBO | 11 | Requires genuine order-book / MBO data |
| Needs session calendar | 8 | Requires configured exchange session/timezone |
| Needs external data | 9 | Requires breadth, external symbol or account source |
| Visual-only utility | 11 | ATAS-specific candle coloring / drawing / UI behavior |

The 150 registered JavaScript definitions support 188 catalogue entries because multiple ATAS variants/aliases share a QuantLab calculation. The remaining 66 entries are not silently omitted: each remains searchable and disabled with its exact data/renderer blocker shown. The catalogue also includes QuantLab-native entries in the same searchable screen, so its “Tất cả” count can be higher than 254.

The catalogue distinguishes:

- `ported`: JavaScript implementation added using chart OHLCV. `conversion: direct` means the source calculation was ported closely; `conversion: approx_proxy` means the UI explicitly identifies an approximation/proxy, not a guaranteed 1:1 equivalent.
- `existing`: a corresponding QuantLab module already exists.
- `approx_proxy`: nearest available QuantLab formula/module; not guaranteed to match ATAS 1:1.
- `needs_ticks`: requires trade/tick tape or aggressor-side information.
- `needs_depth`: requires full market depth/MBO or genuine open-interest input.
- `needs_external`: requires external symbols, COT or account/portfolio data.
- `needs_session`: requires the same exchange session calendar/timezone as ATAS.
- `visual_only`: ATAS-specific drawing, UI or renderer utility.

Only entries with a registered QuantLab implementation receive an enabled “Thêm vào chart” control. Other entries remain visible and searchable, with their blockers identified. No remaining entry is labelled pending: each unlinked entry is assigned a feed, account, breadth, session or renderer requirement.

## Important technical boundary

ATAS indicator sources are C#/.NET code that depends on ATAS/OFT APIs and runtime types. The browser PWA does not load those .NET assemblies. The new `atas-technical.js` is a JavaScript adaptation layer that uses the existing QuantLab OHLCV arrays and the current indicator renderer. It does not embed proprietary ATAS assemblies, ATAS UI code, or claim to recreate ATAS trade tape, MBO, order-book, account or session services.

For CFD instruments, chart volume and candle-derived up/down estimates are not exchange-native bid/ask trades. A proxy must not be interpreted as verified orderflow. The catalogue preserves these limitations so an item is not presented as fully operational when its required feed is absent.

## Load order

`indicators-defs.js` → `indicators-custom.js` → `pine-indicators-defs.js` → `indicators/atas-catalog.js` → `indicators/atas-technical.js` → `indicators-engine.js`.

## Deploy

This change is frontend-only. Publish the full static source. `sw.js` was bumped to `ict-quantlab-shell-v45` and the two new JavaScript files were added to the precache shell. After publishing, hard-refresh the browser or close/reopen the installed PWA so it installs the new shell.

No Node restart, Worker deploy/restart, Cloudflare Tunnel restart, DNS change or port change is required. Keep the current Windows secrets and task configuration untouched.
