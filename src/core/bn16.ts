/**
 * Banenorm BN1-6-7 «Tværprofiler for ballasteret spor» (udgivet 01.04.2023).
 * Krav: figur 15.1-3 (BN2 nyanlæg), figur 12.1-4 (BN2 sporfornyelse) og figur 10.2.3-2 (BN1 minimum).
 * Alle mål i meter, hældninger i ‰.
 */

export type Projekt = 'nyanlaeg' | 'fornyelse' | 'bn1';
export type Svelletype = 'S99' | 'S16' | 'trae' | 'toblok';

export interface Krav {
  Bsk: number; a: number; Bt: number; Ut: number; Pb: number; Xp: number; Xrp: number;
  /** Krævet højde af ballastskulder i kurvens yderside [m] (forhøjet skulder) */
  hYder: number;
  /** Tillæg til Pb i kurvens yderside [m] */
  PbYderTillaeg: number;
  /** Ballast sænkes 40 mm mellem skinnerne */
  saenket: boolean;
  noter: string[];
}

export interface KravInput {
  projekt: Projekt;
  sidespor: boolean;
  V: number;
  A: number;
  svelle: Svelletype;
  /** Svellelængde [mm] */
  L: number;
  /** Langskinnespor med 60 kg/m-skinner */
  ls60: boolean;
  /** Kurveradius [m], 0 = ret spor */
  R: number;
  /** Overhøjde [mm] */
  h: number;
}

export type Kol = 'side' | 'v160' | 'v200' | 'v250';
const T: Record<Projekt, Record<Kol, [number, number, number, number, number]>> = {
  // [Bsk, a, Bt, Ut, Pb]
  nyanlaeg: { side: [0.30, 1.5, 0.25, 0.15, 3.30], v160: [0.40, 1.5, 0.30, 0.25, 3.80], v200: [0.55, 1.5, 0.35, 0.40, 3.80], v250: [0.50, 1.5, 0.35, 0.40, 3.80] },
  fornyelse: { side: [0.30, 1.5, 0.25, 0.15, 3.00], v160: [0.40, 1.5, 0.30, 0.20, 3.00], v200: [0.55, 1.5, 0.30, 0.30, 3.00], v250: [0.50, 1.5, 0.35, 0.30, 3.80] },
  bn1: { side: [0.30, 1.5, 0.25, 0.15, 3.00], v160: [0.40, 1.5, 0.30, 0.15, 3.00], v200: [0.55, 1.5, 0.30, 0.25, 3.00], v250: [0.50, 1.5, 0.35, 0.30, 3.80] },
};

export const PROJEKT_TEKST: Record<Projekt, string> = {
  nyanlaeg: 'Nyanlæg – BN2, figur 15.1-3',
  fornyelse: 'Sporfornyelse – BN2, figur 12.1-4',
  bn1: 'BN1-minimum (kræver tilladelse) – figur 10.2.3-2',
};

export function kolonne(sidespor: boolean, V: number): Kol {
  if (sidespor) return 'side';
  if (V <= 160) return 'v160';
  if (V <= 200) return 'v200';
  return 'v250';
}

/** Kræver forhøjet ballastskulder h = 0,10 m i kurvens yderside (fodnote 7/8/10). */
export function forhoejetSkulder(i: Pick<KravInput, 'sidespor' | 'V' | 'svelle' | 'ls60' | 'R'>): boolean {
  if (i.sidespor || !i.ls60 || i.V > 160 || !(i.R > 0)) return false;
  if (i.svelle === 'S99') return i.R < 400;
  if (i.svelle === 'S16') return i.R < 325;
  if (i.svelle === 'trae') return i.R < 560;
  return false;
}

/** Fodnote 4 (fig. 12.1-4 og 10.2.3-2): tillæg til Pb i kurvens yderside [m] ud fra overhøjden h [mm]. */
export function pbTillaeg(h: number): number {
  if (h > 80) return 0.30; // 85–160 mm (overhøjder angives i 5 mm-trin)
  if (h >= 5) return 0.15;
  return 0;
}

/** Fodnote 4 står ved Pb for sidespor, V ≤ 160 og 160 < V ≤ 200 ved sporfornyelse og BN1 – ikke i nyanlægstabellen (fig. 15.1-3). */
export function pbTillaegGaelder(projekt: Projekt, k: Kol): boolean {
  return projekt !== 'nyanlaeg' && k !== 'v250';
}

export function krav(i: KravInput): Krav {
  const k = kolonne(i.sidespor, i.V);
  let [Bsk, a, Bt, Ut, Pb] = T[i.projekt][k];
  const noter: string[] = [];
  // Bsk ved 160 < V ≤ 200
  if (k === 'v200') {
    if (i.svelle === 'toblok') { Bsk = 0.40; noter.push('To-blok betonsveller: Bsk ≥ 0,40 m.'); }
    else if (i.svelle === 'trae' && i.projekt === 'bn1') { Bsk = 0.50; noter.push('Træsveller: Bsk ≥ 0,50 m (BN1).'); }
  }
  // Pb ved V ≤ 120 (nyanlæg, fodnote 2)
  if (i.projekt === 'nyanlaeg' && k === 'v160' && i.V <= 120) { Pb = 3.30; noter.push('V ≤ 120 km/t: Pb = 3,30 m (fodnote 2).'); }
  // Aksellast > 22,5 t
  if (i.A > 22.5 && (k === 'side' || k === 'v160')) { Ut += 0.07; noter.push('Aksellast 22,5 < A ≤ 25 t: Ut + 0,07 m.'); }
  // Korte betonsveller
  if ((i.svelle === 'S99' || i.svelle === 'S16' || i.svelle === 'toblok') && i.L < 2500) {
    const t = (2500 - i.L) / 2000;
    Ut += t;
    noter.push(`Betonsvelle L = ${i.L} mm < 2500 mm: Ut + (2500 − L)/2 = ${(t * 1000).toFixed(0)} mm.`);
  }
  // Pb i kurvens yderside (fodnote 4 i fig. 12.1-4 og 10.2.3-2; ikke 200 < V ≤ 250 og ikke ved nyanlæg)
  const PbYderTillaeg = pbTillaegGaelder(i.projekt, k) ? pbTillaeg(i.h) : 0;
  if (PbYderTillaeg) noter.push(`Kurvens yderside, h = ${i.h} mm: Pb + ${PbYderTillaeg.toFixed(2).replace('.', ',')} m (fodnote 4) – gælder kun ydersiden.`);
  if (i.h > 160) noter.push(`h = ${i.h} mm ligger over BN1-6-7 fodnote 4's interval (85–160 mm); tillægget 0,30 m er anvendt.`);
  const hYder = forhoejetSkulder(i) ? 0.10 : 0;
  if (hYder) noter.push('Langskinnespor med 60 kg/m-skinner i lille radius: ballastskulderen i kurvens yderside forhøjes til h = 0,10 m.');
  const saenket = !i.sidespor && i.V > 160;
  if (saenket) noter.push('160 < V ≤ 250 km/t: ballasten mellem sveller og skinner sænkes 40 mm under svelleoverkant.');
  return { Bsk, a, Bt, Ut, Pb, Xp: 40, Xrp: 40, hYder, PbYderTillaeg, saenket, noter };
}

/* ------------------------------ geometri ------------------------------ */

export type Fald = 'tag' | 'hoejre' | 'venstre';

export const FALD_TEKST: Record<Fald, string> = {
  tag: 'Tagform – knæk under spormidten',
  hoejre: 'Ensidigt fald mod højre',
  venstre: 'Ensidigt fald mod venstre',
};

/**
 * Er planumsformen tilladt? BN1-6-7 afsnit 10.2.3: «For enkeltsporede baner tillades knækpunkterne i planum og
 * råjordsplanum dog placeret under spormidten» (BN1). Ændringslisten: «Mulighed for knækpunkt af planum under
 * spormidten for enkeltsporede baner er udgået på BN2-niveau»; bilag 1 viser ensidigt fald.
 */
export function faldTilladt(projekt: Projekt, fald: Fald): boolean {
  return fald !== 'tag' || projekt === 'bn1';
}

export interface SporInput {
  /** Overhøjde [mm] */
  h: number;
  /** Kurvens yderside: +1 = højre, −1 = venstre */
  yder: 1 | -1;
}

export interface Parametre {
  Bsk: number; a: number; Bt: number; Ut: number; Pb: number; Xp: number; Xrp: number;
  /** Tillæg til Pb i kurvens yderside [m] – lægges kun på den side, hvor sporets overhøjde vender udad */
  PbYder?: number;
  /** Planumsform ved enkeltspor: 'tag' = knæk under spormidte, 'hoejre'/'venstre' = ensidigt fald mod den side. Dobbeltspor: altid knæk midt mellem sporene. */
  fald?: Fald;
  hSkulder: number;
  /** Baneskråningens anlæg og dæmningshøjde under planumskant [m] */
  as: number; daemning: number;
  /** Sporafstand [m] (kun dobbeltspor) */
  fs: number;
}

export interface Svelle { L: number; H: number }

export const SVELLE_DATA: Record<Svelletype, Svelle & { navn: string }> = {
  S99: { navn: 'S99 (beton, monoblok)', L: 2500, H: 206 },
  S16: { navn: 'S16 (beton, monoblok)', L: 2500, H: 224 },
  trae: { navn: 'Træsvelle 160 × 260', L: 2600, H: 160 },
  toblok: { navn: 'To-blok betonsvelle', L: 2300, H: 200 },
};

type P = { x: number; y: number };

export interface Geometri {
  spor: {
    cx: number; theta: number; pivot: P;
    TL: P; TR: P; BL: P; BR: P; shL: P; shR: P; shLtop: P; shRtop: P;
    btVenstre: number; btHoejre: number; btMin: number;
    railX: [number, number];
  }[];
  planum: (x: number) => number;
  raajord: (x: number) => number;
  apexX: number;
  toeL: P; toeR: P;
  edgeL: P; edgeR: P;
  footL: P; footR: P;
  mellem?: P[];
  /** Ballast-polygon (uden sveller) og underballast-polygon */
  ballast: P[];
  underballast: P[];
  daemning: P[];
  pbbL: number; pbbR: number;
  fald: Fald;
  /** Faktisk Pb (vandret fra spormidte til planumskant) venstre / højre [m] */
  PbL: number; PbR: number;
}

const RAIL_TOP = 0.182; // skinneoverkant over svelleoverkant (172 + 10 mm mellemlæg)
const RC = 0.7535; // skinnemidte fra spormidte

/** Beregner tværprofilets geometri. x [m] vandret, y [m] lodret ned, y = 0 ved inderskinnens SO. */
export function geometri(spor: SporInput[], p: Parametre, sv: Svelle): Geometri {
  const L = sv.L / 1000, Hs = sv.H / 1000;
  const n = spor.length;
  const cxs = n === 2 ? [-p.fs / 2, p.fs / 2] : [0];
  const k = p.Xp / 1000, kr = p.Xrp / 1000;
  const apexX = 0;
  const out: Geometri['spor'] = [];
  for (let i = 0; i < n; i++) {
    const s = spor[i];
    const cx = cxs[i];
    const th = Math.asin(Math.min(0.2, Math.max(0, s.h) / 1500));
    const ang = -s.yder * th; // drejning (SVG-konvention: positiv = med uret)
    const pivot = { x: cx - s.yder * RC, y: 0 }; // inderskinnens SO ligger fast
    const c = Math.cos(ang), sn = Math.sin(ang);
    // lokale koordinater: svelleoverkant y = RAIL_TOP (under SO)
    const rot = (lx: number, ly: number): P => {
      const dx = cx + lx - pivot.x, dy = ly - pivot.y;
      return { x: pivot.x + dx * c - dy * sn, y: pivot.y + dx * sn + dy * c };
    };
    const yTop = RAIL_TOP, yBot = RAIL_TOP + Hs;
    const hL = s.yder === -1 ? p.hSkulder : 0, hR = s.yder === 1 ? p.hSkulder : 0;
    const TL = rot(-L / 2, yTop), TR = rot(L / 2, yTop), BL = rot(-L / 2, yBot), BR = rot(L / 2, yBot);
    const shLtop = rot(-L / 2, yTop - hL), shRtop = rot(L / 2, yTop - hR);
    const shL = rot(-L / 2 - p.Bsk, yTop - hL), shR = rot(L / 2 + p.Bsk, yTop - hR);
    out.push({ cx, theta: ang, pivot, TL, TR, BL, BR, shL, shR, shLtop, shRtop, btVenstre: 0, btHoejre: 0, btMin: 0, railX: [cx - RC, cx + RC] });
  }
  // Planum: knæk midt mellem sporene (eller under spormidte) med fald k udad – eller ensidigt fald ved enkeltspor.
  // Bestem planumshøjden så den mindste ballasttykkelse under en skinnestreng netop er Bt.
  const fald: Fald = n === 1 ? p.fald ?? 'tag' : 'tag';
  const form = (x: number, kk: number) => fald === 'tag' ? kk * Math.abs(x - apexX) : (fald === 'hoejre' ? 1 : -1) * kk * (x - apexX);
  let apexY = -Infinity;
  const sbAt = (t: Geometri['spor'][number], x: number) => {
    // svelleunderside er en ret linje mellem BL og BR
    const f = (x - t.BL.x) / (t.BR.x - t.BL.x);
    return t.BL.y + f * (t.BR.y - t.BL.y);
  };
  for (const t of out) for (const xr of t.railX) apexY = Math.max(apexY, sbAt(t, xr) + p.Bt - form(xr, k));
  const planum = (x: number) => apexY + form(x, k);
  const raajord = (x: number) => apexY + p.Ut + form(x, kr);
  for (const t of out) {
    t.btVenstre = planum(t.railX[0]) - sbAt(t, t.railX[0]);
    t.btHoejre = planum(t.railX[1]) - sbAt(t, t.railX[1]);
    t.btMin = Math.min(t.btVenstre, t.btHoejre);
  }
  // Ballastfod: skråning 1:a fra skulderkant ned til planum
  const toe = (sh: P, dir: 1 | -1): P => {
    // Skæring mellem skråningen y = sh.y + |x − sh.x|/a og planum – løses ved halvering
    const f = (x: number) => sh.y + Math.abs(x - sh.x) / p.a - planum(x);
    let lo = sh.x, hi = sh.x + dir * 20;
    if (f(lo) >= 0) return { x: lo, y: planum(lo) };
    for (let it = 0; it < 80; it++) {
      const mid = (lo + hi) / 2;
      if (f(mid) >= 0) hi = mid; else lo = mid;
    }
    return { x: hi, y: planum(hi) };
  };
  const first = out[0], last = out[out.length - 1];
  const toeL = toe(first.shL, -1), toeR = toe(last.shR, 1);
  // Pb måles vandret fra spormidte; tillægget gælder kun kurvens yderside (det yderste spor på den side har overhøjde udad)
  const yderL = spor[0].yder === -1 && spor[0].h >= 5, yderR = spor[n - 1].yder === 1 && spor[n - 1].h >= 5;
  const PbL = p.Pb + (yderL ? p.PbYder ?? 0 : 0), PbR = p.Pb + (yderR ? p.PbYder ?? 0 : 0);
  const edgeL = { x: first.cx - PbL, y: planum(first.cx - PbL) };
  const edgeR = { x: last.cx + PbR, y: planum(last.cx + PbR) };
  // Mellem sporene: V-formet ballast mellem skuldrene
  let mellem: P[] | undefined;
  if (out.length === 2) {
    const A = out[0].shR, B = out[1].shL;
    // linjer: y = A.y + (x − A.x)/a ; y = B.y + (B.x − x)/a
    let xm = (B.y - A.y + (A.x + B.x) / p.a) / (2 / p.a);
    let ym = A.y + (xm - A.x) / p.a;
    if (ym > planum(xm)) {
      const tA = toe(A, 1), tB = toe(B, -1);
      mellem = [A, tA, tB, B];
    } else {
      xm = Math.max(A.x, Math.min(B.x, xm));
      ym = A.y + (xm - A.x) / p.a;
      mellem = [A, { x: xm, y: ym }, B];
    }
  }
  // Ballastpolygon (overflade + planum), svellerne tegnes ovenpå
  const top: P[] = [];
  out.forEach((t, i) => {
    if (i === 0) top.push(toeL);
    else top.push(...(mellem ?? []).slice(1, -1));
    top.push(t.shL, t.shLtop, t.TL, t.TR, t.shRtop, t.shR);
  });
  top.push(toeR);
  const ballast = [...top, { x: toeR.x, y: planum(toeR.x) }, { x: apexX, y: apexY }, { x: toeL.x, y: planum(toeL.x) }];
  // Underballast mellem planum og råjordsplanum, afsluttet af baneskråningen
  const sl = p.as;
  const rjL = { x: edgeL.x - sl * (raajord(edgeL.x) - edgeL.y), y: 0 }; rjL.y = raajord(rjL.x);
  const rjR = { x: edgeR.x + sl * (raajord(edgeR.x) - edgeR.y), y: 0 }; rjR.y = raajord(rjR.x);
  const underballast = [edgeL, { x: apexX, y: apexY }, edgeR, rjR, { x: apexX, y: apexY + p.Ut }, rjL];
  const footL = { x: edgeL.x - sl * p.daemning, y: edgeL.y + p.daemning };
  const footR = { x: edgeR.x + sl * p.daemning, y: edgeR.y + p.daemning };
  const daemning = [rjL, { x: apexX, y: apexY + p.Ut }, rjR, footR, footL];
  return {
    spor: out, planum, raajord, apexX, toeL, toeR, edgeL, edgeR, footL, footR, mellem,
    ballast, underballast, daemning, pbbL: toeL.x - edgeL.x, pbbR: edgeR.x - toeR.x, PbL, PbR, fald,
  };
}

/** Polygonareal [m²] (shoelace). */
export function areal(poly: P[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}
