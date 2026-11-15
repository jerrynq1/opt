/* ICT QuantLab GEX Lab — uses the existing QQQ/GLD Option Chain session only. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const hasNumber = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
  const fmtPrice = value => hasNumber(value)
    ? Number(value).toLocaleString('en-US', { maximumFractionDigits: 4 }) : '—';
  const fmtCompact = value => {
    if (!hasNumber(value)) return '—';
    const n = Number(value), a = Math.abs(n);
    if (a >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
    if (a >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
    if (a >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
    return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);
  const METRICS = {
    gex: { label: 'Net GEX', unit: 'USD notional per 1% underlying move' },
    dex: { label: 'DEX · Delta Exposure', unit: 'USD delta notional' },
    vega: { label: 'Vega Exposure', unit: 'Vega × OI × contract multiplier' },
    theta: { label: 'Theta Exposure', unit: 'Theta × OI × contract multiplier' },
    vanna: { label: 'Vanna Exposure', unit: 'USD delta-notional per +1 vol point' },
    charm: { label: 'Charm Exposure', unit: 'USD delta-notional per calendar day' },
    oi: { label: 'Open Interest', unit: 'Contracts' },
    volume: { label: 'Volume', unit: 'Contracts' }
  };

  let active = false;
  let selectedKey = 'qqq';
  let selectedMetric = 'gex';
  let updating = false;
  let updateQueued = false;
  let latestSnapshot = null;

  function readSavedSymbol() {
    try {
      const value = localStorage.getItem('ql_gex_lab_symbol');
      return value === 'gld' ? 'gld' : 'qqq';
    } catch { return 'qqq'; }
  }
  selectedKey = readSavedSymbol();

  function setStatus(kind, message) {
    const el = $('qglStatus');
    if (!el) return;
    el.className = `qgl-status ${kind || ''}`.trim();
    el.textContent = message || '';
  }
  function card(label, value, detail = '') {
    return `<article class="qgl-level"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(detail)}</small></article>`;
  }
  function getLevel(value) {
    if (value && typeof value === 'object') return value.strike ?? value.level ?? null;
    return value ?? null;
  }
  function renderLevels(snapshot) {
    const levels = $('qglLevels');
    if (!levels) return;
    const ratio = snapshot.gexRatioState === 'call-only' ? '∞' :
      Number.isFinite(snapshot.gexRatio) ? `${snapshot.gexRatio.toFixed(3)}x` : '—';
    const ratioNote = snapshot.gexRatioBias === 'call-dominant' ? 'Call gamma trội' :
      snapshot.gexRatioBias === 'put-dominant' ? 'Put gamma trội' :
      snapshot.gexRatioState === 'provisional' ? 'Provisional coverage' : 'Call GEX / |Put GEX|';
    levels.innerHTML = [
      card('SPOT', fmtPrice(snapshot.price), snapshot.priceType || 'Spot from current website session'),
      card('CALL OI WALL', fmtPrice(snapshot.callOIWall?.strike), snapshot.callOIWall ? `${fmtCompact(snapshot.callOIWall.oi)} contracts` : 'OI profile unavailable'),
      card('PUT OI WALL', fmtPrice(snapshot.putOIWall?.strike), snapshot.putOIWall ? `${fmtCompact(snapshot.putOIWall.oi)} contracts` : 'OI profile unavailable'),
      card('CW · MAX +GEX', fmtPrice(snapshot.gexCallWall?.strike), snapshot.gexComplete ? 'QuantLab OI model' : 'GEX coverage incomplete'),
      card('PW · MAX −GEX', fmtPrice(snapshot.gexPutWall?.strike), snapshot.gexComplete ? 'QuantLab OI model' : 'GEX coverage incomplete'),
      card('GAMMA FLIP', fmtPrice(snapshot.gammaFlip), snapshot.gammaFlipMethod || 'BSM repriced zero-cross'),
      card('MAX PAIN', fmtPrice(getLevel(snapshot.maxPain)), snapshot.maxPainComplete ? 'Selected expiry payout minimum' : 'Chain / multiplier coverage incomplete'),
      card('GEX RATIO', ratio, ratioNote)
    ].join('');
  }
  function renderWallList(snapshot) {
    const host = $('qglWalls');
    if (!host) return;
    const model = window.QuantLabGexModel;
    if (!model || !snapshot.gexComplete) {
      host.innerHTML = '<div class="qgl-empty">GEX walls chỉ hiển thị khi toàn bộ Option Chain có coverage hợp lệ.</div>';
      return;
    }
    const calls = model.topGexWalls(snapshot, 'call', 3);
    const puts = model.topGexWalls(snapshot, 'put', 3);
    const side = (title, list, cls) => `<div class="qgl-wall-side"><h4>${title}</h4>${list.length ? list.map(x => `<div class="qgl-wall-row"><b>${x.rank}</b><strong>${fmtPrice(x.strike)}</strong><small>${fmtCompact(x.value)}</small></div>`).join('') : '<div class="qgl-empty">Không có strike hợp lệ.</div>'}</div>`;
    host.innerHTML = side('TOP CALL-SIDE GEX', calls, 'call') + side('TOP PUT-SIDE GEX', puts, 'put');
  }
  function renderLadder(snapshot) {
    const host = $('qglLadder');
    if (!host) return;
    if (!snapshot.gexComplete || !Array.isArray(snapshot.gexLevels)) {
      host.innerHTML = '<div class="qgl-empty">GEX 1–10 chỉ hiển thị khi full-chain GEX coverage hợp lệ.</div>';
      return;
    }
    const levels = snapshot.gexLevels.slice(0, 10);
    host.innerHTML = levels.length ? levels.map(item =>
      `<div class="qgl-ladder-row"><b>#${item.rank}</b><strong>${fmtPrice(item.strike)}</strong><small>${fmtCompact(item.gex)}</small></div>`
    ).join('') : '<div class="qgl-empty">Không có strike GEX bổ sung sau khi loại các Key Levels chính.</div>';
  }
  function renderProfile(snapshot) {
    const host = $('qglProfile');
    const table = $('qglRows');
    const model = window.QuantLabGexModel;
    if (!host || !table || !model) return;
    const profile = model.buildProfile(snapshot, selectedMetric, 48);
    const metric = METRICS[selectedMetric];
    const max = profile.reduce((m, row) => Math.max(m, Math.abs(row.value)), 0);
    $('qglMetricUnit').textContent = metric.unit;
    $('qglMetricTitle').textContent = metric.label.toUpperCase();
    if (!profile.length) {
      host.innerHTML = '<div class="qgl-empty">Không có dữ liệu hợp lệ cho metric đang chọn.</div>';
      table.innerHTML = '<tr><td colspan="10" class="qgl-empty">Dữ liệu thiếu hoặc chưa có coverage phù hợp.</td></tr>';
      return;
    }
    const barRows = profile.map(row => {
      const width = max > 0 ? Math.max(0, row.magnitude * 46) : 0;
      const left = row.value >= 0 ? 50 : 50 - width;
      const cls = row.value > 0 ? 'positive' : row.value < 0 ? 'negative' : 'zero';
      const spotClass = Number.isFinite(snapshot.price) && Math.abs(row.strike - snapshot.price) < 1e-6 ? ' at-spot' : '';
      return `<div class="qgl-profile-row${spotClass}"><span class="qgl-strike">${fmtPrice(row.strike)}</span><div class="qgl-bar-track"><i class="qgl-zero-line"></i><i class="qgl-bar ${cls}" style="left:${left}%;width:${width}%"></i></div><b class="qgl-value">${fmtCompact(row.value)}</b></div>`;
    }).join('');
    host.innerHTML = `<div class="qgl-profile-axis"><span>−${esc(metric.label)}</span><span>0</span><span>+${esc(metric.label)}</span></div>${barRows}`;
    table.innerHTML = profile.map(row => {
      const net = Number.isFinite(row.gex) ? row.gex : null;
      const netClass = net === null ? '' : net > 0 ? 'positive' : net < 0 ? 'negative' : '';
      return `<tr><td>${fmtPrice(row.strike)}</td><td>${fmtCompact(row.callOI)}</td><td>${fmtCompact(row.putOI)}</td><td class="${netClass}">${fmtCompact(net)}</td><td>${fmtCompact(row.dex)}</td><td>${fmtCompact(row.vega)}</td><td>${fmtCompact(row.theta)}</td><td>${fmtCompact(row.vanna)}</td><td>${fmtCompact(row.charm)}</td><td>${fmtCompact((Number(row.callVol)||0)+(Number(row.putVol)||0))}</td></tr>`;
    }).join('');
  }
  function render(snapshot) {
    latestSnapshot = snapshot;
    const symbol = snapshot.symbol || (selectedKey === 'qqq' ? 'QQQ' : 'GLD');
    const expirySelect = $('qglExpiry');
    if (expirySelect) {
      const expiries = Array.isArray(snapshot.expirations) ? snapshot.expirations : [];
      const options = expiries.map(item => {
        const date = item.date || item;
        return `<option value="${esc(date)}">${esc(date)}</option>`;
      }).join('');
      expirySelect.innerHTML = options || '<option value="">Chưa có expiry</option>';
      expirySelect.disabled = !expiries.length;
      expirySelect.value = snapshot.expiry || '';
    }
    const expiryMismatch = !!snapshot.expiryMismatch;
    const chainComplete = !!snapshot.complete;
    const updated = snapshot.updatedAt ? new Date(snapshot.updatedAt).toLocaleTimeString() : '—';
    const spotAge = snapshot.priceAgeMs == null ? 'age chưa rõ' : `price age ${(snapshot.priceAgeMs / 1000).toFixed(1)}s`;
    if ($('qglMeta')) $('qglMeta').textContent = `${symbol} · ${snapshot.dataExpiry || snapshot.expiry || 'expiry —'} · ${chainComplete ? 'FULL CHAIN' : 'PARTIAL / LOADING'} · ${snapshot.totalContracts || 0} contracts · cập nhật ${updated} · ${spotAge}`;
    renderLevels(snapshot);
    renderWallList(snapshot);
    renderLadder(snapshot);
    renderProfile(snapshot);
    const oiCoverage = Number.isFinite(snapshot.coverage) ? `${(snapshot.coverage * 100).toFixed(1)}% observed OI` : 'OI coverage —';
    const gexCoverage = Number.isFinite(snapshot.gexCoverage) ? `${(snapshot.gexCoverage * 100).toFixed(1)}% GEX contracts` : 'GEX coverage —';
    const assumed = snapshot.oiAssumedZero ? ` · ${snapshot.oiAssumedZero} null OI assumed 0` : '';
    const vannaCoverage = Number.isFinite(snapshot.vannaCoverage) ? `${(snapshot.vannaCoverage * 100).toFixed(1)}%` : '—';
    const charmCoverage = Number.isFinite(snapshot.charmCoverage) ? `${(snapshot.charmCoverage * 100).toFixed(1)}%` : '—';
    const volumeCoverage = snapshot.totalContracts ? `${snapshot.volumeKnown || 0}/${snapshot.totalContracts} volume rows` : 'Volume —';
    if ($('qglCoverage')) $('qglCoverage').textContent = `${oiCoverage} · ${gexCoverage}${assumed} · ${volumeCoverage} · Vanna ${vannaCoverage} · Charm ${charmCoverage}`;
    if (expiryMismatch) setStatus('warn', `Expiry đang chọn (${snapshot.expiry}) khác expiry có quote (${snapshot.dataExpiry || 'chưa có'}). Chờ Option Chain hydrate xong.`);
    else if (!snapshot.price) setStatus('warn', 'Đang chờ Spot từ phiên Options hiện tại.');
    else if (!snapshot.gexComplete) setStatus('warn', 'Dữ liệu đã có nhưng GEX chưa đủ coverage; các mức GEX không hoàn chỉnh được ẩn.');
    else setStatus('ok', 'QuantLab OI model · dữ liệu dùng chung với QQQ/GLD Options · không có request FreeFlow riêng.');
  }
  function update() {
    if (!active || updating) return;
    updating = true;
    try {
      const snapshot = window.stockOptionsQuantLabSnapshot?.(selectedKey);
      if (snapshot) render(snapshot);
      else {
        $('qglLevels').innerHTML = '';
        $('qglProfile').innerHTML = '<div class="qgl-empty">Đang khởi tạo Option Chain…</div>';
        if ($('qglLadder')) $('qglLadder').innerHTML = '<div class="qgl-empty">Đang chờ GEX ladder…</div>';
        setStatus('warn', 'Chưa có session Options. Đang kích hoạt nguồn dữ liệu hiện có.');
      }
    } catch (error) {
      setStatus('bad', `Không đọc được dữ liệu Options: ${error?.message || error}`);
    } finally { updating = false; }
  }
  function queueUpdate() {
    if (!active || updateQueued) return;
    updateQueued = true;
    requestAnimationFrame(() => { updateQueued = false; update(); });
  }
  function setSymbol(key) {
    selectedKey = key === 'gld' ? 'gld' : 'qqq';
    try { localStorage.setItem('ql_gex_lab_symbol', selectedKey); } catch {}
    if ($('qglSymbol')) $('qglSymbol').value = selectedKey;
    window.stockOptionsSetActive?.(`${selectedKey}Options`);
    queueUpdate();
  }
  function setExpiry(expiry) {
    if (!expiry) return;
    const fn = window.stockOptionsCrossAssetSetExpiry;
    if (typeof fn !== 'function') {
      setStatus('bad', 'Không tìm thấy expiry controller trong Option Chain.');
      return;
    }
    setStatus('warn', `Đang chuyển ${selectedKey.toUpperCase()} sang expiry ${expiry} bằng luồng Options hiện có…`);
    Promise.resolve(fn(selectedKey, expiry)).then(queueUpdate).catch(error => {
      setStatus('bad', `Không tải được expiry ${expiry}: ${error?.message || error}`);
    });
  }
  function init() {
    if ($('qglSymbol')) {
      $('qglSymbol').value = selectedKey;
      $('qglSymbol').addEventListener('change', event => setSymbol(event.target.value));
    }
    $('qglExpiry')?.addEventListener('change', event => setExpiry(event.target.value));
    $('qglMetric')?.addEventListener('change', event => { selectedMetric = event.target.value in METRICS ? event.target.value : 'gex'; queueUpdate(); });
    $('qglOpenOptions')?.addEventListener('click', () => {
      const target = selectedKey === 'qqq' ? 'qqqOptions' : 'gldOptions';
      document.querySelector(`[data-v="${target}"]`)?.click();
    });
  }

  window.QuantLabGex = Object.freeze({
    setActive(value) {
      active = !!value;
      if (active) {
        window.stockOptionsSetActive?.(`${selectedKey}Options`);
        queueUpdate();
      }
    },
    onDataUpdated(key) { if (active && (!key || key === selectedKey)) queueUpdate(); },
    refresh: queueUpdate
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
