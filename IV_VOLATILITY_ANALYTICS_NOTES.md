# IV Surface & Volatility Analytics — Audit Notes

## Metrics and conventions

- **ATM IV**: Interpolate Call IV and Put IV separately to zero forward log-moneyness (`ln(K / Forward) = 0`, where `Forward = Spot × exp((r−q)T)`), then average both sides when both are available. The interpolation must be bracketed by strikes on either side of Forward and the bracket width is capped; a distant one-sided wing is not relabelled as ATM. If only one side is bracketed, the KPI is explicitly identified as single-sided.
- **25Δ Risk Reversal**: `IV(25Δ Call) - IV(25Δ Put)`. Positive values mean the Call 25-delta wing is richer. Delta is normalized to signed decimal units; the IV is linearly interpolated between observed deltas bracketing 25Δ, without extrapolation. Sparse brackets are rejected.
- **25Δ Butterfly**: `(IV(25Δ Call) + IV(25Δ Put)) / 2 - ATM IV`.
- **Put Skew / Call Skew**: each 25-delta wing IV minus ATM IV.
- **Expected Move (1σ approximation)**: `Spot × ATM IV × sqrt(T)`. This is a symmetric first-order approximation, not a probability forecast or a guarantee of the realized range.
- **IV Surface**: rows are listed expiries loaded in the current Analysis Scope; columns are 10Δ Put, 25Δ Put, ATM, 25Δ Call, and 10Δ Call. Wing buckets are only populated when an observed-delta bracket is available.
- **IV Term Structure**: plots only expiries with two-sided, bracketed ATM IV. Single-sided ATM estimates are not connected into the term-structure line.
- **Volatility Skew Clean/Raw**: Raw shows the provider/model IV observations. Clean filters quote-quality issues and smooths only the displayed curve; it does not rewrite the underlying Raw KPI values. The chart explicitly labels the selected mode.

## Time-to-expiry

- Time is calendar time divided by 365.25 days and runs to the assumed New York option close.
- The current implementation uses 16:15 ET for GLD and QQQ and 16:00 ET for other symbols. Nasdaq's published ETF option hours list GLD and QQQ among the 16:15 ET exceptions; Binance also cautions that its stock-option close/expiry time is product-specific and may vary. Confirm the actual expiry cutoff in the Binance contract UI, especially on early-close days and holidays.
- DST conversion uses the `America/New_York` IANA time zone. Special early-close calendars are not yet modeled.

## Data and model assumptions

1. Provider/mark IV is preferred. If absent, bid/ask IV is averaged when both sides exist; a one-sided IV is retained as a fallback but flagged as one-sided. Partial quote updates preserve the source metadata alongside the last valid IV.
2. If provider IV is absent, QuantLab can derive IV from a positive option Mid or a valid Bid/Ask midpoint by inverting Black–Scholes. Values pinned to the solver's minimum-volatility boundary are rejected rather than reported as a fabricated low IV.
3. If provider Delta is absent, the selected delta bucket is approximated with Black–Scholes Delta. Delta interpolation is performed in absolute-delta space, separately for Calls and Puts; no extrapolation is performed.
4. Model-derived IV/Delta/Gamma/Vanna/Charm use `r = 0%` as an explicit fallback and the supplied ETF dividend yields: `q = 0.45%` for QQQ and `q = 0%` for GLD. Provider IV/Greeks remain preferred when present.
5. The selected expiry feeds headline metrics. Surface/term-structure rows include only expiries already loaded in the active Analysis Scope. Use Weekly or All Expiries to load a broader curve.
6. Missing quotes/IV remain missing; they are not zero-filled for volatility calculations.
7. The Clean filter is a display-quality heuristic. It uses the available bid/ask, volume, and open-interest fields; per-contract quote timestamps are not currently used, so it cannot independently prove that every retained quote is fresh.
8. The output is a snapshot smile/term structure, not an arbitrage-free calibrated volatility surface. It does not enforce calendar/butterfly no-arbitrage constraints or estimate a risk-neutral density.
9. Provider IV normalization currently uses a magnitude heuristic to accept decimal or percent-style values (`>3` is divided by 100, otherwise treated as decimal). This is adequate for ordinary ETF IV values but ambiguous for unusual percent-style values around 1–3; confirm the exact stock-option feed units before replacing the heuristic. Provider Vega/Theta units also lack explicit metadata in the normalized payload.

## Audit findings and remaining improvements

- Fixed: ATM no longer falls back to a far one-sided quote; it requires a local bracket around Forward.
- Fixed: 25Δ/10Δ metrics interpolate between observed delta points and do not reuse a distant nearest contract.
- Fixed: the IV solver accepts valid sub-1% volatility and rejects solutions pinned to its lower bound.
- Fixed: IV provenance and bid/ask IV fields survive partial quote merges.
- Fixed: GEX/Zero Gamma BSM fallback uses the same symbol-specific expiry close as the IV module.
- Fixed: Clean and Raw Skew share the same Y-axis; Clean markers use Clean observations; Term Structure requires two-sided ATM.
- Remaining: feed timestamps/freshness at the individual option-quote level, a live interest-rate/dividend-yield curve for the BSM fallback, and an exchange/Binance-specific early-close calendar. These should be added only if the upstream feed exposes reliable fields/sources.


## Multi-expiry surfaces and higher-order Greeks

The surface engine aggregates each loaded expiry across spot-relative moneyness buckets. It provides IV, GEX, DEX, provider Vega/Theta, model Vanna/Charm, Volume and OI. Vanna/Charm use Black–Scholes with QQQ q=0.45%, GLD q=0%, r=0% assumption. Vanna is reported per +1 volatility point; Charm per calendar day. Neither is dealer-position signed because OI does not reveal who is long or short. Missing Volume/OI is left unknown on its own surface; partial chain rows remain flagged.


## Surface metric definitions and limitations

- Grid: expiry rows × spot-relative strike buckets (`100 × (K/Spot − 1)`). Default centers are −20, −15, −10, −5, 0, +5, +10, +15 and +20 percent; a contract is assigned to its nearest center only within approximately ±2.5 percentage points.
- IV cell: median of valid contract IVs in the bucket (provider IV preferred; BSM mid-derived fallback when a valid two-sided/standalone Mid is available).
- GEX cell: `Σ[Gamma × OI × multiplier × Spot² × 0.01 × sideSign]`, where Calls use +1 and Puts −1. This is a convention, not verified dealer positioning.
- DEX cell: `Σ[Delta × OI × multiplier × Spot]`, with the option's signed Delta.
- Vega/Theta cells: `Σ[provider Greek × OI × multiplier]`. The feed does not currently supply unit metadata, so retain the provider's unit convention and do not compare cross-vendor values without confirming it.
- Vanna cell: `Σ[BSM ∂Delta/∂σ × OI × multiplier × Spot × 0.01]`, per +1 volatility point.
- Charm cell: `Σ[BSM ∂Delta/∂calendar-time × OI × multiplier × Spot / 365.25]`, per calendar day.
- Volume/OI cells: sum provider-reported contract Volume or Open Interest; missing values remain unavailable. Volume is not signed flow and is not a time-and-sales tape. OI does not identify the long/short holder.
- Partial chain coverage is marked on each expiry row. Do not interpret a partial row as a complete cross-section.
- The product permits early exercise. European BSM is therefore an approximation for model-derived IV/Greeks, especially for deep-ITM or dividend-sensitive contracts. A full American-option model would be a separate upgrade. Provider Greeks should be preferred where available.
- `r=0%` is an explicit fallback; `q=0.45%` QQQ and `q=0%` GLD are the user-provided assumptions. A sourced live rate/dividend curve and an early-close/holiday calendar are not currently connected.
