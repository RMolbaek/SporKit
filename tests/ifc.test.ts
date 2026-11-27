import { describe, expect, it } from 'vitest';
import { alle, foerste, parseXml, tekst } from '../src/core/xml';
import { parseLandXML } from '../src/core/landxml';
import { EKSEMPEL_LANDXML } from '../src/core/eksempel-landxml';
import { byggLinjefoering, byggLodret, cantVed, dVed, hPunkt, snitStationer, stationVed, vPunkt } from '../src/core/linjefoering';
import { BN16_STANDARD, byggModel, dhRvVed, eVed, triangulerPolygon, type ModelValg } from '../src/core/ifcmodel';
import { CRS, guidKilde, ifcGuid, real, skrivIfc, stepStr, tmTilGeo } from '../src/core/ifc';
import { crc32, zip } from '../src/core/zip';
import { EKSEMPEL_CSV, elementerFraTabel, gaetFelter, parseTabel } from '../src/core/projekt';

const al = parseLandXML(EKSEMPEL_LANDXML)[0];
const lf = byggLinjefoering(al.navn, al.elementer, al.geo);
const valg = (o: Partial<ModelValg> = {}): ModelValg => ({
  d0: 0, d1: lf.laengde, trin: 5, profil: 'D', tillaeg: 'ballast', bredde: true, hoejde: true, overhoejde: true, afrundE: true, afrundRv: true,
  skinner: true, ballast: true, sveller: false, daemning: false, bn16: BN16_STANDARD, maxObjekt: 250, origo: [575000, 6150000, 0], ...o,
});

describe('XML-parser', () => {
  it('navnerum, entiteter, CDATA, kommentarer og spring', () => {
    const r = parseXml(`<?xml version="1.0"?><!-- k --><lx:A xmlns:lx="u" b='x &amp; y'><lx:C>1 &lt; 2</lx:C><![CDATA[<z>]]><S><P>9</P></S><D/></lx:A>`, ['S']);
    const a = foerste(r, 'A')!;
    expect(a.attrs.b).toBe('x & y');
    expect(tekst(foerste(a, 'C')!)).toBe('1 < 2');
    expect(a.text).toBe('<z>');
    expect(alle(r, 'P')).toHaveLength(0); // <S> sprunget over
    expect(foerste(a, 'D')).toBeDefined();
  });
});

describe('LandXML med koordinater, længdeprofil og overhøjde', () => {
  it('elementer, punktorden, EPSG og fortegn', () => {
    expect(al.elementer).toHaveLength(11);
    expect(al.geo.koordinater).toBe(true);
    expect(al.geo.orden).toBe('NE');
    expect(al.geo.epsg).toBe('25832');
    expect(al.geo.lodret).toHaveLength(4);
    expect(al.geo.cant).toHaveLength(8);
    expect(al.elementer[2]).toMatchObject({ type: 'kurve', R0: -1000 }); // ccw = venstre = negativ
    expect(al.elementer[6]).toMatchObject({ type: 'kurve', R0: 600 });
    expect(al.elementer[2].h0).toBe(90); // appliedCant 0,090 m → 90 mm
  });
  it('østlig/nordlig-orden genkendes', () => {
    const x = EKSEMPEL_LANDXML.replace(/<(Start|End|Center|PI)>([\d.]+) ([\d.]+)</g, '<$1>$3 $2<');
    const b = parseLandXML(x)[0];
    expect(b.geo.orden).toBe('EN');
    const lb = byggLinjefoering(b.navn, b.elementer, b.geo);
    expect(lb.maksAfvigelse).toBeLessThan(0.001);
    expect(hPunkt(lb, 700).x).toBeCloseTo(hPunkt(lf, 700).x, 6);
  });
});

describe('3D-linjeføring', () => {
  it('integrationen rammer filens koordinater (< 1 mm) og den samlede vinkeldrejning', () => {
    expect(lf.laengde).toBeCloseTo(1560, 6);
    expect(lf.maksAfvigelse).toBeLessThan(0.001);
    const drej = 2 * (120 / 2000) + 0.3 - (2 * (80 / 1200) + 200 / 600) - 60 / 220;
    expect(hPunkt(lf, lf.laengde).phi).toBeCloseTo(Math.PI / 6 + drej, 6); // filens koordinater er rundet til 0,1 mm
    expect(stationVed(lf, 0)).toBe(5000);
    expect(dVed(lf, 5320)).toBeCloseTo(320, 9);
  });
  it('længdeprofil: parabel ved PVI (Rv = −8000) og cirkel (Rv = 5000)', () => {
    expect(vPunkt(lf, 0).z).toBeCloseTo(20, 9);
    expect(vPunkt(lf, 400).z).toBeCloseTo(24 - (0.015 * 120) / 8, 9); // pilhøjde (g1 − g0)·L/8
    expect(vPunkt(lf, 400).Rv).toBeCloseTo(-8000, 6);
    expect(vPunkt(lf, 900).Rv).toBeCloseTo(5000, 6);
    expect(vPunkt(lf, 1560).z).toBeCloseTo(23, 6);
    expect(vPunkt(lf, 300).g).toBeCloseTo(0.01, 9);
  });
  it('overhøjde og yderside', () => {
    expect(cantVed(lf, 450)).toEqual({ h: 90, side: 1 }); // venstrekurve: yderside højre
    expect(cantVed(lf, 260).h).toBeCloseTo(45, 9); // midt i rampen
    expect(cantVed(lf, 1070)).toEqual({ h: 120, side: -1 });
  });
  it('lodret overlap skaleres ned med advarsel', () => {
    const adv: string[] = [];
    const v = byggLodret([{ d: 0, z: 0 }, { d: 100, z: 1, L: 300, type: 'parabel' }, { d: 200, z: 0 }], adv);
    expect(v.find((s) => s.type === 'parabel')!.L).toBeCloseTo(200, 6);
    expect(adv.length).toBe(1);
  });
  it('snit tættere i små radier og altid i elementgrænser', () => {
    const st = snitStationer(lf, 0, lf.laengde, 5);
    for (const s of lf.h) expect(st.some((x) => Math.abs(x - s.d0) < 1e-6)).toBe(true);
    const iR220 = st.filter((x) => x > 1350 && x < 1410);
    expect(Math.max(...iR220.slice(1).map((x, i) => x - iR220[i]))).toBeLessThanOrEqual(Math.sqrt(8 * 0.005 * 220) + 1e-9);
  });
});

describe('BN1-166-1 langs sporet', () => {
  it('breddeforøgelse e: formel 12.2 og ramper (fig. 12-3) ved R = 220 m uden overgangskurve', () => {
    const e = 60000 / 220 - 225;
    expect(eVed(lf, 1380)).toBeCloseTo(e, 9);
    expect(eVed(lf, 1350 - 2)).toBeCloseTo(e, 9);
    expect(eVed(lf, 1350 - 7)).toBeCloseTo(e / 2, 9);
    expect(eVed(lf, 1350 - 12.5)).toBe(0);
    expect(eVed(lf, 1410 + 7)).toBeCloseTo(e / 2, 9);
  });
  it('e lineært over overgangskurven (fig. 12-6) og nedrunding ved R ≥ 300 m', () => {
    expect(eVed(lf, 450)).toBe(0);
    expect(eVed(lf, 450, false)).toBeCloseTo(3.75, 9);
    expect(eVed(lf, 260, false)).toBeCloseTo(3.75 / 2, 9);
  });
  it('ΔhRv = 50.000/Rv, lineært fra 25 m før tangentpunktet', () => {
    expect(dhRvVed(lf, 400)).toBeCloseTo(6.25, 9);
    expect(dhRvVed(lf, 340 - 12.5)).toBeCloseTo(3.125, 9);
    expect(dhRvVed(lf, 340 - 26)).toBe(0);
    expect(dhRvVed(lf, 900)).toBeCloseTo(10, 9);
  });
});

/** Signeret volumen og kanttælling for et trekantnet. */
function net(pts: number[], tri: number[]) {
  let V = 0;
  const kant = new Map<string, number>();
  for (let i = 0; i < tri.length; i += 3) {
    const [a, b, c] = [tri[i], tri[i + 1], tri[i + 2]];
    const A = pts.slice(3 * a, 3 * a + 3), B = pts.slice(3 * b, 3 * b + 3), C = pts.slice(3 * c, 3 * c + 3);
    V += (A[0] * (B[1] * C[2] - B[2] * C[1]) - A[1] * (B[0] * C[2] - B[2] * C[0]) + A[2] * (B[0] * C[1] - B[1] * C[0])) / 6;
    for (const [p, q] of [[a, b], [b, c], [c, a]]) { const k = `${p}-${q}`; kant.set(k, (kant.get(k) ?? 0) + 1); }
  }
  // lukket og orienteret: hver kant bruges præcis én gang i hver retning
  let aaben = 0;
  for (const [k, n] of kant) { const [p, q] = k.split('-'); if (n !== 1 || kant.get(`${q}-${p}`) !== 1) aaben++; }
  return { V, aaben };
}

describe('3D-model', () => {
  const m = byggModel(lf, valg({ sveller: true, daemning: true }));
  it('lukkede, udadvendte legemer', () => {
    for (const o of m.objekter.filter((x) => x.lukket)) {
      const r = net(o.pts, o.tri);
      expect(r.aaben, o.navn).toBe(0);
      expect(r.V, o.navn).toBeGreaterThan(0);
    }
  });
  it('rimelige mængder (skinner, sveller, fritrum)', () => {
    const vol = (d: string) => m.objekter.filter((o) => o.del === d).reduce((s, o) => s + net(o.pts, o.tri).V, 0);
    expect(vol('skinne')).toBeGreaterThan(2 * 1560 * 0.0075); // 60E2 ≈ 0,0077 m²
    expect(vol('skinne')).toBeLessThan(2 * 1560 * 0.0085);
    expect(vol('sveller')).toBeCloseTo((1560 / 0.6) * 2.5 * 0.206 * 0.26, -1);
    expect(vol('fritrum') / 1560).toBeGreaterThan(17);
  });
  it('fritrum vokser med e i R = 220 m', () => {
    const fr = m.objekter.filter((o) => o.del === 'fritrum');
    const bredde = (o: typeof fr[number]) => { let mn = Infinity, mx = -Infinity; for (let i = 0; i < o.pts.length; i += 3) { const d = Math.hypot(o.pts[i], o.pts[i + 1]); mn = Math.min(mn, d); mx = Math.max(mx, d); } return mx - mn; };
    expect(fr.length).toBeGreaterThan(5);
    expect(bredde(fr[0])).toBeGreaterThan(0);
    expect(m.snit.find((s) => Math.abs(s.R) > 200 && Math.abs(s.R) < 240)!.e).toBeCloseTo(60000 / 220 - 225, 6);
  });
  it('ear clipping med kollineære punkter', () => {
    const t = triangulerPolygon([[0, 0], [1, 0], [2, 0], [2, 1], [1, 2], [0, 1]]);
    expect(t).toHaveLength(4);
    expect(new Set(t.flat()).size).toBe(6); // også det kollineære punkt (1, 0) bruges
  });
});

describe('IFC-skrivning', () => {
  const m = byggModel(lf, valg());
  const meta = { projekt: 'Test æøå', filnavn: 't.ifc', epsg: '25832', seed: 'x' };
  const refOk = (t: string) => {
    const def = new Set([...t.matchAll(/^#(\d+)=/gm)].map((x) => x[1]));
    const brug = [...t.split('DATA;')[1].matchAll(/#(\d+)(?!\d|=)/g)].map((x) => x[1]);
    return brug.every((r) => def.has(r));
  };
  it('IFC4X3_ADD2: alignment, jernbane, georeference', () => {
    const t = skrivIfc(m, lf, 'IFC4X3_ADD2', meta).tekst;
    expect(t).toContain("FILE_SCHEMA(('IFC4X3_ADD2'));");
    for (const e of ['IFCALIGNMENT(', 'IFCALIGNMENTHORIZONTAL(', 'IFCALIGNMENTVERTICAL(', 'IFCALIGNMENTCANT(', 'IFCGRADIENTCURVE(', 'IFCSEGMENTEDREFERENCECURVE(',
      'IFCRAILWAY(', 'IFCRAIL(', 'IFCCOURSE(', 'IFCVIRTUALELEMENT(', 'IFCMAPCONVERSION(', 'IFCREFERENT(', 'IFCTRIANGULATEDFACESET(']) expect(t, e).toContain(e);
    expect(t).toContain('.CLEARANCE.');
    expect(t).toContain("'Test \\X2\\00E600F800E5\\X0\\'");
    expect(refOk(t)).toBe(true);
  });
  it('IFC4 og IFC2X3', () => {
    const t4 = skrivIfc(m, lf, 'IFC4', meta).tekst;
    expect(t4).toContain('IFCANNOTATION(');
    expect(t4).not.toContain('IFCALIGNMENT');
    expect(refOk(t4)).toBe(true);
    const t2 = skrivIfc(m, lf, 'IFC2X3', meta).tekst;
    expect(t2).toContain('IFCOWNERHISTORY(');
    expect(t2).toContain('IFCFACETEDBREP(');
    expect(t2).toContain("'ePSet_MapConversion'");
    expect(t2).not.toContain('IFCTRIANGULATEDFACESET');
    expect(refOk(t2)).toBe(true);
  });
  it('spordataliste uden koordinater: lokal model, vandret profil bærer overhøjden', () => {
    const tab = parseTabel(EKSEMPEL_CSV);
    const el = elementerFraTabel(tab, { felter: gaetFelter(tab.header), kmEnhed: 'auto', positiv: 'hoejre' }).elementer;
    const l2 = byggLinjefoering('CSV', el);
    expect(l2.koordinater).toBe(false);
    expect(l2.harCant).toBe(true);
    const t = skrivIfc(byggModel(l2, { ...valg(), d1: l2.laengde, origo: [0, 0, 0] }), l2, 'IFC4X3_ADD2', { ...meta, epsg: '' }).tekst;
    expect(t).not.toContain('IFCMAPCONVERSION');
    expect(t).toContain('IFCSEGMENTEDREFERENCECURVE(');
  });
  it('STEP-primitiver og GlobalId', () => {
    expect(real(1)).toBe('1.');
    expect(real(-0.5)).toBe('-0.5');
    expect(real(1e-9)).toBe('0.');
    expect(stepStr("a'b\\c")).toBe("'a''b\\\\c'");
    const g = guidKilde('s'), g2 = guidKilde('s');
    const a = g();
    expect(a).toMatch(/^[0-3][0-9A-Za-z_$]{21}$/);
    expect(g2()).toBe(a);
    expect(g()).not.toBe(a);
    expect(ifcGuid(new Uint8Array(16))).toBe('0000000000000000000000');
  });
  it('transversal Mercator: UTM32 → bredde/længde (rundtur mod fremadformel)', () => {
    // fremadformel (Snyder) for lat 55,5°, lon 10,2° i UTM32
    const a = 6378137, f = 1 / 298.257222101, e2 = f * (2 - f), ep2 = e2 / (1 - e2), k0 = 0.9996;
    const lat = (55.5 * Math.PI) / 180, lon = ((10.2 - 9) * Math.PI) / 180;
    const N = a / Math.sqrt(1 - e2 * Math.sin(lat) ** 2), T = Math.tan(lat) ** 2, C = ep2 * Math.cos(lat) ** 2, A = Math.cos(lat) * lon;
    const M = a * ((1 - e2 / 4 - (3 * e2 ** 2) / 64 - (5 * e2 ** 3) / 256) * lat - ((3 * e2) / 8 + (3 * e2 ** 2) / 32 + (45 * e2 ** 3) / 1024) * Math.sin(2 * lat)
      + ((15 * e2 ** 2) / 256 + (45 * e2 ** 3) / 1024) * Math.sin(4 * lat) - ((35 * e2 ** 3) / 3072) * Math.sin(6 * lat));
    const E = 500000 + k0 * N * (A + ((1 - T + C) * A ** 3) / 6 + ((5 - 18 * T + T * T + 72 * C - 58 * ep2) * A ** 5) / 120);
    const Nn = k0 * (M + N * Math.tan(lat) * ((A * A) / 2 + ((5 - T + 9 * C + 4 * C * C) * A ** 4) / 24 + ((61 - 58 * T + T * T + 600 * C - 330 * ep2) * A ** 6) / 720));
    const g = tmTilGeo(CRS['25832'], E, Nn);
    expect(g.lat).toBeCloseTo(55.5, 6);
    expect(g.lon).toBeCloseTo(10.2, 6);
  });
});

describe('ifcZIP', () => {
  it('gyldig ZIP med korrekt CRC og indhold', async () => {
    const data = new TextEncoder().encode('ISO-10303-21;\n'.repeat(200));
    const z = await zip([{ navn: 'a.ifc', data }]);
    const v = new DataView(z.buffer);
    expect(v.getUint32(0, true)).toBe(0x04034b50);
    expect(v.getUint32(14, true)).toBe(crc32(data));
    const metode = v.getUint16(8, true), cs = v.getUint32(18, true), nl = v.getUint16(26, true);
    const del = z.subarray(30 + nl, 30 + nl + cs);
    const ud = metode === 8
      ? new Uint8Array(await new Response(new Blob([del as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw' as CompressionFormat))).arrayBuffer())
      : del;
    expect(new TextDecoder().decode(ud)).toBe(new TextDecoder().decode(data));
    expect(v.getUint32(z.length - 22, true)).toBe(0x06054b50);
  });
});

import { tilSporplan } from '../src/core/fritrum';
import type { Element } from '../src/core/projekt';

describe('Tillæg målt på modellens geometri', () => {
  // Ret 200, R 200 (uden OK), R 280 (sammensat), OK 280→180, R 180 med h = 120 mm, OK ud, ret
  const el: Element[] = [];
  let km = 0;
  const add = (type: Element['type'], L: number, R0: number, R1: number, h0 = 0, h1 = 0) => { el.push({ type, km0: km, km1: km + L, L, R0, R1, h0, h1 }); km += L; };
  add('ret', 200, 0, 0); add('kurve', 80, 200, 200); add('kurve', 80, 280, 280);
  add('overgang', 60, 280, 180, 0, 120); add('kurve', 60, 180, 180, 120, 120); add('overgang', 60, 180, 0, 120, 0); add('ret', 200, 0, 0);
  const l2 = byggLinjefoering('test', el);
  l2.v = byggLodret([{ d: 0, z: 10 }, { d: 300, z: 13.6, R: 1000, type: 'cirkel' }, { d: 600, z: 11.2, L: 36, type: 'parabel' }, { d: 740, z: 12.6 }]);
  const E200 = 60000 / 200 - 225, E280 = 3750 / 280, E180 = 60000 / 180 - 225;
  it('e efter figur 12-3, 12-5, 12-7 og 12-6 – også i det fælles tangentpunkt', () => {
    expect(eVed(l2, 193)).toBeCloseTo(E200 / 2, 9);
    expect(eVed(l2, 280)).toBeCloseTo(E200, 9); // tangentpunkt R200/R280: største tillæg
    expect(eVed(l2, 282)).toBeCloseTo(E200, 9);
    expect(eVed(l2, 287)).toBeCloseTo((E200 + E280) / 2, 9);
    expect(eVed(l2, 390)).toBeCloseTo((E280 + E180) / 2, 9);
    expect(eVed(l2, 510)).toBeCloseTo(E180 / 2, 9);
  });
  it('fritrummet målt i sporplanet: halv bredde 2000 + e + 50 og top 4800 + ΔhRv + 100 – også med overhøjde', () => {
    const m = byggModel(l2, { ...valg(), d1: l2.laengde, origo: [0, 0, 0], trin: 2, skinner: false, ballast: false, ringe: true });
    let n = 0;
    m.snit.forEach((s, i) => {
      const ring = m.ringe![i];
      const pl = ring.map(([x, y, z]) => {
        const u = (x - s.x) * Math.sin(s.phi) - (y - s.y) * Math.cos(s.phi);
        return tilSporplan(u * 1000, (z - s.z) * 1000, s.h, s.side);
      });
      const mur = pl.filter(([, v]) => v > 600 && v < 3400).map(([u]) => Math.abs(u));
      expect(Math.max(...mur), `d=${s.d}`).toBeCloseTo(2050 + s.e, 3);
      expect(Math.max(...pl.map(([, v]) => v)), `d=${s.d}`).toBeCloseTo(4900 + s.dhRv, 3);
      if (s.h > 0) n++;
    });
    expect(n).toBeGreaterThan(30);
  });
  it('små afrundingskurver: ΔhRv = 50.000/Rv (Rv 1000, 2000 og 600 m) og bunden aldrig under SO', () => {
    expect(dhRvVed(l2, 300)).toBeCloseTo(50, 9);
    expect(dhRvVed(l2, 600)).toBeCloseTo(25, 9);
    const l3 = { ...l2, v: byggLodret([{ d: 0, z: 0 }, { d: 370, z: 3.7, R: 600, type: 'cirkel' }, { d: 740, z: 1.85 }]) };
    expect(dhRvVed(l3, 370)).toBeCloseTo(50000 / 600, 9);
    const m = byggModel(l3, { ...valg(), d0: 340, d1: 400, origo: [0, 0, 0], trin: 1, skinner: false, ballast: false, ringe: true, overhoejde: false });
    m.snit.forEach((sn, i) => {
      const w = m.ringe![i].map(([, , z]) => (z - sn.z) * 1000);
      expect(Math.min(...w), `d=${sn.d}`).toBeCloseTo(Math.max(0, 50 - sn.dhRv), 3);
      expect(Math.max(...w), `d=${sn.d}`).toBeCloseTo(4900 + sn.dhRv, 3);
    });
    expect(Math.max(...m.snit.map((x) => x.dhRv))).toBeCloseTo(83.333, 3);
  });
});

describe('BN1-166-1 fig. 12-2 – 12-7: overgange for kurvetillæg', () => {
  const el: Element[] = [];
  let km = 0;
  const add = (type: Element['type'], L: number, R0: number, R1: number) => { el.push({ type, km0: km, km1: km + L, L, R0, R1, h0: 0, h1: 0 }); km += L; };
  // ret, R270 uden OK, ret, OK→R200→OK, 8 m ret, modkurve R220 uden OK, ret, R300→R260→R240 sammensat, ret
  add('ret', 100, 0, 0); add('kurve', 60, -270, -270); add('ret', 100, 0, 0);
  add('overgang', 40, 0, 200); add('kurve', 50, 200, 200); add('overgang', 40, 200, 0); add('ret', 8, 0, 0);
  add('kurve', 50, -220, -220); add('ret', 50, 0, 0); add('kurve', 40, 300, 300); add('kurve', 40, 260, 260); add('kurve', 40, 240, 240); add('ret', 100, 0, 0);
  const l = byggLinjefoering('overgange', el);
  const E270 = 3750 / 270, E200 = 60000 / 200 - 225, E220 = 60000 / 220 - 225, E260 = 3750 / 260, E240 = 60000 / 240 - 225;
  it('12-2: ret → R > 250 m – fuldt tillæg i begyndelsespunktet (spring)', () => {
    expect(eVed(l, 99.9)).toBe(0);
    expect(eVed(l, 100)).toBeCloseTo(E270, 9);
    expect(eVed(l, 160)).toBeCloseTo(E270, 9);
    expect(eVed(l, 160.1)).toBe(0);
  });
  it('12-6: med overgangskurve – lineært fra OK-start til fuld værdi i hovedkurvens BP', () => {
    expect(eVed(l, 260)).toBe(0);
    expect(eVed(l, 280)).toBeCloseTo(E200 / 2, 9);
    expect(eVed(l, 300)).toBeCloseTo(E200, 9);
    expect(eVed(l, 370)).toBeCloseTo(E200 / 2, 9);
  });
  it('12-3: R ≤ 250 m uden OK efter kort ret – rampe fra 12 m før BP (også ind over forrige OK)', () => {
    const b = E200 * (390 - 386) / 40;
    expect(eVed(l, 386)).toBeCloseTo(b, 9);
    expect(eVed(l, 391)).toBeCloseTo(Math.max(E200 * (390 - 391) / 40, 0) + (E220 - 0) * (391 - 386) / 10, 9);
    expect(eVed(l, 396)).toBeCloseTo(E220, 9);
    expect(eVed(l, 455)).toBeCloseTo(E220 / 2, 9);
  });
  it('12-4 og 12-5: sammensatte kurver', () => {
    expect(eVed(l, 537.9)).toBe(0); // R300 rundet ned til 0
    expect(eVed(l, 538)).toBeCloseTo(E260, 9); // til stede i tangentpunktet
    expect(eVed(l, 571)).toBeCloseTo((E260 + E240) / 2, 9); // fra e1 12 m før til e2 2 m før TP
    expect(eVed(l, 576)).toBeCloseTo(E240, 9);
    expect(eVed(l, 625)).toBeCloseTo(E240 / 2, 9);
  });
});

import { skrivDxf } from '../src/core/dxf';
describe('DXF-eksport', () => {
  it('R12 med lag, polyface-mesh og globale koordinater', () => {
    const m = byggModel(lf, valg({ ringe: true }));
    const t = skrivDxf(m, lf);
    const linjer = t.split('\r\n');
    expect(linjer[linjer.length - 2]).toBe('EOF');
    expect(t).toContain('AC1009');
    for (const l of ['SPORKIT_FRITRUM', 'SPORKIT_SKINNE', 'SPORKIT_LINJEFOERING', 'SPORKIT_KM']) expect(t).toContain(l);
    expect((t.match(/\r\n0\r\nPOLYLINE\r\n/g) ?? []).length).toBe(m.objekter.length + 1 + m.snit.length);
    expect(t).toContain('\r\n10\r\n575000.0000\r\n20\r\n6150000.0000\r\n30\r\n20.0000\r\n');
    expect(/[^\x00-\x7f]/.test(t)).toBe(false);
  });
});

describe('Inderside og yderside i højre- og venstrekurver', () => {
  // ret – OK – højrekurve R 350, h 100 – OK – ret – OK – venstrekurve R 350, h 100 – OK – ret
  const el: Element[] = [];
  let km = 0;
  const add = (type: Element['type'], L: number, R0: number, R1: number, h0 = 0, h1 = 0) => { el.push({ type, km0: km, km1: km + L, L, R0, R1, h0, h1 }); km += L; };
  add('ret', 50, 0, 0); add('overgang', 60, 0, 350, 0, 100); add('kurve', 80, 350, 350, 100, 100); add('overgang', 60, 350, 0, 100, 0);
  add('ret', 50, 0, 0); add('overgang', 60, 0, -350, 0, 100); add('kurve', 80, -350, -350, 100, 100); add('overgang', 60, -350, 0, 100, 0); add('ret', 50, 0, 0);
  const l = byggLinjefoering('sider', el);
  const m = byggModel(l, { ...valg(), d1: l.laengde, origo: [0, 0, 0], trin: 5, ringe: true, maxObjekt: 1000,
    bn16: { ...BN16_STANDARD, projekt: 'fornyelse', V: 120, svelle: 'S99', ls60: true } });
  /** Punkter i snitplanet ved d som (u, w) [mm]: u + = højre i stationeringsretningen, w = over profilkoten. */
  const snitPkt = (navn: string, d: number) => {
    const s = m.snit.reduce((a, b) => (Math.abs(b.d - d) < Math.abs(a.d - d) ? b : a));
    const out: [number, number][] = [];
    for (const o of m.objekter.filter((x) => x.navn.startsWith(navn))) for (let i = 0; i < o.pts.length; i += 3) {
      const dx = o.pts[i] - s.x, dy = o.pts[i + 1] - s.y;
      if (Math.abs(dx * Math.cos(s.phi) + dy * Math.sin(s.phi)) > 1e-6) continue;
      out.push([(dx * Math.sin(s.phi) - dy * Math.cos(s.phi)) * 1000, (o.pts[i + 2] - s.z) * 1000]);
    }
    return { s, p: out };
  };
  for (const [navn, d, yder] of [['højrekurve', 150, -1], ['venstrekurve', 400, 1]] as const) {
    it(`${navn}: ydersiden er ${yder < 0 ? 'venstre' : 'højre'}, og den ydre skinne er hævet h`, () => {
      const { s } = snitPkt('Skinne', d);
      expect(s.side).toBe(yder);
      const topV = Math.max(...snitPkt('Skinne venstre', d).p.map(([, w]) => w));
      const topH = Math.max(...snitPkt('Skinne højre', d).p.map(([, w]) => w));
      const ydre = yder < 0 ? topV : topH, indre = yder < 0 ? topH : topV;
      // inderskinnen er drejepunkt og ligger i profilkoten; den ydre er hævet h (skinnemidter 1507 mm).
      // Højeste punkt er skinnehovedets hjørne: + 36·(1/40) for hældningen og + 36·sin θ for drejningen
      const th = Math.asin(100 / 1500), hj = 36 / 40 + 36 * Math.sin(th);
      expect(indre).toBeGreaterThan(0); expect(indre).toBeLessThan(hj + 0.1);
      expect(ydre).toBeCloseTo(100 * 1507 / 1500 + hj, 0);
    });
    it(`${navn}: fritrummet hælder ind mod kurvens centrum og er symmetrisk i sporplanet`, () => {
      const { s, p } = snitPkt('Fritrum', d);
      const th = Math.asin(s.h / 1500);
      // profilets toppunkt (spormidte, 4800 + 100 mm) ligger mod indersiden
      const plan = p.map(([u, w]) => tilSporplan(u, w, s.h, s.side));
      const i = plan.findIndex(([a, b]) => Math.abs(a) < 0.5 && b > 4800);
      expect(Math.sign(p[i][0])).toBe(-yder);
      expect(Math.abs(p[i][0])).toBeCloseTo(4900 * Math.sin(th) + 753.5 * (1 - Math.cos(th)), 0);
      // tilbage i sporplanet: lige bredt til begge sider (e og vedligeholdelsestillæg på både inder- og yderside)
      expect(Math.max(...plan.map(([a]) => a))).toBeCloseTo(-Math.min(...plan.map(([a]) => a)), 3);
      expect(Math.max(...plan.map(([a]) => a))).toBeCloseTo(2050 + s.e, 3);
    });
    it(`${navn}: Pb-tillæg (BN1-6 fodnote 4) og forhøjet skulder kun i ydersiden`, () => {
      const p = snitPkt('Underballast', d).p;
      const pbV = -Math.min(...p.map(([u]) => u)), pbH = Math.max(...p.map(([u]) => u));
      // kronekant: Pb 3,00 m; yderside + 0,30 m (h = 100 mm); målt ved råjordsplanum udenfor kronen → sammenlign forskellen
      expect(yder < 0 ? pbV - pbH : pbH - pbV).toBeCloseTo(300, 0);
      const b = snitPkt('Ballast', d).p;
      const top = (sgn: number) => Math.max(...b.filter(([u]) => sgn * u > 1200 && sgn * u < 1300).map(([, w]) => w));
      // skulder i ydersiden ligger 0,10 m over svelleoversiden – højere end indersidens
      expect(top(yder) - top(-yder)).toBeGreaterThan(100);
    });
  }
});

import { sporudvidelseVed } from '../src/core/ifcmodel';
describe('Sporudvidelse på skinnerne (Sporregler 2.12.2)', () => {
  const el: Element[] = [];
  let km = 0;
  const add = (type: Element['type'], L: number, R0: number, R1: number) => { el.push({ type, km0: km, km1: km + L, L, R0, R1, h0: 0, h1: 0 }); km += L; };
  add('ret', 50, 0, 0); add('overgang', 40, 0, 160); add('kurve', 40, 160, 160); add('overgang', 40, 160, 0); add('ret', 50, 0, 0); add('kurve', 40, -180, -180); add('ret', 50, 0, 0);
  const l = byggLinjefoering('udv', el);
  it('fuld i cirkelbuen, jævnt over OK, 2,5 mm pr. 5 sveller uden OK', () => {
    expect(sporudvidelseVed(l, 110)).toBeCloseTo(10, 9);   // R 160: +10 mm
    expect(sporudvidelseVed(l, 70)).toBeCloseTo(5, 9);     // midt i OK
    expect(sporudvidelseVed(l, 220)).toBeCloseTo(5, 9);    // R 180: +5 mm
    expect(sporudvidelseVed(l, 220 - 3)).toBeCloseTo(2.5, 9); // 3 m (5 sveller) før BP
    expect(sporudvidelseVed(l, 220 - 6.1)).toBe(0);
  });
  it('skinnernes indbyrdes afstand vokser med udvidelsen', () => {
    const m = byggModel(l, { ...valg(), d1: l.laengde, origo: [0, 0, 0], trin: 5, ballast: false, maxObjekt: 1000 });
    const afstand = (d: number) => {
      const s = m.snit.reduce((a, b) => (Math.abs(b.d - d) < Math.abs(a.d - d) ? b : a));
      const u = (navn: string) => {
        const us: number[] = [];
        for (const o of m.objekter.filter((x) => x.navn.startsWith(navn))) for (let i = 0; i < o.pts.length; i += 3) {
          const dx = o.pts[i] - s.x, dy = o.pts[i + 1] - s.y;
          if (Math.abs(dx * Math.cos(s.phi) + dy * Math.sin(s.phi)) < 1e-6) us.push((dx * Math.sin(s.phi) - dy * Math.cos(s.phi)) * 1000);
        }
        return us.reduce((a, b) => a + b, 0) / us.length;
      };
      return u('Skinne højre') - u('Skinne venstre');
    };
    expect(afstand(110) - afstand(25)).toBeCloseTo(10, 1);
  });
});
