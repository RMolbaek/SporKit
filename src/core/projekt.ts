/**
 * Projekter med sporets geometrielementer (spordataliste for eksisterende spor / geometrirapport for projekteret spor)
 * og beregning af hastighedsprofil efter Sporregler (grænser fra rules.ts).
 *
 * Konventioner:
 *  - Stationering (km) gemmes i meter.
 *  - Radius er med fortegn: positiv = højrekurve, negativ = venstrekurve, 0 = ret spor (uendelig radius).
 *  - Overhøjde h [mm] er altid positiv og ligger i kurvens yderside.
 */
import { BANEDANMARK, iUndtagelse, limitI, samletStatus, vurder, type RuleSet, type Settings, type Status } from './rules';
import { cantConstant } from './formulas';

export type ElType = 'ret' | 'kurve' | 'overgang';

export interface Element {
  type: ElType;
  /** Stationering ved start og slut [m] */
  km0: number; km1: number;
  /** Længde [m] */
  L: number;
  /** Radius ved start og slut [m] med fortegn (0 = ret) */
  R0: number; R1: number;
  /** Overhøjde ved start og slut [mm] */
  h0: number; h1: number;
  /** Klotoideparameter [m] (overgang) */
  A?: number;
  /** Skiltet/eksisterende hastighed fra listen [km/t] */
  V?: number;
  tekst?: string;
}

export interface Datasaet {
  filnavn: string;
  importeret: string;
  elementer: Element[];
}

export type DataType = 'eksisterende' | 'projekteret';
export const DATA_TEKST: Record<DataType, string> = {
  eksisterende: 'Spordataliste (eksisterende spor)',
  projekteret: 'Geometrirapport (projekteret spor)',
};

export interface Projekt {
  id: string;
  navn: string;
  straekning: string;
  oprettet: string;
  opdateret: string;
  /** Strækningshastighed [km/t] – øvre grænse for profilet */
  V: number;
  /** Laveste hastighed (gods) til overhøjdeoverskud [km/t] */
  Vmin: number;
  /** Datasæt der bruges som grundlag for beregningerne */
  grundlag: DataType;
  data: Partial<Record<DataType, Datasaet>>;
  noter: string;
}

/* ============================== talparsing ============================== */

/** Tal i dansk eller engelsk notation: «1.234,5», «1234.5», «1 234,5». Returnerer NaN ved tomt felt. */
export function parseTal(s: string | undefined): number {
  if (s === undefined) return NaN;
  let t = s.trim().replace(/\s| /g, '').replace(/[−–]/g, '-');
  if (!t) return NaN;
  if (/^[+-]?(inf|infinity|∞|uendelig)$/i.test(t)) return 0;
  if (!/\d/.test(t) || /[a-df-zæøå]/i.test(t)) return NaN;
  t = t.replace(/[^0-9.,+\-eE]/g, '');
  const komma = t.lastIndexOf(','), punkt = t.lastIndexOf('.');
  if (komma >= 0 && punkt >= 0) t = komma > punkt ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  else if (komma >= 0) t = (t.match(/,/g)!.length > 1 ? t.replace(/,/g, '') : t.replace(',', '.'));
  const v = Number(t);
  return Number.isFinite(v) ? v : NaN;
}

export type KmEnhed = 'auto' | 'km' | 'm';

/** Stationering til meter. «12+345,678» = 12 345,678 m. Ellers km eller m efter enhed. */
export function parseKm(s: string | undefined, enhed: Exclude<KmEnhed, 'auto'>): number {
  if (s === undefined) return NaN;
  const t = s.trim();
  const m = t.match(/^(-?\d+)\s*\+\s*([\d.,\s]+)$/);
  if (m) return Number(m[1]) * 1000 + parseTal(m[2]);
  const v = parseTal(t);
  return enhed === 'km' ? v * 1000 : v;
}

/** Gæt enheden for en kolonne med stationeringer. */
export function gaetKmEnhed(vaerdier: string[]): Exclude<KmEnhed, 'auto'> {
  const v = vaerdier.filter((x) => x && x.trim());
  if (v.some((x) => /\d\s*\+\s*\d/.test(x))) return 'km'; // håndteres alligevel af parseKm
  const tal = v.map(parseTal).filter(Number.isFinite);
  if (!tal.length) return 'm';
  return Math.max(...tal.map(Math.abs)) < 1000 ? 'km' : 'm';
}

/* ============================== tabelimport ============================== */

export interface Tabel { header: string[]; rows: string[][]; delimiter: string }

export function parseTabel(tekst: string): Tabel {
  const linjer = tekst.replace(/\r/g, '').split('\n').filter((l) => l.trim() && !/^\s*(#|\/\/)/.test(l));
  const kand = ['\t', ';', '|', ','];
  let delim = '';
  for (const d of kand) {
    const n = linjer.slice(0, 20).map((l) => l.split(d).length);
    if (n.length && Math.min(...n) > 1 && n.filter((x) => x === n[0]).length >= n.length * 0.6) { delim = d; break; }
  }
  const split = (l: string) => (delim ? l.split(delim) : l.trim().split(/\s{2,}|\s+(?=[-+]?\d)/)).map((c) => c.trim().replace(/^"(.*)"$/, '$1'));
  const alle = linjer.map(split);
  const erTal = (c: string) => Number.isFinite(parseTal(c)) || /^\d+\s*\+/.test(c);
  // Header = første række, hvor de fleste celler ikke er tal
  let hi = -1;
  for (let i = 0; i < Math.min(5, alle.length); i++) {
    const r = alle[i];
    if (r.filter((c) => c && !erTal(c)).length >= Math.max(2, r.length * 0.6)) { hi = i; }
    if (hi >= 0 && i > hi) break;
  }
  const header = hi >= 0 ? alle[hi] : alle[0].map((_, j) => `Kolonne ${j + 1}`);
  const rows = alle.slice(hi + 1).filter((r) => r.some((c) => c));
  return { header, rows, delimiter: delim || 'mellemrum' };
}

export type Felt = 'ignorer' | 'type' | 'km0' | 'km1' | 'L' | 'R0' | 'R1' | 'A' | 'h0' | 'h1' | 'retning' | 'V' | 'tekst';

export const FELT_TEKST: Record<Felt, string> = {
  ignorer: '– ignorér –', type: 'Elementtype', km0: 'Km start', km1: 'Km slut', L: 'Længde L', R0: 'Radius (start)',
  R1: 'Radius slut', A: 'Klotoideparameter A', h0: 'Overhøjde (start)', h1: 'Overhøjde slut', retning: 'Retning (V/H)',
  V: 'Hastighed V', tekst: 'Bemærkning',
};

/** Automatisk kolonnegenkendelse ud fra overskrifter. */
export function gaetFelter(header: string[]): Felt[] {
  const brugt = new Set<Felt>();
  const regler: [Felt, RegExp][] = [
    ['km1', /(km|st(at|\.)?|station(ering)?|kilomet).*(slut|til|end|2\b)|^(slut|til|end)(km|st)?$/],
    ['km0', /(km|st(at|\.)?|station(ering)?|kilomet).*(start|fra|beg|from|1\b)|^(start|fra|from)(km|st)?$|^(km|station|stationering|st)$/],
    ['R1', /(radius|^r).*(slut|til|end|2\b)/],
    ['R0', /^(r|radius|r\s*\[m\]|radius\s*\[m\])$|(radius|^r).*(start|fra|beg|1\b)/],
    ['h1', /(overh|^h|^oh|cant|^d).*(slut|til|end|2\b)/],
    ['h0', /^(h|oh|d|overh\S*|overhøjde|cant)(\s*\[mm\])?$|(overh|^h|^oh|cant).*(start|fra|beg|1\b)/],
    ['A', /^(a|klotoide\S*|a-?param\S*|parameter|klot\.?a)(\s*\[m\])?$/],
    ['L', /^(l|længde|laengde|length|lgd\.?)(\s*\[m\])?$/],
    ['type', /^(type|element\S*|geometri\S*|elem\.?|el\.?type)$/],
    ['retning', /retn|^dir|^side$|^v\/h$|^rot/],
    ['V', /^(v|vmax|hast\S*|speed|v\s*\[km\/t\]|v_?str\S*)$/],
    ['tekst', /bem|note|beskr|tekst|desc|kommentar/],
  ];
  return header.map((hd) => {
    const t = hd.toLowerCase().replace(/[_]/g, ' ').trim();
    for (const [f, re] of regler) if (!brugt.has(f) && re.test(t)) { brugt.add(f); return f; }
    return 'ignorer';
  });
}

export interface ImportValg {
  felter: Felt[];
  kmEnhed: KmEnhed;
  /** Fortegn for radius i filen: positiv = højre (standard) eller venstre */
  positiv: 'hoejre' | 'venstre';
}

function typeFraTekst(s: string): ElType | null {
  const t = s.toLowerCase();
  if (/klot|overg|spiral|clot|transit|^o$|^kl$/.test(t)) return 'overgang';
  if (/cirk|bue|kurve|arc|curve|circ|^c$|^k$|^b$/.test(t)) return 'kurve';
  if (/ret|linje|line|straight|tangent|lige|^r$|^l$/.test(t)) return 'ret';
  return null;
}

function retningFortegn(s: string | undefined): number {
  if (!s) return 0;
  const t = s.trim().toLowerCase();
  if (/^(v|l|venstre|left|ccw|mod uret)/.test(t)) return -1;
  if (/^(h|r|højre|hoejre|right|cw|med uret)/.test(t)) return 1;
  return 0;
}

/** Bygger elementer ud fra en tabel og kolonnevalg. */
export function elementerFraTabel(tab: Tabel, v: ImportValg): { elementer: Element[]; advarsler: string[] } {
  const idx = (f: Felt) => v.felter.indexOf(f);
  const get = (r: string[], f: Felt) => (idx(f) >= 0 ? r[idx(f)] : undefined);
  const enhed = v.kmEnhed === 'auto'
    ? gaetKmEnhed(tab.rows.map((r) => get(r, 'km0') ?? get(r, 'km1') ?? ''))
    : v.kmEnhed;
  const sgnFil = v.positiv === 'hoejre' ? 1 : -1;
  const raa: (Element & { _R0?: number; _R1?: number; _h0?: number; _h1?: number })[] = [];
  const advarsler: string[] = [];
  for (const r of tab.rows) {
    const km0 = parseKm(get(r, 'km0'), enhed), km1 = parseKm(get(r, 'km1'), enhed);
    let L = parseTal(get(r, 'L'));
    const ret = retningFortegn(get(r, 'retning'));
    const rad = (x: number) => (Number.isFinite(x) && x !== 0 ? (ret ? ret * Math.abs(x) : sgnFil * x) : x === 0 ? 0 : NaN);
    const R0 = rad(parseTal(get(r, 'R0'))), R1 = rad(parseTal(get(r, 'R1')));
    const A = parseTal(get(r, 'A'));
    const h0 = parseTal(get(r, 'h0')), h1 = parseTal(get(r, 'h1'));
    const Vv = parseTal(get(r, 'V'));
    const tt = get(r, 'type');
    let type = tt ? typeFraTekst(tt) : null;
    if (!type) type = Number.isFinite(A) && A > 0 ? 'overgang' : Number.isFinite(R0) && R0 !== 0 ? 'kurve' : 'ret';
    if (!Number.isFinite(L) && Number.isFinite(km0) && Number.isFinite(km1)) L = Math.abs(km1 - km0);
    if (!Number.isFinite(L) && type === 'overgang' && Number.isFinite(A) && (Number.isFinite(R0) || Number.isFinite(R1))) {
      const Rk = Math.abs(Number.isFinite(R1) && R1 ? R1 : R0);
      if (Rk) L = (A * A) / Rk;
    }
    if (!Number.isFinite(L) && !Number.isFinite(km0)) continue; // ikke en elementrække
    raa.push({
      type, km0, km1, L, R0: 0, R1: 0, h0: 0, h1: 0,
      A: Number.isFinite(A) ? A : undefined, V: Number.isFinite(Vv) ? Vv : undefined, tekst: get(r, 'tekst') || undefined,
      _R0: R0, _R1: R1, _h0: h0, _h1: h1,
    });
  }
  // Stationering og længder
  for (let i = 0; i < raa.length; i++) {
    const e = raa[i];
    if (!Number.isFinite(e.km0)) e.km0 = i ? raa[i - 1].km1 : 0;
    if (!Number.isFinite(e.L)) e.L = Number.isFinite(e.km1) ? Math.abs(e.km1 - e.km0) : 0;
    if (!Number.isFinite(e.km1)) e.km1 = e.km0 + e.L;
    if (i && Math.abs(e.km0 - raa[i - 1].km1) > 0.5) advarsler.push(`Element ${i + 1}: spring i stationering på ${(e.km0 - raa[i - 1].km1).toFixed(2)} m.`);
  }
  // Radier og overhøjder for kurver og retlinjer
  for (const e of raa) {
    if (e.type === 'ret') { e.R0 = e.R1 = 0; e.h0 = Number.isFinite(e._h0!) ? e._h0! : 0; e.h1 = Number.isFinite(e._h1!) ? e._h1! : e.h0; }
    if (e.type === 'kurve') {
      e.R0 = e.R1 = Number.isFinite(e._R0!) ? e._R0! : Number.isFinite(e._R1!) ? e._R1! : 0;
      e.h0 = e.h1 = Number.isFinite(e._h0!) ? e._h0! : Number.isFinite(e._h1!) ? e._h1! : 0;
      if (!e.R0) { e.type = 'ret'; }
    }
  }
  // Overgangskurver: radius og overhøjde fra filen eller fra naboelementerne
  for (let i = 0; i < raa.length; i++) {
    const e = raa[i];
    if (e.type !== 'overgang') continue;
    const fo = raa[i - 1], ef = raa[i + 1];
    const harBegge = Number.isFinite(e._R0!) && Number.isFinite(e._R1!);
    e.R0 = harBegge ? e._R0! : fo ? fo.R1 : 0;
    e.R1 = harBegge ? e._R1! : ef ? ef.R0 : Number.isFinite(e._R0!) ? e._R0! : 0;
    e.h0 = Number.isFinite(e._h0!) && Number.isFinite(e._h1!) ? e._h0! : fo ? fo.h1 : 0;
    e.h1 = Number.isFinite(e._h0!) && Number.isFinite(e._h1!) ? e._h1! : ef ? ef.h0 : Number.isFinite(e._h0!) ? e._h0! : 0;
    if (!e.A && e.L > 0) {
      const dk = Math.abs(kappa(e.R1) - kappa(e.R0));
      if (dk > 0) e.A = Math.sqrt(e.L / dk);
    }
  }
  // Retlinjer mellem overgange: overhøjde fra nabo, hvis rampe fortsætter (sjældent)
  const elementer: Element[] = raa.map(({ _R0, _R1, _h0, _h1, ...e }) => { void _R0; void _R1; void _h0; void _h1; return e; });
  if (!elementer.length) advarsler.push('Ingen elementer fundet – kontrollér kolonnevalget.');
  return { elementer, advarsler };
}

/* ============================== LandXML ============================== */

/**
 * LandXML 1.x: <Alignment><CoordGeom> med <Line>, <Curve> og <Spiral>, samt evt. <Cant> med <CantStation>.
 * Fortegn: rot="cw" = højrekurve (positiv), rot="ccw" = venstrekurve.
 */
export function parseLandXML(xml: string): { navn: string; elementer: Element[]; advarsler: string[] }[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('Filen kan ikke læses som XML.');
  const alle = Array.from(doc.getElementsByTagNameNS('*', 'Alignment'));
  return alle.map((al) => {
    const advarsler: string[] = [];
    const sta0 = parseFloat(al.getAttribute('staStart') ?? '0') || 0;
    const geom = al.getElementsByTagNameNS('*', 'CoordGeom')[0];
    const elementer: Element[] = [];
    let km = sta0;
    for (const el of Array.from(geom?.children ?? [])) {
      const n = el.localName;
      const len = parseFloat(el.getAttribute('length') ?? 'NaN');
      const rot = (el.getAttribute('rot') ?? '').toLowerCase();
      const sgn = rot === 'ccw' ? -1 : 1;
      const st = parseFloat(el.getAttribute('staStart') ?? 'NaN');
      const k0 = Number.isFinite(st) ? st : km;
      if (n === 'Line') {
        const L = Number.isFinite(len) ? len : laengdeFraPunkter(el);
        elementer.push({ type: 'ret', km0: k0, km1: k0 + L, L, R0: 0, R1: 0, h0: 0, h1: 0 });
        km = k0 + L;
      } else if (n === 'Curve') {
        const R = parseFloat(el.getAttribute('radius') ?? 'NaN');
        const L = Number.isFinite(len) ? len : Math.abs(R * parseFloat(el.getAttribute('delta') ?? '0') * Math.PI / 180);
        elementer.push({ type: 'kurve', km0: k0, km1: k0 + L, L, R0: sgn * R, R1: sgn * R, h0: 0, h1: 0 });
        km = k0 + L;
      } else if (n === 'Spiral') {
        const rs = el.getAttribute('radiusStart') ?? 'INF', re = el.getAttribute('radiusEnd') ?? 'INF';
        const r = (s: string) => (/inf/i.test(s) ? 0 : sgn * parseFloat(s));
        const L = len;
        const e: Element = { type: 'overgang', km0: k0, km1: k0 + L, L, R0: r(rs), R1: r(re), h0: 0, h1: 0 };
        const dk = Math.abs(kappa(e.R1) - kappa(e.R0));
        if (dk > 0) e.A = Math.sqrt(L / dk);
        elementer.push(e);
        km = k0 + L;
      } else if (n !== 'IrregularLine') advarsler.push(`Ukendt element <${n}> sprunget over.`);
    }
    // Overhøjde fra <Cant>
    const cant = al.getElementsByTagNameNS('*', 'Cant')[0];
    if (cant) {
      const pkt = Array.from(cant.getElementsByTagNameNS('*', 'CantStation')).map((c) => ({
        s: parseFloat(c.getAttribute('station') ?? 'NaN'),
        h: Math.abs(parseFloat(c.getAttribute('appliedCant') ?? 'NaN')) * (cantEnhedMm(cant) ? 1 : 1000),
      })).filter((p) => Number.isFinite(p.s) && Number.isFinite(p.h)).sort((a, b) => a.s - b.s);
      const hAt = (s: number) => {
        if (!pkt.length) return 0;
        if (s <= pkt[0].s) return pkt[0].h;
        for (let i = 1; i < pkt.length; i++) if (s <= pkt[i].s) return pkt[i - 1].h + (pkt[i].h - pkt[i - 1].h) * (s - pkt[i - 1].s) / (pkt[i].s - pkt[i - 1].s || 1);
        return pkt[pkt.length - 1].h;
      };
      for (const e of elementer) { e.h0 = Math.round(hAt(e.km0 + 1e-6)); e.h1 = Math.round(hAt(e.km1 - 1e-6)); if (e.type === 'ret') { e.h0 = e.h1 = 0; } }
    } else advarsler.push('Ingen <Cant> i filen – overhøjde er sat til 0 og skal angives.');
    return { navn: al.getAttribute('name') ?? 'Linjeføring', elementer, advarsler };
  });
}

function cantEnhedMm(cant: Element | globalThis.Element): boolean {
  // LandXML angiver appliedCant i projektets lineære enhed; antag mm hvis værdier > 1
  const v = Array.from((cant as globalThis.Element).getElementsByTagNameNS('*', 'CantStation')).map((c) => Math.abs(parseFloat(c.getAttribute('appliedCant') ?? '0')));
  return v.some((x) => x > 1);
}

function laengdeFraPunkter(el: globalThis.Element): number {
  const p = (tag: string) => (el.getElementsByTagNameNS('*', tag)[0]?.textContent ?? '').trim().split(/\s+/).map(Number);
  const a = p('Start'), b = p('End');
  return a.length >= 2 && b.length >= 2 ? Math.hypot(b[0] - a[0], b[1] - a[1]) : 0;
}

/* ============================== beregning ============================== */

export const kappa = (R: number) => (R ? 1 / R : 0);
/** Overhøjde med fortegn efter kurvens retning (positiv i højrekurver) */
const hs = (h: number, R: number) => (R ? Math.sign(R) * h : 0);

export interface Kriterie {
  navn: string;
  /** Største hastighed ved normal- og undtagelsesgrænsen [km/t] */
  Vn: number; Vu: number;
  formel: string;
}

export interface Vaerdi { label: string; symbol: string; v: number; unit: string; d: number; graense?: string; status?: Status; formel?: string }

export interface ElementAnalyse {
  nr: number;
  e: Element;
  kriterier: Kriterie[];
  /** Elementets egen største hastighed [km/t] (ubegrænset = Infinity) */
  VmaxN: number; VmaxU: number;
  /** Tilladt hastighed for kurvegruppen, rundet ned til 5 km/t og begrænset af strækningshastigheden */
  VtN: number; VtU: number;
  /** Bestemmende kriterium (normal) */
  begraensning: string;
  /** Hastighed beregningerne er vist ved */
  Veval: number;
  vaerdier: Vaerdi[];
  status: Status;
}

const C = cantConstant(BANEDANMARK);

/** V hvor f(V) netop rammer grænsen (f voksende i V); halvering på [0, 500]. */
function loes(f: (V: number) => number, graense: number): number {
  if (f(500) <= graense) return Infinity;
  let lo = 0, hi = 500;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (f(m) <= graense) lo = m; else hi = m; }
  return lo;
}

/** Overhøjdeunderskud med fortegn ved radius R og overhøjde h (h med fortegn efter kurve) */
const Is = (V: number, R: number, hSigned: number) => C * V * V * kappa(R) - hSigned;

export function elementKriterier(e: Element, s: Settings, rs: RuleSet = BANEDANMARK): Kriterie[] {
  const k: Kriterie[] = [];
  if (e.type === 'kurve' && e.R0) {
    const R = Math.abs(e.R0), h = e.h0;
    const vI = (I: number) => Math.sqrt(Math.max(0, h + I) * R / C);
    let Vu = vI(iUndtagelse(140, s));
    if (Vu > 140) Vu = Math.max(140, vI(iUndtagelse(141, s)));
    k.push({ navn: 'Overhøjdeunderskud I', Vn: vI(rs.manglendeOverhoejdeMax.normal), Vu, formel: 'V = √((h + I)·R / C)' });
  }
  if (e.type === 'overgang' && e.L > 0) {
    const dh = Math.abs(e.h1 - e.h0);
    const a0 = hs(e.h0, e.R0 || e.R1), a1 = hs(e.h1, e.R1 || e.R0);
    const dI = (V: number) => Math.abs(Is(V, e.R1, a1) - Is(V, e.R0, a0));
    if (dh > 0) k.push({ navn: 'Overhøjdeændring dh/dt', Vn: 3.6 * e.L * rs.dhdtMax.normal / dh, Vu: 3.6 * e.L * rs.dhdtMax.undtagelse / dh, formel: 'V = 3,6·L·(dh/dt) / Δh' });
    k.push({
      navn: 'Ændring af underskud dI/dt',
      Vn: loes((V) => (V / 3.6) * dI(V) / e.L, rs.dIdtMax.normal),
      Vu: loes((V) => (V / 3.6) * dI(V) / e.L, rs.dIdtMax.undtagelse),
      formel: 'v·|ΔI(V)| / L = (dI/dt)max',
    });
  }
  return k;
}

const ned5 = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.floor(v / 5 + 1e-9) * 5) : Infinity);

export interface ProfilValg { V: number; Vmin: number; vurderVed: 'profil' | 'straekning' }

export function analyser(elementer: Element[], valg: ProfilValg, s: Settings, rs: RuleSet = BANEDANMARK): ElementAnalyse[] {
  const krit = elementer.map((e) => elementKriterier(e, s, rs));
  const egen = krit.map((k) => ({
    n: Math.min(Infinity, ...k.map((x) => x.Vn)),
    u: Math.min(Infinity, ...k.map((x) => x.Vu)),
  }));
  // Kurvegrupper: sammenhængende ikke-rette elementer kører med samme hastighed
  const gruppe: number[] = [];
  let g = -1;
  elementer.forEach((e, i) => { if (e.type === 'ret') { gruppe.push(-1); } else { if (i === 0 || elementer[i - 1].type === 'ret') g++; gruppe.push(g); } });
  const gMin = new Map<number, { n: number; u: number }>();
  gruppe.forEach((gg, i) => {
    if (gg < 0) return;
    const m = gMin.get(gg) ?? { n: Infinity, u: Infinity };
    gMin.set(gg, { n: Math.min(m.n, egen[i].n), u: Math.min(m.u, egen[i].u) });
  });
  return elementer.map((e, i) => {
    const gm = gruppe[i] >= 0 ? gMin.get(gruppe[i])! : { n: Infinity, u: Infinity };
    const VtN = Math.min(valg.V, ned5(gm.n)), VtU = Math.min(valg.V, ned5(gm.u));
    let begraensning = 'Strækningshastighed';
    if (ned5(gm.n) < valg.V) {
      const j = gruppe.findIndex((x, jj) => x === gruppe[i] && egen[jj].n === gm.n);
      const kk = krit[j].find((x) => x.Vn === gm.n);
      begraensning = `${kk?.navn ?? ''}${j !== i ? ` (element ${j + 1})` : ''}`;
    }
    const Veval = valg.vurderVed === 'straekning' ? valg.V : VtN;
    const { vaerdier, status } = vaerdierVed(e, Veval, valg.Vmin, s, rs);
    return { nr: i + 1, e, kriterier: krit[i], VmaxN: egen[i].n, VmaxU: egen[i].u, VtN, VtU, begraensning, Veval, vaerdier, status };
  });
}

/** Alle parametre for et element ved hastigheden V. */
export function vaerdierVed(e: Element, V: number, Vmin: number, s: Settings, rs: RuleSet = BANEDANMARK): { vaerdier: Vaerdi[]; status: Status } {
  const v: Vaerdi[] = [];
  const st: Status[] = [];
  const lim = limitI(rs, V, s);
  const f = (l: { normal: number; undtagelse: number }) => `≤ ${l.normal} / ${l.undtagelse}`;
  if (e.type === 'kurve' && e.R0) {
    const R = Math.abs(e.R0), h = e.h0;
    const heq = C * V * V / R, I = heq - h, E = h - C * Vmin * Vmin / R;
    const sh = vurder(h, rs.overhoejdeMax), sI = vurder(Math.max(0, I), lim), sE = vurder(Math.max(0, E), rs.overskydendeOverhoejdeMax);
    st.push(sh, sI, sE);
    v.push(
      { label: 'Afbalanceret overhøjde', symbol: 'hₐ', v: heq, unit: 'mm', d: 0, formel: 'C·V²/R' },
      { label: 'Overhøjde', symbol: 'h', v: h, unit: 'mm', d: 0, graense: f(rs.overhoejdeMax), status: sh },
      { label: 'Overhøjdeunderskud', symbol: 'I', v: I, unit: 'mm', d: 0, graense: f(lim), status: sI, formel: 'hₐ − h' },
      { label: `Overhøjdeoverskud (V = ${Vmin})`, symbol: 'E', v: E, unit: 'mm', d: 0, graense: f(rs.overskydendeOverhoejdeMax), status: sE, formel: 'h − C·Vmin²/R' },
      { label: 'Ukompenseret sideacceleration', symbol: 'a_q', v: rs.g * I / rs.kontaktafstand, unit: 'm/s²', d: 2, formel: 'g·I/1500' },
    );
  }
  if (e.type === 'overgang' && e.L > 0) {
    const dh = Math.abs(e.h1 - e.h0);
    const a0 = hs(e.h0, e.R0 || e.R1), a1 = hs(e.h1, e.R1 || e.R0);
    const I0 = Is(V, e.R0, a0), I1 = Is(V, e.R1, a1);
    const dI = Math.abs(I1 - I0);
    const dhdt = (V / 3.6) * dh / e.L, dIdt = (V / 3.6) * dI / e.L, dhds = dh / e.L;
    const s1 = vurder(dhdt, rs.dhdtMax), s2 = vurder(dIdt, rs.dIdtMax), s3 = vurder(dhds, rs.dhdsMax);
    st.push(s1, s2, s3);
    v.push(
      { label: 'Overhøjdeændring', symbol: 'Δh', v: dh, unit: 'mm', d: 0 },
      { label: 'Underskud ved start / slut', symbol: 'I₀ / I₁', v: NaN, unit: `${Math.round(Math.abs(I0))} / ${Math.round(Math.abs(I1))} mm`, d: 0 },
      { label: 'Overhøjdeændring pr. tid', symbol: 'dh/dt', v: dhdt, unit: 'mm/s', d: 1, graense: f(rs.dhdtMax), status: s1, formel: 'v·Δh/L' },
      { label: 'Ændring af underskud pr. tid', symbol: 'dI/dt', v: dIdt, unit: 'mm/s', d: 1, graense: f(rs.dIdtMax), status: s2, formel: 'v·ΔI/L' },
      { label: 'Rampestigning', symbol: 'dh/ds', v: dhds, unit: 'mm/m', d: 2, graense: `≤ ${rs.dhdsMax.normal}`, status: s3, formel: 'Δh/L' },
      { label: 'Rampe 1:n', symbol: 'n', v: dh > 0 ? 1000 * e.L / dh : NaN, unit: '', d: 0, graense: dh > 0 ? `n ≥ ${rs.rampeFaktor.normal}·V = ${rs.rampeFaktor.normal * V}` : undefined },
    );
    if (e.A) v.push({ label: 'Klotoideparameter', symbol: 'A', v: e.A, unit: 'm', d: 0 });
  }
  if (e.type === 'ret' && (e.h0 || e.h1)) v.push({ label: 'Overhøjde på ret spor', symbol: 'h', v: Math.max(e.h0, e.h1), unit: 'mm', d: 0, graense: 'normalt 0' });
  return { vaerdier: v, status: samletStatus(st) };
}

/* ============================== lagring ============================== */

const PKEY = 'sporkit:projekter', AKEY = 'sporkit:aktivt-projekt';

export function nytProjekt(navn = 'Nyt projekt'): Projekt {
  const nu = new Date().toISOString();
  return { id: Math.random().toString(36).slice(2, 10), navn, straekning: '', oprettet: nu, opdateret: nu, V: 160, Vmin: 80, grundlag: 'eksisterende', data: {}, noter: '' };
}

export function hentProjekter(): Projekt[] {
  try { const r = localStorage.getItem(PKEY); if (r) return JSON.parse(r) as Projekt[]; } catch { /* */ }
  return [];
}
export function gemProjekter(p: Projekt[]): boolean {
  try { localStorage.setItem(PKEY, JSON.stringify(p)); return true; } catch { return false; }
}
export function aktivtId(): string | null { try { return localStorage.getItem(AKEY); } catch { return null; } }
export function saetAktivt(id: string): void { try { localStorage.setItem(AKEY, id); } catch { /* */ } }

/** Validerer en importeret projektfil (.sporkit.json). */
export function laesProjektfil(tekst: string): Projekt {
  const p = JSON.parse(tekst) as Partial<Projekt> & { format?: string };
  if (!p || typeof p !== 'object' || !p.data || !p.navn) throw new Error('Filen er ikke et SporKit-projekt.');
  const n = nytProjekt(p.navn);
  return { ...n, ...p, id: n.id } as Projekt;
}

/* ============================== eksempel ============================== */

/** Fiktivt eksempel (ingen rigtig strækning) til at prøve modulet. */
export const EKSEMPEL_CSV = `Element;Km start;Km slut;Radius;A;Overhøjde;V;Bemærkning
Ret;12+000,000;12+400,000;;;0;160;
Klotoide;12+400,000;12+550,000;;346,4;;160;
Cirkelbue;12+550,000;12+850,000;800;;120;160;
Klotoide;12+850,000;13+000,000;;346,4;;160;
Ret;13+000,000;13+300,000;;;0;160;
Klotoide;13+300,000;13+400,000;;244,9;;100;
Cirkelbue;13+400,000;13+520,000;-600;;100;100;Venstrekurve
Klotoide;13+520,000;13+620,000;;244,9;;100;
Ret;13+620,000;14+100,000;;;0;160;
Klotoide;14+100,000;14+200,000;;447,2;;160;
Cirkelbue;14+200,000;14+620,000;2000;;60;160;
Klotoide;14+620,000;14+720,000;;447,2;;160;
Ret;14+720,000;15+000,000;;;0;160;`;
