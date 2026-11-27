/**
 * LandXML 1.x: linjeføring (CoordGeom), længdeprofil (Profile/ProfAlign) og overhøjde (Cant).
 * Ud over geometrielementerne (til hastighedsprofilet) gemmes koordinater, retninger, PVI'er og
 * overhøjdestationer, så sporet kan opbygges i 3D (IFC-modellen).
 *
 * Konventioner: radius med fortegn (+ = højrekurve), overhøjde i mm, retning i radianer målt mod uret fra øst.
 * LandXML angiver punkter som «nordlig østlig [kote]»; enkelte programmer skriver «østlig nordlig» – det genkendes.
 */
import type { Element } from './projekt';
import { alle, foerste, parseXml, tal, tekst, type XNode } from './xml';

export interface GeoVandret {
  type: 'ret' | 'kurve' | 'overgang' | 'polylinje';
  /** Stationering ved start [m] */
  s0: number;
  /** Længde [m] */
  L: number;
  /** Radius ved start og slut med fortegn (+ = højre, 0 = uendelig) [m] */
  R0: number; R1: number;
  /** Startpunkt [østlig, nordlig] og startretning [rad] hvis kendt fra filen */
  P0?: [number, number];
  phi0?: number;
  /** Slutpunkt hvis angivet i filen (kontrol) */
  P1?: [number, number];
  /** Knudepunkter for IrregularLine */
  pkt?: [number, number][];
  /** Spiraltype hvis ikke klotoide */
  spiType?: string;
}

export interface GeoPVI {
  /** Stationering [m] og kote [m] */
  s: number; z: number;
  /** Afrundingskurve i PVI: vandret længde [m] (parabel) eller radius [m] (cirkel) */
  L?: number; R?: number;
  type?: 'parabel' | 'cirkel';
}

export interface GeoCant {
  s: number;
  /** Overhøjde [mm] */
  h: number;
  /** Kurvens yderside: +1 = højre, −1 = venstre (fra LandXML curvature) */
  side?: 1 | -1;
}

export interface GeoData {
  vandret: GeoVandret[];
  lodret?: GeoPVI[];
  cant?: GeoCant[];
  /** Koordinaterne stammer fra filen (ellers er linjeføringen opbygget lokalt fra (0, 0)) */
  koordinater: boolean;
  /** Punktorden i filen */
  orden: 'NE' | 'EN';
  /** Stationering ved linjeføringens start [m] */
  staStart: number;
  /** EPSG-kode fra <CoordinateSystem>, fx '25832' */
  epsg?: string;
  /** Beskrivelse af koordinatsystemet fra filen */
  crsNavn?: string;
  /** Cant rotationPoint fra filen */
  drejning?: string;
}

export interface LandXMLAlignment {
  navn: string;
  elementer: Element[];
  advarsler: string[];
  geo: GeoData;
}

const kappa = (R: number) => (R ? 1 / R : 0);

/** Skalafaktor fra filens længdeenhed til meter. */
function laengdeEnhed(rod: XNode): number {
  const u = foerste(rod, 'Units');
  const m = u && (foerste(u, 'Metric') ?? foerste(u, 'Imperial'));
  const lu = (m?.attrs.linearUnit ?? 'meter').toLowerCase();
  if (lu.startsWith('milli')) return 0.001;
  if (lu.startsWith('centi')) return 0.01;
  if (lu.startsWith('kilo')) return 1000;
  if (lu === 'ussurveyfoot') return 1200 / 3937;
  if (lu.includes('foot') || lu.includes('feet')) return 0.3048;
  return 1;
}

const tilTal = (s: string) => s.trim().split(/[\s,]+/).filter(Boolean).map(Number);

export function parseLandXML(xml: string): LandXMLAlignment[] {
  let rod: XNode;
  try {
    rod = parseXml(xml, ['Surfaces', 'Parcels', 'PipeNetworks', 'PlanFeatures', 'Monuments', 'GradeModel', 'Roadways']);
  } catch (e) {
    throw new Error(`Filen kan ikke læses som XML (${(e as Error).message})`);
  }
  const k = laengdeEnhed(rod);
  // Navngivne punkter (pntRef)
  const cg = new Map<string, number[]>();
  for (const p of alle(rod, 'CgPoint')) if (p.attrs.name) cg.set(p.attrs.name, tilTal(tekst(p)));
  const raa = (n: XNode | undefined): number[] | undefined => {
    if (!n) return undefined;
    const ref = n.attrs.pntRef;
    const v = ref && cg.has(ref) ? cg.get(ref)! : tilTal(tekst(n));
    return v.length >= 2 && v.every(Number.isFinite) ? v : undefined;
  };
  // Punktorden: LandXML = nordlig østlig. Genkend danske koordinater skrevet som østlig nordlig.
  const alleP: number[][] = [];
  for (const t of ['Start', 'End', 'Center', 'PI']) for (const n of alle(rod, t)) { const v = raa(n); if (v) alleP.push(v); }
  const en = alleP.length > 0 && alleP.filter((v) => Math.abs(v[0]) < 1.5e6 && Math.abs(v[1]) > 5.5e6).length > alleP.length / 2;
  const orden: 'NE' | 'EN' = en ? 'EN' : 'NE';
  const pkt = (n: XNode | undefined): [number, number] | undefined => {
    const v = raa(n);
    if (!v) return undefined;
    return en ? [v[0] * k, v[1] * k] : [v[1] * k, v[0] * k];
  };
  const cs = foerste(rod, 'CoordinateSystem');
  const epsg = cs?.attrs.epsgCode?.replace(/\D/g, '') || undefined;
  const crsNavn = cs ? (cs.attrs.horizontalCoordinateSystemName ?? cs.attrs.name ?? cs.attrs.desc) : undefined;

  return alle(rod, 'Alignment').map((al) => {
    const advarsler: string[] = [];
    if (en) advarsler.push('Punkterne står som «østlig nordlig» (LandXML foreskriver «nordlig østlig») – koordinaterne er byttet om.');
    const sta0 = (tal(al, 'staStart') || 0) * k;
    const geom = foerste(al, 'CoordGeom');
    const elementer: Element[] = [];
    const vandret: GeoVandret[] = [];
    let km = sta0;
    let medKoord = 0;
    for (const el of geom?.children ?? []) {
      const n = el.name;
      let len = tal(el, 'length') * k;
      const rot = (el.attrs.rot ?? '').toLowerCase();
      const sgn = rot === 'ccw' ? -1 : 1;
      const st = tal(el, 'staStart') * k;
      const k0 = Number.isFinite(st) ? st : km;
      const P0 = pkt(foerste(el, 'Start')), P1 = pkt(foerste(el, 'End'));
      if (P0) medKoord++;
      if (n === 'Line') {
        const L = Number.isFinite(len) ? len : P0 && P1 ? Math.hypot(P1[0] - P0[0], P1[1] - P0[1]) : 0;
        const phi0 = P0 && P1 && Math.hypot(P1[0] - P0[0], P1[1] - P0[1]) > 1e-6 ? Math.atan2(P1[1] - P0[1], P1[0] - P0[0]) : undefined;
        elementer.push({ type: 'ret', km0: k0, km1: k0 + L, L, R0: 0, R1: 0, h0: 0, h1: 0 });
        vandret.push({ type: 'ret', s0: k0, L, R0: 0, R1: 0, P0, P1, phi0 });
        km = k0 + L;
      } else if (n === 'Curve') {
        const C = pkt(foerste(el, 'Center')), PI = pkt(foerste(el, 'PI'));
        let R = tal(el, 'radius') * k;
        if (!(R > 0) && P0 && C) R = Math.hypot(P0[0] - C[0], P0[1] - C[1]);
        let phi0: number | undefined;
        if (P0 && C) {
          const rx = P0[0] - C[0], ry = P0[1] - C[1];
          phi0 = sgn === 1 ? Math.atan2(-rx, ry) : Math.atan2(rx, -ry);
        } else if (P0 && PI) phi0 = Math.atan2(PI[1] - P0[1], PI[0] - P0[0]);
        if (!Number.isFinite(len)) {
          const d = parseFloat(el.attrs.delta ?? 'NaN');
          if (Number.isFinite(d)) len = Math.abs((R * d * Math.PI) / 180);
          else if (P0 && P1 && C) {
            let a = Math.atan2(P1[1] - C[1], P1[0] - C[0]) - Math.atan2(P0[1] - C[1], P0[0] - C[0]);
            if (sgn === 1) a = -a;
            while (a < 0) a += 2 * Math.PI;
            len = R * a;
          } else len = 0;
        }
        elementer.push({ type: 'kurve', km0: k0, km1: k0 + len, L: len, R0: sgn * R, R1: sgn * R, h0: 0, h1: 0 });
        vandret.push({ type: 'kurve', s0: k0, L: len, R0: sgn * R, R1: sgn * R, P0, P1, phi0 });
        km = k0 + len;
      } else if (n === 'Spiral') {
        const rs = el.attrs.radiusStart ?? 'INF', re = el.attrs.radiusEnd ?? 'INF';
        const r = (s: string) => (/inf/i.test(s) || !(parseFloat(s) > 0) ? 0 : sgn * parseFloat(s) * k);
        const PI = pkt(foerste(el, 'PI'));
        const phi0 = P0 && PI ? Math.atan2(PI[1] - P0[1], PI[0] - P0[0]) : undefined;
        const L = Number.isFinite(len) ? len : 0;
        const e: Element = { type: 'overgang', km0: k0, km1: k0 + L, L, R0: r(rs), R1: r(re), h0: 0, h1: 0 };
        const dk = Math.abs(kappa(e.R1) - kappa(e.R0));
        if (dk > 0) e.A = Math.sqrt(L / dk);
        const spi = (el.attrs.spiType ?? 'clothoid').toLowerCase();
        if (spi !== 'clothoid') advarsler.push(`Overgangskurve af typen «${el.attrs.spiType}» ved km ${(k0 / 1000).toFixed(3)} er behandlet som klotoide.`);
        elementer.push(e);
        vandret.push({ type: 'overgang', s0: k0, L, R0: e.R0, R1: e.R1, P0, P1, phi0, spiType: spi !== 'clothoid' ? spi : undefined });
        km = k0 + L;
      } else if (n === 'IrregularLine') {
        const pl = foerste(el, 'PntList2D') ?? foerste(el, 'PntList3D');
        const v = pl ? tilTal(tekst(pl)) : [];
        const dim = pl?.name === 'PntList3D' ? 3 : 2;
        const pts: [number, number][] = [];
        for (let i = 0; i + 1 < v.length; i += dim) pts.push(en ? [v[i] * k, v[i + 1] * k] : [v[i + 1] * k, v[i] * k]);
        let L = 0;
        for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        if (Number.isFinite(len) && len > 0) L = len;
        elementer.push({ type: 'ret', km0: k0, km1: k0 + L, L, R0: 0, R1: 0, h0: 0, h1: 0, tekst: 'IrregularLine' });
        vandret.push({ type: 'polylinje', s0: k0, L, R0: 0, R1: 0, pkt: pts, P0: pts[0], P1: pts[pts.length - 1] });
        advarsler.push(`IrregularLine ved km ${(k0 / 1000).toFixed(3)} er indlæst som polylinje (${pts.length} punkter) og regnes som ret spor i hastighedsprofilet.`);
        km = k0 + L;
      } else if (n !== 'Chain') advarsler.push(`Ukendt element <${n}> sprunget over.`);
    }
    if (!medKoord) advarsler.push('Ingen koordinater i linjeføringen – sporet opbygges lokalt fra (0, 0) mod øst.');

    // Længdeprofil
    let lodret: GeoPVI[] | undefined;
    const pa = foerste(al, 'ProfAlign');
    if (pa) {
      const pv: GeoPVI[] = [];
      for (const c of pa.children) {
        const v = tilTal(tekst(c));
        if (v.length < 2 || !v.every(Number.isFinite)) continue;
        const p: GeoPVI = { s: v[0] * k, z: v[1] * k };
        if (c.name === 'ParaCurve') { p.L = tal(c, 'length') * k; p.type = 'parabel'; }
        else if (c.name === 'UnsymParaCurve') {
          p.L = ((tal(c, 'lengthIn') || 0) + (tal(c, 'lengthOut') || 0)) * k; p.type = 'parabel';
          advarsler.push(`Usymmetrisk afrundingskurve ved station ${p.s.toFixed(1)} er behandlet som symmetrisk parabel (L = ${p.L.toFixed(1)} m).`);
        } else if (c.name === 'CircCurve') {
          p.R = tal(c, 'radius') * k; p.type = 'cirkel';
          const L = tal(c, 'length') * k;
          if (!(p.R > 0) && L > 0) { p.L = L; p.type = 'parabel'; }
        } else if (c.name !== 'PVI') continue;
        pv.push(p);
      }
      if (pv.length >= 2) {
        pv.sort((a, b) => a.s - b.s);
        // Stationer angivet som afstand fra linjeføringens start?
        const laengde = km - sta0;
        if (sta0 > 1 && pv[0].s < sta0 - 1 && pv[pv.length - 1].s <= laengde + 1) {
          pv.forEach((p) => { p.s += sta0; });
          advarsler.push('Længdeprofilets stationer er regnet fra linjeføringens start og er lagt til staStart.');
        }
        lodret = pv;
      }
    }

    // Overhøjde fra <Cant>
    let cantData: GeoCant[] | undefined;
    const cant = foerste(al, 'Cant');
    let drejning: string | undefined;
    if (cant) {
      drejning = cant.attrs.rotationPoint;
      const cs2 = alle(cant, 'CantStation');
      const vals = cs2.map((c) => Math.abs(parseFloat(c.attrs.appliedCant ?? '0')));
      // appliedCant i filens enhed: meter (typisk ≤ 0,2) eller millimeter
      const tilMm = vals.some((x) => x > 1) ? 1 : 1000 * k;
      const pk: GeoCant[] = cs2.map((c) => {
        const cur = (c.attrs.curvature ?? '').toLowerCase();
        return {
          s: parseFloat(c.attrs.station ?? 'NaN') * k,
          h: Math.abs(parseFloat(c.attrs.appliedCant ?? 'NaN')) * tilMm,
          side: cur === 'cw' ? -1 : cur === 'ccw' ? 1 : undefined,
        } as GeoCant;
      }).filter((p) => Number.isFinite(p.s) && Number.isFinite(p.h)).sort((a, b) => a.s - b.s);
      const hAt = (s: number) => {
        if (!pk.length) return 0;
        if (s <= pk[0].s) return pk[0].h;
        for (let i = 1; i < pk.length; i++) if (s <= pk[i].s) return pk[i - 1].h + (pk[i].h - pk[i - 1].h) * (s - pk[i - 1].s) / (pk[i].s - pk[i - 1].s || 1);
        return pk[pk.length - 1].h;
      };
      for (const e of elementer) { e.h0 = Math.round(hAt(e.km0 + 1e-6)); e.h1 = Math.round(hAt(e.km1 - 1e-6)); if (e.type === 'ret') { e.h0 = e.h1 = 0; } }
      if (pk.length) cantData = pk;
      if (drejning && !/inside|inner/i.test(drejning)) advarsler.push(`Overhøjden er i filen angivet med drejning om «${drejning}»; SporKit drejer om den indvendige skinne (Banedanmark).`);
    } else advarsler.push('Ingen <Cant> i filen – overhøjde er sat til 0 og skal angives.');

    return {
      navn: al.attrs.name ?? 'Linjeføring',
      elementer,
      advarsler,
      geo: { vandret, lodret, cant: cantData, koordinater: medKoord > 0, orden, staStart: sta0, epsg, crsNavn, drejning },
    };
  });
}
