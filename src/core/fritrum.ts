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
