/**
 * Banenorm BN1-13-4 «Ledningsanlæg på arealer og under spor, hvor Banedanmark er
 * infrastrukturforvalter» (udgivet 23.07.2024).
 */
import type { Status } from './rules';

export type Ledningstype = 'kabel' | 'elkabel' | 'gravitation' | 'tryk' | 'gas';
export type Metode = 'pilot' | 'styret' | 'presning' | 'aaben';

export const LEDNINGSTYPER: [Ledningstype, string][] = [
  ['kabel', 'Kabel / føringsrør (signal, tele, fiber)'],
  ['elkabel', 'Eksternt stærkstrømskabel'],
  ['gravitation', 'Ledning uden overtryk (spildevand, dræn m.v.)'],
  ['tryk', 'Ledning med overtryk (trykvand, trykkloak, fjernvarme)'],
  ['gas', 'Gas- eller olieledning'],
];

export const METODER: [Metode, string][] = [
  ['styret', 'Styret boring'],
  ['pilot', 'Styrbar jordfortrængning (pilotrør, lukket rør)'],
  ['presning', 'Underboring / gennempresning uden jordfortrængning'],
  ['aaben', 'Åben grav (ikke under eksisterende spor)'],
];

export interface Check { label: string; value: string; graense: string; status: Status; kilde: string }

export interface KrydsInput {
  type: Ledningstype;
  metode: Metode;
  /** Udvendig diameter af ledning/beskyttelsesrør [m] */
  D: number;
  /** Reamerens diameter ved styret boring [m] */
  reamer: number;
  /** Ledningstryk [bar] (gas/olie) */
  tryk: number;
  /** Projekteret dybde fra laveste SO til rørets top [m] */
  dybde: number;
  /** Afvigelse fra vinkelret krydsning [°] */
  vinkel: number;
  /** Afstand til nærmeste sporskifteende [m] */
  sporskifte: number;
  /** Antal parallelle ledninger og indbyrdes afstand [m] */
  antal: number;
  afstand: number;
  /** Dybde fra SO til bund af banegrøft [m] (0 = ingen) */
  groeft: number;
  /** Overcut (ringformet hulrum) [mm] */
  overcut: number;
  /** Eksisterende spor */
  eksisterende: boolean;
  /** Jævnstrømselektrificeret strækning */
  jaevnstroem: boolean;
  /** Beskyttelsesrør af metal */
  metal: boolean;
  /** Dybde fra SO til svelleunderside [m] */
  svelleUnderside: number;
}

export interface KrydsResultat {
  dybdeKrav: number;
  dybdeGrund: { navn: string; v: number }[];
  checks: Check[];
  beskyttelsesroer: boolean;
  skinneafstivning: { kraeves: boolean | 'vurder'; laengde: number };
  noter: string[];
}

const K = 'BN1-13-4';
const st = (ok: boolean): Status => (ok ? 'ok' : 'overskredet');
const f2 = (x: number) => x.toFixed(2).replace('.', ',');

/** Mindste dybde fra laveste SO til rørets top for krydsende ledninger. */
export function krydsDybde(i: KrydsInput): { navn: string; v: number }[] {
  const g: { navn: string; v: number }[] = [{ navn: 'Grundkrav (afsn. 11.2.1)', v: 1.6 }];
  if (i.metode === 'pilot') g.push({ navn: '10·D + 1,0 m (styrbar jordfortrængning, 12.1.1)', v: 10 * i.D + 1 });
  if (i.metode === 'presning') g.push({ navn: '2,0 m (underboring/gennempresning, 12.1.1)', v: 2.0 });
  if (i.metode === 'styret') g.push({ navn: '7·reamer + 1,0 m (styret boring, 12.1.1)', v: 7 * Math.max(i.reamer, i.D) + 1 });
  if (i.type === 'gas') g.push({ navn: `Gas/olie ${i.tryk > 4 ? '> 4' : '≤ 4'} bar (tabel 13.1-1)`, v: i.tryk > 4 ? 2.4 : 2.0 });
  if (i.groeft > 0) g.push({ navn: 'Banegrøftens bund + 0,50 m (11.2.1)', v: i.groeft + 0.5 });
  return g;
}

export function kryds(i: KrydsInput): KrydsResultat {
  const grunde = krydsDybde(i);
  const dybdeKrav = Math.max(...grunde.map((g) => g.v));
  const checks: Check[] = [];
  const noter: string[] = [];
  checks.push({ label: 'Dybde fra laveste SO til rørets top', value: `${f2(i.dybde)} m`, graense: `≥ ${f2(dybdeKrav)} m`, status: st(i.dybde >= dybdeKrav - 1e-9), kilde: `${K} 11.2.1, 12.1.1, 13.1` });
  checks.push({ label: 'Krydsningsvinkel (afvigelse fra vinkelret)', value: `${i.vinkel}°`, graense: '≤ 15°', status: st(i.vinkel <= 15), kilde: `${K} 11.2.1` });
  checks.push({ label: 'Afstand til ende af sporskifte/sporskæring', value: `${f2(i.sporskifte)} m`, graense: '≥ 10 m (aldrig under sporskifter)', status: st(i.sporskifte >= 10), kilde: `${K} 11.2.1` });
  if (i.eksisterende) checks.push({ label: 'Metode under eksisterende spor', value: METODER.find((m) => m[0] === i.metode)![1], graense: 'opgravningsfri', status: st(i.metode !== 'aaben'), kilde: `${K} 11.2.1` });
  if (i.metode === 'pilot') checks.push({ label: 'Rørdiameter ved styrbar jordfortrængning', value: `${f2(i.D * 1000 / 1000)} m`, graense: '≤ 0,20 m', status: st(i.D <= 0.2 + 1e-9), kilde: `${K} 12.1.2` });
  if (i.metode === 'styret') checks.push({ label: 'Rørdiameter ved styret boring', value: `${f2(i.D)} m`, graense: '≤ 0,40 m', status: st(i.D <= 0.4 + 1e-9), kilde: `${K} 12.1.2` });
  if (i.antal > 1) checks.push({ label: 'Afstand mellem ledninger (opgravningsfri)', value: `${f2(i.afstand)} m`, graense: `≥ dybden ${f2(i.dybde)} m`, status: st(i.afstand >= i.dybde - 1e-9), kilde: `${K} 12.1` });
  if (i.metode !== 'aaben') {
    const ocMax = i.D < 0.4 ? 25 : i.D < 0.8 ? 10 : 0;
    checks.push({ label: 'Overcut uden efterinjicering', value: `${i.overcut} mm`, graense: `≤ ${ocMax} mm – ellers efterinjiceres`, status: i.overcut <= ocMax ? 'ok' : 'undtagelse', kilde: `${K} 12.1` });
  }
  const beskyttelsesroer = i.type === 'tryk' || i.type === 'gas' || i.type === 'elkabel';
  if (beskyttelsesroer && i.jaevnstroem && i.metal) checks.push({ label: 'Beskyttelsesrør af metal på jævnstrømsstrækning', value: 'metal', graense: 'ikke tilladt', status: 'overskredet', kilde: `${K} 10.5` });
  if (i.type === 'gas' || i.type === 'tryk') noter.push('Ledning med indre overtryk skal i beskyttelsesrør; rørenden mindst 3 m fra foden af baneskråningen og mindst 1 m uden for baneskel (10.5).');
  if (i.type === 'elkabel') noter.push('Eksterne stærkstrømskabler under spor eller nærmere end 5 m fra spormidte skal i beskyttelsesrør af PE (12.6).');
  if (i.type === 'kabel') noter.push('Kabler, der krydser spor, lægges beskyttet – fortrinsvis i hulblok eller føringsrør. Fiberrørpakker: styret underboring af PE-føringsrør ≥ ø140 mm indv. (hele pakken) / ≥ ø100 mm (ét lag), trækbrønd på begge sider (12.7.2).');
  if ((i.type === 'tryk' || i.type === 'gas') && (i.metode === 'pilot' || i.metode === 'presning')) noter.push('Beskyttelsesrør for væskebærende ledninger ved pilotrør/gennempresning: ensidigt fald ≥ 3 ‰ mod brønd med afløb (13).');
  if (i.D >= 0.5) noter.push('D ≥ 0,5 m: geoteknisk undersøgelse kræves (boring på hver side af banen, højst 25 m mellem boringer) (11.1).');
  noter.push('Tværgående eksterne ledninger lægges under langsgående kabler; lodret afstand mindst 0,40 m (11.2.1).');
  noter.push('Dokumentér sporets relative beliggenhed før og efter boring iht. BN1-38; udarbejd teoretisk sætningsberegning (11.4, 12.1.1).');
  // Skinneafstivning: linjer med anlæg 1,5 fra rørets bredeste sted til svelleunderside
  const zC = i.dybde + i.D / 2;
  const laengde = i.D + 2 * 1.5 * Math.max(0, zC - i.svelleUnderside);
  let kraeves: boolean | 'vurder' = 'vurder';
  if (i.metode === 'presning' && i.D > 1.0) kraeves = true;
  checks.push({ label: 'Skinneafstivning', value: kraeves === true ? 'kræves (D > 1 m ubemandet)' : 'vurderes ud fra geoteknik', graense: `længde ≥ ${f2(laengde)} m hvis den bruges`, status: 'ok', kilde: `${K} 12.1.2` });
  return { dybdeKrav, dybdeGrund: grunde, checks, beskyttelsesroer, skinneafstivning: { kraeves, laengde }, noter };
}

/* ------------------------------ gas og olie ------------------------------ */

export function gasAfstande(tryk: number, D: number): { roerende: number; overjordisk: number; bygvaerker: [string, number][]; minAfstandFormel: number } {
  const hoej = tryk > 4;
  return {
    roerende: hoej ? 15 : 8,
    overjordisk: hoej ? 25 : 15,
    bygvaerker: [
      ['Fundamenter, master, sporstoppere m.v.', hoej ? 10 : 2],
      ['Broer, bygninger, overkørsler, overgange, perronender', hoej ? 20 : 2],
      ['Relæhuse / teknikhytter', 10],
      ['Relæskabe', 5],
    ],
    minAfstandFormel: 0.75 * D * tryk,
  };
}

/* ------------------------------ langsgående ------------------------------ */

export interface LangsInput {
  /** Vandret afstand fra spormidte [m] */
  a: number;
  /** Dybde fra laveste SO til top af ledning [m] */
  dybdeSO: number;
  /** Dybde under terræn [m] */
  dybdeTerraen: number;
  station: boolean;
  /** Midt mellem spor på station */
  mellemSpor: boolean;
  /** Kabelrende over jord */
  rende: boolean;
  /** Afstand fra nærmeste skinne til kabelrende [m] */
  aSkinne: number;
  /** Rendens højde over terræn [m] */
  hoejde: number;
  /** Planumsbredde Pb fra BN1-6 [m] */
  Pb: number;
  V: number;
  /** Brønd: afstand fra spormidte til nærmeste flade [m] (0 = ingen) */
  broend: number;
  ekstern: boolean;
}

export function langs(i: LangsInput): { checks: Check[]; noter: string[] } {
  const c: Check[] = [];
  const noter: string[] = [];
  if (i.ekstern) c.push({ label: 'Ekstern ledning langs sporet', value: 'ekstern', graense: 'ikke tilladt (undtagen i perroner)', status: 'overskredet', kilde: `${K} 11.2.2` });
  if (!(i.station && i.mellemSpor)) c.push({ label: 'Afstand fra spormidte', value: `${f2(i.a)} m`, graense: '≥ 2,50 m', status: st(i.a >= 2.5), kilde: `${K} 12.7.1` });
  else noter.push('Stationsområde: ledningsanlægget må placeres midt mellem sporene.');
  if (i.broend > 0) c.push({ label: 'Brønd – afstand fra spormidte til nærmeste flade', value: `${f2(i.broend)} m`, graense: '≥ 2,50 m (2,30 m ved pladsmangel)', status: i.broend >= 2.5 ? 'ok' : i.broend >= 2.3 ? 'undtagelse' : 'overskredet', kilde: `${K} 12.7.1` });
  if (!i.rende) {
    if (i.a < 3.5) c.push({ label: 'Dybde under laveste SO (< 3,5 m fra spormidte)', value: `${f2(i.dybdeSO)} m`, graense: '≥ 1,30 m', status: st(i.dybdeSO >= 1.3), kilde: `${K} 12.7.1` });
    else c.push({ label: `Dybde under terræn (${i.station ? 'station' : 'fri strækning'})`, value: `${f2(i.dybdeTerraen)} m`, graense: `≥ ${i.station ? '0,75' : '0,50'} m`, status: st(i.dybdeTerraen >= (i.station ? 0.75 : 0.5)), kilde: `${K} 12.7.1` });
  } else {
    const aMin = i.V <= 120 ? 2.75 : 3.25;
    c.push({ label: 'Kabelrende over jord – afstand fra nærmeste skinne', value: `${f2(i.aSkinne)} m`, graense: `≥ ${f2(aMin)} m (V ${i.V <= 120 ? '≤' : '>'} 120 km/t)`, status: st(i.aSkinne >= aMin), kilde: `${K} tabel 12.7-1` });
    c.push({ label: 'Kabelrende uden for planumsbredden', value: `${f2(i.a)} m fra spormidte`, graense: `≥ Pb = ${f2(i.Pb)} m`, status: st(i.a >= i.Pb), kilde: `${K} 12.7.1 / BN1-6` });
    c.push({ label: 'Rendens højde over terræn', value: `${f2(i.hoejde)} m`, graense: '≤ 0,20 m', status: st(i.hoejde <= 0.2), kilde: `${K} 12.7.1` });
    noter.push('Kabelrender i adgangsveje skal være nedgravet eller i niveau med terræn; må ikke hindre afvanding eller Forst fremføringsprofil.');
  }
  noter.push('Ledninger og kabelrender må ikke hindre afvanding af sporet eller selv fungere som drænsystem (12.7).');
  noter.push('Kabelpløjning er ikke tilladt i baneskråning med stabilt grus som underballast, medmindre underballasten komprimeres til 40 ‰ og kablet ligger uden for ballastprofilet (10.2).');
  return { checks: c, noter };
}
