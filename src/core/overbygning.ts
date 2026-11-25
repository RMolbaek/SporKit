/**
 * Data for overbygning (svelle, skinne, befæstelse og tværprofil).
 * Kilde: Banedanmark, Sporteknik 2. udg. (2016) – sidehenvisninger i `kilde`.
 */
export type SvelleType = 'S99' | 'S16';

export interface Svelle {
  id: SvelleType;
  navn: string;
  overbygning: string;
  befaestelse: string;
  hoejde: number; // mm
  bredde: number; // mm
  laengde: number; // mm
  vaegt: number; // kg
  armering: string;
  hastighed: string;
  aksellast: string;
  sporvidde: number; // mm nominel
  kilde: string;
}

export const SVELLER: Record<SvelleType, Svelle> = {
  S99: {
    id: 'S99',
    navn: 'S99 monobloksvelle',
    overbygning: 'UIC60 Dmp (60E2)',
    befaestelse: 'Pandrol Fastclip FC',
    hoejde: 206, bredde: 300, laengde: 2500, vaegt: 240,
    armering: '10 tråde', hastighed: '180 km/t', aksellast: '22,5 t',
    sporvidde: 1435,
    kilde: 'Sporteknik s. 30, 41, 83–84',
  },
  S16: {
    id: 'S16',
    navn: 'S16 monobloksvelle',
    overbygning: 'UIC60 Dme (60E2)',
    befaestelse: 'Pandrol Fastclip FE',
    hoejde: 224, bredde: 280, laengde: 2500, vaegt: 290,
    armering: '12 tråde', hastighed: '250 km/t (25 t: 100 km/t)', aksellast: '22,5 t (25 t)',
    sporvidde: 1437,
    kilde: 'Sporteknik s. 41–42, 84, 274',
  },
};

/** Skinne 60E2 – hovedmål (DS/EN 13674-1). */
export const SKINNE_60E2 = {
  hoejde: 172, fod: 150, hoved: 72, krop: 16.5, vaegt: 60.0, haeldning: 40,
};

/** Tværprofil – eksempel for nyanlæg af hovedspor 160 < V ≤ 200 km/t (Sporteknik s. 32, BN1-6). */
export const TVAERPROFIL = {
  skulder: 550, // Bsk [mm]
  anlaeg: 1.5, // skråning 1:1,5
  ballast: 300, // Bt [mm] under svelle
  underballast: 250, // Ut [mm]
  planumHaeldning: 0.04, // 40 ‰
  saenkningV160: 40, // ballast sænkes 4 cm mellem skinnerne ved V > 160
};

export const SVELLEAFSTAND = 625; // mm c/c (Sporteknik s. 159 / BN1-66)
export const MELLEMLAEG_DMP = { haard: '94 kN/mm (V ≤ 120 km/t)', bloed: '77 kN/mm (V > 120 km/t)' };
