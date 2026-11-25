/**
 * Banenorm BN1-166-1 «Fritrumsprofiler, læsseprofil og kinematiske referencelinjer»
 * (udgivet 03.02.2025). Afsnit 10.4, 12, 13 og 14.
 */
import { sporudvidelse } from './rules';

/** Afsnit 12: forøgelse af breddemål i kurver e [mm]. null = R < 150 m (dispensation, beregnes efter EN 15273). */
export function breddeforoegelse(R: number, afrundTil0 = true): number | null {
  if (!(R > 0)) return 0;
  if (R < 150) return null;
  if (R < 250) return 60000 / R - 225; // formel 12.2
  if (R < 300) return 3750 / R; // formel 12.1
  return afrundTil0 ? 0 : 3750 / R; // R ≥ 300: nedrunding til 0 tilladt
}

/**
 * Breddeforøgelsens forløb langs sporet (figur 12-2 – 12-7).
 * x = afstand fra hovedkurvens begyndelsespunkt [m] (negativ = før kurven).
 * okl = overgangskurvens længde (0 = ingen).
 */
export function breddeforoegelseVed(x: number, R: number, okl: number): number {
  const e = breddeforoegelse(R) ?? 0;
  if (e === 0) return 0;
  if (okl > 0) {
    // Fig. 12-6: vokser lineært fra overgangskurvens begyndelse, fuld ved hovedkurvens begyndelsespunkt
    if (x >= 0) return e;
    if (x <= -okl) return 0;
    return e * (1 + x / okl);
  }
  if (R <= 250) {
    // Fig. 12-3: lineært fra 12 m før til fuld værdi 2 m før begyndelsespunktet
    if (x >= -2) return e;
    if (x <= -12) return 0;
    return (e * (x + 12)) / 10;
  }
  // Fig. 12-2: fuld værdi ved kurvens begyndelsespunkt
  return x >= 0 ? e : 0;
}

/** Afsnit 13: ændring af højdemål i afrundingskurver ΔhRv [mm]. null = Rv < 500 m (dispensation). */
export function hoejdeaendring(Rv: number, afrundTil0 = true): number | null {
  if (!(Rv > 0)) return 0;
  if (Rv < 500) return null;
  if (Rv >= 10000 && afrundTil0) return 0;
  return 50000 / Rv; // formel 13.1
}

/** Afsnit 10.4: vedligeholdelsestillæg ved projektering [mm]. */
export const VEDLIGEHOLDELSESTILLAEG = {
  ballast: { lodret: 100, vandret: 50 },
  fast: { lodret: 50, vandret: 25 },
};

/** Afsnit 14: fritrummet omkring skinnen [mm], regnet fra kørekanten (14 mm under SO). */
export function omkringSkinnen(R: number): { mFast: number; mOevrig: number; nTvang: number; nOevrig: number; nMin: number; udv: number } {
  const udv = sporudvidelse(R);
  return { mFast: 135, mOevrig: 150, nTvang: 41 + udv, nOevrig: 70 + udv, nMin: 45 + udv, udv };
}

/** Afsnit 11.1.1: profiltype efter trafikkode. */
export function profilType(kode: string): string {
  if (kode === 'S') return 'SD';
  if (kode === 'P1' || kode === 'F1') return 'D-GC';
  return 'D';
}

/* ------------------------------ profiler (BN1-166-1 fig. 11.1.1-1…3) ------------------------------ */

export type ProfilNavn = 'D' | 'D-GC' | 'SD';

/** Halvprofil (x = halv bredde fra profilmidte, h = højde over SO) [mm], fra bund til top. Aflæst af figurerne. */
const NEDRE: [number, number][] = [[0, 50], [1280, 50], [1580, 350], [1750, 350], [1750, 760]];
export const PROFILER: Record<ProfilNavn, [number, number][]> = {
  D: [...NEDRE, [2000, 760], [2000, 3300], [1870, 3300], [1870, 3530], [1665, 4130], [1075, 4680], [830, 4800], [0, 4800]],
  'D-GC': [...NEDRE, [2000, 760], [2000, 3300], [1870, 3300], [1870, 4700], [1600, 4820], [0, 4820]],
  SD: [...NEDRE, [2100, 760], [2100, 2800], [2000, 2800], [2000, 3300], [1885, 3300], [1885, 3530], [1880, 3530], [1880, 3760], [1825, 3760], [1380, 4330], [1380, 4800], [0, 4800]],
};

/** TSI INF tabel 2/3: profil (gauge) pr. trafikkode. */
export const TSI_GAUGE: Record<string, string> = { P1: 'GC', P2: 'GB', P3: 'DE3', P4: 'GB', P5: 'GA', P6: 'G1', F1: 'GC', F2: 'GB', F3: 'GA', F4: 'G1', S: '– (S-bane, national)' };

export interface ProfilTillaeg {
  /** Breddeforøgelse e [mm] – gives i hele højden */
  e: number;
  /** Højdeændring ΔhRv [mm] */
  dhRv: number;
  /** Vedligeholdelsestillæg [mm] */
  vandret: number;
  lodret: number;
}

/**
 * Halvprofil med tillæg: e og vandret tillæg lægges til bredden (over SO-niveau),
 * ΔhRv trækkes fra højder ≤ 1170 mm (aldrig under 0) og lægges til højder > 3300 mm,
 * lodret vedligeholdelsestillæg lægges til toppen.
 */
export function profilMedTillaeg(navn: ProfilNavn, t: ProfilTillaeg): [number, number][] {
  return PROFILER[navn].map(([x, hh]) => {
    let h2 = hh;
    if (hh <= 1170) h2 = Math.max(0, hh - t.dhRv);
    else if (hh > 3300) h2 = hh + t.dhRv;
    if (hh >= 4680) h2 += t.lodret;
    const x2 = x === 0 ? 0 : x + t.e + t.vandret;
    return [x2, h2];
  });
}

/** Fuldt (spejlet) profil som polygon. */
export function fuldtProfil(halv: [number, number][]): [number, number][] {
  const hojre = halv;
  const venstre = halv.slice().reverse().map(([x, hh]) => [-x, hh] as [number, number]);
  return [...venstre, ...hojre];
}

/** Punkt i polygon (ray casting). */
export function iPolygon(p: [number, number], poly: [number, number][]): boolean {
  let inde = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi + 1e-12) + xi) inde = !inde;
  }
  return inde;
}

/**
 * Omregn et punkt fra vandret/lodret koordinater (x fra spormidte, z over inderskinnens SO, mm)
 * til sporplanets koordinater (u langs SO fra spormidte, v vinkelret på SO).
 * yder = +1: kurvens yderside mod +x. Sporet drejes om inderskinnens SO.
 */
export function tilSporplan(x: number, z: number, hCant: number, yder: 1 | -1 = 1, rc = 753.5): [number, number] {
  const th = Math.asin(Math.min(0.2, Math.max(0, hCant) / 1500)) * yder;
  const px = -yder * rc; // inderskinne
  const dx = x - px, dz = z;
  // drej tilbage med −θ
  const u = dx * Math.cos(th) + dz * Math.sin(th) + px;
  const v = -dx * Math.sin(th) + dz * Math.cos(th);
  return [u, v];
}
