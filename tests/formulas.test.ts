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
