import { BANEDANMARK as rs, type Limit, loadSettings, saveSettings } from '../core/rules';
import { cantConstant } from '../core/formulas';
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
      tsi: set.tsi ? 'ja' : 'nej', trafik: set.tsiTrafik as string, spor: set.tsiSpor as string, ny: set.nyStraekning ? 'ja' : 'nej',
    };
    const limits: Limit[] = [
      rs.overhoejdeMax, rs.manglendeOverhoejdeMax, rs.manglendeOverhoejdeSporskifte, rs.overskydendeOverhoejdeMax,
      rs.dhdtMax, rs.dIdtMax, rs.dhdsMax, rs.rampeFaktor,
      rs.stigningMax, rs.stigningPerron, rs.lodretRadiusMin, rs.lodretRadiusMax, rs.lodretAccMax,
    ];
    const save = () => {
      saveSettings({
        skinne: st.skinne as '60E2' | 'DSB45', saerligeTogsaet: st.saerlige === 'ja',
        tsi: st.tsi === 'ja', tsiTrafik: st.trafik as 'blandet' | 'person', tsiSpor: st.spor as 'ballast' | 'fast', nyStraekning: st.ny === 'ja',
      });
    };
    const settings = h('div', { class: 'fields' },
      select('Skinneprofil', 'skinne', [['60E2', '60E2 / DSB60 (A ≤ 22,5 t)'], ['DSB45', 'DSB45 (45E2)']], st, save),
      select('Særlige togsæt (I ≤ 160 mm)', 'saerlige', [['nej', 'Nej'], ['ja', 'Ja']], st, save),
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
          <td>${kildeChip(l)}<br/><small>${l.kilde.join('<br/>')}</small></td></tr>`).join('')}
        </tbody>
      </table>
      <h3>Konstanter</h3>
      <ul class="consts">
        <li>Sporvidde: <strong>${rs.sporvidde} mm</strong> (S16: 1437 mm; målt 14 mm under SO)</li>
        <li>Afstand mellem kontaktpunkter e: <strong>${rs.kontaktafstand} mm</strong></li>
        <li>g = <strong>${rs.g} m/s²</strong> · 1,0 m/s² svarer til <strong>153 mm</strong> overhøjde</li>
        <li>C = e / (g·3,6²) = <strong>${fmt(cantConstant(rs), 3)}</strong> → h<sub>a</sub> = C·V²/R</li>
        <li>Radier over <strong>${fmt(rs.radiusRetSpor)} m</strong> regnes som ret spor</li>
      </ul>
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
