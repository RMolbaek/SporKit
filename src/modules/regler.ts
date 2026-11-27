import { BANEDANMARK as rs, type Limit, loadSettings, saveSettings, SPORUDVIDELSE } from '../core/rules';
import { cantConstant } from '../core/formulas';
import { harAabenKilde } from '../core/references';
import { setReport } from '../core/report';
import { card, fmt, h, kildeChip, select, type Module } from '../ui/dom';

export const regler: Module = {
  id: 'regler',
  gruppe: 'Grundlag',
  titel: 'Regelgrundlag',
  kort: 'Regler',
  ikon: '§',
  beskrivelse: 'Grænseværdier, konstanter og indstillinger, som SporKit regner med – med kilde og kildestatus.',
  render(root) {
    const set = loadSettings();
    const st = {
      skinne: set.skinne as string, saerlige: set.saerligeTogsaet ? 'ja' : 'nej',
      tsi: set.tsi ? 'ja' : 'nej', sv: String(set.sporvidde), trafik: set.tsiTrafik as string, spor: set.tsiSpor as string, ny: set.nyStraekning ? 'ja' : 'nej',
    };
    const limits: Limit[] = [
      rs.overhoejdeMax, rs.manglendeOverhoejdeMax, rs.manglendeOverhoejdeSporskifte, rs.overskydendeOverhoejdeMax,
      rs.dhdtMax, rs.dIdtMax, rs.dhdsMax, rs.rampeFaktor,
      rs.stigningMax, rs.stigningPerron, rs.lodretRadiusMin, rs.lodretRadiusMax, rs.lodretAccMax,
    ];
    const save = () => {
      saveSettings({
        skinne: st.skinne as '60E2' | 'DSB45', saerligeTogsaet: st.saerlige === 'ja',
        tsi: st.tsi === 'ja', tsiTrafik: st.trafik as 'blandet' | 'person', tsiSpor: st.spor as 'ballast' | 'fast', nyStraekning: st.ny === 'ja', sporvidde: st.sv === '1437' ? 1437 : 1435,
      });
    };
    const settings = h('div', { class: 'fields' },
      select('Skinneprofil', 'skinne', [['60E2', '60E2 / DSB60 (A ≤ 22,5 t)'], ['DSB45', 'DSB45 (45E2)']], st, save),
      select('Særlige togsæt (I ≤ 160 mm)', 'saerlige', [['nej', 'Nej'], ['ja', 'Ja']], st, save),
      select('Projekteret sporvidde (ret spor og R ≥ 190 m)', 'sv', [['1437', '1437 mm – krav for sveller (Sporregler 2.12.1)'], ['1435', '1435 mm – sveller lagt før 1. juni 2021']], st, save),
      h('div', { class: 'settings-sep' }, 'TSI INF'),
      select('Kontrollér også mod TSI INF', 'tsi', [['ja', 'Ja'], ['nej', 'Nej']], st, save),
      select('Trafik (TSI tabel 7)', 'trafik', [['blandet', 'Blandet trafik / gods'], ['person', 'Ren persontrafik']], st, save),
      select('Sporkonstruktion', 'spor', [['ballast', 'Ballasteret spor'], ['fast', 'Fast spor (ikke ballasteret)']], st, save),
      select('Nyanlæg (krav til nye strækninger)', 'ny', [['nej', 'Nej – eksisterende spor'], ['ja', 'Ja – ny strækning']], st, save),
    );
    const body = `
      <div class="notice">
        <strong>Kildestatus:</strong> <span class="chip chip-ok">Verificeret</span> kontrolleret i gældende regelsæt ·
        <span class="chip chip-info">Sekundær kilde</span> gengivet fra Banedanmarks lærebog <i>Sporteknik</i> (2016), som citerer Sporregler ·
        <span class="chip chip-undtagelse">Antaget</span> ingen dansk kilde fundet – skal kontrolleres.
      </div>
      <table class="tbl">
        <thead><tr><th>Parameter</th><th>Normal</th><th>Undt.</th><th>Kilde</th></tr></thead>
        <tbody>${limits.map((l) => `
          <tr><td><div>${l.label}</div><small>${l.note}</small></td>
          <td>${fmt(l.normal, l.normal % 1 ? 1 : 0)} ${l.unit}</td>
          <td>${fmt(l.undtagelse, l.undtagelse % 1 ? 1 : 0)} ${l.unit}</td>
          <td>${kildeChip(l)} ${harAabenKilde(l.kilde) ? '<span class="chip chip-ok">Åben kilde</span>' : '<span class="chip chip-overskredet">Ingen åben kilde</span>'}<br/><small>${l.kilde.join('<br/>')}</small></td></tr>`).join('')}
        </tbody>
      </table>
      <h3>Konstanter</h3>
      <ul class="consts">
        <li>Sporvidde: nominel <strong>${rs.sporvidde} mm</strong>, projekteret for sveller <strong>1437 mm</strong> (1435 mm tilladt frem til 31.05.2021); målt 14 mm under SO (Sporregler 2.12.1)</li>
        <li>Afstand mellem kontaktpunkter e: <strong>${rs.kontaktafstand} mm</strong> · konstant C = <strong>11,8</strong> i h<sub>a</sub> = 11,8·V²/R (Sporregler formel 1; e/(g·3,6²) = 11,798)</li>
        <li>Afsporingskrav: h ≤ (R − 50)/1,5 skal altid overholdes (formel 4a); ønskelig overhøjde h = 8·V²/R ≤ 115 mm (formel 4)</li>
        <li>Overhøjde efter situation: sporskifter 120/160 mm, grusballast 80 mm, langs perroner 60/110 mm, undtagelse 180 mm kun for spor reserveret persontrafik (2.03.4–2.03.5); krumme sporskifter I ≤ 100/80 mm (2.03.6); overkørsler h ≤ 40 mm på ret spor (2.03.8)</li>
        <li>Mindste radius: hovedspor 700/300/150 m, øvrige togvejsspor 500/190/150 m, sidespor 190 m, firma- og havnespor 150 m, perronspor på nye strækninger ret/300 m (ønsket/normal/undtagelse, 2.02.2–2.02.4)</li>
        <li>Retlinet mellemstykke mellem kurver med separate overgangskurver: L<sub>s</sub> ≥ 0,40·V / 0,25·V (min. 20 m) / 0,20·V (ønsket/normal/undtagelse, V ≤ 200; 2.08.2–2.08.4)</li>
        <li>Fiktivt ryk ved spring uden overgangskurve: ΔI·V/(3,6·20) ≤ 28 / 135 mm/s i hovedspor, 71 mm/s i øvrige spor; ΔI ≤ 125 mm (2.05.2–2.05.3, tillæg 2C)</li>
        <li>g = <strong>${rs.g} m/s²</strong> · 1,0 m/s² svarer til <strong>153 mm</strong> overhøjde</li>
        <li>C = e / (g·3,6²) = <strong>${fmt(cantConstant(rs), 3)}</strong> → h<sub>a</sub> = C·V²/R</li>
        <li>Radier over <strong>${fmt(rs.radiusRetSpor)} m</strong> regnes som ret spor</li>
      </ul>
      <h3>Sporudvidelse (Sporregler afsn. 2.12)</h3>
      <table class="tbl tbl-mini"><thead><tr><th>Radius [m]</th><th>Sporudvidelse [mm]</th><th>Projekteret sporvidde [mm]</th></tr></thead>
        <tbody>${SPORUDVIDELSE.map((x) => `<tr><td>${x.til === Infinity ? `R ≥ ${x.fra}` : x.fra === 0 ? `R < ${x.til}` : `${x.fra} ≤ R < ${x.til}`}</td><td>+${x.mm}</td><td>${x.mm ? 1435 + x.mm : '1435 / 1437'}</td></tr>`).join('')}</tbody></table>
      <p class="tip">Sporregler 2.12.2, figur 4 (verificeret). Sporudvidelsen skal være fuldt til stede ved cirkelbuens startpunkt og tiltage jævnt over overgangskurven; uden overgangskurve etableres den normalt med 2,5 mm pr. 5 sveller (undtagelsesvis 5 mm pr. 5 sveller). Ingen sporudvidelse i spor med rilleskinner; sporskifter efter normaltegningerne.</p>
      <h3>Status i beregningerne</h3>
      <ul class="consts">
        <li><span class="chip chip-ok">OK</span> inden for normalbestemmelsen</li>
        <li><span class="chip chip-undtagelse">Undtagelse</span> inden for undtagelsesbestemmelsen (kræver dispensation)</li>
        <li><span class="chip chip-overskredet">Overskredet</span> over undtagelsesbestemmelsen</li>
      </ul>`;
    root.append(h('div', { class: 'grid' }, card('Indstillinger', settings, 'card-input'), card(rs.navn, body, 'card-out')));
    setReport({
      modul: 'Regelgrundlag',
      inputs: [],
      steps: limits.map((l) => ({ label: l.label, formel: l.note, indsat: l.kilde.join(', '), resultat: `${fmt(l.normal, l.normal % 1 ? 1 : 0)} / ${fmt(l.undtagelse, l.undtagelse % 1 ? 1 : 0)} ${l.unit}` })),
      checks: [],
      refs: [...new Set(limits.flatMap((l) => l.kilde.map((k) => k.split(' ')[0])))],
    });
  },
};
