import { describe, expect, it } from 'vitest';
import { BANEDANMARK as rs, BANEDANMARK, vurder } from '../src/core/rules';
import {
  cantConstant, equilibriumCant, cantDeficiency, cantExcess, minRadius, maxSpeed,
  transitionLengths, clothoid, cantWindow, roundTo, minRadiusMixed,
} from '../src/core/formulas';

describe('grundformler', () => {
  it('C ≈ 11,8', () => expect(cantConstant(rs)).toBeCloseTo(11.8, 1));
  it('h_eq for V=120, R=1000 ≈ 170 mm', () => expect(equilibriumCant(120, 1000, rs)).toBeCloseTo(169.9, 0));
  it('I og E', () => {
    expect(cantDeficiency(120, 1000, 100, rs)).toBeCloseTo(69.9, 0);
    expect(cantExcess(80, 1000, 100, rs)).toBeCloseTo(24.5, 0);
  });
  it('R_min og V_max er inverse', () => {
    const R = minRadius(160, 150, 100, rs);
    expect(maxSpeed(R, 150, 100, rs)).toBeCloseTo(160, 6);
  });
  it('vindue', () => {
    const w = cantWindow(160, 80, 1800, 100, 70, 150, rs);
    expect(w.muligt).toBe(true);
    expect(w.lav).toBeLessThan(w.hoej);
    // R=1200 ved 160 km/t: h_eq ≈ 252 mm → kræver h > 150 mm → umuligt
    expect(cantWindow(160, 80, 1200, 100, 70, 150, rs).muligt).toBe(false);
  });
  it('roundTo', () => {
    expect(roundTo(101, 5, 'op')).toBe(105);
    expect(roundTo(105, 5, 'op')).toBe(105);
    expect(roundTo(104, 5, 'ned')).toBe(100);
  });
});

describe('blandet trafik', () => {
  it('R_min giver netop et ikke-tomt overhøjdevindue', () => {
    const m = minRadiusMixed(200, 60, 150, 100, 70, rs);
    const w = cantWindow(200, 60, m.R * 1.0001, 100, 70, 150, rs);
    expect(w.muligt).toBe(true);
    expect(cantWindow(200, 60, m.R * 0.99, 100, 70, 150, rs).muligt).toBe(false);
  });
});

describe('overgangskurve', () => {
  it('kriterier skalerer med V', () => {
    const c = transitionLengths({ V: 160, R: 1500, dh: 100, dI: 67 }, rs);
    const rampe = c.find((x) => x.id === 'rampe')!;
    expect(rampe.normal).toBeCloseTo(160, 6); // 100 mm · 10 · 160 / 1000
    const dhdt = c.find((x) => x.id === 'dhdt')!;
    expect(dhdt.normal).toBeCloseTo((160 / 3.6) * 100 / 28, 6);
  });
  it('klotoide: p ≈ L²/24R', () => {
    const g = clothoid(1000, 100, 100);
    expect(g.A).toBeCloseTo(316.23, 2);
    expect(g.p).toBeCloseTo(100 ** 2 / (24 * 1000), 3);
    expect(g.Xm).toBeCloseTo(50, 1);
    expect(g.rampe).toBeCloseTo(1000, 6);
  });
});

describe('vurdering', () => {
  it('status', () => {
    expect(vurder(90, rs.manglendeOverhoejdeMax)).toBe('ok');
    expect(vurder(120, rs.manglendeOverhoejdeMax)).toBe('undtagelse');
    expect(vurder(140, rs.manglendeOverhoejdeMax)).toBe('overskredet');
  });
});

import {
  verticalCurve, minVerticalRadius, curveElements, versine, radiusFromVersine, overhang, rampTwist,
  clothoidParamCompound,
} from '../src/core/formulas';
import { iUndtagelse } from '../src/core/rules';

describe('avancerede formler', () => {
  it('lodret kurve', () => {
    const v = verticalCurve(5, -5, 10000, 160);
    expect(v.T).toBeCloseTo(50, 6);
    expect(v.f).toBeCloseTo(0.125, 6);
    expect(v.konveks).toBe(true);
    expect(minVerticalRadius(160, 0.22)).toBeCloseTo((160 / 3.6) ** 2 / 0.22, 6);
  });
  it('kurveelementer uden overgangskurve', () => {
    const k = curveElements(1000, 100, 0); // 90°
    expect(k.T).toBeCloseTo(1000, 6);
    expect(k.Lc).toBeCloseTo(Math.PI * 500, 6);
    expect(k.E).toBeCloseTo(1000 * (Math.SQRT2 - 1), 6);
  });
  it('kurveelementer med overgangskurve', () => {
    const k = curveElements(1000, 20, 100);
    expect(k.T).toBeGreaterThan(1000 * Math.tan((20 * Math.PI) / 400));
    expect(k.Ltot).toBeCloseTo(1000 * ((20 * Math.PI) / 200) + 100, 0);
  });
  it('pilhøjde', () => {
    expect(versine(1000, 20)).toBeCloseTo(50, 1);
    expect(radiusFromVersine(versine(800, 20), 20)).toBeCloseTo(800, 6);
  });
  it('udbøjning og vridning', () => {
    const o = overhang(250, 19, 26.4, 3.5, 150, BANEDANMARK);
    expect(o.indvendig).toBeCloseTo(180.5, 1);
    expect(o.haeldning).toBeCloseTo(350, 6);
    expect(rampTwist(150, 100, 3).overBase).toBeCloseTo(4.5, 6);
    expect(clothoidParamCompound(0, 1000, 100)).toBeCloseTo(Math.sqrt(100000), 6);
  });
  it('I undtagelse jf. Sporregler', () => {
    expect(iUndtagelse(120, { skinne: '60E2', saerligeTogsaet: false })).toBe(130);
    expect(iUndtagelse(160, { skinne: '60E2', saerligeTogsaet: false })).toBe(153);
    expect(iUndtagelse(160, { skinne: '60E2', saerligeTogsaet: true })).toBe(160);
    expect(iUndtagelse(160, { skinne: 'DSB45', saerligeTogsaet: false })).toBe(130);
  });
});

import { nominelPerronafstand, afstandTolerance, hoejdeTolerance, nominelHoejde, iTolerance, perronGlobal } from '../src/core/perron';

describe('BN1-49 spor og perron', () => {
  it('nominel perronafstand fra figur 8.2-1', () => {
    expect(nominelPerronafstand(550, 0, false).afstand).toBe(945);
    expect(nominelPerronafstand(550, 450, false).afstand).toBe(980);
    expect(nominelPerronafstand(260, 270, false).afstand).toBe(860);
    expect(nominelPerronafstand(920, 3000, false).afstand).toBe(960);
    expect(nominelPerronafstand(550, 210, false).afstand).toBe(1020 + 60);
    expect(nominelPerronafstand(550, 210, true).afstand).toBe(1020 + 60 + 50);
    expect(nominelPerronafstand(550, 180, false).afstand).toBeNull();
    expect(nominelPerronafstand(1300, 0, false).afstand).toBeNull();
  });
  it('tolerancer figur 9-1 og 11-1', () => {
    expect(afstandTolerance('26', 'drift', 260)).toEqual([50, 150]);
    expect(afstandTolerance('35', 'drift', 350)).toEqual([10, 150]);
    expect(afstandTolerance('55', 'drift', 550)).toEqual([10, 100]);
    expect(afstandTolerance('55', 'sporjustering', 550)).toEqual([0, 90]);
    expect(hoejdeTolerance('92', 'drift')).toEqual([null, 10]);
    expect(hoejdeTolerance('35', 'sporfornyelse')).toEqual([20, 0]);
    expect(hoejdeTolerance('92', 'nyanlaeg')).toEqual([30, 0]);
    expect(nominelHoejde('72', 'sporjustering')).toBe(760);
    expect(nominelHoejde('87', 'drift')).toBe(920);
    expect(iTolerance(955, 945, [0, 20])).toBe(true);
    expect(iTolerance(940, 945, [0, 20])).toBe(false);
  });
  it('perron uden overhøjde', () => {
    const g = perronGlobal(945, 550, 0, 'inder');
    expect(g.vandret).toBeCloseTo(945, 6);
    expect(g.lodret).toBeCloseTo(550, 6);
  });
  it('perron med overhøjde i kurvens inderside ligger længere ude og lavere', () => {
    const g = perronGlobal(960, 560, 60, 'inder');
    expect(g.vandret).toBeGreaterThan(960);
    expect(g.lodret).toBeLessThan(560);
    const y = perronGlobal(960, 560, 60, 'yder');
    expect(y.vandret).toBeLessThan(960);
    expect(y.lodret).toBeGreaterThan(560);
  });
});

import { bSik, bOph, bPer, genstandKlasse, afstribningKraeves, opholdsAreal } from '../src/core/sikkerhedszone';

describe('BN1-9-2 sikkerhedszoner', () => {
  it('bredde af sikkerhedszone (fig. 10.1-1)', () => {
    expect(bSik(120, 'fjern')).toBe(0.85);
    expect(bSik(180, 'fjern')).toBe(1.35);
    expect(bSik(220, 'fjern')).toBeNull();
    expect(bSik(120, 'sbane')).toBe(0.75);
  });
  it('opholdszone og bilag 1 (b_f = b_sik + b_oph)', () => {
    expect(bOph(160, 'g1')).toBe(1.6);
    expect(bOph(160, 'g2')).toBe(2.0);
    expect(bOph(160, 'ingen', true)).toBe(1.6);
    expect(bSik(180, 'fjern')! + bOph(180, 'g1')!).toBeCloseTo(2.95, 6);
    expect(bSik(100, 'sbane')! + bOph(100, 'g2')!).toBeCloseTo(2.75, 6);
  });
  it('perronbredde og klassifikation', () => {
    expect(bPer('side', 0.85, 2.0, true, 0.5)).toBeCloseTo(3.35, 6);
    expect(bPer('oe', 0.85, 2.0, false, 0)).toBeCloseTo(3.7, 6);
    expect(bPer('oe', 0.85, 2.0, true, 1)).toBeCloseTo(6.7, 6);
    expect(genstandKlasse(0.5)).toBe('g1');
    expect(genstandKlasse(4)).toBe('g2');
    expect(genstandKlasse(12)).toBe('g3');
    expect(afstribningKraeves(120, false, 'fjern')).toBe(false);
    expect(afstribningKraeves(180, false, 'fjern')).toBe(true);
    expect(opholdsAreal(6, 200, 1.7, 40)).toBeCloseTo(820, 6);
  });
});

import {
  tsiCantMax, tsiCantDeficiency, tsiAbruptChange, tsiTrackCentres, tsiGaugeIal, tsiConicity, tsiCantSmallRadius, tsiCurveChecks,
} from '../src/core/tsi';

describe('TSI INF (EU) 1299/2014', () => {
  it('tabel 7 og 8', () => {
    expect(tsiCantMax('blandet', 'ballast')).toBe(160);
    expect(tsiCantMax('blandet', 'fast')).toBe(170);
    expect(tsiCantMax('person', 'ballast')).toBe(180);
    expect(tsiCantDeficiency(250)).toBe(153);
    expect(tsiCantDeficiency(320)).toBe(100);
    expect(tsiCantSmallRadius(260)).toBeCloseTo(140, 6);
  });
  it('4.2.4.4, tabel 4, 10 og 12', () => {
    expect(tsiAbruptChange(50)).toBe(130);
    expect(tsiAbruptChange(160)).toBe(125);
    expect(tsiAbruptChange(220)).toBe(85);
    expect(tsiAbruptChange(250)).toBe(25);
    expect(tsiAbruptChange(40, 60, 70)).toBe(150);
    expect(tsiTrackCentres(160)).toBeNull();
    expect(tsiTrackCentres(180)).toBe(3.8);
    expect(tsiTrackCentres(320)).toBe(4.5);
    expect(tsiGaugeIal(100)).toEqual({ min: 1426, max: 1470 });
    expect(tsiGaugeIal(200)).toEqual({ min: 1428, max: 1463 });
    expect(tsiConicity(50)).toBeNull();
    expect(tsiConicity(250)).toBe(0.2);
  });
  it('samlet kurvekontrol', () => {
    expect(tsiCurveChecks({ R: 280, V: 100, h: 150, I: 80, trafik: 'blandet', spor: 'ballast', perron: false, nyStraekning: true })
      .every((x) => x.status === 'ok')).toBe(true); // (280 − 50)/1,5 = 153 mm ≥ 150 mm
    const c = tsiCurveChecks({ R: 250, V: 100, h: 150, I: 80, trafik: 'blandet', spor: 'ballast', perron: true, nyStraekning: true });
    const bad = c.filter((x) => x.status === 'overskredet').map((x) => x.label);
    expect(bad).toContain('Overhøjde ved perron');
    expect(bad).toContain('Overhøjde ved R < 305 m');
    expect(bad).toContain('Radius langs perron');
    expect(bad).not.toContain('Projekteret overhøjde');
  });
});

import { horisontaleTavler, vertikaleTavler, kmTekst } from '../src/core/tracetavle';

describe('BN2-93 tracétavler – bilag 1 og 2', () => {
  const pick = (t: { symbol: string; rad?: number; okl?: number; kvl?: string; ovh?: string; rpl?: number }) =>
    [t.symbol, t.rad ?? '', t.okl ?? '', t.kvl ?? '', t.ovh ?? '', t.rpl ?? ''].join('|');

  it('eksempel 1: ret – OK – R – OK – ret', () => {
    const r = horisontaleTavler(
      [{ type: 'ret', L: 50 }, { type: 'bue', R: 1200, h: 65, L: 200 }, { type: 'ret', L: 50 }],
      [{ okl: 65, rpl: 0, rstart: 0 }, { okl: 70, rpl: 0, rstart: 0 }],
    );
    expect(r.tavler.map(pick)).toEqual([
      '0|1200|65||0-65|', 'K|1200|65|200|0-65|', 'K|1200|70|200|65-0|', '0|1200|70||65-0|',
    ]);
    expect(r.tavler.map((t) => t.pos)).toEqual([50, 115, 315, 385]);
  });

  it('eksempel 2: ret – OK/rampe – R (rampe længere end OK)', () => {
    const r = horisontaleTavler(
      [{ type: 'ret', L: 0 }, { type: 'bue', R: 1200, h: 65, L: 200 }],
      [{ okl: 40, rpl: 65, rstart: 0 }],
    );
    expect(r.tavler.map(pick)).toEqual(['0|1200|40||0-65|65', 'K|1200|40|200||', 'R|||||0-65|65'.replace('|||||', '||||')]);
  });

  it('eksempel 3: ensvendt R – OK – R', () => {
    const r = horisontaleTavler(
      [{ type: 'bue', R: 1200, h: 80, L: 100 }, { type: 'bue', R: 1800, h: 55, L: 300 }],
      [{ okl: 25, rpl: 0, rstart: 0 }],
    );
    expect(r.tavler.map(pick)).toEqual(['K|1200|25|100|80-55|', 'K|1800|25|300|80-55|']);
  });

  it('eksempel 4b: rampen går ind i den ene kurve', () => {
    const r = horisontaleTavler(
      [{ type: 'bue', R: 1200, h: 85, L: 200 }, { type: 'bue', R: 1800, h: 55, L: 300 }],
      [{ okl: 20, rpl: 30, rstart: -10 }],
    );
    expect(r.tavler.map(pick)).toEqual(['R||||85-55|30', 'K|1200|20|200||', 'K|1800|20|300|85-55|30']);
  });

  it('eksempel 5: modvendte kurver', () => {
    const r = horisontaleTavler(
      [{ type: 'bue', R: 1500, h: 55, L: 100 }, { type: 'ret', L: 0 }, { type: 'bue', R: 1000, h: 80, L: 50 }],
      [{ okl: 70, rpl: 0, rstart: 0 }, { okl: 100, rpl: 0, rstart: 0 }],
    );
    expect(r.tavler.map(pick)).toEqual([
      'K|1500|70|100|55-0|', '0|1500|70||55-0|', '0|1000|100||0-80|', 'K|1000|100|50|0-80|',
    ]);
  });

  it('eksempel 6: R – rampe – R uden overgangskurve', () => {
    const r = horisontaleTavler(
      [{ type: 'bue', R: 1200, h: 80, L: 100 }, { type: 'bue', R: 1800, h: 55, L: 200 }],
      [{ okl: 0, rpl: 30, rstart: -15 }],
    );
    expect(r.tavler.map(pick)).toEqual(['R||||80-55|30', 'K|1200|0|100||', 'K|1800|0|200||', 'R||||80-55|30']);
  });

  it('eksempel 7–9: længdeprofil', () => {
    const v = vertikaleTavler([{ pos: 100, i1: 0.75, i2: -0.75, Rv: 20000 }]);
    expect(v.tavler.map((t) => `${t.symbol}|${t.rad}|${t.kvl}`)).toEqual(['/\\|20000|30', '/\\|20000|15+15', '/\\|20000|30']);
    const k = vertikaleTavler([{ pos: 100, i1: 0, i2: 0.8, Rv: 0 }]);
    expect(k.tavler.map((t) => `${t.symbol}|${t.rad}|${t.kvl}`)).toEqual(['\\/|99999|0+0']);
    expect(kmTekst(12, 345.4)).toBe('12,345');
  });
});

import { kvalitetsklasse, vridGraense, lavVridMax, rampeVridning, sporviddeKlasse, vridningKlasse, projekteretKonicitet, radiusFraDiagram } from '../src/core/bn138';

describe('BN1-38-6', () => {
  it('kvalitetsklasser og vridning (tabel 11.3.2-1, afsnit 17)', () => {
    expect(kvalitetsklasse(250)).toBe('A1');
    expect(kvalitetsklasse(160)).toBe('B');
    expect(kvalitetsklasse(40)).toBe('E');
    expect(vridGraense('B', 3)).toEqual({ fk0: 1.0, fk1: 1.5, fk3: 3.0, fk4: 4.0, max: [6.0, 7.0] });
    expect(vridGraense('A1', 9).max).toEqual([4.8, 4.8]);
    expect(lavVridMax(300, 110)).toBe(true);
    expect(lavVridMax(300, 90)).toBe(false);
    expect(lavVridMax(600, 150)).toBe(false);
    expect(rampeVridning(100, 40, 3)).toBeCloseTo(2.5, 6);
    expect(rampeVridning(100, 10, 15)).toBeCloseTo(100 / 15, 6);
    expect(vridningKlasse(5, 'B', 3, false).fejlklasse).toBe('4');
    expect(vridningKlasse(6.5, 'B', 3, true).fejlklasse).toBe('Max');
  });
  it('sporvidde, konicitet og diagramradius', () => {
    expect(sporviddeKlasse(1436, 'B').fejlklasse).toBe('inden for 0');
    expect(sporviddeKlasse(1428, 'B').fejlklasse).toBe('4');
    expect(sporviddeKlasse(1471, 'B').fejlklasse).toBe('Max/Min');
    expect(projekteretKonicitet(1435, 40)).toBeCloseTo(0.095, 6);
    expect(projekteretKonicitet(1437, 40)).toBeCloseTo(0.072, 6);
    expect(radiusFraDiagram(10)).toBe(1000);
  });
});

import { sporudvidelse, projekteretSporvidde } from '../src/core/rules';

describe('Sporudvidelse (Sporregler 2.12)', () => {
  it('tabelværdier', () => {
    expect(sporudvidelse(0)).toBe(0);
    expect(sporudvidelse(190)).toBe(0);
    expect(sporudvidelse(180)).toBe(5);
    expect(sporudvidelse(175)).toBe(5);
    expect(sporudvidelse(160)).toBe(10);
    expect(sporudvidelse(149)).toBe(15);
    expect(projekteretSporvidde(160, 1437)).toBe(1445);
    expect(projekteretSporvidde(500, 1437)).toBe(1437);
  });
  it('BN1-38 tolerancer regnes fra projekteret sporvidde (minus) og 1435 (plus fk 3/4/Max)', () => {
    // R = 160: projekteret 1445. 1440 er −5 mm: over fk 1-minus (−3), inden for fk 3-minus (−7)
    expect(sporviddeKlasse(1440, 'D', 1445).fejlklasse).toBe('1');
    expect(sporviddeKlasse(1437, 'D', 1445).fejlklasse).toBe('4');
    expect(sporviddeKlasse(1444, 'D', 1445).fejlklasse).toBe('inden for 0');
    expect(sporviddeKlasse(1466, 'D', 1445).fejlklasse).toBe('4');
  });
});

import { breddeforoegelse, breddeforoegelseVed, hoejdeaendring, omkringSkinnen, profilType } from '../src/core/fritrum';

describe('BN1-166-1 fritrum', () => {
  it('breddeforøgelse e (formel 12.1/12.2) er kontinuert ved R = 250', () => {
    expect(breddeforoegelse(250)).toBeCloseTo(15, 6);
    expect(breddeforoegelse(249.999)).toBeCloseTo(15, 2);
    expect(breddeforoegelse(150)).toBeCloseTo(175, 6);
    expect(breddeforoegelse(280)).toBeCloseTo(3750 / 280, 6);
    expect(breddeforoegelse(300)).toBe(0);
    expect(breddeforoegelse(140)).toBeNull();
  });
  it('forløb langs sporet (fig. 12-2, 12-3, 12-6)', () => {
    expect(breddeforoegelseVed(-7, 200, 0)).toBeCloseTo(((60000 / 200 - 225) * 5) / 10, 6);
    expect(breddeforoegelseVed(-2, 200, 0)).toBeCloseTo(75, 6);
    expect(breddeforoegelseVed(-1, 280, 0)).toBe(0);
    expect(breddeforoegelseVed(-20, 200, 40)).toBeCloseTo(37.5, 6);
  });
  it('højdeændring, rummet om skinnen og profiltype', () => {
    expect(hoejdeaendring(5000)).toBe(10);
    expect(hoejdeaendring(12000)).toBe(0);
    expect(hoejdeaendring(400)).toBeNull();
    expect(omkringSkinnen(160).nOevrig).toBe(80);
    expect(profilType('P1')).toBe('D-GC');
    expect(profilType('P3')).toBe('D');
    expect(profilType('S')).toBe('SD');
  });
});

import { krav, forhoejetSkulder, geometri, areal, SVELLE_DATA } from '../src/core/bn16';

describe('BN1-6-7 tværprofil', () => {
  const base = { sidespor: false, A: 22.5, svelle: 'S99' as const, L: 2500, ls60: true, R: 0, h: 0 };
  it('krav fra figur 15.1-3, 12.1-4 og 10.2.3-2', () => {
    const n = krav({ ...base, projekt: 'nyanlaeg', V: 180 });
    expect([n.Bsk, n.Bt, n.Ut, n.Pb]).toEqual([0.55, 0.35, 0.40, 3.80]);
    expect(krav({ ...base, projekt: 'nyanlaeg', V: 100 }).Pb).toBe(3.30);
    const f = krav({ ...base, projekt: 'fornyelse', V: 140, R: 600, h: 100, A: 25 });
    expect(f.Ut).toBeCloseTo(0.27, 6);
    expect(f.PbYderTillaeg).toBe(0.30);
    expect(krav({ ...base, projekt: 'bn1', V: 180, svelle: 'toblok', L: 2300 }).Bsk).toBe(0.40);
    expect(krav({ ...base, projekt: 'bn1', V: 180, svelle: 'toblok', L: 2300 }).Ut).toBeCloseTo(0.35, 6);
    expect(forhoejetSkulder({ ...base, V: 120, R: 380 })).toBe(true);
    expect(forhoejetSkulder({ ...base, V: 120, R: 420 })).toBe(false);
    expect(forhoejetSkulder({ ...base, svelle: 'S16', V: 120, R: 380 })).toBe(false);
  });
  it('geometri: Bt holdes som minimum og ballasten ligger på planum', () => {
    const p = { Bsk: 0.4, a: 1.5, Bt: 0.3, Ut: 0.25, Pb: 3.8, Xp: 40, Xrp: 40, hSkulder: 0, as: 1.5, daemning: 1, fs: 4.5 };
    const g = geometri([{ h: 0, yder: 1 }], p, SVELLE_DATA.S99);
    expect(g.spor[0].btMin).toBeCloseTo(0.3, 6);
    expect(g.toeR.x).toBeGreaterThan(1.25 + 0.4);
    expect(g.toeR.x).toBeLessThan(g.edgeR.x);
    const g2 = geometri([{ h: 100, yder: 1 }, { h: 100, yder: 1 }], p, SVELLE_DATA.S99);
    expect(Math.min(...g2.spor.map((t) => t.btMin))).toBeCloseTo(0.3, 6);
    expect(areal(g2.ballast)).toBeGreaterThan(0);
  });
});

import { underfoering, baerelag, ev2Krav } from '../src/core/overgangszone';

describe('BN1-6-7 overgangszoner', () => {
  it('underføringer', () => {
    expect(underfoering({ projekt: 'nyanlaeg', V: 100, hyppige: false, geonet: false, saetningsplade: 0, sidespor: false }).type).toBe('trekant');
    expect(underfoering({ projekt: 'nyanlaeg', V: 140, hyppige: false, geonet: false, saetningsplade: 0, sidespor: false }).Loz).toBe(14);
    expect(underfoering({ projekt: 'nyanlaeg', V: 180, hyppige: false, geonet: false, saetningsplade: 0, sidespor: false }).Loz).toBe(17);
    const hs = underfoering({ projekt: 'nyanlaeg', V: 250, hyppige: false, geonet: false, saetningsplade: 0, sidespor: false });
    expect([hs.Loz, hs.hydrauliskBundet]).toEqual([20, 5]);
    expect(underfoering({ projekt: 'fornyelse', V: 160, hyppige: true, geonet: true, saetningsplade: 0, sidespor: false }).hoejde).toBe(0.35);
    expect(underfoering({ projekt: 'fornyelse', V: 160, hyppige: true, geonet: false, saetningsplade: 12, sidespor: false }).type).toBe('ingen');
    expect(ev2Krav(180)).toBe(115);
  });
  it('nyt/eksisterende bærelag', () => {
    const b = baerelag({ dybde: 0.3, laengdeFornyelse: 200, sidespor: false, projekt: 'fornyelse' });
    expect([b.kraeves, b.trin, b.Ltrin]).toEqual([true, 2, 6]);
    expect(b.haeldningJaevn).toBeCloseTo(15, 6);
    expect(baerelag({ dybde: 0.3, laengdeFornyelse: 8, sidespor: false, projekt: 'fornyelse' }).kraeves).toBe(false);
    expect(baerelag({ dybde: 0.3, laengdeFornyelse: 200, sidespor: true, projekt: 'fornyelse' }).kraeves).toBe(false);
  });
});

import { kryds, krydsDybde, gasAfstande, langs } from '../src/core/bn113';

describe('BN1-13-4 ledningsanlæg', () => {
  const base = { type: 'kabel' as const, metode: 'styret' as const, D: 0.16, reamer: 0.25, tryk: 0, dybde: 3, vinkel: 0, sporskifte: 50, antal: 1, afstand: 0, groeft: 0, overcut: 10, eksisterende: true, jaevnstroem: false, metal: false, svelleUnderside: 0.388 };
  it('dybdekrav pr. metode', () => {
    expect(kryds(base).dybdeKrav).toBeCloseTo(2.75, 6); // 7·0,25 + 1
    expect(kryds({ ...base, metode: 'pilot', D: 0.1 }).dybdeKrav).toBeCloseTo(2.0, 6);
    expect(kryds({ ...base, metode: 'presning', D: 0.8 }).dybdeKrav).toBeCloseTo(2.0, 6);
    expect(kryds({ ...base, metode: 'presning', D: 0.3, type: 'gas', tryk: 6 }).dybdeKrav).toBeCloseTo(2.4, 6);
    expect(krydsDybde({ ...base, metode: 'aaben', groeft: 1.5 }).map((g) => g.v)).toContain(2.0);
  });
  it('kontroller', () => {
    const r = kryds({ ...base, vinkel: 20, sporskifte: 8, metode: 'styret', D: 0.45 });
    const bad = r.checks.filter((c) => c.status === 'overskredet').map((c) => c.label);
    expect(bad).toEqual(expect.arrayContaining(['Krydsningsvinkel (afvigelse fra vinkelret)', 'Afstand til ende af sporskifte/sporskæring', 'Rørdiameter ved styret boring']));
    expect(kryds({ ...base, metode: 'presning', D: 1.2, dybde: 2.5 }).skinneafstivning.kraeves).toBe(true);
    expect(kryds({ ...base, dybde: 2, D: 0.2 }).skinneafstivning.laengde).toBeCloseTo(0.2 + 3 * (2.1 - 0.388), 6);
    expect(gasAfstande(6, 0.3).roerende).toBe(15);
    expect(gasAfstande(3, 0.3).minAfstandFormel).toBeCloseTo(0.675, 6);
  });
  it('langsgående', () => {
    const l = langs({ a: 3, dybdeSO: 1.0, dybdeTerraen: 0.6, station: false, mellemSpor: false, rende: false, aSkinne: 0, hoejde: 0, Pb: 3.8, V: 160, broend: 2.4, ekstern: false });
    expect(l.checks.find((c) => c.label.startsWith('Dybde'))!.status).toBe('overskredet');
    expect(l.checks.find((c) => c.label.startsWith('Brønd'))!.status).toBe('undtagelse');
    const r = langs({ a: 4, dybdeSO: 0, dybdeTerraen: 0, station: false, mellemSpor: false, rende: true, aSkinne: 3.0, hoejde: 0.25, Pb: 3.8, V: 160, broend: 0, ekstern: false });
    expect(r.checks.filter((c) => c.status === 'overskredet').length).toBe(2);
  });
});

import { PROFILER, profilMedTillaeg, fuldtProfil, iPolygon, tilSporplan } from '../src/core/fritrum';

describe('BN1-166-1 profiler', () => {
  it('profil D og tillæg', () => {
    const p = fuldtProfil(PROFILER.D);
    expect(iPolygon([0, 2000], p)).toBe(true);
    expect(iPolygon([1990, 2000], p)).toBe(true);
    expect(iPolygon([2010, 2000], p)).toBe(false);
    expect(iPolygon([1900, 3400], p)).toBe(false);
    const t = fuldtProfil(profilMedTillaeg('D', { e: 48, dhRv: 0, vandret: 50, lodret: 100 }));
    expect(iPolygon([2090, 2000], t)).toBe(true);
    expect(iPolygon([0, 4890], t)).toBe(true);
  });
  it('sporplan uden og med overhøjde', () => {
    expect(tilSporplan(1000, 500, 0)).toEqual([1000, 500]);
    const th = Math.asin(160 / 1500);
    const [u, v] = tilSporplan(-753.5 + 1507 * Math.cos(th), 1507 * Math.sin(th), 160, 1); // ydre skinnes top løftet 160 mm
    expect(u).toBeCloseTo(753.5, 0);
    expect(v).toBeCloseTo(0, 0);
  });
});

import { parsePunkter, iSporplan, afstandTilKant, vurder as vurderPunkt, EKSEMPEL } from '../src/core/fritrumskontrol';

describe('Fritrumskontrol af opmålingspunkter', () => {
  it('indlæsning (tab/semikolon, decimalkomma, enhed m)', () => {
    const r = parsePunkter(EKSEMPEL);
    expect(r.punkter.length).toBe(6);
    expect(r.fejl).toEqual([]);
    const s = parsePunkter('A;1,2;0;2,5;1,1;test;0;0', 'm');
    expect(s.punkter[0].x).toBe(2500);
    expect(s.punkter[0].z).toBeCloseTo(1100, 6);
    expect(parsePunkter('A;1;x;2;3').fejl.length).toBe(0); // første linje = overskrift
    expect(parsePunkter('h\nA;1;x;2;3').fejl.length).toBe(1);
  });
  it('sporplan drejer om spormidte', () => {
    expect(iSporplan(1000, 0, 0)).toEqual([1000, 0]);
    const [u, v] = iSporplan(750, 0, 150); // højre skinne løftet
    expect(v).toBeLessThan(0);
    expect(u).toBeLessThan(750);
  });
  it('vurdering og margin', () => {
    const fri = vurderPunkt({ id: 'a', km: '', h: 0, x: 3150, z: 1200, beskrivelse: '', R: 0, Rv: 0, linje: 1 }, 'D', { vandret: 50, lodret: 100 });
    expect(fri.konflikt).toBe(false);
    expect(fri.margin).toBeCloseTo(3150 - 2050, 0);
    const k = vurderPunkt({ id: 'b', km: '', h: 0, x: 2030, z: 1200, beskrivelse: '', R: 0, Rv: 0, linje: 1 }, 'D', { vandret: 50, lodret: 100 });
    expect(k.konflikt).toBe(true);
    expect(k.konfliktProfil).toBe(false);
    expect(k.margin).toBeCloseTo(-20, 0);
    expect(afstandTilKant([0, 0], [[-1, -1], [1, -1], [1, 1], [-1, 1]])).toBeCloseTo(1, 6);
  });
});

import { REFERENCES, harAabenKilde } from '../src/core/references';
import { BANEDANMARK as BDK, type Limit } from '../src/core/rules';

describe('Åbenhed: kilder skal være åbne og tilgængelige', () => {
  it('alle frit tilgængelige kilder har et link', () => {
    for (const r of REFERENCES) if (r.adgang === 'aaben') expect(r.url, r.id).toMatch(/^https:\/\//);
  });
  it('alle grænseværdier har en kildeangivelse, og antagne værdier er markeret', () => {
    const limits = Object.values(BDK).filter((v): v is Limit => typeof v === 'object' && v !== null && 'kilde' in v);
    for (const l of limits) {
      expect(l.kilde.length, l.label).toBeGreaterThan(0);
      if (!harAabenKilde(l.kilde)) expect(l.status, l.label).toBe('antaget');
    }
  });
});

import { pbTillaeg } from '../src/core/bn16';

describe('BN1-6-7 fodnote 4: Pb i kurvens yderside', () => {
  const base = { sidespor: false, A: 22.5, svelle: 'S99' as const, L: 2500, ls60: false, R: 0 };
  const p = { Bsk: 0.4, a: 1.5, Bt: 0.3, Ut: 0.25, Pb: 3.0, PbYder: 0.30, Xp: 40, Xrp: 40, hSkulder: 0, as: 1.5, daemning: 1, fs: 4.5 };
  it('tillæg efter overhøjde', () => {
    expect([0, 4, 5, 80, 85, 160].map(pbTillaeg)).toEqual([0, 0, 0.15, 0.15, 0.30, 0.30]);
    expect(krav({ ...base, projekt: 'fornyelse', V: 120, h: 60 }).PbYderTillaeg).toBe(0.15);
    expect(krav({ ...base, projekt: 'bn1', V: 180, h: 120 }).PbYderTillaeg).toBe(0.30);
    expect(krav({ ...base, projekt: 'bn1', V: 220, h: 120 }).PbYderTillaeg).toBe(0);
    expect(krav({ ...base, projekt: 'nyanlaeg', V: 120, h: 120 }).PbYderTillaeg).toBe(0);
  });
  it('tillægget lægges kun i ydersiden, og overhøjden flytter ballastfoden udad', () => {
    const g = geometri([{ h: 120, yder: 1 }], p, SVELLE_DATA.S99);
    expect(g.PbR).toBeCloseTo(3.30, 9);
    expect(g.PbL).toBeCloseTo(3.00, 9);
    const gv = geometri([{ h: 120, yder: -1 }], p, SVELLE_DATA.S99);
    expect(gv.PbL).toBeCloseTo(3.30, 9);
    expect(gv.PbR).toBeCloseTo(3.00, 9);
    const g0 = geometri([{ h: 0, yder: 1 }], p, SVELLE_DATA.S99);
    expect(g0.PbR).toBeCloseTo(3.00, 9);
    expect(g.toeR.x).toBeGreaterThan(g0.toeR.x);
  });
});

import { faldTilladt } from '../src/core/bn16';

describe('BN1-6-7 ensidigt fald på planum (enkeltspor)', () => {
  const p = { Bsk: 0.4, a: 1.5, Bt: 0.3, Ut: 0.25, Pb: 3.8, Xp: 40, Xrp: 40, hSkulder: 0, as: 1.5, daemning: 1, fs: 4.5 };
  it('planum hælder ensidigt, og Bt holdes under den høje streng', () => {
    const g = geometri([{ h: 0, yder: 1 }], { ...p, fald: 'hoejre' }, SVELLE_DATA.S99);
    expect(g.planum(1) - g.planum(0)).toBeCloseTo(0.04, 9);
    expect(g.planum(-1) - g.planum(0)).toBeCloseTo(-0.04, 9);
    expect(g.edgeR.y - g.edgeL.y).toBeCloseTo(0.04 * 7.6, 9);
    expect(g.spor[0].btVenstre).toBeCloseTo(0.3, 6);
    expect(g.spor[0].btHoejre).toBeGreaterThan(0.3);
    const gv = geometri([{ h: 0, yder: 1 }], { ...p, fald: 'venstre' }, SVELLE_DATA.S99);
    expect(gv.spor[0].btHoejre).toBeCloseTo(0.3, 6);
    // dobbeltspor ignorerer ensidigt fald
    const g2 = geometri([{ h: 0, yder: 1 }, { h: 0, yder: 1 }], { ...p, fald: 'hoejre' }, SVELLE_DATA.S99);
    expect(g2.fald).toBe('tag');
  });
  it('knæk under spormidten kun på BN1-niveau', () => {
    expect(faldTilladt('bn1', 'tag')).toBe(true);
    expect(faldTilladt('fornyelse', 'tag')).toBe(false);
    expect(faldTilladt('nyanlaeg', 'tag')).toBe(false);
    expect(faldTilladt('nyanlaeg', 'hoejre')).toBe(true);
  });
});

import { aMinOverjord, rendeKontrol, rendeGeometri, SKINNE_YDERKANT } from '../src/core/kabelrende';

describe('BN1-13-4 kabelrende i tværprofil', () => {
  const r = { a: 4.05, B: 0.4, H: 0.3, t: 0.1, bag: 0.3, placering: 'overjord' as const };
  it('mindste afstand over jord', () => {
    expect(aMinOverjord(160, 3.8)).toBeCloseTo(SKINNE_YDERKANT + 3.25, 9);
    expect(aMinOverjord(100, 3.8)).toBe(3.8);
    expect(aMinOverjord(100, 3.0)).toBeCloseTo(SKINNE_YDERKANT + 2.75, 9);
  });
  it('kontrol over jord og nedgravet', () => {
    const ok = rendeKontrol({ r, Pb: 3.8, V: 160, station: false, ballastfod: 3.0, dybdeSO: 0.5, sideTekst: 'h' });
    expect(ok.every((c) => c.status === 'ok')).toBe(true);
    const tæt = rendeKontrol({ r: { ...r, a: 3.9, t: 0.25 }, Pb: 3.8, V: 160, station: false, ballastfod: 3.0, dybdeSO: 0.5, sideTekst: 'h' });
    expect(tæt.filter((c) => c.status === 'overskredet').length).toBe(2);
    const ned = rendeKontrol({ r: { ...r, a: 2.6, t: -0.5, placering: 'nedgravet' }, Pb: 3.8, V: 160, station: false, ballastfod: 3.0, dybdeSO: 1.2, sideTekst: 'h' });
    expect(ned.find((c) => c.label.includes('laveste SO'))!.status).toBe('overskredet');
    const ned2 = rendeKontrol({ r: { ...r, a: 4.0, t: -0.6, placering: 'nedgravet' }, Pb: 3.8, V: 160, station: true, ballastfod: 3.0, dybdeSO: 1.2, sideTekst: 'h' });
    expect(ned2.find((c) => c.label.includes('dækning'))!.status).toBe('overskredet');
  });
  it('geometri og bredere planumskrone', () => {
    const p = { Bsk: 0.4, a: 1.5, Bt: 0.3, Ut: 0.25, Pb: 3.8, Xp: 40, Xrp: 40, hSkulder: 0, as: 1.5, daemning: 1, fs: 4.5, kroneMin: { R: 4.75 } };
    const g = geometri([{ h: 0, yder: 1 }], p, SVELLE_DATA.S99);
    expect(g.crestR.x).toBeCloseTo(4.75, 9);
    expect(g.edgeR.x).toBeCloseTo(3.8, 9);
    expect(g.crestL.x).toBeCloseTo(-3.8, 9);
    const rg = rendeGeometri(r, 1, 0, g.planum);
    expect(rg.x1).toBeCloseTo(4.05, 9);
    expect(rg.top).toBeCloseTo(g.planum(4.25) - 0.1, 9);
  });
});
