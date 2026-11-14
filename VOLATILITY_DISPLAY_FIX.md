# QuantLab — B. Volatility display fix

Date: 2026-11-14

## Root cause

The consolidated full-source package used a later `css/stock-options.css` from the IV Surface/Vanna-Charm patch. That stylesheet contained the newer `.so-surface-*` and signed-exposure rules but had accidentally omitted the earlier `.so-vol-*` styles required by the B. Volatility markup. The section HTML and render functions were still present, so the visual layer fell back to mostly unstyled HTML.

The earlier CSS patches also did not provide dedicated layout rules for `.so-vol-cm-wrap`, `.so-vol-cm-grid`, and `.so-vol-cm-item` (Constant Maturity IV cards).

## Fix applied

- Restored the IV Analytics panel styles (`.so-vol-card`, KPI cards, panels, wings, expected move, IV table, Term Structure and empty states).
- Restored Volatility Skew chart styles: SVG sizing, Call/Put lines, Spot reference, markers, Clean/Raw controls, X-axis zoom controls, legend and mobile layout.
- Added responsive Constant Maturity IV card styles, including unavailable states.
- Preserved the latest Multi-Expiry Surface and Exposure styles from the full-source package.
- Bumped the PWA shell cache version from `v31` to `v32`, ensuring clients do not keep the previous broken CSS from the service-worker cache.
- Added `tests/stock-options-volatility-styles.test.js`, which verifies all B. Volatility classes rendered by the UI have CSS rules and that the responsive Constant Maturity styles are present.

## Files changed

- `css/stock-options.css`
- `sw.js`
- `tests/pwa.test.js` (expected cache version)
- `tests/stock-options-volatility-styles.test.js` (new regression test)
- `TEST_RESULTS_FULL_SOURCE.txt`

## Verification

- PWA/browser test runner: 25 test files passed, 0 failed.
- Node-side regression suites: 4 passed.
- CSS parser: 201 top-level rules, 0 parse errors.
- B. Volatility stylesheet coverage: all 48 required selectors present.
- JavaScript syntax checks: `stock-options.js`, `stock-options-volatility.js`, and `stock-options-surfaces.js` passed.

No Node, Worker, Task Scheduler or Cloudflare Tunnel configuration changes are required for this display-only fix.
