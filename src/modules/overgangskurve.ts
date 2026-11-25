import { BANEDANMARK as rs, vurder, samletStatus } from '../core/rules';
import {
  cantDeficiency, transitionLengths, clothoid, roundTo, clothoidParamCompound, rampTwist,
} from '../core/formulas';
import { setReport } from '../core/report';
import { kvalitetsklasse, vridGraense, lavVridMax, rampeVridning, BASER, BASE_TEKST } from '../core/bn138';
import { card, chip, fmt, form, h, loadState, results, saveState, graense, kildeTekst, bn138Block, type Module } from '../ui/dom';

type S = { V: number; R1: number; h1: number; R: number; h: number; L: number };
const DEF: S = { V: 160, R1: 0, h1: 0, R: 1500, h: 100, L: 0 };

function diagram(L: number, h1: number, h2: number, I1: number, I2: number): string {
  const x0 = 30, x1 = 110, x2 = 250, x3 = 300, yb = 125, yt = 40;
  const m = Math.max(1, h1, h2, I1, I2);
  const y = (v: number) => yb - ((yb - yt) * Math.max(0, v)) / m;
  return `
  <svg viewBox="0 0 320 170" class="viz" role="img" aria-label="Overhøjde- og underskudsdiagram">
    <line x1="${x0}" y1="${yb}" x2="${x3}" y2="${yb}" class="axis"/>
    <polyline points="${x0},${y(h1)} ${x1},${y(h1)} ${x2},${y(h2)} ${x3},${y(h2)}" class="curve-h"/>
    <polyline points="${x0},${y(I1)} ${x1},${y(I1)} ${x2},${y(I2)} ${x3},${y(I2)}" class="curve-i"/>
    <line x1="${x1}" y1="${yb + 6}" x2="${x1}" y2="${yt - 18}" class="tick"/>
    <line x1="${x2}" y1="${yb + 6}" x2="${x2}" y2="${yt - 18}" class="tick"/>
    <text x="${(x0 + x1) / 2}" y="${yb + 22}" text-anchor="middle" class="lbl-svg muted">${h1 || I1 ? 'Bue R₁' : 'Ligeud'}</text>
    <text x="${(x1 + x2) / 2}" y="${yb + 22}" text-anchor="middle" class="lbl-svg">Overgangskurve L = ${fmt(L)} m</text>
    <text x="${(x2 + x3) / 2 + 5}" y="${yb + 22}" text-anchor="middle" class="lbl-svg muted">Bue R₂</text>
    <text x="${x2 + 4}" y="${y(h2) - 6}" class="lbl-svg accent">h = ${fmt(h2)}</text>
    <text x="${x2 + 4}" y="${y(I2) + 14}" class="lbl-svg accent2">I = ${fmt(I2)}</text>
    <text x="${x0}" y="22" class="lbl-svg muted">Overhøjde h og overhøjdeunderskud I [mm]</text>
  </svg>`;
}

export const overgangskurve: Module = {
  id: 'overgangskurve',
  gruppe: 'Linjeføring',
  titel: 'Overgangskurve og rampe',
  kort: 'Overgang',
  ikon: '∫',
  beskrivelse: 'Mindste længde af overgangskurve og overhøjderampe (klotoide, retlinet rampe) – fra ligeud eller mellem to ensvendte buer (Sporregler afsn. 2.05–2.06).',
  render(root) {
    const st = loadState<S>('overgangskurve2', DEF);
    const out = h('div', { class: 'out' });

    const update = () => {
      saveState('overgangskurve2', st);
      const fraLige = !(st.R1 > 0);
      const I1 = fraLige ? 0 : Math.max(0, cantDeficiency(st.V, st.R1, st.h1, rs));
      const I2 = Math.max(0, cantDeficiency(st.V, st.R, st.h, rs));
      const h1 = fraLige ? 0 : st.h1;
      const dh = st.h - h1;
      const dI = I2 - I1;
      const krit = transitionLengths({ V: st.V, R: st.R, dh, dI }, rs);
      const Lnorm = Math.max(...krit.map((k) => k.normal));
      const Lundt = Math.max(...krit.map((k) => k.undtagelse));
      const styrende = krit.find((k) => k.normal === Lnorm)!;
      const Lforslag = Math.max(roundTo(Lnorm, 5, 'op'), 0);
      const L = st.L > 0 ? st.L : Math.max(Lforslag, 5);
      const g = clothoid(st.R, L, dh);
      const A = fraLige ? g.A : clothoidParamCompound(st.R1, st.R, L);

      const v = st.V / 3.6;
      const dhdt = (v * Math.abs(dh)) / L;
      const dIdt = (v * Math.abs(dI)) / L;
      const dhds = Math.abs(dh) / L;
      const sDh = vurder(dhdt, rs.dhdtMax);
      const sDi = vurder(dIdt, rs.dIdtMax);
      const sDs = vurder(dhds, rs.dhdsMax);
      const nKrav = rs.rampeFaktor.normal * st.V;
      const nUndt = rs.rampeFaktor.undtagelse * st.V;
      const sRampe = g.rampe >= nKrav - 1e-6 ? 'ok' : g.rampe >= nUndt - 1e-6 ? 'undtagelse' : 'overskredet';
      const total = samletStatus([sDh, sDi, sDs, sRampe]);
      const tw = [3, 6, 9, 12, 15].map((b) => ({ b, ...rampTwist(dh, L, b) }));
      const kk = kvalitetsklasse(st.V);
      const lav = lavVridMax(st.R, Math.max(h1, st.h));
      const bnRows = BASER.map((b) => {
        const g = vridGraense(kk, b);
        const v = rampeVridning(dh, L, b);
        const max = lav ? g.max[0] : g.max[1];
        let status: 'ok' | 'undtagelse' | 'overskredet' = 'ok';
        let tekst: string | undefined;
        let graenseTxt = `fk 4 ≤ ${fmt(g.fk4, 1)} · Max ${fmt(max, 1)}`;
        if (b === 3 && g.fk3 !== undefined && g.fk1 !== undefined) {
          graenseTxt = `+ ${fmt(g.fk1, 1)} (fk 1) ≤ ${fmt(g.fk3, 1)} (fk 3) · fk 4 ${fmt(g.fk4, 1)}`;
          if (v + g.fk1 > g.fk3) { status = v <= g.fk4 ? 'undtagelse' : 'overskredet'; tekst = v <= g.fk4 ? 'Lille margin' : undefined; }
        } else if (v > g.fk4) { status = v <= max ? 'undtagelse' : 'overskredet'; tekst = v <= max ? 'Over fk 4' : undefined; }
        return { label: `Vridning fra rampe, målebase ${BASE_TEKST[b]}`, value: `${fmt(v, 2)} mm/m`, graense: graenseTxt, status, tekst, kilde: `BN1-38-6 tabel 11.3.2-1, kvalitetsklasse ${kk}${lav ? ', skærpet Max' : ''}` };
      });

      out.innerHTML = `
        <div class="summary summary-${total}">
          <div><strong>Krævet længde</strong><span>Styrende: ${styrende.label.toLowerCase()}</span></div>
          <div class="summary-val">${fmt(Lforslag)} m</div>
        </div>
        <table class="tbl">
          <thead><tr><th>Kriterie</th><th>Normal</th><th>Undt.</th></tr></thead>
          <tbody>
            ${krit.map((k) => `
              <tr class="${k === styrende ? 'gov' : ''}">
                <td><div>${k.label}</div><small>${k.formel}</small></td>
                <td>${fmt(k.normal, 1)} m</td><td>${fmt(k.undtagelse, 1)} m</td>
              </tr>`).join('')}
            <tr class="sum"><td>Mindste længde</td><td>${fmt(Lnorm, 1)} m</td><td>${fmt(Lundt, 1)} m</td></tr>
          </tbody>
        </table>
        <h3>Kontrol af L = ${fmt(L)} m ${st.L > 0 ? '' : '<small>(forslag)</small>'} ${chip(total)}</h3>
        ${results([
          { symbol: 'Δh', label: 'Overhøjdeændring', value: fmt(dh), unit: 'mm', sub: `${fmt(h1)} → ${fmt(st.h)} mm` },
          { symbol: 'ΔI', label: 'Ændring af underskud', value: fmt(dI), unit: 'mm', sub: `${fmt(I1)} → ${fmt(I2)} mm` },
          { symbol: 'dh/dt', label: 'Overhøjdeændring pr. tid', value: fmt(dhdt, 1), unit: 'mm/s', status: sDh, sub: graense(rs.dhdtMax) },
          { symbol: 'dI/dt', label: 'Underskudsændring pr. tid', value: fmt(dIdt, 1), unit: 'mm/s', status: sDi, sub: graense(rs.dIdtMax) },
          { symbol: '1:n', label: 'Rampehældning', value: Number.isFinite(g.rampe) ? '1:' + fmt(g.rampe) : '–', unit: '', status: sRampe,
            sub: `krav 1:${fmt(nKrav)} (undt. 1:${fmt(nUndt)}), stejlest 1:400` },
          { symbol: 'v<sub>3</sub>', label: 'Vridning fra rampe, 3 m base', value: fmt(tw[0].overBase, 2), unit: 'mm', sub: `${fmt(tw[0].mmPrM, 3)} mm/m` },
        ])}
        <h3>Klotoidens geometri</h3>
        ${results(fraLige ? [
          { symbol: 'A', label: 'Klotoideparameter √(R·L)', value: fmt(A, 1), unit: 'm' },
          { symbol: 'p', label: 'Tilbageflytning (shift)', value: fmt(g.p * 1000, 0), unit: 'mm', sub: '≈ L²/24R' },
          { symbol: 'τ', label: 'Tangentvinkel', value: fmt((g.tau * 200) / Math.PI, 4), unit: 'gon', sub: `${fmt(g.tau, 5)} rad` },
          { symbol: 'X / Y', label: 'Slutpunkt', value: `${fmt(g.X, 2)} / ${fmt(g.Y, 3)}`, unit: 'm' },
          { symbol: 'X<sub>m</sub>', label: 'Cirkelcentrums abscisse', value: fmt(g.Xm, 2), unit: 'm', sub: '≈ L/2' },
        ] : [
          { symbol: 'A', label: 'Klotoideparameter √(L/|1/R₂ − 1/R₁|)', value: fmt(A, 1), unit: 'm' },
          { symbol: '', label: 'Mellem ensvendte buer', value: `${fmt(st.R1)} → ${fmt(st.R)}`, unit: 'm',
            sub: 'Fælles overgangskurve; rampen udligner Δh (Sporteknik s. 249)' },
        ])}
        ${bn138Block(bnRows, `Vridning (fejlklasse 3, 4 og Max) måles fra 0-linjen, så rampens projekterede vridning tæller fuldt med. For 3 m-basen er der lagt plads til afvigelsen efter justering (fejlklasse 1). ${lav ? 'Skærpet Max-grænse, fordi R ≤ 500 m og h > (R − 100)/2 (afsnit 17).' : ''}`)}
        ${diagram(L, h1, st.h, I1, I2)}
      `;

      setReport({
        modul: 'Overgangskurve og overhøjderampe',
        inputs: [
          { label: 'Hastighed', symbol: 'V', value: fmt(st.V), unit: 'km/t' },
          { label: 'Radius ved start', symbol: 'R₁', value: fraLige ? '∞ (ligeud)' : fmt(st.R1), unit: 'm' },
          { label: 'Overhøjde ved start', symbol: 'h₁', value: fmt(h1), unit: 'mm' },
          { label: 'Radius i bue', symbol: 'R₂', value: fmt(st.R), unit: 'm' },
          { label: 'Overhøjde i bue', symbol: 'h₂', value: fmt(st.h), unit: 'mm' },
          { label: 'Valgt længde', symbol: 'L', value: fmt(L), unit: 'm' },
        ],
        steps: [
          { label: 'Underskud ved start', formel: 'I₁ = C·V²/R₁ − h₁', indsat: fraLige ? 'ligeud' : `11,80·${st.V}²/${fmt(st.R1)} − ${h1}`, resultat: `${fmt(I1, 1)} mm` },
          { label: 'Underskud i bue', formel: 'I₂ = C·V²/R₂ − h₂', indsat: `11,80·${st.V}²/${fmt(st.R)} − ${st.h}`, resultat: `${fmt(I2, 1)} mm` },
          { label: 'Overhøjdeændring', formel: 'Δh = h₂ − h₁', indsat: `${st.h} − ${h1}`, resultat: `${fmt(dh, 1)} mm` },
          { label: 'Underskudsændring', formel: 'ΔI = I₂ − I₁', indsat: `${fmt(I2, 1)} − ${fmt(I1, 1)}`, resultat: `${fmt(dI, 1)} mm` },
          ...krit.map((k) => ({ label: k.label, formel: k.formel, indsat: k.id === 'dhdt' ? `${fmt(v, 2)}·${fmt(Math.abs(dh), 1)}/${rs.dhdtMax.normal}` : k.id === 'dIdt' ? `${fmt(v, 2)}·${fmt(Math.abs(dI), 1)}/${rs.dIdtMax.normal}` : k.id === 'rampe' ? `${fmt(Math.abs(dh), 1)}·${rs.rampeFaktor.normal}·${st.V}/1000` : `${fmt(Math.abs(dh), 1)}/${rs.dhdsMax.normal}`, resultat: `${fmt(k.normal, 1)} m` })),
          { label: 'Klotoideparameter', formel: fraLige ? 'A = √(R·L)' : 'A = √(L/|1/R₂−1/R₁|)', indsat: fraLige ? `√(${fmt(st.R)}·${fmt(L)})` : `√(${fmt(L)}/|1/${fmt(st.R)}−1/${fmt(st.R1)}|)`, resultat: `${fmt(A, 1)} m` },
          ...(fraLige ? [
            { label: 'Tilbageflytning', formel: 'p ≈ L²/(24R)', indsat: `${fmt(L)}²/(24·${fmt(st.R)})`, resultat: `${fmt(g.p * 1000, 0)} mm` },
            { label: 'Tangentvinkel', formel: 'τ = L/(2R)', indsat: `${fmt(L)}/(2·${fmt(st.R)})`, resultat: `${fmt(g.tau, 5)} rad` },
          ] : []),
          { label: 'Vridning fra rampe', formel: 'v = Δh/L · b', indsat: `${fmt(Math.abs(dh), 1)}/${fmt(L)}·3`, resultat: `${fmt(tw[0].overBase, 2)} mm / 3 m` },
        ],
        checks: [
          { label: 'Overhøjdeændring dh/dt', value: `${fmt(dhdt, 1)} mm/s`, graense: graense(rs.dhdtMax), status: sDh, kilde: kildeTekst(rs.dhdtMax) },
          { label: 'Underskudsændring dI/dt', value: `${fmt(dIdt, 1)} mm/s`, graense: graense(rs.dIdtMax), status: sDi, kilde: kildeTekst(rs.dIdtMax) },
          { label: 'Rampehældning', value: Number.isFinite(g.rampe) ? `1:${fmt(g.rampe)}` : '–', graense: `1:${fmt(nKrav)} / 1:${fmt(nUndt)}`, status: sRampe, kilde: kildeTekst(rs.rampeFaktor) },
          { label: 'Stejleste rampe dh/ds', value: `${fmt(dhds, 2)} mm/m`, graense: graense(rs.dhdsMax), status: sDs, kilde: kildeTekst(rs.dhdsMax) },
          ...bnRows.map((r) => ({ ...r, label: `BN1-38: ${r.label}` })),
        ],
        noter: [
          `Styrende kriterie: ${styrende.label.toLowerCase()}. Krævet længde afrundet op til 5 m: ${fmt(Lforslag)} m.`,
          'Rampe og overgangskurve skal være sammenfaldende; den største af de to mindstelængder gælder (Sporteknik s. 250).',
          `Vridning fra rampen: ${tw.map((t) => `${fmt(t.overBase, 1)} mm/${t.b} m`).join(', ')}. Grænser jf. BN1-38.`,
        ],
        refs: ['SR87', 'ST16', 'EN13803', 'TSI-INF', 'BN1-38'],
        figur: diagram(L, h1, st.h, I1, I2),
      });
    };

    const f = form<keyof S>(
      [
        { key: 'V', label: 'Hastighed', symbol: 'V', unit: 'km/t', min: 10, max: 300, step: 5 },
        { key: 'R1', label: 'Radius ved start (0 = ligeud)', symbol: 'R₁', unit: 'm', min: 0, max: 10000, step: 10,
          hint: 'Angiv R₁ for overgang mellem to ensvendte buer.' },
        { key: 'h1', label: 'Overhøjde ved start', symbol: 'h₁', unit: 'mm', min: 0, max: 180, step: 5 },
        { key: 'R', label: 'Radius i buen', symbol: 'R₂', unit: 'm', min: 150, max: 10000, step: 10 },
        { key: 'h', label: 'Overhøjde i buen', symbol: 'h₂', unit: 'mm', min: 0, max: 180, step: 5 },
        { key: 'L', label: 'Valgt længde (0 = forslag)', symbol: 'L', unit: 'm', min: 0, max: 400, step: 5 },
      ],
      st,
      update,
    );
    root.append(h('div', { class: 'grid' }, card('Input', f, 'card-input'), card('Resultat', out, 'card-out')));
    update();
  },
};
