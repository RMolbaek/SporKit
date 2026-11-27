/**
 * Banenorm BN1-38-6 «Sporbeliggenhedskontrol og sporkvalitetsnormer» (udgivet 01.01.2019).
 * Tabel 11.3.2-1 og 11.3.2-2 (målevogn/-dræsine), 11.5.2-1/-2 (konicitet), afsnit 17.
 * Fejlklasse 0/1/3 er BN2-krav, fejlklasse 4 og Max/Min er BN1-krav.
 */
import type { Status } from './rules';

export type Kvalitetsklasse = 'A1' | 'A' | 'B' | 'C' | 'D' | 'E' | 'S';

export function kvalitetsklasse(V: number, sidespor = false): Kvalitetsklasse {
  if (sidespor) return 'S';
  if (V > 200) return 'A1';
  if (V > 160) return 'A';
  if (V > 120) return 'B';
  if (V > 80) return 'C';
  if (V > 40) return 'D';
  return 'E';
}

/** Overhøjdens afvigelse fra projekteret [mm], fejlklasse 0, 1, 3, 4 (3 og 4 = ujævnhed over 20 m). */
export const OVH_AFVIGELSE: Record<Kvalitetsklasse, [number, number, number, number]> = {
  A1: [2, 3, 6, 8], A: [2, 3, 6, 8], B: [3, 4, 6, 9], C: [3, 4, 8, 11], D: [3, 5, 10, 13], E: [3, 5, 10, 15], S: [3, 5, 10, 15],
};

/** Absolut overhøjde, 0-linje til spids [mm]: fejlklasse 4 og Max. Blandet/gods hhv. ren passagertrafik. */
export const ABS_OVH = { blandet: { fk4: 177, max: 180 }, person: { fk4: 187, max: 190 } };

export type Base = 2 | 3 | 6 | 9 | 12 | 15;
export const BASER: Base[] = [2, 3, 6, 9, 12, 15];
export const BASE_TEKST: Record<Base, string> = { 2: '1,5 / 2 m', 3: '2,5 / 3 m', 6: '6 m', 9: '9 m', 12: '12 m', 15: '15 m' };

export interface VridGraense {
  fk0?: number; fk1?: number; fk3?: number; fk4: number;
  /** Max – [lav, høj]; lav anvendes ved R ≤ 500 m og h > (R − 100)/2 (afsnit 17) */
  max: [number, number];
}

/** Tabel 11.3.2-1: vridning [mm/m], 0-linje til spids (fejlklasse 0 og 1 fra middellinje). */
export function vridGraense(k: Kvalitetsklasse, b: Base): VridGraense {
  const a1 = k === 'A1';
  switch (b) {
    case 2: return { fk4: 4.5, max: a1 ? [7.0, 7.0] : [6.0, 7.0] };
    case 3: {
      const fk0 = ['D', 'E', 'S'].includes(k) ? 1.5 : 1.0;
      const fk1 = ['A1', 'A'].includes(k) ? 1.0 : 1.5;
      return { fk0, fk1, fk3: a1 ? 2.0 : 3.0, fk4: a1 ? 3.0 : 4.0, max: a1 ? [5.0, 5.0] : [6.0, 7.0] };
    }
    case 6: return { fk4: 3.0, max: a1 ? [5.0, 5.0] : [4.0, 5.5] };
    case 9: return { fk4: 2.8, max: a1 ? [4.8, 4.8] : [3.3, 4.8] };
    case 12: return { fk4: 2.8, max: a1 ? [4.4, 4.4] : [3.0, 4.4] };
    case 15: return { fk4: 2.8, max: a1 ? [4.0, 4.0] : [3.0, 4.0] };
  }
}

/** Afsnit 17: skal den laveste Max-værdi for vridning anvendes? */
export const lavVridMax = (R: number, h: number): boolean => R > 0 && R <= 500 && h > (R - 100) / 2;

/** Største vridning [mm/m] over målebase b fra en retlinet rampe Δh over længden L. */
export function rampeVridning(dh: number, L: number, b: number): number {
  if (!(L > 0)) return Math.abs(dh) / b; // spring: hele ændringen inden for basen
  return b <= L ? Math.abs(dh) / L : Math.abs(dh) / b;
}

/** Tabel 11.3.2-2: sporvidde punktfejl [mm] i forhold til 1435 (1437). [plus, minus]. */
export const SPORVIDDE: Record<Kvalitetsklasse, { fk0: number; fk1: [number, number]; fk3: [number, number]; fk4: [number, number]; max: [number, number] }> = {
  A1: { fk0: 2, fk1: [4, 2], fk3: [10, 3], fk4: [15, 3], max: [28, 5] },
  A: { fk0: 2, fk1: [5, 2], fk3: [12, 5], fk4: [20, 5], max: [28, 7] },
  B: { fk0: 2, fk1: [5, 2], fk3: [15, 6], fk4: [25, 6], max: [35, 8] },
  C: { fk0: 3, fk1: [5, 3], fk3: [15, 7], fk4: [25, 7], max: [35, 9] },
  D: { fk0: 3, fk1: [7, 3], fk3: [20, 7], fk4: [30, 7], max: [35, 9] },
  E: { fk0: 3, fk1: [7, 3], fk3: [20, 7], fk4: [30, 7], max: [35, 9] },
  S: { fk0: 3, fk1: [7, 3], fk3: [25, 7], fk4: [30, 7], max: [35, 9] },
};

/**
 * Vurdér en målt sporvidde: returnerer den højeste fejlklasse, der overskrides.
 * projekteret = 1435/1437 + evt. sporudvidelse. Fodnote 5 og 10 i tabel 11.3.2-2:
 *  - fk 0 og 1 regnes fra den projekterede sporvidde (1437 mm på ret spor og R ≥ 190 m, fodnote 10;
 *    1435 + sporudvidelse ved R < 190 m, fodnote 5),
 *  - minustolerancer i fk 3, 4 og Max regnes fra 1435 + sporudvidelse ved R < 190 m (fodnote 5) og ellers fra 1435 mm
 *    (fodnote 10 omfatter kun fk 0 og 1),
 *  - plustolerancer i fk 3, 4 og Max regnes altid fra 1435 mm.
 */
export function sporviddeKlasse(G: number, k: Kvalitetsklasse, projekteret = 1435): { fejlklasse: string; status: Status } {
  const dP = G - projekteret; // mod projekteret (fk 0 og 1)
  const d35 = G - 1435; // mod 1435 (plus i fk 3, 4 og Max)
  const dMinus = G - (projekteret > 1437 ? projekteret : 1435); // minus i fk 3, 4 og Max
  const t = SPORVIDDE[k];
  const udHoej = (g: [number, number]) => d35 > g[0] || dMinus < -g[1];
  const udLav = (g: [number, number]) => dP > g[0] || dP < -g[1];
  if (udHoej(t.max)) return { fejlklasse: 'Max/Min', status: 'overskredet' };
  if (udHoej(t.fk4)) return { fejlklasse: '4', status: 'overskredet' };
  if (udHoej(t.fk3)) return { fejlklasse: '3', status: 'undtagelse' };
  if (udLav(t.fk1)) return { fejlklasse: '1', status: 'undtagelse' };
  if (Math.abs(dP) > t.fk0) return { fejlklasse: '0', status: 'ok' };
  return { fejlklasse: 'inden for 0', status: 'ok' };
}

/** Vurdér en målt vridning [mm/m] over base b. */
export function vridningKlasse(v: number, k: Kvalitetsklasse, b: Base, lav: boolean): { fejlklasse: string; status: Status; max: number } {
  const g = vridGraense(k, b);
  const max = lav ? g.max[0] : g.max[1];
  const a = Math.abs(v);
  if (a > max) return { fejlklasse: 'Max', status: 'overskredet', max };
  if (a > g.fk4) return { fejlklasse: '4', status: 'overskredet', max };
  if (g.fk3 !== undefined && a > g.fk3) return { fejlklasse: '3', status: 'undtagelse', max };
  return { fejlklasse: 'under 3', status: 'ok', max };
}

/** Tabel 11.5.2-1: projekteret ækvivalent konicitet, grænse. null = intet krav (V ≤ 60). */
export const konicitetGraense = (V: number): number | null => (V > 200 ? 0.2 : V > 60 ? 0.25 : null);

/** Tabel 11.5.2-2: beregnet projekteret konicitet, største af de 4 hjulsæt (S1002/GV 1/40, flangekontakt 1420/1426). */
export function projekteretKonicitet(sporvidde: 1435 | 1437, haeldning: 20 | 40, skinne: '60E1' | '60E2' = '60E2'): number {
  const t: Record<string, number[]> = {
    // S1002/1420, S1002/1426, GV/1420, GV/1426
    '60E2-1435-20': [0.017, 0.018, 0.025, 0.025],
    '60E2-1437-20': [0.014, 0.014, 0.025, 0.025],
    '60E2-1435-40': [0.027, 0.095, 0.025, 0.025],
    '60E2-1437-40': [0.028, 0.072, 0.025, 0.025],
    '60E1-1435-20': [0.011, 0.011, 0.025, 0.025],
    '60E1-1437-20': [0.010, 0.010, 0.025, 0.025],
    '60E1-1435-40': [0.029, 0.187, 0.025, 0.025],
    '60E1-1437-40': [0.030, 0.152, 0.025, 0.025],
  };
  return Math.max(...t[`${skinne}-${sporvidde}-${haeldning}`]);
}

/** Afsnit 17: kurveradius fra pilhøjde på målevogns-/måledræsinediagram: R = 10 000 / p. */
export const radiusFraDiagram = (p: number): number => 10000 / p;

export const BN138_KILDE = 'BN1-38-6';
