import { BANEDANMARK as rs, limitI, loadSettings, sporudvidelse, limitH, radiusKrav, SPORTYPE_TEKST, type Sportype } from '../core/rules';
import { minRadius, minRadiusMixed, roundTo, cantConstant } from '../core/formulas';
import { setReport } from '../core/report';
import { tsiCantDeficiency, tsiCantMax, tsiStatus, TSI_KILDE, TSI_R_MIN, TSI_CANT_DEFICIENCY_WAG } from '../core/tsi';
import { card, fmt, form, h, loadState, results, saveState, select, tsiBlock, type Module } from '../ui/dom';

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
    const opt = loadState<{ sportype: string; perron: string }>('radius-opt', { sportype: 'hovedspor', perron: 'nej' });
    const out = h('div', { class: 'out' });

    const update = () => {
      saveState('radius2', st);
      saveState('radius-opt', opt);
      const set = loadSettings();
      const LI = limitI(rs, st.V, set);
      const C = cantConstant(rs);
      const Rb = minRadius(st.V, st.h, st.I, rs);
      const HL = limitH(rs, { trafik: set.tsiTrafik });
      const mN = minRadiusMixed(st.V, st.Vmin, HL.normal, LI.normal, rs.overskydendeOverhoejdeMax.normal, rs);
      const mU = minRadiusMixed(st.V, st.Vmin, HL.undtagelse, LI.undtagelse, rs.overskydendeOverhoejdeMax.undtagelse, rs);
      const rk = radiusKrav(opt.sportype as Sportype, opt.perron === 'ja');
      const Rnorm = Math.max(mN.R, rk.normal), Rundt = Math.max(mU.R, rk.undtagelse);
      const hT = tsiCantMax(set.tsiTrafik, set.tsiSpor);
      const RtsiV = minRadius(st.V, hT, tsiCantDeficiency(st.V), rs);
      const tsiRows = set.tsi ? [
        { label: `Mindste radius efter TSI (h = ${hT}, I = ${tsiCantDeficiency(st.V)} mm)`, value: `${fmt(roundTo(RtsiV, 10, 'op'))} m`, graense: 'C·V²/(h<sub>max</sub> + I<sub>max</sub>)', status: 'ok' as const, kilde: `${TSI_KILDE} 4.2.4.2–4.2.4.3` },
        { label: 'Mindste radius, nye strækninger', value: `${fmt(roundTo(Math.max(mN.R, RtsiV), 10, 'op'))} m`, graense: `≥ ${TSI_R_MIN} m`, status: tsiStatus(Math.max(mN.R, RtsiV) >= TSI_R_MIN), kilde: `${TSI_KILDE} 4.2.3.4(1)` },
        { label: 'Valgt I mod TSI', value: `${fmt(st.I)} mm`, graense: `≤ ${tsiCantDeficiency(st.V)} mm (godsvogne ${TSI_CANT_DEFICIENCY_WAG} mm)`, status: tsiStatus(st.I <= tsiCantDeficiency(st.V)), kilde: `${TSI_KILDE} 4.2.4.3, tabel 8` },
      ] : [];
      const why = (m: typeof mN, R: number) =>
        R > m.R + 1e-9 ? `styret af sportypen (Sporregler 2.02)` : m.styrende === 'hastighed' ? 'styret af h<sub>max</sub> + I<sub>max</sub>' : m.styrende === 'afsporing' ? 'styret af afsporingskravet h ≤ (R − 50)/1,5 (formel 4a)' : 'styret af hastighedsspredningen V/V<sub>min</sub>';

      out.innerHTML = `
        <div class="summary summary-ok">
          <div><strong>Mindste radius (normal)</strong><span>${why(mN, Rnorm)} · ${SPORTYPE_TEKST[opt.sportype as Sportype]}${opt.perron === 'ja' ? ', perron på ny strækning' : ''}</span></div>
          <div class="summary-val">${fmt(roundTo(Rnorm, 10, 'op'))} m</div>
        </div>
        ${results([
          { symbol: 'R<sub>min</sub>', label: 'Med valgt h og I', value: fmt(roundTo(Rb, 10, 'op')), unit: 'm', big: true,
            sub: `R = ${fmt(C, 1)}·V² / (h + I) = ${fmt(Rb, 1)} m` },
          { symbol: 'R<sub>min,u</sub>', label: 'Undtagelse', value: fmt(roundTo(Rundt, 10, 'op')), unit: 'm', big: true,
            status: 'undtagelse', sub: `${why(mU, Rundt)} · h<sub>max</sub> = ${HL.undtagelse}, I<sub>max</sub> = ${LI.undtagelse} mm` },
          { symbol: 'R<sub>2.02</sub>', label: 'Radiuskrav efter sportype', value: `${Number.isFinite(rk.oensket) ? fmt(rk.oensket) : 'ret'} / ${fmt(rk.normal)} / ${fmt(rk.undtagelse)}`, unit: 'm', sub: 'ønsket / normal / undtagelse (Sporregler 2.02.2–2.02.4)' },
          { symbol: 'R<sub>4a</sub>', label: 'Krav fra afsporing (formel 4a)', value: fmt(mN.R4a, 0), unit: 'm', sub: 'C·V²/R − I ≤ (R − 50)/1,5' },
          { symbol: 'R<sub>V</sub>', label: 'Krav fra hastighed (normal)', value: fmt(mN.Rhast, 0), unit: 'm',
            sub: `h = ${HL.normal}, I = ${LI.normal} mm` },
          { symbol: 'R<sub>ΔV</sub>', label: 'Krav fra spredning (normal)', value: fmt(mN.Rspred, 0), unit: 'm',
            sub: `C·(V² − V<sub>min</sub>²) / (I + E)` },
        ])}
        <p class="tip">Ved blandet trafik skal én overhøjde give I ≤ I<sub>max</sub> for de hurtige tog og E ≤ E<sub>max</sub> for de langsomme.
        Sæt V<sub>min</sub> = V for ren persontrafik. Langskinnespor har desuden mindste radius efter overbygning, fx UIC60 Dmp 400 m og UIC60 Dt 700 m (BN1-66). Radier over ${fmt(rs.radiusRetSpor)} m regnes som ret spor.</p>
        ${Rnorm < 190 ? `<p class="tip">R < 190 m: sporet skal have sporudvidelse på ${sporudvidelse(Rnorm)} mm (Sporregler 2.12).</p>` : ''}
        <p class="tip">${rk.note} Overhøjde h<sub>max</sub> = ${HL.normal}/${HL.undtagelse} mm ved ${set.tsiTrafik === 'person' ? 'spor reserveret persontrafik' : 'blandet trafik'} (ændres under Regelgrundlag).</p>
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
          { label: 'Mindste radius (valgt h, I)', formel: 'R = C·V²/(h + I)', indsat: `${fmt(C, 1)}·${st.V}²/(${st.h} + ${st.I})`, resultat: `${fmt(Rb, 1)} m` },
          { label: 'Krav fra hastighed', formel: 'R<sub>V</sub> = C·V²/(h<sub>max</sub> + I<sub>max</sub>)', indsat: `${fmt(C, 1)}·${st.V}²/(${HL.normal} + ${LI.normal})`, resultat: `${fmt(mN.Rhast, 1)} m` },
          { label: 'Krav fra spredning', formel: 'R<sub>ΔV</sub> = C·(V² − V<sub>min</sub>²)/(I<sub>max</sub> + E<sub>max</sub>)', indsat: `${fmt(C, 1)}·(${st.V}² − ${st.Vmin}²)/(${LI.normal} + ${rs.overskydendeOverhoejdeMax.normal})`, resultat: `${fmt(mN.Rspred, 1)} m` },
          { label: 'Krav fra afsporing', formel: 'R² + (1,5·I − 50)·R − 1,5·C·V² = 0 (formel 4a)', indsat: `I = ${LI.normal}`, resultat: `${fmt(mN.R4a, 1)} m` },
          { label: 'Radiuskrav efter sportype', formel: 'Sporregler 2.02.3', indsat: SPORTYPE_TEKST[opt.sportype as Sportype], resultat: `${fmt(rk.normal)} m` },
          { label: 'Mindste radius, normal', formel: 'max(R<sub>V</sub>; R<sub>ΔV</sub>; R<sub>4a</sub>; R<sub>2.02</sub>)', indsat: '', resultat: `${fmt(Rnorm, 1)} m` },
          { label: 'Mindste radius, undtagelse', formel: 'som ovenfor med undtagelsesværdier', indsat: `h ${HL.undtagelse}, I ${LI.undtagelse}, E ${rs.overskydendeOverhoejdeMax.undtagelse}, R ≥ ${rk.undtagelse}`, resultat: `${fmt(Rundt, 1)} m` },
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
    f.append(
      select('Sportype', 'sportype', (Object.keys(SPORTYPE_TEKST) as Sportype[]).map((k) => [k, SPORTYPE_TEKST[k]]), opt, update),
      select('Spor langs perron på ny strækning', 'perron', [['nej', 'Nej'], ['ja', 'Ja – R ≥ 300 m']], opt, update),
    );
    root.append(h('div', { class: 'grid' }, card('Input', f, 'card-input'), card('Resultat', out, 'card-out')));
    update();
  },
};
