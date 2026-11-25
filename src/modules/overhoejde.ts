import { BANEDANMARK as rs, vurder, samletStatus } from '../core/rules';
import {
  cantConstant, equilibriumCant, cantDeficiency, cantExcess, lateralAcceleration,
  cantWindow, roundTo,
} from '../core/formulas';
import { card, fmt, form, h, limitText, loadState, results, saveState, chip, type Module } from '../ui/dom';

type S = { R: number; V: number; Vmin: number; h: number };
const DEF: S = { R: 1200, V: 160, Vmin: 80, h: 110 };

/** Tværsnit af sporet med overhøjde (overdrevet hældning). */
function crossSection(hmm: number, I: number): string {
  const ang = Math.atan(hmm / 1500) * 2.2; // overdrevet ×2,2
  const deg = (-ang * 180) / Math.PI;
  const arrowDir = I >= 0 ? 1 : -1;
  const arrowLen = Math.min(70, Math.abs(I) * 0.45);
  return `
  <svg viewBox="0 0 320 170" class="viz" role="img" aria-label="Sportværsnit med overhøjde">
    <defs>
      <marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill="currentColor"/>
      </marker>
    </defs>
    <polygon points="30,160 290,160 255,118 65,118" class="ballast"/>
    <g transform="rotate(${deg.toFixed(2)} 160 112)">
      <rect x="55" y="106" width="210" height="12" rx="2" class="sleeper"/>
      <rect x="88" y="90" width="14" height="16" rx="1.5" class="rail"/>
      <rect x="218" y="90" width="14" height="16" rx="1.5" class="rail"/>
      <line x1="95" y1="86" x2="225" y2="86" class="dim"/>
    </g>
    <line x1="40" y1="${(112 - Math.tan(ang) * -65).toFixed(1)}" x2="300" y2="${(112 - Math.tan(ang) * -65).toFixed(1)}" class="ref"/>
    <text x="300" y="${(112 - Math.tan(ang) * 65 - 30).toFixed(1)}" text-anchor="end" class="lbl-svg">h = ${fmt(hmm)} mm</text>
    <text x="30" y="20" class="lbl-svg muted">Kurveindre</text>
    <text x="290" y="20" text-anchor="end" class="lbl-svg muted">Kurveydre</text>
    ${
      arrowLen > 3
        ? `<line x1="160" y1="45" x2="${160 + arrowDir * arrowLen}" y2="45" class="force" marker-end="url(#ah)"/>
           <text x="160" y="35" text-anchor="middle" class="lbl-svg">${I >= 0 ? 'Resulterende udad' : 'Resulterende indad'}</text>`
        : `<text x="160" y="40" text-anchor="middle" class="lbl-svg">I ligevægt</text>`
    }
    <circle cx="160" cy="45" r="3.5" class="dot"/>
  </svg>`;
}

export const overhoejde: Module = {
  id: 'overhoejde',
  titel: 'Overhøjde',
  kort: 'Overhøjde',
  ikon: '◢',
  beskrivelse: 'Ligevægtsoverhøjde, manglende og overskydende overhøjde samt tilladt overhøjdeinterval.',
  render(root) {
    const st = loadState<S>('overhoejde', DEF);
    const out = h('div', { class: 'out' });

    const update = () => {
      saveState('overhoejde', st);
      const heq = equilibriumCant(st.V, st.R, rs);
      const heqMin = equilibriumCant(st.Vmin, st.R, rs);
      const I = cantDeficiency(st.V, st.R, st.h, rs);
      const E = cantExcess(st.Vmin, st.R, st.h, rs);
      const aq = lateralAcceleration(I, rs);
      const sH = vurder(st.h, rs.overhoejdeMax);
      const sI = I > 0 ? vurder(I, rs.manglendeOverhoejdeMax) : 'ok';
      const sE = E > 0 ? vurder(E, rs.overskydendeOverhoejdeMax) : 'ok';
      const total = samletStatus([sH, sI, sE]);

      const wN = cantWindow(st.V, st.Vmin, st.R, rs.manglendeOverhoejdeMax.normal, rs.overskydendeOverhoejdeMax.normal, rs.overhoejdeMax.normal, rs);
      const wU = cantWindow(st.V, st.Vmin, st.R, rs.manglendeOverhoejdeMax.undtagelse, rs.overskydendeOverhoejdeMax.undtagelse, rs.overhoejdeMax.undtagelse, rs);
      let forslag = NaN;
      if (wN.muligt) {
        const lav = roundTo(wN.lav, 5, 'op');
        const hoej = roundTo(wN.hoej, 5, 'ned');
        forslag = lav <= hoej ? roundTo((lav + hoej) / 2, 5, 'naermest') : roundTo(wN.lav, 1, 'op');
        forslag = Math.min(Math.max(forslag, lav), Math.max(lav, hoej));
      }

      const scaleMax = Math.max(rs.overhoejdeMax.undtagelse, heq) * 1.08;
      const pct = (x: number) => `${Math.max(0, Math.min(100, (x / scaleMax) * 100)).toFixed(1)}%`;
      const bar = (w: { lav: number; hoej: number; muligt: boolean }, cls: string) =>
        w.muligt ? `<div class="win ${cls}" style="left:${pct(w.lav)};width:calc(${pct(w.hoej)} - ${pct(w.lav)})"></div>` : '';

      out.innerHTML = `
        <div class="summary summary-${total}">
          <div><strong>Samlet vurdering</strong><span>${st.R} m · ${st.V} km/t · h = ${st.h} mm</span></div>
          ${chip(total)}
        </div>
        ${results([
          { symbol: 'h<sub>eq</sub>', label: 'Ligevægtsoverhøjde (V)', value: fmt(heq), unit: 'mm', big: true,
            sub: `h<sub>eq</sub> = ${fmt(cantConstant(rs), 2)}·V²/R` },
          { symbol: 'I', label: 'Manglende overhøjde', value: fmt(I), unit: 'mm', status: sI, big: true,
            sub: limitText(rs.manglendeOverhoejdeMax) },
          { symbol: 'E', label: 'Overskydende overhøjde (V<sub>min</sub>)', value: fmt(E), unit: 'mm', status: sE,
            sub: limitText(rs.overskydendeOverhoejdeMax) },
          { symbol: 'h', label: 'Valgt overhøjde', value: fmt(st.h), unit: 'mm', status: sH,
            sub: limitText(rs.overhoejdeMax) },
          { symbol: 'a<sub>q</sub>', label: 'Ukompenseret sideacceleration', value: fmt(aq, 2), unit: 'm/s²',
            sub: 'a<sub>q</sub> = g·I / 1500' },
          { symbol: 'h<sub>eq,min</sub>', label: 'Ligevægt for V<sub>min</sub>', value: fmt(heqMin), unit: 'mm' },
        ])}
        <div class="window">
          <div class="window-head">
            <strong>Tilladt overhøjdeinterval</strong>
            <span>${wN.muligt ? `${fmt(wN.lav)}–${fmt(wN.hoej)} mm (normal)` : '<em class="bad">Intet normalt interval</em>'}
            ${wU.muligt ? ` · ${fmt(wU.lav)}–${fmt(wU.hoej)} mm (undt.)` : ''}</span>
          </div>
          <div class="track">
            ${bar(wU, 'win-u')}${bar(wN, 'win-n')}
            <div class="mark mark-h" style="left:${pct(st.h)}" title="Valgt h"><span>h</span></div>
            <div class="mark mark-eq" style="left:${pct(heq)}" title="h_eq"><span>h<sub>eq</sub></span></div>
          </div>
          <div class="scale"><span>0</span><span>${fmt(scaleMax / 2)}</span><span>${fmt(scaleMax)} mm</span></div>
          ${
            Number.isFinite(forslag)
              ? `<p class="tip">Forslag: <strong>h = ${fmt(forslag)} mm</strong> – midt i normalintervallet, afrundet til 5 mm.
                 <button class="btn-link" data-apply="${forslag}">Brug forslag</button></p>`
              : `<p class="tip bad">Radius er for lille til både V = ${st.V} og V<sub>min</sub> = ${st.Vmin} km/t inden for normalgrænserne. Øg R, sænk V eller hæv V<sub>min</sub>.</p>`
          }
        </div>
        ${crossSection(st.h, I)}
      `;
      out.querySelector<HTMLButtonElement>('[data-apply]')?.addEventListener('click', (e) => {
        st.h = Number((e.currentTarget as HTMLElement).dataset.apply);
        root.innerHTML = '';
        overhoejde.render(root);
      });
    };

    const f = form<keyof S>(
      [
        { key: 'R', label: 'Kurveradius', symbol: 'R', unit: 'm', min: 150, max: 10000, step: 10 },
        { key: 'V', label: 'Strækningshastighed', symbol: 'V', unit: 'km/t', min: 10, max: 300, step: 5 },
        { key: 'Vmin', label: 'Laveste hastighed (gods)', symbol: 'V<sub>min</sub>', unit: 'km/t', min: 0, max: 200, step: 5,
          hint: 'Bruges til overskydende overhøjde E.' },
        { key: 'h', label: 'Overhøjde', symbol: 'h', unit: 'mm', min: 0, max: 180, step: 5 },
      ],
      st,
      update,
    );
    root.append(h('div', { class: 'grid' }, card('Input', f, 'card-input'), card('Resultat', out, 'card-out')));
    update();
  },
};
