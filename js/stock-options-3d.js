/* Interactive 3D option surfaces (Canvas projection, no external chart dependency). */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.StockOptions3D = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const finite = v => Number.isFinite(Number(v));
  const fmt = (v, d = 1) => Number.isFinite(v) ? Number(v).toLocaleString('en-US', { maximumFractionDigits: d }) : '—';

  function valueScale(rows, kind) {
    const values = rows.flatMap(r => (r.cells || []).map(c => c?.value)).filter(Number.isFinite);
    if (!values.length) return { min: 0, max: 1, abs: 1, empty: true };
    const min = Math.min(...values), max = Math.max(...values), abs = Math.max(1e-12, ...values.map(Math.abs));
    return { min, max, abs, empty: false, signed: kind === 'signed' };
  }
  function normalizeZ(value, scale) {
    if (!Number.isFinite(value)) return null;
    if (scale.signed) return (value / scale.abs) * 0.86;
    if (scale.max === scale.min) return 0.35;
    return -0.1 + ((value - scale.min) / (scale.max - scale.min)) * 0.92;
  }
  function makeMesh(dataset) {
    const bins = Array.isArray(dataset?.bins) ? dataset.bins : [];
    const rows = Array.isArray(dataset?.rows) ? dataset.rows : [];
    const scale = valueScale(rows, dataset?.config?.kind);
    const dtes = rows.map(r => Number(r.dte)).filter(Number.isFinite);
    const minDte = dtes.length ? Math.min(...dtes) : 0;
    const maxDte = dtes.length ? Math.max(...dtes) : 1;
    const vertices = rows.map((row, yi) => (row.cells || []).map((cell, xi) => {
      const value = Number.isFinite(cell?.value) ? cell.value : null;
      return {
        xi, yi, value, z: value === null ? null : normalizeZ(value, scale),
        strikePrice: Number.isFinite(Number(dataset?.spot)) && bins[xi] !== undefined ? Number(dataset.spot) * (1 + Number(bins[xi]) / 100) : null,
        x: bins.length <= 1 ? 0 : (xi / (bins.length - 1)) * 2 - 1,
        y: maxDte === minDte ? 0 : ((Number(row.dte) - minDte) / (maxDte - minDte)) * 2 - 1,
        labelX: bins[xi], labelY: row.dte, expiry: row.expiry,
        complete: row.complete !== false, coverage: cell?.coverage ?? null,
        usableCount: cell?.usableCount ?? 0, contractCount: cell?.contractCount ?? 0,
        providerCount: cell?.providerCount ?? cell?.sources?.providerGreek ?? 0,
        modelCount: cell?.modelCount ?? cell?.sources?.bsmDerivedGreek ?? 0
      };
    }));
    const faces = [];
    for (let y = 0; y < vertices.length - 1; y++) {
      for (let x = 0; x < bins.length - 1; x++) {
        const quad = [vertices[y][x], vertices[y][x + 1], vertices[y + 1][x + 1], vertices[y + 1][x]].filter(v => v && v.z !== null);
        if (quad.length === 4) {
          faces.push([quad[0], quad[1], quad[2]], [quad[0], quad[2], quad[3]]);
        } else if (quad.length === 3) faces.push(quad);
      }
    }
    return { bins, rows, vertices, faces, scale, minDte, maxDte, minX: bins[0] ?? 0, maxX: bins.at(-1) ?? 0 };
  }

  function transform(point, camera) {
    const cy = Math.cos(camera.yaw), sy = Math.sin(camera.yaw);
    const cp = Math.cos(camera.pitch), sp = Math.sin(camera.pitch);
    const x1 = point.x * cy - point.y * sy;
    const y1 = point.x * sy + point.y * cy;
    const y2 = y1 * cp - point.z * sp;
    const depth = y1 * sp + point.z * cp;
    return { x: x1, y: y2, depth };
  }
  function projectPoint(point, camera, width = 800, height = 420) {
    const p = transform(point, camera);
    const scale = Math.min(width * 0.39, height * 0.64) * camera.zoom;
    return { x: width / 2 + p.x * scale, y: height * 0.57 - p.y * scale, depth: p.depth };
  }
  function faceColor(value, scale, metric, depth) {
    const shade = clamp(0.76 + depth * 0.13, 0.45, 0.98);
    if (scale.signed) {
      if (value >= 0) return `rgba(55, ${Math.round(170 * shade + 35)}, ${Math.round(130 * shade + 60)}, .88)`;
      return `rgba(${Math.round(190 * shade + 35)}, ${Math.round(65 * shade + 25)}, ${Math.round(90 * shade + 35)}, .88)`;
    }
    const t = scale.max === scale.min ? 0.5 : clamp((value - scale.min) / (scale.max - scale.min), 0, 1);
    if (metric === 'iv') return `rgba(${Math.round(48 + 115 * t)}, ${Math.round(105 + 70 * t)}, ${Math.round(190 + 55 * t)}, .88)`;
    if (metric === 'volume') return `rgba(${Math.round(96 + 90 * t)}, ${Math.round(80 + 45 * t)}, ${Math.round(175 + 65 * t)}, .88)`;
    if (metric === 'oi') return `rgba(${Math.round(185 + 50 * t)}, ${Math.round(125 + 65 * t)}, ${Math.round(55 + 35 * t)}, .88)`;
    return `rgba(${Math.round(35 + 65 * t)}, ${Math.round(135 + 90 * t)}, ${Math.round(160 + 75 * t)}, .88)`;
  }

  function mount(host, dataset, options = {}) {
    if (!host) return () => {};
    if (typeof host._stockOptions3dDispose === 'function') host._stockOptions3dDispose();
    const mesh = makeMesh(dataset || {});
    const metricLabel = options.metricLabel || dataset?.config?.label || dataset?.metric || 'Metric';
    const xLabel = options.xLabel || 'Strike / Spot moneyness';
    const yLabel = options.yLabel || 'Expiry · DTE';
    const formatter = typeof options.formatValue === 'function' ? options.formatValue : v => fmt(v, 3);
    if (mesh.rows.length < 2 || mesh.bins.length < 2 || mesh.faces.length === 0) {
      host.innerHTML = `<div class="so-3d-empty">Cần ít nhất 2 expiry và 2 vùng moneyness có dữ liệu hợp lệ. Hãy chọn Analysis Scope → Weekly hoặc All Expiries.<small>${mesh.rows.length} expiry · ${mesh.bins.length} moneyness buckets · ${mesh.faces.length} mesh faces</small></div>`;
      host._stockOptions3dDispose = () => {};
      return host._stockOptions3dDispose;
    }
    const legendClass = mesh.scale.signed ? 'is-signed' : dataset?.metric === 'iv' ? 'is-iv' : dataset?.metric === 'volume' ? 'is-volume' : dataset?.metric === 'oi' ? 'is-oi' : 'is-positive';
    host.innerHTML = `<div class="so-3d-toolbar"><div class="so-3d-legend"><i class="${legendClass}"></i><span>${metricLabel}</span><small>${mesh.faces.length} mesh faces · drag to rotate · wheel to zoom</small></div><div class="so-3d-actions"><button type="button" data-3d-action="minus" aria-label="Zoom out">−</button><button type="button" data-3d-action="reset">Reset</button><button type="button" data-3d-action="plus" aria-label="Zoom in">+</button></div></div><div class="so-3d-stage"><canvas class="so-3d-canvas" tabindex="0" aria-label="Interactive 3D ${metricLabel} surface"></canvas><div class="so-3d-tooltip" hidden></div></div><div class="so-3d-axis-footer"><span>X · ${xLabel}</span><span>Y · ${yLabel}</span><span>Z · ${metricLabel}</span></div>`;
    const canvas = host.querySelector('canvas'), stage = host.querySelector('.so-3d-stage'), tooltip = host.querySelector('.so-3d-tooltip');
    const ctx = canvas.getContext('2d');
    if (!ctx) { host.innerHTML = '<div class="so-3d-empty">Trình duyệt không hỗ trợ Canvas 2D.</div>'; return () => {}; }
    const camera = host._stockOptions3dCamera ? { ...host._stockOptions3dCamera } : { yaw: -0.72, pitch: 0.62, zoom: 1.0 };
    let width = 0, height = 0, dpr = 1, dragging = false, last = null, disposed = false, raf = 0, resizeObserver = null, hovered = null;
    const drawLine = (a, b, color = 'rgba(140,163,190,.3)', lineWidth = 1) => { ctx.strokeStyle = color; ctx.lineWidth = lineWidth; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); };
    function resize() {
      if (disposed) return;
      const rect = stage.getBoundingClientRect(); width = Math.max(320, rect.width); height = Math.max(340, rect.height); dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
      scheduleDraw();
    }
    function axes() {
      const floor = -0.96, x0 = { x: -1.05, y: -1.05, z: floor }, x1 = { x: 1.05, y: -1.05, z: floor }, y1 = { x: -1.05, y: 1.05, z: floor }, z1 = { x: -1.05, y: -1.05, z: 0.98 };
      const p0 = projectPoint(x0, camera, width, height), px = projectPoint(x1, camera, width, height), py = projectPoint(y1, camera, width, height), pz = projectPoint(z1, camera, width, height);
      drawLine(p0, px, 'rgba(145,170,198,.78)', 1.4); drawLine(p0, py, 'rgba(145,170,198,.78)', 1.4); drawLine(p0, pz, 'rgba(145,170,198,.78)', 1.4);
      ctx.font = '10px ui-monospace,monospace'; ctx.fillStyle = '#9fb2c9';
      ctx.textAlign = 'center'; ctx.fillText('STRIKE / SPOT', (p0.x + px.x) / 2, (p0.y + px.y) / 2 + 20);
      ctx.fillText('EXPIRY / DTE', (p0.x + py.x) / 2 - 4, (p0.y + py.y) / 2 - 10);
      ctx.save(); ctx.translate(pz.x - 20, pz.y + 10); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center'; ctx.fillText(metricLabel.toUpperCase(), 0, 0); ctx.restore();
      const xTicks = [0, Math.floor((mesh.bins.length - 1) / 2), mesh.bins.length - 1].filter((v, i, a) => a.indexOf(v) === i);
      xTicks.forEach(i => { const x = mesh.bins.length <= 1 ? 0 : i / (mesh.bins.length - 1) * 2 - 1; const p = projectPoint({ x, y: -1.05, z: floor }, camera, width, height); drawLine(p, { x: p.x, y: p.y + 5 }, 'rgba(145,170,198,.45)'); ctx.fillStyle = '#8498b1'; ctx.textAlign = 'center'; ctx.fillText(`${mesh.bins[i] > 0 ? '+' : ''}${mesh.bins[i]}%`, p.x, p.y + 17); });
      const yTicks = [0, Math.floor((mesh.rows.length - 1) / 2), mesh.rows.length - 1].filter((v, i, a) => a.indexOf(v) === i);
      yTicks.forEach(i => { const y = mesh.rows.length <= 1 ? 0 : (Number(mesh.rows[i].dte) - mesh.minDte) / Math.max(1e-9, mesh.maxDte - mesh.minDte) * 2 - 1; const p = projectPoint({ x: -1.05, y, z: floor }, camera, width, height); drawLine(p, { x: p.x - 5, y: p.y }, 'rgba(145,170,198,.45)'); ctx.fillStyle = '#8498b1'; ctx.textAlign = 'right'; ctx.fillText(`${Number(mesh.rows[i].dte).toFixed(0)}D`, p.x - 9, p.y + 3); });
      const zTicks = mesh.scale.signed ? [-mesh.scale.abs, 0, mesh.scale.abs] : [mesh.scale.min, (mesh.scale.min + mesh.scale.max) / 2, mesh.scale.max];
      zTicks.forEach(value => { const z = normalizeZ(value, mesh.scale) * .72; const p = projectPoint({ x: -1.05, y: -1.05, z }, camera, width, height); drawLine(p, { x: p.x - 5, y: p.y }, 'rgba(145,170,198,.45)'); ctx.fillStyle = '#9aabc0'; ctx.textAlign = 'right'; ctx.fillText(formatter(value), p.x - 8, p.y + 3); });
      // Floor grid provides depth cues without implying values in missing cells.
      for (let i = 0; i <= 4; i++) {
        const x = -1 + i * .5, y = -1 + i * .5;
        drawLine(projectPoint({ x, y: -1, z: floor }, camera, width, height), projectPoint({ x, y: 1, z: floor }, camera, width, height), 'rgba(125,150,180,.12)');
        drawLine(projectPoint({ x: -1, y, z: floor }, camera, width, height), projectPoint({ x: 1, y, z: floor }, camera, width, height), 'rgba(125,150,180,.12)');
      }
    }
    function draw() {
      if (disposed || !width || !height) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
      const faces = mesh.faces.map(vertices => {
        const points = vertices.map(v => ({ vertex: v, point: projectPoint({ x: v.x, y: v.y, z: v.z * .72 }, camera, width, height) }));
        return { points, depth: points.reduce((sum, p) => sum + p.point.depth, 0) / points.length, value: vertices.reduce((sum, v) => sum + v.value, 0) / vertices.length };
      }).sort((a, b) => a.depth - b.depth);
      for (const face of faces) {
        ctx.beginPath(); face.points.forEach((p, i) => i ? ctx.lineTo(p.point.x, p.point.y) : ctx.moveTo(p.point.x, p.point.y)); ctx.closePath();
        ctx.fillStyle = faceColor(face.value, mesh.scale, dataset.metric, face.depth); ctx.fill();
        ctx.strokeStyle = 'rgba(8,18,30,.45)'; ctx.lineWidth = .65; ctx.stroke();
      }
      // Surface mesh lines; don't connect through missing values.
      ctx.strokeStyle = 'rgba(218,235,248,.37)'; ctx.lineWidth = .72;
      for (const row of mesh.vertices) {
        ctx.beginPath(); let active = false;
        row.forEach(v => { if (v.z === null) { active = false; return; } const p = projectPoint({ x: v.x, y: v.y, z: v.z * .72 }, camera, width, height); if (!active) { ctx.moveTo(p.x, p.y); active = true; } else ctx.lineTo(p.x, p.y); }); ctx.stroke();
      }
      for (let x = 0; x < mesh.bins.length; x++) {
        ctx.beginPath(); let active = false;
        mesh.vertices.forEach(row => { const v = row[x]; if (!v || v.z === null) { active = false; return; } const p = projectPoint({ x: v.x, y: v.y, z: v.z * .72 }, camera, width, height); if (!active) { ctx.moveTo(p.x, p.y); active = true; } else ctx.lineTo(p.x, p.y); }); ctx.stroke();
      }
      axes();
      if (hovered) {
        const v = hovered.vertex, p = hovered.point;
        ctx.fillStyle = '#fff'; ctx.strokeStyle = '#0c1724'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
    }
    function scheduleDraw() { if (raf) cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); }
    function nearestPoint(event) {
      const rect = canvas.getBoundingClientRect(), mx = event.clientX - rect.left, my = event.clientY - rect.top; let best = null, gap = 18 * 18;
      mesh.vertices.forEach(row => row.forEach(vertex => { if (vertex.z === null) return; const point = projectPoint({ x: vertex.x, y: vertex.y, z: vertex.z * .72 }, camera, width, height); const d = (point.x - mx) ** 2 + (point.y - my) ** 2; if (d < gap) { gap = d; best = { vertex, point }; } }));
      return best;
    }
    canvas.addEventListener('pointerdown', event => { dragging = true; last = { x: event.clientX, y: event.clientY }; canvas.setPointerCapture?.(event.pointerId); canvas.classList.add('is-dragging'); tooltip.hidden = true; });
    canvas.addEventListener('pointermove', event => {
      if (dragging && last) { const dx = event.clientX - last.x, dy = event.clientY - last.y; camera.yaw += dx * .008; camera.pitch = clamp(camera.pitch + dy * .006, .12, 1.36); last = { x: event.clientX, y: event.clientY }; hovered = null; scheduleDraw(); return; }
      hovered = nearestPoint(event); scheduleDraw();
      if (hovered) { const v = hovered.vertex; tooltip.hidden = false; tooltip.innerHTML = `<b>${esc(v.expiry || '')} · ${fmt(v.labelY,1)} DTE</b><span>${v.strikePrice !== null ? `Strike ${fmt(v.strikePrice,2)} · ` : ''}${fmt(v.labelX,1)}% moneyness</span><strong>${esc(formatter(v.value))}</strong><small>${v.usableCount}/${v.contractCount} usable · ${v.providerCount} provider / ${v.modelCount} model · ${v.complete ? 'FULL' : 'PARTIAL'}</small>`; tooltip.style.left = `${clamp(hovered.point.x + 14, 4, width - 180)}px`; tooltip.style.top = `${clamp(hovered.point.y - 16, 4, height - 94)}px`; } else tooltip.hidden = true;
    });
    const stopDrag = () => { dragging = false; last = null; canvas.classList.remove('is-dragging'); };
    canvas.addEventListener('pointerup', stopDrag); canvas.addEventListener('pointercancel', stopDrag); canvas.addEventListener('pointerleave', () => { if (!dragging) { tooltip.hidden = true; hovered = null; scheduleDraw(); } });
    canvas.addEventListener('wheel', event => { event.preventDefault(); camera.zoom = clamp(camera.zoom * (event.deltaY < 0 ? 1.08 : 0.92), .55, 2.5); scheduleDraw(); }, { passive: false });
    const onHostClick = event => { const button = event.target?.closest?.('[data-3d-action]'); if (!button) return; const action = button.dataset['3dAction']; if (action === 'plus') camera.zoom = clamp(camera.zoom * 1.16, .55, 2.5); else if (action === 'minus') camera.zoom = clamp(camera.zoom / 1.16, .55, 2.5); else { camera.yaw = -.72; camera.pitch = .62; camera.zoom = 1; } scheduleDraw(); };
    host.addEventListener('click', onHostClick);
    if (typeof ResizeObserver !== 'undefined') { resizeObserver = new ResizeObserver(resize); resizeObserver.observe(stage); } else window.addEventListener('resize', resize);
    resize();
    const dispose = () => { if (disposed) return; disposed = true; host._stockOptions3dCamera = { ...camera }; if (raf) cancelAnimationFrame(raf); if (resizeObserver) resizeObserver.disconnect(); else window.removeEventListener('resize', resize); host.removeEventListener('click', onHostClick); host._stockOptions3dDispose = null; };
    host._stockOptions3dDispose = dispose;
    return dispose;
  }
  function esc(value) { return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }
  return { makeMesh, projectPoint, mount };
});
