/**
 * Forhindringer og bindinger langs sporet (overkørsler, broer, tunneler, perroner, sporskifter, faste punkter m.v.)
 * og kontrol af sporets geometri mod dem.
 *
 * Krav med normhenvisning (Sporregler, rettelsesblade til 01.05.2017):
 *  - Perron: h ≤ 60 mm, undtagelse 110 mm (2.03.4 formel 8 / 2.03.5); ny strækning R ≥ 300 m, ønskeligt ret spor (2.02.2–2.02.3)
 *  - Sporskifte: h ≤ 120 mm, undtagelse 160 mm (2.03.4 formel 6 / 2.03.5); på ret spor eller i kurve – ikke i overgangskurve (2.03.6)
 *  - Overkørsel: på ret spor højst 40 mm overhøjde (2.03.8); afrundingskurver i længdeprofilet bør ligge ≥ 25 m fra overkørsler (2.10.3)
 * Broer, tunneler og faste punkter giver opmærksomhedspunkter (ingen talkrav i de åbne kilder).
 */
import { kappa, type Element } from './projekt';
import type { Status } from './rules';

export type ForhType = 'perron' | 'overkoersel' | 'sporskifte' | 'bro' | 'tunnel' | 'binding' | 'andet';

export const FORH_TEKST: Record<ForhType, string> = {
  perron: 'Perron',
  overkoersel: 'Overkørsel',
  sporskifte: 'Sporskifte',
  bro: 'Bro / underføring',
  tunnel: 'Tunnel / overføring',
  binding: 'Fast punkt / binding',
  andet: 'Andet',
};

export interface Forhindring {
  id: string;
  type: ForhType;
  /** Stationering fra–til [m] (til = fra for punkter) */
  km0: number; km1: number;
  navn: string;
  side?: 'V' | 'H' | 'begge' | '';
  /** Perron: på ny strækning (skærpede radiuskrav) */
  ny?: boolean;
  /** Bro: gennemgående ballast */
  ballast?: boolean;
}

export type Niveau = Status | 'obs';
export interface ForhCheck { label: string; value: string; graense: string; status: Niveau; kilde: string }
export interface ForhKontrol { f: Forhindring; checks: ForhCheck[]; status: Niveau; geometri: string }

/** Geometrien i et interval: største overhøjde, mindste radius, elementtyper og overhøjdeændring. */
export function geometriI(el: Element[], km0: number, km1: number) {
  const a = Math.min(km0, km1), b = Math.max(km0, km1);
  const ov = b - a > 0.02
    ? el.filter((e) => e.km1 > a + 0.01 && e.km0 < b - 0.01) // elementer der kun rører intervallets ender tæller ikke
    : el.filter((e) => e.km1 >= a - 1e-6 && e.km0 <= b + 1e-6).slice(0, 1);
  const hAt = (e: Element, km: number) => e.L > 0 ? e.h0 + (e.h1 - e.h0) * Math.min(1, Math.max(0, (km - e.km0) / e.L)) : e.h0;
  let hMax = 0, kMax = 0;
  const hs: number[] = [];
  for (const e of ov) {
    const x0 = Math.max(a, e.km0), x1 = Math.min(b, e.km1);
    hs.push(hAt(e, x0), hAt(e, x1));
    hMax = Math.max(hMax, hAt(e, x0), hAt(e, x1));
    const k0 = Math.abs(kappa(e.R0)), k1 = Math.abs(kappa(e.R1));
    kMax = Math.max(kMax, e.type === 'overgang' ? Math.max(k0 + (k1 - k0) * Math.max(0, (x0 - e.km0) / (e.L || 1)), k0 + (k1 - k0) * Math.min(1, (x1 - e.km0) / (e.L || 1))) : k0);
  }
  const typer = new Set(ov.map((e) => e.type));
  const dh = hs.length ? Math.max(...hs) - Math.min(...hs) : 0;
  return { elementer: ov, hMax, Rmin: kMax > 0 ? 1 / kMax : Infinity, typer, dh, daekket: ov.length > 0 && ov[0].km0 <= a + 1e-3 && ov[ov.length - 1].km1 >= b - 1e-3 };
}

const f0 = (x: number) => Math.round(x).toLocaleString('da-DK');
const kmT = (m: number) => `${Math.floor(m / 1000 + 1e-9)}+${(m - Math.floor(m / 1000 + 1e-9) * 1000).toFixed(0).padStart(3, '0')}`;

export interface KontrolValg {
  /** Projektgrænser (tilslutningspunkter) [m] */
  graenser?: number[];
  /** Eksisterende og projekteret geometri – til bindinger */
  eks?: Element[];
  proj?: Element[];
  /** Strækningshastighed [km/t] – sporskifter ved V > 200 skal ligge på ret spor uden overhøjde (SR87 2.03.6) */
  V?: number;
}

export function kontrollerForhindring(f: Forhindring, el: Element[], v: KontrolValg = {}): ForhKontrol {
  const g = geometriI(el, f.km0, f.km1);
  const c: ForhCheck[] = [];
  const typeTxt = [...g.typer].map((t) => ({ ret: 'ret', kurve: 'cirkelbue', overgang: 'overgangskurve' }[t])).join(' + ') || '–';
  const geometri = `${typeTxt}${Number.isFinite(g.Rmin) ? ` · R min ${f0(g.Rmin)} m` : ''} · h maks ${f0(g.hMax)} mm`;
  if (!g.daekket) c.push({ label: 'Geometri', value: 'forhindringen ligger (delvist) uden for datasættet', graense: '', status: 'obs', kilde: '' });
  const iOvergang = g.typer.has('overgang');
  const iRet = g.typer.size === 1 && g.typer.has('ret');
  switch (f.type) {
    case 'perron': {
      c.push({ label: 'Overhøjde langs perron', value: `${f0(g.hMax)} mm`, graense: '≤ 60 mm (undt. 110 mm)', status: g.hMax <= 60 + 1e-6 ? 'ok' : g.hMax <= 110 + 1e-6 ? 'undtagelse' : 'overskredet', kilde: 'SR87 2.03.4 (8), 2.03.5' });
      if (f.ny) {
        c.push({ label: 'Radius langs perron på ny strækning', value: Number.isFinite(g.Rmin) ? `${f0(g.Rmin)} m` : 'ret spor', graense: 'R ≥ 300 m (ønskeligt ret spor)', status: g.Rmin >= 300 - 1e-6 ? 'ok' : 'overskredet', kilde: 'SR87 2.02.2–2.02.3' });
        if (!iRet) c.push({ label: 'Ønskelig bestemmelse', value: 'perronspor i kurve', graense: 'ret spor', status: 'obs', kilde: 'SR87 2.02.2' });
      }
      if (iOvergang || g.dh > 0.5) c.push({ label: 'Overgangskurve/rampe langs perron', value: `Δh = ${f0(g.dh)} mm`, graense: 'perronkantens afstand og højde varierer – kontrollér med BN1-49', status: 'obs', kilde: 'BN1-49' });
      break;
    }
    case 'sporskifte': {
      c.push({ label: 'Overhøjde i sporskifte', value: `${f0(g.hMax)} mm`, graense: '≤ 120 mm (undt. 160 mm)', status: g.hMax <= 120 + 1e-6 ? 'ok' : g.hMax <= 160 + 1e-6 ? 'undtagelse' : 'overskredet', kilde: 'SR87 2.03.4 (6), 2.03.5' });
      c.push({ label: 'Placering', value: typeTxt, graense: 'ret spor eller cirkelbue – ikke overgangskurve', status: iOvergang ? 'overskredet' : 'ok', kilde: 'SR87 2.03.6' });
      if ((v.V ?? 0) > 200) c.push({ label: `Sporskifte ved V = ${v.V} km/t`, value: iRet && g.hMax < 0.5 ? 'ret spor uden overhøjde' : typeTxt, graense: '200 < V ≤ 250: ret spor uden overhøjde', status: iRet && g.hMax < 0.5 ? 'ok' : 'overskredet', kilde: 'SR87 2.03.6' });
      if (g.dh > 0.5) c.push({ label: 'Overhøjderampe i sporskiftet', value: `Δh = ${f0(g.dh)} mm`, graense: 'konstant overhøjde', status: 'overskredet', kilde: 'SR87 2.03.6' });
      break;
    }
    case 'overkoersel': {
      if (iRet || g.typer.has('ret')) c.push({ label: 'Overhøjde på ret spor gennem overkørslen', value: `${f0(g.hMax)} mm`, graense: iRet ? '≤ 40 mm' : '≤ 40 mm på den rette del', status: iRet ? (g.hMax <= 40 + 1e-6 ? 'ok' : 'overskredet') : 'obs', kilde: 'SR87 2.03.8' });
      else c.push({ label: 'Overhøjde i overkørslen', value: `${f0(g.hMax)} mm`, graense: 'tilpas vejens længdeprofil', status: 'obs', kilde: 'SR87 2.03.8' });
      if (iOvergang || g.dh > 0.5) c.push({ label: 'Overhøjderampe i overkørslen', value: `Δh = ${f0(g.dh)} mm`, graense: 'vejens tværfald ændres – undgå', status: 'obs', kilde: 'SR87 2.03.8' });
      c.push({ label: 'Afrundingskurver i længdeprofilet', value: 'ikke i datagrundlaget', graense: `bør ligge uden for ${kmT(Math.min(f.km0, f.km1) - 25)} – ${kmT(Math.max(f.km0, f.km1) + 25)}`, status: 'obs', kilde: 'SR87 2.10.3' });
      break;
    }
    case 'bro': {
      if (!f.ballast && (iOvergang || g.dh > 0.5)) c.push({ label: 'Overgangskurve/rampe på bro uden gennemgående ballast', value: typeTxt, graense: 'geometri bestemt af bygværket – kræver særskilt vurdering', status: 'obs', kilde: 'BN1-59' });
      c.push({ label: 'Sideflytning og hævning af sporet', value: f.ballast ? 'gennemgående ballast' : 'uden gennemgående ballast', graense: 'begrænset af bygværket', status: 'obs', kilde: 'BN1-59' });
      break;
    }
    case 'tunnel': {
      c.push({ label: 'Fritrum', value: geometri, graense: 'kontrollér profil med overhøjde og breddeforøgelse', status: 'obs', kilde: 'BN1-166 / TSI INF 4.2.3.1' });
      if (g.dh > 0.5) c.push({ label: 'Overhøjdeændring i tunnel', value: `Δh = ${f0(g.dh)} mm`, graense: 'fritrummet ændres langs rampen', status: 'obs', kilde: 'BN1-166' });
      break;
    }
    case 'binding': case 'andet': break;
  }
  // Projektgrænser i forhindringen
  for (const km of v.graenser ?? []) {
    if (km >= Math.min(f.km0, f.km1) - 1 && km <= Math.max(f.km0, f.km1) + 1) {
      c.push({ label: 'Tilslutningspunkt i forhindringen', value: `km ${kmT(km)}`, graense: 'flyt projektgrænsen uden for', status: f.type === 'sporskifte' ? 'overskredet' : 'obs', kilde: f.type === 'sporskifte' ? 'SR87 2.03.6' : 'projektering' });
    }
  }
  // Bindinger: ændrer projektet geometrien ved punktet?
  if ((f.type === 'binding' || f.type === 'bro' || f.type === 'tunnel' || f.type === 'perron') && v.eks && v.proj) {
    const ge = geometriI(v.eks, f.km0, f.km1), gp = geometriI(v.proj, f.km0, f.km1);
    if (gp.elementer.length && ge.elementer.length) {
      const aendret = Math.abs(ge.hMax - gp.hMax) > 0.5 || Math.abs((Number.isFinite(ge.Rmin) ? 1 / ge.Rmin : 0) - (Number.isFinite(gp.Rmin) ? 1 / gp.Rmin : 0)) > 1e-7;
      c.push({ label: 'Projektet ændrer geometrien her', value: aendret ? `R ${Number.isFinite(ge.Rmin) ? f0(ge.Rmin) : '∞'} → ${Number.isFinite(gp.Rmin) ? f0(gp.Rmin) : '∞'} m · h ${f0(ge.hMax)} → ${f0(gp.hMax)} mm` : 'nej', graense: f.type === 'binding' ? 'binding – sporet må ikke flyttes' : 'kontrollér mod bygværk/perron', status: aendret ? (f.type === 'binding' ? 'overskredet' : 'obs') : 'ok', kilde: 'projektering' });
    }
  }
  const status: Niveau = c.some((x) => x.status === 'overskredet') ? 'overskredet' : c.some((x) => x.status === 'undtagelse') ? 'undtagelse' : c.some((x) => x.status === 'obs') ? 'obs' : 'ok';
  return { f, checks: c, status, geometri };
}

/** Import af forhindringer fra CSV/TXT: type; km fra; km til; navn (+ evt. side). */
export function forhindringerFraTekst(tekst: string, parseKm: (s: string) => number): { liste: Forhindring[]; fejl: string[] } {
  const liste: Forhindring[] = [];
  const fejl: string[] = [];
  const linjer = tekst.replace(/\r/g, '').split('\n').map((l) => l.trim()).filter(Boolean);
  const delim = linjer.some((l) => l.includes(';')) ? ';' : linjer.some((l) => l.includes('\t')) ? '\t' : ',';
  const typeAf = (s: string): ForhType | null => {
    const t = s.toLowerCase();
    if (/perron/.test(t)) return 'perron';
    if (/overk|overgang|vej/.test(t)) return 'overkoersel';
    if (/sporsk|skifte|sk\b|krydsning/.test(t)) return 'sporskifte';
    if (/bro|underf/.test(t)) return 'bro';
    if (/tunnel|overf/.test(t)) return 'tunnel';
    if (/fast|binding|fikspunkt/.test(t)) return 'binding';
    return null;
  };
  linjer.forEach((l, i) => {
    const c = l.split(delim).map((x) => x.trim());
    const type = typeAf(c[0] ?? '');
    const km0 = parseKm(c[1] ?? ''), km1raw = parseKm(c[2] ?? '');
    if (!type || !Number.isFinite(km0)) { if (i > 0 || type) fejl.push(`Linje ${i + 1}: «${l.slice(0, 50)}» kunne ikke læses.`); return; }
    const km1 = Number.isFinite(km1raw) ? km1raw : km0;
    const side = (c[4] ?? '').toUpperCase();
    liste.push({ id: Math.random().toString(36).slice(2, 9), type: type ?? 'andet', km0: Math.min(km0, km1), km1: Math.max(km0, km1), navn: c[3] ?? '', side: side === 'V' || side === 'H' ? side : '' });
  });
  return { liste, fejl };
}

export const FORH_EKSEMPEL = `Type;Km fra;Km til;Navn;Side
Overkørsel;12+180;12+190;Overkørsel Skovvej;
Perron;12+600;12+780;Perron spor 1;H
Bro;13+150;13+175;Bro over å;
Sporskifte;13+700;13+760;Sporskifte 01;
Fast punkt;14+050;14+050;Kørestrømsåg / binding;`;
