/**
 * Indbyrdes placering af spor og perron – Banenorm BN1-49-1 (udgivet 01.10.2006).
 * Tabeller gengivet fra figur 8.2-1, 9-1 og 11-1. Kontrollér om nyere udgave er gældende.
 */

export type PerronType = '26' | '35' | '50' | '55' | '68' | '72' | '76' | '87' | '92' | 'oevrig';
export type Situation = 'drift' | 'nyanlaeg' | 'forkant' | 'sporfornyelse' | 'sporjustering';

export const SITUATIONER: [Situation, string][] = [
  ['drift', 'Spor i drift (BN1, afsn. 9)'],
  ['nyanlaeg', 'Nyanlæg af perron (BN2, afsn. 11)'],
  ['forkant', 'Fornyelse af perronforkant (BN2)'],
  ['sporfornyelse', 'Sporfornyelse / ballastrensning (BN2)'],
  ['sporjustering', 'Sporjustering (BN2)'],
];

export const PERRONTYPER: [PerronType, string][] = [
  ['26', 'Perron 26'], ['35', 'Perron 35'], ['50', 'Perron 50'], ['55', 'Perron 55'],
  ['68', 'Perron 68'], ['72', 'Perron 72'], ['76', 'Perron 76'], ['87', 'Perron 87'],
  ['92', 'Perron 92 (S-bane)'], ['oevrig', 'Øvrig perron (fx gods/service)'],
];

/** Nominel perronhøjde [mm] for typen og situationen (BN1-49 afsn. 9 og 11). */
export function nominelHoejde(t: PerronType, s: Situation): number | null {
  if (t === 'oevrig') return null;
  if (t === '87') return 920;
  if (s === 'sporjustering' && (t === '68' || t === '72')) return 760;
  return Number(t) * 10;
}

/* ---------------------- Figur 8.2-1: nominel perronafstand ---------------------- */

const HOEJDE_RAEKKER: { max: number; label: string; v: number[] }[] = [
  { max: 350, label: 'Under 350', v: [845, 845, 850, 850, 855, 855, 855, 860] },
  { max: 650, label: '351 – 650', v: [945, 945, 955, 965, 980, 995, 1005, 1020] },
  { max: 840, label: '651 – 840', v: [950, 955, 955, 965, 980, 995, 1005, 1020] },
  { max: 930, label: '841 – 930', v: [950, 960, 965, 965, 980, 995, 1005, 1020] },
  { max: 1250, label: '931 – 1250 ¹', v: [1025, 1025, 1030, 1030, 1035, 1035, 1035, 1040] },
];
export const RADIUS_KOLONNER = ['Ret spor', '≥ 2000', '1999–600', '599–500', '499–400', '399–350', '349–300', '299–250'];

function radiusKolonne(R: number): number {
  if (!(R > 0)) return 0;
  if (R >= 2000) return 1;
  if (R >= 600) return 2;
  if (R >= 500) return 3;
  if (R >= 400) return 4;
  if (R >= 350) return 5;
  if (R >= 300) return 6;
  return 7; // 250–299 og grundværdi for R < 250
}

/** Tillæg for R < 250 m i forhold til R = 250 m (afsn. 8.2). null = uden for normens område. */
export function smaaRadiusTillaeg(R: number): number | null {
  if (!(R > 0) || R >= 250) return 0;
  if (R >= 225) return 30;
  if (R >= 200) return 60;
  if (R >= 190) return 75;
  return null;
}

export interface NominelAfstand {
  afstand: number | null;
  grund: number | null;
  raekke: number;
  kolonne: number;
  tillaegRadius: number | null;
  tillaegFremspring: number;
  advarsler: string[];
}

export function nominelPerronafstand(hoejde: number, R: number, fremspring: boolean): NominelAfstand {
  const adv: string[] = [];
  const raekke = HOEJDE_RAEKKER.findIndex((r) => hoejde <= r.max);
  const kolonne = radiusKolonne(R);
  if (raekke < 0) {
    adv.push('Perronhøjde over 1250 mm: perronen placeres som alle andre genstande efter fritrumsprofilerne.');
    return { afstand: null, grund: null, raekke, kolonne, tillaegRadius: null, tillaegFremspring: 0, advarsler: adv };
  }
  if (raekke === 4) adv.push('Perroner med højde 931–1250 mm må alene placeres langs sidespor på fjernbaner.');
  const grund = HOEJDE_RAEKKER[raekke].v[kolonne];
  const tR = smaaRadiusTillaeg(R);
  if (tR === null) adv.push('Radius under 190 m er ikke dækket af BN1-49 – fritrumsprofilerne skal anvendes.');
  if ((tR ?? 0) > 0) adv.push('Tillægget for R < 250 m skal begynde mindst 12 m før og være fuldt til stede mindst 2 m før kurvens begyndelsespunkt.');
  const tF = fremspring ? 50 : 0;
  return {
    afstand: tR === null ? null : grund + tR + tF,
    grund, raekke, kolonne, tillaegRadius: tR, tillaegFremspring: tF, advarsler: adv,
  };
}

export const HOEJDE_LABELS = HOEJDE_RAEKKER.map((r) => r.label);
export const AFSTAND_TABEL = HOEJDE_RAEKKER.map((r) => r.v);

/* ---------------------- Figur 9-1 og 11-1: tolerancer ---------------------- */

/** Tolerance [minus, plus] i mm. null = intet krav. */
export type Tol = [number | null, number | null];

type Gruppe = 'A' | 'B' | 'C'; // A: 26/35, B: 50,55,68,72,76,92, C: øvrige

function afstandsGruppe(t: PerronType): Gruppe {
  if (t === '26' || t === '35') return 'A';
  if (['50', '55', '68', '72', '76', '92'].includes(t)) return 'B';
  return 'C';
}
/** Højdegruppe: H1 = 26,35,50,55,68,72,76; H2 = 92; H3 = øvrige */
function hoejdeGruppe(t: PerronType): 'H1' | 'H2' | 'H3' {
  if (['26', '35', '50', '55', '68', '72', '76'].includes(t)) return 'H1';
  if (t === '92') return 'H2';
  return 'H3';
}

export function afstandTolerance(t: PerronType, s: Situation, aktuelHoejde: number): Tol {
  const g = afstandsGruppe(t);
  if (s === 'drift') {
    if (g === 'A') return [aktuelHoejde <= 300 ? 50 : 10, 150];
    if (g === 'B') return [10, 100];
    return [10, null];
  }
  if (s === 'nyanlaeg' || s === 'forkant') return [0, 20];
  if (s === 'sporfornyelse') return [0, 70];
  // sporjustering
  if (g === 'A') return [0, 140];
  if (g === 'B') return [0, 90];
  return [0, null];
}

export function hoejdeTolerance(t: PerronType, s: Situation): Tol {
  const g = hoejdeGruppe(t);
  if (s === 'drift') return g === 'H2' ? [null, 10] : [null, null];
  const p35 = (plus: number | null): number | null => (t === '35' ? 0 : plus);
  if (s === 'nyanlaeg' || s === 'forkant') {
    if (g === 'H1') return [10, p35(20)];
    if (g === 'H2') return [30, 0];
    return [10, 20];
  }
  if (s === 'sporfornyelse') {
    if (g === 'H1') return [20, p35(30)];
    if (g === 'H2') return [50, 0];
    return [20, 30];
  }
  if (g === 'H1') return [null, p35(50)];
  if (g === 'H2') return [null, 0];
  return [null, null];
}

export function tolTekst(t: Tol): string {
  const m = t[0] === null ? '−*' : `−${t[0]}`;
  const p = t[1] === null ? '+*' : `+${t[1]}`;
  return `${m} / ${p} mm`;
}

/** Kontrollér målt værdi mod nominel ± tolerance. */
export function iTolerance(maalt: number, nominel: number, t: Tol): boolean {
  const d = maalt - nominel;
  if (t[0] !== null && d < -t[0] - 1e-9) return false;
  if (t[1] !== null && d > t[1] + 1e-9) return false;
  return true;
}

/* ------------------------- geometri med overhøjde ------------------------- */

/**
 * Perronforkantens placering i forhold til nærmeste skinnes kørekant, når
 * perronafstand A og perronhøjde H er målt i forhold til SO-planet (fig. 8.1-2).
 * Returnerer vandret og lodret afstand [mm] (lodret fra skinneoverkant af nærmeste skinne).
 * side: 'inder' = perron i kurvens inderside (lav skinne), 'yder' = kurvens yderside.
 */
export function perronGlobal(A: number, H: number, h: number, side: 'inder' | 'yder', e = 1500) {
  const th = Math.asin(Math.min(0.2, Math.max(0, h) / e));
  const c = Math.cos(th), s = Math.sin(th);
  const kk = 14; // kørekant 14 mm under SO
  if (side === 'inder') {
    return { vandret: A * c + (H + kk) * s, lodret: -A * s + (H + kk) * c - kk * c, theta: th };
  }
  return { vandret: A * c - (H + kk) * s, lodret: A * s + (H + kk) * c - kk * c, theta: th };
}
