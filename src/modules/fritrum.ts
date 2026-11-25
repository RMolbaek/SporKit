import {
  breddeforoegelse, breddeforoegelseVed, hoejdeaendring, VEDLIGEHOLDELSESTILLAEG, omkringSkinnen, profilType,
  profilMedTillaeg, fuldtProfil, iPolygon, tilSporplan, TSI_GAUGE, type ProfilNavn,
} from '../core/fritrum';
import { profilSvg } from '../ui/profil';
import { loadSettings } from '../core/rules';
import { chip } from '../ui/dom';
import { sporudvidelse } from '../core/rules';
import { setReport } from '../core/report';
import { card, fmt, form, h, loadState, results, saveState, select, type Module } from '../ui/dom';

type S = { R: number; okl: number; Rv: number; h: number; gx: number; gz: number };
const DEF: S = { R: 220, okl: 0, Rv: 5000, h: 100, gx: 0, gz: 0 };
type Opt = { kode: string; spor: string; yder: string; tillaeg: string };

function forloeb(R: number, okl: number): string {
  const W = 320, H = 150, l = 34, r = 14, t = 22, b = 30;
  const e = breddeforoegelse(R) ?? 0;
  const x0 = -Math.max(30, okl + 10), x1 = 20;
  const X = (x: number) => l + ((W - l - r) * (x - x0)) / (x1 - x0);
  const Y = (v: number) => H - b - ((H - b - t) * v) / Math.max(1, e);
  const pts = Array.from({ length: 121 }, (_, k) => x0 + ((x1 - x0) * k) / 120);
  return `
  <svg viewBox="0 0 ${W} ${H}" class="viz viz-small" role="img" aria-label="Breddeforøgelsens forløb">
    <line x1="${l}" y1="${H - b}" x2="${W - r}" y2="${H - b}" class="axis"/>
    <polyline points="${pts.map((x) => `${X(x).toFixed(1)},${Y(breddeforoegelseVed(x, R, okl)).toFixed(1)}`).join(' ')}" class="curve-sel"/>
    <line x1="${X(0)}" y1="${t - 6}" x2="${X(0)}" y2="${H - b + 4}" class="tick"/>
    <text x="${X(0) - 4}" y="${t}" text-anchor="end" class="lbl-svg">Kurvens BP</text>
    ${okl > 0 ? `<line x1="${X(-okl)}" y1="${t + 10}" x2="${X(-okl)}" y2="${H - b + 4}" class="tick"/><text x="${X(-okl) + 4}" y="${t + 18}" class="lbl-svg muted">OK start</text>` : ''}
    ${okl <= 0 && R <= 250 && e > 0 ? `<text x="${X(-12)}" y="${H - b + 16}" text-anchor="middle" class="lbl-svg muted">−12 m</text><text x="${X(-2)}" y="${H - b + 16}" text-anchor="middle" class="lbl-svg muted">−2 m</text>` : ''}
    <text x="${l - 4}" y="${Y(e) + 4}" text-anchor="end" class="lbl-svg">${fmt(e)}</text>
    <text x="${l - 4}" y="${H - b + 4}" text-anchor="end" class="lbl-svg muted">0</text>
    <text x="${l}" y="10" class="lbl-svg muted">e [mm] som funktion af afstand til kurvens begyndelsespunkt [m]</text>
  </svg>`;
}

export const fritrum: Module = {
  id: 'fritrum',
  gruppe: 'I sporet',
  titel: 'Fritrum',
  kort: 'Fritrum',
  ikon: '⬚',
  beskrivelse: 'Fritrumsprofil D, D-GC og SD med overhøjde, breddeforøgelse, højdeændring og vedligeholdelsestillæg – og kontrol af genstande (BN1-166-1, TSI INF 4.2.3.1).',
  render(root) {
    const st = loadState<S>('fritrum', DEF);
    const opt = loadState<Opt>('fritrum-opt', { kode: 'P3', spor: 'ballast', yder: '1', tillaeg: 'ja' });
    const out = h('div', { class: 'out' });
    const update = () => {
      saveState('fritrum', st);
      saveState('fritrum-opt', opt);
      const e = breddeforoegelse(st.R);
      const eUrund = breddeforoegelse(st.R, false);
      const dh = hoejdeaendring(st.Rv);
      const vt = VEDLIGEHOLDELSESTILLAEG[opt.spor as 'ballast' | 'fast'];
      const sk = omkringSkinnen(st.R);
      const prof = profilType(opt.kode);
      const formel = !(st.R > 0) ? 'ret spor' : st.R < 150 ? 'R < 150 m: dispensation, beregnes efter EN 15273-1…3' : st.R < 250 ? 'e = 60 000/R − 225 (formel 12.2)' : st.R < 300 ? 'e = 3 750/R (formel 12.1)' : `R ≥ 300 m: e = 3 750/R = ${fmt(eUrund ?? 0, 1)} mm, må nedrundes til 0`;
      const overgang = st.okl > 0 ? 'vokser lineært over overgangskurven og er fuld ved hovedkurvens begyndelsespunkt (fig. 12-6)'
        : st.R <= 250 ? 'vokser lineært fra 12 m før og er fuld 2 m før kurvens begyndelsespunkt (fig. 12-3)'
          : 'skal være til stede ved kurvens begyndelsespunkt (fig. 12-2)';
      const fig = forloeb(st.R, st.okl);
      const pNavn = prof as ProfilNavn;
      const tillaeg = { e: e ?? 0, dhRv: dh ?? 0, vandret: opt.tillaeg === 'ja' ? vt.vandret : 0, lodret: opt.tillaeg === 'ja' ? vt.lodret : 0 };
      const yder = (opt.yder === '-1' ? -1 : 1) as 1 | -1;
      const harGenstand = st.gx !== 0 || st.gz !== 0;
      const [gu, gv] = tilSporplan(st.gx, st.gz, st.h, yder);
      const poly = fuldtProfil(profilMedTillaeg(pNavn, tillaeg));
      const fri = !iPolygon([gu, gv], poly);
      const pfig = profilSvg({ navn: pNavn, t: tillaeg, hCant: st.h, yder, genstand: harGenstand ? { x: st.gx, z: st.gz, fri } : null });
      const set = loadSettings();
      out.innerHTML = `
        <div class="summary summary-${e === null || dh === null ? 'overskredet' : 'ok'}">
          <div><strong>Fritrumsprofil ${prof}</strong><span>Trafikkode ${opt.kode} · ${opt.spor === 'ballast' ? 'ballasteret' : 'fast befæstet'} spor</span></div>
          <div class="summary-val">e = ${e === null ? '–' : `${fmt(e)} mm`}</div>
        </div>
        ${results([
          { symbol: 'e', label: 'Breddeforøgelse i kurven', value: e === null ? 'Dispensation' : fmt(e, 1), unit: e === null ? '' : 'mm', big: true, sub: formel },
          { symbol: 'Δh<sub>Rv</sub>', label: 'Ændring af højdemål i afrundingskurve', value: dh === null ? 'Dispensation' : fmt(dh, 1), unit: dh === null ? '' : 'mm', big: true,
            sub: dh === null ? 'R<sub>v</sub> < 500 m: beregnes efter EN 15273' : st.Rv >= 10000 ? 'R<sub>v</sub> ≥ 10 000 m: må nedrundes til 0' : 'Δh = 50 000/R<sub>v</sub> (formel 13.1)' },
          { symbol: 'V<sub>t</sub>', label: 'Vedligeholdelsestillæg (projektering)', value: `${vt.vandret} / ${vt.lodret}`, unit: 'mm', sub: 'vandret / lodret (tabel 10.4-1)' },
          { symbol: 'u', label: 'Sporudvidelse (Sporregler 2.12)', value: fmt(sporudvidelse(st.R)), unit: 'mm', sub: 'lægges til mål n omkring skinnen' },
        ])}
        <h3>Fritrumsprofil ${prof}</h3>
        ${pfig}
        ${harGenstand ? `<div class="summary summary-${fri ? 'ok' : 'overskredet'}"><div><strong>Genstand ${fri ? 'står frit' : 'er inden for profilet'}</strong><span>${fmt(st.gx)} mm fra spormidte, ${fmt(st.gz)} mm over inderskinnens SO → i sporplanet ${fmt(gu)} / ${fmt(gv)} mm</span></div>${chip(fri ? 'ok' : 'overskredet')}</div>` : ''}
        ${set.tsi ? `<div class="tsi"><div class="tsi-head"><span class="tsi-flag">EU</span><strong>TSI INF 4.2.3.1 – profil</strong></div>
          <p class="tip" style="margin-top:0">Trafikkode ${opt.kode} kræver profil <b>${TSI_GAUGE[opt.kode]}</b> (TSI tabel 2/3) beregnet efter EN 15273-3. Banedanmark udmønter kravet i BN1-166-1: ${opt.kode === 'P1' || opt.kode === 'F1' ? 'D-GC dækker GC (afviger 20 mm i højden ved 4 820 mm).' : opt.kode === 'S' ? 'S-banen er ikke omfattet af TSI-profilkravet; profil SD gælder.' : 'profil D anvendes for P2–P6/F2–F4.'} TSI-profilernes egne mål står i EN 15273-3 og er ikke tegnet her.</p></div>` : ''}
        <h3>Breddeforøgelsens forløb</h3>
        ${fig}
        <p class="tip">Breddeforøgelsen ${overgang}. Den gives i hele højden af profil D, D-GC og SD, men ikke i fritrumsprofilet over øvre del. Mellem to kurver se fig. 12-4, 12-5 og 12-7.</p>
        <h3>Højdemål i afrundingskurver</h3>
        <ul class="consts">
          <li>Alle højdemål til og med 1 170 mm over SO <b>formindskes</b> med Δh<sub>Rv</sub> (aldrig under SO-planet).</li>
          <li>Alle højdemål 3 300 < h ≤ 4 800/4 820 mm <b>forøges</b> med Δh<sub>Rv</sub>.</li>
          <li>Korrektionen begynder 25 m før tangentpunktet og tiltager lineært, så den er fuldt til stede ved afrundingskurvens begyndelse.</li>
        </ul>
        <h3>Fritrum omkring skinnen (afsnit 14)</h3>
        <table class="tbl tbl-kv"><tbody>
          <tr><td>m – faste genstande i fast forbindelse med køreskinnen</td><td>${sk.mFast} mm</td></tr>
          <tr><td>m – alle øvrige genstande</td><td>${sk.mOevrig} mm</td></tr>
          <tr><td>n – tvangskinner i sporskifter og krydsninger</td><td>${sk.nTvang} mm${sk.udv ? ` (41 + ${sk.udv} sporudvidelse)` : ''}</td></tr>
          <tr><td>n – alle øvrige faste genstande</td><td>${sk.nOevrig} mm${sk.udv ? ` (70 + ${sk.udv})` : ''}; i visse tilfælde ned til ${sk.nMin} mm</td></tr>
          <tr><td>Rilledybde / tvangskinnehøjde</td><td>≥ 38 mm (ved maks. slid) / ≤ 55 mm</td></tr>
        </tbody></table>
        <p class="tip">Målene m og n regnes fra kørekanten (14 mm under SO) med udgangspunkt i en ny skinne. Der gives ikke breddeforøgelse e til m og n. Profilets mål fremgår af figur 11.1.1-1 til -3 i BN1-166-1 (D: fjernbane P2–P6/F2–F4 · D-GC: P1/F1 · SD: S-bane).</p>
      `;
      setReport({
        modul: 'Fritrum (BN1-166-1)',
        inputs: [
          { label: 'Trafikkode / profil', symbol: '', value: `${opt.kode} / ${prof}`, unit: '' },
          { label: 'Sporkonstruktion', symbol: '', value: opt.spor === 'ballast' ? 'Ballasteret' : 'Fast befæstet', unit: '' },
          { label: 'Kurveradius (0 = ret)', symbol: 'R', value: fmt(st.R), unit: 'm' },
          { label: 'Overgangskurvelængde', symbol: 'L', value: fmt(st.okl), unit: 'm' },
          { label: 'Afrundingsradius', symbol: 'R<sub>v</sub>', value: fmt(st.Rv), unit: 'm' },
        ],
        steps: [
          { label: 'Breddeforøgelse', formel: formel, indsat: st.R > 0 ? `R = ${fmt(st.R)}` : '', resultat: e === null ? 'dispensation' : `${fmt(e, 1)} mm` },
          { label: 'Forløb ved overgang', formel: 'fig. 12-2 – 12-7', indsat: '', resultat: overgang },
          { label: 'Højdeændring', formel: 'Δh = 50 000/R<sub>v</sub>', indsat: `50 000/${fmt(st.Rv)}`, resultat: dh === null ? 'dispensation' : `${fmt(dh, 1)} mm` },
          { label: 'Vedligeholdelsestillæg', formel: 'tabel 10.4-1', indsat: opt.spor === 'ballast' ? 'ballasteret' : 'fast', resultat: `vandret ${vt.vandret} mm · lodret ${vt.lodret} mm` },
          { label: 'Mål n (øvrige faste genstande)', formel: '70 + sporudvidelse', indsat: `70 + ${sk.udv}`, resultat: `${sk.nOevrig} mm` },
          { label: 'Mål m', formel: 'afsnit 14', indsat: '', resultat: `${sk.mFast} / ${sk.mOevrig} mm` },
        ],
        checks: harGenstand ? [{ label: 'Genstand uden for profil (inkl. tillæg)', value: `${fmt(st.gx)} / ${fmt(st.gz)} mm`, graense: `uden for ${prof}`, status: fri ? 'ok' : 'overskredet', kilde: 'BN1-166-1 afsnit 10–13' }] : [],
        noter: [
          'Profilmålene er aflæst af figur 11.1.1-1 til -3 i BN1-166-1 – kontrollér kritiske mål mod normen.',
          'Profilmålene er absolutte og skal altid overholdes; vedligeholdelsestillægget gives ved opgradering, nyanlæg, sporfornyelse og større ombygning.',
          'Kurver med R < 150 m og afrundinger med R<sub>v</sub> < 500 m kræver dispensation og beregning efter DS/EN 15273-1…3.',
        ],
        refs: ['BN1-166', 'EN15273', 'SR87', 'ST16', 'BN1-154'],
        figur: pfig + fig,
      });
    };
    const f = form<keyof S>([
      { key: 'R', label: 'Kurveradius (0 = ret spor)', symbol: 'R', unit: 'm', min: 0, max: 1000, step: 5 },
      { key: 'okl', label: 'Overgangskurvelængde (0 = ingen)', symbol: 'L', unit: 'm', min: 0, max: 200, step: 5 },
      { key: 'Rv', label: 'Afrundingsradius i længdeprofil', symbol: 'R<sub>v</sub>', unit: 'm', min: 500, max: 20000, step: 100 },
      { key: 'h', label: 'Overhøjde', symbol: 'h', unit: 'mm', min: 0, max: 180, step: 5 },
      { key: 'gx', label: 'Genstand: vandret afstand fra spormidte (0 = ingen)', symbol: 'x', unit: 'mm', min: -4000, max: 4000, step: 10, hint: '+ mod kurvens yderside' },
      { key: 'gz', label: 'Genstand: højde over inderskinnens SO', symbol: 'z', unit: 'mm', min: 0, max: 6000, step: 10 },
    ], st, update);
    f.prepend(
      select('Trafikkode (TSI)', 'kode', [['P1', 'P1 (højhastighed)'], ['P2', 'P2'], ['P3', 'P3'], ['P4', 'P4'], ['P5', 'P5'], ['P6', 'P6'], ['F1', 'F1'], ['F2', 'F2'], ['F3', 'F3'], ['F4', 'F4'], ['S', 'S-bane']], opt, update),
      select('Sporkonstruktion', 'spor', [['ballast', 'Ballasteret spor'], ['fast', 'Fast befæstet spor']], opt, update),
      select('Kurvens yderside', 'yder', [['1', 'Højre (+x)'], ['-1', 'Venstre (−x)']], opt, update),
      select('Vis vedligeholdelsestillæg', 'tillaeg', [['ja', 'Ja (projektering)'], ['nej', 'Nej (drift)']], opt, update),
    );
    root.append(h('div', { class: 'grid' }, card('Input', f, 'card-input'), card('Resultat', out, 'card-out')));
    update();
  },
};
