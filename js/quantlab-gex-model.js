/*
 * ICT QuantLab · GEX profile presentation helpers.
 * Calculations are performed by stock-options.js from the existing in-memory
 * Binance Option Chain. This file only normalises/sorts already-calculated rows.
 */
(() => {
  'use strict';
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const metricValue = (row, metric) => {
    if (!row) return null;
    if (metric === 'gex') return finite(row.gex) ? row.gex : null;
    if (metric === 'dex') return finite(row.dex) ? row.dex : null;
    if (metric === 'vega') return finite(row.vega) ? row.vega : null;
    if (metric === 'theta') return finite(row.theta) ? row.theta : null;
    if (metric === 'vanna') return finite(row.vanna) ? row.vanna : null;
    if (metric === 'charm') return finite(row.charm) ? row.charm : null;
    if (metric === 'oi') {
      return finite(row.callOI) && finite(row.putOI) ? row.callOI + row.putOI : null;
    }
    if (metric === 'volume') {
      return finite(row.callVol) && finite(row.putVol) ? row.callVol + row.putVol : null;
    }
    return null;
  };

  function buildProfile(snapshot, metric = 'gex', limit = 48) {
    const rows = Array.isArray(snapshot?.dist) ? snapshot.dist : [];
    const spot = finite(snapshot?.price) ? snapshot.price : null;
    const clean = rows.map(row => ({ ...row, value: metricValue(row, metric) }))
      .filter(row => finite(row.strike) && row.strike > 0 && finite(row.value));
    clean.sort((a, b) => a.strike - b.strike);
    const safeLimit = Math.max(1, Math.min(120, Math.trunc(Number(limit) || 48)));
    let selected = clean;
    if (clean.length > safeLimit) {
      const anchor = spot ?? clean[Math.floor(clean.length / 2)].strike;
      selected = clean.slice().sort((a, b) => Math.abs(a.strike - anchor) - Math.abs(b.strike - anchor))
        .slice(0, safeLimit).sort((a, b) => a.strike - b.strike);
    }
    const maxAbs = selected.reduce((max, row) => Math.max(max, Math.abs(row.value)), 0);
    return selected.map(row => ({
      ...row,
      magnitude: maxAbs > 0 ? Math.abs(row.value) / maxAbs : 0,
      side: row.value > 0 ? 'positive' : row.value < 0 ? 'negative' : 'zero'
    }));
  }

  function topGexWalls(snapshot, side = 'call', limit = 3) {
    if (!snapshot?.gexComplete) return [];
    const field = side === 'put' ? 'putGex' : 'callGex';
    return (Array.isArray(snapshot.dist) ? snapshot.dist : [])
      .filter(row => finite(row?.strike) && row.strike > 0 && finite(row?.[field]) && Math.abs(row[field]) > 0)
      .slice().sort((a, b) => Math.abs(b[field]) - Math.abs(a[field]))
      .slice(0, Math.max(1, Math.min(10, Math.trunc(Number(limit) || 3))))
      .map((row, index) => ({ strike: row.strike, value: row[field], rank: index + 1 }));
  }

  window.QuantLabGexModel = Object.freeze({ buildProfile, topGexWalls, metricValue });
})();
