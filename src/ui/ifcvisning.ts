/**
 * Lille 3D-fremviser til IFC-modellen (canvas 2D, ingen afhængigheder): fladeskygning med
 * malerens algoritme, bagsidebortskæring for lukkede legemer og fritrummet som gennemsigtige ringe.
 * Træk = drej, Shift/højreklik-træk eller to fingre = panorér, hjul/knib = zoom.
 */

/** lag: tegnes i stigende orden (underbygning før ballast før skinner), dybdesorteret inden for laget. */
export interface VisMesh { pts: number[]; tri: number[]; farve: [number, number, number]; lukket: boolean; lag?: number }
export interface Visning { tegn(): void; saet(view: 'skraa' | 'langs' | 'side' | 'top'): void; destroy(): void }

type V3 = [number, number, number];

export function lav3D(
  canvas: HTMLCanvasElement,
  meshes: VisMesh[],
  ringe: V3[][],
  centrum: V3,
  phi: number,
): Visning {
  const ctx = canvas.getContext('2d')!;
  let az = phi + Math.PI + 0.65, el = 0.32, dist = 24;
  let pan: V3 = [0, 0, 0];
  const tris: { a: number; b: number; c: number; m: number }[] = [];
  const P: V3[] = [];
  meshes.forEach((m, mi) => {
    const off = P.length;
    for (let i = 0; i < m.pts.length; i += 3) P.push([m.pts[i] - centrum[0], m.pts[i + 1] - centrum[1], m.pts[i + 2] - centrum[2]]);
    for (let i = 0; i < m.tri.length; i += 3) tris.push({ a: off + m.tri[i], b: off + m.tri[i + 1], c: off + m.tri[i + 2], m: mi });
  });
  const R: V3[][] = ringe.map((r) => r.map((p) => [p[0] - centrum[0], p[1] - centrum[1], p[2] - centrum[2]] as V3));
  const css = getComputedStyle(canvas);
  const farve = (v: string, d: string) => css.getPropertyValue(v).trim() || d;

  const tegn = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = canvas.clientWidth || 600, H = canvas.clientHeight || 380;
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = farve('--surface-2', '#f0eee9');
    ctx.fillRect(0, 0, W, H);
    // kamera
    const ce = Math.cos(el), se = Math.sin(el);
    const cam: V3 = [pan[0] + dist * ce * Math.cos(az), pan[1] + dist * ce * Math.sin(az), pan[2] + dist * se];
    const f: V3 = norm([pan[0] - cam[0], pan[1] - cam[1], pan[2] - cam[2]]);
    const r: V3 = norm(cross(f, [0, 0, 1]));
    const u: V3 = cross(r, f);
    const F = H / (2 * Math.tan((50 * Math.PI) / 360));
    const proj = P.map((p) => {
      const v: V3 = [p[0] - cam[0], p[1] - cam[1], p[2] - cam[2]];
      const z = dot(v, f);
      return [W / 2 + (F * dot(v, r)) / z, H / 2 - (F * dot(v, u)) / z, z] as V3;
    });
    const lys = norm([0.35, -0.45, 0.82]);
    const liste: { z: number; m: number; t: number; k: number; lag: number }[] = [];
    for (let i = 0; i < tris.length; i++) {
      const t = tris[i];
      const A = proj[t.a], B = proj[t.b], C = proj[t.c];
      if (A[2] < 0.3 || B[2] < 0.3 || C[2] < 0.3) continue;
      const pa = P[t.a], pb = P[t.b], pc = P[t.c];
      const n = cross([pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]], [pc[0] - pa[0], pc[1] - pa[1], pc[2] - pa[2]]);
      const nl = Math.hypot(n[0], n[1], n[2]);
      if (nl < 1e-12) continue;
      const nn: V3 = [n[0] / nl, n[1] / nl, n[2] / nl];
      const mesh = meshes[t.m];
      const tilKam = dot(nn, [cam[0] - pa[0], cam[1] - pa[1], cam[2] - pa[2]]);
      if (mesh.lukket && tilKam < 0) continue;
      const k = 0.42 + 0.58 * Math.abs(dot(nn, lys));
      liste.push({ z: (A[2] + B[2] + C[2]) / 3, m: t.m, t: i, k, lag: mesh.lag ?? 0 });
    }
    liste.sort((a, b) => a.lag - b.lag || b.z - a.z);
    ctx.lineJoin = 'round';
    for (const e of liste) {
      const t = tris[e.t], m = meshes[e.m];
      const A = proj[t.a], B = proj[t.b], C = proj[t.c];
      const c = `rgb(${Math.round(m.farve[0] * 255 * e.k)},${Math.round(m.farve[1] * 255 * e.k)},${Math.round(m.farve[2] * 255 * e.k)})`;
      ctx.fillStyle = c; ctx.strokeStyle = c; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.lineTo(C[0], C[1]); ctx.closePath();
      ctx.fill(); ctx.stroke();
    }
    // fritrum: ringe og længdelinjer
    const pr = (p: V3): V3 => {
      const v: V3 = [p[0] - cam[0], p[1] - cam[1], p[2] - cam[2]];
      const z = dot(v, f);
      return [W / 2 + (F * dot(v, r)) / z, H / 2 - (F * dot(v, u)) / z, z];
    };
    const blaa = 'rgba(52, 132, 222, ';
    ctx.lineWidth = 1;
    R.forEach((ring, i) => {
      const q = ring.map(pr);
      if (q.some((p) => p[2] < 0.3)) return;
      ctx.strokeStyle = blaa + (i % 5 === 0 ? '0.75)' : '0.32)');
      ctx.beginPath();
      q.forEach((p, j) => (j ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.closePath(); ctx.stroke();
    });
    if (R.length > 1) {
      ctx.strokeStyle = blaa + '0.55)';
      const n = R[0].length;
      for (let j = 0; j < n; j++) {
        ctx.beginPath();
        let start = true;
        for (const ring of R) {
          const p = pr(ring[j]);
          if (p[2] < 0.3) { start = true; continue; }
          if (start) { ctx.moveTo(p[0], p[1]); start = false; } else ctx.lineTo(p[0], p[1]);
        }
        ctx.stroke();
      }
    }
    // nordpil
    const nord = pr([pan[0], pan[1] + 1, pan[2]]), o = pr(pan);
    if (nord[2] > 0.3 && o[2] > 0.3) {
      const dx = nord[0] - o[0], dy = nord[1] - o[1], l = Math.hypot(dx, dy) || 1;
      const cx = W - 30, cy = 34;
      ctx.strokeStyle = farve('--muted', '#6b655c'); ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx - (dx / l) * 12, cy - (dy / l) * 12); ctx.lineTo(cx + (dx / l) * 12, cy + (dy / l) * 12); ctx.stroke();
      ctx.font = '600 11px Inter, system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('N', cx + (dx / l) * 22, cy + (dy / l) * 22 + 4);
    }
  };

  // interaktion
  let drag: { x: number; y: number; pan: boolean } | null = null;
  const pkt = new Map<number, { x: number; y: number }>();
  let knib = 0;
  const onDown = (e: PointerEvent) => {
    canvas.setPointerCapture(e.pointerId);
    pkt.set(e.pointerId, { x: e.clientX, y: e.clientY });
    drag = { x: e.clientX, y: e.clientY, pan: e.shiftKey || e.button === 2 || pkt.size > 1 };
    if (pkt.size === 2) { const [a, b] = [...pkt.values()]; knib = Math.hypot(a.x - b.x, a.y - b.y); }
  };
  const onMove = (e: PointerEvent) => {
    if (!drag || !pkt.has(e.pointerId)) return;
    pkt.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pkt.size === 2) {
      const [a, b] = [...pkt.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (knib > 0) dist = Math.max(3, Math.min(400, dist * (knib / d)));
      knib = d;
    }
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY;
    if (drag.pan) {
      const k = dist / 500;
      const rr: V3 = [Math.sin(az), -Math.cos(az), 0];
      pan = [pan[0] + rr[0] * dx * k, pan[1] + rr[1] * dx * k, pan[2] + dy * k];
    } else {
      az -= dx * 0.008;
      el = Math.max(-0.2, Math.min(1.45, el + dy * 0.006));
    }
    planlaeg();
  };
  const onUp = (e: PointerEvent) => { pkt.delete(e.pointerId); if (!pkt.size) drag = null; knib = 0; };
  const onWheel = (e: WheelEvent) => { e.preventDefault(); dist = Math.max(3, Math.min(400, dist * Math.exp(e.deltaY * 0.0012))); planlaeg(); };
  const onCtx = (e: Event) => e.preventDefault();
  let raf = 0;
  const planlaeg = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; tegn(); }); };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', onCtx);
  const ro: ResizeObserver | null = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { if (!canvas.isConnected) { ro?.disconnect(); return; } planlaeg(); }) : null;
  ro?.observe(canvas);
  tegn();
  return {
    tegn,
    saet(v) {
      pan = [0, 0, 0];
      if (v === 'skraa') { az = phi + Math.PI + 0.65; el = 0.32; dist = 24; }
      if (v === 'langs') { az = phi + Math.PI; el = 0.12; dist = 20; }
      if (v === 'side') { az = phi - Math.PI / 2; el = 0.05; dist = 34; }
      if (v === 'top') { az = phi - Math.PI / 2; el = 1.45; dist = 60; }
      planlaeg();
    },
    destroy() {
      canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('wheel', onWheel); canvas.removeEventListener('contextmenu', onCtx);
      ro?.disconnect();
      if (raf) cancelAnimationFrame(raf);
    },
  };
}

const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
