/**
 * Grænseværdier for sporgeometri – Banedanmark-profil.
 *
 * Hver værdi har en kildestatus:
 *  - 'verificeret': kontrolleret direkte i det gældende regelsæt
 *  - 'sekundaer':   gengivet fra Banedanmarks lærebog "Sporteknik" (2016), som citerer Sporregler
 *  - 'antaget':     ingen dansk kilde fundet endnu – SKAL kontrolleres
 *
 * Alle grænser har to niveauer:
 *  - normal:     normalbestemmelse
 *  - undtagelse: undtagelsesbestemmelse (kræver dispensation/godkendelse)
 */

export type Kildestatus = 'verificeret' | 'sekundaer' | 'antaget';

export interface Limit {
  label: string;
  normal: number;
  undtagelse: number;
  unit: string;
  note: string;
  /** Reference-id'er (se references.ts) og evt. afsnit/side */
  kilde: string[];
  status: Kildestatus;
}

export type Skinne = '60E2' | 'DSB45';

export interface Settings {
  skinne: Skinne;
  saerligeTogsaet: boolean;
  /** Kontrollér også mod TSI INF */
  tsi: boolean;
  tsiTrafik: 'blandet' | 'person';
  tsiSpor: 'ballast' | 'fast';
  /** Nyanlæg (TSI-krav for nye strækninger gælder) */
  nyStraekning: boolean;
  /** Projekteret sporvidde på ret spor og R ≥ 190 m (1437 mm på TEN-strækninger) */
  sporvidde: 1435 | 1437;
}

export const DEFAULT_SETTINGS: Settings = {
  skinne: '60E2', saerligeTogsaet: false, tsi: true, tsiTrafik: 'blandet', tsiSpor: 'ballast', nyStraekning: false, sporvidde: 1435,
};

export interface RuleSet {
  id: string;
  navn: string;
  sporvidde: number;
  kontaktafstand: number;
  g: number;
  overhoejdeMax: Limit;
  manglendeOverhoejdeMax: Limit;
  manglendeOverhoejdeSporskifte: Limit;
  overskydendeOverhoejdeMax: Limit;
  dhdtMax: Limit;
  dIdtMax: Limit;
  dhdsMax: Limit;
  rampeFaktor: Limit;
  stigningMax: Limit;
  stigningPerron: Limit;
  lodretRadiusMin: Limit;
  lodretRadiusMax: Limit;
  lodretAccMax: Limit;
  radiusRetSpor: number;
}

export const BANEDANMARK: RuleSet = {
  id: 'bdk',
  navn: 'Banedanmark – Sporregler',
  sporvidde: 1435,
  kontaktafstand: 1500,
  g: 9.81,
  overhoejdeMax: {
    label: 'Overhøjde h',
    normal: 160,
    undtagelse: 180,
    unit: 'mm',
    note: 'Stenballasterede spor h ≤ 160 mm (formel 7a); undtagelse 180 mm for spor reserveret persontrafik. Sporskifter 120/160 mm, grusballast 80 mm, langs perroner 60/110 mm (formel 6–8).',
    kilde: ['SR87 afsn. 2.03.4–2.03.5', 'ST16 s. 244'],
    status: 'verificeret',
  },
  manglendeOverhoejdeMax: {
    label: 'Overhøjdeunderskud I',
    normal: 100,
    undtagelse: 130,
    unit: 'mm',
    note:
      'Undtagelse afhænger af skinne og hastighed: 60E2/DSB60 (A ≤ 22,5 t): 130 mm for V ≤ 140, 153 mm for 140 < V ≤ 250, særlige togsæt 160 mm. DSB45: 130 mm.',
    kilde: ['SR87 afsn. 2.03.4–2.03.5', 'ST16 s. 244'],
    status: 'verificeret',
  },
  manglendeOverhoejdeSporskifte: {
    label: 'I i krumme sporskifter (V > 100 km/t)',
    normal: 80,
    undtagelse: 80,
    unit: 'mm',
    note: 'Vigespor i I-krumme sporskifter og U-krumme sporskifter ved V > 100 km/t (tvangskinnepåvirkning).',
    kilde: ['ST16 s. 246–247', 'BN1-14'],
    status: 'sekundaer',
  },
  overskydendeOverhoejdeMax: {
    label: 'Overhøjdeoverskud E',
    normal: 110,
    undtagelse: 110,
    unit: 'mm',
    note: 'Delstrækninger der jævnligt befares med langsomt kørende godstog: h = 11,8·Vg²/R + E med E ≤ 110 mm (formel 9). Ved nyanlæg, større ombygninger og opgraderinger også langsomt kørende passagertog.',
    kilde: ['SR87 afsn. 2.03.4 formel (9)'],
    status: 'verificeret',
  },

  dhdtMax: {
    label: 'Overhøjdeændring dh/dt',
    normal: 50,
    undtagelse: 70,
    unit: 'mm/s',
    note: 'Retlinet overhøjderampe: Δh·V/(3,6·L) ≤ 50 mm/s (normal, formel 25); ønskeligt ≤ 35 mm/s (formel 24). Undtagelse ved sammenfaldende overgangskurve og rampe: 70 mm/s for V ≤ 200 og 60 mm/s for 200 < V ≤ 250 km/t (formel 26a/26b).',
    kilde: ['SR87 afsn. 2.06.2–2.06.4'],
    status: 'verificeret',
  },

  dIdtMax: {
    label: 'Ændring af overhøjdeunderskud dI/dt',
    normal: 55,
    undtagelse: 90,
    unit: 'mm/s',
    note: 'Klotoide: ΔI·V/(3,6·L) ≤ 55 mm/s for V ≤ 200 og 50 mm/s for 200 < V ≤ 250 km/t (normal, formel 15a/15b); undtagelse 90 hhv. 75 mm/s (formel 18/19). Overgangskurven skal mindst være 20 m.',
    kilde: ['SR87 afsn. 2.05.2–2.05.3'],
    status: 'verificeret',
  },

  dhdsMax: {
    label: 'Rampestigning s',
    normal: 2.0,
    undtagelse: 2.5,
    unit: '‰',
    note: 'Retlinet overhøjderampe: s ≤ 2,0 ‰ (normal, 2.06.3); ved undtagelsesbestemmelserne s ≤ 2,5 ‰ (2.06.4).',
    kilde: ['SR87 afsn. 2.06.3–2.06.4'],
    status: 'verificeret',
  },

  rampeFaktor: {
    label: 'Ikke-sammenfaldende rampe 1:(k·V)',
    normal: 8,
    undtagelse: 5.6,
    unit: '',
    note: 'Kun når rampen forlænges uden for overgangskurven (2.06.5): s ≤ 125/V ‰, dvs. 1:(8·V) (formel 28); særlige togsæt s ≤ 180/V ‰, dvs. 1:(5,6·V) (formel 28a). For sammenfaldende rampe og overgangskurve er dh/dt og s bestemmende.',
    kilde: ['SR87 afsn. 2.06.5'],
    status: 'verificeret',
  },

  stigningMax: {
    label: 'Stigning/fald i hovedspor',
    normal: 10,
    undtagelse: 15.6,
    unit: '‰',
    note: 'Normalt maks. 10 ‰; maks. 15,6 ‰ (Storebælt, østtunnel).',
    kilde: ['SR87 afsn. 2.10', 'ST16 s. 240'],
    status: 'sekundaer',
  },
  stigningPerron: {
    label: 'Stigning ved perron/opstillingsspor',
    normal: 1.5,
    undtagelse: 1.5,
    unit: '‰',
    note: 'Sporet bør ligge tilnærmelsesvis vandret.',
    kilde: ['ST16 s. 240'],
    status: 'sekundaer',
  },
  lodretRadiusMin: {
    label: 'Mindste lodrette radius (hovedbaner)',
    normal: 5000,
    undtagelse: 5000,
    unit: 'm',
    note: 'Cirkelbuer i længdeprofilet på hovedbaner.',
    kilde: ['SR87 afsn. 2.10', 'ST16 s. 240'],
    status: 'sekundaer',
  },
  lodretRadiusMax: {
    label: 'Største lodrette radius',
    normal: 40000,
    undtagelse: 40000,
    unit: 'm',
    note: 'Cirkelbuer i længdeprofilet på hovedbaner.',
    kilde: ['ST16 s. 240'],
    status: 'sekundaer',
  },
  lodretAccMax: {
    label: 'Lodret acceleration a_v',
    normal: 0.22,
    undtagelse: 0.31,
    unit: 'm/s²',
    note: 'Komfortkriterie i lodrette kurver (svarer til R_v ≈ 0,35·V² hhv. 0,25·V²).',
    kilde: ['EN13803'],
    status: 'antaget',
  },
  radiusRetSpor: 25000,
};

/* ---------------- hastighedsafhængige grænser (Sporregler 2.05–2.06) ---------------- */

/** dh/dt for retlinet overhøjderampe: normal 50; undtagelse 70 (V ≤ 200) / 60 (200 < V ≤ 250) mm/s. */
export function limitDhdt(rs: RuleSet, V: number): Limit {
  return { ...rs.dhdtMax, undtagelse: V <= 200 ? rs.dhdtMax.undtagelse : 60 };
}

/** dI/dt i klotoide: normal 55/50, undtagelse 90/75 mm/s for V ≤ 200 / 200 < V ≤ 250. */
export function limitDIdt(rs: RuleSet, V: number): Limit {
  return V <= 200 ? rs.dIdtMax : { ...rs.dIdtMax, normal: 50, undtagelse: 75 };
}

/** Mindste overgangskurvelængde [m] (2.05.2). */
export const MIN_OVERGANGSKURVE = 20;

/** Fiktiv overgangskurvelængde = afstand mellem en personvogns boggiecentre (tillæg 2C). */
export const FIKTIV_LAENGDE = 20;

/** Fiktivt ryk dI/dt = ΔI·V / (3,6·20) [mm/s] ved spring i krumning/underskud uden overgangskurve. */
export function fiktivtRyk(dI: number, V: number): number {
  return (Math.abs(dI) * V) / (3.6 * FIKTIV_LAENGDE);
}

export type SporKlasse = 'hovedspor' | 'oevrige';

/**
 * Grænser for fiktivt ryk, når overgangskurven udelades (Sporregler 2.05.2–2.05.3):
 *  - hovedspor og gennemgående togvejsspor: normal 28 mm/s (formel 15, V ≤ 200); undtagelse 135 mm/s (V ≤ 200, formel 20) / 75 mm/s (200 < V ≤ 250, formel 21)
 *  - øvrige togvejsspor og sidespor: 71 mm/s (formel 17)
 */
export function limitFiktivtRyk(V: number, klasse: SporKlasse): Limit {
  const base: Omit<Limit, 'normal' | 'undtagelse'> = {
    label: 'Fiktivt ryk dI/dt = ΔI·V/(3,6·20)', unit: 'mm/s',
    note: 'Spring i krumning uden overgangskurve (ret–kurve, ensvendte eller modvendte cirkelbuer). Formel (15) er her læst med den fiktive længde 20 m (tillæg 2C). Gælder ikke ind/ud af sporskiftekurver (2.04.6).',
    kilde: ['SR87 afsn. 2.05.2–2.05.3, tillæg 2C'], status: 'verificeret',
  };
  if (klasse === 'oevrige') return { ...base, normal: 71, undtagelse: 71 };
  if (V <= 200) return { ...base, normal: 28, undtagelse: 135 };
  return { ...base, normal: 0, undtagelse: 75 };
}

/** Største tilladte spring ΔI ved fiktivt ryk (forudsætning for formel 20/21). */
export function limitSpringI(V: number, Ifoer = Infinity, Iefter = Infinity): number {
  if (V <= 40 && Math.abs(Ifoer) <= 75 && Math.abs(Iefter) <= 75) return 150;
  if (V <= 60) return 130;
  if (V <= 200) return 125;
  if (V <= 230) return 85;
  return 25;
}

/** Undtagelsesværdien for I afhænger af skinne, hastighed og togtype (Sporregler 2.03). */
export function iUndtagelse(V: number, s: Pick<Settings, 'skinne' | 'saerligeTogsaet'>): number {
  if (s.skinne === 'DSB45') return 130;
  if (s.saerligeTogsaet) return 160;
  return V <= 140 ? 130 : 153;
}

/** Grænsen for I tilpasset hastighed og indstillinger. */
export function limitI(rs: RuleSet, V: number, s: Pick<Settings, 'skinne' | 'saerligeTogsaet'>): Limit {
  return { ...rs.manglendeOverhoejdeMax, undtagelse: iUndtagelse(V, s) };
}

export type Status = 'ok' | 'undtagelse' | 'overskredet';

export function vurder(value: number, limit: Limit): Status {
  const v = Math.abs(value);
  const eps = 1e-9;
  if (v <= limit.normal + eps) return 'ok';
  if (v <= limit.undtagelse + eps) return 'undtagelse';
  return 'overskredet';
}

/** Vurdering hvor værdien skal være STØRRE end grænsen (fx radius). */
export function vurderMin(value: number, limit: Limit): Status {
  const eps = 1e-9;
  if (value >= limit.normal - eps) return 'ok';
  if (value >= limit.undtagelse - eps) return 'undtagelse';
  return 'overskredet';
}

export function samletStatus(statuses: Status[]): Status {
  if (statuses.includes('overskredet')) return 'overskredet';
  if (statuses.includes('undtagelse')) return 'undtagelse';
  return 'ok';
}

/* ------------------------- globale indstillinger ------------------------- */

const SKEY = 'sporkit:settings';
export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SKEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { /* */ }
  return { ...DEFAULT_SETTINGS };
}
export function saveSettings(s: Settings): void {
  try { localStorage.setItem(SKEY, JSON.stringify(s)); } catch { /* */ }
}

/* ------------------------------ sporudvidelse ------------------------------ */

/**
 * Sporudvidelse i små kurver, Sporregler afsn. 2.12 (gengivet i Sporteknik 2016, s. 254).
 * Bemærk: Sporteknik skriver i teksten «kun ved R ≤ 175 m», men tabellen giver +5 mm for 175 ≤ R < 190 m.
 * SporKit følger tabellen.
 */
export const SPORUDVIDELSE: { fra: number; til: number; mm: number }[] = [
  { fra: 190, til: Infinity, mm: 0 },
  { fra: 175, til: 190, mm: 5 },
  { fra: 150, til: 175, mm: 10 },
  { fra: 0, til: 150, mm: 15 },
];

export function sporudvidelse(R: number): number {
  if (!(R > 0)) return 0; // ret spor
  return SPORUDVIDELSE.find((x) => R >= x.fra && R < x.til)?.mm ?? 0;
}

/** Projekteret sporvidde [mm] = nominel (1435/1437) + sporudvidelse. */
export function projekteretSporvidde(R: number, nominel: 1435 | 1437 = 1435): number {
  const u = sporudvidelse(R);
  // Sporudvidelsen regnes fra 1435 mm; 1437 mm gælder kun på ret spor og R ≥ 190 m (BN1-38 fodnote 10)
  return u > 0 ? 1435 + u : nominel;
}
