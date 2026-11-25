/**
 * Tracétavler – Banenorm BN2-93-1 «Absolut beliggenhed og fast afmærkning af sporets tracé»
 * (udgivet 01.03.2011), afsnit 10 og bilag 1–2.
 *
 * Tavlens felter: Rad, Okl, Kvl, Ovh, Rpl og et symbolfelt:
 *   '0'  nul-tavle   – overgangskurvens begyndelses-/endepunkt med nul overhøjde
 *   'K'  kurve-tavle – overgang mellem overgangskurve og cirkelbue (eller bue/ret uden OK)
 *   'R'  rampe-tavle – punkt med fuld overhøjde, når rampe og overgangskurve ikke er sammenfaldende
 *   '/\' og '\/' længdeprofil-tavler (top hhv. lavning)
 */

export type Symbol = '0' | 'K' | 'R' | '/\\' | '\\/';

export interface Tavle {
  /** Position i m fra startpunktet */
  pos: number;
  symbol: Symbol;
  rad?: number;
  okl?: number;
  kvl?: string;
  ovh?: string;
  rpl?: number;
  /** Kort beskrivelse af punktet */
  punkt: string;
  /** 'H' = linjeføring, 'V' = længdeprofil */
  plan: 'H' | 'V';
}

/* ------------------------------ linjeføring ------------------------------ */

export interface Element {
  type: 'ret' | 'bue';
  /** Længde af ret spor eller cirkelbue (Kvl) [m] */
  L: number;
  /** Radius [m] (kun bue) */
  R?: number;
  /** Overhøjde i buen [mm] (ret = 0) */
  h?: number;
}

export interface Overgang {
  /** Overgangskurvelængde [m], 0 = ingen */
  okl: number;
  /** Rampelængde [m], 0 = sammenfaldende med overgangskurven */
  rpl: number;
  /** Rampens start målt fra overgangskurvens start [m] (kan være negativ) */
  rstart: number;
}

const EPS = 0.05;
const r0 = (x: number) => Math.round(x);
const ovhStr = (a: number, b: number) => `${r0(a)}-${r0(b)}`;

export interface HorisontalResultat {
  tavler: Tavle[];
  /** Position af elementernes start [m] */
  elementStart: number[];
  /** Position af overgangenes start [m] */
  overgangStart: number[];
  laengde: number;
  advarsler: string[];
}

/**
 * Genererer tracétavler for et forløb E0 – T0 – E1 – T1 – … – En.
 * overgange[i] ligger mellem elementer[i] og elementer[i+1].
 */
export function horisontaleTavler(elementer: Element[], overgange: Overgang[]): HorisontalResultat {
  const tavler: Tavle[] = [];
  const adv: string[] = [];
  const eStart: number[] = [];
  const tStart: number[] = [];
  let pos = 0;
  for (let i = 0; i < elementer.length; i++) {
    eStart.push(pos);
    pos += Math.max(0, elementer[i].L);
    if (i < overgange.length && i < elementer.length - 1) {
      tStart.push(pos);
      pos += Math.max(0, overgange[i].okl);
    }
  }
  const total = pos;

  const hOf = (e: Element) => (e.type === 'bue' ? e.h ?? 0 : 0);

  for (let i = 0; i < elementer.length - 1; i++) {
    const a = elementer[i], b = elementer[i + 1];
    const t = overgange[i] ?? { okl: 0, rpl: 0, rstart: 0 };
    const s0 = tStart[i], s1 = s0 + t.okl;
    const ha = hOf(a), hb = hOf(b);
    const dh = hb - ha;
    const sammenfaldende = t.rpl <= 0 || (Math.abs(t.rpl - t.okl) < EPS && Math.abs(t.rstart) < EPS);
    const rA = sammenfaldende ? s0 : s0 + t.rstart;
    const rB = sammenfaldende ? s1 : rA + t.rpl;
    const rpl = sammenfaldende ? undefined : r0(t.rpl);
    const harRampe = Math.abs(dh) > 0;
    const ovh = harRampe ? ovhStr(ha, hb) : undefined;
    const navn = `${a.type === 'ret' ? 'Ret' : `R ${r0(a.R ?? 0)}`} → ${b.type === 'ret' ? 'ret' : `R ${r0(b.R ?? 0)}`}`;

    if (a.type === 'ret' && b.type === 'ret') {
      if (t.okl > 0) adv.push(`Overgang ${i + 1}: overgangskurve mellem to rette spor ignoreres.`);
      continue;
    }
    if (harRampe && t.okl <= 0 && t.rpl <= 0) {
      adv.push(`Overgang ${i + 1} (${navn}): overhøjden ændres ${ovh} mm uden overgangskurve eller rampe – angiv Rpl.`);
    }

    const egne: Tavle[] = [];
    const lavTavle = (p: number, side: 'a' | 'b'): Tavle | null => {
      const e = side === 'a' ? a : b;
      const andet = side === 'a' ? b : a;
      if (t.okl > 0) {
        if (e.type === 'ret') {
          // nul-tavle med data for buen på den anden side
          return { pos: p, symbol: '0', rad: r0(andet.R ?? 0), okl: r0(t.okl), ovh: ovh ?? ovhStr(ha, hb), rpl, punkt: `${navn}: OK ${side === 'a' ? 'start' : 'slut'}`, plan: 'H' };
        }
        return { pos: p, symbol: 'K', rad: r0(e.R ?? 0), kvl: String(r0(e.L)), okl: r0(t.okl), punkt: `${navn}: ${side === 'a' ? 'bue slut' : 'bue start'}`, plan: 'H' };
      }
      if (e.type === 'ret') return null;
      // Uden overgangskurve: Rad, Ovh, Kvl og Okl (= 0). Ovh udelades, hvis der er en ikke-sammenfaldende rampe.
      return { pos: p, symbol: 'K', rad: r0(e.R ?? 0), kvl: String(r0(e.L)), okl: 0, ovh: harRampe ? undefined : String(r0(hOf(e))), punkt: `${navn}: ${side === 'a' ? 'bue slut' : 'bue start'}`, plan: 'H' };
    };
    const ta = lavTavle(s0, 'a');
    const tb = lavTavle(s1, 'b');
    if (ta) egne.push(ta);
    if (tb) egne.push(tb);

    // Rampens endepunkter: fyld Ovh/Rpl på tavle i samme punkt, ellers R-tavle
    if (harRampe) {
      for (const rp of [rA, rB]) {
        const ved = egne.filter((x) => Math.abs(x.pos - rp) < EPS);
        if (ved.length) {
          for (const x of ved) {
            if (x.symbol === 'K' && t.okl <= 0) continue; // ingen OK: K-tavlen får ikke Ovh (BN2-93 afsn. 10.2)
            x.ovh = ovh;
            if (rpl !== undefined) x.rpl = rpl;
          }
        } else {
          egne.push({ pos: rp, symbol: 'R', ovh, rpl: r0(t.rpl > 0 ? t.rpl : t.okl), punkt: `${navn}: rampe ${rp === rA ? 'start' : 'slut'}`, plan: 'H' });
        }
      }
    }
    tavler.push(...egne);
  }

  tavler.sort((p, q) => p.pos - q.pos);
  return { tavler, elementStart: eStart, overgangStart: tStart, laengde: total, advarsler: adv };
}

/* ------------------------------ længdeprofil ------------------------------ */

export interface Knaek {
  /** Tangenternes skæringspunkt [m fra start] */
  pos: number;
  /** Hældning før [‰] */
  i1: number;
  /** Hældning efter [‰] */
  i2: number;
  /** Afrundingsradius [m] */
  Rv: number;
}

export function vertikaleTavler(knaek: Knaek[]): { tavler: Tavle[]; advarsler: string[] } {
  const tavler: Tavle[] = [];
  const adv: string[] = [];
  const sorted = [...knaek].sort((a, b) => a.pos - b.pos);
  sorted.forEach((k, idx) => {
    const di = k.i2 - k.i1;
    const symbol: Symbol = di < 0 ? '/\\' : '\\/';
    if (Math.abs(di) <= 1) {
      tavler.push({ pos: k.pos, symbol, rad: 99999, kvl: '0+0', punkt: `Knæk ${idx + 1}: direkte knæk ≤ 1 ‰`, plan: 'V' });
      return;
    }
    const T = (k.Rv * Math.abs(di)) / 2000;
    const Kvl = r0(2 * T);
    const half = r0(T);
    tavler.push(
      { pos: k.pos - T, symbol, rad: r0(k.Rv), kvl: String(Kvl), punkt: `Knæk ${idx + 1}: afrunding start`, plan: 'V' },
      { pos: k.pos, symbol, rad: r0(k.Rv), kvl: `${half}+${half}`, punkt: `Knæk ${idx + 1}: tangentskæring`, plan: 'V' },
      { pos: k.pos + T, symbol, rad: r0(k.Rv), kvl: String(Kvl), punkt: `Knæk ${idx + 1}: afrunding slut`, plan: 'V' },
    );
    const next = sorted[idx + 1];
    if (next) {
      const Tn = Math.abs(next.i2 - next.i1) <= 1 ? 0 : (next.Rv * Math.abs(next.i2 - next.i1)) / 2000;
      if (k.pos + T > next.pos - Tn + EPS) adv.push(`Afrunding ${idx + 1} og ${idx + 2} overlapper – øg afstanden eller mindsk R<sub>v</sub>.`);
      if (Math.abs(k.i2 - next.i1) > 1e-9) adv.push(`Hældning efter knæk ${idx + 1} (${k.i2} ‰) svarer ikke til hældning før knæk ${idx + 2} (${next.i1} ‰).`);
    }
  });
  return { tavler, advarsler: adv };
}

/** Formatér km: startkm [km] + pos [m] → "12,345" */
export function kmTekst(startKm: number, pos: number): string {
  const km = startKm + pos / 1000;
  return km.toLocaleString('da-DK', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

/** Opsætningstolerance i længderetningen (BN2-93 afsn. 10.4). */
export const TAVLE_TOLERANCE = 0.3;
