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
  /** Projekteret sporvidde for sveller på ret spor og R ≥ 190 m: 1437 mm (Sporregler 2.12.1; 1435 mm tilladt frem til 31.05.2021) */
  sporvidde: 1435 | 1437;
}

export const DEFAULT_SETTINGS: Settings = {
  skinne: '60E2', saerligeTogsaet: false, tsi: true, tsiTrafik: 'blandet', tsiSpor: 'ballast', nyStraekning: false, sporvidde: 1437,
};

export interface RuleSet {
  id: string;
  navn: string;
  sporvidde: number;
  kontaktafstand: number;
  g: number;
  /** Konstanten i h_a = C·V²/R; Sporreglerne bruger 11,8 i formel (1)–(14) */
  C: number;
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
  C: 11.8,
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
    label: 'I i krumme sporskifter',
    normal: 80,
    undtagelse: 80,
    unit: 'mm',
    note: 'Afvigende spor i i-krummede sporskifter og stamspor i u-krummede sporskifter med faste krydsninger: I ≤ 100 mm for V ≤ 100 km/t og I ≤ 80 mm for 100 < V ≤ 200 km/t (2.03.6). Bevægelig hjertespids: som almindeligt spor.',
    kilde: ['SR87 afsn. 2.03.6'],
    status: 'verificeret',
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
    label: 'Stigning/fald (hoved-, togvejs- og sidespor)',
    normal: 12.5,
    undtagelse: 15.6,
    unit: '‰',
    note: 'Ønskeligt p ≤ 8 ‰; normal p ≤ 12,5 ‰. Undtagelse: blandet trafik 15,6 ‰ (delstrækninger ≤ 3 km, Korsør–Sprogø) og 25 ‰ (≤ 0,5 km); spor reserveret persontrafik 25 ‰ (≤ 10 km) og 35 ‰ (≤ 6 km) (2.10.2).',
    kilde: ['SR87 afsn. 2.10.2'],
    status: 'verificeret',
  },

  stigningPerron: {
    label: 'Stigning langs perron / hensætningsspor',
    normal: 2.5,
    undtagelse: 10,
    unit: '‰',
    note: 'Ønskeligt p ≤ 1,5 ‰. Normal: ny perron og hensætningsspor 2,5 ‰, eksisterende perron 10 ‰. Undtagelse 10 ‰ (nye strækninger med regelmæssig til-/frakobling: 2,5 ‰) (2.10.2). TSI INF 4.2.3.3: 2,5 mm/m.',
    kilde: ['SR87 afsn. 2.10.2', 'TSI-INF 4.2.3.3'],
    status: 'verificeret',
  },

  lodretRadiusMin: {
    label: 'Mindste afrundingsradius R_L (V ≤ 200 km/t)',
    normal: 5000,
    undtagelse: 2000,
    unit: 'm',
    note: 'Normal: R_L ≥ 0,35·V², dog mindst 5.000 m ved nyanlæg, større ombygning, opgradering og sporskifter (2.000 m for eksisterende spor). Undtagelse: R_L ≥ 0,25·V², dog mindst 2.000 m (ikke sporskifter på bakkekam). V > 200: 0,35·V² ≥ 20.000 m / 0,175·V² ≥ 10.000 m (formel 39–42).',
    kilde: ['SR87 afsn. 2.10.3'],
    status: 'verificeret',
  },

  lodretRadiusMax: {
    label: 'Ønskelig afrundingsradius',
    normal: 40000,
    undtagelse: 40000,
    unit: 'm',
    note: 'Ønskeligt R_L ≥ 1,00·V² og 10.000 ≤ R_L ≤ 40.000 m for V ≤ 200; R_L = 40.000 m for 200 < V ≤ 250 (formel 37–38a).',
    kilde: ['SR87 afsn. 2.10.3'],
    status: 'verificeret',
  },

  lodretAccMax: {
    label: 'Lodret acceleration a_v',
    normal: 0.22,
    undtagelse: 0.31,
    unit: 'm/s²',
    note: 'Afledt af Sporreglernes R_L ≥ 0,35·V² (normal) og 0,25·V² (undtagelse): a_v = (V/3,6)²/R_L = 0,22 hhv. 0,31 m/s² (for V > 200 undtagelse 0,175·V² ≈ 0,44 m/s²).',
    kilde: ['SR87 afsn. 2.10.3'],
    status: 'verificeret',
  },

  radiusRetSpor: 25000,
};

/* ---------------- situationsafhængige grænser (Sporregler 2.02–2.10) ---------------- */

export interface HSituation {
  /** Blandet/gods eller spor reserveret persontrafik */
  trafik?: 'blandet' | 'person';
  sporskifte?: boolean;
  perron?: boolean;
  grus?: boolean;
}

/** Største overhøjde efter situation (2.03.4 formel 6–8 og 2.03.5). */
export function limitH(rs: RuleSet, o: HSituation = {}): Limit {
  const b = rs.overhoejdeMax;
  if (o.grus) return { ...b, label: 'Overhøjde h (grusballast)', normal: 80, undtagelse: 80, note: 'Spor og sporskifter på grusballasterede baner (formel 7b).' };
  if (o.perron) return { ...b, label: 'Overhøjde h langs perron', normal: 60, undtagelse: 110, note: 'Spor og sporskifter langs perroner for V < 250 km/t: h ≤ 60 mm (formel 8); undtagelse 110 mm (2.03.5).' };
  if (o.sporskifte) return { ...b, label: 'Overhøjde h i sporskifte', normal: 120, undtagelse: 160, note: 'Sporskifter på stenballasterede baner: h ≤ 120 mm (formel 6); undtagelse 160 mm (2.03.5). For 200 < V ≤ 250 km/t skal sporskifter ligge på ret spor uden overhøjde (2.03.6).' };
  return o.trafik === 'person' ? b : { ...b, undtagelse: 160, note: `${b.note} Undtagelsen på 180 mm gælder kun spor reserveret persontrafik – ved blandet trafik 160 mm.` };
}

/** Formel (4a): af hensyn til afsporingsrisiko i små radier skal h ≤ (R − 50)/1,5 altid være overholdt. */
export const hMaxAfsporing = (R: number): number => (R > 0 ? (R - 50) / 1.5 : Infinity);

/** Formel (4): ønskelig overhøjde h = 8·V²/R, dog højst 115 mm. */
export const hOenskelig = (V: number, R: number): number => (R > 0 ? Math.min(115, (8 * V * V) / R) : 0);

/** I i krumme sporskifter med faste krydsninger (2.03.6): 100 mm for V ≤ 100, 80 mm for 100 < V ≤ 200. */
export function limitISporskifte(rs: RuleSet, V: number): Limit {
  const v = V <= 100 ? 100 : 80;
  return { ...rs.manglendeOverhoejdeSporskifte, normal: v, undtagelse: v };
}

export type Sportype = 'hovedspor' | 'togvejsspor' | 'sidespor' | 'firmaspor';
export const SPORTYPE_TEKST: Record<Sportype, string> = {
  hovedspor: 'Hoved- og gennemkørselsspor', togvejsspor: 'Øvrige togvejsspor', sidespor: 'Sidespor', firmaspor: 'Firma- og havnespor',
};

/** Mindste cirkelbueradius efter sportype (2.02.2–2.02.4). */
export function radiusKrav(t: Sportype, perronNy = false): { oensket: number; normal: number; undtagelse: number; note: string } {
  if (perronNy) return { oensket: Infinity, normal: 300, undtagelse: 300, note: 'Spor langs perroner på nye strækninger: ønskeligt ret spor, normal R ≥ 300 m; ingen undtagelse (2.02.2–2.02.4).' };
  const o = { hovedspor: 700, togvejsspor: 500, sidespor: 190, firmaspor: 190 }[t];
  const n = { hovedspor: 300, togvejsspor: 190, sidespor: 190, firmaspor: 150 }[t];
  return { oensket: o, normal: n, undtagelse: 150, note: 'R ≥ 150 m kræver tilladelse; R < 190 m kræver sporudvidelse (2.12.2).' };
}

/** Krav til afrundingsradius R_L [m] (2.10.3). Situation: nyanlæg/ombygning/sporskifter eller eksisterende spor. */
export function afrundingsKrav(V: number, eksisterende = false): { oensket: [number, number]; normal: number; undtagelse: number } {
  if (V > 200) return { oensket: [40000, 40000], normal: Math.max(0.35 * V * V, 20000), undtagelse: Math.max(0.175 * V * V, 10000) };
  return {
    oensket: [Math.max(V * V, 10000), 40000],
    normal: Math.max(0.35 * V * V, eksisterende ? 2000 : 5000),
    undtagelse: Math.max(0.25 * V * V, 2000),
  };
}

/** Mindste længde af retlinet mellemstykke mellem kurver med separate overgangskurver (2.08.2–2.08.4) [m]. */
export function mellemstykkeKrav(V: number, dIunder40 = false): { oensket: number; normal: number; undtagelse: number } {
  if (V > 200) return { oensket: 0.67 * V, normal: 0.67 * V, undtagelse: dIunder40 ? 0.1 * V : 0.4 * V };
  return { oensket: Math.max(0.4 * V, 20), normal: Math.max(0.25 * V, 20), undtagelse: dIunder40 ? 0.1 * V : 0.2 * V };
}

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
 * Sporudvidelse i små kurver, Sporregler afsn. 2.12.2 figur 4 (rettelsesblade til 01.05.2017).
 * Fuldt til stede ved cirkelbuens startpunkt; tiltager jævnt over overgangskurven (uden overgangskurve 2,5 mm pr. 5 sveller).
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
