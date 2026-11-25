/**
 * TSI INF – Kommissionens forordning (EU) nr. 1299/2014, konsolideret udgave 28.09.2023
 * (inkl. ændringer 2019/776 og 2023/1694). Værdier for sporvidde 1 435 mm.
 * Afsnits- og tabelnumre henviser til bilaget til forordningen.
 */
import type { Status } from './rules';

export type Trafik = 'blandet' | 'person';
export type SporType = 'ballast' | 'fast';

export interface TsiCheck {
  label: string;
  value: string;
  graense: string;
  status: Status;
  kilde: string;
}

/* ------------------------------ 4.2.4.2 Overhøjde ------------------------------ */

/** Tabel 7: projekteret overhøjde [mm]. */
export function tsiCantMax(trafik: Trafik, spor: SporType): number {
  if (trafik === 'person') return 180;
  return spor === 'ballast' ? 160 : 170;
}
/** 4.2.4.2(2): ved perroner, hvor tog standser i normal drift. */
export const TSI_CANT_PERRON = 110;
/** 4.2.4.2(3): nye strækninger med blandet/godstrafik, R < 305 m og rampe stejlere end 1 mm/m: D ≤ (R − 50)/1,5. */
export const tsiCantSmallRadius = (R: number): number => (R - 50) / 1.5;
/** 4.2.8.5: største overhøjde i drift. */
export const tsiCantInService = (trafik: Trafik): number => (trafik === 'person' ? 190 : 180);

/* --------------------------- 4.2.4.3 Overhøjdeunderskud --------------------------- */

/** Tabel 8: rullende materiel efter TSI LOC&PAS. */
export const tsiCantDeficiency = (V: number): number => (V <= 300 ? 153 : 100);
/** Tabel 8: godsvogne efter TSI WAG (kun V ≤ 160). */
export const TSI_CANT_DEFICIENCY_WAG = 130;

/* ------------------- 4.2.4.4 Pludselig ændring af overhøjdeunderskud ------------------- */

export function tsiAbruptChange(V: number, Ifoer = Infinity, Iefter = Infinity): number {
  if (V <= 40 && Ifoer <= 75 && Iefter <= 75) return 150;
  if (V <= 60) return 130;
  if (V <= 200) return 125;
  if (V <= 230) return 85;
  return 25;
}

/* ------------------------------ 4.2.3 Linjeføring ------------------------------ */

export const TSI_R_MIN = 150; // 4.2.3.4(1) nye strækninger
export const TSI_RV_MIN = { top: 500, lavning: 900, pukkelTop: 250, pukkelLavning: 300 }; // 4.2.3.5
export const TSI_GRADIENT = { perron: 2.5, opstilling: 2.5, p1Maks: 35, p1Middel10km: 25, p1MaksLaengde: 6 }; // 4.2.3.3 [mm/m, km]

/** Tabel 4: mindste nominelle sporafstand for nye strækninger [m]. null = ikke fastsat (V ≤ 160). */
export function tsiTrackCentres(V: number): number | null {
  if (V <= 160) return null;
  if (V <= 200) return 3.8;
  if (V <= 250) return 4.0;
  if (V <= 300) return 4.2;
  return 4.5;
}

/* ------------------------------ 4.2.4 Sporparametre ------------------------------ */

export const TSI_GAUGE = 1435; // 4.2.4.1
export const TSI_RAIL_INCLINATION = { min: 20, max: 40, fraV: 60 }; // 4.2.4.7: 1/20–1/40 for V > 60 km/t

/** Tabel 10: ækvivalent konicitet, projekteringsgrænse (S1002, GV1/40). null = vurdering ikke krævet. */
export function tsiConicity(V: number): number | null {
  if (V <= 60) return null;
  if (V <= 200) return 0.25;
  if (V <= 280) return 0.2;
  return 0.1;
}

/** Tabel 12: grænseværdier for øjeblikkeligt indgreb, sporvidde [mm]. */
export function tsiGaugeIal(V: number): { min: number; max: number } {
  if (V <= 120) return { min: 1426, max: 1470 };
  if (V <= 160) return { min: 1427, max: 1470 };
  if (V <= 230) return { min: 1428, max: 1463 };
  return { min: 1430, max: 1463 };
}

/** 4.2.8.6: sporskifter og krydsninger, værdier i drift [mm]. */
export const TSI_SC = {
  friHjulpassageSporskifte: 1380,
  hjertestykkebeskyttelse: 1392,
  friHjulpassageHjertespids: 1356,
  friHjulpassageTvangskinne: 1380,
  rilleBreddeMin: 38,
  rilleDybdeMin: 40,
  tvangskinneHoejdeMax: 70,
};

/* ------------------------------ 4.2.9 Perroner ------------------------------ */

/** 4.2.9.2(1) og dansk særtilfælde 7.7.4.1 (S-tog 920 mm). */
export const TSI_PERRON_HOEJDER = [550, 760];
export const TSI_PERRON_HOEJDE_STOG = 920;
export const TSI_PERRON_R_MIN = 300; // 4.2.9.4(1) nye strækninger; 4.2.9.2(1) højder gælder for R ≥ 300 m
export const TSI_PERRON_BQ_TOL = 50; // 4.2.9.3(2): bq_lim ≤ bq ≤ bq_lim + 50 mm

/** Tabel 2: anvendelig perronlængde [m] for passagertrafikkoder. */
export const TSI_PERRON_LAENGDE: [string, string, string][] = [
  ['P1', '250–350', '400'], ['P2', '200–250', '200–400'], ['P3', '120–200', '200–400'],
  ['P4', '120–200', '200–400'], ['P5', '80–120', '50–200'], ['P6', 'n.a.', 'n.a.'],
];

/* ------------------------------ hjælpefunktioner ------------------------------ */

export const tsiStatus = (ok: boolean): Status => (ok ? 'ok' : 'overskredet');
export const TSI_KILDE = 'TSI INF (EU) 1299/2014';

/** Samlet TSI-kontrol for en kurve (bruges af overhøjde-, hastigheds- og radiusmodulerne). */
export function tsiCurveChecks(o: {
  R: number; V: number; h: number; I: number; trafik: Trafik; spor: SporType; perron: boolean; nyStraekning: boolean;
}): TsiCheck[] {
  const out: TsiCheck[] = [];
  const hMax = tsiCantMax(o.trafik, o.spor);
  out.push({ label: 'Projekteret overhøjde', value: `${fmt0(o.h)} mm`, graense: `≤ ${hMax} mm`, status: tsiStatus(o.h <= hMax), kilde: `${TSI_KILDE} 4.2.4.2, tabel 7` });
  if (o.perron) out.push({ label: 'Overhøjde ved perron', value: `${fmt0(o.h)} mm`, graense: `≤ ${TSI_CANT_PERRON} mm`, status: tsiStatus(o.h <= TSI_CANT_PERRON), kilde: `${TSI_KILDE} 4.2.4.2(2)` });
  if (o.nyStraekning && o.trafik === 'blandet' && o.R > 0 && o.R < 305) {
    const d = tsiCantSmallRadius(o.R);
    out.push({ label: 'Overhøjde ved R < 305 m', value: `${fmt0(o.h)} mm`, graense: `≤ (R − 50)/1,5 = ${fmt0(d)} mm`, status: tsiStatus(o.h <= d + 1e-9), kilde: `${TSI_KILDE} 4.2.4.2(3)` });
  }
  const iMax = tsiCantDeficiency(o.V);
  out.push({ label: 'Overhøjdeunderskud (LOC&PAS)', value: `${fmt0(o.I)} mm`, graense: `≤ ${iMax} mm`, status: tsiStatus(o.I <= iMax + 1e-9), kilde: `${TSI_KILDE} 4.2.4.3, tabel 8` });
  if (o.nyStraekning) out.push({ label: 'Mindste vandrette radius', value: `${fmt0(o.R)} m`, graense: `≥ ${TSI_R_MIN} m`, status: tsiStatus(o.R >= TSI_R_MIN), kilde: `${TSI_KILDE} 4.2.3.4(1)` });
  if (o.nyStraekning && o.perron) out.push({ label: 'Radius langs perron', value: `${fmt0(o.R)} m`, graense: `≥ ${TSI_PERRON_R_MIN} m`, status: tsiStatus(o.R >= TSI_PERRON_R_MIN), kilde: `${TSI_KILDE} 4.2.9.4(1)` });
  return out;
}

const fmt0 = (x: number) => (Number.isFinite(x) ? Math.round(x).toLocaleString('da-DK') : '–');
