import { BANEDANMARK as rs, vurder, samletStatus, limitI, loadSettings, projekteretSporvidde, sporudvidelse, limitH, limitISporskifte, hMaxAfsporing, hOenskelig, type Status } from '../core/rules';
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
      const LI = opt.sporskifte === 'ja' ? limitISporskifte(rs, st.V) : limitI(rs, st.V, set);
      const HL = limitH(rs, { trafik: set.tsiTrafik, sporskifte: opt.sporskifte === 'ja', perron: opt.perron === 'ja' });
      const h4a = hMaxAfsporing(st.R);
      const s4a: Status = st.h <= h4a + 1e-9 ? 'ok' : 'overskredet';
      const hOen = hOenskelig(st.V, st.R);
      const sV200: Status = opt.sporskifte === 'ja' && st.V > 200 && st.h > 0 ? 'overskredet' : 'ok';
      const heq = equilibriumCant(st.V, st.R, rs);
      const heqMin = equilibriumCant(st.Vmin, st.R, rs);
      const I = cantDeficiency(st.V, st.R, st.h, rs);
      const E = cantExcess(st.Vmin, st.R, st.h, rs);
      const aq = lateralAcceleration(I, rs);
      const sH = vurder(st.h, HL);
      const sI = I > 0 ? vurder(I, LI) : 'ok';
      const sE = E > 0 ? vurder(E, rs.overskydendeOverhoejdeMax) : 'ok';
      const total = samletStatus([sH, sI, sE, s4a, sV200]);

      const wN = cantWindow(st.V, st.Vmin, st.R, LI.normal, rs.overskydendeOverhoejdeMax.normal, HL.normal, rs);
      const wU = cantWindow(st.V, st.Vmin, st.R, LI.undtagelse, rs.overskydendeOverhoejdeMax.undtagelse, HL.undtagelse, rs);
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
            sub: `h<sub>a</sub> = ${fmt(C, 1)}·V²/R` },
          { symbol: 'I', label: 'Overhøjdeunderskud', value: fmt(I), unit: 'mm', status: sI, big: true, sub: limitText(LI) },
          { symbol: 'E', label: 'Overhøjdeoverskud (V<sub>min</sub>)', value: fmt(E), unit: 'mm', status: sE,
            sub: limitText(rs.overskydendeOverhoejdeMax) },
          { symbol: 'h', label: 'Valgt overhøjde', value: fmt(st.h), unit: 'mm', status: sH, sub: limitText(HL) },
          { symbol: 'h<sub>4a</sub>', label: 'Afsporingskrav (formel 4a)', value: `≤ ${fmt(Math.max(0, Math.floor(h4a)))}`, unit: 'mm', status: s4a, sub: 'h ≤ (R − 50)/1,5 – skal altid overholdes' },
          { symbol: 'h<sub>ø</sub>', label: 'Ønskelig overhøjde (formel 4)', value: fmt(hOen), unit: 'mm', sub: 'h = 8·V²/R, dog højst 115 mm' },
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
          { label: 'Konstant', formel: 'C (Sporregler formel 1)', indsat: '≈ e / (g·3,6²) = 1500 / (9,81·3,6²) = 11,798', resultat: fmt(C, 1) },
          { label: 'Afbalanceret overhøjde', formel: 'h<sub>a</sub> = C·V²/R', indsat: `${fmt(C, 1)}·${st.V}²/${fmt(st.R)}`, resultat: `${fmt(heq, 1)} mm` },
          { label: 'Overhøjdeunderskud', formel: 'I = h<sub>a</sub> − h', indsat: `${fmt(heq, 1)} − ${st.h}`, resultat: `${fmt(I, 1)} mm` },
          { label: 'Afbalanceret ved V<sub>min</sub>', formel: 'h<sub>a,min</sub> = C·V<sub>min</sub>²/R', indsat: `${fmt(C, 1)}·${st.Vmin}²/${fmt(st.R)}`, resultat: `${fmt(heqMin, 1)} mm` },
          { label: 'Overhøjdeoverskud', formel: 'E = h − h<sub>a,min</sub>', indsat: `${st.h} − ${fmt(heqMin, 1)}`, resultat: `${fmt(E, 1)} mm` },
          { label: 'Sideacceleration', formel: 'a<sub>q</sub> = g·I/e', indsat: `${rs.g}·${fmt(I, 1)}/${rs.kontaktafstand}`, resultat: `${fmt(aq, 3)} m/s²` },
          { label: 'Nedre grænse for h', formel: 'h ≥ h<sub>a</sub> − I<sub>max</sub>', indsat: `${fmt(heq, 1)} − ${LI.normal}`, resultat: `${fmt(Math.max(0, heq - LI.normal), 1)} mm` },
          { label: 'Øvre grænse for h', formel: 'h ≤ min(h<sub>max</sub>; h<sub>a,min</sub> + E<sub>max</sub>; (R − 50)/1,5)', indsat: `min(${HL.normal}; ${fmt(heqMin, 1)} + ${rs.overskydendeOverhoejdeMax.normal}; ${fmt(h4a, 1)})`, resultat: `${fmt(wN.hoej, 1)} mm` },
          { label: 'Ønskelig overhøjde', formel: 'h = 8·V²/R ≤ 115 mm (formel 4)', indsat: `8·${st.V}²/${fmt(st.R)}`, resultat: `${fmt(hOen, 1)} mm` },
        ],
        checks: [
          { label: HL.label, value: `${fmt(st.h)} mm`, graense: graense(HL), status: sH, kilde: kildeTekst(HL) },
          { label: 'Afsporingskrav h ≤ (R − 50)/1,5', value: `${fmt(st.h)} mm`, graense: `≤ ${fmt(h4a, 1)} mm`, status: s4a, kilde: 'SR87 afsn. 2.03.3 formel (4a)' },
          ...(opt.sporskifte === 'ja' && st.V > 200 ? [{ label: 'Sporskifte ved 200 < V ≤ 250 km/t', value: `h = ${fmt(st.h)} mm`, graense: 'ret spor uden overhøjde', status: sV200, kilde: 'SR87 afsn. 2.03.6' }] : []),
          { label: 'Overhøjdeunderskud I', value: `${fmt(I, 1)} mm`, graense: graense(LI), status: sI, kilde: kildeTekst(LI) },
          { label: 'Overhøjdeoverskud E', value: `${fmt(E, 1)} mm`, graense: graense(rs.overskydendeOverhoejdeMax), status: sE, kilde: kildeTekst(rs.overskydendeOverhoejdeMax) },
          ...bnRows.map((r) => ({ ...r, label: `BN1-38: ${r.label}` })),
          ...tsiRows.map((r) => ({ ...r, label: `TSI: ${r.label}` })),
        ],
        noter: [
          wN.muligt ? `Tilladt interval (normal): ${fmt(wN.lav)}–${fmt(wN.hoej)} mm. Forslag: h = ${fmt(forslag)} mm.` : 'Der findes intet tilladt overhøjdeinterval efter normalbestemmelserne.',
          'Overhøjdegrænser efter situation (2.03.4–2.03.5): stenballast 160 mm (undt. 180 mm kun for spor reserveret persontrafik), sporskifter 120/160 mm, grusballast 80 mm, langs perroner 60/110 mm. Overkørsler: højst 40 mm på ret spor (2.03.8).',
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
      select('Sporskifte (krumt / i kurve)', 'sporskifte', [['nej', 'Nej – almindeligt spor'], ['ja', 'Ja – h ≤ 120 mm, I ≤ 100/80 mm']], opt, update),
      select('Langs perron', 'perron', [['nej', 'Nej'], ['ja', 'Ja – h ≤ 60 mm (undt. 110 mm)']], opt, update),
      select('Svelle i tegning', 'svelle', [['S99', 'S99 (Dmp)'], ['S16', 'S16 (Dme)']], opt, update),
    );
    root.append(h('div', { class: 'grid' }, card('Input', f, 'card-input'), card('Resultat', out, 'card-out')));
    update();
  },
};
