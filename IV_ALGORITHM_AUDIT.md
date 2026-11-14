# QuantLab IV Algorithm Audit

Audit target: current IV Surface / Volatility Skew / Expected Move code in `js/stock-options-volatility.js` and its quote-normalization, GEX/BSM expiry-time integration in `js/stock-options.js`.

## Findings fixed in this update

1. **ATM interpolation no longer falls back to a distant one-sided quote.** ATM IV is interpolated at the dividend/rate-adjusted Forward F = S·exp((r−q)T), not raw Spot. Each side must have observations bracketing Forward within the configured log-moneyness width. A single-sided estimate can be disclosed, but no distant one-sided wing is relabelled ATM.
2. **25Δ and 10Δ use interpolation, not nearest-contract substitution.** Call and Put deltas are normalized to signed decimal units, then IV and strike are interpolated between observed absolute-delta points. There is no extrapolation; sparse brackets return unavailable.
3. **Very low IV is no longer rejected by an arbitrary 1% floor.** The BSM inversion accepts valid sub-1% volatility but rejects a result pinned to the numerical lower bound, where the quote has insufficient extrinsic value to identify IV.
4. **Provider IV normalization skips zero/negative placeholders.** A zero in an outer quote object no longer masks a valid nested `markIV` or bid/ask IV.
5. **Partial quote merges preserve IV provenance.** `providerIVSource`, `bidIV`, and `askIV` are retained along with the last valid IV, so a partial refresh does not relabel a previous bid/ask average as mark IV.
6. **Mid-derived IV respects the two-sided book.** If provider Mid lies outside a valid Bid/Ask, the algorithm uses the contemporaneous bid/ask midpoint rather than inverting the contradictory Mid.
7. **GEX / Gamma Flip BSM DTE is synchronized with IV DTE.** GLD and QQQ use the 16:15 ET late-close assumption; standard symbols use 16:00 ET. DST is resolved through `America/New_York`.
8. **Term Structure is stricter.** Only expiries with a two-sided, bracketed ATM IV are connected into the term-structure line. A single-sided estimate can still appear in the selected-expiry KPI with a visible single-side label.
9. **Clean/Raw Skew visual consistency.** Both modes use the same Y-axis range; Clean markers use Clean observations; missing observations remain gaps. Headline KPIs stay Raw and the UI discloses this, so smoothing cannot rewrite the source metrics.

## Formula review

- `RR25 = IV(25Δ Call) − IV(25Δ Put)`: correct under the common equity/FX-style Call-minus-Put convention. Positive means the Call wing is richer.
- `BF25 = (IV(25Δ Call) + IV(25Δ Put))/2 − ATM IV`: correct common 25-delta smile/butterfly measure.
- `Put Skew = IV(25Δ Put) − ATM IV`; `Call Skew = IV(25Δ Call) − ATM IV`: sign conventions are explicit and internally consistent.
- `Expected Move (1σ) ≈ Spot × ATM IV × sqrt(T)`: valid first-order symmetric approximation. It is not a forecast or a probability guarantee; lognormal bounds would be a separate presentation choice.
- BSM `d1`, Delta, option price inversion, Gamma, Vanna and Charm use the documented `r=0%` fallback and symbol-specific continuous dividend yield. Vanna and Charm formulas were cross-checked against central finite differences for both Call and Put.

## Remaining limitations (not silently guessed)

- **BSM rate/dividend inputs:** model-derived IV/Delta/Gamma/Vanna/Charm now use `r=0%` as an explicit fallback and the user-supplied continuous dividend yields `q=0.45%` for QQQ, `q=0%` for GLD. Provider IV/Delta/Gamma are still preferred where present. A live risk-free curve should only be added from a traceable source.
- **Per-contract quote freshness:** the current quote payload path does not feed a reliable per-contract update timestamp into the IV quality filter. Clean mode can screen book width, crossed/zero bid, volume and OI, but cannot prove every retained option quote is fresh.
- **Provider unit inference:** `ivSigma` accepts decimal or percent-style provider IV using a magnitude heuristic (`>3` is divided by 100; otherwise treated as decimal). This works for ordinary ETF IV observations, but a percent-style provider value around 1–3 is ambiguous without an explicit field-unit contract. The same general caution applies to very small percent-style Delta values. Confirm Binance stock-option field units before making this source-specific normalization stricter.
- **Early closes/holidays:** current time-to-expiry uses regular 16:00/16:15 ET schedules, not an exchange holiday/early-close calendar. Binance's own contract UI/in-app deadline remains authoritative for a specific contract.
- **No arbitrage-free fit:** the current display is an observed/interpolated smile snapshot, not an SVI/SABR-calibrated surface. It does not enforce calendar or butterfly no-arbitrage constraints. This is deliberate; fitting a model to sparse/noisy quotes could create false precision.
- **Clean filter thresholds:** quote-quality thresholds are heuristics, not an exchange standard. Always compare Clean and Raw, especially on low-liquidity wings.

## Suggested future work (priority order)

1. **Quote freshness and quality diagnostics** once Binance exposes a trustworthy per-contract quote timestamp: show age, spread %, OI, volume, source (mark / bid-ask IV / mid-derived), and the reason for Clean exclusion.
2. **Historical IV Rank / IV Percentile** only after storing a consistent daily IV snapshot history. A single live snapshot cannot calculate a valid percentile.
3. **Live risk-free curve** only when a reliable rate source is available. The current model uses Forward ATM with the supplied QQQ/GLD dividend yields but still assumes `r=0%`.
4. **Per-contract quote freshness** only when Binance exposes a trustworthy timestamp for each option quote.
5. **Risk-neutral distribution / probability bands** only after the smile is sufficiently dense and arbitrage checks are implemented. It is not recommended as the next feature yet.

## Verification

- IV analytics and surface tests: passed, including Vanna/Charm exposure scaling, partial-chain handling, Forward ATM and discounted BSM lower bounds.
- Option quote normalization/data tests: 52 passed.
- Volatility chart renderer tests: 7 passed.
- PWA service-worker/cache tests: 8 passed after the cache-version bump.
- Full repository suite: 22 test files passed; two unrelated legacy files still fail: `stock-options-resilience.test.js` has assertions for the retired Worker WebSocket relay as the primary Spot path, while the current supported path is Node.js through Named Tunnel; `workspace-pruned-ui.test.js` expects `js/paper-trading.js` to be removed, but that file remains. Neither failure is caused by the IV/Surface changes.


## Follow-up surface implementation (2026-11-14)

- Added multi-expiry IV, Exposure (GEX/DEX/Vega/Theta/Vanna/Charm), Volume and OI surfaces on expiry × spot-relative moneyness buckets. These are bucketed snapshot heatmaps, not a continuous fitted or arbitrage-free surface.
- Vanna exposure = BSM `dDelta/dsigma × OI × multiplier × Spot × 0.01`, USD delta-notional per +1 IV point.
- Charm exposure = BSM `dDelta/dcalendar-time × OI × multiplier × Spot / 365.25`, USD delta-notional per calendar day. Put/Call values are not dealer-position signed; OI alone does not reveal holder direction.
- Applied `q=0.45%` to QQQ and `q=0%` to GLD for model-derived calculations; `r=0%` remains an explicit fallback.
- Provider Delta is normalized from either decimal or percentage units before DEX; model Delta fallback uses the same symbol carry.
- Missing Volume/OI remain unknown in the corresponding surface cells instead of being silently represented as zero. Partial expiry coverage is exposed in each row.
- IV/Surface modules are loaded before `stock-options.js` and included in the service-worker precache; cache version bumped to v31.


## Model scope and interpretation

- The stock-option product supports early exercise for long option holders. The IV inversion and model-derived Delta/Gamma/Vanna/Charm in this dashboard use European Black–Scholes–Merton as a practical approximation, not a full American-option model. The approximation can be more material for deep-ITM options, near ex-dividend dates, and contracts with early-exercise value. Provider IV/Greeks are preferred when available; BSM-derived values are explicitly model-derived.
- `r=0%` is a fallback assumption, not a live market rate. User-supplied continuous yields are `q=0.45%` for QQQ and `q=0%` for GLD. Forward ATM uses `F=S·exp((r−q)T)`. Expected Move is still displayed as the conventional first-order `Spot × ATM IV × √T` approximation and should not be read as a directional forecast.
- Exposure surfaces use OI as a contract-count weight. OI does not reveal whether customers/dealers are long or short. GEX applies the common Call-positive / Put-negative convention; it is a scenario convention, not observed dealer positioning. DEX, Vega, Theta, Vanna and Charm are aggregated from signed Greeks × OI × multiplier using the displayed conventions.
- Vanna is `∂Delta/∂σ` per 1.00 decimal volatility, then multiplied by `0.01` for a +1 volatility-point exposure. Charm is `∂Delta/∂calendar-time` per year, then divided by 365.25 for per-calendar-day exposure. Both are model-based. Finite-difference checks against the BSM Delta function pass for Calls and Puts.
- Provider Vega and Theta are summed in their feed-provided units × OI × multiplier. The current payload does not expose a definitive units metadata contract for these Greeks; do not compare their absolute magnitude to a different vendor without confirming whether Vega is per 1.00 volatility or per 1 vol point, and whether Theta is per calendar or trading day.
- IV surface uses median valid IV within each listed-expiry × spot-relative-moneyness bucket. Exposure surfaces sum their defined per-contract contributions in the same buckets. Default moneyness bucket centers are −20%, −15%, −10%, −5%, ATM, +5%, +10%, +15%, +20%, with a ±2.5 percentage-point nearest-center window. Volume is the provider-reported contract-volume field, not trade direction or a time-and-sales tape. OI is outstanding contract count.
- Only loaded expiries appear. Partial chains are visibly marked and are excluded from Constant Maturity interpolation/Term Structure, which require complete chains and two-sided Forward ATM. An empty cell means unavailable/not valid, not zero.
- Constant Maturity IV uses linear interpolation of total variance `W(T)=IV(T)^2·T` between two complete expiry points bracketing a target tenor; it does not extrapolate and rejects overly wide expiry brackets. The resulting tenor (7D/14D/30D/60D) is synthetic/interpolated, not a listed contract.
- Clean/Raw affects the displayed volatility-skew curve only. Headline ATM/RR/BF/Expected Move remain based on raw valid IV. Clean's spread/liquidity thresholds are heuristics and no per-contract quote timestamp is available to prove freshness.


## External product-rule check

The official Binance Stock Options terms describe the contracts as American options, exercisable before the specified customer cutoff. That means the European BSM model used for mid-derived IV and fallback Greeks is an approximation, not an exact American-option valuation. This caveat is most relevant for deep-ITM options and around dividend/exercise decisions. Nasdaq lists GLD and QQQ among ETF options with a regular 16:15 ET late close; actual holiday and early-close cutoffs still need contract-specific confirmation.

Sources checked on 2026-11-14:
- Binance Stock Options Product Terms: https://bin.bnbstatic.com/static/cms/cg08ou2ak0tn7mcplvfg/file/622b399cd2353f34a5a0eeccf69e0815062d4e6660b830b9c72f3fb972d81bbf.pdf
- Binance Stock Options FAQ: https://www.binance.com/en-IA/support/faq/detail/3dddc209bb564b448c0948fc4c5e6d80
- Nasdaq Options Market Hours: https://www.nasdaqtrader.com/Trader.aspx?force_isolation=true&id=optionshours
