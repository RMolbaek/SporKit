/**
 * DXF-eksport (AutoCAD R12 / AC1009 – åbent dokumenteret format, læses af AutoCAD, Civil 3D, BricsCAD,
 * MicroStation m.fl. og kan gemmes som DWG). Koordinaterne skrives globalt (nulpunktet lægges til igen).
 *
 * Lag: legemer som polyface-mesh (ét objekt pr. stykke), linjeføringen som 3D-polylinje, fritrumsprofilet
 * som lukkede 3D-polylinjer pr. tværsnit og km-tekster.
 */
import type { Del, Model } from './ifcmodel';
import { kmTxt } from './ifcmodel';
import { hPunkt, stationVed, vPunkt, type Linjefoering } from './linjefoering';

export const DXF_LAG: Record<Del | 'akse' | 'snit' | 'km', { navn: string; farve: number }> = {
  fritrum: { navn: 'SPORKIT_FRITRUM', farve: 5 },
  snit: { navn: 'SPORKIT_FRITRUM_SNIT', farve: 150 },
  skinne: { navn: 'SPORKIT_SKINNE', farve: 8 },
  ballast: { navn: 'SPORKIT_BALLAST', farve: 252 },
  underballast: { navn: 'SPORKIT_UNDERBALLAST', farve: 42 },
  daemning: { navn: 'SPORKIT_DAEMNING', farve: 34 },
  sveller: { navn: 'SPORKIT_SVELLER', farve: 9 },
  akse: { navn: 'SPORKIT_LINJEFOERING', farve: 1 },
  km: { navn: 'SPORKIT_KM', farve: 7 },
};

/** DXF R12 tillader kun ASCII – æøå omskrives. */
const ascii = (s: string) => s.replace(/æ/g, 'ae').replace(/ø/g, 'oe').replace(/å/g, 'aa').replace(/Æ/g, 'AE').replace(/Ø/g, 'OE').replace(/Å/g, 'AA')
  .replace(/[–—]/g, '-').replace(/[^\x20-\x7e]/g, '?');

export function skrivDxf(model: Model, lf: Linjefoering, opt: { snit?: boolean; kmTekst?: boolean } = {}): string {
  const [ox, oy, oz] = model.origo;
  const o: string[] = [];
  const g = (kode: number, v: string | number) => { o.push(String(kode), typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(4)) : v); };
  const xyz = (x: number, y: number, z: number, k = 0) => { g(10 + k, (x + ox).toFixed(4)); g(20 + k, (y + oy).toFixed(4)); g(30 + k, (z + oz).toFixed(4)); };

  // udstrækning
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (const ob of model.objekter) for (let i = 0; i < ob.pts.length; i += 3) {
    x0 = Math.min(x0, ob.pts[i]); x1 = Math.max(x1, ob.pts[i]); y0 = Math.min(y0, ob.pts[i + 1]); y1 = Math.max(y1, ob.pts[i + 1]); z0 = Math.min(z0, ob.pts[i + 2]); z1 = Math.max(z1, ob.pts[i + 2]);
  }
  if (!Number.isFinite(x0)) { x0 = y0 = z0 = x1 = y1 = z1 = 0; }

  g(999, 'SporKit - sporgeometri, fritrum (BN1-166-1) og tvaerprofil (BN1-6-7). Enhed: meter.');
  g(0, 'SECTION'); g(2, 'HEADER');
  g(9, '$ACADVER'); g(1, 'AC1009');
  g(9, '$INSBASE'); xyz(0, 0, 0);
  g(9, '$EXTMIN'); xyz(x0, y0, z0);
  g(9, '$EXTMAX'); xyz(x1, y1, z1);
  g(0, 'ENDSEC');

  g(0, 'SECTION'); g(2, 'TABLES');
  g(0, 'TABLE'); g(2, 'LTYPE'); g(70, 1);
  g(0, 'LTYPE'); g(2, 'CONTINUOUS'); g(70, 0); g(3, 'Solid line'); g(72, 65); g(73, 0); g(40, 0.0);
  g(0, 'ENDTAB');
  const lag = Object.values(DXF_LAG);
  g(0, 'TABLE'); g(2, 'LAYER'); g(70, lag.length + 1);
  g(0, 'LAYER'); g(2, '0'); g(70, 0); g(62, 7); g(6, 'CONTINUOUS');
  for (const l of lag) { g(0, 'LAYER'); g(2, l.navn); g(70, 0); g(62, l.farve); g(6, 'CONTINUOUS'); }
  g(0, 'ENDTAB');
  g(0, 'ENDSEC');

  g(0, 'SECTION'); g(2, 'ENTITIES');
  // Legemer: polyface-mesh (højst 32767 punkter pr. mesh i R12, ellers 3DFACE)
  for (const ob of model.objekter) {
    const L = DXF_LAG[ob.del].navn;
    const nv = ob.pts.length / 3, nf = ob.tri.length / 3;
    if (!nf) continue;
    if (nv <= 32767 && nf <= 32767) {
      g(0, 'POLYLINE'); g(8, L); g(66, 1); xyz(0 - ox, 0 - oy, 0 - oz); g(70, 64); g(71, nv); g(72, nf);
      for (let i = 0; i < ob.pts.length; i += 3) { g(0, 'VERTEX'); g(8, L); xyz(ob.pts[i], ob.pts[i + 1], ob.pts[i + 2]); g(70, 192); }
      for (let i = 0; i < ob.tri.length; i += 3) {
        g(0, 'VERTEX'); g(8, L); xyz(-ox, -oy, -oz); g(70, 128);
        g(71, ob.tri[i] + 1); g(72, ob.tri[i + 1] + 1); g(73, ob.tri[i + 2] + 1);
      }
      g(0, 'SEQEND'); g(8, L);
    } else {
      for (let i = 0; i < ob.tri.length; i += 3) {
        g(0, '3DFACE'); g(8, L);
        const p = (k: number) => [ob.pts[3 * k], ob.pts[3 * k + 1], ob.pts[3 * k + 2]] as const;
        const [a, b, c] = [p(ob.tri[i]), p(ob.tri[i + 1]), p(ob.tri[i + 2])];
        xyz(...a, 0); xyz(...b, 1); xyz(...c, 2); xyz(...c, 3);
      }
    }
  }
  // Linjeføring (spormidte i SO-kote) som 3D-polylinje
  const poly3 = (lagnavn: string, pts: [number, number, number][], lukket: boolean) => {
    g(0, 'POLYLINE'); g(8, lagnavn); g(66, 1); xyz(-ox, -oy, -oz); g(70, 8 | (lukket ? 1 : 0));
    for (const [x, y, z] of pts) { g(0, 'VERTEX'); g(8, lagnavn); xyz(x, y, z); g(70, 32); }
    g(0, 'SEQEND'); g(8, lagnavn);
  };
  poly3(DXF_LAG.akse.navn, model.akse, false);
  // Fritrumsprofil pr. tværsnit
  if (opt.snit !== false && model.ringe) model.ringe.forEach((r) => poly3(DXF_LAG.snit.navn, r, true));
  // Km-tekster for hver 100 m
  if (opt.kmTekst !== false) {
    const s0 = stationVed(lf, 0), s1 = stationVed(lf, lf.laengde);
    for (let s = Math.ceil(s0 / 100) * 100; s <= s1; s += 100) {
      const d = s - s0;
      if (d < 0 || d > lf.laengde) continue;
      const p = hPunkt(lf, d), z = vPunkt(lf, d).z;
      g(0, 'TEXT'); g(8, DXF_LAG.km.navn); xyz(p.x - ox + 3 * Math.sin(p.phi), p.y - oy - 3 * Math.cos(p.phi), z - oz);
      g(40, 0.8); g(1, ascii(`km ${kmTxt(s)}`)); g(50, (p.phi * 180) / Math.PI);
    }
  }
  g(0, 'ENDSEC');
  g(0, 'EOF');
  return o.join('\r\n') + '\r\n';
}
