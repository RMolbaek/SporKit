import { describe, expect, it } from 'vitest';
import { BANEDANMARK as rs, vurder } from '../src/core/rules';
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
