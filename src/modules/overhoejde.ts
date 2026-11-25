import { BANEDANMARK as rs, vurder, samletStatus, limitI, loadSettings, projekteretSporvidde, sporudvidelse } from '../core/rules';
import {
  cantConstant, equilibriumCant, cantDeficiency, cantExcess, lateralAcceleration, cantWindow, roundTo,
} from '../core/formulas';
import { setReport } from '../core/report';
import { tsiCurveChecks } from '../core/tsi';
import { kvalitetsklasse, ABS_OVH, OVH_AFVIGELSE, lavVridMax, vridGraense } from '../core/bn138';
import { trackCrossSection } from '../ui/track';
import { card, fmt, form, h, limitText, loadState, results, saveState, chip, graense, kildeTekst, select, tsiBlock, bn138Block, type Module } from '../ui/dom';

type S = { R: number; V: number; Vmin: number; h: number };
const DEF: S = { R: 1200, V: 160, Vmin: 80, h: 110 };
type Opt = { sporskifte: string; svelle: string; perron: string };

export const overhoejde: Module = {
  id: 'overhoejde',
  gruppe: 'Linjeføring',
  titel: 'Overhøjde',
  kort: 'Overhøjde',
  ikon: '◢',
  beskrivelse: 'Afbalanceret overhøjde, overhøjdeunderskud og -overskud samt tilladt overhøjdeinterval (Sporregler afsn. 2.03).',
  render(root) {
    const st = loadState<S>('overhoejde', DEF);
    const opt = loadState<Opt>('overhoejde-opt', { sporskifte: 'nej', svelle: 'S99', perron: 'nej' });
    const out = h('div', { class: 'out' });

    const update = () => {
      saveState('overhoejde', st);
      saveState('overhoejde-opt', opt);
      const set = loadSettings();
      const C = cantConstant(rs);
      const LI = opt.sporskifte === 'ja' && st.V > 100 ? rs.manglendeOverhoejdeSporskifte : limitI(rs, st.V, set);
      const heq = equilibriumCant(st.V, st.R, rs);
      const heqMin = equilibriumCant(st.Vmin, st.R, rs);
      const I = cantDeficiency(st.V, st.R, st.h, rs);
      const E = cantExcess(st.Vmin, st.R, st.h, rs);
      const aq = lateralAcceleration(I, rs);
      const sH = vurder(st.h, rs.overhoejdeMax);
      const sI = I > 0 ? vurder(I, LI) : 'ok';
      const sE = E > 0 ? vurder(E, rs.overskydendeOverhoejdeMax) : 'ok';
      const total = samletStatus([sH, sI, sE]);

      const wN = cantWindow(st.V, st.Vmin, st.R, LI.normal, rs.overskydendeOverhoejdeMax.normal, rs.overhoejdeMax.normal, rs);
      const wU = cantWindow(st.V, st.Vmin, st.R, LI.undtagelse, rs.overskydendeOverhoejdeMax.undtagelse, rs.overhoejdeMax.undtagelse, rs);
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
      const tsiRows = set.tsi ? tsiCurveChecks({
        R: st.R, V: st.V, h: st.h, I: Math.max(0, I), trafik: set.tsiTrafik, spor: set.tsiSpor,
        perron: opt.perron === 'ja', nyStraekning: set.nyStraekning,
      }) : [];
      const kk = kvalitetsklasse(st.V);
      const abs = ABS_OVH[set.tsiTrafik];
      const tol1 = OVH_AFVIGELSE[kk][1];
      const hTol = st.h + tol1;
      const lav = lavVridMax(st.R, st.h);
      const vg3 = vridGraense(kk, 3);
      const bnRows = [
        { label: `Absolut overhøjde + udførelsestolerance (fejlkl. 1, kvalitetsklasse ${kk})`, value: `${fmt(st.h)} + ${tol1} = ${fmt(hTol)} mm`, graense: `≤ ${abs.fk4} mm (fk 4) · Max ${abs.max} mm`,
          status: (hTol <= abs.fk4 ? 'ok' : hTol <= abs.max ? 'undtagelse' : 'overskredet') as 'ok' | 'undtagelse' | 'overskredet',
          tekst: hTol <= abs.fk4 ? undefined : hTol <= abs.max ? 'Ingen margin' : undefined, kilde: 'BN1-38-6 tabel 11.3.2-1' },
        ...(st.R <= 500 ? [{ label: 'Vridningsgrænse (Max, 3 m) i kurven', value: lav ? `h > (R − 100)/2 = ${fmt((st.R - 100) / 2)}` : `h ≤ (R − 100)/2 = ${fmt((st.R - 100) / 2)}`, graense: `Max ${fmt(lav ? vg3.max[0] : vg3.max[1], 1)} mm/m`, status: 'ok' as const, tekst: lav ? 'Skærpet' : 'Normal', kilde: 'BN1-38-6 afsnit 17' }] : []),
      ];
      const fig = trackCrossSection({ svelle: opt.svelle as 'S99' | 'S16', h: st.h, V: st.V });

      out.innerHTML = `
        <div class="summary summary-${total}">
          <div><strong>Samlet vurdering</strong><span>R ${fmt(st.R)} m · V ${st.V} km/t · h ${st.h} mm</span></div>
          ${chip(total)}
        </div>
        ${results([
          { symbol: 'h<sub>a</sub>', label: 'Afbalanceret overhøjde (V)', value: fmt(heq), unit: 'mm', big: true,
            sub: `h<sub>a</sub> = ${fmt(C, 2)}·V²/R` },
          { symbol: 'I', label: 'Overhøjdeunderskud', value: fmt(I), unit: 'mm', status: sI, big: true, sub: limitText(LI) },
          { symbol: 'E', label: 'Overhøjdeoverskud (V<sub>min</sub>)', value: fmt(E), unit: 'mm', status: sE,
            sub: limitText(rs.overskydendeOverhoejdeMax) },
          { symbol: 'h', label: 'Valgt overhøjde', value: fmt(st.h), unit: 'mm', status: sH, sub: limitText(rs.overhoejdeMax) },
          { symbol: 'a<sub>q</sub>', label: 'Ukompenseret sideacceleration', value: fmt(aq, 2), unit: 'm/s²',
            sub: '1,0 m/s² svarer til 153 mm' },
          { symbol: 'h<sub>a,min</sub>', label: 'Afbalanceret for V<sub>min</sub>', value: fmt(heqMin), unit: 'mm' },
          { symbol: 'G', label: 'Projekteret sporvidde', value: fmt(projekteretSporvidde(st.R, set.sporvidde)), unit: 'mm', sub: sporudvidelse(st.R) ? `1435 + ${sporudvidelse(st.R)} mm sporudvidelse (Sporregler 2.12)` : 'ingen sporudvidelse (R ≥ 190 m)' },
        ])}
        <div class="window">
          <div class="window-head">
            <strong>Tilladt overhøjdeinterval</strong>
            <span>${wN.muligt ? `${fmt(wN.lav)}–${fmt(wN.hoej)} mm (normal)` : '<em class="bad">Intet normalt interval</em>'}
            ${wU.muligt ? ` · ${fmt(wU.lav)}–${fmt(wU.hoej)} mm (undt.)` : ''}</span>
          </div>
          <div class="track">
            ${bar(wU, 'win-u')}${bar(wN, 'win-n')}
            <div class="mark mark-h" style="left:${pct(st.h)}"><span>h</span></div>
            <div class="mark mark-eq" style="left:${pct(heq)}"><span>h<sub>a</sub></span></div>
          </div>
          <div class="scale"><span>0</span><span>${fmt(scaleMax / 2)}</span><span>${fmt(scaleMax)} mm</span></div>
          ${Number.isFinite(forslag)
            ? `<p class="tip">Forslag: <strong>h = ${fmt(forslag)} mm</strong> – midt i normalintervallet, afrundet til 5 mm.
               <button class="btn-link" data-apply="${forslag}">Brug forslag</button></p>`
            : `<p class="tip bad">Radius er for lille til både V = ${st.V} og V<sub>min</sub> = ${st.Vmin} km/t inden for normalbestemmelserne. Øg R, sænk V eller hæv V<sub>min</sub>.</p>`}
        </div>
        ${bn138Block(bnRows, `BN1-38 måler absolut overhøjde fra 0-linjen. Projekteret overhøjde plus den tilladte afvigelse efter justering bør holde sig under fejlklasse 4, ellers vil sporet hurtigt give målevognsfejl. Trafiktype styres under Regelgrundlag.`)}
        ${tsiBlock(tsiRows, `TSI-indstillinger: ${set.tsiTrafik === 'person' ? 'ren persontrafik' : 'blandet trafik'}, ${set.tsiSpor === 'ballast' ? 'ballasteret' : 'fast'} spor${set.nyStraekning ? ', ny strækning' : ''} (ændres under Regelgrundlag). Godsvogne efter TSI WAG: I ≤ 130 mm ved V ≤ 160 km/t.`)}
        <h3>Tværprofil i kurven (ægte skala)</h3>
        ${fig}
      `;
      out.querySelector<HTMLButtonElement>('[data-apply]')?.addEventListener('click', (e) => {
        st.h = Number((e.currentTarget as HTMLElement).dataset.apply);
        root.innerHTML = '';
        overhoejde.render(root);
      });

      setReport({
        modul: 'Overhøjde',
        inputs: [
          { label: 'Kurveradius', symbol: 'R', value: fmt(st.R), unit: 'm' },
          { label: 'Strækningshastighed', symbol: 'V', value: fmt(st.V), unit: 'km/t' },
          { label: 'Laveste hastighed', symbol: 'V<sub>min</sub>', value: fmt(st.Vmin), unit: 'km/t' },
          { label: 'Overhøjde', symbol: 'h', value: fmt(st.h), unit: 'mm' },
          { label: 'Krumt sporskifte', symbol: '', value: opt.sporskifte === 'ja' ? 'Ja' : 'Nej', unit: '' },
          { label: 'Skinneprofil', symbol: '', value: set.skinne, unit: '' },
        ],
        steps: [
          { label: 'Konstant', formel: 'C = e / (g·3,6²)', indsat: `C = ${rs.kontaktafstand} / (${rs.g}·3,6²)`, resultat: fmt(C, 3) },
          { label: 'Afbalanceret overhøjde', formel: 'h<sub>a</sub> = C·V²/R', indsat: `${fmt(C, 3)}·${st.V}²/${fmt(st.R)}`, resultat: `${fmt(heq, 1)} mm` },
          { label: 'Overhøjdeunderskud', formel: 'I = h<sub>a</sub> − h', indsat: `${fmt(heq, 1)} − ${st.h}`, resultat: `${fmt(I, 1)} mm` },
          { label: 'Afbalanceret ved V<sub>min</sub>', formel: 'h<sub>a,min</sub> = C·V<sub>min</sub>²/R', indsat: `${fmt(C, 3)}·${st.Vmin}²/${fmt(st.R)}`, resultat: `${fmt(heqMin, 1)} mm` },
          { label: 'Overhøjdeoverskud', formel: 'E = h − h<sub>a,min</sub>', indsat: `${st.h} − ${fmt(heqMin, 1)}`, resultat: `${fmt(E, 1)} mm` },
          { label: 'Sideacceleration', formel: 'a<sub>q</sub> = g·I/e', indsat: `${rs.g}·${fmt(I, 1)}/${rs.kontaktafstand}`, resultat: `${fmt(aq, 3)} m/s²` },
          { label: 'Nedre grænse for h', formel: 'h ≥ h<sub>a</sub> − I<sub>max</sub>', indsat: `${fmt(heq, 1)} − ${LI.normal}`, resultat: `${fmt(Math.max(0, heq - LI.normal), 1)} mm` },
          { label: 'Øvre grænse for h', formel: 'h ≤ min(h<sub>max</sub>; h<sub>a,min</sub> + E<sub>max</sub>)', indsat: `min(${rs.overhoejdeMax.normal}; ${fmt(heqMin, 1)} + ${rs.overskydendeOverhoejdeMax.normal})`, resultat: `${fmt(wN.hoej, 1)} mm` },
        ],
        checks: [
          { label: 'Overhøjde h', value: `${fmt(st.h)} mm`, graense: graense(rs.overhoejdeMax), status: sH, kilde: kildeTekst(rs.overhoejdeMax) },
          { label: 'Overhøjdeunderskud I', value: `${fmt(I, 1)} mm`, graense: graense(LI), status: sI, kilde: kildeTekst(LI) },
          { label: 'Overhøjdeoverskud E', value: `${fmt(E, 1)} mm`, graense: graense(rs.overskydendeOverhoejdeMax), status: sE, kilde: kildeTekst(rs.overskydendeOverhoejdeMax) },
          ...bnRows.map((r) => ({ ...r, label: `BN1-38: ${r.label}` })),
          ...tsiRows.map((r) => ({ ...r, label: `TSI: ${r.label}` })),
        ],
        noter: [
          wN.muligt ? `Tilladt interval (normal): ${fmt(wN.lav)}–${fmt(wN.hoej)} mm. Forslag: h = ${fmt(forslag)} mm.` : 'Der findes intet tilladt overhøjdeinterval efter normalbestemmelserne.',
          'Lavere overhøjde kan være krævet ved perroner, overkørsler og hvor tog skal holde stille (Sporregler afsn. 2.03).',
        ],
        refs: ['SR87', 'ST16', 'EN13803', ...(opt.sporskifte === 'ja' ? ['BN1-14'] : []), 'BN1-6', 'BN1-38', ...(tsiRows.length ? ['TSI-INF'] : [])],
        figur: fig,
      });
    };

    const f = form<keyof S>(
      [
        { key: 'R', label: 'Kurveradius', symbol: 'R', unit: 'm', min: 150, max: 10000, step: 10 },
        { key: 'V', label: 'Strækningshastighed', symbol: 'V', unit: 'km/t', min: 10, max: 300, step: 5 },
        { key: 'Vmin', label: 'Laveste hastighed (gods)', symbol: 'V<sub>min</sub>', unit: 'km/t', min: 0, max: 200, step: 5,
          hint: 'Bruges til overhøjdeoverskud E.' },
        { key: 'h', label: 'Overhøjde', symbol: 'h', unit: 'mm', min: 0, max: 180, step: 5 },
      ],
      st,
      update,
    );
    f.append(
      select('Krumt sporskifte (vigespor / U-krumt)', 'sporskifte', [['nej', 'Nej – almindeligt spor'], ['ja', 'Ja – I ≤ 80 mm ved V > 100']], opt, update),
      select('Perron hvor tog standser (TSI: h ≤ 110 mm)', 'perron', [['nej', 'Nej'], ['ja', 'Ja']], opt, update),
      select('Svelle i tegning', 'svelle', [['S99', 'S99 (Dmp)'], ['S16', 'S16 (Dme)']], opt, update),
    );
    root.append(h('div', { class: 'grid' }, card('Input', f, 'card-input'), card('Resultat', out, 'card-out')));
    update();
  },
};
