import {
  bSik, bOph, bPer, genstandKlasse, afstribningKraeves, maksTaethed, opholdsAreal,
  FRI_HOEJDE, PRIK, SKILT_INTERVAL, KORT_GENSTAND_AFSTAND, type Banetype, type Genstand, type PerronForm,
} from '../core/sikkerhedszone';
import { setReport } from '../core/report';
import type { Status } from '../core/rules';
import { card, chip, fmt, form, h, loadState, results, saveState, select, type Module } from '../ui/dom';

type S = { V: number; l: number; bg: number; bfaktisk: number; L: number; P: number; Ag: number };
const DEF: S = { V: 160, l: 4, bg: 1.2, bfaktisk: 0, L: 250, P: 400, Ag: 40 };
type Opt = { bane: string; ten: string; form: string; ende: string; tael: string };

/** Plan af perronens tværsnit (målfast i bredden). */
function zoneFigur(form: PerronForm, sik: number, oph: number, g: Genstand, bg: number, bper: number): string {
  const s = 52; // px pr. m
  const track = 1.4; // m spor vist
  const W = (track + bper + (form === 'oe' ? track : 0)) * s + 40;
  const H = 200;
  const y0 = 46, ph = 100;
  const x0 = 20 + track * s; // perronforkant
  const medG = g !== 'ingen';
  const dots = (x: number) => Array.from({ length: Math.floor(ph / 10.4) }, (_, k) =>
    `<circle cx="${x - 3}" cy="${y0 + 5 + k * 10.4}" r="2.6" class="z-dot"/>`).join('');
  const rails = (x: number) => `<rect x="${x}" y="${y0}" width="${track * s - 10}" height="${ph}" class="z-track"/>
    <line x1="${x + 14}" y1="${y0}" x2="${x + 14}" y2="${y0 + ph}" class="z-rail"/>
    <line x1="${x + track * s - 30}" y1="${y0}" x2="${x + track * s - 30}" y2="${y0 + ph}" class="z-rail"/>`;
  let parts = rails(20);
  const zone = (x: number, w: number, cls: string, label: string) =>
    `<rect x="${x}" y="${y0}" width="${w * s}" height="${ph}" class="${cls}"/>
     <text x="${x + (w * s) / 2}" y="${y0 + ph + 20}" text-anchor="middle" class="lbl-svg">${label}</text>
     <text x="${x + (w * s) / 2}" y="${y0 + ph + 36}" text-anchor="middle" class="lbl-svg muted">${fmt(w, 2)} m</text>`;
  let x = x0;
  parts += zone(x, sik, 'z-sik', 'b<tspan font-size="8">sik</tspan>') + dots(x + sik * s);
  x += sik * s;
  parts += zone(x, oph, 'z-oph', 'b<tspan font-size="8">oph</tspan>');
  x += oph * s;
  if (medG) { parts += zone(x, bg, 'z-g', 'b<tspan font-size="8">g</tspan>'); x += bg * s; }
  if (form === 'oe') {
    if (medG) { parts += zone(x, oph, 'z-oph', 'b<tspan font-size="8">oph</tspan>'); x += oph * s; }
    parts += zone(x, sik, 'z-sik', 'b<tspan font-size="8">sik</tspan>') + dots(x + 6);
    x += sik * s;
    parts += rails(x);
  } else {
    parts += `<line x1="${x}" y1="${y0 - 6}" x2="${x}" y2="${y0 + ph + 6}" class="z-back"/>`;
  }
  return `
  <svg viewBox="0 0 ${Math.max(W, x + 20)} ${H}" class="viz viz-zone" role="img" aria-label="Sikkerheds- og opholdszoner på perron">
    ${parts}
    <line x1="${x0}" y1="${y0 - 14}" x2="${x0}" y2="${y0 + ph}" class="z-edge"/>
    <text x="${x0 + 4}" y="${y0 - 6}" class="lbl-svg">Perronforkant</text>
    <text x="20" y="${y0 - 6}" class="lbl-svg muted">Spor</text>
    <text x="20" y="14" class="lbl-svg muted">Plan · målfast i bredden</text>
  </svg>`;
}

export const sikkerhedszone: Module = {
  id: 'sikkerhedszone',
  gruppe: 'I sporet',
  titel: 'Sikkerhedszoner på perron',
  kort: 'Sikkerhedszone',
  ikon: '⚠',
  beskrivelse: 'Bredde af sikkerheds- og opholdszoner, mindste perronbredde, afstribning, skiltning og passagertæthed (BN1-9-2).',
  render(root) {
    const st = loadState<S>('sikkerhedszone', DEF);
    const opt = loadState<Opt>('sikkerhedszone-opt', { bane: 'fjern', ten: 'nej', form: 'side', ende: 'nej', tael: 'nej' });
    const out = h('div', { class: 'out' });

    const update = () => {
      saveState('sikkerhedszone', st);
      saveState('sikkerhedszone-opt', opt);
      const bane = opt.bane as Banetype, form = opt.form as PerronForm;
      const g = genstandKlasse(st.l);
      const medG = g !== 'ingen';
      const sik = bSik(st.V, bane);
      const oph = bOph(st.V, g, opt.ende === 'ja');
      const ingenOphold = sik === null || oph === null;
      const bmin = ingenOphold ? NaN : bPer(form, sik!, oph!, medG, st.bg);
      const bf = ingenOphold ? NaN : sik! + oph!;
      const stribe = afstribningKraeves(st.V, opt.ten === 'ja', bane);
      const sB: Status | null = st.bfaktisk > 0 && !ingenOphold ? (st.bfaktisk >= bmin - 1e-9 ? 'ok' : 'overskredet') : null;
      const bTegn = st.bfaktisk > 0 ? st.bfaktisk : bmin;
      const dMax = maksTaethed(bane);
      const sikTotal = (sik ?? 0) * (form === 'oe' ? 2 : 1);
      const areal = !ingenOphold && st.L > 0 ? opholdsAreal(bTegn, st.L, sikTotal, st.Ag) : NaN;
      const d = st.P > 0 && areal > 0 ? st.P / areal : NaN;
      const sD: Status | null = opt.tael === 'ja' && Number.isFinite(d) ? (d <= dMax + 1e-9 ? 'ok' : 'overskredet') : null;
      const nSkilte = Math.max(1, Math.ceil(st.L / SKILT_INTERVAL));
      const total: Status = [sB, sD].includes('overskredet') || ingenOphold ? 'overskredet' : 'ok';
      const gTxt = g === 'ingen' ? 'Ingen genstand' : g === 'g1' ? 'g1: kort genstand (l < 1 m)' : g === 'g2' ? 'g2: 1 ≤ l < 10 m' : 'g3: l ≥ 10 m';
      const fig = ingenOphold ? '' : zoneFigur(form, sik!, oph!, g, st.bg, bTegn);

      out.innerHTML = ingenOphold ? `
        <div class="summary summary-overskredet"><div><strong>Intet ophold på perron</strong>
        <span>${bane === 'sbane' && st.V > 160 ? 'BN1-9-2 angiver kun krav til S-baner for V ≤ 160 km/t' : 'Ved V > 200 km/t må der ikke være ophold på perronen (fig. 10.1-1 og 11.2-1)'}</span></div>${chip('overskredet')}</div>` : `
        <div class="summary summary-${total}">
          <div><strong>Mindste perronbredde</strong><span>${form === 'side' ? 'Sideperron' : 'Ø-/mellemperron'} · ${gTxt}</span></div>
          <div class="summary-val">${fmt(bmin, 2)} m</div>
        </div>
        ${results([
          { symbol: 'b<sub>sik</sub>', label: 'Sikkerhedszone', value: fmt(sik!, 2), unit: 'm', big: true, sub: `fig. 10.1-1 · ${bane === 'sbane' ? 'S-bane' : 'fjernbane'}, V = ${st.V} km/t` },
          { symbol: 'b<sub>oph</sub>', label: 'Opholdszone', value: fmt(oph!, 2), unit: 'm', big: true, sub: `fig. 11.2-1${opt.ende === 'ja' ? ' · indsnævret ved perronende' : ''}` },
          { symbol: 'b<sub>f</sub>', label: 'Fri bredde forkant → genstand', value: fmt(bf, 2), unit: 'm', sub: 'b<sub>sik</sub> + b<sub>oph</sub> (bilag 1)' },
          { symbol: 'b<sub>per</sub>', label: 'Mindste perronbredde', value: fmt(bmin, 2), unit: 'm', sub: form === 'side' ? (medG ? 'b<sub>sik</sub> + b<sub>oph</sub> + b<sub>g</sub>' : 'b<sub>sik</sub> + b<sub>oph</sub>') : (medG ? '2·b<sub>sik</sub> + 2·b<sub>oph</sub> + b<sub>g</sub>' : '2·b<sub>sik</sub> + b<sub>oph</sub>') },
          ...(st.bfaktisk > 0 ? [{ symbol: 'b<sub>faktisk</sub>', label: 'Faktisk perronbredde', value: fmt(st.bfaktisk, 2), unit: 'm', status: sB!, sub: `${st.bfaktisk >= bmin ? 'overskud' : 'mangler'} ${fmt(Math.abs(st.bfaktisk - bmin), 2)} m` }] : []),
          { symbol: 'H', label: 'Fri højde i zonerne', value: `≥ ${fmt(FRI_HOEJDE, 1)}`, unit: 'm', sub: 'fra belægning til underkant af genstand (afsn. 10.2)' },
          ...(opt.tael === 'ja' ? [{ symbol: 'd', label: 'Passagertæthed (nyanlæg)', value: Number.isFinite(d) ? fmt(d, 2) : '–', unit: 'pers./m²', status: sD ?? undefined, sub: `≤ ${fmt(dMax, 1)} · opholdsareal ${fmt(areal)} m²` }] : []),
        ])}
        <h3>Tværsnit af perronen</h3>
        ${fig}
        <h3>Afstribning og skiltning</h3>
        <ul class="consts">
          <li>Afstribning af sikkerhedszone: <strong>${stribe ? 'Kræves' : 'Kræves ikke'}</strong> ${stribe ? `(${opt.ten === 'ja' ? 'TEN-strækning' : st.V > 160 ? 'V > 160 km/t' : 'S-bane'})` : '(ikke TEN, V ≤ 160 km/t, fjernbane)'}</li>
          ${stribe ? `<li>Gule cirkulære prikker Ø${PRIK.diameter} mm med c/c ${PRIK.centerafstand} mm, højde ${PRIK.hoejde}. Afstribningens bagkant = ${fmt(sik!, 2)} m fra perronforkant.</li>
          <li>Skilte «Sikkerheds- og opholdszone»: ved alle adgangsveje og for hver ${SKILT_INTERVAL} m langs perronen – ca. <strong>${nSkilte}</strong> på ${fmt(st.L)} m perron (pr. perronside).</li>` : ''}
          <li>Skilt «Perronende» på alle perroner, hvor perronenden ikke er afsluttet i fuld bredde. Afstribning af perronende kun på TEN-strækninger${opt.ten === 'ja' ? ' – <strong>kræves her</strong>' : ''}.</li>
          <li>Der må ikke placeres genstande i sikkerhedszonen. Korte genstande med indbyrdes afstand under ${fmt(KORT_GENSTAND_AFSTAND, 1)} m regnes som lange.</li>
        </ul>
      `;

      setReport({
        modul: 'Sikkerheds- og opholdszoner på perron (BN1-9-2)',
        inputs: [
          { label: 'Banetype', symbol: '', value: bane === 'sbane' ? 'S-bane' : 'Fjernbane', unit: '' },
          { label: 'TEN-strækning', symbol: '', value: opt.ten === 'ja' ? 'Ja' : 'Nej', unit: '' },
          { label: 'Hastighed langs perron (TIB)', symbol: 'V', value: fmt(st.V), unit: 'km/t' },
          { label: 'Perronform', symbol: '', value: form === 'side' ? 'Sideperron' : 'Ø-/mellemperron', unit: '' },
          { label: 'Genstand, længde / bredde', symbol: 'l / b<sub>g</sub>', value: medG ? `${fmt(st.l, 1)} / ${fmt(st.bg, 2)}` : 'ingen', unit: 'm' },
          { label: 'Ved perronende', symbol: '', value: opt.ende === 'ja' ? 'Ja' : 'Nej', unit: '' },
          ...(st.bfaktisk > 0 ? [{ label: 'Faktisk perronbredde', symbol: 'b<sub>per</sub>', value: fmt(st.bfaktisk, 2), unit: 'm' }] : []),
          ...(opt.tael === 'ja' ? [
            { label: 'Perronlængde', symbol: 'L', value: fmt(st.L), unit: 'm' },
            { label: 'Passagerer i spidsbelastning (prognose +10 år)', symbol: 'P', value: fmt(st.P), unit: 'pers.' },
            { label: 'Areal af genstande', symbol: 'A<sub>g</sub>', value: fmt(st.Ag), unit: 'm²' },
          ] : []),
        ],
        steps: ingenOphold ? [{ label: 'Ophold på perron', formel: 'fig. 10.1-1 / 11.2-1', indsat: `V = ${st.V} km/t`, resultat: 'Intet ophold' }] : [
          { label: 'Genstandsklasse', formel: 'def. 5.16–5.18', indsat: medG ? `l = ${fmt(st.l, 1)} m` : '–', resultat: gTxt },
          { label: 'Sikkerhedszone', formel: 'fig. 10.1-1', indsat: `${bane === 'sbane' ? 'S-bane' : 'Fjernbane'}, V = ${st.V} km/t`, resultat: `${fmt(sik!, 2)} m` },
          { label: 'Opholdszone', formel: 'fig. 11.2-1', indsat: `${g}${opt.ende === 'ja' ? ', perronende' : ''}`, resultat: `${fmt(oph!, 2)} m` },
          { label: 'Fri bredde', formel: 'b<sub>f</sub> = b<sub>sik</sub> + b<sub>oph</sub>', indsat: `${fmt(sik!, 2)} + ${fmt(oph!, 2)}`, resultat: `${fmt(bf, 2)} m` },
          { label: 'Mindste perronbredde', formel: 'fig. 11.1-1', indsat: form === 'side' ? `${fmt(sik!, 2)} + ${fmt(oph!, 2)}${medG ? ` + ${fmt(st.bg, 2)}` : ''}` : medG ? `2·${fmt(sik!, 2)} + 2·${fmt(oph!, 2)} + ${fmt(st.bg, 2)}` : `2·${fmt(sik!, 2)} + ${fmt(oph!, 2)}`, resultat: `${fmt(bmin, 2)} m` },
          ...(opt.tael === 'ja' ? [
            { label: 'Opholdsareal', formel: '(b<sub>per</sub> − Σb<sub>sik</sub>)·L − A<sub>g</sub>', indsat: `(${fmt(bTegn, 2)} − ${fmt(sikTotal, 2)})·${fmt(st.L)} − ${fmt(st.Ag)}`, resultat: `${fmt(areal)} m²` },
            { label: 'Passagertæthed', formel: 'd = P / areal', indsat: `${fmt(st.P)} / ${fmt(areal)}`, resultat: `${fmt(d, 2)} pers./m²` },
          ] : []),
          { label: 'Antal zoneskilte pr. side', formel: '⌈L / 50⌉', indsat: `⌈${fmt(st.L)} / 50⌉`, resultat: stribe ? `${nSkilte} stk.` : 'kræves ikke' },
        ],
        checks: [
          ...(sB ? [{ label: 'Perronbredde', value: `${fmt(st.bfaktisk, 2)} m`, graense: `≥ ${fmt(bmin, 2)} m`, status: sB, kilde: 'BN1-9-2 fig. 11.1-1 (BN2)' }] : []),
          ...(sD ? [{ label: 'Passagertæthed ved nyanlæg', value: `${fmt(d, 2)} pers./m²`, graense: `≤ ${fmt(dMax, 1)} pers./m²`, status: sD, kilde: 'BN1-9-2 afsn. 10 (BN1)' }] : []),
        ],
        noter: [
          'b<sub>sik</sub> er BN1-krav (fig. 10.1-1); b<sub>oph</sub> og b<sub>per</sub> er BN2-krav (fig. 11.1-1 og 11.2-1). Perroner skal desuden opfylde TSI PRM.',
          `Fri højde i sikkerheds- og opholdszoner mindst ${fmt(FRI_HOEJDE, 1)} m (afsn. 10.2).`,
          'Hvor reglerne gælder for eksisterende perroner (fx kun ved nyanlæg, fornyelse eller større ombygning), se BN1-9-2 afsn. 7 og note 7-6.',
          'Tabeller fra BN1-9-2 (udgivet 01.06.2012). Kontrollér om en nyere udgave er gældende.',
        ],
        refs: ['BN1-9', 'TSI-PRM', 'BN1-49'],
        figur: fig,
      });
    };

    const f = form<keyof S>([
      { key: 'V', label: 'Hastighed langs perron (TIB)', symbol: 'V', unit: 'km/t', min: 10, max: 250, step: 5 },
      { key: 'l', label: 'Genstandens længde (0 = ingen)', symbol: 'l', unit: 'm', min: 0, max: 30, step: 0.1, hint: 'g1: l < 1 m · g2: 1–10 m · g3: ≥ 10 m' },
      { key: 'bg', label: 'Genstandens bredde', symbol: 'b<sub>g</sub>', unit: 'm', min: 0, max: 6, step: 0.05 },
      { key: 'bfaktisk', label: 'Faktisk perronbredde (0 = ingen)', symbol: 'b<sub>per</sub>', unit: 'm', min: 0, max: 15, step: 0.05 },
      { key: 'L', label: 'Perronlængde', symbol: 'L', unit: 'm', min: 10, max: 500, step: 5 },
      { key: 'P', label: 'Passagerer i spidsbelastning', symbol: 'P', unit: 'pers.', min: 0, max: 5000, step: 10, hint: 'Prognose 10 år efter ibrugtagning.' },
      { key: 'Ag', label: 'Samlet areal af genstande', symbol: 'A<sub>g</sub>', unit: 'm²', min: 0, max: 1000, step: 1 },
    ], st, update);
    f.prepend(
      select('Banetype', 'bane', [['fjern', 'Fjernbane'], ['sbane', 'S-bane']], opt, update),
      select('TEN-strækning', 'ten', [['nej', 'Nej'], ['ja', 'Ja']], opt, update),
      select('Perronform', 'form', [['side', 'Sideperron'], ['oe', 'Ø-perron / mellemperron']], opt, update),
      select('Tværsnit ved perronende', 'ende', [['nej', 'Nej'], ['ja', 'Ja (b_oph ≥ 1,6 m)']], opt, update),
      select('Kontrollér passagertæthed (nyanlæg)', 'tael', [['nej', 'Nej'], ['ja', 'Ja']], opt, update),
    );
    root.append(h('div', { class: 'grid' }, card('Input', f, 'card-input'), card('Resultat', out, 'card-out')));
    update();
  },
};
