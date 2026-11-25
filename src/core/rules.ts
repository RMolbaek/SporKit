/**
 * Grænseværdier for sporgeometri – Banedanmark-profil.
 *
 * VIGTIGT: Værdierne herunder er samlet som arbejdsgrundlag og SKAL verificeres
 * mod den gældende udgave af Banedanmarks sporregler (banenormer for sporgeometri)
 * før de bruges til projektering. Hver værdi har en `note`, så kilden kan
 * dokumenteres, og `verificeret` sættes til true, når den er kontrolleret.
 *
 * Alle grænser har to niveauer:
 *  - normal:     værdi der må anvendes uden videre
 *  - undtagelse: absolut grænse, som kun må anvendes efter særlig godkendelse
 */

export interface Limit {
  normal: number;
  undtagelse: number;
  unit: string;
  label: string;
  note: string;
  verificeret: boolean;
}

export interface RuleSet {
  id: string;
  navn: string;
  /** Sporvidde [mm] */
  sporvidde: number;
  /** Afstand mellem hjulenes kontaktpunkter (skinnehovedmidte) [mm] */
  kontaktafstand: number;
  /** Tyngdeacceleration [m/s²] */
  g: number;
  overhoejdeMax: Limit;
  manglendeOverhoejdeMax: Limit;
  overskydendeOverhoejdeMax: Limit;
  /** Største overhøjdeændring pr. tid [mm/s] */
  dhdtMax: Limit;
  /** Største ændring af manglende overhøjde pr. tid [mm/s] */
  dIdtMax: Limit;
  /** Stejleste overhøjderampe [mm/m] (2,5 mm/m = 1:400) */
  dhdsMax: Limit;
  /** Rampehældning som funktion af hastighed: 1:(k·V) */
  rampeFaktor: Limit;
}

export const BANEDANMARK: RuleSet = {
  id: 'bdk',
  navn: 'Banedanmark – sporregler',
  sporvidde: 1435,
  kontaktafstand: 1500,
  g: 9.81,
  overhoejdeMax: {
    label: 'Overhøjde h',
    normal: 150,
    undtagelse: 160,
    unit: 'mm',
    note: 'Største overhøjde i kurve. Lavere grænse kan gælde ved perroner og i sporskifter.',
    verificeret: false,
  },
  manglendeOverhoejdeMax: {
    label: 'Manglende overhøjde I',
    normal: 100,
    undtagelse: 130,
    unit: 'mm',
    note: 'Konventionelle tog. Særlige værdier for krængetog er ikke medtaget.',
    verificeret: false,
  },
  overskydendeOverhoejdeMax: {
    label: 'Overskydende overhøjde E',
    normal: 70,
    undtagelse: 110,
    unit: 'mm',
    note: 'Gælder for langsomtkørende tog (typisk godstog) ved laveste hastighed.',
    verificeret: false,
  },
  dhdtMax: {
    label: 'Overhøjdeændring dh/dt',
    normal: 28,
    undtagelse: 46,
    unit: 'mm/s',
    note: 'Svarer til rampe 1:(10·V) normalt og 1:(6·V) som undtagelse.',
    verificeret: false,
  },
  dIdtMax: {
    label: 'Ændring af manglende overhøjde dI/dt',
    normal: 55,
    undtagelse: 70,
    unit: 'mm/s',
    note: 'Komfortkriterie i overgangskurven.',
    verificeret: false,
  },
  dhdsMax: {
    label: 'Rampehældning dh/ds',
    normal: 2.5,
    undtagelse: 2.5,
    unit: 'mm/m',
    note: 'Stejleste rampe 1:400 uanset hastighed (sporvridningshensyn).',
    verificeret: false,
  },
  rampeFaktor: {
    label: 'Rampe 1:(k·V)',
    normal: 10,
    undtagelse: 6,
    unit: '',
    note: 'Rampehældning afhængig af hastighed V [km/t].',
    verificeret: false,
  },
};

export type Status = 'ok' | 'undtagelse' | 'overskredet';

/** Vurderer en (absolut) værdi mod en grænse. */
export function vurder(value: number, limit: Limit): Status {
  const v = Math.abs(value);
  const eps = 1e-9;
  if (v <= limit.normal + eps) return 'ok';
  if (v <= limit.undtagelse + eps) return 'undtagelse';
  return 'overskredet';
}

export function samletStatus(statuses: Status[]): Status {
  if (statuses.includes('overskredet')) return 'overskredet';
  if (statuses.includes('undtagelse')) return 'undtagelse';
  return 'ok';
}
