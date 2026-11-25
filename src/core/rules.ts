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
}

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
    note: 'Sporregler afsn. 2.03. Lavere grænser kan gælde ved perroner, overkørsler og hvor tog skal holde stille.',
    kilde: ['SR87 afsn. 2.03', 'ST16 s. 244'],
    status: 'sekundaer',
  },
  manglendeOverhoejdeMax: {
    label: 'Overhøjdeunderskud I',
    normal: 100,
    undtagelse: 130,
    unit: 'mm',
    note:
      'Undtagelse afhænger af skinne og hastighed: 60E2/DSB60 (A ≤ 22,5 t): 130 mm for V ≤ 140, 153 mm for 140 < V ≤ 250, særlige togsæt 160 mm. DSB45: 130 mm.',
    kilde: ['SR87 afsn. 2.03', 'ST16 s. 244'],
    status: 'sekundaer',
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
    normal: 70,
    undtagelse: 110,
    unit: 'mm',
    note: 'Langsomt kørende tog (typisk gods). Værdi ikke fundet i dansk kilde – kontrollér mod Sporregler afsn. 2.03.',
    kilde: ['EN13803'],
    status: 'antaget',
  },
  dhdtMax: {
    label: 'Overhøjdeændring dh/dt',
    normal: 28,
    undtagelse: 46,
    unit: 'mm/s',
    note: 'Svarer til rampe 1:(10·V) og 1:(6·V). Kontrollér mod Sporregler afsn. 2.06.',
    kilde: ['SR87 afsn. 2.06', 'EN13803'],
    status: 'antaget',
  },
  dIdtMax: {
    label: 'Ændring af overhøjdeunderskud dI/dt',
    normal: 55,
    undtagelse: 70,
    unit: 'mm/s',
    note: 'Bestemmende for overgangskurvens længde. Kontrollér mod Sporregler afsn. 2.05.',
    kilde: ['SR87 afsn. 2.05', 'EN13803'],
    status: 'antaget',
  },
  dhdsMax: {
    label: 'Stejleste rampe dh/ds',
    normal: 2.5,
    undtagelse: 2.5,
    unit: 'mm/m',
    note: 'Svarer til 1:400 uanset hastighed. Kontrollér mod Sporregler afsn. 2.06.',
    kilde: ['SR87 afsn. 2.06'],
    status: 'antaget',
  },
  rampeFaktor: {
    label: 'Rampe 1:(k·V)',
    normal: 10,
    undtagelse: 6,
    unit: '',
    note: 'Rampehældning afhængig af hastighed V [km/t]. Kontrollér mod Sporregler afsn. 2.06.',
    kilde: ['SR87 afsn. 2.06'],
    status: 'antaget',
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

/** Undtagelsesværdien for I afhænger af skinne, hastighed og togtype (Sporregler 2.03). */
export function iUndtagelse(V: number, s: Settings): number {
  if (s.skinne === 'DSB45') return 130;
  if (s.saerligeTogsaet) return 160;
  return V <= 140 ? 130 : 153;
}

/** Grænsen for I tilpasset hastighed og indstillinger. */
export function limitI(rs: RuleSet, V: number, s: Settings): Limit {
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
    if (raw) return { skinne: '60E2', saerligeTogsaet: false, ...JSON.parse(raw) };
  } catch { /* */ }
  return { skinne: '60E2', saerligeTogsaet: false };
}
export function saveSettings(s: Settings): void {
  try { localStorage.setItem(SKEY, JSON.stringify(s)); } catch { /* */ }
}
