# QuantLab IV / Volatility / Exposure Surface Audit

Audit scope: `js/stock-options-volatility.js`, `js/stock-options-surfaces.js`, their integration in `js/stock-options.js`, the IV/Skew/Surface UI, and the regression tests.

## Executive summary

The current implementation is a useful **snapshot analytics layer** for GLD and QQQ options. The main formulas for 25-delta Risk Reversal, 25-delta Butterfly, Expected Move, Black–Scholes–Merton Delta/Gamma/Vanna/Charm, and total-variance interpolation are internally consistent. The implementation has explicit limitations that should remain visible: the feed does not provide a full per-contract freshness timestamp; the model uses `r = 0%`; the user-supplied continuous dividend yields are `q = 0.45%` for QQQ and `q = 0%` for GLD; and the product's options are American-style while the fallback model is European BSM.

The most important interpretation rule is that the heatmaps are **bucketed summaries of the currently loaded chains**, not a fitted continuous volatility surface and not proof of dealer positioning.

## What is implemented

### 1. Single-expiry volatility analytics

- Provider/mark IV is preferred. Valid bid/ask IV is used according to the normalizer's documented priority; zero/negative placeholders do not mask valid nested values. The current normalizer accepts either decimal IV or percent-style IV with a magnitude heuristic (`>3` is treated as percent, otherwise decimal); unusual values around the threshold are ambiguous unless the provider field unit is explicitly documented.
- If provider IV is absent, a valid two-sided NBBO midpoint (or a standalone Mid only when no book fields exist) can be inverted through BSM. A provider Mid outside its valid bid/ask range is ignored in favor of the contemporaneous NBBO midpoint.
- A crossed, one-sided, zero-bid/zero-ask book is not used for mid-derived IV.
- BSM inversion uses discounted European lower bounds: Call `max(S·e^(−qT) − K·e^(−rT), 0)` and Put `max(K·e^(−rT) − S·e^(−qT), 0)`. It does not compare against undiscounted `S−K` / `K−S` when carry is non-zero.
- The solver accepts valid sub-1% IV but rejects a value pinned to the numerical lower bound where the premium does not identify volatility reliably.
- ATM is calculated at the **Forward** `F = S·e^((r−q)T)`. Call IV and Put IV are interpolated separately in log-moneyness around `ln(K/F) = 0`; the bracket must be local and two-sided. A distant one-sided wing is not silently labelled ATM. If only one side is available, it is disclosed as one-sided and is excluded from the two-sided Term Structure / Constant Maturity points.
- Provider Delta is normalized to signed decimal Delta. If absent, BSM Delta is derived with the same rate/dividend assumptions. 10Δ and 25Δ IVs are interpolated between observed absolute-Delta points; no extrapolation is performed, and sparse brackets return unavailable.
- `RR25 = IV(25Δ Call) − IV(25Δ Put)`. Positive means Call-wing IV is richer.
- `BF25 = [IV(25Δ Call) + IV(25Δ Put)] / 2 − ATM IV`.
- Put/Call Skew = corresponding 25Δ wing IV minus ATM IV.
- Expected Move `≈ Spot × ATM IV × √T` is a conventional first-order 1σ width approximation. It is not a forecast, and it does not imply a directional bias or guarantee a realized range.
- Clean/Raw affects the displayed Skew curve only. Headline ATM/RR/BF/Expected Move values remain based on raw valid observations; Clean is a quote-quality display heuristic, not a replacement dataset.

### 2. Constant Maturity IV

- Tenors currently shown: 7D, 14D, 30D and 60D.
- For an observed point near a target tenor, the observed ATM IV can be used directly.
- Otherwise, the target is interpolated between two complete expiries that bracket the tenor. No extrapolation is performed and overly wide brackets are rejected.
- Interpolation is linear in total variance: `W(T) = IV(T)^2 × T`, then `IV(target) = sqrt(W(target) / T_target)`.
- Only expiries with complete chain coverage and two-sided, bracketed Forward ATM IV are eligible. Partial chains can still be inspected in their selected-expiry view but do not feed the Constant Maturity curve.
- A Constant Maturity value is synthetic/interpolated; it is not an actual listed contract or an executable quote.

### 3. IV Surface

- Grid rows: loaded expiries in the selected Analysis Scope.
- Grid columns: spot-relative strike moneyness `100 × (K/Spot − 1)`.
- Default bucket centers: −20%, −15%, −10%, −5%, 0%, +5%, +10%, +15%, +20%; a contract is assigned to its nearest center only within approximately ±2.5 percentage points.
- Cell value: median of valid IV observations in that expiry/moneyness bucket. Provider IV is preferred; Mid-derived BSM IV is a labeled fallback.
- This is a bucketed observed snapshot. It is not an SVI/SABR fit and does not enforce calendar-spread or butterfly no-arbitrage constraints.

### 4. Exposure Surface

Exposure rows are expiry; columns are the same spot-relative moneyness buckets. The side selector can display Calls, Puts or both.

| Metric | Per-contract contribution summed in a cell | Important convention |
|---|---|---|
| GEX | `Gamma × OI × multiplier × Spot² × 0.01` | Calls positive, Puts negative by convention; not observed dealer inventory |
| DEX | `signed Delta × OI × multiplier × Spot` | Uses provider signed Delta when present, otherwise BSM Delta fallback |
| Vega | `provider Vega × OI × multiplier` | Provider's unit convention; feed has no explicit Greek-unit metadata |
| Theta | `provider Theta × OI × multiplier` | Provider's unit convention; feed has no explicit Greek-unit metadata |
| Vanna | `BSM ∂Delta/∂σ × OI × multiplier × Spot × 0.01` | USD delta-notional change per +1 volatility point |
| Charm | `BSM ∂Delta/∂calendar-time × OI × multiplier × Spot / 365.25` | USD delta-notional change per calendar day |

Vanna formula: `−e^(−qT) · φ(d1) · d2 / σ`, which is `∂Delta/∂σ` where σ is decimal volatility (1.00 = 100 vol points). The surface multiplies by 0.01 to show a +1 vol-point sensitivity.

Charm is the derivative of Delta with respect to **calendar time advancing** (equivalently, remaining time to expiry decreases). It is calculated per year and divided by 365.25 for the per-calendar-day surface unit. Central finite-difference tests against the same BSM Delta function pass for Calls and Puts with non-zero rate and dividend yield.

The exposure values are OI-weighted sensitivities, not a measured portfolio. Open Interest does not disclose whether holders are long or short, and it does not disclose dealer inventory. GEX applies a common Call-positive / Put-negative sign convention; that convention must not be described as an observed dealer-position sign. Vanna and Charm are not forcibly assigned Call+/Put− signs; their signs come from the model derivatives.

### 5. Volume and OI surfaces

- Volume cell: sum of the provider-reported contract-volume field in the bucket. It is not signed flow, not buyer-initiated/seller-initiated flow, and not a time-and-sales tape. The feed does not currently document a reliable interval definition for the field, so interpret it as provider-reported volume only.
- OI cell: sum of reported outstanding contracts. OI is an unsigned count and does not indicate long/short side or dealer ownership.
- Missing Volume/OI is left unknown on the relevant surface; it is not silently converted to zero.

### 6. Contract multiplier and incomplete data

- An explicit contract multiplier from the feed is preferred.
- A ×100 fallback is permitted only for standard GLD/QQQ OCC roots. Adjusted roots do not receive that fallback.
- Expiry rows carry loaded/expected counts and a completeness status. Partial rows are visibly identified. They should not be interpreted as a full chain.
- Empty cells represent unavailable/invalid observations, not zero values.

## Model assumptions and product-specific caveats

1. The user supplied `q = 0.45%` continuously compounded annual dividend yield for QQQ and `q = 0%` for GLD. The code uses `r = 0%` as an explicit fallback because no traceable live risk-free curve is connected.
2. Forward ATM is `F = S·e^((r−q)T)`. The Expected Move display remains the conventional first-order `S·IV·√T` width approximation.
3. Time to expiry uses calendar time / 365.25 and New York local time. GLD and QQQ use 16:15 ET; other symbols use 16:00 ET. This is a regular-session assumption, not a full holiday/early-close calendar. Verify the actual contract cutoff in the Binance UI.
4. Binance's Stock Options product terms describe the contracts as American options, with exercise possible before the specified cutoff. European BSM therefore remains an approximation for IV inversion and model-derived Delta/Gamma/Vanna/Charm; it can be most material for deep-ITM contracts and around dividend/exercise decisions. Provider IV/Greeks are preferred when available. A binomial/American-option model would be a separate improvement, not silently implied by the current values.
5. The current feed path does not provide a trustworthy per-contract update timestamp to the Clean filter. A quote can be screened for crossed/zero/wide book and displayed liquidity fields, but Clean cannot prove that every retained quote is fresh.
6. Provider IV normalization currently uses a magnitude heuristic (`>3` is divided by 100; otherwise treated as decimal). This is suitable for ordinary ETF IV levels but ambiguous for unusual percent-style values around 1–3. Confirm the equity-options feed unit contract before changing the heuristic. The same caution applies to very small percent-style Delta values.
7. Provider Vega and Theta unit metadata is not present in the payload normalization. Their values are multiplied by OI and multiplier in provider units. Before cross-vendor comparison or interpretation as USD per 1% IV / per calendar day, confirm the source contract's Greek-unit definitions.
8. The surfaces are not risk-neutral densities, probability distributions, or arbitrage-free fitted surfaces. Do not infer probabilities from the color map.

## Audit findings / next priorities

### Addressed in this code

- ATM is Forward-based and requires a local two-sided bracket.
- 10Δ/25Δ are interpolated between Delta observations and never extrapolated.
- IV source normalization skips zero placeholders and keeps provenance through partial updates.
- BSM IV inversion uses carry-discounted bounds and validates side inputs.
- Valid low IV is not rejected by an arbitrary 1% floor; solver-bound values remain rejected.
- Provider Mid outside NBBO is not used for IV inversion.
- Constant Maturity requires complete, two-sided Forward ATM expiry points and uses total variance.
- GEX and IV expiry DTE share the symbol-specific regular close assumption.
- Vanna/Charm formulas have been checked numerically by finite differences for both option sides.
- Surface metric calculation avoids unnecessary BSM IV inversions for Volume/OI/Vega/Theta-only views.
- Explicit partial/error flags remain partial even when the reported loaded count happens to equal expected count.

### Recommended future work (only when source data is available)

1. **Provider unit metadata**: confirm exact IV/Delta/Vega/Theta units and replace magnitude heuristics with source-specific normalization if Binance documents the fields.
2. **Per-contract quote freshness**: preserve a trustworthy option-quote timestamp and display age/spread/source in Clean mode.
3. **American-option model**: consider a binomial tree or robust American approximation for model-derived Greeks and mid-derived IV, especially around dividends and deep-ITM options.
4. **Live rates and dividend schedule**: source a transparent rate curve and dated dividend assumptions rather than a flat r=0 and static q.
5. **Historical IV Rank/Percentile**: store daily snapshots with consistent time/expiry methodology before calculating a rank or percentile.
6. **Surface arbitrage diagnostics**: only after adequate quote density; check strike convexity / calendar monotonicity before considering SVI/SABR calibration.
7. **Volume interpretation**: obtain source documentation for volume interval/reset semantics before presenting it as intraday flow.

## Test results

Focused tests run after the current changes:

- `server/stock-options-volatility.test.mjs`: passed, including finite-difference Vanna/Charm checks for Calls and Puts.
- `server/stock-options-surfaces.test.mjs`: passed.
- `tests/stock-options-data.test.js`: 52/52 passed.
- `tests/stock-options-volatility-render.test.js`: 7/7 passed.
- `tests/stock-options-surfaces.test.mjs`: passed.
- `tests/pwa.test.js`: 8/8 passed.

The full repository test runner still reports 22 test files passing and 2 unrelated legacy test files failing:

- `tests/stock-options-resilience.test.js` retains assertions for the old Cloudflare Worker Spot WebSocket relay as a primary path. The active design now uses Node.js through the Named Tunnel for Spot.
- `tests/workspace-pruned-ui.test.js` expects `js/paper-trading.js` to be removed; that file remains in the source tree. This task did not modify Paper Trading.
