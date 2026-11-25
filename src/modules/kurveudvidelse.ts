import { overhang } from '../core/formulas';
import { BANEDANMARK as rs } from '../core/rules';
import { setReport } from '../core/report';
import { card, fmt, form, h, loadState, results, saveState, type Module } from '../ui/dom';

type S = { R: number; a: number; Lv: number; H: number; h: number };
const DEF: S = { R: 300, a: 19, Lv: 26.4, H: 3.8, h: 120 };

export const kurveudvidelse: Module = {
  id: 'kurveudvidelse',
  gruppe: 'I sporet',
  titel: 'Kurveudvidelse',
  kort: 'Udvidelse',
  ikon: '⇔',
  beskrivelse: 'Geometrisk overslag over køretøjers udbøjning i kurver og sidevandring pga. overhøjde – fx til vurdering af sporafstand og frirum.',
  render(root) {
    const st = loadState<S>('kurveudvidelse', DEF);
    const out = h('div', { class: 'out' });
    const update = () => {
      saveState('kurveudvidelse', st);
      const o = overhang(st.R, st.a, st.Lv, st.H, st.h, rs);
      const ind = o.indvendig + o.haeldning;
      out.innerHTML = `
        <div class="notice"><strong>Overslag:</strong> Rent geometrisk beregning (uden sidespil, krængning og dynamik). Gældende krav til sporafstand og frirum findes i BN1-154 og frirumsprofilerne.</div>
        ${results([
          { symbol: 'e<sub>i</sub>', label: 'Udbøjning indad (vognmidte)', value: fmt(o.indvendig, 0), unit: 'mm', big: true, sub: 'e<sub>i</sub> = a²/(8R)' },
          { symbol: 'e<sub>y</sub>', label: 'Udbøjning udad (vognende)', value: fmt(o.udvendig, 0), unit: 'mm', big: true, sub: 'e<sub>y</sub> = (L<sub>v</sub>² − a²)/(8R)' },
          { symbol: 'Δ<sub>h</sub>', label: `Sidevandring i højden ${fmt(st.H, 1)} m`, value: fmt(o.haeldning, 0), unit: 'mm', sub: 'Δ<sub>h</sub> = h·H/e (mod kurvens inderside)' },
          { symbol: 'Σ<sub>i</sub>', label: 'Samlet indad i højden H', value: fmt(ind, 0), unit: 'mm', sub: 'e<sub>i</sub> + Δ<sub>h</sub>' },
        ])}
      `;
      setReport({
        modul: 'Kurveudvidelse (geometrisk overslag)',
        inputs: [
          { label: 'Radius', symbol: 'R', value: fmt(st.R), unit: 'm' },
          { label: 'Bogiecenterafstand', symbol: 'a', value: fmt(st.a, 1), unit: 'm' },
          { label: 'Vognkasselængde', symbol: 'L<sub>v</sub>', value: fmt(st.Lv, 1), unit: 'm' },
          { label: 'Højde over SO', symbol: 'H', value: fmt(st.H, 2), unit: 'm' },
          { label: 'Overhøjde', symbol: 'h', value: fmt(st.h), unit: 'mm' },
        ],
        steps: [
          { label: 'Udbøjning indad', formel: 'e<sub>i</sub> = a²/(8R)', indsat: `${fmt(st.a, 1)}²/(8·${fmt(st.R)})`, resultat: `${fmt(o.indvendig, 1)} mm` },
          { label: 'Udbøjning udad', formel: 'e<sub>y</sub> = (L<sub>v</sub>² − a²)/(8R)', indsat: `(${fmt(st.Lv, 1)}² − ${fmt(st.a, 1)}²)/(8·${fmt(st.R)})`, resultat: `${fmt(o.udvendig, 1)} mm` },
          { label: 'Sidevandring fra overhøjde', formel: 'Δ<sub>h</sub> = h·H/e', indsat: `${st.h}·${fmt(st.H * 1000)}/${rs.kontaktafstand}`, resultat: `${fmt(o.haeldning, 1)} mm` },
          { label: 'Samlet indad', formel: 'e<sub>i</sub> + Δ<sub>h</sub>', indsat: `${fmt(o.indvendig, 1)} + ${fmt(o.haeldning, 1)}`, resultat: `${fmt(ind, 1)} mm` },
        ],
        checks: [],
        noter: ['Geometrisk overslag uden sidespil, krængning og dynamiske tillæg. Sporafstand skal dimensioneres efter BN1-154.'],
        refs: ['BN1-154', 'SR87'],
      });
    };
    const f = form<keyof S>([
      { key: 'R', label: 'Radius', symbol: 'R', unit: 'm', min: 100, max: 5000, step: 10 },
      { key: 'a', label: 'Bogiecenterafstand', symbol: 'a', unit: 'm', min: 5, max: 25, step: 0.1 },
      { key: 'Lv', label: 'Vognkasselængde', symbol: 'L<sub>v</sub>', unit: 'm', min: 8, max: 30, step: 0.1 },
      { key: 'H', label: 'Højde over skinneoverkant', symbol: 'H', unit: 'm', min: 0, max: 5, step: 0.1 },
      { key: 'h', label: 'Overhøjde', symbol: 'h', unit: 'mm', min: 0, max: 180, step: 5 },
    ], st, update);
    root.append(h('div', { class: 'grid' }, card('Input', f, 'card-input'), card('Resultat', out, 'card-out')));
    update();
  },
};
