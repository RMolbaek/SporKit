import { BANEDANMARK as rs, limitI, loadSettings, iUndtagelse, limitH, hMaxAfsporing } from '../core/rules';
import { setReport } from '../core/report';
import { tsiCantDeficiency, tsiCantMax, tsiStatus, TSI_KILDE } from '../core/tsi';
import { maxSpeed, roundTo, equilibriumCant, cantConstant } from '../core/formulas';
import { card, fmt, form, h, loadState, results, saveState, tsiBlock, type Module } from '../ui/dom';

type S = { R: number; h: number; I: number };
const DEF: S = { R: 1000, h: 120, I: 100 };

/** Graf: V_max som funktion af R, med markør for valgt R. */
function chart(st: S): string {
  const W = 320, H = 190, l = 40, r = 22, t = 14, b = 30;
  const Rmax = Math.max(4000, st.R * 1.3);
  const Iu = limitI(rs, 200, loadSettings()).undtagelse;
  const Vtop = Math.max(250, maxSpeed(Rmax, rs.overhoejdeMax.undtagelse, Iu, rs));
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
    <path d="${path(rs.overhoejdeMax.undtagelse, Iu)}" class="curve-u"/>
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
  gruppe: 'Linjeføring',
  titel: 'Største hastighed',
  kort: 'Hastighed',
  ikon: '➤',
  beskrivelse: 'Største tilladte hastighed i en kurve ud fra radius, overhøjde og tilladt overhøjdeunderskud (Sporregler afsn. 2.04).',
  render(root) {
    const st = loadState<S>('hastighed', DEF);
    const out = h('div', { class: 'out' });

    const update = () => {
      saveState('hastighed', st);
      const set = loadSettings();
      const V = maxSpeed(st.R, st.h, st.I, rs);
      const HL = limitH(rs, { trafik: set.tsiTrafik });
      const h4a = hMaxAfsporing(st.R);
      const Voen = Math.sqrt((Math.min(st.h, 115) * st.R) / 8); // formel (12)
      const Vn = maxSpeed(st.R, Math.min(st.h, HL.normal, h4a), rs.manglendeOverhoejdeMax.normal, rs);
      // Undtagelsesværdien for I afhænger af V: prøv 153 mm (V > 140) og fald tilbage til 130 mm
      let Iu = iUndtagelse(250, set);
      let Vu = maxSpeed(st.R, Math.min(st.h, HL.undtagelse, h4a), Iu, rs);
      if (Vu <= 140 || iUndtagelse(Vu, set) !== Iu) { Iu = iUndtagelse(Math.min(Vu, 140), set); Vu = maxSpeed(st.R, Math.min(st.h, HL.undtagelse, h4a), Iu, rs); }
      const C = cantConstant(rs);
      const hT = Math.min(st.h, tsiCantMax(set.tsiTrafik, set.tsiSpor));
      let Vtsi = maxSpeed(st.R, hT, tsiCantDeficiency(300), rs);
      if (Vtsi > 300) Vtsi = Math.max(300, maxSpeed(st.R, hT, tsiCantDeficiency(301), rs));
      const tsiRows = set.tsi ? [
        { label: 'Overhøjdeunderskud ved valgt I', value: `${fmt(st.I)} mm`, graense: `≤ ${tsiCantDeficiency(V)} mm`, status: tsiStatus(st.I <= tsiCantDeficiency(V)), kilde: `${TSI_KILDE} 4.2.4.3, tabel 8` },
        { label: 'Overhøjde', value: `${fmt(st.h)} mm`, graense: `≤ ${tsiCantMax(set.tsiTrafik, set.tsiSpor)} mm`, status: tsiStatus(st.h <= tsiCantMax(set.tsiTrafik, set.tsiSpor)), kilde: `${TSI_KILDE} 4.2.4.2, tabel 7` },
        { label: `Største hastighed efter TSI (I = ${tsiCantDeficiency(Vtsi)} mm)`, value: `${fmt(Math.floor(Vtsi / 5) * 5)} km/t`, graense: `beregnet ${fmt(Vtsi, 1)} km/t`, status: 'ok' as const, kilde: `${TSI_KILDE} 4.2.4.3` },
      ] : [];
      const hMaxMulig = Math.min(HL.normal, h4a);
      const Vmaxh = maxSpeed(st.R, hMaxMulig, rs.manglendeOverhoejdeMax.normal, rs);
      out.innerHTML = `
        <div class="summary summary-ok">
          <div><strong>Største hastighed</strong><span>afrundet ned til 5 km/t</span></div>
          <div class="summary-val">${fmt(roundTo(V, 5, 'ned'))} km/t</div>
        </div>
        ${results([
          { symbol: 'V', label: 'Beregnet (valgt h og I)', value: fmt(V, 1), unit: 'km/t', big: true,
            sub: `V = √(R·(h + I) / ${fmt(C, 1)})` },
          { symbol: 'V<sub>n</sub>', label: `Normal (I = ${rs.manglendeOverhoejdeMax.normal} mm)`, value: fmt(roundTo(Vn, 5, 'ned')), unit: 'km/t', status: 'ok' },
          { symbol: 'V<sub>u</sub>', label: `Undtagelse (I = ${Iu} mm)`, value: fmt(roundTo(Vu, 5, 'ned')), unit: 'km/t', status: 'undtagelse' },
          { symbol: 'V<sub>ø</sub>', label: 'Ønskelig hastighed (formel 12)', value: fmt(roundTo(Voen, 5, 'ned')), unit: 'km/t', sub: 'V = √(h·R/8)' },
          { symbol: 'V<sub>h,max</sub>', label: `Hvis h øges til ${fmt(Math.floor(hMaxMulig))} mm (I = 100)`, value: fmt(roundTo(Vmaxh, 5, 'ned')), unit: 'km/t' },
          { symbol: 'h<sub>eq</sub>', label: 'Afbalanceret overhøjde ved V', value: fmt(equilibriumCant(roundTo(V, 5, 'ned'), st.R, rs)), unit: 'mm' },
        ])}
        ${tsiBlock(tsiRows, 'TSI tillader I ≤ 153 mm for materiel efter TSI LOC&PAS (V ≤ 300 km/t). Banedanmarks normalbestemmelse er 100 mm, så den danske grænse er normalt den styrende.')}
        ${chart(st)}
      `;
      const LIu = limitI(rs, V, set);
      setReport({
        modul: 'Største hastighed',
        inputs: [
          { label: 'Kurveradius', symbol: 'R', value: fmt(st.R), unit: 'm' },
          { label: 'Overhøjde', symbol: 'h', value: fmt(st.h), unit: 'mm' },
          { label: 'Tilladt overhøjdeunderskud', symbol: 'I', value: fmt(st.I), unit: 'mm' },
        ],
        steps: [
          { label: 'Største hastighed', formel: 'V = √(R·(h + I)/C)', indsat: `√(${fmt(st.R)}·(${st.h} + ${st.I})/${fmt(C, 1)})`, resultat: `${fmt(V, 1)} km/t` },
          { label: 'Afrundet ned til 5 km/t', formel: '', indsat: '', resultat: `${fmt(roundTo(V, 5, 'ned'))} km/t` },
          { label: 'Normal (I = 100 mm)', formel: 'V = √(R·(h + 100)/C) (formel 13)', indsat: `√(${fmt(st.R)}·(${fmt(Math.min(st.h, HL.normal, h4a), 1)} + 100)/${fmt(C, 1)})`, resultat: `${fmt(Vn, 1)} km/t` },
          { label: 'Ønskelig hastighed', formel: 'V = √(h·R/8) (formel 12)', indsat: `√(${fmt(Math.min(st.h, 115))}·${fmt(st.R)}/8)`, resultat: `${fmt(Voen, 1)} km/t` },
          { label: `Undtagelse (I = ${Iu} mm)`, formel: `V = √(R·(h + ${Iu})/C)`, indsat: `√(${fmt(st.R)}·(${fmt(Math.min(st.h, HL.undtagelse, h4a), 1)} + ${Iu})/${fmt(C, 1)})`, resultat: `${fmt(Vu, 1)} km/t` },
        ],
        checks: [
          { label: 'Valgt I mod grænse', value: `${fmt(st.I)} mm`, graense: `≤ ${LIu.normal} / ${LIu.undtagelse} mm`, status: st.I <= LIu.normal ? 'ok' : st.I <= LIu.undtagelse ? 'undtagelse' : 'overskredet', kilde: 'SR87 afsn. 2.03.4–2.03.5' },
          { label: 'Overhøjde h', value: `${fmt(st.h)} mm`, graense: `≤ ${HL.normal} / ${HL.undtagelse} mm`, status: st.h <= HL.normal ? 'ok' : st.h <= HL.undtagelse ? 'undtagelse' : 'overskredet', kilde: 'SR87 afsn. 2.03.4–2.03.5' },
          { label: 'Afsporingskrav h ≤ (R − 50)/1,5', value: `${fmt(st.h)} mm`, graense: `≤ ${fmt(h4a, 1)} mm`, status: st.h <= h4a + 1e-9 ? 'ok' : 'overskredet', kilde: 'SR87 afsn. 2.03.3 formel (4a)' },
          ...tsiRows.map((r) => ({ ...r, label: `TSI: ${r.label}` })),
        ],
        refs: ['SR87', 'ST16', ...(tsiRows.length ? ['TSI-INF'] : [])],
        figur: chart(st),
      });
    };

    const f = form<keyof S>(
      [
        { key: 'R', label: 'Kurveradius', symbol: 'R', unit: 'm', min: 150, max: 10000, step: 10 },
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
