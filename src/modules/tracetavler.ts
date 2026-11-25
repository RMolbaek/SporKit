import {
  horisontaleTavler, vertikaleTavler, kmTekst, TAVLE_TOLERANCE, type Element, type Overgang, type Knaek, type Tavle,
} from '../core/tracetavle';
import { BANEDANMARK as rs, vurder, limitI, loadSettings, samletStatus, type Status } from '../core/rules';
import { equilibriumCant, transitionLengths } from '../core/formulas';
import { TSI_RV_MIN, TSI_KILDE } from '../core/tsi';
import { setReport } from '../core/report';
import { kvalitetsklasse, vridGraense, rampeVridning, lavVridMax } from '../core/bn138';
import { card, chip, fmt, h, loadState, saveState, select, type Module } from '../ui/dom';

interface State {
  startKm: number;
  V: number;
  spor: string;
  elementer: Element[];
  overgange: Overgang[];
  knaek: Knaek[];
}

const DEF: State = {
  startKm: 12.0,
  V: 120,
  spor: 'dobbelt',
  elementer: [
    { type: 'ret', L: 50 },
    { type: 'bue', R: 1200, h: 65, L: 200 },
    { type: 'ret', L: 50 },
  ],
  overgange: [{ okl: 65, rpl: 0, rstart: 0 }, { okl: 70, rpl: 0, rstart: 0 }],
  knaek: [{ pos: 200, i1: 4, i2: -2, Rv: 10000 }],
};

/* ------------------------------ tegning af tavle ------------------------------ */

export function plate(t: Tavle, km: string): string {
  const f = (v: unknown) => `<span class="pl-v">${v === undefined || v === '' ? '&nbsp;' : v}</span>`;
  return `<div class="plate plate-${t.plan}">
    <div class="pl-km">km ${km}</div>
    <div class="pl-body">
      <span class="pl-l">Rad</span>${f(t.rad)}<span class="pl-l">Okl</span>${f(t.okl)}
      <span class="pl-l">Kvl</span>${f(t.kvl)}<span class="pl-l"></span><span class="pl-sym">${t.symbol}</span>
      <span class="pl-l">Ovh</span>${f(t.ovh)}<span class="pl-l">Rpl</span>${f(t.rpl)}
    </div>
    <div class="pl-pkt">${t.punkt}</div>
  </div>`;
}

/* ------------------------------ diagram ------------------------------ */

function diagram(st: State, hor: ReturnType<typeof horisontaleTavler>, ver: Tavle[]): string {
  const W = 640, H = 230, l = 14, r = 14;
  const total = Math.max(hor.laengde, ...ver.map((t) => t.pos), 1);
  const X = (p: number) => l + ((W - l - r) * p) / total;
  const kOf = (e: Element) => (e.type === 'bue' && (e.R ?? 0) > 0 ? 1 / (e.R as number) : 0);
  const hOf = (e: Element) => (e.type === 'bue' ? e.h ?? 0 : 0);
  const kMax = Math.max(1e-9, ...st.elementer.map(kOf));
  const hMax = Math.max(1, ...st.elementer.map(hOf));
  const yK = (k: number) => 110 - (80 * k) / kMax;
  const yH = (v: number) => 110 - (60 * v) / hMax;
  // krumning
  const kp: string[] = [];
  st.elementer.forEach((e, i) => {
    const s = hor.elementStart[i];
    kp.push(`${X(s)},${yK(kOf(e))}`, `${X(s + e.L)},${yK(kOf(e))}`);
  });
  // overhøjde
  const hp: [number, number][] = [[0, hOf(st.elementer[0])]];
  st.overgange.slice(0, st.elementer.length - 1).forEach((t, i) => {
    const s0 = hor.overgangStart[i];
    const sam = t.rpl <= 0 || (Math.abs(t.rpl - t.okl) < 0.05 && Math.abs(t.rstart) < 0.05);
    const a = sam ? s0 : s0 + t.rstart, b = sam ? s0 + t.okl : a + t.rpl;
    hp.push([a, hOf(st.elementer[i])], [b, hOf(st.elementer[i + 1])]);
  });
  hp.push([hor.laengde, hOf(st.elementer[st.elementer.length - 1])]);
  hp.sort((p, q) => p[0] - q[0]);
  const marks = hor.tavler.map((t) => `
    <line x1="${X(t.pos)}" y1="20" x2="${X(t.pos)}" y2="150" class="tick"/>
    <text x="${X(t.pos)}" y="166" text-anchor="middle" class="lbl-svg tt-sym">${t.symbol}</text>`).join('');
  const vmarks = ver.map((t) => `
    <line x1="${X(t.pos)}" y1="182" x2="${X(t.pos)}" y2="200" class="tick"/>
    <text x="${X(t.pos)}" y="214" text-anchor="middle" class="lbl-svg tt-sym">${t.symbol.replace('\\', '\\')}</text>`).join('');
  return `
  <svg viewBox="0 0 ${W} ${H}" class="viz viz-tt" role="img" aria-label="Kurveforløb med tracétavler">
    <line x1="${l}" y1="110" x2="${W - r}" y2="110" class="axis"/>
    <polyline points="${kp.join(' ')}" class="curve-h"/>
    <polyline points="${hp.map(([p, v]) => `${X(p)},${yH(v)}`).join(' ')}" class="curve-i"/>
    ${marks}
    <line x1="${l}" y1="191" x2="${W - r}" y2="191" class="axis"/>
    ${vmarks}
    <text x="${l}" y="14" class="lbl-svg muted">Linjeføring: pilhøjde (1/R, fuld) og overhøjde (stiplet) · km ${kmTekst(st.startKm, 0)} – ${kmTekst(st.startKm, total)}</text>
    <text x="${l}" y="180" class="lbl-svg muted">Længdeprofil</text>
  </svg>`;
}

/* ------------------------------ editor ------------------------------ */

function numInput(label: string, value: number, step: number, onInput: (v: number) => void, unit = ''): HTMLElement {
  const inp = h('input', { type: 'number', inputmode: 'decimal', step: String(step), value: String(value) });
  inp.addEventListener('input', () => {
    const v = parseFloat(inp.value.replace(',', '.'));
    if (Number.isFinite(v)) onInput(v);
  });
  return h('label', { class: 'ed-f' }, h('span', {}, label), h('div', { class: 'ed-inp' }, inp, h('small', {}, unit)));
}

export const tracetavler: Module = {
  id: 'tracetavler',
  gruppe: 'I sporet',
  titel: 'Tracétavler',
  kort: 'Tracétavler',
  ikon: '▣',
  beskrivelse: 'Udfyld og kontrollér tracétavler (fast afmærkning) ud fra sporets linjeføring og længdeprofil efter BN2-93.',
  render(root) {
    const st = loadState<State>('tracetavler', DEF);
    if (!Array.isArray(st.elementer) || st.elementer.length < 1) Object.assign(st, structuredClone(DEF));
    const out = h('div', { class: 'out' });
    const editor = h('div', { class: 'editor' });

    const update = () => {
      saveState('tracetavler', st);
      const set = loadSettings();
      const nT = Math.max(0, st.elementer.length - 1);
      while (st.overgange.length < nT) st.overgange.push({ okl: 0, rpl: 0, rstart: 0 });
      st.overgange.length = nT;
      const hor = horisontaleTavler(st.elementer, st.overgange);
      const ver = vertikaleTavler(st.knaek);
      const alle = [...hor.tavler, ...ver.tavler].sort((a, b) => a.pos - b.pos || (a.plan === 'H' ? -1 : 1));
      const km = (p: number) => kmTekst(st.startKm, p);

      // ---------- kontrol ----------
      interface Chk { label: string; value: string; graense: string; status: Status; kilde: string }
      const checks: Chk[] = [];
      const V = st.V;
      const hOf = (e: Element) => (e.type === 'bue' ? e.h ?? 0 : 0);
      const IOf = (e: Element) => (e.type === 'bue' && (e.R ?? 0) > 0 ? equilibriumCant(V, e.R as number, rs) - hOf(e) : 0);
      st.elementer.forEach((e, i) => {
        if (e.type !== 'bue') return;
        const LI = limitI(rs, V, set);
        checks.push({ label: `Bue ${i + 1} (R ${fmt(e.R ?? 0)}): overhøjde`, value: `${fmt(hOf(e))} mm`, graense: `≤ ${rs.overhoejdeMax.normal} / ${rs.overhoejdeMax.undtagelse} mm`, status: vurder(hOf(e), rs.overhoejdeMax), kilde: 'SR87 afsn. 2.03 · sekundær' });
        const I = IOf(e);
        checks.push({ label: `Bue ${i + 1} (R ${fmt(e.R ?? 0)}): overhøjdeunderskud`, value: `${fmt(I)} mm`, graense: `≤ ${LI.normal} / ${LI.undtagelse} mm`, status: I > 0 ? vurder(I, LI) : 'ok', kilde: 'SR87 afsn. 2.03 · sekundær' });
      });
      st.overgange.forEach((t, i) => {
        const a = st.elementer[i], b = st.elementer[i + 1];
        if (!a || !b || (a.type === 'ret' && b.type === 'ret')) return;
        const dh = hOf(b) - hOf(a), dI = IOf(b) - IOf(a);
        const Rref = b.type === 'bue' ? b.R ?? 1000 : a.R ?? 1000;
        const kr = transitionLengths({ V, R: Rref, dh, dI }, rs);
        const okKrav = kr.find((k) => k.id === 'dIdt')!;
        const rampKrav = kr.filter((k) => k.id !== 'dIdt');
        const rN = Math.max(...rampKrav.map((k) => k.normal)), rU = Math.max(...rampKrav.map((k) => k.undtagelse));
        const sam = t.rpl <= 0 || (Math.abs(t.rpl - t.okl) < 0.05 && Math.abs(t.rstart) < 0.05);
        const st3 = (L: number, n: number, u: number): Status => (L >= n - 1e-6 ? 'ok' : L >= u - 1e-6 ? 'undtagelse' : 'overskredet');
        {
          const Lr = sam ? t.okl : t.rpl;
          const kk = kvalitetsklasse(V);
          const g = vridGraense(kk, 3);
          const v = rampeVridning(dh, Lr, 3);
          const lav = lavVridMax(Math.min(a.R ?? Infinity, b.R ?? Infinity), Math.max(hOf(a), hOf(b)));
          if (Math.abs(dh) > 0) checks.push({ label: `Overgang ${i + 1}: vridning fra rampe (3 m)`, value: `${fmt(v, 2)} mm/m`, graense: `+ ${fmt(g.fk1 ?? 0, 1)} ≤ ${fmt(g.fk3 ?? g.fk4, 1)} (fk 3) · Max ${fmt(lav ? g.max[0] : g.max[1], 1)}`, status: v + (g.fk1 ?? 0) <= (g.fk3 ?? g.fk4) ? 'ok' : v <= g.fk4 ? 'undtagelse' : 'overskredet', kilde: `BN1-38-6 tabel 11.3.2-1 (kl. ${kk})` });
        }
        if (sam) {
          const n = Math.max(okKrav.normal, rN), u = Math.max(okKrav.undtagelse, rU);
          checks.push({ label: `Overgang ${i + 1}: overgangskurve/rampe`, value: `${fmt(t.okl)} m`, graense: `≥ ${fmt(n, 1)} / ${fmt(u, 1)} m`, status: st3(t.okl, n, u), kilde: 'SR87 afsn. 2.05–2.06 · antaget' });
        } else {
          if (Math.abs(dI) > 0) checks.push({ label: `Overgang ${i + 1}: overgangskurve (dI/dt)`, value: `${fmt(t.okl)} m`, graense: `≥ ${fmt(okKrav.normal, 1)} / ${fmt(okKrav.undtagelse, 1)} m`, status: st3(t.okl, okKrav.normal, okKrav.undtagelse), kilde: 'SR87 afsn. 2.05 · antaget' });
          if (Math.abs(dh) > 0) checks.push({ label: `Overgang ${i + 1}: overhøjderampe`, value: `${fmt(t.rpl)} m`, graense: `≥ ${fmt(rN, 1)} / ${fmt(rU, 1)} m`, status: st3(t.rpl, rN, rU), kilde: 'SR87 afsn. 2.06 · antaget' });
        }
      });
      st.knaek.forEach((k, i) => {
        const di = k.i2 - k.i1;
        if (Math.abs(di) <= 1) return;
        checks.push({ label: `Knæk ${i + 1}: lodret radius (hovedbaner)`, value: `${fmt(k.Rv)} m`, graense: `≥ ${fmt(rs.lodretRadiusMin.normal)} m`, status: k.Rv >= rs.lodretRadiusMin.normal ? 'ok' : 'overskredet', kilde: 'SR87 afsn. 2.10 · sekundær' });
        if (set.tsi) {
          const m = di < 0 ? TSI_RV_MIN.top : TSI_RV_MIN.lavning;
          checks.push({ label: `TSI: Knæk ${i + 1}: lodret radius`, value: `${fmt(k.Rv)} m`, graense: `≥ ${m} m`, status: k.Rv >= m ? 'ok' : 'overskredet', kilde: `${TSI_KILDE} 4.2.3.5` });
        }
      });
      const total = checks.length ? samletStatus(checks.map((c) => c.status)) : 'ok';
      const adv = [...hor.advarsler, ...ver.advarsler];
      const placering = st.spor === 'dobbelt'
        ? 'Dobbeltspor: tavlerne fastgøres i skinnekroppen på ydersiden af den skinne, der vender mod grøften.'
        : st.spor === 'enkelt'
          ? 'Enkeltspor: tavlerne fastgøres i højre skinne ud mod grøften, set i km-retningen.'
          : 'Spor langs perron: på indersiden af skinnen længst fra perronforkanten, så tavlen kan ses fra perronen.';
      const fig = diagram(st, hor, ver.tavler);
      const plates = `<div class="plates">${alle.map((t) => plate(t, km(t.pos))).join('')}</div>`;

      out.innerHTML = `
        <div class="summary summary-${total}">
          <div><strong>${alle.length} tracétavler</strong><span>${hor.tavler.length} for linjeføring · ${ver.tavler.length} for længdeprofil · km ${km(0)}–${km(Math.max(hor.laengde, ...ver.tavler.map((t) => t.pos)))}</span></div>
          ${chip(total)}
        </div>
        ${adv.length ? `<div class="notice">${adv.map((a) => `• ${a}`).join('<br/>')}</div>` : ''}
        ${fig}
        <h3>Tavler</h3>
        ${plates}
        <h3>Tavleliste</h3>
        <div class="scroll-x"><table class="tbl tbl-mini tbl-tt">
          <thead><tr><th>km</th><th>Symbol</th><th>Rad</th><th>Okl</th><th>Kvl</th><th>Ovh</th><th>Rpl</th><th>Punkt</th></tr></thead>
          <tbody>${alle.map((t) => `<tr><td>${km(t.pos)}</td><td class="tt-sym">${t.symbol}</td><td>${t.rad ?? ''}</td><td>${t.okl ?? ''}</td><td>${t.kvl ?? ''}</td><td>${t.ovh ?? ''}</td><td>${t.rpl ?? ''}</td><td>${t.punkt}</td></tr>`).join('')}</tbody>
        </table></div>
        <h3>Kontrol af geometrien ved V = ${V} km/t</h3>
        <table class="tbl"><tbody>${checks.map((c) => `<tr><td><div>${c.label}</div><small>${c.kilde}</small></td><td>${c.value}</td><td>${c.graense}</td><td>${chip(c.status)}</td></tr>`).join('')}</tbody></table>
        <p class="tip"><b>Placering:</b> ${placering} Tavlerne opsættes med en nøjagtighed på ±${fmt(TAVLE_TOLERANCE, 1)} m i sporets længderetning. Værdier indpræges som heltal. Ovh angives «til og fra» i km-retningen – står man med front mod tavlen den anden vej, læses den omvendt. Mål, udseende og montage: Normaltegning blad 6014.</p>
      `;

      setReport({
        modul: 'Tracétavler (BN2-93)',
        inputs: [
          { label: 'Startkilometer', symbol: 'km', value: km(0), unit: '' },
          { label: 'Hastighed til kontrol', symbol: 'V', value: fmt(V), unit: 'km/t' },
          ...st.elementer.map((e, i) => ({ label: `Element ${i + 1}: ${e.type === 'ret' ? 'ret spor' : 'cirkelbue'}`, symbol: '', value: e.type === 'ret' ? `L ${fmt(e.L)} m` : `R ${fmt(e.R ?? 0)} m · Kvl ${fmt(e.L)} m · h ${fmt(e.h ?? 0)} mm`, unit: '' })),
          ...st.overgange.map((t, i) => ({ label: `Overgang ${i + 1}`, symbol: '', value: `Okl ${fmt(t.okl)} m${t.rpl > 0 ? ` · Rpl ${fmt(t.rpl)} m (start ${fmt(t.rstart)} m)` : ''}`, unit: '' })),
          ...st.knaek.map((k, i) => ({ label: `Knæk ${i + 1}`, symbol: '', value: `km ${km(k.pos)} · ${fmt(k.i1, 1)} → ${fmt(k.i2, 1)} ‰ · R<sub>v</sub> ${fmt(k.Rv)} m`, unit: '' })),
        ],
        steps: alle.map((t) => ({ label: `km ${km(t.pos)}`, formel: `Tavle «${t.symbol}» – ${t.punkt}`, indsat: `Rad ${t.rad ?? '–'} · Okl ${t.okl ?? '–'} · Kvl ${t.kvl ?? '–'}`, resultat: `Ovh ${t.ovh ?? '–'} · Rpl ${t.rpl ?? '–'}` })),
        checks,
        noter: [...adv, placering, `Opsætningstolerance ±${fmt(TAVLE_TOLERANCE, 1)} m. Udfyldning efter BN2-93-1 afsn. 10.2–10.3 og bilag 1–2.`],
        refs: ['BN2-93', 'SR87', 'ST16', 'BN1-38', ...(set.tsi ? ['TSI-INF'] : [])],
        figur: fig + plates,
      });
    };

    const renderEditor = () => {
      editor.innerHTML = '';
      editor.append(h('div', { class: 'ed-sec' }, 'Linjeføring (i km-retningen)'));
      st.elementer.forEach((e, i) => {
        const box = h('div', { class: `ed-row ed-${e.type}` });
        const head = h('div', { class: 'ed-head' }, h('strong', {}, `${i + 1}. ${e.type === 'ret' ? 'Ret spor' : 'Cirkelbue'}`));
        const typeSel = h('select', {}, h('option', { value: 'ret' }, 'Ret'), h('option', { value: 'bue' }, 'Bue'));
        typeSel.value = e.type;
        typeSel.addEventListener('change', () => { e.type = typeSel.value as 'ret' | 'bue'; if (e.type === 'bue') { e.R ??= 1000; e.h ??= 0; } renderEditor(); update(); });
        const del = h('button', { class: 'ed-del', type: 'button', title: 'Fjern element' }, '✕');
        del.addEventListener('click', () => {
          if (st.elementer.length <= 1) return;
          st.elementer.splice(i, 1);
          st.overgange.splice(Math.min(i, st.overgange.length - 1), 1);
          renderEditor(); update();
        });
        head.append(typeSel, del);
        box.append(head);
        const fields = h('div', { class: 'ed-fields' });
        fields.append(numInput(e.type === 'ret' ? 'Længde' : 'Kvl', e.L, 1, (v) => { e.L = v; update(); }, 'm'));
        if (e.type === 'bue') {
          fields.append(numInput('Rad', e.R ?? 1000, 10, (v) => { e.R = v; update(); }, 'm'));
          fields.append(numInput('Ovh', e.h ?? 0, 5, (v) => { e.h = v; update(); }, 'mm'));
        }
        box.append(fields);
        editor.append(box);
        if (i < st.elementer.length - 1) {
          const t = st.overgange[i] ?? (st.overgange[i] = { okl: 0, rpl: 0, rstart: 0 });
          const tb = h('div', { class: 'ed-row ed-ovg' }, h('div', { class: 'ed-head' }, h('span', {}, '↓ Overgang')));
          const tf = h('div', { class: 'ed-fields' });
          tf.append(
            numInput('Okl', t.okl, 1, (v) => { t.okl = v; update(); }, 'm'),
            numInput('Rpl (0 = sammenf.)', t.rpl, 1, (v) => { t.rpl = v; update(); }, 'm'),
            numInput('Rampestart', t.rstart, 1, (v) => { t.rstart = v; update(); }, 'm'),
          );
          tb.append(tf);
          editor.append(tb);
        }
      });
      const addRet = h('button', { class: 'btn-ghost btn-sm', type: 'button' }, '+ Ret spor');
      const addBue = h('button', { class: 'btn-ghost btn-sm', type: 'button' }, '+ Cirkelbue');
      addRet.addEventListener('click', () => { st.elementer.push({ type: 'ret', L: 50 }); st.overgange.push({ okl: 60, rpl: 0, rstart: 0 }); renderEditor(); update(); });
      addBue.addEventListener('click', () => { st.elementer.push({ type: 'bue', R: 1000, h: 60, L: 100 }); st.overgange.push({ okl: 60, rpl: 0, rstart: 0 }); renderEditor(); update(); });
      editor.append(h('div', { class: 'ed-add' }, addRet, addBue));

      editor.append(h('div', { class: 'ed-sec' }, 'Længdeprofil (knæk)'));
      st.knaek.forEach((k, i) => {
        const box = h('div', { class: 'ed-row ed-knaek' });
        const del = h('button', { class: 'ed-del', type: 'button', title: 'Fjern knæk' }, '✕');
        del.addEventListener('click', () => { st.knaek.splice(i, 1); renderEditor(); update(); });
        box.append(h('div', { class: 'ed-head' }, h('strong', {}, `Knæk ${i + 1}`), del));
        const f = h('div', { class: 'ed-fields' });
        f.append(
          numInput('Position', k.pos, 1, (v) => { k.pos = v; update(); }, 'm'),
          numInput('i₁', k.i1, 0.5, (v) => { k.i1 = v; update(); }, '‰'),
          numInput('i₂', k.i2, 0.5, (v) => { k.i2 = v; update(); }, '‰'),
          numInput('R<sub>v</sub>'.replace(/<[^>]+>/g, ''), k.Rv, 500, (v) => { k.Rv = v; update(); }, 'm'),
        );
        box.append(f);
        editor.append(box);
      });
      const addK = h('button', { class: 'btn-ghost btn-sm', type: 'button' }, '+ Knæk');
      addK.addEventListener('click', () => { const last = st.knaek[st.knaek.length - 1]; st.knaek.push({ pos: (last?.pos ?? 0) + 300, i1: last?.i2 ?? 0, i2: 0, Rv: 10000 }); renderEditor(); update(); });
      const reset = h('button', { class: 'btn-link', type: 'button' }, 'Nulstil til eksempel');
      reset.addEventListener('click', () => { Object.assign(st, structuredClone(DEF)); renderEditor(); update(); });
      editor.append(h('div', { class: 'ed-add' }, addK, reset));
    };

    const top = h('div', { class: 'fields' });
    const base = { startKm: st.startKm, V: st.V };
    const kmIn = numInput('Startkilometer', base.startKm, 0.001, (v) => { st.startKm = v; update(); }, 'km');
    const vIn = numInput('Hastighed til kontrol', base.V, 5, (v) => { st.V = v; update(); }, 'km/t');
    const opt = { spor: st.spor };
    top.append(kmIn, vIn, select('Placering af tavler', 'spor', [['dobbelt', 'Dobbeltspor'], ['enkelt', 'Enkeltspor'], ['perron', 'Spor langs perron']], opt, () => { st.spor = opt.spor; update(); }));
    const left = h('div', {}, top, editor);
    renderEditor();
    root.append(h('div', { class: 'grid' }, card('Kurveforløb', left, 'card-input card-scroll'), card('Tracétavler', out, 'card-out')));
    update();
  },
};
