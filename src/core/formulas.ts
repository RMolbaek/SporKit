/**
 * Grundlæggende sporgeometriske formler.
 * Enheder: V [km/t], R [m], h/I/E [mm], L [m].
 */
import type { RuleSet } from './rules';

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
  id: 'dhdt' | 'dIdt' | 'dhds' | 'rampe';
  label: string;
  formel: string;
  normal: number;
  undtagelse: number;
}

export function transitionLengths(inp: TransitionInput, rs: RuleSet): TransitionCriterion[] {
  const v = inp.V / 3.6; // m/s
  const dh = Math.abs(inp.dh);
  const dI = Math.abs(inp.dI);
  return [
    {
      id: 'dhdt',
      label: 'Overhøjdeændring pr. tid',
      formel: 'L ≥ v·Δh / (dh/dt)',
      normal: (v * dh) / rs.dhdtMax.normal,
      undtagelse: (v * dh) / rs.dhdtMax.undtagelse,
    },
    {
      id: 'dIdt',
      label: 'Ændring af manglende overhøjde pr. tid',
      formel: 'L ≥ v·ΔI / (dI/dt)',
      normal: (v * dI) / rs.dIdtMax.normal,
      undtagelse: (v * dI) / rs.dIdtMax.undtagelse,
    },
    {
      id: 'rampe',
      label: 'Rampehældning 1:(k·V)',
      formel: 'L ≥ Δh·k·V / 1000',
      normal: (dh * rs.rampeFaktor.normal * inp.V) / 1000,
      undtagelse: (dh * rs.rampeFaktor.undtagelse * inp.V) / 1000,
    },
    {
      id: 'dhds',
      label: 'Stejleste rampe',
      formel: 'L ≥ Δh / (dh/ds)max',
      normal: dh / rs.dhdsMax.normal,
      undtagelse: dh / rs.dhdsMax.undtagelse,
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
