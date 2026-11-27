/**
 * Sporets linjeføring i 3D: vandret (ret, cirkelbue, klotoide, polylinje), længdeprofil
 * (hældninger med parabolske eller cirkulære afrundingskurver) og overhøjde.
 *
 * Parameter d = afstand langs den vandrette linjeføring fra dens start [m].
 * Plan: x = østlig, y = nordlig; retning φ måles mod uret fra øst; krumning k med matematisk fortegn (+ = venstre).
 * SporKits radius har modsat fortegn (+ = højrekurve), dvs. k = −1/R.
 */
import type { Element } from './projekt';
import type { GeoData } from './landxml';

export interface HSeg {
  type: 'ret' | 'kurve' | 'overgang' | 'polylinje';
  /** Afstand langs linjeføringen ved start og længde [m] */
  d0: number; L: number;
  /** Stationering ved start [m] */
  s0: number;
  /** Radius med SporKit-fortegn (+ = højre, 0 = uendelig) [m] */
  R0: number; R1: number;
  /** Krumning med matematisk fortegn ved start og slut [1/m] */
  k0: number; k1: number;
  x0: number; y0: number; phi0: number;
  pkt?: [number, number][]; cum?: number[];
}

export interface VSeg {
  type: 'ret' | 'parabel' | 'cirkel';
  d0: number;
  /** Vandret længde [m] */
  L: number;
  z0: number; g0: number; g1: number;
  /** Afrundingsradius med fortegn (+ = lavning/konkav, − = top/konveks, 0 = ret) [m] */
  R: number;
}

export interface CantPkt { d: number; h: number; side: 1 | -1 | 0 }

export interface Linjefoering {
  navn: string;
  h: HSeg[];
  v: VSeg[];
  cant: CantPkt[];
  laengde: number;
  koordinater: boolean;
  harProfil: boolean;
  harCant: boolean;
  /** Største afvigelse mellem beregnede og angivne slutpunkter [m] */
  maksAfvigelse: number;
  epsg?: string;
  advarsler: string[];
}

export interface HPunkt { x: number; y: number; phi: number; k: number; i: number }

/** Punkt på et vandret segment i lokal afstand t (0 ≤ t ≤ L). */
export function segPunkt(s: HSeg, t: number): Omit<HPunkt, 'i'> {
  if (s.type === 'polylinje' && s.pkt && s.cum && s.pkt.length > 1) {
    const c = s.cum;
    let j = 1;
    while (j < c.length - 1 && c[j] < t) j++;
    const a = s.pkt[j - 1], b = s.pkt[j];
    const l = c[j] - c[j - 1] || 1e-9, f = Math.max(0, Math.min(1, (t - c[j - 1]) / l));
    return { x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f, phi: Math.atan2(b[1] - a[1], b[0] - a[0]), k: 0 };
  }
  const { k0, k1, L, x0, y0, phi0 } = s;
  const dk = L > 0 ? (k1 - k0) / L : 0;
  const phi = phi0 + k0 * t + 0.5 * dk * t * t;
  const k = k0 + dk * t;
  if (Math.abs(dk) < 1e-14) {
    if (Math.abs(k0) < 1e-12) return { x: x0 + t * Math.cos(phi0), y: y0 + t * Math.sin(phi0), phi, k };
    return { x: x0 + (Math.sin(phi) - Math.sin(phi0)) / k0, y: y0 - (Math.cos(phi) - Math.cos(phi0)) / k0, phi, k };
  }
  // Klotoide: Simpsons regel med højst 1 m mellem knudepunkter
  const n = Math.max(8, 2 * Math.ceil(t / 2));
  const hh = t / n;
  let sx = 0, sy = 0;
  for (let i = 0; i <= n; i++) {
    const tt = i * hh;
    const p = phi0 + k0 * tt + 0.5 * dk * tt * tt;
    const w = i === 0 || i === n ? 1 : i % 2 ? 4 : 2;
    sx += w * Math.cos(p); sy += w * Math.sin(p);
  }
  return { x: x0 + (sx * hh) / 3, y: y0 + (sy * hh) / 3, phi, k };
}

function findSeg<T extends { d0: number; L: number }>(arr: T[], d: number): number {
  if (!arr.length) return -1;
  let lo = 0, hi = arr.length - 1;
  while (lo < hi) {
    const m = (lo + hi + 1) >> 1;
    if (arr[m].d0 <= d + 1e-9) lo = m; else hi = m - 1;
  }
  return lo;
}

export function hPunkt(lf: Linjefoering, d: number): HPunkt {
  const i = findSeg(lf.h, d);
  const s = lf.h[i];
  const t = d - s.d0;
  if (t > s.L) {
    // ud over sidste element: forlæng ret
    const e = segPunkt(s, s.L);
    const r = t - s.L;
    return { x: e.x + r * Math.cos(e.phi), y: e.y + r * Math.sin(e.phi), phi: e.phi, k: 0, i };
  }
  if (t < 0) {
    const e = segPunkt(s, 0);
    return { x: e.x + t * Math.cos(e.phi), y: e.y + t * Math.sin(e.phi), phi: e.phi, k: 0, i };
  }
  return { ...segPunkt(s, t), i };
}

/** Kote, hældning og afrundingsradius (med fortegn) i afstanden d. */
export function vPunkt(lf: Linjefoering, d: number): { z: number; g: number; Rv: number } {
  if (!lf.v.length) return { z: 0, g: 0, Rv: 0 };
  const i = findSeg(lf.v, d);
  const s = lf.v[i];
  let t = d - s.d0;
  if (i === 0 && t < 0) return { z: s.z0 + s.g0 * t, g: s.g0, Rv: 0 };
  if (t > s.L) {
    const e = vLokal(s, s.L);
    return { z: e.z + s.g1 * (t - s.L), g: s.g1, Rv: 0 };
  }
  t = Math.max(0, t);
  return vLokal(s, t);
}

function vLokal(s: VSeg, t: number): { z: number; g: number; Rv: number } {
  if (s.type === 'parabel') {
    return { z: s.z0 + s.g0 * t + ((s.g1 - s.g0) * t * t) / (2 * s.L), g: s.g0 + ((s.g1 - s.g0) * t) / s.L, Rv: s.R };
  }
  if (s.type === 'cirkel') {
    const R = Math.abs(s.R), th0 = Math.atan(s.g0);
    const sag = s.g1 > s.g0;
    const sc = sag ? -R * Math.sin(th0) : R * Math.sin(th0);
    const zc = sag ? s.z0 + R * Math.cos(th0) : s.z0 - R * Math.cos(th0);
    const u = t - sc, w = Math.sqrt(Math.max(1e-12, R * R - u * u));
    return sag ? { z: zc - w, g: u / w, Rv: s.R } : { z: zc + w, g: -u / w, Rv: s.R };
  }
  return { z: s.z0 + s.g0 * t, g: s.g0, Rv: 0 };
}

/** Overhøjde [mm] og kurvens yderside (+1 = højre, −1 = venstre, set i stationeringsretningen). */
export function cantVed(lf: Linjefoering, d: number): { h: number; side: 1 | -1 } {
  const c = lf.cant;
  const sideK = (): 1 | -1 => {
    const p = hPunkt(lf, d);
    let k = p.k;
    if (Math.abs(k) < 1e-9) { const s = lf.h[p.i]; k = Math.abs(s.k1) > Math.abs(s.k0) ? s.k1 : s.k0; }
    if (Math.abs(k) < 1e-9) {
      // ret spor med overhøjde (sjældent): brug nærmeste kurve
      for (let j = 1; j < 4; j++) {
        const a = lf.h[p.i + j], b = lf.h[p.i - j];
        const ka = a ? (Math.abs(a.k0) > Math.abs(a.k1) ? a.k0 : a.k1) : 0, kb = b ? (Math.abs(b.k0) > Math.abs(b.k1) ? b.k0 : b.k1) : 0;
        if (Math.abs(ka) > 1e-9) { k = ka; break; }
        if (Math.abs(kb) > 1e-9) { k = kb; break; }
      }
    }
    return k > 0 ? 1 : -1;
  };
  if (!c.length) return { h: 0, side: sideK() };
  if (d <= c[0].d) return { h: c[0].h, side: c[0].side || sideK() };
  let lo = 0, hi = c.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (c[m].d <= d) lo = m; else hi = m; }
  if (d >= c[c.length - 1].d) return { h: c[c.length - 1].h, side: c[c.length - 1].side || sideK() };
  const a = c[lo], b = c[hi];
  const f = (d - a.d) / (b.d - a.d || 1e-9);
  const h = a.h + (b.h - a.h) * f;
  const side = (a.h >= b.h ? a.side || b.side : b.side || a.side) || sideK();
  return { h, side };
}

export function stationVed(lf: Linjefoering, d: number): number {
  const s = lf.h[findSeg(lf.h, d)];
  return s.s0 + (d - s.d0);
}

export function dVed(lf: Linjefoering, st: number): number {
  for (const s of lf.h) if (st >= s.s0 - 1e-6 && st <= s.s0 + s.L + 1e-6) return s.d0 + (st - s.s0);
  const f = lf.h[0], l = lf.h[lf.h.length - 1];
  return st < f.s0 ? f.d0 + (st - f.s0) : l.d0 + (st - l.s0);
}

const kM = (R: number) => (R ? -1 / R : 0);

/* ------------------------------ opbygning ------------------------------ */

interface PVI { d: number; z: number; L?: number; R?: number; type?: 'parabel' | 'cirkel' }

/** Længdeprofil fra PVI'er (første og sidste er endepunkter). */
export function byggLodret(pv: PVI[], adv: string[] = []): VSeg[] {
  const n = pv.length;
  if (n < 2) return [];
  const g: number[] = [];
  for (let i = 0; i < n - 1; i++) g[i] = (pv[i + 1].z - pv[i].z) / Math.max(1e-9, pv[i + 1].d - pv[i].d);
  const tB: number[] = new Array(n).fill(0), tE: number[] = new Array(n).fill(0);
  const type: ('parabel' | 'cirkel' | null)[] = new Array(n).fill(null);
  for (let i = 1; i < n - 1; i++) {
    const p = pv[i], g0 = g[i - 1], g1 = g[i];
    if (Math.abs(g1 - g0) < 1e-9) continue;
    if (p.type === 'cirkel' && p.R && p.R > 0) {
      const t0 = Math.atan(g0), t1 = Math.atan(g1), T = p.R * Math.tan(Math.abs(t1 - t0) / 2);
      tB[i] = T * Math.cos(t0); tE[i] = T * Math.cos(t1); type[i] = 'cirkel';
    } else if (p.L && p.L > 0) { tB[i] = tE[i] = p.L / 2; type[i] = 'parabel'; }
  }
  // Overlappende afrundingskurver: skalér ned
  const f: number[] = new Array(n).fill(1);
  for (let i = 0; i < n - 1; i++) {
    const avail = pv[i + 1].d - pv[i].d, need = tE[i] + tB[i + 1];
    if (need > avail + 1e-6) {
      const s = avail / need;
      if (type[i]) f[i] = Math.min(f[i], s);
      if (type[i + 1]) f[i + 1] = Math.min(f[i + 1], s);
    }
  }
  for (let i = 1; i < n - 1; i++) if (type[i] && f[i] < 1) {
    tB[i] *= f[i]; tE[i] *= f[i];
    adv.push(`Afrundingskurven ved station-PVI ${pv[i].d.toFixed(1)} overlapper nabokurven og er gjort ${(100 * (1 - f[i])).toFixed(0)} % kortere.`);
  }
  const out: VSeg[] = [];
  let dP = pv[0].d, zP = pv[0].z;
  for (let i = 1; i < n - 1; i++) {
    const g0 = g[i - 1], g1 = g[i];
    if (!type[i]) {
      if (pv[i].d > dP + 1e-9) out.push({ type: 'ret', d0: dP, L: pv[i].d - dP, z0: zP, g0, g1: g0, R: 0 });
      dP = pv[i].d; zP = pv[i].z;
      continue;
    }
    const dB = pv[i].d - tB[i], zB = pv[i].z - g0 * tB[i];
    if (dB > dP + 1e-6) out.push({ type: 'ret', d0: dP, L: dB - dP, z0: zP, g0, g1: g0, R: 0 });
    const L = tB[i] + tE[i];
    const R = type[i] === 'cirkel'
      ? Math.sign(g1 - g0) * (L / Math.abs(Math.sin(Math.atan(g1)) - Math.sin(Math.atan(g0))))
      : L / (g1 - g0);
    out.push({ type: type[i]!, d0: dB, L, z0: zB, g0, g1, R });
    dP = pv[i].d + tE[i]; zP = pv[i].z + g1 * tE[i];
  }
  const gl = g[n - 2];
  if (pv[n - 1].d > dP + 1e-9) out.push({ type: 'ret', d0: dP, L: pv[n - 1].d - dP, z0: zP, g0: gl, g1: gl, R: 0 });
  return out;
}

/** Opbyg linjeføringen fra LandXML-geodata (koordinater) eller – uden – fra elementlisten (lokalt). */
export function byggLinjefoering(navn: string, elementer: Element[], geo?: GeoData): Linjefoering {
  const adv: string[] = [];
  const h: HSeg[] = [];
  let x = 0, y = 0, phi = 0, d = 0, maksAfv = 0;
  const kilde = geo?.vandret.length ? geo.vandret : elementer.map((e) => ({ type: e.type, s0: e.km0, L: e.L, R0: e.R0, R1: e.R1 } as GeoData['vandret'][number]));
  if (!geo?.koordinater) adv.push('Linjeføringen har ingen koordinater: modellen opbygges lokalt fra (0, 0) med retning mod øst.');
  kilde.forEach((g, i) => {
    let x0 = x, y0 = y, phi0 = phi;
    if (g.P0) {
      if (i > 0) {
        const a = Math.hypot(g.P0[0] - x, g.P0[1] - y);
        maksAfv = Math.max(maksAfv, a);
      }
      x0 = g.P0[0]; y0 = g.P0[1];
    }
    if (g.phi0 !== undefined) phi0 = g.phi0;
    else if (i === 0 && g.P0) {
      // startretning ukendt: ret mod næste elements startpunkt
      const nx = kilde.find((q, j) => j > 0 && q.P0);
      if (nx?.P0) phi0 = Math.atan2(nx.P0[1] - y0, nx.P0[0] - x0);
    }
    const s: HSeg = { type: g.type, d0: d, L: Math.max(0, g.L), s0: g.s0, R0: g.R0, R1: g.R1, k0: kM(g.R0), k1: kM(g.R1), x0, y0, phi0 };
    if (g.type === 'polylinje' && g.pkt && g.pkt.length > 1) {
      s.pkt = g.pkt;
      s.cum = [0];
      for (let j = 1; j < g.pkt.length; j++) s.cum.push(s.cum[j - 1] + Math.hypot(g.pkt[j][0] - g.pkt[j - 1][0], g.pkt[j][1] - g.pkt[j - 1][1]));
      s.L = s.cum[s.cum.length - 1];
    }
    const e = segPunkt(s, s.L);
    if (g.P1) maksAfv = Math.max(maksAfv, Math.hypot(g.P1[0] - e.x, g.P1[1] - e.y));
    h.push(s);
    x = e.x; y = e.y; phi = e.phi; d += s.L;
  });
  if (maksAfv > 0.01) adv.push(`De beregnede elementendepunkter afviger op til ${(maksAfv * 1000).toFixed(0)} mm fra filens koordinater – kontrollér længder, radier og spiraltype.`);
  if (!h.length) throw new Error('Linjeføringen har ingen elementer.');
  const lf: Linjefoering = { navn, h, v: [], cant: [], laengde: d, koordinater: !!geo?.koordinater, harProfil: false, harCant: false, maksAfvigelse: maksAfv, epsg: geo?.epsg, advarsler: adv };

  // Længdeprofil
  if (geo?.lodret && geo.lodret.length >= 2) {
    const pv = geo.lodret.map((p) => ({ ...p, d: dVed(lf, p.s) }));
    lf.v = byggLodret(pv, adv);
    lf.harProfil = lf.v.length > 0;
    const v0 = pv[0].d, v1 = pv[pv.length - 1].d;
    if (v0 > 0.5 || v1 < d - 0.5) adv.push('Længdeprofilet dækker ikke hele linjeføringen – koten er forlænget med endehældningen.');
  } else adv.push('Intet længdeprofil – sporet ligger vandret i kote 0.');

  // Overhøjde
  if (geo?.cant?.length) {
    lf.cant = geo.cant.map((c) => ({ d: dVed(lf, c.s), h: c.h, side: c.side ?? 0 }));
  } else {
    const pk: CantPkt[] = [];
    let dd = 0;
    elementer.forEach((e) => {
      const R = e.R1 || e.R0;
      const side: 1 | -1 | 0 = R > 0 ? -1 : R < 0 ? 1 : 0;
      if (e.h0 || e.h1 || pk.length) {
        pk.push({ d: dd, h: e.h0, side }, { d: dd + e.L, h: e.h1, side });
      }
      dd += e.L;
    });
    lf.cant = pk;
  }
  lf.cant.sort((a, b) => a.d - b.d);
  lf.harCant = lf.cant.some((c) => c.h > 0);
  return lf;
}

/**
 * Stationer (afstande d) til tværsnit: højst «trin» meter imellem, tættere i små radier
 * (pilhøjde ≤ tol), og altid i elementgrænser og de ekstra punkter (fx afrundingskurvers ender).
 */
export function snitStationer(lf: Linjefoering, d0: number, d1: number, trin: number, ekstra: number[] = [], tol = 0.005): number[] {
  const knuder = new Set<number>([d0, d1]);
  for (const s of lf.h) { knuder.add(s.d0); knuder.add(s.d0 + s.L); }
  for (const s of lf.v) { knuder.add(s.d0); knuder.add(s.d0 + s.L); }
  for (const c of lf.cant) knuder.add(c.d);
  for (const e of ekstra) knuder.add(e);
  const k = [...knuder].filter((x) => x >= d0 - 1e-9 && x <= d1 + 1e-9).sort((a, b) => a - b);
  const out: number[] = [];
  for (let i = 0; i < k.length; i++) {
    const a = k[i];
    if (out.length && a - out[out.length - 1] < 0.05) { if (i === k.length - 1) out[out.length - 1] = a; continue; }
    out.push(a);
    if (i === k.length - 1) break;
    const b = k[i + 1];
    const kk = Math.max(Math.abs(hPunkt(lf, (a + b) / 2).k), Math.abs(hPunkt(lf, a + 1e-6).k), Math.abs(hPunkt(lf, b - 1e-6).k));
    const maxTrin = kk > 1e-9 ? Math.min(trin, Math.sqrt((8 * tol) / kk)) : trin;
    const n = Math.ceil((b - a) / maxTrin - 1e-9);
    for (let j = 1; j < n; j++) out.push(a + ((b - a) * j) / n);
  }
  return out;
}

/** Længdeprofilet klippet til [a, b] (afstand langs linjeføringen). */
export function klipLodret(vs: VSeg[], a: number, b: number): VSeg[] {
  const out: VSeg[] = [];
  for (const s of vs) {
    const t0 = Math.max(0, a - s.d0), t1 = Math.min(s.L, b - s.d0);
    if (t1 - t0 < 1e-6) continue;
    if (t0 < 1e-9 && t1 > s.L - 1e-9) { out.push(s); continue; }
    const p0 = vLokal(s, t0), p1 = vLokal(s, t1);
    out.push({ type: s.type, d0: s.d0 + t0, L: t1 - t0, z0: p0.z, g0: p0.g, g1: s.type === 'ret' ? p0.g : p1.g, R: s.R });
  }
  return out;
}

/** Kote, hældning og krumning i lokal afstand t på et lodret segment. */
export function vSegPunkt(s: VSeg, t: number): { z: number; g: number; Rv: number } {
  return vLokal(s, t);
}
