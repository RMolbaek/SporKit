import { kryds, langs, gasAfstande, LEDNINGSTYPER, METODER, type Ledningstype, type Metode } from '../core/bn113';
import { setReport } from '../core/report';
import type { Status } from '../core/rules';
import { card, chip, fmt, form, h, loadState, results, saveState, select, type Module } from '../ui/dom';

type S = {
  D: number; reamer: number; tryk: number; dybde: number; vinkel: number; sporskifte: number; antal: number; afstand: number; groeft: number; overcut: number;
  a: number; dybdeSO: number; dybdeTerraen: number; aSkinne: number; hoejde: number; Pb: number; V: number; broend: number;
};
const DEF: S = {
  D: 0.16, reamer: 0.25, tryk: 4, dybde: 3.0, vinkel: 5, sporskifte: 40, antal: 1, afstand: 3, groeft: 1.2, overcut: 15,
  a: 3.0, dybdeSO: 1.4, dybdeTerraen: 0.8, aSkinne: 3.0, hoejde: 0.15, Pb: 3.8, V: 160, broend: 0,
};
type Opt = { mode: string; type: string; metode: string; eksisterende: string; jaevnstroem: string; metal: string; station: string; mellem: string; rende: string; ekstern: string };

/** Tværsnit af banen med krydsende ledning (lodret og vandret i samme skala). */
function krydsFigur(dybde: number, krav: number, D: number, laengdeAfst: number, groeft: number): string {
  const s = 52; // px pr. m
  const W = 640, x0 = W / 2, y0 = 70;
  const Y = (z: number) => y0 + z * s;
  const X = (x: number) => x0 + x * s;
  const zc = dybde + D / 2;
  const r = Math.max(3, (D / 2) * s);
  const H = Y(Math.max(dybde, krav) + D + 0.8);
  const su = 0.388;
  const half = laengdeAfst / 2;
  const svelle = `<rect x="${X(-1.25)}" y="${Y(0.182)}" width="${2.5 * s}" height="${0.206 * s}" class="t-sleeper"/>`;
  const skinner = `<rect x="${X(-0.79)}" y="${Y(0)}" width="${0.072 * s}" height="${0.172 * s}" class="t-rail"/><rect x="${X(0.72)}" y="${Y(0)}" width="${0.072 * s}" height="${0.172 * s}" class="t-rail"/>`;
  const terr = `M ${X(-6)},${Y(su + 0.3)} L ${X(-3.8)},${Y(su + 0.3)} L ${X(-1.25 - 0.4)},${Y(0.182)} L ${X(1.25 + 0.4)},${Y(0.182)} L ${X(3.8)},${Y(su + 0.3)} L ${X(6)},${Y(su + 0.3)}`;
  const groeftSvg = groeft > 0 ? `<path d="M ${X(4.3)},${Y(su + 0.3)} L ${X(4.9)},${Y(groeft)} L ${X(5.2)},${Y(groeft)} L ${X(5.8)},${Y(su + 0.3)}" class="ld-groeft"/>
    <line x1="${X(5.05)}" y1="${Y(groeft)}" x2="${X(5.05)}" y2="${Y(groeft + 0.5)}" class="ld-dim"/>
    <text x="${X(5.15)}" y="${Y(groeft + 0.3)}" class="lbl-svg">0,50</text>` : '';
  return `
  <svg viewBox="0 0 ${W} ${H}" class="viz viz-ld" role="img" aria-label="Tværsnit med krydsende ledning">
    <rect x="0" y="${Y(su + 0.3)}" width="${W}" height="${H - Y(su + 0.3)}" class="ld-jord"/>
    <path d="${terr} L ${X(6)},${H} L ${X(-6)},${H} Z" class="ld-baneleg"/>
    ${groeftSvg}
    ${svelle}${skinner}
    <line x1="0" y1="${Y(0)}" x2="${W}" y2="${Y(0)}" class="t-ref"/>
    <text x="8" y="${Y(0) - 6}" class="lbl-svg muted">Laveste SO</text>
    <line x1="0" y1="${Y(krav)}" x2="${W}" y2="${Y(krav)}" class="ld-krav"/>
    <text x="8" y="${Y(krav) - 6}" class="lbl-svg ld-kravtxt">Krav: top ≥ ${fmt(krav, 2)} m under SO</text>
    <line x1="${X(-half)}" y1="${Y(su)}" x2="${X(-D / 2)}" y2="${Y(zc)}" class="ld-anlaeg"/>
    <line x1="${X(half)}" y1="${Y(su)}" x2="${X(D / 2)}" y2="${Y(zc)}" class="ld-anlaeg"/>
    <text x="${X(half) + 6}" y="${Y(su) + 26}" class="lbl-svg muted">1:1,5</text>
    <circle cx="${X(0)}" cy="${Y(zc)}" r="${r}" class="ld-roer"/>
    <line x1="${X(0) + r + 40}" y1="${Y(0)}" x2="${X(0) + r + 40}" y2="${Y(dybde)}" class="ld-dim" marker-end="url(#ldA)"/>
    <text x="${X(0) + r + 46}" y="${Y(dybde / 2)}" class="lbl-svg">${fmt(dybde, 2)} m</text>
    <defs><marker id="ldA" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" class="t-arrow"/></marker></defs>
    <text x="${W - 8}" y="${H - 8}" text-anchor="end" class="lbl-svg muted">Skinneafstivning ≥ ${fmt(laengdeAfst, 2)} m · målfast</text>
  </svg>`;
}

export const ledninger: Module = {
  id: 'ledninger',
  gruppe: 'I sporet',
  titel: 'Ledningsanlæg (BN1-13)',
  kort: 'Ledninger',
  ikon: '⌁',
  beskrivelse: 'Krydsende og langsgående ledninger og kabler: lægningsdybde, afstande, metoder og beskyttelsesrør efter BN1-13-4.',
  render(root) {
    const st = loadState<S>('ledninger', DEF);
    const opt = loadState<Opt>('ledninger-opt', { mode: 'kryds', type: 'kabel', metode: 'styret', eksisterende: 'ja', jaevnstroem: 'nej', metal: 'nej', station: 'nej', mellem: 'nej', rende: 'nej', ekstern: 'nej' });
    const out = h('div', { class: 'out' });
    const update = () => {
      saveState('ledninger', st);
      saveState('ledninger-opt', opt);
      let html = '', fig = '';
      let checks: { label: string; value: string; graense: string; status: Status; kilde: string }[] = [];
      let noter: string[] = [];
      const steps: { label: string; formel: string; indsat: string; resultat: string }[] = [];
      const inputs: { label: string; symbol: string; value: string; unit: string }[] = [];
      if (opt.mode === 'kryds') {
        const r = kryds({
          type: opt.type as Ledningstype, metode: opt.metode as Metode, D: st.D, reamer: st.reamer, tryk: st.tryk, dybde: st.dybde,
          vinkel: st.vinkel, sporskifte: st.sporskifte, antal: st.antal, afstand: st.afstand, groeft: st.groeft, overcut: st.overcut,
          eksisterende: opt.eksisterende === 'ja', jaevnstroem: opt.jaevnstroem === 'ja', metal: opt.metal === 'ja', svelleUnderside: 0.388,
        });
        checks = r.checks; noter = r.noter;
        fig = krydsFigur(st.dybde, r.dybdeKrav, st.D, r.skinneafstivning.laengde, st.groeft);
        const total: Status = checks.some((c) => c.status === 'overskredet') ? 'overskredet' : checks.some((c) => c.status === 'undtagelse') ? 'undtagelse' : 'ok';
        const gas = opt.type === 'gas' ? gasAfstande(st.tryk, st.D) : null;
        html = `
          <div class="summary summary-${total}"><div><strong>Krydsende ledning</strong><span>${LEDNINGSTYPER.find((x) => x[0] === opt.type)![1]} · ${METODER.find((x) => x[0] === opt.metode)![1]}</span></div>
          <div class="summary-val">≥ ${fmt(r.dybdeKrav, 2)} m</div></div>
          ${results([
            { symbol: 'z<sub>min</sub>', label: 'Mindste dybde, laveste SO → rørtop', value: fmt(r.dybdeKrav, 2), unit: 'm', big: true, sub: r.dybdeGrund.reduce((a, b) => (b.v > a.v ? b : a)).navn },
            { symbol: 'L<sub>af</sub>', label: 'Skinneafstivningens længde (hvis den bruges)', value: fmt(r.skinneafstivning.laengde, 2), unit: 'm', big: true, sub: 'anlæg 1,5 fra rørets bredeste sted til svelleunderside' },
            { symbol: 'BR', label: 'Beskyttelsesrør', value: r.beskyttelsesroer ? 'Kræves' : 'Ikke krav', unit: '', sub: r.beskyttelsesroer ? 'ende ≥ 3 m fra skråningsfod og ≥ 1 m uden for skel' : '' },
          ])}
          ${fig}
          <h3>Dybdekrav</h3>
          <table class="tbl tbl-kv"><tbody>${r.dybdeGrund.map((g) => `<tr><td>${g.navn}</td><td>${fmt(g.v, 2)} m</td></tr>`).join('')}</tbody></table>
          <h3>Kontrol</h3>
          <table class="tbl"><tbody>${checks.map((c) => `<tr><td><div>${c.label}</div><small>${c.kilde}</small></td><td>${c.value}</td><td>${c.graense}</td><td>${chip(c.status)}</td></tr>`).join('')}</tbody></table>
          ${gas ? `<h3>Gas/olie – afstande (tabel 10.5.1.1-1/-2 og 10.5.1.2-1)</h3>
            <table class="tbl tbl-kv"><tbody>
              <tr><td>Beskyttelsesrørets ende fra nærmeste spormidte</td><td>≥ ${gas.roerende} m</td></tr>
              <tr><td>Overjordiske dele (ventiler, målerstationer)</td><td>≥ ${gas.overjordisk} m</td></tr>
              <tr><td>Jorddækning inden for 15 m / 15–25 m fra spormidte</td><td>≥ 1,5 m / ≥ 1,0 m</td></tr>
              ${gas.bygvaerker.map(([n, v]) => `<tr><td>${n}</td><td>≥ max(${v} m; 0,75·D·P = ${fmt(gas.minAfstandFormel, 2)} m)</td></tr>`).join('')}
              <tr><td>Class location</td><td>CL4 (designfaktor 0,40)</td></tr>
            </tbody></table>` : ''}`;
        inputs.push(
          { label: 'Ledningstype', symbol: '', value: LEDNINGSTYPER.find((x) => x[0] === opt.type)![1], unit: '' },
          { label: 'Metode', symbol: '', value: METODER.find((x) => x[0] === opt.metode)![1], unit: '' },
          { label: 'Udvendig diameter', symbol: 'D', value: fmt(st.D, 3), unit: 'm' },
          ...(opt.metode === 'styret' ? [{ label: 'Reamerdiameter', symbol: 'd<sub>r</sub>', value: fmt(st.reamer, 3), unit: 'm' }] : []),
          ...(opt.type === 'gas' ? [{ label: 'Ledningstryk', symbol: 'P', value: fmt(st.tryk, 1), unit: 'bar' }] : []),
          { label: 'Projekteret dybde SO → rørtop', symbol: 'z', value: fmt(st.dybde, 2), unit: 'm' },
          { label: 'Afvigelse fra vinkelret', symbol: 'α', value: fmt(st.vinkel), unit: '°' },
          { label: 'Afstand til sporskifteende', symbol: '', value: fmt(st.sporskifte, 1), unit: 'm' },
        );
        steps.push(...r.dybdeGrund.map((g) => ({ label: 'Dybdekrav', formel: g.navn, indsat: '', resultat: `${fmt(g.v, 2)} m` })),
          { label: 'Styrende dybdekrav', formel: 'max(...)', indsat: '', resultat: `${fmt(r.dybdeKrav, 2)} m` },
          { label: 'Skinneafstivning', formel: 'L = D + 2·1,5·(z + D/2 − z<sub>svelle</sub>)', indsat: `${fmt(st.D, 3)} + 3·(${fmt(st.dybde + st.D / 2, 3)} − 0,388)`, resultat: `${fmt(r.skinneafstivning.laengde, 2)} m` });
      } else {
        const r = langs({
          a: st.a, dybdeSO: st.dybdeSO, dybdeTerraen: st.dybdeTerraen, station: opt.station === 'ja', mellemSpor: opt.mellem === 'ja',
          rende: opt.rende === 'ja', aSkinne: st.aSkinne, hoejde: st.hoejde, Pb: st.Pb, V: st.V, broend: st.broend, ekstern: opt.ekstern === 'ja',
        });
        checks = r.checks; noter = r.noter;
        const total: Status = checks.some((c) => c.status === 'overskredet') ? 'overskredet' : checks.some((c) => c.status === 'undtagelse') ? 'undtagelse' : 'ok';
        html = `
          <div class="summary summary-${total}"><div><strong>Langsgående ${opt.rende === 'ja' ? 'kabelrende over jord' : 'ledningsanlæg'}</strong><span>${opt.station === 'ja' ? 'Stationsområde' : 'Fri strækning'} · ${fmt(st.a, 2)} m fra spormidte</span></div>${chip(total)}</div>
          <table class="tbl"><tbody>${checks.map((c) => `<tr><td><div>${c.label}</div><small>${c.kilde}</small></td><td>${c.value}</td><td>${c.graense}</td><td>${chip(c.status)}</td></tr>`).join('')}</tbody></table>`;
        inputs.push(
          { label: 'Afstand fra spormidte', symbol: 'a', value: fmt(st.a, 2), unit: 'm' },
          ...(opt.rende === 'ja' ? [{ label: 'Afstand fra nærmeste skinne / højde over terræn', symbol: '', value: `${fmt(st.aSkinne, 2)} / ${fmt(st.hoejde, 2)}`, unit: 'm' }] : [{ label: 'Dybde under SO / terræn', symbol: '', value: `${fmt(st.dybdeSO, 2)} / ${fmt(st.dybdeTerraen, 2)}`, unit: 'm' }]),
        );
      }
      out.innerHTML = `${html}${noter.length ? `<div class="notice">${noter.map((n) => `• ${n}`).join('<br/>')}</div>` : ''}
        <p class="tip">BN1-13-4 (udgivet 23.07.2024). Statisk beregning efter DS 437 med trafiklast LM71 (540 kN akseltryk, 110 kN/m), høj konsekvensklasse (DS 475) og partialkoefficient 2 på jordens stivhed (10.4). Tilladelse fra Banedanmark (LedX / ledningsx.dk) kræves før arbejdet påbegyndes.</p>`;
      setReport({ modul: 'Ledningsanlæg (BN1-13-4)', inputs, steps, checks, noter, refs: ['BN1-13', 'BN1-6', 'BN1-38', 'BN1-14'], figur: fig });
    };
    const f = form<keyof S>([
      { key: 'D', label: 'Udvendig diameter (ledning/beskyttelsesrør)', symbol: 'D', unit: 'm', min: 0.02, max: 2, step: 0.01 },
      { key: 'reamer', label: 'Reamerdiameter (styret boring)', symbol: 'd<sub>r</sub>', unit: 'm', min: 0.05, max: 1, step: 0.01 },
      { key: 'tryk', label: 'Ledningstryk (gas/olie)', symbol: 'P', unit: 'bar', min: 1, max: 80, step: 1 },
      { key: 'dybde', label: 'Projekteret dybde laveste SO → rørtop', symbol: 'z', unit: 'm', min: 0.5, max: 10, step: 0.05 },
      { key: 'vinkel', label: 'Afvigelse fra vinkelret krydsning', symbol: 'α', unit: '°', min: 0, max: 45, step: 1 },
      { key: 'sporskifte', label: 'Afstand til nærmeste sporskifteende', symbol: 's', unit: 'm', min: 0, max: 200, step: 1 },
      { key: 'antal', label: 'Antal parallelle ledninger', symbol: 'n', unit: '', min: 1, max: 6, step: 1 },
      { key: 'afstand', label: 'Afstand mellem ledninger', symbol: 'e', unit: 'm', min: 0, max: 10, step: 0.1 },
      { key: 'groeft', label: 'Dybde SO → bund af banegrøft (0 = ingen)', symbol: 'z<sub>g</sub>', unit: 'm', min: 0, max: 4, step: 0.05 },
      { key: 'overcut', label: 'Overcut (ringformet hulrum)', symbol: 'oc', unit: 'mm', min: 0, max: 100, step: 1 },
      { key: 'a', label: 'Langsgående: afstand fra spormidte', symbol: 'a', unit: 'm', min: 0, max: 15, step: 0.05 },
      { key: 'dybdeSO', label: 'Langsgående: dybde laveste SO → top', symbol: 'z<sub>SO</sub>', unit: 'm', min: 0, max: 5, step: 0.05 },
      { key: 'dybdeTerraen', label: 'Langsgående: dybde under terræn', symbol: 'z<sub>t</sub>', unit: 'm', min: 0, max: 5, step: 0.05 },
      { key: 'aSkinne', label: 'Kabelrende: afstand fra nærmeste skinne', symbol: 'a<sub>s</sub>', unit: 'm', min: 0, max: 10, step: 0.05 },
      { key: 'hoejde', label: 'Kabelrende: højde over terræn', symbol: 'h<sub>r</sub>', unit: 'm', min: 0, max: 1, step: 0.01 },
      { key: 'Pb', label: 'Planumsbredde Pb (BN1-6)', symbol: 'P<sub>b</sub>', unit: 'm', min: 1.6, max: 5, step: 0.05 },
      { key: 'V', label: 'Hastighed', symbol: 'V', unit: 'km/t', min: 10, max: 250, step: 10 },
      { key: 'broend', label: 'Brønd: afstand fra spormidte (0 = ingen)', symbol: 'a<sub>b</sub>', unit: 'm', min: 0, max: 10, step: 0.05 },
    ], st, update);
    const krydsKeys = ['D', 'reamer', 'tryk', 'dybde', 'vinkel', 'sporskifte', 'antal', 'afstand', 'groeft', 'overcut'];
    const fields = Array.from(f.children) as HTMLElement[];
    const opdaterSynlighed = () => {
      const kr = opt.mode === 'kryds';
      fields.forEach((el, i) => {
        const key = ['D', 'reamer', 'tryk', 'dybde', 'vinkel', 'sporskifte', 'antal', 'afstand', 'groeft', 'overcut', 'a', 'dybdeSO', 'dybdeTerraen', 'aSkinne', 'hoejde', 'Pb', 'V', 'broend'][i];
        el.style.display = (krydsKeys.includes(key) === kr) ? '' : 'none';
      });
      for (const [el, m] of selects) el.style.display = m === 'alle' || m === opt.mode ? '' : 'none';
    };
    const sel = (label: string, key: keyof Opt, o: [string, string][], mode: 'alle' | 'kryds' | 'langs') => {
      const el = select(label, key, o, opt, () => { opdaterSynlighed(); update(); });
      selects.push([el, mode]);
      return el;
    };
    const selects: [HTMLElement, string][] = [];
    const jn: [string, string][] = [['nej', 'Nej'], ['ja', 'Ja']];
    f.prepend(
      sel('Situation', 'mode', [['kryds', 'Krydsende ledning under spor'], ['langs', 'Langsgående ledning / kabelrende']], 'alle'),
      sel('Ledningstype', 'type', LEDNINGSTYPER, 'kryds'),
      sel('Metode', 'metode', METODER, 'kryds'),
      sel('Under eksisterende spor', 'eksisterende', [['ja', 'Ja'], ['nej', 'Nej (nyanlæg)']], 'kryds'),
      sel('Jævnstrømselektrificeret strækning', 'jaevnstroem', jn, 'kryds'),
      sel('Beskyttelsesrør af metal', 'metal', jn, 'kryds'),
      sel('Ekstern (fremmed) ledning', 'ekstern', jn, 'langs'),
      sel('Stationsområde', 'station', jn, 'langs'),
      sel('Midt mellem spor (station)', 'mellem', jn, 'langs'),
      sel('Kabelrende over jord', 'rende', jn, 'langs'),
    );
    opdaterSynlighed();
    root.append(h('div', { class: 'grid' }, card('Input', f, 'card-input card-scroll'), card('Resultat', out, 'card-out')));
    update();
  },
};
