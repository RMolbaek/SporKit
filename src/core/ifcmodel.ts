/**
 * 3D-model af sporet langs linjeføringen: fritrumsprofil (BN1-166-1) med breddeforøgelse e (afsnit 12),
 * højdeændring ΔhRv (afsnit 13) og vedligeholdelsestillæg (afsnit 10.4) – drejet med overhøjden om den
 * indvendige skinne – samt skinner, ballast og underballast (BN1-6-7) og evt. sveller og dæmning.
 *
 * Tværsnit: a = afstand fra spormidte i sporplanet (+ = højre i stationeringsretningen), b = højde over SO-plan.
 * Linjeføringens kote er SO for den indvendige skinne (sporet drejes om den).
 */
import { breddeforoegelse, hoejdeaendring, profilMedTillaeg, VEDLIGEHOLDELSESTILLAEG, type ProfilNavn } from './fritrum';
import { sporudvidelse } from './rules';
import { forhoejetSkulder, geometri, kolonne, pbTillaeg, pbTillaegGaelder, SVELLE_DATA, type Fald, type Projekt as BnProjekt, type Svelletype } from './bn16';
import { cantVed, hPunkt, snitStationer, stationVed, vPunkt, type Linjefoering } from './linjefoering';

export type Del = 'fritrum' | 'skinne' | 'ballast' | 'underballast' | 'daemning' | 'sveller';

export const DEL_TEKST: Record<Del, string> = {
  fritrum: 'Fritrumsprofil', skinne: 'Skinne', ballast: 'Ballast', underballast: 'Underballast', daemning: 'Dæmning', sveller: 'Sveller',
};

export interface Bn16Valg {
  Bsk: number; a: number; Bt: number; Ut: number; Pb: number; Xp: number; Xrp: number; as: number; daemning: number;
  fald: Fald; projekt: BnProjekt; sidespor: boolean; svelle: Svelletype; L: number; ls60: boolean; V: number;
}

export const BN16_STANDARD: Bn16Valg = {
  Bsk: 0.4, a: 1.5, Bt: 0.3, Ut: 0.25, Pb: 3.8, Xp: 40, Xrp: 40, as: 1.5, daemning: 1.0,
  fald: 'hoejre', projekt: 'nyanlaeg', sidespor: false, svelle: 'S99', L: 2500, ls60: true, V: 160,
};

export interface ModelValg {
  /** Afstand langs linjeføringen [m] */
  d0: number; d1: number;
  /** Største afstand mellem tværsnit [m] */
  trin: number;
  profil: ProfilNavn;
  tillaeg: 'ballast' | 'fast' | 'ingen';
  bredde: boolean;
  hoejde: boolean;
  overhoejde: boolean;
  /** Nedrunding til 0 tilladt (e ved R ≥ 300 m, ΔhRv ved Rv ≥ 10.000 m) */
  afrundE: boolean; afrundRv: boolean;
  skinner: boolean; ballast: boolean; sveller: boolean; daemning: boolean;
  bn16: Bn16Valg;
  /** Største længde pr. objekt [m] */
  maxObjekt: number;
  /** Lokalt nulpunkt [østlig, nordlig, kote] – trækkes fra alle koordinater */
  origo: [number, number, number];
  /** Gem fritrumsprofilet pr. snit som 3D-ringe (til forhåndsvisning) */
  ringe?: boolean;
}

export interface Egenskab { v: number | string; t: 'L' | 'R' | 'T' | 'I' }

export interface Objekt {
  del: Del;
  navn: string;
  d0: number; d1: number; km0: number; km1: number;
  /** Punkter (x, y, z) i lokale koordinater [m] */
  pts: number[];
  /** Trekanter (0-baserede punktindeks) */
  tri: number[];
  /** Ét lukket legeme (ellers flere legemer eller åben flade) */
  lukket: boolean;
  egenskaber: Record<string, Egenskab>;
}

export interface Snit { d: number; km: number; x: number; y: number; z: number; phi: number; h: number; side: 1 | -1; e: number; dhRv: number; R: number; Rv: number }

export interface Model {
  objekter: Objekt[];
  snit: Snit[];
  /** Spormidte i SO-kote (udrejet) for hele linjeføringen [lokale koordinater] */
  akse: [number, number, number][];
  origo: [number, number, number];
  /** Fritrumsprofil pr. snit i lokale koordinater (kun med valg.ringe) */
  ringe?: [number, number, number][][];
  advarsler: string[];
}

/* ----------------------------- BN1-166 langs sporet ----------------------------- */

const RC = 0.7535;

function eAfR(R: number, afrund: boolean, adv?: Set<string>): number {
  if (!R) return 0;
  const a = Math.abs(R);
  const v = breddeforoegelse(a, afrund);
  if (v === null) {
    adv?.add(`R = ${a.toFixed(0)} m < 150 m kræver dispensation (BN1-166-1 afsnit 12); e er beregnet med formel 12.2 og skal eftervises efter EN 15273.`);
    return 60000 / a - 225;
  }
  return v;
}

/** Breddeforøgelse e [mm] i afstanden d – figur 12-2 … 12-7. */
export function eVed(lf: Linjefoering, d: number, afrund = true, adv?: Set<string>): number {
  const p = hPunkt(lf, d);
  const base = (i: number, dd: number): number => {
    const s = lf.h[i];
    if (!s) return 0;
    if (s.type === 'kurve') return eAfR(s.R0, afrund, adv);
    if (s.type === 'overgang') {
      const t = Math.max(0, Math.min(1, (dd - s.d0) / (s.L || 1)));
      return eAfR(s.R0, afrund, adv) + (eAfR(s.R1, afrund, adv) - eAfR(s.R0, afrund, adv)) * t;
    }
    return 0;
  };
  let b0 = base(p.i, d);
  // I et fælles tangentpunkt gælder det største tillæg (fig. 12-4): medtag også elementet, der slutter her
  const forrige = lf.h[p.i - 1];
  if (forrige && Math.abs(forrige.d0 + forrige.L - d) < 1e-6) b0 = Math.max(b0, base(p.i - 1, d));
  let e = b0;
  // Kurver med R ≤ 250 m uden overgangskurve: lineært fra 12 m før til fuld værdi 2 m før BP (fig. 12-3 og 12-5)
  // (alle kurver inden for 12 m – også når der ligger flere korte elementer imellem)
  for (let j = 0; j < lf.h.length; j++) {
    const s = lf.h[j];
    if (s.d0 - 12 > d || s.d0 + s.L + 12 < d) continue;
    if (s.type !== 'kurve' || Math.abs(s.R0) > 250) continue;
    const ej = eAfR(s.R0, afrund);
    if (ej <= 0) continue;
    const foer = lf.h[j - 1], efter = lf.h[j + 1];
    if (!foer || foer.type !== 'overgang') {
      const x = d - s.d0;
      if (x >= -12 && x < 0) e = Math.max(e, x >= -2 ? ej : b0 + ((ej - b0) * (x + 12)) / 10);
    }
    if (!efter || efter.type !== 'overgang') {
      const x = d - (s.d0 + s.L);
      if (x >= 0 && x <= 12) e = Math.max(e, x <= 2 ? ej : b0 + ((ej - b0) * (12 - x)) / 10);
    }
  }
  return e;
}

/**
 * Sporudvidelse [mm] i afstanden d (Sporregler 2.12.2): fuld ved cirkelbuens startpunkt, jævnt over overgangskurven;
 * uden overgangskurve etableret med 2,5 mm pr. 5 sveller (5 × 0,6 m) før buen. Profilmidten ligger midt i det udvidede
 * spor (BN1-166-1 5.33), så hver skinne flyttes det halve udad.
 */
export function sporudvidelseVed(lf: Linjefoering, d: number): number {
  const p = hPunkt(lf, d);
  const af = (R: number) => sporudvidelse(Math.abs(R));
  const s0 = lf.h[p.i];
  let u = s0.type === 'kurve' ? af(s0.R0) : s0.type === 'overgang' ? af(s0.R0) + (af(s0.R1) - af(s0.R0)) * Math.max(0, Math.min(1, (d - s0.d0) / (s0.L || 1))) : 0;
  for (const s of lf.h) {
    if (s.type !== 'kurve') continue;
    const us = af(s.R0);
    if (!us) continue;
    const L = (us / 2.5) * 3; // 2,5 mm pr. 5 sveller à 0,6 m
    if (s.d0 - L > d || s.d0 + s.L + L < d) continue;
    const i = lf.h.indexOf(s), foer = lf.h[i - 1], efter = lf.h[i + 1];
    if (d >= s.d0 && d <= s.d0 + s.L) u = Math.max(u, us);
    else if (d < s.d0 && (!foer || foer.type !== 'overgang')) u = Math.max(u, us * (1 - (s.d0 - d) / L));
    else if (d > s.d0 + s.L && (!efter || efter.type !== 'overgang')) u = Math.max(u, us * (1 - (d - s.d0 - s.L) / L));
  }
  return u;
}

/** Højdeændring ΔhRv [mm] i afstanden d – afsnit 13: lineært fra 25 m før tangentpunktet til fuld værdi i kurven. */
export function dhRvVed(lf: Linjefoering, d: number, afrund = true, adv?: Set<string>): number {
  let m = 0;
  for (const s of lf.v) {
    if (s.type === 'ret' || !s.R) continue;
    const Rv = Math.abs(s.R);
    let dh = hoejdeaendring(Rv, afrund);
    if (dh === null) {
      adv?.add(`Rv = ${Rv.toFixed(0)} m < 500 m kræver dispensation (BN1-166-1 afsnit 13); ΔhRv er beregnet med formel 13.1.`);
      dh = 50000 / Rv;
    }
    if (dh <= 0) continue;
    const a = s.d0, b = s.d0 + s.L;
    let v = 0;
    if (d >= a && d <= b) v = dh;
    else if (d < a && d >= a - 25) v = (dh * (d - (a - 25))) / 25;
    else if (d > b && d <= b + 25) v = dh * (1 - (d - b) / 25);
    m = Math.max(m, v);
  }
  return m;
}

/* ----------------------------- tværsnit ----------------------------- */

/** Forenklet 60E2-skinne [mm] om skinnetoppens midte (b = 0 i SO, nedad negativ), mod uret. */
const SKINNE_HALV: [number, number][] = [[75, -172], [75, -160.5], [30, -152], [8.25, -140], [8.25, -55], [30, -47], [36, -37], [36, 0]];
const SKINNE: [number, number][] = [...SKINNE_HALV, ...SKINNE_HALV.slice().reverse().map(([x, y]) => [-x, y] as [number, number])];
const SKINNEHAELDNING = Math.atan(1 / 40);

type P2 = [number, number];

/** Sporplan (a, b) → vandret/lodret (u, w) med overhøjden h [mm] og ydersiden side, drejet om den indvendige skinne. */
function drej(a: number, b: number, h: number, side: 1 | -1): P2 {
  if (!h) return [a, b];
  const psi = side * Math.asin(Math.min(0.2, h / 1500));
  const pu = -side * RC;
  const c = Math.cos(psi), s = Math.sin(psi);
  return [pu + (a - pu) * c - b * s, (a - pu) * s + b * c];
}

const signArea = (q: P2[]) => { let s = 0; for (let i = 0; i < q.length; i++) { const a = q[i], b = q[(i + 1) % q.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };

/** Fritrumspolygon i sporplanet [m], mod uret: højre side nedefra og op, derefter venstre side oppefra og ned. */
function fritrumPolygon(navn: ProfilNavn, e: number, dhRv: number, vandret: number, lodret: number): P2[] {
  const halv = profilMedTillaeg(navn, { e, dhRv, vandret, lodret });
  const hojre = halv.map(([x, z]) => [x / 1000, z / 1000] as P2);
  const venstre = halv.slice().reverse().filter(([x]) => x !== 0).map(([x, z]) => [-x / 1000, z / 1000] as P2);
  return [...hojre, ...venstre];
}

/* ----------------------------- mesh ----------------------------- */

interface MeshBygger { pts: number[]; tri: number[] }

/** Ear clipping af en enkel polygon (indeks i polygonen) – mod uret. */
export function triangulerPolygon(q: P2[]): [number, number, number][] {
  const idx = q.map((_, i) => i);
  const out: [number, number, number][] = [];
  const kryds = (a: P2, b: P2, c: P2) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const inde = (p: P2, a: P2, b: P2, c: P2) => kryds(a, b, p) >= -1e-12 && kryds(b, c, p) >= -1e-12 && kryds(c, a, p) >= -1e-12;
  // Kollineære punkter bevares (de bruges af sidefladerne); de klippes først, når et nabopunkt er væk.
  let vagt = 0, tolerant = false;
  while (idx.length > 3 && vagt++ < 100000) {
    let fundet = false;
    for (let k = 0; k < idx.length; k++) {
      const i0 = idx[(k + idx.length - 1) % idx.length], i1 = idx[k], i2 = idx[(k + 1) % idx.length];
      const a = q[i0], b = q[i1], c = q[i2];
      const kr = kryds(a, b, c);
      if (kr <= (tolerant ? -1e-12 : 1e-12)) continue;
      let tom = true;
      if (!tolerant) for (const j of idx) { if (j === i0 || j === i1 || j === i2) continue; if (inde(q[j], a, b, c)) { tom = false; break; } }
      if (!tom) continue;
      out.push([i0, i1, i2]);
      idx.splice(k, 1);
      fundet = true;
      break;
    }
    if (!fundet) { if (tolerant) break; tolerant = true; }
  }
  if (idx.length === 3) out.push([idx[0], idx[1], idx[2]]);
  return out;
}

/**
 * Fej en polygon langs stationerne. snit[i] = polygonens punkter (u, w) [m] i lokal tværsnitsramme.
 * Sammenfaldende nabopunkter svejses, så legemet er lukket, også når polygonen udarter.
 */
function fej(m: MeshBygger, ramme: Ramme[], snit: P2[][], laag = true): void {
  const n = snit[0].length;
  const ix: number[][] = [];
  for (let i = 0; i < snit.length; i++) {
    const q = snit[i], r = ramme[i];
    const row: number[] = new Array(n);
    for (let j = 0; j < n; j++) {
      const prev = j > 0 ? q[j - 1] : null;
      if (prev && Math.abs(prev[0] - q[j][0]) < 1e-7 && Math.abs(prev[1] - q[j][1]) < 1e-7) { row[j] = row[j - 1]; continue; }
      row[j] = m.pts.length / 3;
      m.pts.push(r.x + q[j][0] * r.rx, r.y + q[j][0] * r.ry, r.z + q[j][1]);
    }
    if (n > 2 && Math.abs(q[n - 1][0] - q[0][0]) < 1e-7 && Math.abs(q[n - 1][1] - q[0][1]) < 1e-7) row[n - 1] = row[0];
    ix.push(row);
  }
  const t = (a: number, b: number, c: number) => { if (a !== b && b !== c && a !== c) m.tri.push(a, b, c); };
  for (let i = 0; i + 1 < ix.length; i++) {
    const A = ix[i], B = ix[i + 1];
    for (let j = 0; j < n; j++) {
      const j2 = (j + 1) % n;
      // polygonen er mod uret i (u, w); udadvendte normaler kræver denne orden
      t(A[j], B[j2], A[j2]);
      t(A[j], B[j], B[j2]);
    }
  }
  if (!laag) return;
  const cap = (i: number, vend: boolean) => {
    const row = ix[i];
    const unik: number[] = [], qq: P2[] = [];
    for (let j = 0; j < n; j++) if (!unik.includes(row[j])) { unik.push(row[j]); qq.push(snit[i][j]); }
    for (const [a, b, c] of triangulerPolygon(qq)) vend ? t(unik[a], unik[c], unik[b]) : t(unik[a], unik[b], unik[c]);
  };
  cap(0, false);
  cap(ix.length - 1, true);
}

interface Ramme { x: number; y: number; z: number; rx: number; ry: number }

/* ----------------------------- model ----------------------------- */

const km = (s: number) => {
  const k = Math.floor(s / 1000), m = s - k * 1000;
  return `${k}+${m.toFixed(3).padStart(7, '0')}`;
};
export const kmTxt = km;

/** Byg 3D-modellen. */
export function byggModel(lf: Linjefoering, v: ModelValg): Model {
  const advSet = new Set<string>();
  const [ox, oy, oz] = v.origo;
  const d0 = Math.max(0, Math.min(v.d0, v.d1)), d1 = Math.min(lf.laengde, Math.max(v.d0, v.d1));
  if (!(d1 - d0 > 0.1)) throw new Error('Strækningen er for kort – vælg et større km-interval.');

  // Objektgrænser: elementgrænser, delt i stykker på højst maxObjekt
  const graenser = [d0, ...lf.h.map((s) => s.d0).filter((x) => x > d0 + 0.5 && x < d1 - 0.5), d1];
  const objG: number[] = [];
  for (let i = 0; i + 1 < graenser.length; i++) {
    const a = graenser[i], b = graenser[i + 1];
    const n = Math.max(1, Math.ceil((b - a) / Math.max(10, v.maxObjekt)));
    for (let j = 0; j < n; j++) objG.push(a + ((b - a) * j) / n);
  }
  objG.push(d1);
  // Ekstra snit: ramper for e (±2/12 m) og ΔhRv (25 m)
  const ekstra = [...objG];
  for (const s of lf.h) if (s.type === 'kurve' && Math.abs(s.R0) <= 250) ekstra.push(s.d0 - 12, s.d0 - 2, s.d0 + s.L + 2, s.d0 + s.L + 12);
  for (const s of lf.v) if (s.type !== 'ret') ekstra.push(s.d0 - 25, s.d0 + s.L + 25);
  const st = snitStationer(lf, d0, d1, Math.max(0.5, v.trin), ekstra);

  const vt = v.tillaeg === 'ingen' ? { vandret: 0, lodret: 0 } : VEDLIGEHOLDELSESTILLAEG[v.tillaeg];
  const sv = { L: v.bn16.L, H: SVELLE_DATA[v.bn16.svelle].H };
  const kol = kolonne(v.bn16.sidespor, v.bn16.V);
  const medPbTillaeg = pbTillaegGaelder(v.bn16.projekt, kol);

  const snit: Snit[] = [];
  const rammer: Ramme[] = [];
  const fr: P2[][] = [], skV: P2[][] = [], skH: P2[][] = [], bal: P2[][] = [], ub: P2[][] = [], dm: P2[][] = [];
  let pbMaks = 0, skMaks = 0;
  for (const d of st) {
    const p = hPunkt(lf, d), z = vPunkt(lf, d);
    const c = v.overhoejde ? cantVed(lf, d) : { h: 0, side: 1 as const };
    const h = Math.max(0, c.h);
    const e = v.bredde ? eVed(lf, d, v.afrundE, advSet) : 0;
    const dh = v.hoejde ? dhRvVed(lf, d, v.afrundRv, advSet) : 0;
    const R = p.k ? -1 / p.k : 0;
    snit.push({ d, km: stationVed(lf, d), x: p.x, y: p.y, z: z.z, phi: p.phi, h, side: c.side, e, dhRv: dh, R, Rv: z.Rv });
    const r: Ramme = { x: p.x - ox, y: p.y - oy, z: z.z - oz, rx: Math.sin(p.phi), ry: -Math.cos(p.phi) };
    rammer.push(r);
    fr.push(fritrumPolygon(v.profil, e, dh, vt.vandret, vt.lodret).map(([a, b]) => drej(a, b, h, c.side)));
    if (v.skinner) {
      const rail = (cx: number, hael: number): P2[] => SKINNE.map(([a, b]) => {
        const aa = a / 1000, bb = b / 1000;
        const ca = Math.cos(hael), sa = Math.sin(hael);
        return drej(cx + aa * ca - bb * sa, aa * sa + bb * ca, h, c.side);
      });
      const udv = sporudvidelseVed(lf, d) / 2000;
      skV.push(rail(-RC - udv, -SKINNEHAELDNING));
      skH.push(rail(RC + udv, SKINNEHAELDNING));
    }
    if (v.ballast || v.daemning) {
      const b = v.bn16;
      const PbYder = medPbTillaeg ? pbTillaeg(h) : 0;
      const hSk = forhoejetSkulder({ sidespor: b.sidespor, V: b.V, svelle: b.svelle, ls60: b.ls60, R: Math.abs(R) }) ? 0.1 : 0;
      pbMaks = Math.max(pbMaks, PbYder); skMaks = Math.max(skMaks, hSk);
      const g = geometri([{ h, yder: c.side }], {
        Bsk: b.Bsk, a: b.a, Bt: b.Bt, Ut: b.Ut, Pb: b.Pb, PbYder, Xp: b.Xp, Xrp: b.Xrp, hSkulder: hSk, as: b.as, daemning: b.daemning, fs: 4.5, fald: b.fald,
      }, sv);
      const t = g.spor[0];
      const tag = g.fald === 'tag';
      const P = (q: { x: number; y: number }): P2 => [q.x, -q.y];
      const apex: P2 = [g.apexX, -g.planum(g.apexX)];
      // Ballast: planum fra fod til fod, skråning, skulder, svelleoverside (sveller indlejret)
      const top = [g.toeR, t.shR, t.shRtop, t.TR, t.TL, t.shLtop, t.shL, g.toeL].map(P);
      bal.push(tag ? [P(g.toeL), apex, ...top.slice(0, -1)] : [P(g.toeL), ...top.slice(0, -1)]);
      const rApex: P2 = [g.apexX, -g.raajord(g.apexX)];
      const rjL = g.underballast[5], rjR = g.underballast[3];
      ub.push(tag ? [P(rjL), rApex, P(rjR), P(g.crestR), apex, P(g.crestL)] : [P(rjL), P(rjR), P(g.crestR), P(g.crestL)]);
      dm.push(tag ? [P(g.footL), P(g.footR), P(rjR), rApex, P(rjL)] : [P(g.footL), P(g.footR), P(rjR), P(rjL)]);
    }
  }
  // Polygonerne skal være mod uret i (u, w)
  const ccw = (arr: P2[][]) => { if (arr.length && signArea(arr[0]) < 0) arr.forEach((q) => q.reverse()); };
  [fr, skV, skH, bal, ub, dm].forEach(ccw);

  // Objekter pr. stykke
  const snapIdx = (x: number) => { let bi = 0, bd = Infinity; st.forEach((s, i) => { const dd = Math.abs(s - x); if (dd < bd) { bd = dd; bi = i; } }); return bi; };
  const gi = [...new Set(objG.map(snapIdx))].sort((a, b) => a - b);
  const objekter: Objekt[] = [];
  const profTekst = `${v.profil}${v.tillaeg !== 'ingen' ? ` + vedligeholdelsestillæg (${v.tillaeg === 'ballast' ? 'ballastspor' : 'fast spor'})` : ''}`;
  for (let k = 0; k + 1 < gi.length; k++) {
    const a = gi[k], b = gi[k + 1];
    if (b <= a) continue;
    const R_ = rammer.slice(a, b + 1);
    const S_ = snit.slice(a, b + 1);
    const km0 = S_[0].km, km1 = S_[S_.length - 1].km;
    const kmT = `km ${km(km0)}–${km(km1)}`;
    const radier = S_.map((s) => Math.abs(s.R)).filter((x) => x > 0);
    const rvs = S_.map((s) => Math.abs(s.Rv)).filter((x) => x > 0);
    const faelles: Record<string, Egenskab> = {
      'Km fra': { v: km(km0), t: 'T' }, 'Km til': { v: km(km1), t: 'T' },
      'Station fra': { v: km0, t: 'L' }, 'Station til': { v: km1, t: 'L' },
      'Overhøjde maks.': { v: Math.max(...S_.map((s) => s.h)) / 1000, t: 'L' },
    };
    if (radier.length) faelles['Radius min.'] = { v: Math.min(...radier), t: 'L' };
    const ny = (del: Del, navn: string, polys: P2[][], eg: Record<string, Egenskab>) => {
      const m: MeshBygger = { pts: [], tri: [] };
      fej(m, R_, polys.slice(a, b + 1));
      objekter.push({ del, navn: `${navn} · ${kmT}`, d0: st[a], d1: st[b], km0, km1, pts: m.pts, tri: m.tri, lukket: true, egenskaber: { ...faelles, ...eg } });
    };
    const eM = Math.max(...S_.map((s) => s.e)), dhM = Math.max(...S_.map((s) => s.dhRv));
    const frEg: Record<string, Egenskab> = {
      Profil: { v: profTekst, t: 'T' },
      Kilde: { v: 'BN1-166-1 afsnit 10.4, 11.1.1, 12 og 13', t: 'T' },
      'Breddeforøgelse e maks.': { v: eM / 1000, t: 'L' },
      'Højdeændring ΔhRv maks.': { v: dhM / 1000, t: 'L' },
      'Vedligeholdelsestillæg vandret': { v: vt.vandret / 1000, t: 'L' },
      'Vedligeholdelsestillæg lodret': { v: vt.lodret / 1000, t: 'L' },
    };
    if (rvs.length) frEg['Afrundingsradius min.'] = { v: Math.min(...rvs), t: 'L' };
    ny('fritrum', `Fritrum ${v.profil}`, fr, frEg);
    if (v.skinner) {
      const eg: Record<string, Egenskab> = { Skinneprofil: { v: '60E2 (forenklet omrids)', t: 'T' }, Skinnehældning: { v: '1:40', t: 'T' }, 'Sporudvidelse maks.': { v: Math.max(...S_.map((x) => sporudvidelseVed(lf, x.d))) / 1000, t: 'L' } };
      ny('skinne', 'Skinne venstre', skV, eg);
      ny('skinne', 'Skinne højre', skH, eg);
    }
    if (v.ballast) {
      const B = v.bn16;
      ny('ballast', 'Ballast', bal, {
        Kilde: { v: 'BN1-6-7', t: 'T' }, 'Skulderbredde Bsk': { v: B.Bsk, t: 'L' }, 'Skråningsanlæg 1:a': { v: B.a, t: 'R' },
        'Ballasttykkelse Bt': { v: B.Bt, t: 'L' }, 'Planumsbredde Pb': { v: B.Pb, t: 'L' }, 'Pb-tillæg yderside maks.': { v: pbMaks, t: 'L' },
        'Skulderforhøjelse maks.': { v: skMaks, t: 'L' }, Planumsfald: { v: B.fald, t: 'T' }, Svelle: { v: SVELLE_DATA[B.svelle].navn, t: 'T' },
      });
      ny('underballast', 'Underballast', ub, {
        Kilde: { v: 'BN1-6-7', t: 'T' }, 'Underballasttykkelse Ut': { v: B.Ut, t: 'L' }, 'Planumsfald Xp [‰]': { v: B.Xp, t: 'R' }, 'Råjordsfald Xrp [‰]': { v: B.Xrp, t: 'R' },
      });
    }
    if (v.daemning) ny('daemning', 'Dæmning', dm, { 'Dæmningshøjde': { v: v.bn16.daemning, t: 'L' }, 'Skråningsanlæg': { v: v.bn16.as, t: 'R' } });
    if (v.sveller) {
      const m: MeshBygger = { pts: [], tri: [] };
      const Ls = v.bn16.L / 1000, Hs = sv.H / 1000, bredde = 0.26, afst = 0.6, top = -0.182;
      const start = Math.ceil((st[a] + 0.3) / afst) * afst;
      let antal = 0;
      for (let dc = start; dc <= st[b] - 0.3; dc += afst) {
        const hj = [dc - bredde / 2, dc + bredde / 2].map((dd) => {
          const p = hPunkt(lf, dd), z = vPunkt(lf, dd), c = v.overhoejde ? cantVed(lf, dd) : { h: 0, side: 1 as const };
          return { r: { x: p.x - ox, y: p.y - oy, z: z.z - oz, rx: Math.sin(p.phi), ry: -Math.cos(p.phi) }, h: Math.max(0, c.h), side: c.side };
        });
        const kasse = (o: { h: number; side: 1 | -1 }): P2[] => ([[-Ls / 2, top - Hs], [Ls / 2, top - Hs], [Ls / 2, top], [-Ls / 2, top]] as P2[]).map(([aa, bb]) => drej(aa, bb, o.h, o.side));
        fej(m, [hj[0].r, hj[1].r], [kasse(hj[0]), kasse(hj[1])]);
        antal++;
      }
      if (antal) objekter.push({
        del: 'sveller', navn: `Sveller · ${kmT}`, d0: st[a], d1: st[b], km0, km1, pts: m.pts, tri: m.tri, lukket: false,
        egenskaber: { ...faelles, Svelle: { v: SVELLE_DATA[v.bn16.svelle].navn, t: 'T' }, Antal: { v: antal, t: 'I' }, Svelleafstand: { v: afst, t: 'L' } },
      });
    }
  }

  // Aksen for hele linjeføringen (til IfcAnnotation / kontrol)
  const akseSt = snitStationer(lf, 0, lf.laengde, Math.max(1, v.trin));
  const akse = akseSt.map((d) => { const p = hPunkt(lf, d), z = vPunkt(lf, d); return [p.x - ox, p.y - oy, z.z - oz] as [number, number, number]; });
  const ringe = v.ringe ? fr.map((q, i) => q.map(([a, b]) => [rammer[i].x + a * rammer[i].rx, rammer[i].y + a * rammer[i].ry, rammer[i].z + b] as [number, number, number])) : undefined;
  return { objekter, snit, akse, origo: v.origo, ringe, advarsler: [...advSet] };
}

/** Foreslået lokalt nulpunkt: linjeføringens start rundet ned til hele km (kote 0). */
export function foreslaaOrigo(lf: Linjefoering): [number, number, number] {
  if (!lf.koordinater) return [0, 0, 0];
  const p = hPunkt(lf, 0);
  return [Math.floor(p.x / 1000) * 1000, Math.floor(p.y / 1000) * 1000, 0];
}
