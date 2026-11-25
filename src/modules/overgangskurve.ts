import { BANEDANMARK as rs, vurder, samletStatus } from '../core/rules';
import { cantDeficiency, transitionLengths, clothoid, roundTo } from '../core/formulas';
import { card, chip, fmt, form, h, loadState, results, saveState, type Module } from '../ui/dom';

type S = { V: number; R: number; h: number; L: number };
const DEF: S = { V: 160, R: 1500, h: 100, L: 0 };

/** Diagram: krumning / overhøjde langs sporet (ligeud → overgangskurve → cirkelbue). */
function diagram(L: number, hmm: number, I: number): string {
  const x0 = 30, x1 = 110, x2 = 250, x3 = 300, yb = 120, yt = 40;
  const iy = yb - (yb - yt) * Math.min(1, Math.max(0, I) / Math.max(1, hmm + Math.max(0, I)));
  return `
  <svg viewBox="0 0 320 170" class="viz" role="img" aria-label="Overhøjde- og krumningsdiagram">
    <line x1="${x0}" y1="${yb}" x2="${x3}" y2="${yb}" class="axis"/>
    <polyline points="${x0},${yb} ${x1},${yb} ${x2},${yt} ${x3},${yt}" class="curve-h"/>
    <polyline points="${x0},${yb} ${x1},${yb} ${x2},${iy} ${x3},${iy}" class="curve-i"/>
    <line x1="${x1}" y1="${yb + 6}" x2="${x1}" y2="${yt - 18}" class="tick"/>
    <line x1="${x2}" y1="${yb + 6}" x2="${x2}" y2="${yt - 18}" class="tick"/>
    <text x="${(x0 + x1) / 2}" y="${yb + 22}" text-anchor="middle" class="lbl-svg muted">Ligeud</text>
    <text x="${(x1 + x2) / 2}" y="${yb + 22}" text-anchor="middle" class="lbl-svg">Overgangskurve L = ${fmt(L)} m</text>
    <text x="${(x2 + x3) / 2 + 5}" y="${yb + 22}" text-anchor="middle" class="lbl-svg muted">Bue R</text>
    <text x="${x2 + 4}" y="${yt - 6}" class="lbl-svg accent">h = ${fmt(hmm)}</text>
    <text x="${x2 + 4}" y="${iy + 14}" class="lbl-svg accent2">I = ${fmt(I)}</text>
    <text x="${x0}" y="22" class="lbl-svg muted">Overhøjde h og manglende overhøjde I [mm]</text>
  </svg>`;
}

export const overgangskurve: Module = {
  id: 'overgangskurve',
  titel: 'Overgangskurve',
  kort: 'Overgang',
  ikon: '∫',
  beskrivelse: 'Nødvendig længde af overgangskurve (klotoide med lineær overhøjderampe) og dens geometri.',
  render(root) {
    const st = loadState<S>('overgangskurve', DEF);
    const out = h('div', { class: 'out' });

    const update = () => {
      saveState('overgangskurve', st);
      const I = Math.max(0, cantDeficiency(st.V, st.R, st.h, rs));
      const krit = transitionLengths({ V: st.V, R: st.R, dh: st.h, dI: I }, rs);
      const Lnorm = Math.max(...krit.map((k) => k.normal));
      const Lundt = Math.max(...krit.map((k) => k.undtagelse));
      const styrende = krit.find((k) => k.normal === Lnorm)!;
      const Lforslag = roundTo(Lnorm, 5, 'op');
      const L = st.L > 0 ? st.L : Lforslag;
      const g = clothoid(st.R, L, st.h);

      const v = st.V / 3.6;
      const dhdt = (v * st.h) / L;
      const dIdt = (v * I) / L;
      const dhds = st.h / L;
      const sDh = vurder(dhdt, rs.dhdtMax);
      const sDi = vurder(dIdt, rs.dIdtMax);
      const sDs = vurder(dhds, rs.dhdsMax);
      const nKrav = rs.rampeFaktor.normal * st.V;
      const nUndt = rs.rampeFaktor.undtagelse * st.V;
      const sRampe = g.rampe >= nKrav - 1e-6 ? 'ok' : g.rampe >= nUndt - 1e-6 ? 'undtagelse' : 'overskredet';
      const total = samletStatus([sDh, sDi, sDs, sRampe]);

      out.innerHTML = `
        <div class="summary summary-${total}">
          <div><strong>Krævet længde</strong><span>Styrende: ${styrende.label.toLowerCase()}</span></div>
          <div class="summary-val">${fmt(Lforslag)} m</div>
        </div>
        <table class="tbl">
          <thead><tr><th>Kriterie</th><th>Normal</th><th>Undt.</th></tr></thead>
          <tbody>
            ${krit.map((k) => `
              <tr class="${k === styrende ? 'gov' : ''}">
                <td><div>${k.label}</div><small>${k.formel}</small></td>
                <td>${fmt(k.normal, 1)} m</td><td>${fmt(k.undtagelse, 1)} m</td>
              </tr>`).join('')}
            <tr class="sum"><td>Mindste længde</td><td>${fmt(Lnorm, 1)} m</td><td>${fmt(Lundt, 1)} m</td></tr>
          </tbody>
        </table>
        <h3>Kontrol af valgt længde L = ${fmt(L)} m ${st.L > 0 ? '' : '<small>(forslag)</small>'} ${chip(total)}</h3>
        ${results([
          { symbol: 'dh/dt', label: 'Overhøjdeændring', value: fmt(dhdt, 1), unit: 'mm/s', status: sDh,
            sub: `≤ ${rs.dhdtMax.normal} / ${rs.dhdtMax.undtagelse} mm/s` },
          { symbol: 'dI/dt', label: 'Ændring af manglende overhøjde', value: fmt(dIdt, 1), unit: 'mm/s', status: sDi,
            sub: `≤ ${rs.dIdtMax.normal} / ${rs.dIdtMax.undtagelse} mm/s` },
          { symbol: '1:n', label: 'Rampehældning', value: '1:' + fmt(g.rampe), unit: '', status: sRampe,
            sub: `krav 1:${fmt(nKrav)} (undt. 1:${fmt(nUndt)}), stejlest 1:400` },
          { symbol: 'I', label: 'Manglende overhøjde i buen', value: fmt(I), unit: 'mm' },
        ])}
        <h3>Klotoidens geometri</h3>
        ${results([
          { symbol: 'A', label: 'Klotoideparameter √(R·L)', value: fmt(g.A, 1), unit: 'm' },
          { symbol: 'p', label: 'Tilbageflytning (shift)', value: fmt(g.p * 1000, 0), unit: 'mm', sub: '≈ L²/24R' },
          { symbol: 'τ', label: 'Tangentvinkel', value: fmt((g.tau * 200) / Math.PI, 4), unit: 'gon',
            sub: `${fmt(g.tau, 5)} rad` },
          { symbol: 'X / Y', label: 'Slutpunkt', value: `${fmt(g.X, 2)} / ${fmt(g.Y, 3)}`, unit: 'm' },
          { symbol: 'X<sub>m</sub>', label: 'Cirkelcentrums abscisse', value: fmt(g.Xm, 2), unit: 'm', sub: '≈ L/2' },
        ])}
        ${diagram(L, st.h, I)}
      `;
    };

    const f = form<keyof S>(
      [
        { key: 'V', label: 'Hastighed', symbol: 'V', unit: 'km/t', min: 10, max: 300, step: 5 },
        { key: 'R', label: 'Radius i buen', symbol: 'R', unit: 'm', min: 150, max: 10000, step: 10 },
        { key: 'h', label: 'Overhøjde i buen', symbol: 'h', unit: 'mm', min: 0, max: 160, step: 5,
          hint: 'Rampe fra 0 mm på ligeud til h i buen.' },
        { key: 'L', label: 'Valgt længde (0 = forslag)', symbol: 'L', unit: 'm', min: 0, max: 400, step: 5 },
      ],
      st,
      update,
    );
    root.append(h('div', { class: 'grid' }, card('Input', f, 'card-input'), card('Resultat', out, 'card-out')));
    update();
  },
};
