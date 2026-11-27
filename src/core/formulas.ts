/**
 * Grundlæggende sporgeometriske formler.
 * Enheder: V [km/t], R [m], h/I/E [mm], L [m].
 */
import { limitDhdt, limitDIdt, MIN_OVERGANGSKURVE, type RuleSet } from './rules';

/**
 * Konstanten C i h_eq = C·V²/R  [mm·m·t²/km²].
 * C = e / (g · 3,6²), hvor e = kontaktafstand [mm]. For e = 1500 mm: C ≈ 11,8.
 */
export function cantConstant(rs: RuleSet): number {
  return rs.kontaktafstand / (rs.g * 3.6 * 3.6);
}

/** Ligevægtsoverhøjde h_eq [mm] */
export function equilibriumCant(V: number, R: number, rs: RuleSet): number {
  return (cantConstant(rs) * V * V) / R;
}

/** Manglende overhøjde I = h_eq(V) − h [mm] */
export function cantDeficiency(V: number, R: number, h: number, rs: RuleSet): number {
  return equilibriumCant(V, R, rs) - h;
}

/** Overskydende overhøjde E = h − h_eq(V_min) [mm] */
export function cantExcess(Vmin: number, R: number, h: number, rs: RuleSet): number {
  return h - equilibriumCant(Vmin, R, rs);
}

/** Ukompenseret sideacceleration i sporplan a_q = g·I/e [m/s²] */
export function lateralAcceleration(I: number, rs: RuleSet): number {
  return (rs.g * I) / rs.kontaktafstand;
}

/** Mindste radius R_min = C·V²/(h + I) [m] */
export function minRadius(V: number, h: number, I: number, rs: RuleSet): number {
  return (cantConstant(rs) * V * V) / (h + I);
}

/** Største hastighed V_max = √(R·(h + I)/C) [km/t] */
export function maxSpeed(R: number, h: number, I: number, rs: RuleSet): number {
  return Math.sqrt((R * (h + I)) / cantConstant(rs));
}

/**
 * Mindste radius ved blandet trafik, hvor der skal findes en overhøjde h, som
 * samtidig opfylder I ≤ Imax (hurtige tog, V), E ≤ Emax (langsomme tog, Vmin)
 * og h ≤ hmax:
 *   R ≥ C·V² / (hmax + Imax)          (hastighedskrav)
 *   R ≥ C·(V² − Vmin²) / (Imax + Emax) (krav fra hastighedsspredning)
 */
export function minRadiusMixed(
  V: number, Vmin: number, hmax: number, Imax: number, Emax: number, rs: RuleSet,
): { R: number; styrende: 'hastighed' | 'spredning'; Rhast: number; Rspred: number } {
  const C = cantConstant(rs);
  const Rhast = (C * V * V) / (hmax + Imax);
  const Rspred = (C * Math.max(0, V * V - Vmin * Vmin)) / (Imax + Emax);
  return Rhast >= Rspred
    ? { R: Rhast, styrende: 'hastighed', Rhast, Rspred }
    : { R: Rspred, styrende: 'spredning', Rhast, Rspred };
}

/** Tilladt overhøjdeinterval [h_lav; h_høj] givet V, Vmin og grænser. */
export function cantWindow(
  V: number,
  Vmin: number,
  R: number,
  Imax: number,
  Emax: number,
  hmax: number,
  rs: RuleSet,
): { lav: number; hoej: number; muligt: boolean } {
  const lav = Math.max(0, equilibriumCant(V, R, rs) - Imax);
  const hoej = Math.min(hmax, equilibriumCant(Vmin, R, rs) + Emax);
  return { lav, hoej, muligt: lav <= hoej };
}

/** Afrund op/ned til nærmeste trin (fx 5 mm). */
export function roundTo(x: number, step: number, mode: 'op' | 'ned' | 'naermest' = 'naermest'): number {
  const q = x / step;
  const r = mode === 'op' ? Math.ceil(q - 1e-9) : mode === 'ned' ? Math.floor(q + 1e-9) : Math.round(q);
  return r * step;
}

/* ---------------- Overgangskurve (klotoide, lineær rampe) ---------------- */

export interface TransitionInput {
  V: number;
  R: number;
  /** overhøjdeændring over overgangskurven [mm] */
  dh: number;
  /** ændring af manglende overhøjde over overgangskurven [mm] */
  dI: number;
}

export interface TransitionCriterion {
  id: 'dhdt' | 'dIdt' | 'dhds' | 'min';
  label: string;
  formel: string;
  normal: number;
  undtagelse: number;
}

export function transitionLengths(inp: TransitionInput, rs: RuleSet): TransitionCriterion[] {
  const v = inp.V / 3.6; // m/s
  const dh = Math.abs(inp.dh);
  const dI = Math.abs(inp.dI);
  const lh = limitDhdt(rs, inp.V), lI = limitDIdt(rs, inp.V);
  return [
    {
      id: 'dhdt',
      label: 'Rampestigningshastighed dh/dt',
      formel: 'L ≥ v·Δh / (dh/dt)',
      normal: (v * dh) / lh.normal,
      undtagelse: (v * dh) / lh.undtagelse,
    },
    {
      id: 'dIdt',
      label: 'Ryk dI/dt (klotoide)',
      formel: 'L ≥ v·ΔI / (dI/dt)',
      normal: (v * dI) / lI.normal,
      undtagelse: (v * dI) / lI.undtagelse,
    },
    {
      id: 'dhds',
      label: 'Rampestigning s',
      formel: 'L ≥ Δh / s',
      normal: dh / rs.dhdsMax.normal,
      undtagelse: dh / rs.dhdsMax.undtagelse,
    },
    {
      id: 'min',
      label: 'Mindste overgangskurvelængde',
      formel: 'L ≥ 20 m (2.05.2)',
      normal: dh > 0 || dI > 0 ? MIN_OVERGANGSKURVE : 0,
      undtagelse: dh > 0 || dI > 0 ? MIN_OVERGANGSKURVE : 0,
    },
  ];
}

export interface ClothoidGeometry {
  /** Klotoideparameter A = √(R·L) [m] */
  A: number;
  /** Tangentvinkel ved kurvens slutning τ [rad] */
  tau: number;
  /** Tilbageflytning (shift) p [m] */
  p: number;
  /** Koordinater for overgangskurvens slutpunkt [m] */
  X: number;
  Y: number;
  /** Abscisse for cirklens forskudte centrum [m] */
  Xm: number;
  /** Rampehældning 1:n */
  rampe: number;
}

export function clothoid(R: number, L: number, dh: number): ClothoidGeometry {
  const A = Math.sqrt(R * L);
  const tau = L / (2 * R);
  // Rækkeudvikling af Fresnel-integralerne (præcis for τ < ca. 0,5 rad)
  const X = L * (1 - tau ** 2 / 10 + tau ** 4 / 216 - tau ** 6 / 9360);
  const Y = L * (tau / 3 - tau ** 3 / 42 + tau ** 5 / 1320 - tau ** 7 / 75600);
  const p = Y - R * (1 - Math.cos(tau));
  const Xm = X - R * Math.sin(tau);
  const rampe = dh > 0 ? (L * 1000) / Math.abs(dh) : Infinity;
  return { A, tau, p, X, Y, Xm, rampe };
}

/* ---------------- Overgangskurve mellem to buer (ensvendte) ---------------- */

/** Klotoideparameter for overgangskurve mellem krumning 1/R1 og 1/R2 (0 = ligeud). */
export function clothoidParamCompound(R1: number, R2: number, L: number): number {
  const k1 = R1 > 0 ? 1 / R1 : 0;
  const k2 = R2 > 0 ? 1 / R2 : 0;
  const dk = Math.abs(k2 - k1);
  return dk > 0 ? Math.sqrt(L / dk) : Infinity;
}

/** Vridning fra lineær rampe [mm/m] og over en målebase b [mm]. */
export function rampTwist(dh: number, L: number, base: number): { mmPrM: number; overBase: number } {
  const mmPrM = Math.abs(dh) / L;
  return { mmPrM, overBase: mmPrM * base };
}

/* ---------------------------- Lodrette kurver ---------------------------- */

export interface VerticalCurve {
  /** Hældningsændring [‰] */
  di: number;
  /** Tangentlængde [m] */
  T: number;
  /** Kurvelængde (≈ 2T) [m] */
  L: number;
  /** Pilhøjde i toppunktet (afstand tangentskæring–kurve) [m] */
  f: number;
  /** Lodret acceleration [m/s²] */
  av: number;
  konveks: boolean;
}

/** i1, i2 i ‰ (positiv = stigning i kilometreringsretning) */
export function verticalCurve(i1: number, i2: number, Rv: number, V: number): VerticalCurve {
  const di = i2 - i1;
  const T = (Rv * Math.abs(di)) / 2000;
  return {
    di,
    T,
    L: 2 * T,
    f: (T * T) / (2 * Rv),
    av: (V / 3.6) ** 2 / Rv,
    konveks: di < 0,
  };
}

/** Mindste lodrette radius ud fra tilladt lodret acceleration: Rv = v²/a_v */
export function minVerticalRadius(V: number, av: number): number {
  return (V / 3.6) ** 2 / av;
}

/** Højde (ordinat) under/over tangent i afstand x fra tangentpunkt: y = x²/(2Rv) */
export function verticalOrdinate(x: number, Rv: number): number {
  return (x * x) / (2 * Rv);
}

/* ---------------------- Vandrette kurveelementer ---------------------- */

export interface CurveElements {
  /** Vinkel [rad] */
  alpha: number;
  /** Tangentlængde fra tangentskæringspunkt (TS) til overgangskurvens start [m] */
  T: number;
  /** Cirkelbuens længde [m] */
  Lc: number;
  /** Samlet længde (OK + bue + OK) [m] */
  Ltot: number;
  /** Afstand fra TS til kurvens midtpunkt [m] */
  E: number;
  p: number;
  Xm: number;
  tau: number;
  /** true hvis overgangskurverne er for lange til vinklen */
  umulig: boolean;
}

/** Symmetrisk kurve med overgangskurver af længde L (L=0 → ren cirkelbue). alpha i gon. */
export function curveElements(R: number, alphaGon: number, L: number): CurveElements {
  const alpha = (alphaGon * Math.PI) / 200;
  let p = 0, Xm = 0, tau = 0;
  if (L > 0) {
    const g = clothoid(R, L, 0);
    p = g.p; Xm = g.Xm; tau = g.tau;
  }
  const T = (R + p) * Math.tan(alpha / 2) + Xm;
  const Lc = R * (alpha - 2 * tau);
  const E = (R + p) / Math.cos(alpha / 2) - R;
  return { alpha, T, Lc, Ltot: Lc + 2 * L, E, p, Xm, tau, umulig: Lc < 0 };
}

/* ------------------------------ Pilhøjde ------------------------------ */

/** Eksakt pilhøjde [mm] for korde c [m] på radius R [m] */
export function versine(R: number, c: number): number {
  return (R - Math.sqrt(R * R - (c * c) / 4)) * 1000;
}

/** Radius [m] ud fra målt pilhøjde f [mm] og korde c [m] (eksakt) */
export function radiusFromVersine(f: number, c: number): number {
  const fm = f / 1000;
  return (c * c) / (8 * fm) + fm / 2;
}

/* --------------------------- Kurveudvidelse --------------------------- */

export interface Overhang {
  /** Udbøjning ind mod kurvecentrum på midten af vognen [mm] */
  indvendig: number;
  /** Udbøjning udad ved vognenden [mm] */
  udvendig: number;
  /** Sidevandring pga. overhøjde i højden H over SO [mm] (mod kurvens inderside) */
  haeldning: number;
}

/**
 * Geometrisk overslag for køretøjs udbøjning i kurve.
 * a = bogiecenterafstand [m], Lv = vognkasselængde [m], H = højde over SO [m], h = overhøjde [mm].
 */
export function overhang(R: number, a: number, Lv: number, H: number, h: number, rs: RuleSet): Overhang {
  return {
    indvendig: ((a * a) / (8 * R)) * 1000,
    udvendig: ((Lv * Lv - a * a) / (8 * R)) * 1000,
    haeldning: (h * H * 1000) / rs.kontaktafstand,
  };
}
