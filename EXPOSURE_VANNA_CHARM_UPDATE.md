# QuantLab Main Exposure: Vanna / Charm update

This update targets the main Options Exposure ladder/panel (the horizontal signed exposure bars and key-level summary), not the 3D Exposure Surface.

## What changed

- Fixed signed Vanna/Charm bars: the CSS now applies the renderer's `--signed-width` variable, so positive/negative bars are visible.
- Improved signed-bar geometry and legibility: centered zero line, clearer positive/negative colors, wider value labels, responsive layout.
- Renamed Vanna/Charm labels to `OI-weighted model sensitivity` instead of implying verified dealer net positioning.
- Added per-metric model coverage (`known / required`, percent coverage) and retained missing-multiplier diagnostics.
- Added call and put contribution details to tooltips and clearer methodology notes.
- Avoids showing a fabricated zero when Vanna/Charm cannot be estimated from valid inputs.
- Key-level markers are adapted for signed Vanna/Charm so Gamma walls are not mislabeled as Vanna/Charm walls.

## Calculation conventions

For a contract with positive OI and valid model inputs:

- Vanna exposure = `dDelta/dSigma * OI * multiplier * Spot * 0.01`, where `dDelta/dSigma` is per unit decimal volatility and `0.01` converts to a one-volatility-point move.
- Charm exposure = `dDelta/dCalendarTime * OI * multiplier * Spot / 365.25`, with Charm defined as the change in Delta as calendar time advances (remaining time to expiry decreases).
- The BSM model uses continuous dividend yield `q=0.0045` for QQQ and `q=0` for GLD. Risk-free rate remains the configured model assumption (`r=0` fallback unless configured otherwise).
- Calls and puts are shown as model sensitivities weighted by OI. Open interest does not reveal whether holders are long or short; therefore these values are not verified dealer positioning and must not be interpreted as dealer net Vanna/Charm.
- American-style early exercise and discrete dividends are not fully modeled by European Black-Scholes. These remain model approximations, particularly for deep ITM contracts and around ex-dividend dates.

## Install

1. Back up the current files.
2. Merge the patch `opt-main` folder into the deployed project, preserving folder paths.
3. Publish the website.
4. Hard-refresh (`Ctrl+Shift+R`) or close/reopen the PWA so Service Worker cache `v41` activates.
5. No Node.js, Worker, Task Scheduler or Cloudflare Tunnel restart is required.

The full-source archive intentionally does not include private `quick-options-token.txt` credentials. Keep the existing token file on the home server.
