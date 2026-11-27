/**
 * Kabelrende i tværprofilet efter BN1-13-4 «Ledningsanlæg på arealer og under spor, hvor Banedanmark er
 * infrastrukturforvalter», afsnit 12.7.1 og tabel 12.7-1, sammen med planumsbredden fra BN1-6-7.
 * Mål i meter. x vandret, y lodret nedad (som i bn16.ts), y = 0 ved laveste SO.
 */
import type { Check } from './bn113';

export type RendeSide = 'ingen' | 'venstre' | 'hoejre' | 'begge';
export type RendePlacering = 'overjord' | 'nedgravet';

export interface RendeParam {
  /** Vandret afstand fra nærmeste spormidte til rendens inderside (nærmeste flade) [m] */
  a: number;
  /** Udvendig bredde og højde [m] */
  B: number; H: number;
  /** Rendens top over terræn [m]; negativ = under terræn (dækning) */
  t: number;
  /** Fri bredde bag renden til skråningskanten [m] */
  bag: number;
  placering: RendePlacering;
}

/** Spormidte til yderkant af nærmeste skinnehoved: ½ · 1435 mm + 72 mm hovedbredde (60E2). Antaget målepunkt. */
export const SKINNE_YDERKANT = 0.7175 + 0.072;

/** Tabel 12.7-1: mindste afstand fra nærmeste skinne til kabelrende over jord. */
export const aSkinneMin = (V: number) => (V <= 120 ? 2.75 : 3.25);

/** Mindste a [m], som opfylder alle afstandskrav for en rende over jord. */
export function aMinOverjord(V: number, Pb: number): number {
  return Math.max(2.5, Pb, SKINNE_YDERKANT + aSkinneMin(V));
}

/** Rendens polygon. side = −1 venstre, +1 højre; cx = spormidte for sporet nærmest renden. */
export function rendeGeometri(r: RendeParam, side: -1 | 1, cx: number, terraen: (x: number) => number) {
  const xi = cx + side * r.a, xo = xi + side * r.B;
  const xm = (xi + xo) / 2;
  const top = terraen(xm) - r.t;
  const bund = top + r.H;
  const x1 = Math.min(xi, xo), x2 = Math.max(xi, xo);
  return { xi, xo, x1, x2, top, bund, terr: terraen(xm), poly: [{ x: x1, y: top }, { x: x2, y: top }, { x: x2, y: bund }, { x: x1, y: bund }] };
}

export interface RendeKontrolInput {
  r: RendeParam;
  /** Planumsbredde på rendens side (fra spormidte) [m] */
  Pb: number;
  V: number;
  station: boolean;
  /** Afstand fra spormidte til ballastfod på rendens side [m] */
  ballastfod: number;
  /** Dybde fra laveste SO til rendens top [m] */
  dybdeSO: number;
  sideTekst: string;
}

const K = 'BN1-13-4';
const f2 = (x: number) => x.toFixed(2).replace('.', ',');

export function rendeKontrol(i: RendeKontrolInput): Check[] {
  const { r } = i;
  const s = i.sideTekst;
  const c: Check[] = [];
  c.push({ label: `Kabelrende ${s}: afstand fra spormidte`, value: `${f2(r.a)} m`, graense: '≥ 2,50 m', status: r.a >= 2.5 - 1e-9 ? 'ok' : 'overskredet', kilde: `${K} 12.7.1` });
  if (r.placering === 'overjord') {
    c.push({ label: `Kabelrende ${s}: uden for planumsbredden (ballastrenseprofil)`, value: `${f2(r.a)} m`, graense: `≥ Pb = ${f2(i.Pb)} m`, status: r.a >= i.Pb - 1e-9 ? 'ok' : 'overskredet', kilde: `${K} 12.7.1 / BN1-6` });
    const aS = r.a - SKINNE_YDERKANT, min = aSkinneMin(i.V);
    c.push({ label: `Kabelrende ${s}: afstand fra nærmeste skinne (rømning)`, value: `${f2(aS)} m`, graense: `≥ ${f2(min)} m (V ${i.V <= 120 ? '≤' : '>'} 120 km/t)`, status: aS >= min - 1e-9 ? 'ok' : 'overskredet', kilde: `${K} tabel 12.7-1` });
    c.push({ label: `Kabelrende ${s}: højde over terræn`, value: `${f2(r.t)} m`, graense: '0 – 0,20 m', status: r.t <= 0.2 + 1e-9 && r.t >= -1e-9 ? 'ok' : 'overskredet', kilde: `${K} 12.7.1` });
  } else if (r.a < 3.5) {
    c.push({ label: `Kabelrende ${s}: dybde fra laveste SO til top (< 3,5 m fra spormidte)`, value: `${f2(i.dybdeSO)} m`, graense: '≥ 1,30 m', status: i.dybdeSO >= 1.3 - 1e-9 ? 'ok' : 'overskredet', kilde: `${K} 12.7.1` });
  } else {
    const min = i.station ? 0.75 : 0.5;
    c.push({ label: `Kabelrende ${s}: dækning under terræn (${i.station ? 'station' : 'fri strækning'})`, value: `${f2(-r.t)} m`, graense: `≥ ${f2(min)} m`, status: -r.t >= min - 1e-9 ? 'ok' : 'overskredet', kilde: `${K} 12.7.1` });
  }
  if (r.placering === 'overjord') c.push({ label: `Kabelrende ${s}: fri af ballastfoden`, value: `${f2(r.a - i.ballastfod)} m`, graense: '≥ 0,00 m', status: r.a >= i.ballastfod - 1e-9 ? 'ok' : 'overskredet', kilde: 'BN1-6-7 (geometri)' });
  return c;
}

export const RENDE_NOTER = [
  'Kabelrender må ikke hindre afvanding af sporet eller selv fungere som drænsystem (BN1-13-4, 12.7).',
  'Kabelrender i adgangsveje skal være gravet ned eller i niveau med terræn og må ikke udgøre en snublefare (12.7.1).',
  'Kabelrender over jord må ikke hindre Forst fremføringsprofil (12.7.1, note 12.7.1-2).',
  'Brønde og andre komponenter over jord skal holde samme afstand til nærmeste flade (≥ 2,50 m; 2,30 m ved pladsmangel) (12.7.1).',
  'På stationsområder tillades langsgående ledningsanlæg midt mellem sporene (12.7.1). Kravene gælder ikke kabelrender på/under broer – se BN1-59.',
  'Afstanden til nærmeste skinne regnes her til yderkanten af skinnehovedet (½ · 1435 + 72 mm) – normen angiver ikke målepunktet.',
];
