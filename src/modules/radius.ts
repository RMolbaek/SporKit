import { BANEDANMARK as rs, limitI, loadSettings, sporudvidelse } from '../core/rules';
import { minRadius, minRadiusMixed, roundTo, cantConstant } from '../core/formulas';
import { setReport } from '../core/report';
import { tsiCantDeficiency, tsiCantMax, tsiStatus, TSI_KILDE, TSI_R_MIN, TSI_CANT_DEFICIENCY_WAG } from '../core/tsi';
import { card, fmt, form, h, loadState, results, saveState, tsiBlock, type Module } from '../ui/dom';

type S = { V: number; Vmin: number; h: number; I: number };
const DEF: S = { V: 160, Vmin: 80, h: 160, I: 100 };

export const radius: Module = {
  id: 'radius',
  gruppe: 'Linjeføring',
  titel: 'Mindste radius',
  kort: 'Radius',
  ikon: '◠',
  beskrivelse: 'Mindste kurveradius for en given hastighed – også ved blandet person- og godstrafik (Sporregler afsn. 2.02–2.04).',
  render(root) {
    const st = loadState<S>('radius2', DEF);
    const out = h('div', { class: 'out' });

    const update = () => {
      saveState('radius2', st);
      const set = loadSettings();
      const LI = limitI(rs, st.V, set);
      const C = cantConstant(rs);
      const Rb = minRadius(st.V, st.h, st.I, rs);
      const mN = minRadiusMixed(st.V, st.Vmin, rs.overhoejdeMax.normal, LI.normal, rs.overskydendeOverhoejdeMax.normal, rs);
      const mU = minRadiusMixed(st.V, st.Vmin, rs.overhoejdeMax.undtagelse, LI.undtagelse, rs.overskydendeOverhoejdeMax.undtagelse, rs);
      const hT = tsiCantMax(set.tsiTrafik, set.tsiSpor);
      const RtsiV = minRadius(st.V, hT, tsiCantDeficiency(st.V), rs);
      const tsiRows = set.tsi ? [
        { label: `Mindste radius efter TSI (h = ${hT}, I = ${tsiCantDeficiency(st.V)} mm)`, value: `${fmt(roundTo(RtsiV, 10, 'op'))} m`, graense: 'C·V²/(h<sub>max</sub> + I<sub>max</sub>)', status: 'ok' as const, kilde: `${TSI_KILDE} 4.2.4.2–4.2.4.3` },
        { label: 'Mindste radius, nye strækninger', value: `${fmt(roundTo(Math.max(mN.R, RtsiV), 10, 'op'))} m`, graense: `≥ ${TSI_R_MIN} m`, status: tsiStatus(Math.max(mN.R, RtsiV) >= TSI_R_MIN), kilde: `${TSI_KILDE} 4.2.3.4(1)` },
        { label: 'Valgt I mod TSI', value: `${fmt(st.I)} mm`, graense: `≤ ${tsiCantDeficiency(st.V)} mm (godsvogne ${TSI_CANT_DEFICIENCY_WAG} mm)`, status: tsiStatus(st.I <= tsiCantDeficiency(st.V)), kilde: `${TSI_KILDE} 4.2.4.3, tabel 8` },
      ] : [];
      const why = (m: typeof mN) =>
        m.styrende === 'hastighed' ? 'styret af h<sub>max</sub> + I<sub>max</sub>' : 'styret af hastighedsspredningen V/V<sub>min</sub>';

      out.innerHTML = `
        <div class="summary summary-ok">
          <div><strong>Mindste radius (normal, blandet trafik)</strong><span>${why(mN)}</span></div>
          <div class="summary-val">${fmt(roundTo(mN.R, 10, 'op'))} m</div>
        </div>
        ${results([
          { symbol: 'R<sub>min</sub>', label: 'Med valgt h og I', value: fmt(roundTo(Rb, 10, 'op')), unit: 'm', big: true,
            sub: `R = ${fmt(C, 2)}·V² / (h + I) = ${fmt(Rb, 1)} m` },
          { symbol: 'R<sub>min,u</sub>', label: 'Undtagelse, blandet trafik', value: fmt(roundTo(mU.R, 10, 'op')), unit: 'm', big: true,
            status: 'undtagelse', sub: `${why(mU)} · I<sub>max</sub> = ${LI.undtagelse} mm` },
          { symbol: 'R<sub>V</sub>', label: 'Krav fra hastighed (normal)', value: fmt(mN.Rhast, 0), unit: 'm',
            sub: `h = ${rs.overhoejdeMax.normal}, I = ${LI.normal} mm` },
          { symbol: 'R<sub>ΔV</sub>', label: 'Krav fra spredning (normal)', value: fmt(mN.Rspred, 0), unit: 'm',
            sub: `C·(V² − V<sub>min</sub>²) / (I + E)` },
        ])}
        <p class="tip">Ved blandet trafik skal én overhøjde give I ≤ I<sub>max</sub> for de hurtige tog og E ≤ E<sub>max</sub> for de langsomme.
        Sæt V<sub>min</sub> = V for ren persontrafik. Langskinnespor har desuden mindste radius efter overbygning, fx UIC60 Dmp 400 m og UIC60 Dt 700 m (BN1-66). Radier over ${fmt(rs.radiusRetSpor)} m regnes som ret spor.</p>
        ${mN.R < 190 ? `<p class="tip">R < 190 m: sporet skal have sporudvidelse på ${sporudvidelse(mN.R)} mm (Sporregler 2.12).</p>` : ''}
        ${tsiBlock(tsiRows, 'Modvendte kurver med små radier på nye strækninger skal udformes, så bufferlåsning undgås; mellemliggende retlinje efter EN 13803 tabel N.1/N.2 (TSI 4.2.3.4(2)).')}
      `;
      setReport({
        modul: 'Mindste radius',
        inputs: [
          { label: 'Hastighed', symbol: 'V', value: fmt(st.V), unit: 'km/t' },
          { label: 'Laveste hastighed', symbol: 'V<sub>min</sub>', value: fmt(st.Vmin), unit: 'km/t' },
          { label: 'Overhøjde', symbol: 'h', value: fmt(st.h), unit: 'mm' },
          { label: 'Overhøjdeunderskud', symbol: 'I', value: fmt(st.I), unit: 'mm' },
        ],
        steps: [
          { label: 'Mindste radius (valgt h, I)', formel: 'R = C·V²/(h + I)', indsat: `${fmt(C, 3)}·${st.V}²/(${st.h} + ${st.I})`, resultat: `${fmt(Rb, 1)} m` },
          { label: 'Krav fra hastighed', formel: 'R<sub>V</sub> = C·V²/(h<sub>max</sub> + I<sub>max</sub>)', indsat: `${fmt(C, 3)}·${st.V}²/(${rs.overhoejdeMax.normal} + ${LI.normal})`, resultat: `${fmt(mN.Rhast, 1)} m` },
          { label: 'Krav fra spredning', formel: 'R<sub>ΔV</sub> = C·(V² − V<sub>min</sub>²)/(I<sub>max</sub> + E<sub>max</sub>)', indsat: `${fmt(C, 3)}·(${st.V}² − ${st.Vmin}²)/(${LI.normal} + ${rs.overskydendeOverhoejdeMax.normal})`, resultat: `${fmt(mN.Rspred, 1)} m` },
          { label: 'Mindste radius, normal', formel: 'max(R<sub>V</sub>; R<sub>ΔV</sub>)', indsat: '', resultat: `${fmt(mN.R, 1)} m` },
          { label: 'Mindste radius, undtagelse', formel: 'som ovenfor med undtagelsesværdier', indsat: `h ${rs.overhoejdeMax.undtagelse}, I ${LI.undtagelse}, E ${rs.overskydendeOverhoejdeMax.undtagelse}`, resultat: `${fmt(mU.R, 1)} m` },
        ],
        checks: tsiRows.map((r) => ({ ...r, label: `TSI: ${r.label}` })),
        noter: ['Langskinnespor: mindste radius afhænger af overbygning (BN1-66 afsn. 11).'],
        refs: ['SR87', 'ST16', 'BN1-66', 'EN13803', ...(tsiRows.length ? ['TSI-INF'] : [])],
      });
    };

    const f = form<keyof S>(
      [
        { key: 'V', label: 'Hastighed', symbol: 'V', unit: 'km/t', min: 10, max: 300, step: 5 },
        { key: 'Vmin', label: 'Laveste hastighed (gods)', symbol: 'V<sub>min</sub>', unit: 'km/t', min: 0, max: 300, step: 5 },
        { key: 'h', label: 'Overhøjde', symbol: 'h', unit: 'mm', min: 0, max: 180, step: 5 },
        { key: 'I', label: 'Tilladt overhøjdeunderskud', symbol: 'I', unit: 'mm', min: 0, max: 160, step: 5 },
      ],
      st,
      update,
    );
    root.append(h('div', { class: 'grid' }, card('Input', f, 'card-input'), card('Resultat', out, 'card-out')));
    update();
  },
};
