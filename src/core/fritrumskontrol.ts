/**
 * Fritrumskontrol af opmålingspunkter mod fritrumsprofil (BN1-166-1).
 * Punkterne er målt i forhold til sporlinjen: vandret (x) og lodret (z) afstand fra spormidte
 * i SO-planet, samt sporets overhøjde h i punktet.
 * Fortegn: x > 0 til højre i km-retningen; h > 0 når højre skinne er højest.
 */
import {
  PROFILER, profilMedTillaeg, fuldtProfil, iPolygon, breddeforoegelse, hoejdeaendring,
  type ProfilNavn, type ProfilTillaeg,
} from './fritrum';

export interface Punkt {
  id: string;
  km: string;
  /** Overhøjde [mm], fortegn efter hvilken skinne der er højest */
  h: number;
  /** Vandret afstand fra spormidte [mm] */
  x: number;
  /** Lodret afstand over spormidte i SO-planet [mm] */
  z: number;
  beskrivelse: string;
  /** Kurveradius [m] (0 = ret spor) */
  R: number;
  /** Afrundingsradius [m] (0 = ingen) */
  Rv: number;
  linje: number;
}

export interface ParseResultat { punkter: Punkt[]; fejl: string[] }

const tal = (s: string | undefined): number => {
  if (s === undefined) return NaN;
  const t = s.trim().replace(/\s/g, '');
  if (!t) return NaN;
  // dansk decimalkomma og evt. tusindtalspunktum
  const n = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
  return Number(n);
};

/**
 * Indlæs punkter fra tekst (indsat fra Excel/CSV). Kolonner:
 * Punkt; Km; Overhøjde [mm]; x [mm|m]; z [mm|m]; Beskrivelse; R [m]; Rv [m]
 * Separator: tabulator eller semikolon (komma kun hvis ingen af de andre findes).
 */
export function parsePunkter(tekst: string, enhed: 'mm' | 'm' = 'mm'): ParseResultat {
  const punkter: Punkt[] = [];
  const fejl: string[] = [];
  const faktor = enhed === 'm' ? 1000 : 1;
  const linjer = tekst.split(/\r?\n/);
  linjer.forEach((raw, i) => {
    const linje = raw.trim();
    if (!linje) return;
    const sep = linje.includes('\t') ? '\t' : linje.includes(';') ? ';' : ',';
    const c = linje.split(sep).map((x) => x.trim());
    const h = tal(c[2]), x = tal(c[3]), z = tal(c[4]);
    if (!Number.isFinite(h) || !Number.isFinite(x) || !Number.isFinite(z)) {
      if (i === 0) return; // overskriftslinje
      fejl.push(`Linje ${i + 1}: overhøjde, x og z skal være tal («${linje.slice(0, 60)}»).`);
      return;
    }
    const R = tal(c[6]), Rv = tal(c[7]);
    punkter.push({
      id: c[0] || `P${punkter.length + 1}`, km: c[1] ?? '', h, x: x * faktor, z: z * faktor,
      beskrivelse: c[5] ?? '', R: Number.isFinite(R) ? R : 0, Rv: Number.isFinite(Rv) ? Rv : 0, linje: i + 1,
    });
  });
  return { punkter, fejl };
}

/** Omregn fra vandret/lodret (relativt til spormidte i SO) til sporplanets koordinater. */
export function iSporplan(x: number, z: number, h: number, e = 1500): [number, number] {
  const th = Math.asin(Math.max(-0.2, Math.min(0.2, h / e)));
  return [x * Math.cos(th) + z * Math.sin(th), -x * Math.sin(th) + z * Math.cos(th)];
}

/** Korteste afstand fra punkt til polygonens kant [mm]. */
export function afstandTilKant(p: [number, number], poly: [number, number][]): number {
  let d = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const L2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2));
    const qx = a[0] + t * dx, qy = a[1] + t * dy;
    d = Math.min(d, Math.hypot(p[0] - qx, p[1] - qy));
  }
  return d;
}

export interface Vurdering {
  p: Punkt;
  u: number; v: number;
  tillaeg: ProfilTillaeg;
  /** true = genstanden ligger inden for profilet inkl. tillæg */
  konflikt: boolean;
  /** Afstand til profilkant [mm]: positiv = fri margin, negativ = indtrængning */
  margin: number;
  /** Konflikt mod selve profilet (uden vedligeholdelsestillæg) */
  konfliktProfil: boolean;
  /** Advarsler (R < 150, Rv < 500) */
  advarsler: string[];
}

export function vurder(p: Punkt, navn: ProfilNavn, vedl: { vandret: number; lodret: number }): Vurdering {
  const adv: string[] = [];
  const e = breddeforoegelse(Math.abs(p.R));
  if (e === null) adv.push('R < 150 m: breddeforøgelse skal beregnes efter EN 15273 (dispensation).');
  const dh = hoejdeaendring(Math.abs(p.Rv));
  if (dh === null) adv.push('Rv < 500 m: højdeændring skal beregnes efter EN 15273 (dispensation).');
  const tillaeg: ProfilTillaeg = { e: e ?? 0, dhRv: dh ?? 0, vandret: vedl.vandret, lodret: vedl.lodret };
  const [u, v] = iSporplan(p.x, p.z, p.h);
  const polyT = fuldtProfil(profilMedTillaeg(navn, tillaeg));
  const polyP = fuldtProfil(profilMedTillaeg(navn, { ...tillaeg, vandret: 0, lodret: 0 }));
  const inde = iPolygon([u, v], polyT);
  const d = afstandTilKant([u, v], polyT);
  return { p, u, v, tillaeg, konflikt: inde, margin: inde ? -d : d, konfliktProfil: iPolygon([u, v], polyP), advarsler: adv };
}

export const EKSEMPEL = [
  'Punkt\tKm\tOverhøjde [mm]\tx [mm]\tz [mm]\tBeskrivelse\tR [m]\tRv [m]',
  'M101\t12,310\t0\t3150\t1200\tKøreledningsmast\t0\t0',
  'M102\t12,375\t60\t-2050\t1600\tSkilt, hastighedstavle\t900\t0',
  'S201\t12,402\t110\t2080\t2300\tSignalstander\t420\t0',
  'B301\t12,450\t110\t-1700\t520\tKabelbrønd, låg\t420\t0',
  'P401\t12,520\t0\t1760\t900\tPerronforkant\t0\t8000',
  'T501\t12,600\t0\t0\t4760\tUnderside bro\t0\t6000',
].join('\n');

export { PROFILER };
