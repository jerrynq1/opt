/* Gexadecimal Trade Structure Analyzer — pure expiration-payoff engine.
   It deliberately does not infer BUY/SELL from cumulative option Volume.
   A leg direction is an explicit scenario assumption or user override. */
(function (root) {
  'use strict';

  const finite = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
  const number = (value, fallback = null) => finite(value) ? Number(value) : fallback;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function normalizeLeg(input) {
    if (!input || typeof input !== 'object') return null;
    const type = String(input.type || input.optionType || '').toUpperCase().startsWith('C') ? 'C' :
      String(input.type || input.optionType || '').toUpperCase().startsWith('P') ? 'P' : null;
    const strike = number(input.strike), premium = number(input.premium), quantity = number(input.quantity, 1);
    const multiplier = number(input.multiplier, 100);
    const side = String(input.side || 'buy').toLowerCase() === 'sell' ? 'sell' : 'buy';
    if (!type || !(strike > 0) || premium === null || !(premium >= 0) || !(quantity > 0) || !(multiplier > 0)) return null;
    return { ...input, type, strike, premium, quantity, multiplier, side };
  }

  function intrinsicValue(type, underlying, strike) {
    return type === 'C' ? Math.max(0, underlying - strike) : Math.max(0, strike - underlying);
  }

  function payoffAt(legs, underlying) {
    const price = number(underlying);
    if (!(price >= 0) || !Array.isArray(legs) || !legs.length) return null;
    let total = 0;
    for (const raw of legs) {
      const leg = normalizeLeg(raw);
      if (!leg) return null;
      const sign = leg.side === 'buy' ? 1 : -1;
      total += sign * (intrinsicValue(leg.type, price, leg.strike) - leg.premium) * leg.quantity * leg.multiplier;
    }
    return total;
  }

  function uniqueSorted(values) {
    return [...new Set(values.filter(Number.isFinite).map(value => Math.max(0, value).toFixed(8)))].map(Number).sort((a, b) => a - b);
  }

  function breakevenPoints(legs, knots) {
    const points = [];
    const add = value => {
      if (Number.isFinite(value) && value >= 0 && !points.some(old => Math.abs(old - value) < 1e-6)) points.push(value);
    };
    const values = knots.map(price => ({ price, pnl: payoffAt(legs, price) }));
    for (const point of values) if (Math.abs(point.pnl) < 1e-8) add(point.price);
    for (let i = 0; i < values.length - 1; i++) {
      const a = values[i], b = values[i + 1];
      if (a.pnl * b.pnl < 0) add(a.price + (0 - a.pnl) * (b.price - a.price) / (b.pnl - a.pnl));
    }
    return points.sort((a, b) => a - b);
  }

  function analyzePayoff(rawLegs, { sampleCount = 121, underlyingSpot = null } = {}) {
    const legs = (Array.isArray(rawLegs) ? rawLegs : []).map(normalizeLeg);
    if (!legs.length || legs.some(leg => !leg)) return { ok: false, error: 'Cần ít nhất một leg hợp lệ, có strike, premium, quantity và multiplier.' };

    const strikes = uniqueSorted(legs.map(leg => leg.strike));
    const maxStrike = strikes[strikes.length - 1];
    const maxPrice = Math.max(maxStrike * 3, number(underlyingSpot, 0) * 2.5, maxStrike + 100, 100);
    const knots = uniqueSorted([0, ...strikes, maxPrice]);
    const values = knots.map(price => ({ price, pnl: payoffAt(legs, price) }));
    const callSlope = legs.reduce((sum, leg) => sum + (leg.type === 'C' ? (leg.side === 'buy' ? 1 : -1) * leg.quantity * leg.multiplier : 0), 0);
    const hasUnlimitedProfit = callSlope > 1e-8;
    const hasUnlimitedLoss = callSlope < -1e-8;
    const finiteValues = values.map(point => point.pnl).filter(Number.isFinite);
    const maxFinite = Math.max(...finiteValues), minFinite = Math.min(...finiteValues);
    const maxProfit = hasUnlimitedProfit ? null : maxFinite;
    const maxLoss = hasUnlimitedLoss ? null : Math.max(0, -minFinite);
    const be = breakevenPoints(legs, knots);
    const steps = clamp(Math.round(sampleCount), 41, 401);
    const samples = [];
    for (let i = 0; i < steps; i++) {
      const price = maxPrice * i / (steps - 1);
      samples.push({ underlying: price, pnl: payoffAt(legs, price) });
    }
    // Include strike kinks and exact break-even points in the curve for clean joins.
    for (const price of uniqueSorted([...strikes, ...be])) samples.push({ underlying: price, pnl: payoffAt(legs, price) });
    samples.sort((a, b) => a.underlying - b.underlying);

    const netDebit = legs.reduce((sum, leg) => sum + (leg.side === 'buy' ? 1 : -1) * leg.premium * leg.quantity * leg.multiplier, 0);
    return {
      ok: true,
      legs,
      breakevens: be,
      maxProfit,
      maxLoss,
      unlimitedProfit: hasUnlimitedProfit,
      unlimitedLoss: hasUnlimitedLoss,
      maxProfitFinite: maxFinite,
      minPnlFinite: minFinite,
      netDebit,
      maxUnderlying: maxPrice,
      callSlope,
      samples
    };
  }

  function formatMoney(value, currency = 'USD') {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return 'Unlimited';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value));
  }

  root.tradeStructureAnalyzer = Object.freeze({
    normalizeLeg,
    intrinsicValue,
    payoffAt,
    analyzePayoff,
    formatMoney
  });
})(window);
