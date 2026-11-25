import { BANEDANMARK as rs } from '../core/rules';
import { minRadius, minRadiusMixed, roundTo, cantConstant } from '../core/formulas';
import { card, fmt, form, h, loadState, results, saveState, type Module } from '../ui/dom';

type S = { V: number; Vmin: number; h: number; I: number };
const DEF: S = { V: 160, Vmin: 80, h: 150, I: 100 };

export const radius: Module = {
  id: 'radius',
  titel: 'Mindste radius',
  kort: 'Radius',
  ikon: '◠',
  beskrivelse: 'Mindste kurveradius for en given hastighed – også ved blandet person- og godstrafik.',
  render(root) {
    const st = loadState<S>('radius', DEF);
    const out = h('div', { class: 'out' });

    const update = () => {
      saveState('radius', st);
      const Rbruger = minRadius(st.V, st.h, st.I, rs);
      const mN = minRadiusMixed(st.V, st.Vmin, rs.overhoejdeMax.normal, rs.manglendeOverhoejdeMax.normal, rs.overskydendeOverhoejdeMax.normal, rs);
      const mU = minRadiusMixed(st.V, st.Vmin, rs.overhoejdeMax.undtagelse, rs.manglendeOverhoejdeMax.undtagelse, rs.overskydendeOverhoejdeMax.undtagelse, rs);
      const why = (m: typeof mN) =>
        m.styrende === 'hastighed' ? 'styret af h<sub>max</sub> + I<sub>max</sub>' : 'styret af hastighedsspredningen V/V<sub>min</sub>';

      out.innerHTML = `
        <div class="summary summary-ok">
          <div><strong>Mindste radius (normal, blandet trafik)</strong><span>${why(mN)}</span></div>
          <div class="summary-val">${fmt(roundTo(mN.R, 10, 'op'))} m</div>
        </div>
        ${results([
          { symbol: 'R<sub>min</sub>', label: 'Med valgt h og I', value: fmt(roundTo(Rbruger, 10, 'op')), unit: 'm', big: true,
            sub: `R = ${fmt(cantConstant(rs), 2)}·V² / (h + I) = ${fmt(Rbruger, 1)} m` },
          { symbol: 'R<sub>min,u</sub>', label: 'Undtagelse, blandet trafik', value: fmt(roundTo(mU.R, 10, 'op')), unit: 'm', big: true,
            status: 'undtagelse', sub: why(mU) },
          { symbol: 'R<sub>V</sub>', label: 'Krav fra hastighed (normal)', value: fmt(mN.Rhast, 0), unit: 'm',
            sub: `h = ${rs.overhoejdeMax.normal}, I = ${rs.manglendeOverhoejdeMax.normal} mm` },
          { symbol: 'R<sub>ΔV</sub>', label: 'Krav fra spredning (normal)', value: fmt(mN.Rspred, 0), unit: 'm',
            sub: `C·(V² − V<sub>min</sub>²) / (I + E), E = ${rs.overskydendeOverhoejdeMax.normal} mm` },
        ])}
        <p class="tip">Ved blandet trafik skal der findes én overhøjde, der både giver I ≤ I<sub>max</sub> for de hurtige
        tog og E ≤ E<sub>max</sub> for de langsomme. Sæt V<sub>min</sub> = V for ren persontrafik.</p>
      `;
    };

    const f = form<keyof S>(
      [
        { key: 'V', label: 'Hastighed', symbol: 'V', unit: 'km/t', min: 10, max: 300, step: 5 },
        { key: 'Vmin', label: 'Laveste hastighed (gods)', symbol: 'V<sub>min</sub>', unit: 'km/t', min: 0, max: 300, step: 5 },
        { key: 'h', label: 'Overhøjde', symbol: 'h', unit: 'mm', min: 0, max: 160, step: 5 },
        { key: 'I', label: 'Tilladt manglende overhøjde', symbol: 'I', unit: 'mm', min: 0, max: 150, step: 5 },
      ],
      st,
      update,
    );
    root.append(h('div', { class: 'grid' }, card('Input', f, 'card-input'), card('Resultat', out, 'card-out')));
    update();
  },
};
