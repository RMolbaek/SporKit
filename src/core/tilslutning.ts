/**
 * Tilslutning af et projekteret spor (geometrirapport/LandXML) til eksisterende spor (spordataliste),
 * kontrol i tilslutningspunkterne (samme overhøjde, fiktivt ryk) og generering af tracétavler efter BN2-93
 * med sammenligning mod eksisterende tavler – også uden for projektets grænser.
 */
import { kappa, springDI, type Element, type Spring } from './projekt';
import { BANEDANMARK, fiktivtRyk, limitFiktivtRyk, limitSpringI, samletStatus, vurder, type SporKlasse, type Status } from './rules';
import { cantConstant } from './formulas';
import { horisontaleTavler, type Element as TElement, type Overgang, type Tavle } from './tracetavle';

/* ============================== geometri i et punkt ============================== */

export interface Tilstand {
  idx: number;
  e: Element;
  /** Radius (med fortegn, 0 = ret) og overhøjde [mm] i punktet */
  R: number; h: number;
  /** Punktet ligger inde i elementet (ikke på en grænse) */
  inde: boolean;
}

/** Krumning og overhøjde varierer lineært gennem en overgangskurve. */
function interp(e: Element, km: number): { R: number; h: number } {
  const t = e.L > 0 ? Math.min(1, Math.max(0, (km - e.km0) / e.L)) : 0;
  const k = kappa(e.R0) + (kappa(e.R1) - kappa(e.R0)) * t;
  return { R: Math.abs(k) < 1e-9 ? 0 : 1 / k, h: e.h0 + (e.h1 - e.h0) * t };
}

/** Tilstand i stationering km; side = 'foer' tager elementet der slutter i km, 'efter' det der starter. */
export function tilstandVed(el: Element[], km: number, side: 'foer' | 'efter'): Tilstand | null {
  const tol = 1e-3;
  let idx = side === 'foer'
    ? el.findIndex((e) => km > e.km0 + tol && km <= e.km1 + tol)
    : el.findIndex((e) => km >= e.km0 - tol && km < e.km1 - tol);
  if (idx < 0) idx = el.findIndex((e) => km >= e.km0 - tol && km <= e.km1 + tol);
  if (idx < 0) return null;
  const e = el[idx];
  const { R, h } = interp(e, km);
  return { idx, e, R, h, inde: km > e.km0 + 0.01 && km < e.km1 - 0.01 };
}

/** Klip en elementliste til [fra, til]; elementer, der skæres, får interpoleret R og h i snittet. */
export function klip(el: Element[], fra: number, til: number): Element[] {
  const ud: Element[] = [];
  for (const e of el) {
    const a = Math.max(e.km0, fra), b = Math.min(e.km1, til);
    if (b - a < 1e-6) continue;
    const s0 = interp(e, a), s1 = interp(e, b);
    const n: Element = { ...e, km0: a, km1: b, L: b - a, R0: s0.R, R1: s1.R, h0: s0.h, h1: s1.h };
    if (e.type === 'kurve') { n.R0 = n.R1 = e.R0; n.h0 = n.h1 = e.h0; }
    if (e.type === 'ret') { n.R0 = n.R1 = 0; }
    if (n.type === 'overgang' && n.L > 0) {
      const dk = Math.abs(kappa(n.R1) - kappa(n.R0));
      n.A = dk > 0 ? Math.sqrt(n.L / dk) : undefined;
    }
    ud.push(n);
  }
  return ud;
}

/** Oprindelse for et element i det samlede spor */
export type Kilde = 'eks' | 'proj' | 'samlet';
export interface SamletElement extends Element { kilde: Kilde; delAf: number[] }

const ens = (a: Element, b: Element) =>
  a.type === b.type && a.type !== 'overgang' && Math.abs(kappa(a.R0) - kappa(b.R0)) < 1e-7 && Math.abs(a.h0 - b.h0) < 0.5;

export interface TilslutningInput {
  /** Projektets start (fælles stationering) [m] */
  start: number;
  /** Projektets slut i projektets stationering [m] */
  slutProj: number;
  /** Samme punkt i den eksisterende stationering [m] (km-spring = slutEks − slutProj) */
  slutEks: number;
}

/**
 * Samlet spor: eksisterende før start + projekt [start; slutProj] + eksisterende efter slutEks.
 * Rette spor og cirkelbuer med samme radius og overhøjde, der støder op til hinanden, slås sammen –
 * så en kurve, der forlænges/afkortes af projektet, får sin nye samlede længde (Kvl).
 */
export function samletSpor(eks: Element[], proj: Element[], t: TilslutningInput): SamletElement[] {
  const dele: SamletElement[] = [
    ...klip(eks, -Infinity, t.start).map((e) => ({ ...e, kilde: 'eks' as Kilde, delAf: [] })),
    ...klip(proj, t.start, t.slutProj).map((e) => ({ ...e, kilde: 'proj' as Kilde, delAf: [] })),
    ...klip(eks, t.slutEks, Infinity).map((e) => ({ ...e, kilde: 'eks' as Kilde, delAf: [] })),
  ];
  const ud: SamletElement[] = [];
  for (const e of dele) {
    const f = ud[ud.length - 1];
    if (f && ens(f, e) && f.kilde !== e.kilde) {
      f.km1 = e.km1; // efter projektets slut følges den eksisterende stationering
      f.L += e.L;
      f.kilde = 'samlet';
      continue;
    }
    ud.push({ ...e });
  }
  return ud;
}

/* ============================== kontrol i tilslutningspunkt ============================== */

export interface PunktKontrol {
  navn: string;
  km: number;
  eks: Tilstand | null;
  proj: Tilstand | null;
  checks: { label: string; value: string; graense: string; status: Status; kilde: string }[];
  status: Status;
  noter: string[];
  /** Største hastighed ved springet (normal/undtagelse) */
  Vmax?: { n: number; u: number };
}

const f0 = (x: number) => Math.round(x).toLocaleString('da-DK');
const f1 = (x: number) => x.toLocaleString('da-DK', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const rT = (R: number) => (R ? `${f0(Math.abs(R))} ${R > 0 ? 'H' : 'V'}` : 'ret');
const TYPE: Record<Element['type'], string> = { ret: 'ret spor', kurve: 'cirkelbue', overgang: 'overgangskurve' };

/**
 * Kontrol i ét tilslutningspunkt. `ind` = sporet der kommer ind i punktet, `ud` = sporet der fortsætter.
 * V er hastigheden i punktet (profil eller strækningshastighed).
 */
export function kontrolPunkt(navn: string, km: number, ind: Tilstand | null, ud: Tilstand | null, V: number, klasse: SporKlasse, rolle: { ind: 'eks' | 'proj'; ud: 'eks' | 'proj' }): PunktKontrol {
  const eks = rolle.ind === 'eks' ? ind : ud, proj = rolle.ind === 'proj' ? ind : ud;
  const k: PunktKontrol = { navn, km, eks, proj, checks: [], status: 'ok', noter: [] };
  if (!ind || !ud) {
    k.noter.push(`Punktet ligger uden for ${!ind ? (rolle.ind === 'eks' ? 'spordatalisten' : 'geometrirapporten') : (rolle.ud === 'eks' ? 'spordatalisten' : 'geometrirapporten')} – kontrollér projektgrænsen.`);
    k.status = 'undtagelse';
    return k;
  }
  // Overhøjde skal være den samme (med fortegn efter kurvens retning)
  const hs = (t: Tilstand) => (t.R ? Math.sign(t.R) * t.h : t.h);
  const dh = Math.abs(hs(ud) - hs(ind));
  k.checks.push({ label: 'Samme overhøjde i tilslutningspunktet', value: `${f0(ind.h)} → ${f0(ud.h)} mm (Δh = ${f0(dh)} mm)`, graense: 'Δh = 0', status: dh <= 0.5 ? 'ok' : 'overskredet', kilde: 'SR87 afsn. 2.06.1' });
  // Spring i krumning → fiktivt ryk
  const sp: Spring = { foer: 0, km, R0: ind.R, R1: ud.R, h0: ind.h, h1: ud.h };
  const dk = Math.abs(kappa(ud.R) - kappa(ind.R));
  const dI = springDI(sp, V);
  if (dk > 1e-7 || dh > 0.5) {
    const ryk = fiktivtRyk(dI, V), lim = limitFiktivtRyk(V, klasse), cap = limitSpringI(V);
    k.checks.push({ label: `Spring i krumning: ${rT(ind.R)} → ${rT(ud.R)}`, value: `ΔI = ${f0(dI)} mm ved ${f0(V)} km/t`, graense: `ΔI ≤ ${cap} mm`, status: dI <= cap + 1e-9 ? 'ok' : 'overskredet', kilde: 'SR87 afsn. 2.05.3' });
    k.checks.push({ label: 'Fiktivt ryk ΔI·V/(3,6·20)', value: `${f1(ryk)} mm/s`, graense: `≤ ${lim.normal} / ${lim.undtagelse} mm/s`, status: vurder(ryk, lim), kilde: 'SR87 afsn. 2.05.2–2.05.3, tillæg 2C' });
    // største V, der overholder springkravene
    const C = cantConstant(BANEDANMARK);
    const vRyk = (l: number) => (dk > 0 && dh <= 0.5 ? Math.cbrt((l * 72) / (C * dk)) : Infinity);
    const vCap = dk > 0 && dh <= 0.5 ? Math.sqrt(125 / (C * dk)) : Infinity;
    k.Vmax = { n: Math.min(vRyk(lim.normal), vCap), u: Math.min(vRyk(lim.undtagelse), vCap) };
  } else {
    k.checks.push({ label: 'Krumning i tilslutningspunktet', value: `${rT(ind.R)} → ${rT(ud.R)}`, graense: 'ingen spring', status: 'ok', kilde: 'geometri' });
  }
  // Tilslutning inde i et eksisterende element
  if (eks?.inde) {
    if (eks.e.type === 'kurve') k.noter.push(`Tilslutter inde i eksisterende cirkelbue R = ${rT(eks.e.R0)} (km ${(eks.e.km0 / 1000).toFixed(3)}–${(eks.e.km1 / 1000).toFixed(3)}). Buens længde ændres – K-tavlen i buens anden ende (uden for projektet) skal rettes.`);
    if (eks.e.type === 'overgang') {
      k.noter.push(`Tilslutter inde i eksisterende overgangskurve (km ${(eks.e.km0 / 1000).toFixed(3)}–${(eks.e.km1 / 1000).toFixed(3)}). Overgangskurven og rampen deles – Okl/Ovh/Rpl på tavlerne i den anden ende skal rettes, og den resterende del skal kontrolleres for dh/dt og dI/dt.`);
      k.checks.push({ label: 'Tilslutning i overgangskurve', value: 'krumning og overhøjde varierer i punktet', graense: 'undgås – kræver ny overgang', status: 'undtagelse', kilde: 'BN2-93 / SR87 2.05' });
    }
  }
  k.status = samletStatus(k.checks.map((c) => c.status));
  return k;
}

/* ============================== tracétavler ============================== */

export interface KmTavle extends Tavle { km: number; kant?: boolean }

/**
 * Tracétavler (BN2-93) for en elementliste. Overgangskurver lægges mellem de omgivende rette spor/cirkelbuer,
 * rampe og overgangskurve antages sammenfaldende. Tavlernes position omregnes til stationering.
 */
export function tavlerFraElementer(el: Element[]): { tavler: KmTavle[]; advarsler: string[] } {
  const adv: string[] = [];
  if (!el.length) return { tavler: [], advarsler: adv };
  const hoved: TElement[] = [];
  const overg: Overgang[] = [];
  /** for hvert hovedelement: stationering ved start og om det er syntetisk (data begynder/slutter i en overgang) */
  const kmStart: number[] = [];
  const kmSlut: number[] = [];
  const kant: boolean[] = [];
  const addHoved = (e: Element | null, R: number, h: number, km: number, syntetisk: boolean) => {
    if (e && e.type === 'kurve') hoved.push({ type: 'bue', L: e.L, R: Math.abs(e.R0), h: e.h0 });
    else if (e && e.type === 'ret') hoved.push({ type: 'ret', L: e.L });
    else hoved.push(R ? { type: 'bue', L: 0, R: Math.abs(R), h } : { type: 'ret', L: 0 });
    kmStart.push(km);
    kmSlut.push(e ? e.km1 : km);
    kant.push(syntetisk);
  };
  let ventOK: Element | null = null;
  el.forEach((e, i) => {
    if (e.type === 'overgang') {
      if (i === 0) { addHoved(null, e.R0, e.h0, e.km0, true); adv.push('Datasættet begynder i en overgangskurve – tavlen ved starten er ufuldstændig.'); }
      if (ventOK) { addHoved(null, 0, 0, e.km0, false); overg.push({ okl: ventOK.L, rpl: 0, rstart: 0 }); } // modvendte overgange uden mellemliggende ret
      if (Math.abs(Math.abs(e.h1 - e.h0) - 0) > 0 && i > 0 && el[i - 1].type === 'ret' && el[i - 1].h1 !== e.h0) adv.push(`Overgang km ${(e.km0 / 1000).toFixed(3)}: overhøjden passer ikke med naboelementet.`);
      ventOK = e;
      if (i === el.length - 1) { overg.push({ okl: e.L, rpl: 0, rstart: 0 }); ventOK = null; addHoved(null, e.R1, e.h1, e.km1, true); adv.push('Datasættet slutter i en overgangskurve – tavlen ved slutningen er ufuldstændig.'); }
      return;
    }
    if (hoved.length) overg.push({ okl: ventOK ? ventOK.L : 0, rpl: 0, rstart: 0 });
    ventOK = null;
    addHoved(e, 0, 0, e.km0, false);
  });
  const res = horisontaleTavler(hoved, overg);
  // pos → km: tavler står i element- og overgangsgrænser; brug elementernes egen stationering (tåler km-spring)
  const tilKm = (pos: number): { km: number; kant: boolean } => {
    let j = 0;
    for (let k = 0; k < res.elementStart.length; k++) if (res.elementStart[k] <= pos + 1e-6) j = k;
    const iOverg = j < res.overgangStart.length && pos >= res.overgangStart[j] - 1e-6;
    let km: number;
    if (!iOverg) km = Math.abs(pos - res.elementStart[j]) < 1e-6 ? kmStart[j] : kmStart[j] + (pos - res.elementStart[j]);
    else {
      const ok = overg[j].okl;
      if (Math.abs(pos - res.overgangStart[j]) < 1e-6) km = kmSlut[j];
      else if (Math.abs(pos - res.overgangStart[j] - ok) < 1e-6 && j + 1 < kmStart.length) km = kmStart[j + 1];
      else km = kmSlut[j] + (pos - res.overgangStart[j]);
    }
    return { km, kant: kant[j] || (j + 1 < kant.length && iOverg && kant[j + 1]) };
  };
  const tavler = res.tavler.map((t) => { const m = tilKm(t.pos); return { ...t, km: m.km, kant: m.kant || undefined }; });
  // Tavler ved datasættets første/sidste hovedelement viser Kvl for et afskåret element
  const k0 = el[0].km0, k1 = el[el.length - 1].km1;
  for (const t of tavler) {
    const e = el.find((x) => x.type === 'kurve' && (Math.abs(x.km0 - t.km) < 0.05 || Math.abs(x.km1 - t.km) < 0.05));
    if (e && (Math.abs(e.km0 - k0) < 0.05 || Math.abs(e.km1 - k1) < 0.05)) t.kant = true;
  }
  return { tavler, advarsler: [...adv, ...res.advarsler] };
}

export type TavleStatus = 'ny' | 'rettes' | 'uaendret' | 'udgaar' | 'ny-udenfor' | 'fjernes-udenfor';
export const TAVLE_STATUS_TEKST: Record<TavleStatus, string> = {
  ny: 'Ny (projekt)',
  rettes: 'Rettes – uden for projektet',
  uaendret: 'Uændret',
  udgaar: 'Udgår (projekt)',
  'ny-udenfor': 'Ny – uden for projektet',
  'fjernes-udenfor': 'Fjernes – uden for projektet',
};

export interface TavleRaekke {
  status: TavleStatus;
  km: number;
  ny?: KmTavle;
  gammel?: KmTavle;
  /** Felter der ændres (rettes) */
  aendret: (keyof Tavle)[];
}

const FELTER: (keyof Tavle)[] = ['symbol', 'rad', 'okl', 'kvl', 'ovh', 'rpl'];
const fv = (t: Tavle | undefined, f: keyof Tavle) => (t ? String(t[f] ?? '') : '');

/**
 * Sammenlign tavler for det samlede spor med de eksisterende tavler.
 * Inde i projektet [start; slutProj] er alle tavler nye, og eksisterende tavler i [start; slutEks] udgår.
 * Uden for projektet sammenlignes tavle for tavle (samme stationering ± 0,5 m og samme symbol).
 */
export function sammenlignTavler(nye: KmTavle[], gamle: KmTavle[], t: TilslutningInput): TavleRaekke[] {
  const ud: TavleRaekke[] = [];
  const tol = 0.5;
  const inde = (km: number) => km > t.start + tol && km < t.slutProj - tol;
  const indeEks = (km: number) => km > t.start + tol && km < t.slutEks - tol;
  const brugt = new Set<KmTavle>();
  for (const n of nye) {
    if (inde(n.km)) { ud.push({ status: 'ny', km: n.km, ny: n, aendret: [] }); continue; }
    const g = gamle.find((x) => !brugt.has(x) && !indeEks(x.km) && Math.abs(x.km - n.km) <= tol && x.symbol === n.symbol);
    if (g) {
      brugt.add(g);
      const aendret = FELTER.filter((f) => fv(g, f) !== fv(n, f));
      ud.push({ status: aendret.length ? 'rettes' : 'uaendret', km: n.km, ny: n, gammel: g, aendret });
    } else ud.push({ status: 'ny-udenfor', km: n.km, ny: n, aendret: FELTER.filter((f) => fv(n, f) !== '') });
  }
  for (const g of gamle) {
    if (brugt.has(g)) continue;
    ud.push({ status: indeEks(g.km) ? 'udgaar' : 'fjernes-udenfor', km: g.km, gammel: g, aendret: [] });
  }
  ud.sort((a, b) => a.km - b.km);
  return ud;
}

export function tavlerCsv(raekker: TavleRaekke[]): string {
  const km = (m: number) => `${Math.floor(m / 1000 + 1e-9)}+${(m - Math.floor(m / 1000 + 1e-9) * 1000).toFixed(1).padStart(5, '0').replace('.', ',')}`;
  const hdr = ['Status', 'Km', 'Symbol', 'Rad', 'Okl', 'Kvl', 'Ovh', 'Rpl', 'Tidligere', 'Punkt'];
  const rows = raekker.map((r) => {
    const t = r.ny ?? r.gammel!;
    const tidl = r.status === 'rettes' && r.gammel ? r.aendret.map((f) => `${f}: ${fv(r.gammel, f)}`).join(', ') : '';
    return [TAVLE_STATUS_TEKST[r.status], km(r.km), t.symbol, fv(t, 'rad'), fv(t, 'okl'), fv(t, 'kvl'), fv(t, 'ovh'), fv(t, 'rpl'), tidl, t.punkt];
  });
  return [hdr, ...rows].map((r) => r.map((c) => (/[;"\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(';')).join('\r\n');
}

export const TYPE_TEKST_TILSLUTNING = TYPE;
