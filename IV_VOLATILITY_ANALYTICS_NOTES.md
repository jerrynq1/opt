# IV Surface & Volatility Analytics

This update adds an IV analytics panel to both GLD and QQQ Stock Options views.

## Metrics

- **ATM IV**: interpolate Call IV and Put IV separately to zero log-moneyness (`ln(strike / spot) = 0`), then average the two sides when both are present.
- **25Δ Risk Reversal**: `IV(25Δ Call) - IV(25Δ Put)`. Positive values indicate the Call 25-delta wing is richer; negative values indicate the Put wing is richer.
- **25Δ Butterfly**: `(IV(25Δ Call) + IV(25Δ Put)) / 2 - ATM IV`.
- **Put Skew / Call Skew**: each 25-delta wing IV minus ATM IV.
- **Expected Move (1σ)**: `Spot × ATM IV × sqrt(T)`, with T measured to the listed expiry at 16:00 New York time using a 365.25-day year. The displayed range is a model approximation, not a forecast.
- **IV Surface**: rows are listed expiries loaded in the current Analysis Scope; columns are 10Δ Put, 25Δ Put, ATM, 25Δ Call, and 10Δ Call.
- **IV Term Structure**: ATM IV against DTE for expiries loaded in the current Analysis Scope.

## Data and assumptions

1. Provider IV is preferred (`normaliseQuote()`'s normalized `iv` field).
2. If provider IV is absent, QuantLab can derive IV from a positive option Mid (or a valid Bid/Ask midpoint) by inverting Black–Scholes. Derived values are counted and labelled separately.
3. If provider Delta is absent, the selected delta bucket is approximated with Black–Scholes Delta.
4. Model-derived IV and Delta use `r = 0` and `q = 0`. This is a fallback approximation, not an exchange-published Greek.
5. The selected expiry feeds the headline metrics. Surface/term-structure rows include expiries already loaded in the active Analysis Scope. Use Weekly or All Expiries to load a broader curve; this intentionally reuses the existing scope loader rather than triggering a second independent all-expiry download.
6. Missing quotes/IV remain missing. They are not zero-filled for volatility calculations.
7. The result is a snapshot smile/term structure, not an arbitrage-free calibrated volatility surface. Its quality depends on quote freshness, liquidity, provider IV quality, and expiry coverage.
