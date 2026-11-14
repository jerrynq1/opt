/* Interactive 3D option surfaces (Three.js WebGL mesh with a Canvas fallback). */
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

  function mountCanvasFallback(host, dataset, options = {}) {
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
    host.innerHTML = `<div class="so-3d-toolbar"><div class="so-3d-legend"><i class="${legendClass}"></i><span>${metricLabel}</span><small>2D projection fallback · WebGL unavailable</small></div><div class="so-3d-actions"><button type="button" data-3d-action="minus" aria-label="Zoom out">−</button><button type="button" data-3d-action="reset">Reset</button><button type="button" data-3d-action="plus" aria-label="Zoom in">+</button></div></div><div class="so-3d-stage"><canvas class="so-3d-canvas" tabindex="0" aria-label="Interactive 3D ${metricLabel} surface"></canvas><div class="so-3d-tooltip" hidden></div></div><div class="so-3d-axis-footer"><span>X · ${xLabel}</span><span>Y · ${yLabel}</span><span>Z · ${metricLabel}</span></div>`;
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

  /* ================= TRUE 3D WEBGL RENDERER =================
     X = strike / spot moneyness, Y = expiry / DTE, Z = metric value.
     The plotting style is inspired by the supplied legacy Three.js chart,
     restyled for QuantLab's dark navy / teal / blue / gold theme.
  */
  function mountThree(host, initialDataset, initialOptions, THREE) {
    if (!host) return null;
    const defaults = { yaw: -0.72, pitch: 0.62, distance: 5.25 };
    const cameraState = host._stockOptions3dCamera || defaults;
    const camera = { ...defaults, ...cameraState };
    let dataset = initialDataset || {}, options = initialOptions || {}, mesh = makeMesh(dataset);
    let metricLabel = options.metricLabel || dataset?.config?.label || dataset?.metric || 'Metric';
    let xLabel = options.xLabel || 'Strike / Spot moneyness';
    let yLabel = options.yLabel || 'Expiry · DTE';
    let formatter = typeof options.formatValue === 'function' ? options.formatValue : v => fmt(v, 3);
    let disposed = false, raf = 0, resizeObserver = null, dragging = false, lastPointer = null;
    const pointers = new Map();
    let pinchDistance = 0, hovered = null, width = 0, height = 0;

    const legendClass = () => mesh.scale.signed ? 'is-signed' : dataset?.metric === 'iv' ? 'is-iv' : dataset?.metric === 'volume' ? 'is-volume' : dataset?.metric === 'oi' ? 'is-oi' : 'is-positive';
    host.innerHTML = `<div class="so-3d-toolbar"><div class="so-3d-legend"><i class="${legendClass()}"></i><span class="so-3d-metric-label">${esc(metricLabel)}</span><small>WEBGL · TRUE 3D MESH · drag to rotate · wheel to zoom</small></div><div class="so-3d-actions"><button type="button" data-3d-action="minus" aria-label="Zoom out">−</button><button type="button" data-3d-action="reset">Reset view</button><button type="button" data-3d-action="plus" aria-label="Zoom in">+</button></div></div><div class="so-3d-stage"><canvas class="so-3d-canvas" tabindex="0" aria-label="Interactive WebGL 3D ${esc(metricLabel)} surface"></canvas><div class="so-3d-empty" hidden></div><div class="so-3d-tooltip" hidden></div></div><div class="so-3d-axis-footer"><span class="axis-x">X · ${esc(xLabel)}</span><span class="axis-y">Y · ${esc(yLabel)}</span><span class="axis-z">Z · ${esc(metricLabel)}</span></div>`;
    const stage = host.querySelector('.so-3d-stage');
    const canvas = host.querySelector('canvas');
    const tooltip = host.querySelector('.so-3d-tooltip');
    const empty = host.querySelector('.so-3d-empty');
    const legend = host.querySelector('.so-3d-legend > i');
    const metricNode = host.querySelector('.so-3d-metric-label');
    const axisX = host.querySelector('.axis-x'), axisY = host.querySelector('.axis-y'), axisZ = host.querySelector('.axis-z');

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(1.6, window.devicePixelRatio || 1));
    renderer.setClearColor(0x07101b, 1);
    if (THREE.sRGBEncoding !== undefined) renderer.outputEncoding = THREE.sRGBEncoding;
    if (THREE.ACESFilmicToneMapping !== undefined) renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.04;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07101b);
    const camera3d = new THREE.PerspectiveCamera(37, 1, 0.08, 80);
    // Conceptual axes: X=Strike, Y=Expiry, Z=Metric. Z is the up-axis.
    camera3d.up.set(0, 0, 1);
    scene.add(new THREE.AmbientLight(0xc8d8ea, 0.76));
    const keyLight = new THREE.DirectionalLight(0xd9f5ff, 1.12);
    keyLight.position.set(-3.2, -4.5, 7.0); scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0x7897ff, 0.34);
    fillLight.position.set(4.5, 2.0, 3.5); scene.add(fillLight);
    const rimLight = new THREE.DirectionalLight(0x4bd3b0, 0.22);
    rimLight.position.set(-4.0, 4.0, 1.5); scene.add(rimLight);
    const plotGroup = new THREE.Group(); scene.add(plotGroup);
    const target = new THREE.Vector3(0, 0, -0.02);
    const palette = {
      axisX: 0x5bcbe2, axisY: 0x829cff, axisZ: 0xe3bd70,
      grid: 0x355069, gridSoft: 0x25384b, zero: 0x8ca2bd,
      neutral: [35, 51, 72], positive: [68, 211, 169], negative: [239, 111, 139]
    };

    function setCamera() {
      camera.distance = clamp(camera.distance, 3.05, 9.5);
      camera.pitch = clamp(camera.pitch, 0.12, 1.42);
      const cp = Math.cos(camera.pitch), sp = Math.sin(camera.pitch);
      camera3d.position.set(
        camera.distance * cp * Math.sin(camera.yaw),
        -camera.distance * cp * Math.cos(camera.yaw),
        camera.distance * sp
      );
      camera3d.lookAt(target);
      camera3d.updateMatrixWorld();
    }
    setCamera();

    function disposeObject(object) {
      object.traverse?.(child => {
        if (child.geometry?.dispose) child.geometry.dispose();
        const mats = Array.isArray(child.material) ? child.material : child.material ? [child.material] : [];
        mats.forEach(mat => {
          if (mat.map?.dispose) mat.map.dispose();
          if (mat.dispose) mat.dispose();
        });
      });
    }
    function clearPlot() {
      while (plotGroup.children.length) {
        const child = plotGroup.children[plotGroup.children.length - 1];
        plotGroup.remove(child);
        disposeObject(child);
      }
    }
    function makeLineSegments(pairs, color, opacity = 0.55, renderOrder = 3) {
      if (!pairs.length) return null;
      const coords = [];
      pairs.forEach(pair => pair.forEach(p => coords.push(p[0], p[1], p[2])));
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(coords, 3));
      const material = new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: false });
      const object = new THREE.LineSegments(geometry, material);
      object.renderOrder = renderOrder;
      return object;
    }
    function addTextSprite(text, position, color = '#a8bbd0', size = 'tick') {
      const c = document.createElement('canvas'); c.width = 512; c.height = 128;
      const g = c.getContext('2d');
      if (!g) return;
      g.clearRect(0, 0, c.width, c.height);
      g.font = size === 'axis' ? '700 34px ui-monospace,Consolas,monospace' : '600 31px ui-monospace,Consolas,monospace';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineJoin = 'round'; g.lineWidth = size === 'axis' ? 8 : 6; g.strokeStyle = 'rgba(3,8,15,.96)';
      g.strokeText(String(text), 256, 64); g.fillStyle = color; g.fillText(String(text), 256, 64);
      const texture = new THREE.CanvasTexture(c);
      texture.minFilter = THREE.LinearFilter;
      const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
      const sprite = new THREE.Sprite(material);
      sprite.position.set(position[0], position[1], position[2]);
      const worldW = size === 'axis' ? Math.min(1.12, Math.max(0.62, String(text).length * 0.043)) : Math.min(0.52, Math.max(0.25, String(text).length * 0.026));
      sprite.scale.set(worldW, worldW * 0.25, 1);
      sprite.renderOrder = 20;
      plotGroup.add(sprite);
    }
    function colorForValue(value) {
      const scale = mesh.scale;
      const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
      let rgb;
      if (scale.signed) {
        const t = clamp(Math.abs(value) / Math.max(scale.abs, 1e-12), 0, 1);
        rgb = value >= 0 ? lerp(palette.neutral, palette.positive, Math.pow(t, 0.72)) : lerp(palette.neutral, palette.negative, Math.pow(t, 0.72));
      } else {
        const t = scale.max === scale.min ? 0.5 : clamp((value - scale.min) / (scale.max - scale.min), 0, 1);
        let stops;
        if (dataset?.metric === 'iv') stops = [[37, 88, 157], [52, 170, 204], [154, 137, 220]];
        else if (dataset?.metric === 'volume') stops = [[67, 53, 128], [116, 92, 195], [190, 157, 244]];
        else if (dataset?.metric === 'oi') stops = [[115, 78, 34], [205, 143, 61], [246, 211, 139]];
        else stops = [[28, 91, 111], [48, 166, 171], [104, 222, 184]];
        const scaled = t * (stops.length - 1), idx = Math.min(stops.length - 2, Math.floor(scaled));
        rgb = lerp(stops[idx], stops[idx + 1], scaled - idx);
      }
      return rgb.map(v => v / 255);
    }
    function addAxes() {
      const x0 = -1.42, x1 = 1.42, y0 = -1.42, y1 = 1.42, z0 = -1.08, z1 = 1.12;
      const axisPairs = [
        [[x0, y0, z0], [x1, y0, z0]],
        [[x0, y0, z0], [x0, y1, z0]],
        [[x0, y0, z0], [x0, y0, z1]]
      ];
      const xAxis = makeLineSegments([axisPairs[0]], palette.axisX, 0.95, 8);
      const yAxis = makeLineSegments([axisPairs[1]], palette.axisY, 0.95, 8);
      const zAxis = makeLineSegments([axisPairs[2]], palette.axisZ, 0.98, 8);
      [xAxis, yAxis, zAxis].filter(Boolean).forEach(o => plotGroup.add(o));

      // Ground and back-plane grids make depth readable without filling missing cells.
      const floorPairs = [], rearPairs = [], sidePairs = [];
      for (let i = 0; i <= 6; i++) {
        const t = -1.3 + i * (2.6 / 6);
        floorPairs.push([[t, y0, z0], [t, y1, z0]], [[x0, t, z0], [x1, t, z0]]);
        rearPairs.push([[t, y1, z0], [t, y1, z1]], [[x0, y1, t * (z1 - z0) / 2.6 + (z1 + z0) / 2], [x1, y1, t * (z1 - z0) / 2.6 + (z1 + z0) / 2]]);
        sidePairs.push([[x0, t, z0], [x0, t, z1]]);
      }
      [makeLineSegments(floorPairs, palette.gridSoft, 0.35, 1), makeLineSegments(rearPairs, palette.gridSoft, 0.22, 1), makeLineSegments(sidePairs, palette.gridSoft, 0.18, 1)].filter(Boolean).forEach(o => plotGroup.add(o));
      // A subtle zero plane is useful for signed Greeks and exposures.
      if (mesh.scale.signed) {
        const zeroPairs = [[[x0, y0, 0], [x1, y0, 0]], [[x0, y0, 0], [x0, y1, 0]], [[x1, y1, 0], [x0, y1, 0]]];
        const zeroLine = makeLineSegments(zeroPairs, palette.zero, 0.58, 5);
        if (zeroLine) plotGroup.add(zeroLine);
      }

      // X ticks: moneyness buckets. Y ticks: expiry/DTE. Z ticks: metric values.
      const xIdx = [...new Set([0, Math.round((mesh.bins.length - 1) * 0.25), Math.round((mesh.bins.length - 1) * 0.5), Math.round((mesh.bins.length - 1) * 0.75), mesh.bins.length - 1])];
      xIdx.forEach(i => {
        const x = (i / Math.max(1, mesh.bins.length - 1) * 2 - 1) * 1.25;
        const pct = Number(mesh.bins[i]);
        const label = Math.abs(pct) < 0.001 ? 'ATM 0%' : `${pct > 0 ? '+' : ''}${fmt(pct, 1)}%`;
        addTextSprite(label, [x, y0 - 0.12, z0 - 0.02], pct === 0 ? '#70dfc1' : '#91a8c0');
      });
      const yIdx = [...new Set([0, Math.floor((mesh.rows.length - 1) / 2), mesh.rows.length - 1])];
      yIdx.forEach(i => {
        const row = mesh.rows[i], y = mesh.vertices[i]?.[0]?.y ?? 0;
        addTextSprite(`${fmt(Number(row?.dte), 0)}D`, [x0 - 0.18, y * 1.25, z0 - 0.02], '#9baeff');
      });
      const zValues = mesh.scale.signed
        ? [-mesh.scale.abs, 0, mesh.scale.abs]
        : [mesh.scale.min, (mesh.scale.min + mesh.scale.max) / 2, mesh.scale.max];
      zValues.forEach(value => {
        const z = (normalizeZ(value, mesh.scale) ?? 0) * 1.18;
        addTextSprite(formatter(value), [x0 - 0.2, y0 - 0.14, z], value === 0 && mesh.scale.signed ? '#b9c9db' : '#e4c27c');
      });
      addTextSprite('X  STRIKE / SPOT', [0, y0 - 0.42, z0 - 0.04], '#65cfe2', 'axis');
      addTextSprite('Y  EXPIRY / DTE', [x0 - 0.56, 0, z0 - 0.05], '#8ea5ff', 'axis');
      addTextSprite(`Z  ${metricLabel.toUpperCase()}`, [x0 - 0.45, y0 - 0.46, 0.22], '#e5c27a', 'axis');
    }
    function buildPlot() {
      clearPlot();
      if (mesh.rows.length < 2 || mesh.bins.length < 2 || mesh.faces.length === 0) {
        canvas.style.display = 'none'; empty.hidden = false;
        empty.innerHTML = `Cần ít nhất 2 expiry và 2 vùng moneyness có dữ liệu hợp lệ. Hãy chọn Analysis Scope → Weekly hoặc All Expiries.<small>${mesh.rows.length} expiry · ${mesh.bins.length} moneyness buckets · ${mesh.faces.length} mesh faces</small>`;
        tooltip.hidden = true;
        return;
      }
      empty.hidden = true; canvas.style.display = 'block';
      const nx = mesh.bins.length, positions = [], colors = [], indices = [], wire = [], dots = [];
      mesh.vertices.forEach(row => row.forEach(v => {
        positions.push(v.x * 1.25, v.y * 1.25, v.z === null ? -1.08 : v.z * 1.18);
        const c = v.z === null ? [0.02, 0.04, 0.07] : colorForValue(v.value);
        colors.push(c[0], c[1], c[2]);
        if (v.z !== null) dots.push(v.x * 1.25, v.y * 1.25, v.z * 1.18);
      }));
      mesh.faces.forEach(face => {
        if (face.length !== 3) return;
        face.forEach(v => indices.push(v.yi * nx + v.xi));
      });
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      geometry.setIndex(indices); geometry.computeVertexNormals();
      const material = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.58, metalness: 0.08, transparent: true, opacity: 0.97 });
      const surface = new THREE.Mesh(geometry, material); surface.renderOrder = 2; plotGroup.add(surface);

      // Draw row/column mesh lines only between adjacent valid observations.
      mesh.vertices.forEach(row => {
        for (let i = 0; i < row.length - 1; i++) {
          const a = row[i], b = row[i + 1];
          if (a?.z !== null && b?.z !== null) wire.push([[a.x * 1.25, a.y * 1.25, a.z * 1.18], [b.x * 1.25, b.y * 1.25, b.z * 1.18]]);
        }
      });
      for (let x = 0; x < nx; x++) {
        for (let y = 0; y < mesh.vertices.length - 1; y++) {
          const a = mesh.vertices[y][x], b = mesh.vertices[y + 1][x];
          if (a?.z !== null && b?.z !== null) wire.push([[a.x * 1.25, a.y * 1.25, a.z * 1.18], [b.x * 1.25, b.y * 1.25, b.z * 1.18]]);
        }
      }
      const wireObj = makeLineSegments(wire, 0xd0e7f2, 0.30, 4); if (wireObj) plotGroup.add(wireObj);
      if (dots.length) {
        const pointGeo = new THREE.BufferGeometry(); pointGeo.setAttribute('position', new THREE.Float32BufferAttribute(dots, 3));
        const pointMat = new THREE.PointsMaterial({ color: 0xdcecf5, size: 0.022, transparent: true, opacity: 0.52, sizeAttenuation: true, depthWrite: false });
        const pointObj = new THREE.Points(pointGeo, pointMat); pointObj.renderOrder = 5; plotGroup.add(pointObj);
      }
      addAxes();
      tooltip.hidden = true;
    }
    function resize() {
      if (disposed) return;
      const rect = stage.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      width = rect.width; height = rect.height;
      renderer.setSize(Math.round(width), Math.round(height), false);
      camera3d.aspect = width / height; camera3d.updateProjectionMatrix();
      scheduleDraw();
    }
    function render() {
      if (disposed || !width || !height) return;
      setCamera(); renderer.render(scene, camera3d);
    }
    function scheduleDraw() { if (disposed) return; if (raf) cancelAnimationFrame(raf); raf = requestAnimationFrame(render); }
    function projectVertex(v) {
      const point = new THREE.Vector3(v.x * 1.25, v.y * 1.25, v.z * 1.18);
      point.project(camera3d);
      return { x: (point.x * 0.5 + 0.5) * width, y: (-point.y * 0.5 + 0.5) * height, depth: point.z };
    }
    function nearestPoint(event) {
      const rect = canvas.getBoundingClientRect(), mx = event.clientX - rect.left, my = event.clientY - rect.top;
      let best = null, gap = 16 * 16;
      mesh.vertices.forEach(row => row.forEach(vertex => {
        if (vertex.z === null) return;
        const point = projectVertex(vertex), d = (point.x - mx) ** 2 + (point.y - my) ** 2;
        if (point.depth >= -1 && point.depth <= 1 && d < gap) { gap = d; best = { vertex, point }; }
      }));
      return best;
    }
    function showTooltip(hit) {
      if (!hit) { tooltip.hidden = true; return; }
      const v = hit.vertex;
      tooltip.innerHTML = `<b>${esc(v.expiry || '')} · ${fmt(v.labelY, 1)} DTE</b><span>${v.strikePrice !== null ? `Strike ${fmt(v.strikePrice, 2)} · ` : ''}${fmt(v.labelX, 1)}% moneyness</span><strong>${esc(formatter(v.value))}</strong><small>${v.usableCount}/${v.contractCount} usable · ${v.providerCount} provider / ${v.modelCount} model · ${v.complete ? 'FULL' : 'PARTIAL'}</small>`;
      tooltip.style.left = `${clamp(hit.point.x + 13, 6, Math.max(6, width - 230))}px`;
      tooltip.style.top = `${clamp(hit.point.y - 18, 6, Math.max(6, height - 104))}px`;
      tooltip.hidden = false;
    }
    function updatePointerMap(event) {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, [event.clientX, event.clientY]);
      if (pointers.size === 1) {
        const current = pointers.get(event.pointerId);
        if (lastPointer) {
          camera.yaw += (current[0] - lastPointer[0]) * 0.007;
          camera.pitch = clamp(camera.pitch + (current[1] - lastPointer[1]) * 0.006, 0.12, 1.42);
        }
        lastPointer = current;
      } else if (pointers.size === 2) {
        const pts = [...pointers.values()], d = Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]);
        if (pinchDistance > 0 && d > 0) camera.distance = clamp(camera.distance * pinchDistance / d, 3.05, 9.5);
        pinchDistance = d; lastPointer = null;
      }
      tooltip.hidden = true; scheduleDraw();
    }
    const onPointerDown = event => {
      pointers.set(event.pointerId, [event.clientX, event.clientY]);
      try { canvas.setPointerCapture(event.pointerId); } catch (_) {}
      dragging = true; lastPointer = [event.clientX, event.clientY];
      if (pointers.size === 2) { const pts = [...pointers.values()]; pinchDistance = Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]); lastPointer = null; }
      canvas.classList.add('is-dragging'); tooltip.hidden = true;
    };
    const onPointerMove = event => {
      if (pointers.has(event.pointerId)) updatePointerMap(event);
      else if (!dragging) { const hit = nearestPoint(event); showTooltip(hit); }
    };
    const onPointerUp = event => {
      pointers.delete(event.pointerId); pinchDistance = 0;
      if (!pointers.size) { dragging = false; lastPointer = null; canvas.classList.remove('is-dragging'); }
      else { lastPointer = [...pointers.values()][0]; }
    };
    const onWheel = event => { event.preventDefault(); camera.distance = clamp(camera.distance * (event.deltaY > 0 ? 1.09 : 0.917), 3.05, 9.5); scheduleDraw(); };
    const onHostClick = event => {
      const button = event.target?.closest?.('[data-3d-action]'); if (!button) return;
      const action = button.dataset['3dAction'];
      if (action === 'plus') camera.distance = clamp(camera.distance * 0.86, 3.05, 9.5);
      else if (action === 'minus') camera.distance = clamp(camera.distance / 0.86, 3.05, 9.5);
      else { camera.yaw = defaults.yaw; camera.pitch = defaults.pitch; camera.distance = defaults.distance; }
      scheduleDraw();
    };
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('pointerleave', () => { if (!dragging) tooltip.hidden = true; });
    stage.addEventListener('wheel', onWheel, { passive: false });
    host.addEventListener('click', onHostClick);
    if (typeof ResizeObserver !== 'undefined') { resizeObserver = new ResizeObserver(resize); resizeObserver.observe(stage); }
    else window.addEventListener('resize', resize);

    function update(nextDataset, nextOptions = {}) {
      dataset = nextDataset || {}; options = nextOptions || {}; mesh = makeMesh(dataset);
      metricLabel = options.metricLabel || dataset?.config?.label || dataset?.metric || 'Metric';
      xLabel = options.xLabel || 'Strike / Spot moneyness'; yLabel = options.yLabel || 'Expiry · DTE';
      formatter = typeof options.formatValue === 'function' ? options.formatValue : v => fmt(v, 3);
      metricNode.textContent = metricLabel; legend.className = legendClass();
      axisX.textContent = `X · ${xLabel}`; axisY.textContent = `Y · ${yLabel}`; axisZ.textContent = `Z · ${metricLabel}`;
      buildPlot(); scheduleDraw();
    }
    function dispose() {
      if (disposed) return; disposed = true;
      host._stockOptions3dCamera = { ...camera };
      if (raf) cancelAnimationFrame(raf);
      if (resizeObserver) resizeObserver.disconnect(); else window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointerdown', onPointerDown); canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp); canvas.removeEventListener('pointercancel', onPointerUp);
      stage.removeEventListener('wheel', onWheel); host.removeEventListener('click', onHostClick);
      clearPlot(); renderer.dispose();
    }
    buildPlot();
    resize();
    return { update, dispose, renderer, scene, getMesh: () => mesh };
  }

  function mount(host, dataset, options = {}) {
    if (!host) return () => {};
    if (host._stockOptions3dInstance) {
      host._stockOptions3dInstance.update(dataset, options);
      return host._stockOptions3dDispose || (() => {});
    }
    if (typeof host._stockOptions3dDispose === 'function') host._stockOptions3dDispose();
    host._stockOptions3dDispose = null;
    let instance = null, fallbackReason = 'Three.js CDN chưa tải';
    const THREE = typeof globalThis !== 'undefined' ? globalThis.THREE : null;
    if (THREE?.WebGLRenderer && typeof document !== 'undefined') {
      try { instance = mountThree(host, dataset, options, THREE); } catch (error) {
        fallbackReason = `WebGL không khởi tạo được: ${error?.message || error}`;
      }
    }
    if (instance) {
      host._stockOptions3dInstance = instance;
      host._stockOptions3dDispose = () => {
        instance.dispose(); host._stockOptions3dInstance = null; host._stockOptions3dDispose = null;
      };
      return host._stockOptions3dDispose;
    }
    const dispose = mountCanvasFallback(host, dataset, options);
    const fallbackLabel = host.querySelector('.so-3d-legend small');
    if (fallbackLabel) { fallbackLabel.textContent = `2D projection fallback · ${fallbackReason}`; fallbackLabel.title = fallbackReason; }
    host._stockOptions3dDispose = dispose;
    return dispose;
  }

  return { makeMesh, projectPoint, mount, mountThree };
});
