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
