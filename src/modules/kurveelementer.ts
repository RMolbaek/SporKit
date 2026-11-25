import { curveElements } from '../core/formulas';
import { setReport } from '../core/report';
import { card, fmt, form, h, loadState, results, saveState, type Module } from '../ui/dom';

type S = { R: number; alpha: number; L: number };
const DEF: S = { R: 1200, alpha: 25, L: 120 };

function sketch(k: ReturnType<typeof curveElements>, R: number, L: number): string {
  // Skitse i ikke-målfast skala: tangenter, overgangskurver og bue
  const W = 320, H = 180;
  const a = k.alpha;
  const cx = W / 2, top = 30;
  const t = 120;
  const p1 = { x: cx - t * Math.cos(a / 2), y: top + t * Math.sin(a / 2) };
  const p2 = { x: cx + t * Math.cos(a / 2), y: top + t * Math.sin(a / 2) };
  const mid = { x: cx, y: top + Math.min(70, 20 + (k.E / Math.max(1, R)) * 900) };
  return `
  <svg viewBox="0 0 ${W} ${H}" class="viz" role="img" aria-label="Skitse af kurveelementer">
    <line x1="${p1.x - 40 * Math.cos(a / 2)}" y1="${p1.y + 40 * Math.sin(a / 2)}" x2="${cx}" y2="${top}" class="tick"/>
    <line x1="${cx}" y1="${top}" x2="${p2.x + 40 * Math.cos(a / 2)}" y2="${p2.y + 40 * Math.sin(a / 2)}" class="tick"/>
    <path d="M ${p1.x - 40 * Math.cos(a / 2)},${p1.y + 40 * Math.sin(a / 2)} L ${p1.x},${p1.y} Q ${cx},${mid.y + (mid.y - top) * 0.6} ${p2.x},${p2.y} L ${p2.x + 40 * Math.cos(a / 2)},${p2.y + 40 * Math.sin(a / 2)}" class="curve-sel"/>
    <circle cx="${cx}" cy="${top}" r="3.5" class="dot"/>
    <text x="${cx}" y="${top - 8}" text-anchor="middle" class="lbl-svg">TS · α = ${fmt((a * 200) / Math.PI, 3)} gon</text>
    <line x1="${cx}" y1="${top}" x2="${cx}" y2="${mid.y + 10}" class="dim"/>
    <text x="${cx + 6}" y="${(top + mid.y) / 2 + 14}" class="lbl-svg accent2">E = ${fmt(k.E, 2)} m</text>
    <circle cx="${p1.x}" cy="${p1.y}" r="3" class="dot"/><circle cx="${p2.x}" cy="${p2.y}" r="3" class="dot"/>
    <text x="${p1.x - 6}" y="${p1.y - 8}" text-anchor="end" class="lbl-svg muted">${L > 0 ? 'OB' : 'BB'}</text>
    <text x="${p2.x + 6}" y="${p2.y - 8}" class="lbl-svg muted">${L > 0 ? 'OE' : 'BE'}</text>
    <text x="${W / 2}" y="${H - 10}" text-anchor="middle" class="lbl-svg muted">T = ${fmt(k.T, 2)} m · L<sub>tot</sub> = ${fmt(k.Ltot, 2)} m · ikke målfast</text>
  </svg>`;
}

export const kurveelementer: Module = {
  id: 'kurveelementer',
  gruppe: 'Linjeføring',
  titel: 'Kurveelementer',
  kort: 'Elementer',
  ikon: '∠',
  beskrivelse: 'Tangentlængde, buelængde og toppunktsafstand for en symmetrisk kurve med overgangskurver (klotoider).',
  render(root) {
    const st = loadState<S>('kurveelementer', DEF);
    const out = h('div', { class: 'out' });
    const update = () => {
      saveState('kurveelementer', st);
      const k = curveElements(st.R, st.alpha, st.L);
      const fig = sketch(k, st.R, st.L);
      out.innerHTML = `
        ${k.umulig ? `<div class="summary summary-overskredet"><div><strong>Overgangskurverne er for lange</strong><span>2τ > α – vinklen kan ikke rumme to overgangskurver af ${fmt(st.L)} m</span></div></div>` : ''}
        ${results([
          { symbol: 'T', label: 'Tangentlængde TS → OB', value: fmt(k.T, 3), unit: 'm', big: true, sub: 'T = (R + p)·tan(α/2) + X<sub>m</sub>' },
          { symbol: 'L<sub>c</sub>', label: 'Cirkelbuens længde', value: fmt(k.Lc, 3), unit: 'm', big: true, sub: 'L<sub>c</sub> = R·(α − 2τ)' },
          { symbol: 'L<sub>tot</sub>', label: 'Samlet kurvelængde', value: fmt(k.Ltot, 3), unit: 'm', sub: 'L<sub>c</sub> + 2L' },
          { symbol: 'E', label: 'Afstand TS → kurvemidte', value: fmt(k.E, 3), unit: 'm', sub: 'E = (R + p)/cos(α/2) − R' },
          { symbol: 'p', label: 'Tilbageflytning', value: fmt(k.p * 1000, 0), unit: 'mm' },
          { symbol: 'X<sub>m</sub>', label: 'Abscisse for cirkelcentrum', value: fmt(k.Xm, 3), unit: 'm' },
        ])}
        ${fig}
        <p class="tip">Vinkel i gon (400 gon = 360°). Sæt L = 0 for en ren cirkelbue. Kontrollér overgangskurvens længde i modulet «Overgang».</p>
      `;
      setReport({
        modul: 'Kurveelementer',
        inputs: [
          { label: 'Radius', symbol: 'R', value: fmt(st.R), unit: 'm' },
          { label: 'Retningsændring', symbol: 'α', value: fmt(st.alpha, 4), unit: 'gon' },
          { label: 'Overgangskurvelængde', symbol: 'L', value: fmt(st.L), unit: 'm' },
        ],
        steps: [
          { label: 'Vinkel i radianer', formel: 'α = α<sub>gon</sub>·π/200', indsat: `${fmt(st.alpha, 4)}·π/200`, resultat: `${fmt(k.alpha, 6)} rad` },
          { label: 'Tangentvinkel', formel: 'τ = L/(2R)', indsat: `${fmt(st.L)}/(2·${fmt(st.R)})`, resultat: `${fmt(k.tau, 6)} rad` },
          { label: 'Tilbageflytning', formel: 'p = Y − R(1 − cos τ)', indsat: '', resultat: `${fmt(k.p, 4)} m` },
          { label: 'Centrums abscisse', formel: 'X<sub>m</sub> = X − R·sin τ', indsat: '', resultat: `${fmt(k.Xm, 4)} m` },
          { label: 'Tangentlængde', formel: 'T = (R + p)·tan(α/2) + X<sub>m</sub>', indsat: `(${fmt(st.R)} + ${fmt(k.p, 4)})·tan(${fmt(k.alpha / 2, 6)}) + ${fmt(k.Xm, 4)}`, resultat: `${fmt(k.T, 3)} m` },
          { label: 'Buelængde', formel: 'L<sub>c</sub> = R·(α − 2τ)', indsat: `${fmt(st.R)}·(${fmt(k.alpha, 6)} − 2·${fmt(k.tau, 6)})`, resultat: `${fmt(k.Lc, 3)} m` },
          { label: 'Samlet længde', formel: 'L<sub>tot</sub> = L<sub>c</sub> + 2L', indsat: `${fmt(k.Lc, 3)} + 2·${fmt(st.L)}`, resultat: `${fmt(k.Ltot, 3)} m` },
          { label: 'Toppunktsafstand', formel: 'E = (R + p)/cos(α/2) − R', indsat: `(${fmt(st.R)} + ${fmt(k.p, 4)})/cos(${fmt(k.alpha / 2, 6)}) − ${fmt(st.R)}`, resultat: `${fmt(k.E, 3)} m` },
        ],
        checks: [],
        noter: k.umulig ? ['Overgangskurverne er for lange til retningsændringen (L<sub>c</sub> < 0).'] : [],
        refs: ['SR87', 'ST16', 'BN2-93'],
        figur: fig,
      });
    };
    const f = form<keyof S>([
      { key: 'R', label: 'Radius', symbol: 'R', unit: 'm', min: 150, max: 10000, step: 10 },
      { key: 'alpha', label: 'Retningsændring', symbol: 'α', unit: 'gon', min: 0.5, max: 200, step: 0.5 },
      { key: 'L', label: 'Overgangskurvelængde (begge sider)', symbol: 'L', unit: 'm', min: 0, max: 400, step: 5 },
    ], st, update);
    root.append(h('div', { class: 'grid' }, card('Input', f, 'card-input'), card('Resultat', out, 'card-out')));
    update();
  },
};
