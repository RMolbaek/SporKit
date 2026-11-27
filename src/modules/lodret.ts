import { BANEDANMARK as rs, vurder, samletStatus, afrundingsKrav, type Status } from '../core/rules';
import { verticalCurve, verticalOrdinate, roundTo } from '../core/formulas';
import { setReport } from '../core/report';
import { TSI_RV_MIN, TSI_GRADIENT, tsiStatus, TSI_KILDE } from '../core/tsi';
import { loadSettings } from '../core/rules';
import { card, chip, fmt, form, h, loadState, results, saveState, graense, kildeTekst, select, tsiBlock, type Module } from '../ui/dom';

type S = { i1: number; i2: number; Rv: number; V: number };
const DEF: S = { i1: 6, i2: -4, Rv: 15000, V: 160 };

function profile(st: S, T: number): string {
  const W = 320, H = 165, m = 24;
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
  const sc = (H - 65) / Math.max(1e-6, yMax - yMin);
  const Y = (y: number) => H - 25 - (y - yMin) * sc;
  return `
  <svg viewBox="0 0 ${W} ${H}" class="viz" role="img" aria-label="Længdeprofil med lodret kurve">
    <polyline points="${pts.map((x) => `${xs(x).toFixed(1)},${Y(yTS(x)).toFixed(1)}`).join(' ')}" fill="none" class="tick"/>
    <polyline points="${pts.map((x) => `${xs(x).toFixed(1)},${Y(yC(x)).toFixed(1)}`).join(' ')}" fill="none" class="curve-sel"/>
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
    const opt = loadState<{ situation: string }>('lodret-opt', { situation: 'nyanlaeg' });
    const out = h('div', { class: 'out' });
    const update = () => {
      saveState('lodret', st);
      saveState('lodret-opt', opt);
      const vc = verticalCurve(st.i1, st.i2, st.Rv, st.V);
      const ak = afrundingsKrav(st.V, opt.situation === 'eksisterende');
      const absDi = Math.abs(vc.di);
      const direkteKnaek = absDi <= 1;
      // Afrundingsradius (2.10.3): normal/undtagelse; ønskeligt mellem ak.oensket[0] og ak.oensket[1]
      const sR: Status = direkteKnaek ? 'ok' : st.Rv >= ak.normal - 1e-6 ? 'ok' : st.Rv >= ak.undtagelse - 1e-6 && opt.situation !== 'kam' ? 'undtagelse' : 'overskredet';
      const sRmax: Status = st.Rv <= ak.oensket[1] + 1e-6 ? 'ok' : 'undtagelse';
      const oenskeligOk = st.Rv >= ak.oensket[0] - 1e-6 && st.Rv <= ak.oensket[1] + 1e-6;
      const minLaengde = st.V <= 80 && opt.situation === 'transversal' ? 10 : 20;
      const sL: Status = direkteKnaek || vc.L >= minLaengde - 1e-6 ? 'ok' : 'overskredet';
      const sA = vurder(vc.av, st.V > 200 ? { ...rs.lodretAccMax, normal: 0.22, undtagelse: (1 / 3.6 ** 2) / 0.175 } : rs.lodretAccMax);
      const sI1 = vurder(st.i1, rs.stigningMax);
      const sI2 = vurder(st.i2, rs.stigningMax);
      const total = samletStatus([sR, sL, sI1, sI2]);
      const fig = profile(st, vc.T);
      const set = loadSettings();
      const rvTsi = vc.konveks ? TSI_RV_MIN.top : TSI_RV_MIN.lavning;
      const tsiRows = set.tsi ? [
        { label: `Lodret radius (${vc.konveks ? 'top' : 'lavning'})`, value: `${fmt(st.Rv)} m`, graense: `≥ ${rvTsi} m`, status: tsiStatus(st.Rv >= rvTsi), kilde: `${TSI_KILDE} 4.2.3.5(1)` },
        { label: 'Største hældning (P1 nye strækninger)', value: `${fmt(Math.max(Math.abs(st.i1), Math.abs(st.i2)), 1)} ‰`, graense: `≤ ${TSI_GRADIENT.p1Maks} ‰`, status: tsiStatus(Math.max(Math.abs(st.i1), Math.abs(st.i2)) <= TSI_GRADIENT.p1Maks), kilde: `${TSI_KILDE} 4.2.3.3(3)` },
      ] : [];
      out.innerHTML = `
        <div class="summary summary-${total}">
          <div><strong>${vc.konveks ? 'Konveks (top)' : 'Konkav (lavning)'}</strong><span>Δi = ${fmt(vc.di, 1)} ‰ · R<sub>v</sub> ${fmt(st.Rv)} m</span></div>
          ${chip(total)}
        </div>
        ${results([
          { symbol: 'T', label: 'Tangentlængde', value: fmt(vc.T, 2), unit: 'm', big: true, sub: 'T = R<sub>v</sub>·|Δi| / 2000' },
          { symbol: 'f', label: 'Pilhøjde i TS', value: fmt(vc.f * 1000, 0), unit: 'mm', big: true, sub: 'f = T² / (2R<sub>v</sub>)' },
          { symbol: 'L<sub>v</sub>', label: 'Kurvelængde', value: fmt(vc.L, 2), unit: 'm' },
          { symbol: 'a<sub>v</sub>', label: 'Lodret acceleration', value: fmt(vc.av, 3), unit: 'm/s²', status: sA, sub: '0,35·V² ⇔ 0,22 m/s² · 0,25·V² ⇔ 0,31 m/s²' },
          { symbol: 'R<sub>L,min</sub>', label: 'Krav til afrundingsradius', value: direkteKnaek ? 'direkte knæk' : fmt(roundTo(ak.normal, 100, 'op')), unit: direkteKnaek ? '' : 'm', status: sR,
            sub: direkteKnaek ? 'Δi ≤ 1 ‰ må indlægges som direkte knæk' : `normal ${fmt(ak.normal)} · undt. ${fmt(ak.undtagelse)} · ønsket ${fmt(ak.oensket[0])}–${fmt(ak.oensket[1])} m${oenskeligOk ? ' ✓' : ''}` },
          { symbol: 'L<sub>min</sub>', label: 'Afrundingskurvens længde', value: fmt(vc.L, 1), unit: 'm', status: sL, sub: `≥ ${minLaengde} m (2.10.3)` },
          { symbol: 'i', label: 'Stigning/fald', value: `${fmt(st.i1, 1)} / ${fmt(st.i2, 1)}`, unit: '‰', status: samletStatus([sI1, sI2]), sub: graense(rs.stigningMax) },
        ])}
        ${fig}
        ${tsiBlock(tsiRows, `TSI: Spor ved perroner på nye strækninger, hvor vogne kobles til/fra, og nye opstillingsspor: højst ${fmt(TSI_GRADIENT.perron, 1)} ‰. Op til 35 ‰ kun på nye P1-strækninger (glidende gennemsnit over 10 km ≤ 25 ‰, højst 6 km sammenhængende). Pukler i rangerterræn: R<sub>v</sub> ≥ ${TSI_RV_MIN.pukkelTop}/${TSI_RV_MIN.pukkelLavning} m.`)}
        <p class="tip">Ordinat fra tangent i afstand x fra tangentpunkt: y = x² / (2R<sub>v</sub>). Stigning langs perron: ønskeligt 1,5 ‰, normal 2,5 ‰ ved ny perron og 10 ‰ ved eksisterende perron (Sporregler 2.10.2). Afrundingskurver bør så vidt muligt ligge uden for overhøjderamper, sporskifter og overkørsler samt 25 m på begge sider af overkørsler (2.10.3).</p>
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
          { label: 'Krav til afrundingsradius (normal)', formel: st.V > 200 ? 'R<sub>L</sub> ≥ 0,35·V², min. 20.000 m (formel 40)' : `R<sub>L</sub> ≥ 0,35·V², min. ${opt.situation === 'eksisterende' ? '2.000' : '5.000'} m (formel 39)`, indsat: `0,35·${st.V}² = ${fmt(0.35 * st.V * st.V)}`, resultat: `${fmt(ak.normal)} m` },
          { label: 'Krav til afrundingsradius (undtagelse)', formel: st.V > 200 ? 'R<sub>L</sub> ≥ 0,175·V², min. 10.000 m (formel 42)' : 'R<sub>L</sub> ≥ 0,25·V², min. 2.000 m (formel 41)', indsat: '', resultat: `${fmt(ak.undtagelse)} m` },
        ],
        checks: [
          { label: 'Afrundingsradius', value: direkteKnaek ? `direkte knæk (Δi = ${fmt(absDi, 1)} ‰)` : `${fmt(st.Rv)} m`, graense: direkteKnaek ? 'Δi ≤ 1 ‰' : `≥ ${fmt(ak.normal)} / ${fmt(ak.undtagelse)} m`, status: sR, kilde: kildeTekst(rs.lodretRadiusMin) },
          { label: 'Ønskelig afrundingsradius', value: `${fmt(st.Rv)} m`, graense: `${fmt(ak.oensket[0])} – ${fmt(ak.oensket[1])} m`, status: sRmax, kilde: kildeTekst(rs.lodretRadiusMax) },
          { label: 'Afrundingskurvens længde', value: `${fmt(vc.L, 1)} m`, graense: `≥ ${minLaengde} m`, status: sL, kilde: 'SR87 afsn. 2.10.3' },
          { label: 'Lodret acceleration (afledt)', value: `${fmt(vc.av, 3)} m/s²`, graense: graense(rs.lodretAccMax), status: sA, kilde: kildeTekst(rs.lodretAccMax) },
          { label: 'Hældning i₁', value: `${fmt(st.i1, 1)} ‰`, graense: graense(rs.stigningMax), status: sI1, kilde: kildeTekst(rs.stigningMax) },
          { label: 'Hældning i₂', value: `${fmt(st.i2, 1)} ‰`, graense: graense(rs.stigningMax), status: sI2, kilde: kildeTekst(rs.stigningMax) },
          ...tsiRows.map((r) => ({ ...r, label: `TSI: ${r.label}` })),
        ],
        refs: ['SR87', 'ST16', 'BN2-93', 'BN1-166', ...(tsiRows.length ? ['TSI-INF'] : [])],
        figur: fig,
      });
    };
    const f = form<keyof S>([
      { key: 'i1', label: 'Hældning før (+ = stigning)', symbol: 'i₁', unit: '‰', min: -16, max: 16, step: 0.5 },
      { key: 'i2', label: 'Hældning efter', symbol: 'i₂', unit: '‰', min: -16, max: 16, step: 0.5 },
      { key: 'Rv', label: 'Afrundingsradius', symbol: 'R<sub>L</sub>', unit: 'm', min: 500, max: 50000, step: 500 },
      { key: 'V', label: 'Hastighed', symbol: 'V', unit: 'km/t', min: 10, max: 300, step: 5 },
    ], st, update);
    f.append(select('Situation', 'situation', [['nyanlaeg', 'Nyanlæg, ombygning, opgradering eller sporskifte'], ['eksisterende', 'Eksisterende spor'], ['kam', 'Sporskifte på bakkekam (ingen undtagelse)'], ['transversal', 'Transversalforbindelse (V ≤ 80: L ≥ 10 m)']], opt, update));
    root.append(h('div', { class: 'grid' }, card('Input', f, 'card-input'), card('Resultat', out, 'card-out')));
    update();
  },
};
