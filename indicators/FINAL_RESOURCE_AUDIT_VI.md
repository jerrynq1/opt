# ICT QuantLab — Final ATAS Resource Audit (15/11/2026)

## 1. Source reconciliation

- ATAS input archive: 285 C# files.
- Source scan: 254 unique classes with a literal `DisplayName` attribute.
- Retained in QuantLab catalog/UI: **217**.
- Removed from catalog/UI: **37**, with each source class and reason listed in `REMOVED_INDICATORS_VI.md`.
- Reconciliation: `217 + 37 = 254`; no `DisplayName` source class is left unaccounted for.
- Fair Value Gap and Order Block are excluded as separate ATAS catalog entries because the QuantLab ICT 2022 module already provides the combined feature under one key; the QuantLab ICT feature itself is not removed.

## 2. Retained implementation inventory

| Conversion | Count | Meaning |
|---|---:|---|
| `direct` | 95 | Core formula/logic ported from the ATAS source or a direct mathematical implementation |
| `approx_proxy` | 100 | Working OHLCV/session/renderer approximation; not guaranteed 1:1 with ATAS |
| `quote_tick_proxy` | 21 | Uses BID/ASK quote events or quote-footprint; never executed trade volume |
| `existing_module` | 1 | Reuses a QuantLab feature already in the workspace |
| **Total** | **217** | All rows have a working registry key and their own JS module |

Catalog status counts: 195 `ported`, 20 `ported_tick`, and 2 `existing`. The 21 `quote_tick_proxy` conversion entries include the existing `Cluster Statistic` module; the 20 `ported_tick` statuses are separately shown in the tick audit.

Each of the 217 catalog rows has one `indicators/individual/<id>.js` file, a unique source class, a unique registry key, and metadata matching the JSON/JS catalog. Seven `_compat_*.js` files remain for compatibility; they are not additional catalog indicators.

## 3. QuantLab resources used

1. **Chart OHLCV** — technical, candle, volatility, bar-volume and volume-derived formulas. On CFD symbols, broker volume can be tick-volume; do not treat it as central-exchange traded size.
2. **Historical/live cTrader BID/ASK quote ticks** — the existing historical tick request and live quote path are reused; no parallel tick collector/backend is introduced.
3. **QuantLab quote-footprint map** — price-level quote-event counts derived from quote changes. CVD, delta, imbalance, exhaustion and other quote-footprint values are explicitly proxies, not actual trade delta/volume-at-price.
4. **cTrader Level II depth quotes** — DOM, DOM Power and Order Book Alerts use current broker-provided bid/ask depth snapshots and quote-entry changes. These are not exchange MBO orders and do not provide executed trade history.
5. **Chart/server timestamps** — Daily/Weekly/Monthly grouping, Open Line, Initial Balance and Pivot periods use available chart timestamps and configurable start time. There is no exchange holiday/rollover calendar in the current connector.

Quote ticks are loaded only when an active indicator/mode needs them. Missing quote/depth data remains unavailable; the indicator layer does not fabricate zero values or historical DOM snapshots.

## 4. Removed indicators

The 37 removed entries are listed individually in `REMOVED_INDICATORS_VI.md`. Main unavailable capabilities are:

- Cumulative executed trades, real trade size/count and verified aggressor side (`Active Volume`, `Volume Per Trade`, `Multi Market Powers`, trade-sequence indicators).
- Genuine open interest (`Open Interest`, `OI Analyzer`, `On Balance OI`, `Herrick Payoff`).
- Exchange MBO / order-by-order feed and its specialist renderer (`MBO DOM`); `DOM Strength` also requires cumulative trades.
- Market breadth, external volatility data, account/portfolio state, exchange-specific rollover/session calendars, or ATAS-only drawing/overlay renderers.
- `HRanges` uses ATAS actual volume-at-price; the QuantLab quote-event profile is not an equivalent replacement.
- Fair Value Gap and Order Block remain available through QuantLab ICT 2022, not as duplicate ATAS entries.

## 5. Final checks

- `bash tests/run-all.sh`: **33/33 test files passed**.
- JavaScript and MJS syntax: checked separately across the complete source tree.
- Catalog source class/add key/module uniqueness and metadata parity: checked across all 217 rows.
- HTML script order and Service Worker precache: checked for all individual modules and compatibility files.
- Service Worker cache version: `ict-quantlab-shell-v53`.
- Node `server/` and Worker `worker/` directories are unchanged from the supplied base source.
- Share bundle contains `server/quick-options-token.txt.example` only; the private token file is not included.

These are automated syntax, unit, fixture and static-wiring checks. They do not constitute live browser validation against the user's broker account, nor prove 1:1 output parity for the 100 `approx_proxy` items.

## 6. Deployment

This audit changes frontend indicator modules, catalog/UI metadata, tests and documentation. Publish the static frontend files and perform a hard refresh/reopen the PWA so cache `v53` is used. No Node, Worker, Tunnel, DNS or port change is required; do not overwrite the real token on the Windows machine with the `.example` file.
