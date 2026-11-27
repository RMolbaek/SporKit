/**
 * Kabelrender og brønde i tværprofilet efter BN1-13-4 «Ledningsanlæg på arealer og under spor, hvor Banedanmark er
 * infrastrukturforvalter», afsnit 12.7.1 og tabel 12.7-1, sammen med planumsbredden fra BN1-6-7.
 * Mål i meter. x vandret, y lodret nedad (som i bn16.ts), y = 0 ved laveste SO.
 */
import type { Check } from './bn113';
import type { Status } from './rules';

export type RendeSide = 'ingen' | 'venstre' | 'hoejre' | 'begge';
/** over jord på planumskronen / på spyd i baneskråningen / nedgravet */
export type RendePlacering = 'overjord' | 'spyd' | 'nedgravet';

export interface RendeParam {
  /** Vandret afstand fra nærmeste spormidte til rendens inderside (nærmeste flade) [m] */
  a: number;
  /** Udvendig bredde og højde [m] */
  B: number; H: number;
  /** Top over terræn [m] – ved spyd målt ved rendens inderside; negativ = under terræn */
  t: number;
  /** Fri bredde bag renden til skråningskanten [m] (ikke ved spyd) */
  bag: number;
  /** Spydenes nedramning i jorden [m] (spyd) */
  spydDybde: number;
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

export interface RendeGeo {
  xi: number; xo: number; x1: number; x2: number; top: number; bund: number; terr: number;
  /** Største højde af rendens top over terræn (under renden) [m] */
  hoejdeMax: number;
  /** Fri højde fra terræn ved inderside til rendens bund (spyd) [m] */
  frihoejde: number;
  /** Spyd: x, terrænhøjde og samlet længde */
  spyd: { x: number; terr: number; laengde: number }[];
  poly: { x: number; y: number }[];
}

/** Rendens geometri. side = −1 venstre, +1 højre; cx = spormidte for sporet nærmest renden. */
export function rendeGeometri(r: RendeParam, side: -1 | 1, cx: number, terraen: (x: number) => number): RendeGeo {
  const xi = cx + side * r.a, xo = xi + side * r.B;
  const xm = (xi + xo) / 2;
  const x1 = Math.min(xi, xo), x2 = Math.max(xi, xo);
  const ref = r.placering === 'spyd' ? terraen(xi) : terraen(xm);
  const top = ref - r.t;
  const bund = top + r.H;
  const hoejdeMax = Math.max(terraen(x1), terraen(xm), terraen(x2)) - top;
  const spyd = r.placering === 'spyd'
    ? [x1 + 0.15 * r.B, x2 - 0.15 * r.B].map((x) => ({ x, terr: terraen(x), laengde: terraen(x) - bund + r.spydDybde }))
    : [];
  return { xi, xo, x1, x2, top, bund, terr: terraen(xm), hoejdeMax, frihoejde: terraen(xi) - bund, spyd, poly: [{ x: x1, y: top }, { x: x2, y: top }, { x: x2, y: bund }, { x: x1, y: bund }] };
}

export interface RendeKontrolInput {
  r: RendeParam;
  geo: RendeGeo;
  /** Planumsbredde på rendens side (fra spormidte) [m] */
  Pb: number;
  V: number;
  station: boolean;
  /** Afstand fra spormidte til ballastfod på rendens side [m] */
  ballastfod: number;
  sideTekst: string;
}

const K = 'BN1-13-4';
const f2 = (x: number) => x.toFixed(2).replace('.', ',');
const ok = (b: boolean): Status => (b ? 'ok' : 'overskredet');

export function rendeKontrol(i: RendeKontrolInput): Check[] {
  const { r, geo } = i;
  const s = `Kabelrende ${i.sideTekst}`;
  const c: Check[] = [];
  c.push({ label: `${s}: afstand fra spormidte`, value: `${f2(r.a)} m`, graense: '≥ 2,50 m', status: ok(r.a >= 2.5 - 1e-9), kilde: `${K} 12.7.1` });
  if (r.placering !== 'nedgravet') {
    c.push({ label: `${s}: uden for planumsbredden (ballastrenseprofil)`, value: `${f2(r.a)} m`, graense: `≥ Pb = ${f2(i.Pb)} m`, status: ok(r.a >= i.Pb - 1e-9), kilde: `${K} 12.7.1 / BN1-6` });
    const aS = r.a - SKINNE_YDERKANT, min = aSkinneMin(i.V);
    c.push({ label: `${s}: afstand fra nærmeste skinne (rømning)`, value: `${f2(aS)} m`, graense: `≥ ${f2(min)} m (V ${i.V <= 120 ? '≤' : '>'} 120 km/t)`, status: ok(aS >= min - 1e-9), kilde: `${K} tabel 12.7-1` });
  }
  if (r.placering === 'overjord') {
    c.push({ label: `${s}: højde over terræn`, value: `${f2(r.t)} m`, graense: '0 – 0,20 m', status: ok(r.t <= 0.2 + 1e-9 && r.t >= -1e-9), kilde: `${K} 12.7.1` });
  } else if (r.placering === 'spyd') {
    c.push({ label: `${s}: fri højde over skråningen (rende på spyd)`, value: `${f2(geo.frihoejde)} m`, graense: '≥ 0,00 m', status: ok(geo.frihoejde >= -1e-9), kilde: 'geometri' });
    c.push({ label: `${s}: højde over terræn (største)`, value: `${f2(geo.hoejdeMax)} m`, graense: '≤ 0,20 m på fri terræn', status: geo.hoejdeMax <= 0.2 + 1e-9 ? 'ok' : 'undtagelse', kilde: `${K} 12.7.1` });
  } else if (r.a < 3.5) {
    c.push({ label: `${s}: dybde fra laveste SO til top (< 3,5 m fra spormidte)`, value: `${f2(geo.top)} m`, graense: '≥ 1,30 m', status: ok(geo.top >= 1.3 - 1e-9), kilde: `${K} 12.7.1` });
  } else {
    const min = i.station ? 0.75 : 0.5;
    c.push({ label: `${s}: dækning under terræn (${i.station ? 'station' : 'fri strækning'})`, value: `${f2(-r.t)} m`, graense: `≥ ${f2(min)} m`, status: ok(-r.t >= min - 1e-9), kilde: `${K} 12.7.1` });
  }
  if (r.placering !== 'nedgravet') c.push({ label: `${s}: fri af ballastfoden`, value: `${f2(r.a - i.ballastfod)} m`, graense: '≥ 0,00 m', status: ok(r.a >= i.ballastfod - 1e-9), kilde: 'BN1-6-7 (geometri)' });
  return c;
}

/* ------------------------------ brønde ------------------------------ */

export interface BroendParam {
  /** Afstand fra spormidte til brøndens nærmeste flade [m] */
  a: number;
  /** Udvendig bredde (på tværs af sporet) [m] */
  B: number;
  /** Bund under terræn [m] */
  D: number;
  /** Top (dæksel) over terræn [m] */
  t: number;
  bag: number;
}

export function broendGeometri(b: BroendParam, side: -1 | 1, cx: number, terraen: (x: number) => number) {
  const xi = cx + side * b.a, xo = xi + side * b.B;
  const x1 = Math.min(xi, xo), x2 = Math.max(xi, xo);
  const terr = terraen((xi + xo) / 2);
  return { xi, xo, x1, x2, top: terr - b.t, bund: terr + b.D, terr };
}

export function broendKontrol(b: BroendParam, ballastfod: number, sideTekst: string, dybdeSO: number): Check[] {
  const s = `Brønd ${sideTekst}`;
  const c: Check[] = [];
  c.push({ label: `${s}: afstand fra spormidte til nærmeste flade`, value: `${f2(b.a)} m`, graense: '≥ 2,50 m (≥ 2,30 m ved pladsmangel)', status: b.a >= 2.5 - 1e-9 ? 'ok' : b.a >= 2.3 - 1e-9 ? 'undtagelse' : 'overskredet', kilde: `${K} 12.7.1` });
  c.push({ label: `${s}: fri af ballastfoden`, value: `${f2(b.a - ballastfod)} m`, graense: '≥ 0,00 m', status: ok(b.a >= ballastfod - 1e-9), kilde: 'BN1-6-7 (geometri)' });
  c.push({ label: `${s}: bund under laveste SO`, value: `${f2(dybdeSO)} m`, graense: 'info – planlæg mod sporets bærelag', status: 'ok', kilde: 'geometri' });
  return c;
}

export const RENDE_NOTER = [
  'Kabelrender må ikke hindre afvanding af sporet eller selv fungere som drænsystem (BN1-13-4, 12.7).',
  'Kabelrender i adgangsveje skal være gravet ned eller i niveau med terræn og må ikke udgøre en snublefare (12.7.1).',
  'Kabelrender over jord må ikke hindre Forst fremføringsprofil (12.7.1, note 12.7.1-2).',
  'På stationsområder tillades langsgående ledningsanlæg midt mellem sporene (12.7.1). Kravene gælder ikke kabelrender på/under broer – se BN1-59.',
  'Afstanden til nærmeste skinne regnes her til yderkanten af skinnehovedet (½ · 1435 + 72 mm) – normen angiver ikke målepunktet.',
];

export const SPYD_NOTER = [
  'Rende på spyd: BN1-13-4 har ingen særskilte regler for spyd – kravene til kabelrende over jord (afstand fra spormidte, uden for Pb, tabel 12.7-1) er anvendt. Kravet om højst 0,20 m over terræn gælder «på fri terræn»; i baneskråningen er det markeret som undtagelse til vurdering.',
  'Spydenes længde og nedramning er projektspecifik (leverandørens anvisning og geoteknik) – værdien her er kun et overslag.',
];

export const BROEND_NOTER = [
  'Brønde, kabelbrønde m.v. over jord skal holde samme afstand som ledningsanlægget regnet til nærmeste flade mod spormidten (≥ 2,50 m); hvor pladsforholdene kræver det, tillades mindst 2,30 m (BN1-13-4, 12.7.1).',
  'Signal-/telekabler skal føres i eksisterende kabelrør og -brønde (12.7.1). Ved krydsning af spor med fiberrørpakker sættes en trækbrønd på begge sider af banen (12.7.2).',
];
