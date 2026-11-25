import { BANEDANMARK as rs } from '../core/rules';
import { maxSpeed, roundTo, equilibriumCant } from '../core/formulas';
import { card, fmt, form, h, loadState, results, saveState, type Module } from '../ui/dom';

type S = { R: number; h: number; I: number };
const DEF: S = { R: 1000, h: 120, I: 100 };

/** Graf: V_max som funktion af R, med markør for valgt R. */
function chart(st: S): string {
  const W = 320, H = 190, l = 40, r = 22, t = 14, b = 30;
  const Rmax = Math.max(4000, st.R * 1.3);
  const Vtop = Math.max(250, maxSpeed(Rmax, rs.overhoejdeMax.undtagelse, rs.manglendeOverhoejdeMax.undtagelse, rs));
  const xs = (R: number) => l + ((W - l - r) * R) / Rmax;
  const ys = (V: number) => H - b - ((H - b - t) * V) / Vtop;
  const path = (hh: number, ii: number) =>
    Array.from({ length: 60 }, (_, k) => {
      const R = 100 + ((Rmax - 100) * k) / 59;
      return `${k ? 'L' : 'M'}${xs(R).toFixed(1)},${ys(maxSpeed(R, hh, ii, rs)).toFixed(1)}`;
    }).join(' ');
  const Vsel = maxSpeed(st.R, st.h, st.I, rs);
  const gridV = [50, 100, 150, 200, 250, 300].filter((v) => v <= Vtop);
  const gridR = [1000, 2000, 3000, 4000, 5000, 6000].filter((x) => x <= Rmax);
  return `
  <svg viewBox="0 0 ${W} ${H}" class="viz" role="img" aria-label="Største hastighed som funktion af radius">
    ${gridV.map((v) => `<line x1="${l}" x2="${W - r}" y1="${ys(v)}" y2="${ys(v)}" class="grid-l"/><text x="${l - 6}" y="${ys(v) + 4}" text-anchor="end" class="lbl-svg muted">${v}</text>`).join('')}
    ${gridR.map((x) => `<text x="${xs(x)}" y="${H - b + 16}" text-anchor="middle" class="lbl-svg muted">${x}</text>`).join('')}
    <line x1="${l}" y1="${H - b}" x2="${W - r}" y2="${H - b}" class="axis"/>
    <path d="${path(rs.overhoejdeMax.undtagelse, rs.manglendeOverhoejdeMax.undtagelse)}" class="curve-u"/>
    <path d="${path(rs.overhoejdeMax.normal, rs.manglendeOverhoejdeMax.normal)}" class="curve-n"/>
    <path d="${path(st.h, st.I)}" class="curve-sel"/>
    <line x1="${xs(st.R)}" x2="${xs(st.R)}" y1="${ys(Vsel)}" y2="${H - b}" class="tick"/>
    <circle cx="${xs(st.R)}" cy="${ys(Vsel)}" r="5" class="dot"/>
    <text x="${l}" y="${t - 2}" class="lbl-svg muted">V [km/t]</text>
    <text x="${W - r}" y="${H - 2}" text-anchor="end" class="lbl-svg muted">R [m]</text>
  </svg>
  <div class="legend"><span class="lg lg-sel">Valgt h, I</span><span class="lg lg-n">Normal maks</span><span class="lg lg-u">Undtagelse</span></div>`;
}

export const hastighed: Module = {
  id: 'hastighed',
  titel: 'Største hastighed',
  kort: 'Hastighed',
  ikon: '➤',
  beskrivelse: 'Største tilladte hastighed i en kurve ud fra radius, overhøjde og tilladt manglende overhøjde.',
  render(root) {
    const st = loadState<S>('hastighed', DEF);
    const out = h('div', { class: 'out' });

    const update = () => {
      saveState('hastighed', st);
      const V = maxSpeed(st.R, st.h, st.I, rs);
      const Vn = maxSpeed(st.R, Math.min(st.h, rs.overhoejdeMax.normal), rs.manglendeOverhoejdeMax.normal, rs);
      const Vu = maxSpeed(st.R, Math.min(st.h, rs.overhoejdeMax.undtagelse), rs.manglendeOverhoejdeMax.undtagelse, rs);
      const Vmaxh = maxSpeed(st.R, rs.overhoejdeMax.normal, rs.manglendeOverhoejdeMax.normal, rs);
      out.innerHTML = `
        <div class="summary summary-ok">
          <div><strong>Største hastighed</strong><span>afrundet ned til 5 km/t</span></div>
          <div class="summary-val">${fmt(roundTo(V, 5, 'ned'))} km/t</div>
        </div>
        ${results([
          { symbol: 'V', label: 'Beregnet (valgt h og I)', value: fmt(V, 1), unit: 'km/t', big: true,
            sub: 'V = √(R·(h + I) / 11,8)' },
          { symbol: 'V<sub>n</sub>', label: `Normal (I = ${rs.manglendeOverhoejdeMax.normal} mm)`, value: fmt(roundTo(Vn, 5, 'ned')), unit: 'km/t', status: 'ok' },
          { symbol: 'V<sub>u</sub>', label: `Undtagelse (I = ${rs.manglendeOverhoejdeMax.undtagelse} mm)`, value: fmt(roundTo(Vu, 5, 'ned')), unit: 'km/t', status: 'undtagelse' },
          { symbol: 'V<sub>h,max</sub>', label: `Hvis h øges til ${rs.overhoejdeMax.normal} mm`, value: fmt(roundTo(Vmaxh, 5, 'ned')), unit: 'km/t' },
          { symbol: 'h<sub>eq</sub>', label: 'Ligevægtsoverhøjde ved V', value: fmt(equilibriumCant(roundTo(V, 5, 'ned'), st.R, rs)), unit: 'mm' },
        ])}
        ${chart(st)}
      `;
    };

    const f = form<keyof S>(
      [
        { key: 'R', label: 'Kurveradius', symbol: 'R', unit: 'm', min: 150, max: 10000, step: 10 },
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
