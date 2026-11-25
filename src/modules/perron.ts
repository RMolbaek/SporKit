import {
  PERRONTYPER, SITUATIONER, nominelHoejde, nominelPerronafstand, afstandTolerance, hoejdeTolerance, tolTekst,
  iTolerance, perronGlobal, HOEJDE_LABELS, AFSTAND_TABEL, RADIUS_KOLONNER, type PerronType, type Situation, type Tol,
} from '../core/perron';
import { SKINNE_60E2 } from '../core/overbygning';
import { setReport } from '../core/report';
import type { Status } from '../core/rules';
import { card, fmt, form, h, loadState, results, saveState, select, type Module } from '../ui/dom';

type S = { R: number; hojde: number; h: number; Am: number; Hm: number };
const DEF: S = { R: 800, hojde: 0, h: 60, Am: 0, Hm: 0 };
type Opt = { type: string; sit: string; side: string; fremspring: string };

/** Tværsnit: spor med overhøjde og perron; A og H målt ift. SO-planet. */
function perronFigur(A: number, H: number, hc: number, side: 'inder' | 'yder'): string {
  const T = 80;
  const g = 1435 / 2, rc = g + 36, railTop = -182;
  const th = Math.asin(Math.min(0.2, Math.max(0, hc)) / 1500);
  // Perron i kurvens inderside tegnes til venstre (lav skinne), yderside til højre
  const sgn = side === 'inder' ? -1 : 1;
  const px = -rc, py = railTop; // drejepunkt: inderskinne
  const rot = (x: number, y: number) => {
    const dx = x - px, dy = y - py, c = Math.cos(-th), s = Math.sin(-th);
    return { x: px + dx * c - dy * s, y: py + dx * s + dy * c };
  };
  const deg = (-th * 180) / Math.PI;
  const kx = sgn * g; // kørekant for nærmeste skinne (i SO-system)
  const ex = kx + sgn * A, ey = railTop - H; // perronforkant (SO-system)
  const E = rot(ex, ey);
  const groundY = 420;
  const pw = 1500;
  const platX1 = E.x, platX2 = E.x + sgn * pw;
  const xmin = Math.min(-rc - 500, platX1, platX2) - 250, xmax = Math.max(rc + 500, platX1, platX2) + 250;
  const ytop = Math.min(E.y, railTop) - 420;
  const railRect = (x: number) => `<rect x="${x - 36}" y="${railTop}" width="72" height="${SKINNE_60E2.hoejde}" rx="8" class="t-rail"/>`;
  return `
  <svg viewBox="${xmin} ${ytop} ${xmax - xmin} ${groundY + 120 - ytop}" class="viz viz-track" role="img" aria-label="Perronafstand og perronhøjde målt ift. SO-planet">
    <defs><marker id="pfA" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,1 L10,5 L0,9 z" class="t-arrow"/></marker></defs>
    <rect x="${xmin}" y="${groundY}" width="${xmax - xmin}" height="120" class="pf-ground"/>
    <path d="M ${platX1},${E.y} L ${platX2},${E.y} L ${platX2},${groundY} L ${platX1 + sgn * 120},${groundY} L ${platX1 + sgn * 120},${E.y + 220} L ${platX1},${E.y + 220} Z" class="pf-plat"/>
    <g transform="rotate(${deg.toFixed(3)} ${px} ${py})">
      <rect x="-1250" y="${railTop + SKINNE_60E2.hoejde + 10}" width="2500" height="206" class="t-sleeper"/>
      ${railRect(-rc)}${railRect(rc)}
      <line x1="${Math.min(kx, ex) - 400}" y1="${railTop}" x2="${Math.max(kx, ex) + 400}" y2="${railTop}" class="t-ref"/>
      <text x="${sgn * -1 * (rc + 120)}" y="${railTop - 30}" text-anchor="${sgn < 0 ? 'start' : 'end'}" font-size="${T}" class="t-txt t-muted">SO-plan</text>
      <g class="t-dim">
        <line x1="${kx}" y1="${railTop + 14}" x2="${ex}" y2="${railTop + 14}" marker-start="url(#pfA)" marker-end="url(#pfA)"/>
        <line x1="${kx}" y1="${railTop - 40}" x2="${kx}" y2="${railTop + 80}"/>
        <text x="${(kx + ex) / 2}" y="${railTop + 120}" text-anchor="middle" font-size="${T}">A = ${fmt(A)}</text>
        <line x1="${ex - sgn * 80}" y1="${railTop}" x2="${ex - sgn * 80}" y2="${ey}" marker-start="url(#pfA)" marker-end="url(#pfA)"/>
        <text x="${ex - sgn * 110}" y="${(railTop + ey) / 2 + T / 3}" text-anchor="${sgn < 0 ? 'start' : 'end'}" font-size="${T}">H = ${fmt(H)}</text>
      </g>
    </g>
    <circle cx="${E.x}" cy="${E.y}" r="26" class="t-pivot"/>
    <text x="${platX2 - sgn * 60}" y="${E.y - 50}" text-anchor="${sgn < 0 ? 'start' : 'end'}" font-size="${T * 1.1}" class="t-txt t-b">Perron</text>
    <text x="${xmin + 60}" y="${ytop + 100}" font-size="${T}" class="t-txt t-muted">Overhøjde h = ${fmt(hc)} mm · perron i kurvens ${side === 'inder' ? 'inderside' : 'yderside'} · mm</text>
  </svg>`;
}

const TOL_TXT = (t: Tol) => tolTekst(t);

export const perron: Module = {
  id: 'perron',
  gruppe: 'I sporet',
  titel: 'Spor og perron',
  kort: 'Perron',
  ikon: '▤',
  beskrivelse: 'Nominel perronafstand og -højde samt tolerancer for spor i drift, nyanlæg, fornyelse og sporjustering (BN1-49-1).',
  render(root) {
    const st = loadState<S>('perron', DEF);
    const opt = loadState<Opt>('perron-opt', { type: '55', sit: 'drift', side: 'inder', fremspring: 'nej' });
    const out = h('div', { class: 'out' });

    const update = () => {
      saveState('perron', st);
      saveState('perron-opt', opt);
      const t = opt.type as PerronType, s = opt.sit as Situation;
      const Hnom = nominelHoejde(t, s);
      const Hakt = st.Hm > 0 ? st.Hm : (st.hojde > 0 ? st.hojde : (Hnom ?? 550));
      const Hbrug = st.hojde > 0 ? st.hojde : Hakt; // højde til opslag i figur 8.2-1
      const nom = nominelPerronafstand(Hbrug, st.R, opt.fremspring === 'ja');
      const tA = afstandTolerance(t, s, Hakt);
      const tH = hoejdeTolerance(t, s);
      const Href = st.hojde > 0 ? st.hojde : Hnom;
      const A = nom.afstand;
      const Amin = A !== null && tA[0] !== null ? A - tA[0] : null;
      const Amax = A !== null && tA[1] !== null ? A + tA[1] : null;
      const Hmin = Href !== null && tH[0] !== null ? Href - tH[0] : null;
      const Hmax = Href !== null && tH[1] !== null ? Href + tH[1] : null;
      const sA: Status | null = st.Am > 0 && A !== null ? (iTolerance(st.Am, A, tA) ? 'ok' : 'overskredet') : null;
      const sH: Status | null = st.Hm > 0 && Href !== null ? (iTolerance(st.Hm, Href, tH) ? 'ok' : 'overskredet') : null;
      const Afig = st.Am > 0 ? st.Am : (A ?? 945);
      const Hfig = st.Hm > 0 ? st.Hm : Hakt;
      const glob = perronGlobal(Afig, Hfig, st.h, opt.side as 'inder' | 'yder');
      const fig = perronFigur(Afig, Hfig, st.h, opt.side as 'inder' | 'yder');
      const sitTxt = SITUATIONER.find((x) => x[0] === s)![1];
      const total: Status | null = sA === 'overskredet' || sH === 'overskredet' ? 'overskredet' : sA || sH ? 'ok' : null;

      const tabel = `
        <table class="tbl tbl-mini">
          <thead><tr><th>Højde [mm]</th>${RADIUS_KOLONNER.map((k) => `<th>${k}</th>`).join('')}</tr></thead>
          <tbody>${AFSTAND_TABEL.map((r, i) => `<tr>${[`<td>${HOEJDE_LABELS[i]}</td>`, ...r.map((v, j) => `<td class="${i === nom.raekke && j === nom.kolonne ? 'hit' : ''}">${v}</td>`)].join('')}</tr>`).join('')}</tbody>
        </table>`;

      out.innerHTML = `
        <div class="summary summary-${total ?? 'ok'}">
          <div><strong>Nominel perronafstand</strong><span>${sitTxt}</span></div>
          <div class="summary-val">${A !== null ? fmt(A) + ' mm' : '–'}</div>
        </div>
        ${results([
          { symbol: 'A<sub>nom</sub>', label: 'Nominel perronafstand', value: A !== null ? fmt(A) : '–', unit: 'mm', big: true,
            sub: `Figur 8.2-1: ${nom.grund ?? '–'}${nom.tillaegRadius ? ` + ${nom.tillaegRadius} (R < 250)` : ''}${nom.tillaegFremspring ? ` + ${nom.tillaegFremspring} (fremspring)` : ''}` },
          { symbol: 'A', label: 'Tilladt perronafstand', value: `${Amin !== null ? fmt(Amin) : '–'} … ${Amax !== null ? fmt(Amax) : '∞'}`, unit: 'mm', big: true,
            sub: `Tolerance ${TOL_TXT(tA)}` },
          { symbol: 'H<sub>nom</sub>', label: 'Nominel perronhøjde', value: Href !== null ? fmt(Href) : '–', unit: 'mm',
            sub: st.hojde > 0 ? 'angivet' : 'efter perrontype og situation' },
          { symbol: 'H', label: 'Tilladt perronhøjde', value: Hmin === null && Hmax === null ? 'Ingen krav' : `${Hmin !== null ? fmt(Hmin) : '–'} … ${Hmax !== null ? fmt(Hmax) : '∞'}`, unit: Hmin === null && Hmax === null ? '' : 'mm',
            sub: `Tolerance ${TOL_TXT(tH)}` },
          ...(st.Am > 0 ? [{ symbol: 'A<sub>målt</sub>', label: 'Målt perronafstand', value: fmt(st.Am), unit: 'mm', status: sA!,
            sub: A !== null ? `afvigelse ${st.Am - A >= 0 ? '+' : ''}${fmt(st.Am - A)} mm` : '' }] : []),
          ...(st.Hm > 0 ? [{ symbol: 'H<sub>målt</sub>', label: 'Målt perronhøjde', value: fmt(st.Hm), unit: 'mm', status: sH!,
            sub: Href !== null ? `afvigelse ${st.Hm - Href >= 0 ? '+' : ''}${fmt(st.Hm - Href)} mm` : '' }] : []),
          { symbol: 'Δx / Δy', label: 'Forkant vandret / lodret fra nærmeste skinne', value: `${fmt(glob.vandret)} / ${fmt(glob.lodret)}`, unit: 'mm',
            sub: 'vandret fra kørekant, lodret fra skinneoverkant' },
        ])}
        ${nom.advarsler.length ? `<div class="notice">${nom.advarsler.map((a) => `• ${a}`).join('<br/>')}</div>` : ''}
        <h3>Tværsnit (fig. 8.1-2)</h3>
        ${fig}
        <h3>Figur 8.2-1 – nominel perronafstand [mm]</h3>
        <div class="scroll-x">${tabel}</div>
        <p class="tip">Perronafstand måles parallelt med SO-planet fra nærmeste skinnes kørekant (14 mm under SO) til perronforkant; perronhøjde måles vinkelret på SO-planet.
        I overgangskurver gælder radius i punktet. Ved sporskifter langs perron gælder den største af stamsporets og den afvigende grens værdier.
        ${s !== 'drift' ? 'Ved nyanlæg, fornyelse af perronforkant og sporfornyelse skal perronstart affases over mindst 2000 mm og trækkes 50 mm ekstra tilbage ved perronenden (BN2, afsn. 10).' : ''}</p>
      `;

      setReport({
        modul: 'Spor og perron (BN1-49)',
        inputs: [
          { label: 'Perrontype', symbol: '', value: PERRONTYPER.find((x) => x[0] === t)![1], unit: '' },
          { label: 'Situation', symbol: '', value: sitTxt, unit: '' },
          { label: 'Kurveradius (0 = ret spor)', symbol: 'R', value: st.R > 0 ? fmt(st.R) : 'Ret spor', unit: 'm' },
          { label: 'Perronhøjde til opslag', symbol: 'H', value: fmt(Hbrug), unit: 'mm' },
          { label: 'Perronfremspring > 2 cm uden affasning', symbol: '', value: opt.fremspring === 'ja' ? 'Ja' : 'Nej', unit: '' },
          { label: 'Overhøjde', symbol: 'h', value: fmt(st.h), unit: 'mm' },
          { label: 'Perronens side', symbol: '', value: opt.side === 'inder' ? 'Kurvens inderside' : 'Kurvens yderside', unit: '' },
          ...(st.Am > 0 ? [{ label: 'Målt perronafstand', symbol: 'A', value: fmt(st.Am), unit: 'mm' }] : []),
          ...(st.Hm > 0 ? [{ label: 'Målt perronhøjde', symbol: 'H', value: fmt(st.Hm), unit: 'mm' }] : []),
        ],
        steps: [
          { label: 'Tabelopslag', formel: 'Figur 8.2-1', indsat: `højde ${nom.raekke >= 0 ? HOEJDE_LABELS[nom.raekke] : '> 1250'} mm, radius ${RADIUS_KOLONNER[nom.kolonne]}`, resultat: `${nom.grund ?? '–'} mm` },
          { label: 'Tillæg for R < 250 m', formel: 'afsn. 8.2', indsat: st.R > 0 ? `R = ${fmt(st.R)} m` : 'ret spor', resultat: nom.tillaegRadius === null ? 'ikke dækket' : `${nom.tillaegRadius} mm` },
          { label: 'Tillæg for fremspring', formel: 'afsn. 8.3', indsat: opt.fremspring === 'ja' ? '> 2 cm uden affasning' : '–', resultat: `${nom.tillaegFremspring} mm` },
          { label: 'Nominel perronafstand', formel: 'A<sub>nom</sub> = tabel + tillæg', indsat: '', resultat: A !== null ? `${fmt(A)} mm` : '–' },
          { label: 'Tolerance perronafstand', formel: t !== 'oevrig' && s === 'drift' ? 'Figur 9-1' : 'Figur 11-1', indsat: '', resultat: TOL_TXT(tA) },
          { label: 'Tilladt perronafstand', formel: 'A<sub>nom</sub> − tol … A<sub>nom</sub> + tol', indsat: '', resultat: `${Amin !== null ? fmt(Amin) : '–'} … ${Amax !== null ? fmt(Amax) : '∞'} mm` },
          { label: 'Tolerance perronhøjde', formel: s === 'drift' ? 'Figur 9-1' : 'Figur 11-1', indsat: `H<sub>nom</sub> = ${Href !== null ? fmt(Href) : '–'} mm`, resultat: TOL_TXT(tH) },
          { label: 'Forkant vandret fra kørekant', formel: 'Δx = A·cos θ ± (H + 14)·sin θ', indsat: `θ = arcsin(${st.h}/1500)`, resultat: `${fmt(glob.vandret)} mm` },
          { label: 'Forkant lodret fra SO (nærmeste skinne)', formel: 'Δy = ∓A·sin θ + H·cos θ', indsat: '', resultat: `${fmt(glob.lodret)} mm` },
        ],
        checks: [
          ...(st.Am > 0 && A !== null ? [{ label: 'Målt perronafstand', value: `${fmt(st.Am)} mm`, graense: `${fmt(A)} ${TOL_TXT(tA)}`, status: sA!, kilde: 'BN1-49-1 fig. 8.2-1 / 9-1 / 11-1' }] : []),
          ...(st.Hm > 0 && Href !== null ? [{ label: 'Målt perronhøjde', value: `${fmt(st.Hm)} mm`, graense: `${fmt(Href)} ${TOL_TXT(tH)}`, status: sH!, kilde: 'BN1-49-1 fig. 9-1 / 11-1' }] : []),
        ],
        noter: [
          ...nom.advarsler,
          'Tabelværdier fra BN1-49-1 (udgivet 01.10.2006). Kontrollér om en nyere udgave af BN1-49 er gældende.',
          'Minus-tolerancen gælder for et hvilket som helst punkt på perronen i et tværsnit vinkelret på sporet.',
          'Kontrolmåling af perronafstand og perronhøjde: se BN1-18.',
        ],
        refs: ['BN1-49', 'BN1-18', 'SR87'],
        figur: fig,
      });
    };

    const f = form<keyof S>([
      { key: 'R', label: 'Kurveradius (0 = ret spor)', symbol: 'R', unit: 'm', min: 0, max: 5000, step: 10 },
      { key: 'hojde', label: 'Perronhøjde (0 = nominel efter type)', symbol: 'H', unit: 'mm', min: 0, max: 1250, step: 10 },
      { key: 'h', label: 'Overhøjde i sporet', symbol: 'h', unit: 'mm', min: 0, max: 160, step: 5 },
      { key: 'Am', label: 'Målt perronafstand (0 = ingen)', symbol: 'A<sub>m</sub>', unit: 'mm', min: 0, max: 1300, step: 1 },
      { key: 'Hm', label: 'Målt perronhøjde (0 = ingen)', symbol: 'H<sub>m</sub>', unit: 'mm', min: 0, max: 1300, step: 1 },
    ], st, update);
    f.prepend(
      select('Perrontype', 'type', PERRONTYPER, opt, update),
      select('Situation', 'sit', SITUATIONER, opt, update),
      select('Perronens placering', 'side', [['inder', 'Kurvens inderside (lav skinne)'], ['yder', 'Kurvens yderside (høj skinne)']], opt, update),
      select('Perronfremspring > 2 cm uden affasning', 'fremspring', [['nej', 'Nej'], ['ja', 'Ja (+50 mm)']], opt, update),
    );
    root.append(h('div', { class: 'grid' }, card('Input', f, 'card-input'), card('Resultat', out, 'card-out')));
    update();
  },
};
