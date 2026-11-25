import { parsePunkter, vurder, EKSEMPEL, type Vurdering } from '../core/fritrumskontrol';
import { profilMedTillaeg, fuldtProfil, VEDLIGEHOLDELSESTILLAEG, type ProfilNavn } from '../core/fritrum';
import { setReport } from '../core/report';
import { rail, fastening } from '../ui/track';
import { card, chip, fmt, h, loadState, saveState, select, type Module } from '../ui/dom';

type Opt = { profil: string; tillaeg: string; enhed: string; vis: string };
type S = { data: string };

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

function naermeste(p: [number, number], poly: [number, number][]): [number, number] {
  let best: [number, number] = poly[0];
  let d = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
    const q: [number, number] = [a[0] + t * dx, a[1] + t * dy];
    const dd = Math.hypot(p[0] - q[0], p[1] - q[1]);
    if (dd < d) { d = dd; best = q; }
  }
  return best;
}

let nId = 0;
/** Profil i sporplanet med ét eller flere punkter. */
function figur(navn: ProfilNavn, vs: Vurdering[], fremhaev?: Vurdering, stor = false): string {
  const u = `fk${nId++}`;
  const t = fremhaev?.tillaeg ?? vs[0]?.tillaeg ?? { e: 0, dhRv: 0, vandret: 0, lodret: 0 };
  const grund = fuldtProfil(profilMedTillaeg(navn, { ...t, vandret: 0, lodret: 0 }));
  const med = fuldtProfil(profilMedTillaeg(navn, t));
  const pts = (poly: [number, number][]) => poly.map(([x, y]) => `${x.toFixed(0)},${(-y).toFixed(0)}`).join(' ');
  const maxX = Math.max(3000, ...vs.map((v) => Math.abs(v.u) + 400));
  const maxY = Math.max(5400, ...vs.map((v) => v.v + 400));
  const T = 150;
  const rc = 753.5;
  const prik = (v: Vurdering, big: boolean) => `
    <circle cx="${v.u}" cy="${-v.v}" r="${big ? 80 : 55}" class="${v.konflikt ? 'pf-fejl' : 'pf-ok'}"/>
    ${big || vs.length <= 25 ? `<text x="${v.u + (v.u >= 0 ? 110 : -110)}" y="${-v.v + 50}" text-anchor="${v.u >= 0 ? 'start' : 'end'}" font-size="${T * (big ? 1 : 0.8)}" class="t-txt t-b">${esc(v.p.id)}</text>` : ''}`;
  let afstand = '';
  if (fremhaev) {
    const q = naermeste([fremhaev.u, fremhaev.v], med);
    afstand = `<line x1="${fremhaev.u}" y1="${-fremhaev.v}" x2="${q[0]}" y2="${-q[1]}" class="fk-afst"/>
      <text x="${(fremhaev.u + q[0]) / 2}" y="${-(fremhaev.v + q[1]) / 2 - 60}" text-anchor="middle" font-size="${T}" class="t-txt fk-afst-t">${fremhaev.konflikt ? '−' : ''}${fmt(Math.abs(fremhaev.margin))} mm</text>`;
  }
  return `
  <svg viewBox="${-maxX} ${-maxY} ${2 * maxX} ${maxY + 600}" class="viz ${stor ? 'viz-fk-stor' : 'viz-fk'}" role="img" aria-label="Fritrumsprofil ${navn} med opmålingspunkter">
    <defs><pattern id="g-${u}" width="80" height="80" patternUnits="userSpaceOnUse"><rect width="80" height="80" class="t-bal-bg"/><circle cx="20" cy="22" r="12" class="t-bal-st"/><circle cx="58" cy="54" r="14" class="t-bal-st"/></pattern></defs>
    <rect x="${-maxX}" y="390" width="${2 * maxX}" height="210" fill="url(#g-${u})"/>
    <polygon points="${pts(med)}" class="pf-tillaeg"/>
    <polygon points="${pts(grund)}" class="pf-profil"/>
    <line x1="0" y1="500" x2="0" y2="${-maxY + 200}" class="tp-cl"/>
    <line x1="${-maxX}" y1="0" x2="${maxX}" y2="0" class="t-ref"/>
    <g transform="translate(0 182)"><rect x="-1250" y="0" width="2500" height="206" class="t-sleeper"/>${fastening(-rc)}${fastening(rc)}${rail(-rc, -1)}${rail(rc, 1)}</g>
    ${afstand}
    ${vs.map((v) => prik(v, v === fremhaev)).join('')}
    <text x="${-maxX + 80}" y="${-maxY + 1.3 * T}" font-size="${T * 1.1}" class="t-txt t-b">Profil ${navn} i sporplanet</text>
    <text x="${-maxX + 80}" y="${-maxY + 2.5 * T}" font-size="${T * 0.75}" class="t-txt t-muted">Fuld: profil inkl. e/Δh · stiplet: + vedligeholdelsestillæg · venstre/højre i km-retningen · mm</text>
  </svg>`;
}

export const fritrumskontrol: Module = {
  id: 'fritrumskontrol',
  gruppe: 'I sporet',
  titel: 'Fritrumskontrol af opmålingspunkter',
  kort: 'Fritrumskontrol',
  ikon: '◎',
  beskrivelse: 'Kontrollér opmålte punkter (afstand til spormidte og overhøjde fra sporlinjen) mod fritrumsprofil D, D-GC eller SD – med rapport og én side pr. konflikt.',
  render(root) {
    const st = loadState<S>('fritrumskontrol', { data: EKSEMPEL });
    const opt = loadState<Opt>('fritrumskontrol-opt', { profil: 'D', tillaeg: 'ballast', enhed: 'mm', vis: 'alle' });
    const out = h('div', { class: 'out' });
    const ta = h('textarea', { class: 'fk-data', rows: '12', spellcheck: 'false' }) as HTMLTextAreaElement;
    ta.value = st.data;

    const update = () => {
      st.data = ta.value;
      saveState('fritrumskontrol', st);
      saveState('fritrumskontrol-opt', opt);
      const navn = opt.profil as ProfilNavn;
      const vedl = opt.tillaeg === 'ingen' ? { vandret: 0, lodret: 0 } : VEDLIGEHOLDELSESTILLAEG[opt.tillaeg as 'ballast' | 'fast'];
      const { punkter, fejl } = parsePunkter(ta.value, opt.enhed as 'mm' | 'm');
      const vs = punkter.map((p) => vurder(p, navn, vedl));
      const konf = vs.filter((v) => v.konflikt);
      const kunTillaeg = konf.filter((v) => !v.konfliktProfil).length;
      const vist = opt.vis === 'konflikter' ? konf : vs;
      const oversigt = figur(navn, vs, undefined, true);
      const row = (v: Vurdering) => `<tr class="${v.konflikt ? 'fk-k' : ''}">
        <td><b>${esc(v.p.id)}</b><br/><small>${esc(v.p.km)}</small></td><td>${esc(v.p.beskrivelse)}</td>
        <td>${fmt(v.p.h)}</td><td>${fmt(v.p.x)}</td><td>${fmt(v.p.z)}</td>
        <td>${fmt(v.u)} / ${fmt(v.v)}</td><td>${fmt(v.tillaeg.e)}${v.tillaeg.dhRv ? ` / ${fmt(v.tillaeg.dhRv)}` : ''}</td>
        <td><b>${v.konflikt ? '−' : ''}${fmt(Math.abs(v.margin))}</b></td>
        <td>${v.konflikt ? (v.konfliktProfil ? chip('overskredet') : '<span class="chip chip-undtagelse">Tillæg</span>') : chip('ok')}</td></tr>`;

      out.innerHTML = `
        <div class="summary summary-${konf.length ? 'overskredet' : 'ok'}">
          <div><strong>${punkter.length} punkter kontrolleret mod profil ${navn}</strong>
          <span>${konf.length} konflikt${konf.length === 1 ? '' : 'er'}${kunTillaeg ? ` (heraf ${kunTillaeg} kun i vedligeholdelsestillægget)` : ''} · tillæg ${vedl.vandret}/${vedl.lodret} mm</span></div>
          <div class="summary-val">${konf.length}</div>
        </div>
        ${fejl.length ? `<div class="notice">${fejl.map((f) => `• ${esc(f)}`).join('<br/>')}</div>` : ''}
        ${oversigt}
        <h3>Punkter ${opt.vis === 'konflikter' ? '(kun konflikter)' : ''}</h3>
        <div class="scroll-x"><table class="tbl tbl-mini fk-tbl">
          <thead><tr><th>Punkt / km</th><th>Beskrivelse</th><th>h</th><th>x</th><th>z</th><th>u / v (sporplan)</th><th>e / Δh</th><th>Margin</th><th>Status</th></tr></thead>
          <tbody>${vist.map(row).join('')}</tbody>
        </table></div>
        <p class="tip">Margin er korteste afstand fra punktet til profilkanten inkl. vedligeholdelsestillæg (negativ = indtrængning). «Tillæg» = punktet er fri af selve profilet, men ligger i vedligeholdelsestillægget. Punkterne drejes ind i sporplanet om spormidten med overhøjden (h > 0: højre skinne højest i km-retningen). e beregnes af R, Δh af R<sub>v</sub> (BN1-166-1 afsnit 12–13).</p>
      `;

      const sider = konf.map((v, i) => `
        <h2>Konflikt ${i + 1} af ${konf.length}: ${esc(v.p.id)}${v.p.km ? ` · km ${esc(v.p.km)}` : ''}</h2>
        <p><b>${esc(v.p.beskrivelse || '–')}</b></p>
        <table class="rpt-tbl">
          <tbody>
            <tr><td>Profil</td><td class="r">${navn}</td><td>Overhøjde h</td><td class="r">${fmt(v.p.h)} mm</td></tr>
            <tr><td>Vandret afstand x</td><td class="r">${fmt(v.p.x)} mm</td><td>Lodret afstand z</td><td class="r">${fmt(v.p.z)} mm</td></tr>
            <tr><td>I sporplanet u / v</td><td class="r">${fmt(v.u)} / ${fmt(v.v)} mm</td><td>R / R<sub>v</sub></td><td class="r">${v.p.R ? fmt(v.p.R) : '–'} / ${v.p.Rv ? fmt(v.p.Rv) : '–'} m</td></tr>
            <tr><td>Breddeforøgelse e</td><td class="r">${fmt(v.tillaeg.e)} mm</td><td>Højdeændring Δh</td><td class="r">${fmt(v.tillaeg.dhRv)} mm</td></tr>
            <tr><td>Vedligeholdelsestillæg</td><td class="r">${v.tillaeg.vandret} / ${v.tillaeg.lodret} mm</td><td><b>Indtrængning</b></td><td class="r"><b>${fmt(Math.abs(v.margin))} mm</b></td></tr>
            <tr><td>Konflikt med</td><td class="r" colspan="3">${v.konfliktProfil ? 'selve fritrumsprofilet (BN1)' : 'kun vedligeholdelsestillægget (projektering)'}</td></tr>
          </tbody>
        </table>
        ${v.advarsler.length ? `<p class="rpt-notes">${v.advarsler.map(esc).join('<br/>')}</p>` : ''}
        ${figur(navn, [v], v)}
        <table class="rpt-sign" style="margin-top:8px"><tr><th>Vurdering / afhjælpning</th></tr><tr><td style="height:70px"></td></tr></table>`);

      setReport({
        modul: `Fritrumskontrol – profil ${navn}`,
        inputs: [
          { label: 'Fritrumsprofil', symbol: '', value: navn, unit: '' },
          { label: 'Vedligeholdelsestillæg (vandret / lodret)', symbol: '', value: `${vedl.vandret} / ${vedl.lodret}`, unit: 'mm' },
          { label: 'Antal punkter / konflikter', symbol: '', value: `${punkter.length} / ${konf.length}`, unit: '' },
        ],
        steps: vs.map((v) => ({
          label: `${v.p.id}${v.p.km ? ` (km ${v.p.km})` : ''}`,
          formel: esc(v.p.beskrivelse || '–'),
          indsat: `h ${fmt(v.p.h)} · x ${fmt(v.p.x)} · z ${fmt(v.p.z)} → u ${fmt(v.u)} · v ${fmt(v.v)}`,
          resultat: `${v.konflikt ? '−' : ''}${fmt(Math.abs(v.margin))} mm`,
        })),
        checks: vs.map((v) => ({ label: `${v.p.id} – ${v.p.beskrivelse}`, value: `${v.konflikt ? '−' : ''}${fmt(Math.abs(v.margin))} mm`, graense: `uden for ${navn}`, status: v.konflikt ? (v.konfliktProfil ? 'overskredet' : 'undtagelse') : 'ok', kilde: 'BN1-166-1' })),
        noter: [
          `${konf.length} konflikt(er) – hver konflikt er vist på en separat side efter oversigten.`,
          'Profilmål aflæst af figur 11.1.1-1 til -3 i BN1-166-1. Status «Undtagelse» = kun i vedligeholdelsestillægget.',
          'Koordinater: x vandret fra spormidte (+ højre i km-retningen), z lodret over spormidte i SO-planet, h > 0 når højre skinne er højest.',
        ],
        refs: ['BN1-166', 'EN15273', 'TSI-INF'],
        figur: oversigt,
        sider,
      });
    };

    ta.addEventListener('input', update);
    const fil = h('input', { type: 'file', accept: '.csv,.txt,.tsv', class: 'fk-fil' }) as HTMLInputElement;
    fil.addEventListener('change', async () => {
      const f = fil.files?.[0];
      if (!f) return;
      ta.value = await f.text();
      update();
    });
    const eks = h('button', { class: 'btn-ghost btn-sm', type: 'button' }, 'Indsæt eksempel');
    eks.addEventListener('click', () => { ta.value = EKSEMPEL; update(); });
    const ryd = h('button', { class: 'btn-ghost btn-sm', type: 'button' }, 'Ryd');
    ryd.addEventListener('click', () => { ta.value = ''; update(); });
    const filKnap = h('label', { class: 'btn-ghost btn-sm fk-filknap' }, 'Indlæs CSV-fil', fil);

    const left = h('div', { class: 'fields' },
      select('Fritrumsprofil', 'profil', [['D', 'D – fjernbane P2–P6, F2–F4'], ['D-GC', 'D-GC – fjernbane P1, F1'], ['SD', 'SD – S-bane']], opt, update),
      select('Vedligeholdelsestillæg', 'tillaeg', [['ballast', 'Ballasteret spor (50 / 100 mm)'], ['fast', 'Fast spor (25 / 50 mm)'], ['ingen', 'Ingen (spor i drift)']], opt, update),
      select('Enhed for x og z', 'enhed', [['mm', 'mm'], ['m', 'm']], opt, update),
      select('Vis i tabel', 'vis', [['alle', 'Alle punkter'], ['konflikter', 'Kun konflikter']], opt, update),
      h('div', { class: 'field' },
        h('label', {}, h('span', { class: 'lbl' }, 'Opmålingspunkter – indsæt fra Excel eller CSV')),
        ta,
        h('small', { class: 'hint' }, 'Kolonner: Punkt · Km · Overhøjde [mm] · x · z · Beskrivelse · R [m] · Rv [m]. Tabulator- eller semikolonsepareret; decimalkomma er OK. Første linje må være en overskrift.'),
      ),
      h('div', { class: 'ed-add' }, filKnap, eks, ryd),
    );
    root.append(h('div', { class: 'grid' }, card('Data og profil', left, 'card-input card-scroll'), card('Resultat', out, 'card-out')));
    update();
  },
};
