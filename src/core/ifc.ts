/**
 * IFC-eksport (ISO 16739, STEP fysisk fil ISO 10303-21) – åben standard fra buildingSMART.
 *
 *  - IFC4X3_ADD2: IfcProject › IfcSite › IfcRailway. IfcAlignment med vandret, lodret og overhøjde
 *    (IfcAlignmentHorizontal/Vertical/Cant) og geometri (IfcCompositeCurve/IfcGradientCurve) samt stationering
 *    (IfcReferent). Fritrum som IfcVirtualElement (CLEARANCE), skinner som IfcRail, ballast som IfcCourse
 *    (BALLASTBED), underballast/dæmning som IfcEarthworksFill, sveller som IfcTrackElement.
 *  - IFC4: IfcProject › IfcSite, elementer som IfcBuildingElementProxy (IfcTriangulatedFaceSet), linjeføringen
 *    som IfcAnnotation (IfcIndexedPolyCurve). Georeference med IfcMapConversion/IfcProjectedCRS.
 *  - IFC2X3: som IFC4, men med IfcFacetedBrep, IfcOwnerHistory og georeference i ePSet_MapConversion.
 */
import { klipLodret, segPunkt, stationVed, vPunkt, vSegPunkt, type HSeg, type Linjefoering, type VSeg } from './linjefoering';
import { kmTxt, type Del, type Egenskab, type Model, type Objekt } from './ifcmodel';

export type IfcSkema = 'IFC4X3_ADD2' | 'IFC4' | 'IFC2X3';

export const SKEMA_TEKST: Record<IfcSkema, string> = {
  IFC4X3_ADD2: 'IFC 4.3 (IFC4X3_ADD2)',
  IFC4: 'IFC4',
  IFC2X3: 'IFC2x3 TC1',
};

export const SKEMA_NOTE: Record<IfcSkema, string> = {
  IFC4X3_ADD2: 'Infrastruktur: IfcAlignment (vandret, lodret, overhøjde), IfcRailway, IfcRail, IfcCourse, fritrum som IfcVirtualElement CLEARANCE.',
  IFC4: 'Trianguleret geometri; linjeføringen som 3D-kurve (IfcAnnotation); elementer som IfcBuildingElementProxy.',
  IFC2X3: 'Til ældre programmer: facetteret B-rep og georeference i ePSet_MapConversion.',
};

export interface Crs { epsg: string; navn: string; datum: string; projektion: string; zone: string; lon0: number; k0: number; FE: number; FN: number }

export const CRS: Record<string, Crs> = {
  '25832': { epsg: '25832', navn: 'ETRS89 / UTM zone 32N', datum: 'ETRS89', projektion: 'UTM', zone: '32N', lon0: 9, k0: 0.9996, FE: 500000, FN: 0 },
  '25833': { epsg: '25833', navn: 'ETRS89 / UTM zone 33N', datum: 'ETRS89', projektion: 'UTM', zone: '33N', lon0: 15, k0: 0.9996, FE: 500000, FN: 0 },
  '4093': { epsg: '4093', navn: 'ETRS89 / DKTM1', datum: 'ETRS89', projektion: 'Transverse Mercator', zone: 'DKTM1', lon0: 9, k0: 0.99998, FE: 200000, FN: -5000000 },
  '4094': { epsg: '4094', navn: 'ETRS89 / DKTM2', datum: 'ETRS89', projektion: 'Transverse Mercator', zone: 'DKTM2', lon0: 10, k0: 0.99998, FE: 400000, FN: -5000000 },
  '4095': { epsg: '4095', navn: 'ETRS89 / DKTM3', datum: 'ETRS89', projektion: 'Transverse Mercator', zone: 'DKTM3', lon0: 11.75, k0: 0.99998, FE: 600000, FN: -5000000 },
  '4096': { epsg: '4096', navn: 'ETRS89 / DKTM4', datum: 'ETRS89', projektion: 'Transverse Mercator', zone: 'DKTM4', lon0: 15, k0: 0.99998, FE: 800000, FN: -5000000 },
};

export interface IfcMeta {
  projekt: string;
  sted?: string;
  forfatter?: string;
  organisation?: string;
  filnavn: string;
  /** EPSG-kode for georeference ('' = ingen) */
  epsg?: string;
  hoejdesystem?: string;
  /** Kilde (fx filnavn på LandXML/spordataliste) */
  kilde?: string;
  tid?: Date;
  /** Frø til deterministiske GlobalId'er (samme projekt → samme id'er) */
  seed: string;
  /** Fritrum i IFC4X3 som IfcVirtualElement (CLEARANCE, standard) eller IfcBuildingElementProxy */
  fritrumKlasse?: 'virtual' | 'proxy';
  version?: string;
}

/* ------------------------------ STEP-primitiver ------------------------------ */

/** STEP-streng: ' fordobles, \ fordobles, alt uden for ASCII kodes som \X2\…\X0\ (UTF-16). */
export function stepStr(s: string): string {
  let out = '';
  let buf: number[] = [];
  const flush = () => {
    if (buf.length) { out += '\\X2\\' + buf.map((c) => c.toString(16).toUpperCase().padStart(4, '0')).join('') + '\\X0\\'; buf = []; }
  };
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (cp >= 32 && cp <= 126) { flush(); out += ch === "'" ? "''" : ch === '\\' ? '\\\\' : ch; }
    else if (cp < 32) { flush(); out += ' '; }
    else if (cp > 0xffff) { flush(); out += '\\X4\\' + cp.toString(16).toUpperCase().padStart(8, '0') + '\\X0\\'; }
    else buf.push(cp);
  }
  flush();
  return `'${out}'`;
}

/** Reelt tal i STEP-format (altid med decimalpunktum). */
export function real(x: number, dec = 6): string {
  if (!Number.isFinite(x) || Math.abs(x) < 0.5 * 10 ** -dec) return '0.';
  return x.toFixed(dec).replace(/0+$/, '');
}

const B64 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';

/** IFC GlobalId (22 tegn) fra 16 bytes – samme kodning som buildingSMART/IfcOpenShell. */
export function ifcGuid(b: Uint8Array): string {
  const enc = (v: number, l: number) => { let s = ''; for (let i = 0; i < l; i++) { s = B64[v % 64] + s; v = Math.floor(v / 64); } return s; };
  let out = enc(b[0], 2);
  for (let i = 1; i < 16; i += 3) out += enc((b[i] << 16) + (b[i + 1] << 8) + b[i + 2], 4);
  return out;
}

/** Deterministisk GlobalId-kilde (FNV-1a-frø og mulberry32). */
export function guidKilde(seed: string): () => string {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  let a = h || 0x9e3779b9;
  const rnd = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
  const brugt = new Set<string>();
  return () => {
    for (;;) {
      const b = new Uint8Array(16);
      for (let i = 0; i < 16; i += 4) { const r = rnd(); b[i] = r >>> 24; b[i + 1] = (r >>> 16) & 255; b[i + 2] = (r >>> 8) & 255; b[i + 3] = r & 255; }
      b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
      const g = ifcGuid(b);
      if (!brugt.has(g)) { brugt.add(g); return g; }
    }
  };
}

class Step {
  private linjer: string[] = [];
  private n = 0;
  add(type: string, ...a: string[]): number {
    const id = ++this.n;
    this.linjer.push(`#${id}=${type}(${a.join(',')});`);
    return id;
  }
  get antal(): number { return this.n; }
  tekst(): string { return this.linjer.join('\n'); }
}

/* ------------------------------ geodæsi ------------------------------ */

/** Transversal Mercator (GRS80) → geografisk bredde/længde [grader]. */
export function tmTilGeo(c: Crs, E: number, N: number): { lat: number; lon: number } {
  const a = 6378137, f = 1 / 298.257222101, e2 = f * (2 - f), ep2 = e2 / (1 - e2);
  const M = (N - c.FN) / c.k0;
  const mu = M / (a * (1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 ** 3) / 256));
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const p1 = mu + ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) + ((21 * e1 * e1) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu)
    + ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) + ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);
  const C1 = ep2 * Math.cos(p1) ** 2, T1 = Math.tan(p1) ** 2;
  const N1 = a / Math.sqrt(1 - e2 * Math.sin(p1) ** 2), R1 = (a * (1 - e2)) / (1 - e2 * Math.sin(p1) ** 2) ** 1.5;
  const D = (E - c.FE) / (N1 * c.k0);
  const lat = p1 - ((N1 * Math.tan(p1)) / R1) * ((D * D) / 2 - ((5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * D ** 4) / 24
    + ((61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) * D ** 6) / 720);
  const lon = (D - ((1 + 2 * T1 + C1) * D ** 3) / 6 + ((5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) * D ** 5) / 120) / Math.cos(p1);
  return { lat: (lat * 180) / Math.PI, lon: c.lon0 + (lon * 180) / Math.PI };
}

/** IfcCompoundPlaneAngleMeasure: (grader, minutter, sekunder, milliontedele sekund). */
function dms(x: number): string {
  const s = x < 0 ? -1 : 1;
  let v = Math.abs(x);
  const g = Math.floor(v); v = (v - g) * 60;
  const m = Math.floor(v); v = (v - m) * 60;
  const sek = Math.floor(v); const mu = Math.round((v - sek) * 1e6);
  return `(${s * g},${s * m},${s * sek},${s * Math.min(999999, mu)})`;
}

/* ------------------------------ udseende ------------------------------ */

export const FARVE: Record<Del, { rgb: [number, number, number]; t: number; navn: string }> = {
  fritrum: { rgb: [0.25, 0.6, 0.95], t: 0.72, navn: 'Fritrum' },
  skinne: { rgb: [0.42, 0.44, 0.48], t: 0, navn: 'Stål' },
  ballast: { rgb: [0.52, 0.5, 0.47], t: 0, navn: 'Skærver' },
  underballast: { rgb: [0.82, 0.71, 0.5], t: 0, navn: 'Grus' },
  daemning: { rgb: [0.5, 0.42, 0.3], t: 0, navn: 'Jord' },
  sveller: { rgb: [0.74, 0.74, 0.72], t: 0, navn: 'Beton' },
};

const OBJEKTTYPE: Record<Del, string> = {
  fritrum: 'Fritrumsprofil (BN1-166-1)', skinne: 'Skinne', ballast: 'Ballast', underballast: 'Underballast', daemning: 'Dæmning', sveller: 'Sveller',
};

const PSET: Record<Del, string> = {
  fritrum: 'SporKit_Fritrum', skinne: 'SporKit_Skinne', ballast: 'SporKit_Ballast', underballast: 'SporKit_Underballast', daemning: 'SporKit_Daemning', sveller: 'SporKit_Sveller',
};

/* ------------------------------ alignment-segmenter (IFC 4.3) ------------------------------ */

type HType = 'LINE' | 'CIRCULARARC' | 'CLOTHOID';
interface HDel { type: HType; seg: HSeg; s0: number; navn: string }

/** Vandrette segmenter i IFC-form; polylinjer deles i rette stykker. Radius med IFC-fortegn: + = mod uret (venstre). */
function vandretteDele(lf: Linjefoering): HDel[] {
  const out: HDel[] = [];
  for (const s of lf.h) {
    if (s.L < 1e-6) continue;
    if (s.type === 'polylinje' && s.pkt && s.cum) {
      for (let j = 1; j < s.pkt.length; j++) {
        const a = s.pkt[j - 1], b = s.pkt[j], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (L < 1e-6) continue;
        const hs: HSeg = { type: 'ret', d0: s.d0 + s.cum[j - 1], L, s0: s.s0 + s.cum[j - 1], R0: 0, R1: 0, k0: 0, k1: 0, x0: a[0], y0: a[1], phi0: Math.atan2(b[1] - a[1], b[0] - a[0]) };
        out.push({ type: 'LINE', seg: hs, s0: hs.s0, navn: 'Ret (polylinje)' });
      }
      continue;
    }
    let type: HType = s.type === 'kurve' ? 'CIRCULARARC' : s.type === 'overgang' ? 'CLOTHOID' : 'LINE';
    if (type === 'CLOTHOID' && Math.abs(s.k1 - s.k0) < 1e-12) type = Math.abs(s.k0) > 1e-12 ? 'CIRCULARARC' : 'LINE';
    if (type === 'CIRCULARARC' && Math.abs(s.k0) < 1e-12) type = 'LINE';
    const rt = (R: number) => (R ? `${Math.abs(R).toFixed(0)} m ${R > 0 ? 'højre' : 'venstre'}` : '∞');
    const navn = type === 'LINE' ? 'Ret' : type === 'CIRCULARARC' ? `Cirkelbue R = ${rt(s.R0)}` : `Overgangskurve ${rt(s.R0)} → ${rt(s.R1)}`;
    out.push({ type, seg: s, s0: s.s0, navn });
  }
  return out;
}

const vinkelDiff = (a: number, b: number) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d); };

/** Overgangskode mellem to vandrette segmenter (som IfcOpenShell: 1 mm positionstolerance). */
function hOvergang(a: HSeg, b: { x0: number; y0: number; phi0: number; k0: number }): string {
  const e = segPunkt(a, a.L);
  if (Math.hypot(e.x - b.x0, e.y - b.y0) > 0.001) return 'DISCONTINUOUS';
  if (vinkelDiff(e.phi, b.phi0) > 1e-5) return 'CONTINUOUS';
  if (Math.abs(e.k - b.k0) > 1e-8) return 'CONTSAMEGRADIENT';
  return 'CONTSAMEGRADIENTSAMECURVATURE';
}

const vKrumning = (s: VSeg) => (s.type === 'ret' ? 0 : 1 / s.R);

function vOvergang(a: VSeg, b: VSeg | { d0: number; z0: number; g0: number; k: number }): string {
  const e = vSegPunkt(a, a.L);
  const bz = b.z0, bg = b.g0, bk = 'k' in b ? b.k : vKrumning(b);
  if (Math.abs(a.d0 + a.L - b.d0) > 0.001 || Math.abs(e.z - bz) > 0.001) return 'DISCONTINUOUS';
  if (Math.abs(e.g - bg) > 1e-7) return 'CONTINUOUS';
  if (Math.abs(vKrumning(a) - bk) > 1e-9) return 'CONTSAMEGRADIENT';
  return 'CONTSAMEGRADIENTSAMECURVATURE';
}

/** Buelængde af parablen y = A + Bx + Cx² fra 0 til L (som IfcOpenShell). */
function parabelLaengde(B: number, C: number, L: number): number {
  const a = 4 * C * C, b = 4 * B * C, c = B * B + 1;
  if (a < 1e-18) return L * Math.sqrt(c);
  const F = (x: number) => {
    const q = Math.sqrt(a * x * x + b * x + c);
    return ((b + 2 * a * x) / (4 * a)) * q + ((4 * a * c - b * b) / (8 * a ** 1.5)) * Math.log(Math.abs(2 * a * x + b + 2 * Math.sqrt(a) * q));
  };
  return F(L) - F(0);
}

/* ------------------------------ skriv fil ------------------------------ */

export interface IfcResultat { tekst: string; entiteter: number }

export function skrivIfc(model: Model, lf: Linjefoering, skema: IfcSkema, meta: IfcMeta): IfcResultat {
  const w = new Step();
  const x3 = skema === 'IFC2X3', x43 = skema === 'IFC4X3_ADD2';
  const nyG = guidKilde(meta.seed);
  const G = () => stepStr(nyG());
  const S = stepStr, R = real, E = (e: string) => `.${e}.`, NUL = '$', DER = '*';
  const ref = (n: number) => `#${n}`;
  const L = (a: string[]) => `(${a.join(',')})`;
  const tid = meta.tid ?? new Date();
  const [ox, oy, oz] = model.origo;
  const ver = meta.version ?? '0.1.0';

  const pt3 = (x: number, y: number, z: number) => w.add('IFCCARTESIANPOINT', L([R(x), R(y), R(z)]));
  const pt2 = (x: number, y: number) => w.add('IFCCARTESIANPOINT', L([R(x), R(y)]));
  const dir2 = (x: number, y: number) => w.add('IFCDIRECTION', L([R(x, 12), R(y, 12)]));
  const dir3 = (x: number, y: number, z: number) => w.add('IFCDIRECTION', L([R(x, 12), R(y, 12), R(z, 12)]));
  const ax3 = () => w.add('IFCAXIS2PLACEMENT3D', ref(pt3(0, 0, 0)), NUL, NUL);
  const ax2 = (x: number, y: number, dx: number, dy: number) => w.add('IFCAXIS2PLACEMENT2D', ref(pt2(x, y)), ref(dir2(dx, dy)));

  // Ejerhistorik (påkrævet i IFC2X3, udeladt i IFC4/4.3)
  let OH = NUL;
  if (x3) {
    const person = w.add('IFCPERSON', NUL, S(meta.forfatter?.trim() || 'Ukendt'), NUL, NUL, NUL, NUL, NUL, NUL);
    const org = w.add('IFCORGANIZATION', NUL, S(meta.organisation?.trim() || 'Ukendt'), NUL, NUL, NUL);
    const po = w.add('IFCPERSONANDORGANIZATION', ref(person), ref(org), NUL);
    const dev = w.add('IFCORGANIZATION', NUL, S('SporKit (åben kildekode)'), NUL, NUL, NUL);
    const app = w.add('IFCAPPLICATION', ref(dev), S(ver), S('SporKit'), S('SporKit'));
    OH = ref(w.add('IFCOWNERHISTORY', ref(po), ref(app), NUL, E('ADDED'), NUL, NUL, NUL, String(Math.floor(tid.getTime() / 1000))));
  }

  // Enheder og kontekster
  const uLen = w.add('IFCSIUNIT', DER, E('LENGTHUNIT'), NUL, E('METRE'));
  const uAng = w.add('IFCSIUNIT', DER, E('PLANEANGLEUNIT'), NUL, E('RADIAN'));
  const uAre = w.add('IFCSIUNIT', DER, E('AREAUNIT'), NUL, E('SQUARE_METRE'));
  const uVol = w.add('IFCSIUNIT', DER, E('VOLUMEUNIT'), NUL, E('CUBIC_METRE'));
  const units = w.add('IFCUNITASSIGNMENT', L([ref(uLen), ref(uAng), ref(uAre), ref(uVol)]));
  const ctx = w.add('IFCGEOMETRICREPRESENTATIONCONTEXT', NUL, S('Model'), '3', R(1e-5), ref(ax3()), NUL);
  const cBody = w.add('IFCGEOMETRICREPRESENTATIONSUBCONTEXT', S('Body'), S('Model'), DER, DER, DER, DER, ref(ctx), NUL, E('MODEL_VIEW'), NUL);
  const cAxis = w.add('IFCGEOMETRICREPRESENTATIONSUBCONTEXT', S('Axis'), S('Model'), DER, DER, DER, DER, ref(ctx), NUL, E('MODEL_VIEW'), NUL);
  const proj = w.add('IFCPROJECT', G(), OH, S(meta.projekt || 'SporKit-projekt'), S('Sporgeometri, fritrum (BN1-166-1) og tværprofil (BN1-6-7) – genereret med SporKit'), NUL, NUL, NUL, L([ref(ctx)]), ref(units));

  const crs = meta.epsg ? CRS[meta.epsg] : undefined;
  if (crs && !x3) {
    const pc = w.add('IFCPROJECTEDCRS', S(`EPSG:${crs.epsg}`), S(crs.navn), S(crs.datum), S(meta.hoejdesystem || 'DVR90'), S(crs.projektion), S(crs.zone), ref(uLen));
    w.add('IFCMAPCONVERSION', ref(ctx), ref(pc), R(ox), R(oy), R(oz), R(1), R(0), R(1));
  }

  // Egenskaber
  const vaerdi = (e: Egenskab) => e.t === 'L' ? `IFCLENGTHMEASURE(${R(+e.v)})` : e.t === 'R' ? `IFCREAL(${R(+e.v)})` : e.t === 'I' ? `IFCINTEGER(${Math.round(+e.v)})` : `IFCLABEL(${S(String(e.v).slice(0, 255))})`;
  const pset = (el: number[], navn: string, eg: Record<string, Egenskab>) => {
    const props = Object.entries(eg).map(([k, e]) => ref(w.add('IFCPROPERTYSINGLEVALUE', S(k), NUL, vaerdi(e), NUL)));
    if (!props.length) return;
    const ps = w.add('IFCPROPERTYSET', G(), OH, S(navn), NUL, L(props));
    w.add('IFCRELDEFINESBYPROPERTIES', G(), OH, NUL, NUL, L(el.map(ref)), ref(ps));
  };

  // Sted
  const sitePl = w.add('IFCLOCALPLACEMENT', NUL, ref(ax3()));
  const geo = crs ? tmTilGeo(crs, ox, oy) : null;
  const site = w.add('IFCSITE', G(), OH, S(meta.sted || 'Strækning'), NUL, NUL, ref(sitePl), NUL, NUL, E('ELEMENT'),
    geo ? dms(geo.lat) : NUL, geo ? dms(geo.lon) : NUL, R(oz), NUL, NUL);
  w.add('IFCRELAGGREGATES', G(), OH, NUL, NUL, ref(proj), L([ref(site)]));
  if (x3 && crs) {
    pset([site], 'ePSet_MapConversion', {
      Eastings: { v: ox, t: 'L' }, Northings: { v: oy, t: 'L' }, OrthogonalHeight: { v: oz, t: 'L' },
      XAxisAbscissa: { v: 1, t: 'R' }, XAxisOrdinate: { v: 0, t: 'R' }, Scale: { v: 1, t: 'R' },
    });
    pset([site], 'ePSet_ProjectedCRS', {
      Name: { v: `EPSG:${crs.epsg}`, t: 'T' }, Description: { v: crs.navn, t: 'T' }, GeodeticDatum: { v: crs.datum, t: 'T' },
      VerticalDatum: { v: meta.hoejdesystem || 'DVR90', t: 'T' }, MapProjection: { v: crs.projektion, t: 'T' }, MapZone: { v: crs.zone, t: 'T' },
    });
  }
  let cont = site, contPl = sitePl;
  if (x43) {
    const rPl = w.add('IFCLOCALPLACEMENT', ref(sitePl), ref(ax3()));
    const rw = w.add('IFCRAILWAY', G(), OH, S(meta.projekt || 'Jernbane'), NUL, NUL, ref(rPl), NUL, NUL, E('ELEMENT'), NUL);
    w.add('IFCRELAGGREGATES', G(), OH, NUL, NUL, ref(site), L([ref(rw)]));
    cont = rw; contPl = rPl;
  }

  // Overfladestile
  const stilCache = new Map<Del, number>();
  const stil = (d: Del): number => {
    const c = stilCache.get(d);
    if (c) return c;
    const f = FARVE[d];
    const col = w.add('IFCCOLOURRGB', NUL, R(f.rgb[0], 4), R(f.rgb[1], 4), R(f.rgb[2], 4));
    const rend = w.add('IFCSURFACESTYLERENDERING', ref(col), R(f.t, 4), NUL, NUL, NUL, NUL, NUL, NUL, E('NOTDEFINED'));
    let s = w.add('IFCSURFACESTYLE', S(f.navn), E('BOTH'), L([ref(rend)]));
    if (x3) s = w.add('IFCPRESENTATIONSTYLEASSIGNMENT', L([ref(s)]));
    stilCache.set(d, s);
    return s;
  };

  // Elementer
  const produkter: number[] = [];
  const beskrivelse = (o: Objekt) => `${OBJEKTTYPE[o.del]}, km ${kmTxt(o.km0)}–${kmTxt(o.km1)}`;
  const produkt = (o: Objekt, pl: number, pds: number): number => {
    const b = [G(), OH, S(o.navn), S(beskrivelse(o))];
    const p = [ref(pl), ref(pds), NUL];
    if (x43) {
      switch (o.del) {
        case 'fritrum':
          return meta.fritrumKlasse === 'proxy'
            ? w.add('IFCBUILDINGELEMENTPROXY', ...b, S(OBJEKTTYPE.fritrum), ...p, E('USERDEFINED'))
            : w.add('IFCVIRTUALELEMENT', ...b, S(OBJEKTTYPE.fritrum), ...p, E('CLEARANCE'));
        case 'skinne': return w.add('IFCRAIL', ...b, NUL, ...p, E('RAIL'));
        case 'ballast': return w.add('IFCCOURSE', ...b, NUL, ...p, E('BALLASTBED'));
        case 'underballast': return w.add('IFCEARTHWORKSFILL', ...b, S('Underballast'), ...p, E('SUBGRADEBED'));
        case 'daemning': return w.add('IFCEARTHWORKSFILL', ...b, NUL, ...p, E('EMBANKMENT'));
        case 'sveller': return w.add('IFCTRACKELEMENT', ...b, NUL, ...p, E('SLEEPER'));
      }
    }
    return w.add('IFCBUILDINGELEMENTPROXY', ...b, S(OBJEKTTYPE[o.del]), ...p, x3 ? NUL : E('USERDEFINED'));
  };
  const F = (x: number) => R(x, 4);
  for (const o of model.objekter) {
    if (!o.tri.length) continue;
    let item: number, repType: string;
    if (x3) {
      const ids: number[] = [];
      for (let i = 0; i < o.pts.length; i += 3) ids.push(w.add('IFCCARTESIANPOINT', `(${F(o.pts[i])},${F(o.pts[i + 1])},${F(o.pts[i + 2])})`));
      const faces: string[] = [];
      for (let i = 0; i < o.tri.length; i += 3) {
        const loop = w.add('IFCPOLYLOOP', `(#${ids[o.tri[i]]},#${ids[o.tri[i + 1]]},#${ids[o.tri[i + 2]]})`);
        faces.push(ref(w.add('IFCFACE', L([ref(w.add('IFCFACEOUTERBOUND', ref(loop), '.T.'))]))));
      }
      if (o.lukket) { item = w.add('IFCFACETEDBREP', ref(w.add('IFCCLOSEDSHELL', L(faces)))); repType = 'Brep'; }
      else { item = w.add('IFCFACEBASEDSURFACEMODEL', L([ref(w.add('IFCCONNECTEDFACESET', L(faces)))])); repType = 'SurfaceModel'; }
    } else {
      const c: string[] = [];
      for (let i = 0; i < o.pts.length; i += 3) c.push(`(${F(o.pts[i])},${F(o.pts[i + 1])},${F(o.pts[i + 2])})`);
      const pl = x43 ? w.add('IFCCARTESIANPOINTLIST3D', `(${c.join(',')})`, NUL) : w.add('IFCCARTESIANPOINTLIST3D', `(${c.join(',')})`);
      const t: string[] = [];
      for (let i = 0; i < o.tri.length; i += 3) t.push(`(${o.tri[i] + 1},${o.tri[i + 1] + 1},${o.tri[i + 2] + 1})`);
      item = w.add('IFCTRIANGULATEDFACESET', ref(pl), NUL, o.lukket ? '.T.' : '.F.', `(${t.join(',')})`, NUL);
      repType = 'Tessellation';
    }
    w.add('IFCSTYLEDITEM', ref(item), L([ref(stil(o.del))]), NUL);
    const rep = w.add('IFCSHAPEREPRESENTATION', ref(cBody), S('Body'), S(repType), L([ref(item)]));
    const pds = w.add('IFCPRODUCTDEFINITIONSHAPE', NUL, NUL, L([ref(rep)]));
    const pl = w.add('IFCLOCALPLACEMENT', ref(contPl), ref(ax3()));
    const el = produkt(o, pl, pds);
    produkter.push(el);
    pset([el], PSET[o.del], o.egenskaber);
  }

  // Linjeføring
  const startSt = stationVed(lf, 0);
  if (x43) alignment43();
  else {
    const aPl = w.add('IFCLOCALPLACEMENT', ref(contPl), ref(ax3()));
    let curve: number, rt: string;
    if (x3) {
      const pts = model.akse.map(([x, y, z]) => ref(pt3(x, y, z)));
      curve = w.add('IFCGEOMETRICCURVESET', L([ref(w.add('IFCPOLYLINE', L(pts)))]));
      rt = 'GeometricCurveSet';
    } else {
      const pl = w.add('IFCCARTESIANPOINTLIST3D', `(${model.akse.map(([x, y, z]) => `(${F(x)},${F(y)},${F(z)})`).join(',')})`);
      curve = w.add('IFCINDEXEDPOLYCURVE', ref(pl), NUL, '.F.');
      rt = 'Curve3D';
    }
    const rep = w.add('IFCSHAPEREPRESENTATION', ref(cAxis), S('Axis'), S(rt), L([ref(curve)]));
    const pds = w.add('IFCPRODUCTDEFINITIONSHAPE', NUL, NUL, L([ref(rep)]));
    const an = w.add('IFCANNOTATION', G(), OH, S(lf.navn), S('Linjeføring: spormidte i SO-kote for den indvendige skinne'), S('Linjeføring'), ref(aPl), ref(pds));
    produkter.push(an);
    pset([an], 'SporKit_Linjefoering', {
      'Station start': { v: startSt, t: 'L' }, 'Km start': { v: kmTxt(startSt), t: 'T' },
      'Km slut': { v: kmTxt(stationVed(lf, lf.laengde)), t: 'T' }, Længde: { v: lf.laengde, t: 'L' },
      Kilde: { v: meta.kilde || 'SporKit', t: 'T' },
    });
  }

  if (produkter.length) w.add('IFCRELCONTAINEDINSPATIALSTRUCTURE', G(), OH, S('Sporets elementer'), NUL, L(produkter.map(ref)), ref(cont));
  pset([proj], 'SporKit_Model', {
    Program: { v: `SporKit ${ver} – åben kildekode (MIT)`, t: 'T' },
    Kilde: { v: meta.kilde || '–', t: 'T' },
    Linjeføring: { v: lf.navn, t: 'T' },
    Normgrundlag: { v: 'BN1-166-1 (fritrum), BN1-6-7 (tværprofil), Sporregler (overhøjde)', t: 'T' },
    Koordinatsystem: { v: crs ? `${crs.navn} (EPSG:${crs.epsg}) + ${meta.hoejdesystem || 'DVR90'}` : 'Lokalt (ingen georeference)', t: 'T' },
    'Nulpunkt østlig': { v: ox, t: 'L' }, 'Nulpunkt nordlig': { v: oy, t: 'L' },
  });

  // ---------------------------------------------------------------- IFC 4.3 alignment
  function alignment43(): void {
    const hd = vandretteDele(lf);
    const sidst = lf.h[lf.h.length - 1];
    const slut = segPunkt(sidst, sidst.L);
    // Semantik: vandret
    const hSeg: string[] = hd.map((d) => {
      const s = d.seg;
      const Rs = s.k0 ? 1 / s.k0 : 0, Re = s.k1 ? 1 / s.k1 : 0;
      const dp = w.add('IFCALIGNMENTHORIZONTALSEGMENT', S(kmTxt(d.s0)), S(kmTxt(d.s0 + s.L)), ref(pt2(s.x0 - ox, s.y0 - oy)), R(s.phi0, 12),
        R(d.type === 'LINE' ? 0 : Rs), R(d.type === 'LINE' ? 0 : d.type === 'CIRCULARARC' ? Rs : Re), R(s.L), NUL, E(d.type));
      return ref(w.add('IFCALIGNMENTSEGMENT', G(), OH, S(d.navn), NUL, NUL, NUL, NUL, ref(dp)));
    });
    const slutSt = stationVed(lf, lf.laengde);
    hSeg.push(ref(w.add('IFCALIGNMENTSEGMENT', G(), OH, S('Slutpunkt'), NUL, NUL, NUL, NUL,
      ref(w.add('IFCALIGNMENTHORIZONTALSEGMENT', S(kmTxt(slutSt)), S(kmTxt(slutSt)), ref(pt2(slut.x - ox, slut.y - oy)), R(slut.phi, 12), R(0), R(0), R(0), NUL, E('LINE'))))));
    const horiz = w.add('IFCALIGNMENTHORIZONTAL', G(), OH, S('Vandret linjeføring'), NUL, NUL, NUL, NUL);
    w.add('IFCRELNESTS', G(), OH, NUL, NUL, ref(horiz), L(hSeg));

    // Geometri: vandret IfcCompositeCurve (samme kortlægning som IfcOpenShell)
    const cs: string[] = hd.map((d, i) => {
      const s = d.seg;
      const plc = ax2(s.x0 - ox, s.y0 - oy, Math.cos(s.phi0), Math.sin(s.phi0));
      let parent: number, start = 0, len = s.L;
      if (d.type === 'LINE') parent = w.add('IFCLINE', ref(pt2(0, 0)), ref(w.add('IFCVECTOR', ref(dir2(1, 0)), R(1))));
      else if (d.type === 'CIRCULARARC') {
        const Rs = 1 / s.k0;
        parent = w.add('IFCCIRCLE', ref(ax2(0, 0, 1, 0)), R(Math.abs(Rs)));
        len = s.L * Math.sign(Rs);
      } else {
        const Rs = s.k0 ? 1 / s.k0 : 0, Re = s.k1 ? 1 / s.k1 : 0;
        const f = (Re ? s.L / Re : 0) - (Rs ? s.L / Rs : 0);
        const A = (s.L / Math.sqrt(Math.abs(f))) * Math.sign(f);
        start = (Math.abs(Rs) < Math.abs(Re) && Rs !== 0) || Re === 0 ? -s.L - (Re !== 0 ? (s.L * Rs) / (Re - Rs) : 0) : Rs !== 0 ? (s.L * Re) / (Rs - Re) : 0;
        parent = w.add('IFCCLOTHOID', ref(ax2(0, 0, 1, 0)), R(A, 9));
      }
      const naeste = hd[i + 1]?.seg ?? { x0: slut.x, y0: slut.y, phi0: slut.phi, k0: 0 };
      return ref(w.add('IFCCURVESEGMENT', E(hOvergang(s, naeste)), ref(plc), `IFCLENGTHMEASURE(${R(start, 9)})`, `IFCLENGTHMEASURE(${R(len, 9)})`, ref(parent)));
    });
    cs.push(ref(w.add('IFCCURVESEGMENT', E('DISCONTINUOUS'), ref(ax2(slut.x - ox, slut.y - oy, Math.cos(slut.phi), Math.sin(slut.phi))),
      'IFCLENGTHMEASURE(0.)', 'IFCLENGTHMEASURE(0.)', ref(w.add('IFCLINE', ref(pt2(0, 0)), ref(w.add('IFCVECTOR', ref(dir2(1, 0)), R(1))))))));
    const cc = w.add('IFCCOMPOSITECURVE', L(cs), '.F.');

    const layouts: string[] = [ref(horiz)];
    const reps: string[] = [];
    // Lodret (et vandret profil i kote 0 hvis der kun er overhøjde)
    let gc = 0;
    const vs = lf.harProfil ? klipLodret(lf.v, 0, lf.laengde) : lf.harCant ? [{ type: 'ret', d0: 0, L: lf.laengde, z0: 0, g0: 0, g1: 0, R: 0 } as VSeg] : [];
    if (vs.length) {
      const vSeg: string[] = vs.map((s) => {
        const t = s.type === 'ret' ? 'CONSTANTGRADIENT' : s.type === 'parabel' ? 'PARABOLICARC' : 'CIRCULARARC';
        const navn = s.type === 'ret' ? `Hældning ${(s.g0 * 1000).toFixed(2)} ‰` : `Afrundingskurve Rv = ${Math.abs(s.R).toFixed(0)} m`;
        const dp = w.add('IFCALIGNMENTVERTICALSEGMENT', S(kmTxt(stationVed(lf, s.d0))), S(kmTxt(stationVed(lf, s.d0 + s.L))), R(s.d0), R(s.L), R(s.z0 - oz),
          R(s.g0, 12), R(s.g1, 12), s.type === 'ret' ? NUL : R(s.R, 4), E(t));
        return ref(w.add('IFCALIGNMENTSEGMENT', G(), OH, S(navn), NUL, NUL, NUL, NUL, ref(dp)));
      });
      const vl = vs[vs.length - 1], ve = vSegPunkt(vl, vl.L), dE = vl.d0 + vl.L;
      vSeg.push(ref(w.add('IFCALIGNMENTSEGMENT', G(), OH, S('Slutpunkt'), NUL, NUL, NUL, NUL,
        ref(w.add('IFCALIGNMENTVERTICALSEGMENT', S(kmTxt(stationVed(lf, dE))), S(kmTxt(stationVed(lf, dE))), R(dE), R(0), R(ve.z - oz), R(ve.g, 12), R(ve.g, 12), NUL, E('CONSTANTGRADIENT'))))));
      const vert = w.add('IFCALIGNMENTVERTICAL', G(), OH, S(lf.harProfil ? 'Længdeprofil' : 'Længdeprofil (vandret, kote 0)'), NUL, NUL, NUL, NUL);
      w.add('IFCRELNESTS', G(), OH, NUL, NUL, ref(vert), L(vSeg));
      layouts.push(ref(vert));
      // Geometri: IfcGradientCurve
      const gs: string[] = vs.map((s, i) => {
        const th0 = Math.atan(s.g0);
        const plc = ax2(s.d0, s.z0 - oz, Math.cos(th0), Math.sin(th0));
        let parent: number, start = 0, len: number;
        if (s.type === 'ret') {
          parent = w.add('IFCLINE', ref(pt2(0, 0)), ref(w.add('IFCVECTOR', ref(dir2(1, 0)), R(1))));
          len = s.L / Math.cos(th0);
        } else if (s.type === 'parabel') {
          const B = s.g0, C = (s.g1 - s.g0) / (2 * s.L);
          parent = w.add('IFCPOLYNOMIALCURVE', ref(ax2(0, 0, 1, 0)), L(['0.', '1.']), L([R(s.z0 - oz), R(B, 12), R(C, 15)]), NUL);
          len = parabelLaengde(B, C, s.L);
        } else {
          let a0 = Math.atan(s.g0), a1 = Math.atan(s.g1), rad: number, cx: number, cy: number;
          if (a0 < a1) { rad = s.L / (Math.sin(a1) - Math.sin(a0)); cx = -rad * Math.sin(a0); cy = rad * Math.cos(a0); a0 += (3 * Math.PI) / 2; a1 += (3 * Math.PI) / 2; }
          else { rad = s.L / (Math.sin(a0) - Math.sin(a1)); cx = rad * Math.sin(a0); cy = -rad * Math.cos(a0); a0 += Math.PI / 2; a1 += Math.PI / 2; }
          parent = w.add('IFCCIRCLE', ref(ax2(cx, cy, 1, 0)), R(rad, 6));
          start = rad * a0; len = rad * (a1 - a0);
        }
        const nx = vs[i + 1] ?? { d0: vl.d0 + vl.L, z0: ve.z, g0: ve.g, k: 0 };
        return ref(w.add('IFCCURVESEGMENT', E(vOvergang(s, nx)), ref(plc), `IFCLENGTHMEASURE(${R(start, 9)})`, `IFCLENGTHMEASURE(${R(len, 9)})`, ref(parent)));
      });
      const thE = Math.atan(ve.g);
      gs.push(ref(w.add('IFCCURVESEGMENT', E('DISCONTINUOUS'), ref(ax2(dE, ve.z - oz, Math.cos(thE), Math.sin(thE))), 'IFCLENGTHMEASURE(0.)', 'IFCLENGTHMEASURE(0.)',
        ref(w.add('IFCLINE', ref(pt2(0, 0)), ref(w.add('IFCVECTOR', ref(dir2(1, 0)), R(1))))))));
      gc = w.add('IFCGRADIENTCURVE', L(gs), '.F.', ref(cc), NUL);
      reps.push(ref(w.add('IFCSHAPEREPRESENTATION', ref(cAxis), S('FootPrint'), S('Curve2D'), L([ref(cc)]))));
      if (!lf.harCant) reps.push(ref(w.add('IFCSHAPEREPRESENTATION', ref(cAxis), S('Axis'), S('Curve3D'), L([ref(gc)]))));
    } else reps.push(ref(w.add('IFCSHAPEREPRESENTATION', ref(cAxis), S('Axis'), S('Curve2D'), L([ref(cc)]))));

    // Overhøjde (drejning om den indvendige skinne: kun ydre skinne hæves)
    if (lf.harCant) {
      const pk = lf.cant.filter((c) => c.d >= -1e-6 && c.d <= lf.laengde + 1e-6);
      const pts = [...pk];
      if (!pts.length || pts[0].d > 1e-6) pts.unshift({ d: 0, h: pts[0]?.h ?? 0, side: pts[0]?.side ?? 0 });
      if (pts[pts.length - 1].d < lf.laengde - 1e-6) pts.push({ d: lf.laengde, h: pts[pts.length - 1].h, side: pts[pts.length - 1].side });
      const cSeg: string[] = [];
      const sideVed = (a: typeof pts[number], b: typeof pts[number]) => (a.h >= b.h ? a.side || b.side : b.side || a.side) || 1;
      interface CDel { d0: number; L: number; l0: number; l1: number; r0: number; r1: number; t: 'CONSTANTCANT' | 'LINEARTRANSITION' }
      const dele: CDel[] = [];
      for (let i = 0; i + 1 < pts.length; i++) {
        const a = pts[i], b = pts[i + 1];
        if (b.d - a.d < 1e-6) continue;
        const s = sideVed(a, b);
        const l0 = s < 0 ? a.h / 1000 : 0, l1 = s < 0 ? b.h / 1000 : 0, r0 = s > 0 ? a.h / 1000 : 0, r1 = s > 0 ? b.h / 1000 : 0;
        const t = Math.abs(a.h - b.h) < 1e-6 ? 'CONSTANTCANT' : 'LINEARTRANSITION';
        dele.push({ d0: a.d, L: b.d - a.d, l0, l1, r0, r1, t });
        const navn = t === 'CONSTANTCANT' ? `Overhøjde ${a.h.toFixed(0)} mm` : `Overhøjderampe ${a.h.toFixed(0)} → ${b.h.toFixed(0)} mm`;
        const dp = w.add('IFCALIGNMENTCANTSEGMENT', S(kmTxt(stationVed(lf, a.d))), S(kmTxt(stationVed(lf, b.d))), R(a.d), R(b.d - a.d), R(l0), R(l1), R(r0), R(r1), E(t));
        cSeg.push(ref(w.add('IFCALIGNMENTSEGMENT', G(), OH, S(navn), NUL, NUL, NUL, NUL, ref(dp))));
      }
      // Geometri: IfcSegmentedReferenceCurve over IfcGradientCurve (som IfcOpenShell; skinnehovedafstand 1,5 m)
      if (gc && dele.length) {
        const akse = (Ds: number) => { const Dy = 2 * Ds, Dz = Math.sqrt(Math.max(0, 2.25 - Dy * Dy)); return dir3(0, Dy / 1.5, Dz / 1.5); };
        const linje = () => w.add('IFCLINE', ref(pt2(0, 0)), ref(w.add('IFCVECTOR', ref(dir2(1, 0)), R(1))));
        const ss: string[] = dele.map((c, i) => {
          const Ds = 0.5 * (c.l0 + c.r0), De = 0.5 * (c.l1 + c.r1);
          let parent: number, ly = Ds, ax: number, rd: [number, number] = [1, 0];
          if (c.t === 'CONSTANTCANT') { parent = linje(); ax = akse(0.5 * (c.r0 - c.l0)); }
          else {
            const f = De - Ds;
            const A0 = Ds ? (c.L ** 2 / Math.abs(Ds)) * Math.sign(Ds) : 0;
            const A1 = (c.L ** 1.5 / Math.sqrt(Math.abs(f))) * Math.sign(f);
            parent = w.add('IFCCLOTHOID', ref(ax2(0, 0, 1, 0)), R(A1, 9));
            ly = A0 ? c.L ** 2 / A0 : 0;
            const sd = Math.atan((A1 * c.L ** 2) / Math.abs(A1 ** 3));
            ax = akse(Ds); rd = [Math.cos(sd), Math.sin(sd)];
          }
          const plc = w.add('IFCAXIS2PLACEMENT3D', ref(pt3(c.d0, ly, 0)), ref(ax), ref(dir3(rd[0], rd[1], 0)));
          const nx = dele[i + 1];
          const tr = c.t === 'CONSTANTCANT' && (!nx || (nx.t === 'CONSTANTCANT' && Math.abs(nx.l0 + nx.r0 - c.l1 - c.r1) < 1e-9)) ? 'CONTSAMEGRADIENTSAMECURVATURE' : 'CONTINUOUS';
          return ref(w.add('IFCCURVESEGMENT', E(tr), ref(plc), 'IFCLENGTHMEASURE(0.)', `IFCLENGTHMEASURE(${R(c.L, 9)})`, ref(parent)));
        });
        const cl = dele[dele.length - 1], DsE = 0.5 * (cl.l1 + cl.r1), hl = cl.t === 'CONSTANTCANT' ? 0 : Math.atan((DsE - 0.5 * (cl.l0 + cl.r0)) / cl.L);
        ss.push(ref(w.add('IFCCURVESEGMENT', E('DISCONTINUOUS'), ref(w.add('IFCAXIS2PLACEMENT3D', ref(pt3(cl.d0 + cl.L, DsE, 0)), ref(akse(0.5 * (cl.r1 - cl.l1))), ref(dir3(Math.cos(hl), Math.sin(hl), 0)))),
          'IFCLENGTHMEASURE(0.)', 'IFCLENGTHMEASURE(0.)', ref(linje()))));
        const src = w.add('IFCSEGMENTEDREFERENCECURVE', L(ss), '.F.', ref(gc), NUL);
        reps.push(ref(w.add('IFCSHAPEREPRESENTATION', ref(cAxis), S('Axis'), S('Curve3D'), L([ref(src)]))));
      }
      const pe = pts[pts.length - 1], se = pe.side || 1;
      cSeg.push(ref(w.add('IFCALIGNMENTSEGMENT', G(), OH, S('Slutpunkt'), NUL, NUL, NUL, NUL,
        ref(w.add('IFCALIGNMENTCANTSEGMENT', S(kmTxt(stationVed(lf, pe.d))), S(kmTxt(stationVed(lf, pe.d))), R(pe.d), R(0),
          R(se < 0 ? pe.h / 1000 : 0), R(se < 0 ? pe.h / 1000 : 0), R(se > 0 ? pe.h / 1000 : 0), R(se > 0 ? pe.h / 1000 : 0), E('CONSTANTCANT'))))));
      const cant = w.add('IFCALIGNMENTCANT', G(), OH, S('Overhøjde'), S('Drejning om den indvendige skinne (Banedanmark)'), NUL, NUL, NUL, R(1.5));
      w.add('IFCRELNESTS', G(), OH, NUL, NUL, ref(cant), L(cSeg));
      layouts.push(ref(cant));
    }

    const alPl = w.add('IFCLOCALPLACEMENT', NUL, ref(ax3()));
    const alPds = w.add('IFCPRODUCTDEFINITIONSHAPE', NUL, NUL, L(reps));
    const al = w.add('IFCALIGNMENT', G(), OH, S(lf.navn), S(`Linjeføring${meta.kilde ? ` fra ${meta.kilde}` : ''}, km ${kmTxt(startSt)}–${kmTxt(slutSt)}`), NUL, ref(alPl), ref(alPds), NUL);
    w.add('IFCRELNESTS', G(), OH, NUL, NUL, ref(al), L(layouts));
    // Stationering: IfcReferent ved start
    const p0 = segPunkt(lf.h[0], 0), z0 = vPunkt(lf, 0).z;
    const lp = w.add('IFCLINEARPLACEMENT', NUL,
      ref(w.add('IFCAXIS2PLACEMENTLINEAR', ref(w.add('IFCPOINTBYDISTANCEEXPRESSION', 'IFCLENGTHMEASURE(0.)', NUL, NUL, NUL, ref(cc))), NUL, NUL)),
      ref(w.add('IFCAXIS2PLACEMENT3D', ref(pt3(p0.x - ox, p0.y - oy, (vs.length ? z0 : 0) - oz)), ref(dir3(0, 0, 1)), ref(dir3(Math.cos(p0.phi), Math.sin(p0.phi), 0)))));
    const refe = w.add('IFCREFERENT', G(), OH, S(kmTxt(startSt)), S('Stationering ved linjeføringens start'), NUL, ref(lp), NUL, E('STATION'));
    pset([refe], 'Pset_Stationing', { Station: { v: startSt, t: 'L' } });
    w.add('IFCRELNESTS', G(), OH, NUL, NUL, ref(al), L([ref(refe)]));
    w.add('IFCRELAGGREGATES', G(), OH, NUL, NUL, ref(proj), L([ref(al)]));
    w.add('IFCRELREFERENCEDINSPATIALSTRUCTURE', G(), OH, NUL, NUL, L([ref(al)]), ref(cont));
    pset([al], 'SporKit_Linjefoering', {
      'Km start': { v: kmTxt(startSt), t: 'T' }, 'Km slut': { v: kmTxt(slutSt), t: 'T' }, Længde: { v: lf.laengde, t: 'L' },
      Kilde: { v: meta.kilde || 'SporKit', t: 'T' }, Overhøjdedrejning: { v: 'Om den indvendige skinne', t: 'T' },
    });
  }

  const vd = x3 ? 'ViewDefinition [CoordinationView_V2.0]' : x43 ? 'ViewDefinition [ReferenceView]' : 'ViewDefinition [ReferenceView_V1.2]';
  const hoved = [
    'ISO-10303-21;',
    'HEADER;',
    `FILE_DESCRIPTION((${S(vd)}),'2;1');`,
    `FILE_NAME(${S(meta.filnavn)},${S(tid.toISOString().slice(0, 19))},(${S(meta.forfatter || '')}),(${S(meta.organisation || '')}),${S(`SporKit ${ver}`)},${S(`SporKit ${ver} – https://rmolbaek.github.io/SporKit/`)},'');`,
    `FILE_SCHEMA((${S(skema)}));`,
    'ENDSEC;',
    'DATA;',
  ].join('\n');
  return { tekst: `${hoved}\n${w.tekst()}\nENDSEC;\nEND-ISO-10303-21;\n`, entiteter: w.antal };
}
