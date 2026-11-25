import {
  krav, geometri, areal, SVELLE_DATA, PROJEKT_TEKST, type Projekt, type Svelletype, type Parametre, type SporInput,
} from '../core/bn16';
import { tsiTrackCentres } from '../core/tsi';
import { setReport } from '../core/report';
import type { Status } from '../core/rules';
import { tvaerprofilSvg } from '../ui/tvaerprofil';
import { card, chip, fmt, h, loadState, saveState, select, type Module } from '../ui/dom';

interface State extends Parametre {
  V: number; A: number; L: number; R: number;
  h1: number; h2: number;
}
type Opt = { projekt: string; sidespor: string; svelle: string; antal: string; ls60: string; yder1: string; yder2: string; auto: string };

const DEF: State = {
  V: 160, A: 22.5, L: 2500, R: 0, h1: 0, h2: 0,
  Bsk: 0.4, a: 1.5, Bt: 0.3, Ut: 0.25, Pb: 3.8, Xp: 40, Xrp: 40, hSkulder: 0, as: 1.5, daemning: 1.0, fs: 4.5,
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
    const opt = loadState<Opt>('tvaerprofil-opt', { projekt: 'nyanlaeg', sidespor: 'nej', svelle: 'S99', antal: '2', ls60: 'ja', yder1: '1', yder2: '1', auto: 'ja' });
    const out = h('div', { class: 'out' });
    const left = h('div', {});
    const paramInputs = new Map<keyof Parametre, { inp: HTMLInputElement; norm: HTMLElement | null; unit: string }>();
    /** Opdatér parameterfelter og kravtekster uden at gentegne panelet (bevarer fokus). */
    const syncParams = () => {
      const k = kravNu();
      const kravMap: Partial<Record<keyof Parametre, number>> = { Bsk: k.Bsk, a: k.a, Bt: k.Bt, Ut: k.Ut, Pb: k.Pb + k.PbYderTillaeg, Xp: k.Xp, Xrp: k.Xrp, hSkulder: k.hYder };
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
      Object.assign(st, { Bsk: k.Bsk, a: k.a, Bt: k.Bt, Ut: k.Ut, Pb: k.Pb + k.PbYderTillaeg, Xp: k.Xp, Xrp: k.Xrp, hSkulder: k.hYder });
    };

    const update = () => {
      saveState('tvaerprofil', st);
      saveState('tvaerprofil-opt', opt);
      const k = kravNu();
      const sv = { L: st.L, H: SVELLE_DATA[opt.svelle as Svelletype].H };
      const spor: SporInput[] = [{ h: st.h1, yder: opt.yder1 === '1' ? 1 : -1 }];
      if (opt.antal === '2') spor.push({ h: st.h2, yder: opt.yder2 === '1' ? 1 : -1 });
      const g = geometri(spor, st, sv);
      const fig = tvaerprofilSvg(g, st, spor, sv, k.saenket);

      // Kontrol
      const rows: { label: string; value: string; graense: string; status: Status }[] = [];
      const chk = (label: string, v: number, min: number, unit: string, d = 2) =>
        rows.push({ label, value: `${fmt(v, d)} ${unit}`, graense: `≥ ${fmt(min, d)} ${unit}`, status: v >= min - 1e-6 ? 'ok' : 'overskredet' });
      chk('Ballastskulderens bredde Bsk', st.Bsk, k.Bsk, 'm');
      chk('Anlæg af ballastskråning a', st.a, k.a, '', 1);
      const btMin = Math.min(...g.spor.map((t) => t.btMin));
      chk('Ballastens tykkelse Bt (mindste under skinnestreng)', btMin, k.Bt, 'm', 3);
      chk('Underballastens tykkelse Ut', st.Ut, k.Ut, 'm');
      const kurve = spor.some((s) => s.h > 0);
      chk(`Planumsbredde Pb${k.PbYderTillaeg && kurve ? ' (kurvens yderside)' : ''}`, st.Pb, k.Pb + (kurve ? k.PbYderTillaeg : 0), 'm');
      chk('Hældning af planum Xp', st.Xp, k.Xp, '‰', 0);
      chk('Hældning af råjordsplanum Xrp', st.Xrp, k.Xrp, '‰', 0);
      if (k.hYder > 0) chk('Forhøjet ballastskulder h (kurvens yderside)', st.hSkulder, k.hYder, 'm');
      rows.push({ label: 'Ballastfod inden for planum (Pbb ≥ 0)', value: `${fmt(Math.min(g.pbbL, g.pbbR), 2)} m`, graense: '≥ 0,00 m', status: Math.min(g.pbbL, g.pbbR) >= -1e-6 ? 'ok' : 'overskredet' });
      if (opt.antal === '2') {
        const tc = tsiTrackCentres(st.V);
        if (tc !== null) rows.push({ label: 'Sporafstand fs (TSI INF tabel 4, nye strækninger)', value: `${fmt(st.fs, 2)} m`, graense: `≥ ${fmt(tc, 2)} m`, status: st.fs >= tc - 1e-6 ? 'ok' : 'overskredet' });
      }
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
              ${g.spor.map((t, i) => `<tr><td>Bt spor ${i + 1} (venstre / højre streng)</td><td>${fmt(t.btVenstre, 3)} / ${fmt(t.btHoejre, 3)} m</td></tr>`).join('')}
              <tr><td>Planumsbanket Pbb (v / h)</td><td>${fmt(g.pbbL, 2)} / ${fmt(g.pbbR, 2)} m</td></tr>
            </tbody></table>
          </div>
        </div>
        ${k.noter.length ? `<div class="notice">${k.noter.map((n) => `• ${n}`).join('<br/>')}</div>` : ''}
        <p class="tip">Ballastskulderen følger svelleoverkanten og er parallel med SO-planet; sporene drejes om inderskinnen. Planum og råjordsplanum falder udad fra ${opt.antal === '2' ? 'midten mellem sporene' : 'spormidten'}, og planum lægges, så den mindste ballasttykkelse under en skinnestreng netop er Bt. Sporafstand: se BN1-154. Mængderne er et overslag (svellernes andel er fratrukket med 0,3 m bredde pr. 0,625 m).</p>
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
          { label: 'Bsk / a / Bt / Ut / Pb', symbol: '', value: `${fmt(st.Bsk, 2)} / ${fmt(st.a, 1)} / ${fmt(st.Bt, 2)} / ${fmt(st.Ut, 2)} / ${fmt(st.Pb, 2)}`, unit: 'm' },
          { label: 'Xp / Xrp', symbol: '', value: `${st.Xp} / ${st.Xrp}`, unit: '‰' },
          ...(opt.antal === '2' ? [{ label: 'Sporafstand', symbol: 'fs', value: fmt(st.fs, 2), unit: 'm' }] : []),
        ],
        steps: [
          { label: 'Krav (projekttype og kolonne)', formel: PROJEKT_TEKST[opt.projekt as Projekt], indsat: opt.sidespor === 'ja' ? 'sidespor' : `V = ${st.V} km/t`, resultat: `Bsk ${fmt(k.Bsk, 2)} · Bt ${fmt(k.Bt, 2)} · Ut ${fmt(k.Ut, 2)} · Pb ${fmt(k.Pb, 2)}` },
          ...g.spor.map((t, i) => ({ label: `Ballasttykkelse spor ${i + 1}`, formel: 'planum − svelleunderside under skinnestreng', indsat: `${fmt(t.btVenstre, 3)} / ${fmt(t.btHoejre, 3)}`, resultat: `min ${fmt(t.btMin, 3)} m` })),
          { label: 'Ballastfod', formel: 'skråning 1:a fra skulderkant til planum', indsat: '', resultat: `Pbb ${fmt(g.pbbL, 2)} / ${fmt(g.pbbR, 2)} m` },
          { label: 'Ballastmængde', formel: 'tværsnitsareal − svelleandel', indsat: '', resultat: `${fmt(aBallast, 2)} m³/m` },
          { label: 'Underballastmængde', formel: 'tværsnitsareal', indsat: '', resultat: `${fmt(aUb, 2)} m³/m` },
        ],
        checks: rows.map((r) => ({ ...r, kilde: 'BN1-6-7' })),
        noter: k.noter,
        refs: ['BN1-6', 'BN1-154', 'BN1-38', 'TSI-INF'],
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
        pv('Pb', 'Pb', 0.05, 'm', k.Pb + k.PbYderTillaeg),
        pv('Xp', 'Xp', 5, '‰', k.Xp),
        pv('Xrp', 'Xrp', 5, '‰', k.Xrp),
        pv('hSkulder', 'h skulder (yderside)', 0.01, 'm', k.hYder),
        felt('Baneskråning as', st.as, 0.1, '', (v) => { st.as = v; update(); }),
        felt('Dæmningshøjde', st.daemning, 0.1, 'm', (v) => { st.daemning = v; update(); }),
      );
      const reset = h('button', { class: 'btn-ghost btn-sm', type: 'button' }, 'Sæt parametre til normkrav');
      reset.addEventListener('click', () => { brugNorm(); renderLeft(); update(); });
      left.append(sel, h('div', { class: 'ed-sec' }, 'Spor'), g1, yder, h('div', { class: 'ed-sec' }, 'Tværprofilets parametre'), g2, h('div', { class: 'ed-add' }, reset));
    };

    if (opt.auto === 'ja') brugNorm();
    renderLeft();
    root.append(h('div', { class: 'grid' }, card('Opbygning', left, 'card-input card-scroll'), card('Tværprofil', out, 'card-out')));
    update();
  },
};
