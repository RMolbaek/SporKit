import { BANEDANMARK as rs, vurder, vurderMin, samletStatus } from '../core/rules';
import { verticalCurve, minVerticalRadius, verticalOrdinate, roundTo } from '../core/formulas';
import { setReport } from '../core/report';
import { card, chip, fmt, form, h, loadState, results, saveState, graense, kildeTekst, type Module } from '../ui/dom';

type S = { i1: number; i2: number; Rv: number; V: number };
const DEF: S = { i1: 6, i2: -4, Rv: 15000, V: 160 };

function profile(st: S, T: number): string {
  const W = 320, H = 150, m = 24;
  const span = Math.max(T * 1.8, 50);
  const xs = (x: number) => W / 2 + ((W / 2 - m) * x) / span;
  const yTS = (x: number) => (x < 0 ? (st.i1 / 1000) * x : (st.i2 / 1000) * x);
  const yC = (x: number) => {
    if (x <= -T) return yTS(x);
    if (x >= T) return yTS(x);
    const xx = x + T;
    return (st.i1 / 1000) * (x) + Math.sign(st.i2 - st.i1) * verticalOrdinate(xx, st.Rv);
  };
  const pts = Array.from({ length: 81 }, (_, k) => -span + (2 * span * k) / 80);
  const ys = pts.map(yC).concat(pts.map(yTS));
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const sc = (H - 50) / Math.max(1e-6, yMax - yMin);
  const Y = (y: number) => H - 25 - (y - yMin) * sc;
  return `
  <svg viewBox="0 0 ${W} ${H}" class="viz" role="img" aria-label="Længdeprofil med lodret kurve">
    <polyline points="${pts.map((x) => `${xs(x).toFixed(1)},${Y(yTS(x)).toFixed(1)}`).join(' ')}" class="tick"/>
    <polyline points="${pts.map((x) => `${xs(x).toFixed(1)},${Y(yC(x)).toFixed(1)}`).join(' ')}" class="curve-sel"/>
    <circle cx="${xs(-T)}" cy="${Y(yC(-T))}" r="3.5" class="dot"/><circle cx="${xs(T)}" cy="${Y(yC(T))}" r="3.5" class="dot"/>
    <text x="${xs(-T)}" y="${Y(yC(-T)) + 16}" text-anchor="middle" class="lbl-svg muted">TP₁</text>
    <text x="${xs(T)}" y="${Y(yC(T)) + 16}" text-anchor="middle" class="lbl-svg muted">TP₂</text>
    <text x="${xs(0)}" y="${Y(0) - 8}" text-anchor="middle" class="lbl-svg">TS</text>
    <text x="10" y="16" class="lbl-svg muted">Lodret skala overdrevet · i₁ = ${fmt(st.i1, 1)} ‰ → i₂ = ${fmt(st.i2, 1)} ‰</text>
  </svg>`;
}

export const lodret: Module = {
  id: 'lodret',
  gruppe: 'Længdeprofil',
  titel: 'Lodret kurve',
  kort: 'Lodret',
  ikon: '⌒',
  beskrivelse: 'Lodrette cirkelbuer i længdeprofilet: tangentlængde, pilhøjde, lodret acceleration og kontrol af stigning og radius (Sporregler afsn. 2.10).',
  render(root) {
    const st = loadState<S>('lodret', DEF);
    const out = h('div', { class: 'out' });
    const update = () => {
      saveState('lodret', st);
      const vc = verticalCurve(st.i1, st.i2, st.Rv, st.V);
      const RvN = minVerticalRadius(st.V, rs.lodretAccMax.normal);
      const RvU = minVerticalRadius(st.V, rs.lodretAccMax.undtagelse);
      const Rkrav = Math.max(RvN, rs.lodretRadiusMin.normal);
      const sR = vurderMin(st.Rv, { ...rs.lodretRadiusMin, normal: Rkrav, undtagelse: Math.max(RvU, rs.lodretRadiusMin.undtagelse) });
      const sRmax = st.Rv <= rs.lodretRadiusMax.normal ? 'ok' : 'overskredet';
      const sA = vurder(vc.av, rs.lodretAccMax);
      const sI1 = vurder(st.i1, rs.stigningMax);
      const sI2 = vurder(st.i2, rs.stigningMax);
      const total = samletStatus([sR, sRmax, sA, sI1, sI2]);
      const fig = profile(st, vc.T);
      out.innerHTML = `
        <div class="summary summary-${total}">
          <div><strong>${vc.konveks ? 'Konveks (top)' : 'Konkav (lavning)'}</strong><span>Δi = ${fmt(vc.di, 1)} ‰ · R<sub>v</sub> ${fmt(st.Rv)} m</span></div>
          ${chip(total)}
        </div>
        ${results([
          { symbol: 'T', label: 'Tangentlængde', value: fmt(vc.T, 2), unit: 'm', big: true, sub: 'T = R<sub>v</sub>·|Δi| / 2000' },
          { symbol: 'f', label: 'Pilhøjde i TS', value: fmt(vc.f * 1000, 0), unit: 'mm', big: true, sub: 'f = T² / (2R<sub>v</sub>)' },
          { symbol: 'L<sub>v</sub>', label: 'Kurvelængde', value: fmt(vc.L, 2), unit: 'm' },
          { symbol: 'a<sub>v</sub>', label: 'Lodret acceleration', value: fmt(vc.av, 3), unit: 'm/s²', status: sA, sub: graense(rs.lodretAccMax) },
          { symbol: 'R<sub>v,min</sub>', label: 'Krav til lodret radius', value: fmt(roundTo(Rkrav, 100, 'op')), unit: 'm', status: sR,
            sub: `max(${fmt(rs.lodretRadiusMin.normal)}; v²/a<sub>v</sub> = ${fmt(RvN)})` },
          { symbol: 'i', label: 'Stigning/fald', value: `${fmt(st.i1, 1)} / ${fmt(st.i2, 1)}`, unit: '‰', status: samletStatus([sI1, sI2]), sub: graense(rs.stigningMax) },
        ])}
        ${fig}
        <p class="tip">Ordinat fra tangent i afstand x fra tangentpunkt: y = x² / (2R<sub>v</sub>). Ved perroner og opstillingsspor bør stigningen højst være ${fmt(rs.stigningPerron.normal, 1)} ‰.</p>
      `;
      setReport({
        modul: 'Lodret kurve (længdeprofil)',
        inputs: [
          { label: 'Hældning før', symbol: 'i₁', value: fmt(st.i1, 1), unit: '‰' },
          { label: 'Hældning efter', symbol: 'i₂', value: fmt(st.i2, 1), unit: '‰' },
          { label: 'Lodret radius', symbol: 'R<sub>v</sub>', value: fmt(st.Rv), unit: 'm' },
          { label: 'Hastighed', symbol: 'V', value: fmt(st.V), unit: 'km/t' },
        ],
        steps: [
          { label: 'Hældningsændring', formel: 'Δi = i₂ − i₁', indsat: `${fmt(st.i2, 1)} − ${fmt(st.i1, 1)}`, resultat: `${fmt(vc.di, 1)} ‰` },
          { label: 'Tangentlængde', formel: 'T = R<sub>v</sub>·|Δi|/2000', indsat: `${fmt(st.Rv)}·${fmt(Math.abs(vc.di), 1)}/2000`, resultat: `${fmt(vc.T, 3)} m` },
          { label: 'Pilhøjde', formel: 'f = T²/(2R<sub>v</sub>)', indsat: `${fmt(vc.T, 3)}²/(2·${fmt(st.Rv)})`, resultat: `${fmt(vc.f * 1000, 1)} mm` },
          { label: 'Lodret acceleration', formel: 'a<sub>v</sub> = (V/3,6)²/R<sub>v</sub>', indsat: `(${st.V}/3,6)²/${fmt(st.Rv)}`, resultat: `${fmt(vc.av, 4)} m/s²` },
          { label: 'Mindste R<sub>v</sub> (komfort)', formel: 'R<sub>v</sub> = (V/3,6)²/a<sub>v,max</sub>', indsat: `(${st.V}/3,6)²/${rs.lodretAccMax.normal}`, resultat: `${fmt(RvN, 0)} m` },
        ],
        checks: [
          { label: 'Lodret radius (min.)', value: `${fmt(st.Rv)} m`, graense: `≥ ${fmt(rs.lodretRadiusMin.normal)} m (hovedbaner)`, status: sR, kilde: kildeTekst(rs.lodretRadiusMin) },
          { label: 'Lodret radius (maks.)', value: `${fmt(st.Rv)} m`, graense: `≤ ${fmt(rs.lodretRadiusMax.normal)} m`, status: sRmax, kilde: kildeTekst(rs.lodretRadiusMax) },
          { label: 'Lodret acceleration', value: `${fmt(vc.av, 3)} m/s²`, graense: graense(rs.lodretAccMax), status: sA, kilde: kildeTekst(rs.lodretAccMax) },
          { label: 'Hældning i₁', value: `${fmt(st.i1, 1)} ‰`, graense: graense(rs.stigningMax), status: sI1, kilde: kildeTekst(rs.stigningMax) },
          { label: 'Hældning i₂', value: `${fmt(st.i2, 1)} ‰`, graense: graense(rs.stigningMax), status: sI2, kilde: kildeTekst(rs.stigningMax) },
        ],
        refs: ['SR87', 'ST16', 'EN13803', 'BN2-93'],
        figur: fig,
      });
    };
    const f = form<keyof S>([
      { key: 'i1', label: 'Hældning før (+ = stigning)', symbol: 'i₁', unit: '‰', min: -16, max: 16, step: 0.5 },
      { key: 'i2', label: 'Hældning efter', symbol: 'i₂', unit: '‰', min: -16, max: 16, step: 0.5 },
      { key: 'Rv', label: 'Lodret radius', symbol: 'R<sub>v</sub>', unit: 'm', min: 2000, max: 50000, step: 500 },
      { key: 'V', label: 'Hastighed', symbol: 'V', unit: 'km/t', min: 10, max: 300, step: 5 },
    ], st, update);
    root.append(h('div', { class: 'grid' }, card('Input', f, 'card-input'), card('Resultat', out, 'card-out')));
    update();
  },
};
