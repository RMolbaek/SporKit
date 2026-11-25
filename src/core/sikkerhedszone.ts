/**
 * Sikkerheds- og opholdszoner på perroner – Banenorm BN1-9-2 (udgivet 01.06.2012).
 * Figur 10.1-1 (b_sik), 11.1-1 (b_per), 11.2-1 (b_oph), afsn. 10 (højde, tæthed, afstribning, skilte).
 */

export type Banetype = 'fjern' | 'sbane';
export type Genstand = 'ingen' | 'g1' | 'g2' | 'g3';
export type PerronForm = 'side' | 'oe';

export const FRI_HOEJDE = 2.3; // m (afsn. 10.2)
export const PRIK = { diameter: 100, centerafstand: 200, hoejde: '0–5 mm' }; // afsn. 11.3
export const SKILT_INTERVAL = 50; // m (afsn. 10.4.2)
export const KORT_GENSTAND_AFSTAND = 2.4; // m – korte genstande tættere end dette regnes som lange (afsn. 11.2)

/** Mindste bredde af sikkerhedszone [m]. null = intet ophold på perron tilladt. */
export function bSik(V: number, bane: Banetype): number | null {
  if (bane === 'sbane') return V <= 160 ? 0.75 : null; // S-bane kun defineret for V ≤ 160
  if (V <= 160) return 0.85;
  if (V <= 200) return 1.35;
  return null;
}

/** Mindste bredde af opholdszone [m] (fig. 11.2-1), evt. indsnævret ved perronende. */
export function bOph(V: number, g: Genstand, perronende = false): number | null {
  if (V > 200) return null;
  const b = g === 'g1' ? 1.6 : 2.0;
  return perronende ? Math.min(b, 1.6) : b;
}

/** Klassifikation af genstand ud fra længde l [m] (def. 5.16–5.18). */
export function genstandKlasse(l: number): Genstand {
  if (!(l > 0)) return 'ingen';
  if (l < 1) return 'g1';
  if (l < 10) return 'g2';
  return 'g3';
}

/** Mindste perronbredde (fig. 11.1-1). bg = genstandens bredde [m]. */
export function bPer(form: PerronForm, sik: number, oph: number, medGenstand: boolean, bg: number): number {
  if (form === 'side') return sik + oph + (medGenstand ? bg : 0);
  return medGenstand ? 2 * sik + 2 * oph + bg : 2 * sik + oph;
}

/** Krav om afstribning og skiltning af sikkerhedszoner (afsn. 10). */
export function afstribningKraeves(V: number, ten: boolean, bane: Banetype): boolean {
  return ten || V > 160 || bane === 'sbane';
}

/** Maks. passagertæthed ved nyanlæg [personer/m²] (afsn. 10). */
export const maksTaethed = (bane: Banetype): number => (bane === 'sbane' ? 0.7 : 1.0);

/** Opholdsareal [m²] = perronareal minus sikkerhedszoner og genstande. */
export function opholdsAreal(bper: number, L: number, sikTotal: number, Ag: number): number {
  return Math.max(0, (bper - sikTotal) * L - Ag);
}
