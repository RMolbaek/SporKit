import { BANEDANMARK as rs, type Limit } from '../core/rules';
import { cantConstant } from '../core/formulas';
import { card, fmt, h, type Module } from '../ui/dom';

export const regler: Module = {
  id: 'regler',
  titel: 'Regelgrundlag',
  kort: 'Regler',
  ikon: '§',
  beskrivelse: 'De grænseværdier og konstanter SporKit regner med.',
  render(root) {
    const limits: Limit[] = [
      rs.overhoejdeMax, rs.manglendeOverhoejdeMax, rs.overskydendeOverhoejdeMax,
      rs.dhdtMax, rs.dIdtMax, rs.dhdsMax, rs.rampeFaktor,
    ];
    const body = `
      <div class="notice">
        <strong>Bemærk:</strong> Værdierne er et arbejdsgrundlag og er endnu ikke verificeret mod den gældende
        udgave af Banedanmarks sporregler. SporKit er et hjælpeværktøj og erstatter ikke projektering efter
        gældende banenormer.
      </div>
      <table class="tbl">
        <thead><tr><th>Parameter</th><th>Normal</th><th>Undt.</th><th></th></tr></thead>
        <tbody>${limits.map((l) => `
          <tr><td><div>${l.label}</div><small>${l.note}</small></td>
          <td>${fmt(l.normal, l.normal % 1 ? 1 : 0)} ${l.unit}</td>
          <td>${fmt(l.undtagelse, l.undtagelse % 1 ? 1 : 0)} ${l.unit}</td>
          <td>${l.verificeret ? '<span class="chip chip-ok">Verificeret</span>' : '<span class="chip chip-undtagelse">Ikke verificeret</span>'}</td></tr>`).join('')}
        </tbody>
      </table>
      <h3>Konstanter</h3>
      <ul class="consts">
        <li>Sporvidde: <strong>${rs.sporvidde} mm</strong></li>
        <li>Kontaktpunktsafstand e: <strong>${rs.kontaktafstand} mm</strong></li>
        <li>g = <strong>${rs.g} m/s²</strong></li>
        <li>C = e / (g·3,6²) = <strong>${fmt(cantConstant(rs), 3)}</strong> → h<sub>eq</sub> = C·V²/R</li>
      </ul>
      <h3>Status</h3>
      <ul class="consts">
        <li><span class="chip chip-ok">OK</span> inden for normalværdien</li>
        <li><span class="chip chip-undtagelse">Undtagelse</span> over normal, men inden for undtagelsesværdien (kræver godkendelse)</li>
        <li><span class="chip chip-overskredet">Overskredet</span> over undtagelsesværdien</li>
      </ul>`;
    root.append(h('div', { class: 'grid grid-1' }, card(rs.navn, body)));
  },
};
