import {
  krav, geometri, areal, kolonne, faldTilladt, FALD_TEKST, type Fald, pbTillaeg, pbTillaegGaelder, SVELLE_DATA, PROJEKT_TEKST, type Projekt, type Svelletype, type Parametre, type SporInput,
} from '../core/bn16';
import { tsiTrackCentres } from '../core/tsi';
import { setReport } from '../core/report';
import type { Status } from '../core/rules';
import { tvaerprofilSvg, type RendeTegning, type BroendTegning } from '../ui/tvaerprofil';
import { rendeGeometri, rendeKontrol, aMinOverjord, broendGeometri, broendKontrol, RENDE_NOTER, SPYD_NOTER, BROEND_NOTER, SKINNE_YDERKANT, type RendeParam, type RendePlacering, type BroendParam } from '../core/kabelrende';
import { card, chip, fmt, h, loadState, saveState, select, type Module } from '../ui/dom';

interface State extends Parametre {
  V: number; A: number; L: number; R: number;
  h1: number; h2: number;
  /** Kabelrende (BN1-13-4) */
  rA: number; rB: number; rH: number; rT: number; rBag: number; rSpyd: number;
  /** Brønd (BN1-13-4) */
  bA: number; bB: number; bD: number; bT: number; bBag: number;
}
type Opt = { broend: string; rende: string; rPlac: string; omraade: string; fald: string; projekt: string; sidespor: string; svelle: string; antal: string; ls60: string; yder1: string; yder2: string; auto: string };

const DEF: State = {
  V: 160, A: 22.5, L: 2500, R: 0, h1: 0, h2: 0,
  rA: 4.1, rB: 0.40, rH: 0.30, rT: 0.10, rBag: 0.30, rSpyd: 0.80,
  bA: 2.6, bB: 0.80, bD: 1.00, bT: 0.05, bBag: 0.30,
  Bsk: 0.4, a: 1.5, Bt: 0.3, Ut: 0.25, Pb: 3.8, PbYder: 0, Xp: 40, Xrp: 40, hSkulder: 0, as: 1.5, daemning: 1.0, fs: 4.5,
};

function felt(label: string, value: number, step: number, unit: string, onInput: (v: number) => void, normTxt?: string): HTMLElement {
  const inp = h('input', { type: 'number', inputmode: 'decimal', step: String(step), value: String(value) });
  inp.addEventListener('input', () => {
    const v = parseFloat(inp.value.replace(',', '.'));
    if (Number.isFinite(v)) onInput(v);
  });
  const lbl = h('label', { class: 'ed-f' }, h('span', {}, label), h('div', { class: 'ed-inp' }, inp, h('small', {}, unit)));
  if (normTxt) lbl.append(h('small', { class: 'tp-norm' }, normTxt));
  return lbl;
}

export const tvaerprofil: Module = {
  id: 'tvaerprofil',
  gruppe: 'Overbygning',
  titel: 'Tværprofil (BN1-6)',
  kort: 'Tværprofil',
  ikon: '⏢',
  beskrivelse: 'Sammensæt et tværprofil for ballasteret spor – ét eller to spor, med overhøjde – og kontrollér det mod BN1-6-7.',
  render(root) {
    const st = loadState<State>('tvaerprofil', DEF);
    const opt = loadState<Opt>('tvaerprofil-opt', { broend: 'ingen', rende: 'ingen', rPlac: 'overjord', omraade: 'fri', fald: 'hoejre', projekt: 'nyanlaeg', sidespor: 'nej', svelle: 'S99', antal: '2', ls60: 'ja', yder1: '1', yder2: '1', auto: 'ja' });
    const out = h('div', { class: 'out' });
    const left = h('div', {});
    const paramInputs = new Map<keyof Parametre, { inp: HTMLInputElement; norm: HTMLElement | null; unit: string }>();
    /** Opdatér parameterfelter og kravtekster uden at gentegne panelet (bevarer fokus). */
    const syncParams = () => {
      const k = kravNu();
      const kravMap: Partial<Record<keyof Parametre, number>> = { Bsk: k.Bsk, a: k.a, Bt: k.Bt, Ut: k.Ut, Pb: k.Pb, PbYder: k.PbYderTillaeg, Xp: k.Xp, Xrp: k.Xrp, hSkulder: k.hYder };
      for (const [key, o] of paramInputs) {
        if (document.activeElement !== o.inp) o.inp.value = String(st[key]);
        const kv = kravMap[key];
        if (o.norm && kv !== undefined) o.norm.textContent = `krav ${fmt(kv, o.unit === '‰' ? 0 : 2)} ${o.unit}`;
      }
    };

    const kravNu = () => krav({
      projekt: opt.projekt as Projekt, sidespor: opt.sidespor === 'ja', V: st.V, A: st.A,
      svelle: opt.svelle as Svelletype, L: st.L, ls60: opt.ls60 === 'ja', R: st.R, h: Math.max(st.h1, opt.antal === '2' ? st.h2 : 0),
    });

    const brugNorm = () => {
      const k = kravNu();
      Object.assign(st, { Bsk: k.Bsk, a: k.a, Bt: k.Bt, Ut: k.Ut, Pb: k.Pb, PbYder: k.PbYderTillaeg, Xp: k.Xp, Xrp: k.Xrp, hSkulder: k.hYder });
    };

    const update = () => {
      saveState('tvaerprofil', st);
      saveState('tvaerprofil-opt', opt);
      const k = kravNu();
      const sv = { L: st.L, H: SVELLE_DATA[opt.svelle as Svelletype].H };
      const spor: SporInput[] = [{ h: st.h1, yder: opt.yder1 === '1' ? 1 : -1 }];
      if (opt.antal === '2') spor.push({ h: st.h2, yder: opt.yder2 === '1' ? 1 : -1 });
      const fald: Fald = opt.antal === '1' ? (opt.fald as Fald) : 'tag';
      st.fald = fald;
      // Kabelrender og brønde: planumskronen gøres bred nok til renden/brønden + fri bredde bag (ikke for rende på spyd)
      const rp: RendeParam = { a: st.rA, B: st.rB, H: st.rH, t: st.rT, bag: st.rBag, spydDybde: st.rSpyd, placering: opt.rPlac as RendePlacering };
      const bp: BroendParam = { a: st.bA, B: st.bB, D: st.bD, t: st.bT, bag: st.bBag };
      const siderAf = (v: string): (-1 | 1)[] => (v === 'begge' ? [-1, 1] : v === 'venstre' ? [-1] : v === 'hoejre' ? [1] : []);
      const rSider = siderAf(opt.rende), bSider = siderAf(opt.broend);
      const kroneR = rp.placering === 'spyd' ? 0 : st.rA + st.rB + st.rBag, kroneBr = st.bA + st.bB + st.bBag;
      const krone = (s: -1 | 1) => Math.max(rSider.includes(s) ? kroneR : 0, bSider.includes(s) ? kroneBr : 0);
      st.kroneMin = { L: krone(-1), R: krone(1) };
      const g = geometri(spor, st, sv);
      // Overhøjdens effekt: samme profil uden overhøjde til sammenligning
      const g0 = geometri(spor.map((s) => ({ ...s, h: 0 })), st, sv);
      const dFodL = g0.toeL.x - g.toeL.x, dFodR = g.toeR.x - g0.toeR.x;
      const harH = spor.some((s) => s.h > 0);
      const render: (RendeTegning & { kontrol: ReturnType<typeof rendeKontrol> })[] = rSider.map((side) => {
        const t = side === -1 ? g.spor[0] : g.spor[g.spor.length - 1];
        const rg = rendeGeometri(rp, side, t.cx, g.terraen);
        const kontrol = rendeKontrol({
          r: rp, geo: rg, Pb: side === -1 ? g.PbL : g.PbR, V: st.V, station: opt.omraade === 'station',
          ballastfod: side === -1 ? t.cx - g.toeL.x : g.toeR.x - t.cx, sideTekst: side === -1 ? 'venstre' : 'højre',
        });
        return { ...rg, cx: t.cx, a: st.rA, side, spydDybde: st.rSpyd, kontrol };
      });
      const broende: (BroendTegning & { kontrol: ReturnType<typeof broendKontrol> })[] = bSider.map((side) => {
        const t = side === -1 ? g.spor[0] : g.spor[g.spor.length - 1];
        const bg = broendGeometri(bp, side, t.cx, g.terraen);
        const kontrol = broendKontrol(bp, side === -1 ? t.cx - g.toeL.x : g.toeR.x - t.cx, side === -1 ? 'venstre' : 'højre', bg.bund);
        return { ...bg, cx: t.cx, a: st.bA, side, kontrol };
      });
      const fig = tvaerprofilSvg(g, st, spor, sv, k.saenket, render, broende);

      // Kontrol
      const rows: { label: string; value: string; graense: string; status: Status; kilde?: string }[] = [];
      const chk = (label: string, v: number, min: number, unit: string, d = 2) =>
        rows.push({ label, value: `${fmt(v, d)} ${unit}`, graense: `≥ ${fmt(min, d)} ${unit}`, status: v >= min - 1e-6 ? 'ok' : 'overskredet' });
      chk('Ballastskulderens bredde Bsk', st.Bsk, k.Bsk, 'm');
      chk('Anlæg af ballastskråning a', st.a, k.a, '', 1);
      const btMin = Math.min(...g.spor.map((t) => t.btMin));
      chk('Ballastens tykkelse Bt (mindste under skinnestreng)', btMin, k.Bt, 'm', 3);
      chk('Underballastens tykkelse Ut', st.Ut, k.Ut, 'm');
      // Planumsbredde pr. side: tillæg efter fodnote 4 kun i kurvens yderside, ud fra overhøjden i det yderste spor
      const gaelder = pbTillaegGaelder(opt.projekt as Projekt, kolonne(opt.sidespor === 'ja', st.V));
      const sider = [
        { navn: 'venstre', s: spor[0], yder: spor[0].yder === -1 && spor[0].h >= 5, Pb: g.PbL },
        { navn: 'højre', s: spor[spor.length - 1], yder: spor[spor.length - 1].yder === 1 && spor[spor.length - 1].h >= 5, Pb: g.PbR },
      ];
      for (const sd of sider) {
        const till = sd.yder && gaelder ? pbTillaeg(sd.s.h) : 0;
        const txt = sd.yder ? `kurvens yderside, h = ${fmt(sd.s.h)} mm${till ? `: + ${fmt(till, 2)} m (fodnote 4)` : ''}` : spor.some((s) => s.h >= 5) ? 'kurvens inderside' : 'ret spor';
        chk(`Planumsbredde Pb ${sd.navn} (${txt})`, sd.Pb, k.Pb + till, 'm');
      }
      chk('Hældning af planum Xp', st.Xp, k.Xp, '‰', 0);
      if (opt.antal === '1') {
        const ok = faldTilladt(opt.projekt as Projekt, fald);
        rows.push({ label: 'Planumsform, enkeltspor', value: fald === 'tag' ? 'knæk' : `ensidigt ${fald === 'hoejre' ? '→' : '←'}`, graense: opt.projekt === 'bn1' ? 'ensidigt / knæk' : 'ensidigt (BN2)', status: ok ? 'ok' : 'overskredet' });
      }
      chk('Hældning af råjordsplanum Xrp', st.Xrp, k.Xrp, '‰', 0);
      if (k.hYder > 0) chk('Forhøjet ballastskulder h (kurvens yderside)', st.hSkulder, k.hYder, 'm');
      rows.push({ label: 'Ballastfod inden for planum (Pbb ≥ 0)', value: `${fmt(Math.min(g.pbbL, g.pbbR), 2)} m`, graense: '≥ 0,00 m', status: Math.min(g.pbbL, g.pbbR) >= -1e-6 ? 'ok' : 'overskredet' });
      if (opt.antal === '2') {
        const tc = tsiTrackCentres(st.V);
        if (tc !== null) rows.push({ label: 'Sporafstand fs (TSI INF tabel 4, nye strækninger)', value: `${fmt(st.fs, 2)} m`, graense: `≥ ${fmt(tc, 2)} m`, status: st.fs >= tc - 1e-6 ? 'ok' : 'overskredet' });
      }
      const noter = [...k.noter];
      if (opt.antal === '1' && fald === 'tag' && opt.projekt !== 'bn1') noter.push('Knækpunkt i planum under spormidten ved enkeltspor er udgået på BN2-niveau (BN1-6-7, ændringsliste) – brug ensidigt fald mod grøften/afvandingssystemet (bilag 1). Knæk under spormidten tillades kun på BN1-niveau (afsnit 10.2.3).');
      if (opt.antal === '1' && fald !== 'tag') noter.push(`Ensidigt fald: planum og råjordsplanum hælder ${fmt(st.Xp)} / ${fmt(st.Xrp)} ‰ mod ${fald === 'hoejre' ? 'højre' : 'venstre'} hen over hele bredden, og ballasttykkelsen Bt styres af skinnestrengen på den høje side.`);
      if (harH) {
        noter.push(`Overhøjde: sporet drejes om inderskinnen, så svelleenden og ballastskulderen i ydersiden løftes, og ballastfoden flyttes ${fmt(Math.max(dFodL, dFodR) * 1000)} mm udad (planum fastholdt af Bt under den laveste skinnestreng). Derfor kræver BN1-6-7 fodnote 4 en større planumsbredde i kurvens yderside.`);
        if (!gaelder) noter.push(opt.projekt === 'nyanlaeg'
          ? 'Nyanlægstabellen (fig. 15.1-3) har intet Pb-tillæg for overhøjde – overhøjdens effekt kontrolleres i stedet ved, at ballastfoden ligger inden for planum (Pbb ≥ 0).'
          : '200 < V ≤ 250 km/t: Pb = 3,80 m uden fodnote 4-tillæg – overhøjdens effekt kontrolleres ved Pbb ≥ 0.');
      }
      for (const r of render) rows.push(...r.kontrol);
      for (const b of broende) rows.push(...b.kontrol);
      if (render.length) noter.push(...RENDE_NOTER);
      if (render.length && rp.placering === 'spyd') noter.push(...SPYD_NOTER);
      if (broende.length) noter.push(...BROEND_NOTER);
      const total: Status = rows.some((r) => r.status === 'overskredet') ? 'overskredet' : 'ok';

      // Mængder pr. m spor
      const sleeperShare = (SVELLE_DATA[opt.svelle as Svelletype].H / 1000) * (st.L / 1000) * (0.3 / 0.625) * spor.length;
      const aBallast = Math.max(0, areal(g.ballast) - sleeperShare);
      const aUb = areal(g.underballast);
      const bredde = g.edgeR.x - g.edgeL.x;

      out.innerHTML = `
        <div class="summary summary-${total}">
          <div><strong>${PROJEKT_TEKST[opt.projekt as Projekt]}</strong><span>${opt.sidespor === 'ja' ? 'Sidespor' : `Hoved-/togvejsspor, V = ${st.V} km/t`} · ${opt.antal === '2' ? 'dobbeltspor' : 'enkeltspor'} · ${SVELLE_DATA[opt.svelle as Svelletype].navn}</span></div>
          ${chip(total)}
        </div>
        ${fig}
        <div class="two">
          <div>
            <h3>Kontrol mod BN1-6-7</h3>
            <table class="tbl"><tbody>${rows.map((r) => `<tr><td>${r.label}</td><td>${r.value}</td><td>${r.graense}</td><td>${chip(r.status)}</td></tr>`).join('')}</tbody></table>
          </div>
          <div>
            <h3>Mængder pr. m spor (overslag)</h3>
            <table class="tbl tbl-kv"><tbody>
              <tr><td>Ballast (ekskl. sveller)</td><td>${fmt(aBallast, 2)} m³/m</td></tr>
              <tr><td>Underballast</td><td>${fmt(aUb, 2)} m³/m</td></tr>
              <tr><td>Planumsbredde i alt</td><td>${fmt(bredde, 2)} m</td></tr>
              ${render.filter((r) => r.spyd.length).map((r) => `<tr><td>Spydlængder ${r.side === -1 ? 'venstre' : 'højre'} (inkl. ${fmt(st.rSpyd, 2)} m nedramning)</td><td>${r.spyd.map((s) => fmt(s.laengde, 2)).join(' / ')} m</td></tr>`).join('')}
              ${Math.abs(g.crestR.x - g.crestL.x - bredde) > 1e-6 ? `<tr><td>Kronebredde i alt (inkl. banket)</td><td>${fmt(g.crestR.x - g.crestL.x, 2)} m</td></tr>` : ''}
              ${g.spor.map((t, i) => `<tr><td>Bt spor ${i + 1} (venstre / højre streng)</td><td>${fmt(t.btVenstre, 3)} / ${fmt(t.btHoejre, 3)} m</td></tr>`).join('')}
              <tr><td>Planumsbanket Pbb (v / h)</td><td>${fmt(g.pbbL, 2)} / ${fmt(g.pbbR, 2)} m</td></tr>
              ${harH ? `<tr><td>Overhøjdens flytning af ballastfoden (v / h)</td><td>${dFodL >= 0 ? '+' : ''}${fmt(dFodL * 1000)} / ${dFodR >= 0 ? '+' : ''}${fmt(dFodR * 1000)} mm</td></tr>` : ''}
            </tbody></table>
          </div>
        </div>
        ${noter.length ? `<div class="notice">${noter.map((n) => `• ${n}`).join('<br/>')}</div>` : ''}
        <p class="tip">Ballastskulderen følger svelleoverkanten og er parallel med SO-planet; sporene drejes om inderskinnen. Planum og råjordsplanum ${opt.antal === '2' ? 'falder udad fra midten mellem sporene' : fald === 'tag' ? 'falder udad fra spormidten' : `har ensidigt fald mod ${fald === 'hoejre' ? 'højre' : 'venstre'}`}, og planum lægges, så den mindste ballasttykkelse under en skinnestreng netop er Bt. Sporafstand: se BN1-154. Mængderne er et overslag (svellernes andel er fratrukket med 0,3 m bredde pr. 0,625 m).</p>
      `;
      setReport({
        modul: 'Tværprofil (BN1-6-7)',
        inputs: [
          { label: 'Projekttype', symbol: '', value: PROJEKT_TEKST[opt.projekt as Projekt], unit: '' },
          { label: 'Spor', symbol: '', value: `${opt.sidespor === 'ja' ? 'Sidespor' : 'Hoved-/togvejsspor'}, ${opt.antal === '2' ? 'dobbeltspor' : 'enkeltspor'}`, unit: '' },
          { label: 'Hastighed / aksellast', symbol: 'V / A', value: `${st.V} km/t / ${fmt(st.A, 1)} t`, unit: '' },
          { label: 'Svelle', symbol: 'L', value: `${SVELLE_DATA[opt.svelle as Svelletype].navn}, ${st.L} mm`, unit: '' },
          { label: 'Overhøjde spor 1 / 2', symbol: 'h', value: `${st.h1}${opt.antal === '2' ? ` / ${st.h2}` : ''}`, unit: 'mm' },
          { label: 'Kurveradius', symbol: 'R', value: st.R > 0 ? fmt(st.R) : 'ret spor', unit: 'm' },
          { label: 'Bsk / a / Bt / Ut / Pb / Pb-tillæg yderside', symbol: '', value: `${fmt(st.Bsk, 2)} / ${fmt(st.a, 1)} / ${fmt(st.Bt, 2)} / ${fmt(st.Ut, 2)} / ${fmt(st.Pb, 2)} / ${fmt(st.PbYder ?? 0, 2)}`, unit: 'm' },
          { label: 'Xp / Xrp', symbol: '', value: `${st.Xp} / ${st.Xrp}`, unit: '‰' },
          ...(render.length ? [{ label: 'Kabelrende (BN1-13-4)', symbol: 'a / B×H / t', value: `${opt.rende === 'begge' ? 'begge sider' : opt.rende}, ${opt.rPlac === 'overjord' ? 'over jord' : opt.rPlac === 'spyd' ? 'på spyd' : 'nedgravet'}: ${fmt(st.rA, 2)} m / ${fmt(st.rB, 2)}×${fmt(st.rH, 2)} m / ${fmt(st.rT, 2)} m`, unit: '' }] : []),
          ...(broende.length ? [{ label: 'Brønd (BN1-13-4)', symbol: 'a / B / D / t', value: `${opt.broend === 'begge' ? 'begge sider' : opt.broend}: ${fmt(st.bA, 2)} / ${fmt(st.bB, 2)} / ${fmt(st.bD, 2)} / ${fmt(st.bT, 2)} m`, unit: '' }] : []),
          { label: 'Planumsform', symbol: '', value: opt.antal === '1' ? FALD_TEKST[fald] : 'Knæk midt mellem sporene', unit: '' },
          ...(opt.antal === '2' ? [{ label: 'Sporafstand', symbol: 'fs', value: fmt(st.fs, 2), unit: 'm' }] : []),
        ],
        steps: [
          { label: 'Krav (projekttype og kolonne)', formel: PROJEKT_TEKST[opt.projekt as Projekt], indsat: opt.sidespor === 'ja' ? 'sidespor' : `V = ${st.V} km/t`, resultat: `Bsk ${fmt(k.Bsk, 2)} · Bt ${fmt(k.Bt, 2)} · Ut ${fmt(k.Ut, 2)} · Pb ${fmt(k.Pb, 2)}` },
          ...g.spor.map((t, i) => ({ label: `Ballasttykkelse spor ${i + 1}`, formel: 'planum − svelleunderside under skinnestreng', indsat: `${fmt(t.btVenstre, 3)} / ${fmt(t.btHoejre, 3)}`, resultat: `min ${fmt(t.btMin, 3)} m` })),
          { label: 'Planumsbredde', formel: 'Pb (+ tillæg i kurvens yderside, fodnote 4)', indsat: `${fmt(st.Pb, 2)} + ${fmt(st.PbYder ?? 0, 2)}`, resultat: `v ${fmt(g.PbL, 2)} / h ${fmt(g.PbR, 2)} m` },
          { label: 'Ballastfod', formel: 'skråning 1:a fra skulderkant til planum', indsat: '', resultat: `Pbb ${fmt(g.pbbL, 2)} / ${fmt(g.pbbR, 2)} m` },
          ...(harH ? [{ label: 'Overhøjdens effekt på ballastfod', formel: 'fod(h) − fod(h = 0)', indsat: 'rotation om inderskinnen', resultat: `v ${fmt(dFodL * 1000)} / h ${fmt(dFodR * 1000)} mm` }] : []),
          ...render.map((r) => ({ label: `Kabelrende ${r.side === -1 ? 'venstre' : 'højre'}`, formel: 'a − (½·1435 + 72 mm) = afstand til nærmeste skinne', indsat: `${fmt(st.rA, 2)} − ${fmt(SKINNE_YDERKANT, 3)}`, resultat: `${fmt(st.rA - SKINNE_YDERKANT, 2)} m · top ${fmt(r.top, 2)} m under laveste SO${r.spyd.length ? ` · spyd ${r.spyd.map((s) => fmt(s.laengde, 2)).join(' / ')} m` : ''}` })),
          { label: 'Ballastmængde', formel: 'tværsnitsareal − svelleandel', indsat: '', resultat: `${fmt(aBallast, 2)} m³/m` },
          { label: 'Underballastmængde', formel: 'tværsnitsareal', indsat: '', resultat: `${fmt(aUb, 2)} m³/m` },
        ],
        checks: rows.map((r) => ({ ...r, kilde: r.kilde ?? 'BN1-6-7' })),
        noter,
        refs: ['BN1-6', ...(render.length || broende.length ? ['BN1-13'] : []), 'BN1-154', 'BN1-38', 'TSI-INF'],
        figur: fig,
      });
    };

    const renderLeft = () => {
      left.innerHTML = '';
      const sel = h('div', { class: 'fields' },
        select('Projekttype', 'projekt', [['nyanlaeg', 'Nyanlæg (BN2)'], ['fornyelse', 'Sporfornyelse (BN2)'], ['bn1', 'BN1-minimum (tilladelse)']], opt, () => { if (opt.auto === 'ja') brugNorm(); renderLeft(); update(); }),
        select('Spor', 'sidespor', [['nej', 'Hoved- / togvejsspor'], ['ja', 'Sidespor']], opt, () => { if (opt.auto === 'ja') brugNorm(); renderLeft(); update(); }),
        select('Antal spor', 'antal', [['1', 'Enkeltspor'], ['2', 'Dobbeltspor']], opt, () => { renderLeft(); update(); }),
        select('Svelle', 'svelle', Object.entries(SVELLE_DATA).map(([k, v]) => [k, v.navn]), opt, () => { st.L = SVELLE_DATA[opt.svelle as Svelletype].L; if (opt.auto === 'ja') brugNorm(); renderLeft(); update(); }),
        select('Langskinnespor med 60 kg/m', 'ls60', [['ja', 'Ja'], ['nej', 'Nej']], opt, () => { if (opt.auto === 'ja') brugNorm(); renderLeft(); update(); }),
        select('Følg normkrav automatisk', 'auto', [['ja', 'Ja – parametre sættes til normkrav'], ['nej', 'Nej – jeg angiver selv']], opt, () => { if (opt.auto === 'ja') brugNorm(); renderLeft(); update(); }),
      );
      const re = () => { if (opt.auto === 'ja') brugNorm(); syncParams(); update(); };
      const k = kravNu();
      const g1 = h('div', { class: 'ed-fields' },
        felt('Hastighed V', st.V, 10, 'km/t', (v) => { st.V = v; re(); }),
        felt('Aksellast A', st.A, 0.5, 't', (v) => { st.A = v; re(); }),
        felt('Svellelængde L', st.L, 10, 'mm', (v) => { st.L = v; re(); }),
        felt('Radius R (0 = ret)', st.R, 10, 'm', (v) => { st.R = v; re(); }),
        felt('Overhøjde spor 1', st.h1, 5, 'mm', (v) => { st.h1 = v; re(); }),
        ...(opt.antal === '2' ? [felt('Overhøjde spor 2', st.h2, 5, 'mm', (v) => { st.h2 = v; re(); }), felt('Sporafstand fs', st.fs, 0.05, 'm', (v) => { st.fs = v; update(); })] : []),
      );
      const yder = h('div', { class: 'fields' },
        select('Kurvens yderside, spor 1', 'yder1', [['1', 'Højre'], ['-1', 'Venstre']], opt, update),
        ...(opt.antal === '1' ? [select('Planumsfald', 'fald', (Object.keys(FALD_TEKST) as Fald[]).map((f) => [f, FALD_TEKST[f]]), opt, update)] : []),
        ...(opt.antal === '2' ? [select('Kurvens yderside, spor 2', 'yder2', [['1', 'Højre'], ['-1', 'Venstre']], opt, update)] : []),
      );
      const man = opt.auto !== 'ja';
      const pv = (key: keyof Parametre, label: string, step: number, unit: string, norm: number) => {
        const el = felt(label, st[key] as number, step, unit, (v) => {
          (st as unknown as Record<string, number>)[key] = v;
          if (!man) { opt.auto = 'nej'; saveState('tvaerprofil-opt', opt); const s2 = left.querySelectorAll('select')[5] as HTMLSelectElement | undefined; if (s2) s2.value = 'nej'; }
          update();
        }, `krav ${fmt(norm, unit === '‰' ? 0 : 2)} ${unit}`);
        paramInputs.set(key, { inp: el.querySelector('input') as HTMLInputElement, norm: el.querySelector('.tp-norm'), unit });
        return el;
      };
      paramInputs.clear();
      const g2 = h('div', { class: 'ed-fields' },
        pv('Bsk', 'Bsk', 0.05, 'm', k.Bsk),
        pv('a', 'Anlæg a', 0.1, '', k.a),
        pv('Bt', 'Bt', 0.01, 'm', k.Bt),
        pv('Ut', 'Ut', 0.01, 'm', k.Ut),
        pv('Pb', 'Pb', 0.05, 'm', k.Pb),
        pv('PbYder', 'Pb-tillæg yderside', 0.05, 'm', k.PbYderTillaeg),
        pv('Xp', 'Xp', 5, '‰', k.Xp),
        pv('Xrp', 'Xrp', 5, '‰', k.Xrp),
        pv('hSkulder', 'h skulder (yderside)', 0.01, 'm', k.hYder),
        felt('Baneskråning as', st.as, 0.1, '', (v) => { st.as = v; update(); }),
        felt('Dæmningshøjde', st.daemning, 0.1, 'm', (v) => { st.daemning = v; update(); }),
      );
      const reset = h('button', { class: 'btn-ghost btn-sm', type: 'button' }, 'Sæt parametre til normkrav');
      reset.addEventListener('click', () => { brugNorm(); renderLeft(); update(); });
      // Kabelrende (BN1-13-4)
      const rSel = h('div', { class: 'fields' },
        select('Kabelrende', 'rende', [['ingen', 'Ingen'], ['hoejre', 'Højre side'], ['venstre', 'Venstre side'], ['begge', 'Begge sider']], opt, () => { renderLeft(); update(); }),
        ...(opt.rende !== 'ingen' ? [
          select('Placering', 'rPlac', [['overjord', 'Over jord (på planumskronen)'], ['spyd', 'På spyd i baneskråningen'], ['nedgravet', 'Nedgravet']], opt, () => { st.rT = opt.rPlac === 'overjord' ? 0.10 : opt.rPlac === 'spyd' ? Math.round((st.rH + 0.1) * 100) / 100 : -0.50; renderLeft(); update(); }),
          select('Område', 'omraade', [['fri', 'Fri strækning'], ['station', 'Stationsområde']], opt, update),
        ] : []),
      );
      const rFelter = opt.rende === 'ingen' ? [] : [h('div', { class: 'ed-fields' },
        felt('a fra spormidte', st.rA, 0.05, 'm', (v) => { st.rA = v; update(); }, opt.rPlac === 'overjord' ? `min. ${fmt(aMinOverjord(st.V, Math.max(st.Pb + (st.PbYder ?? 0))), 2)} m` : 'min. 2,50 m'),
        felt('Bredde B', st.rB, 0.05, 'm', (v) => { st.rB = v; update(); }),
        felt('Højde H', st.rH, 0.05, 'm', (v) => { st.rH = v; update(); }),
        felt(opt.rPlac === 'nedgravet' ? 'Top over terræn (−)' : opt.rPlac === 'spyd' ? 'Top over terræn ved inderside' : 'Top over terræn', st.rT, 0.05, 'm', (v) => { st.rT = v; update(); }, opt.rPlac === 'overjord' ? '0 – 0,20 m' : opt.rPlac === 'spyd' ? `≥ H = ${fmt(st.rH, 2)} m` : 'negativ = dækning'),
        opt.rPlac === 'spyd'
          ? felt('Spydets nedramning', st.rSpyd, 0.1, 'm', (v) => { st.rSpyd = v; update(); }, 'antaget')
          : felt('Fri bredde bag renden', st.rBag, 0.05, 'm', (v) => { st.rBag = v; update(); }),
      )];
      // Brønd (BN1-13-4)
      const bSel = h('div', { class: 'fields' },
        select('Brønd', 'broend', [['ingen', 'Ingen'], ['hoejre', 'Højre side'], ['venstre', 'Venstre side'], ['begge', 'Begge sider']], opt, () => { renderLeft(); update(); }),
      );
      const bFelter = opt.broend === 'ingen' ? [] : [h('div', { class: 'ed-fields' },
        felt('a til nærmeste flade', st.bA, 0.05, 'm', (v) => { st.bA = v; update(); }, 'min. 2,50 m (2,30 m)'),
        felt('Bredde B', st.bB, 0.05, 'm', (v) => { st.bB = v; update(); }),
        felt('Bund under terræn', st.bD, 0.05, 'm', (v) => { st.bD = v; update(); }),
        felt('Dæksel over terræn', st.bT, 0.05, 'm', (v) => { st.bT = v; update(); }),
        felt('Fri bredde bag brønden', st.bBag, 0.05, 'm', (v) => { st.bBag = v; update(); }),
      )];
      const rMin = h('button', { class: 'btn-ghost btn-sm', type: 'button' }, 'Placér renden så tæt på sporet som tilladt');
      rMin.addEventListener('click', () => {
        const g0 = geometri([{ h: st.h1, yder: opt.yder1 === '1' ? 1 : -1 }], { ...st, kroneMin: {} }, { L: st.L, H: SVELLE_DATA[opt.svelle as Svelletype].H });
        const pb = Math.max(g0.PbL, g0.PbR, opt.antal === '2' ? st.Pb + (st.PbYder ?? 0) : 0);
        st.rA = opt.rPlac !== 'nedgravet' ? Math.ceil((aMinOverjord(st.V, pb) - 1e-9) * 20) / 20 : 2.5;
        if (opt.rPlac === 'overjord') st.rT = Math.min(Math.max(st.rT, 0), 0.2);
        renderLeft(); update();
      });
      left.append(sel, h('div', { class: 'ed-sec' }, 'Spor'), g1, yder, h('div', { class: 'ed-sec' }, 'Tværprofilets parametre'), g2, h('div', { class: 'ed-add' }, reset),
        h('div', { class: 'ed-sec' }, 'Kabelrende (BN1-13-4)'), rSel, ...rFelter, ...(opt.rende !== 'ingen' ? [h('div', { class: 'ed-add' }, rMin)] : []),
        h('div', { class: 'ed-sec' }, 'Brønd (BN1-13-4)'), bSel, ...bFelter);
    };

    if (opt.auto === 'ja') brugNorm();
    renderLeft();
    root.append(h('div', { class: 'grid' }, card('Opbygning', left, 'card-input card-scroll'), card('Tværprofil', out, 'card-out')));
    update();
  },
};
