import { versine, radiusFromVersine, equilibriumCant, maxSpeed } from '../core/formulas';
import { BANEDANMARK as rs, loadSettings } from '../core/rules';
import { tsiGaugeIal, tsiStatus, TSI_KILDE } from '../core/tsi';
import { kvalitetsklasse, vridningKlasse, sporviddeKlasse, lavVridMax, radiusFraDiagram, vridGraense, SPORVIDDE, type Base } from '../core/bn138';
import { setReport } from '../core/report';
import { card, fmt, form, h, loadState, results, saveState, tsiBlock, bn138Block, type Module } from '../ui/dom';

type S = { R: number; c: number; f: number; h1: number; h2: number; b: number; hm: number; I: number; sv: number; Vs: number; p: number };
const DEF: S = { R: 800, c: 20, f: 62, h1: 55, h2: 40, b: 3, hm: 110, I: 100, sv: 0, Vs: 160, p: 0 };

export const sporkontrol: Module = {
  id: 'sporkontrol',
  gruppe: 'I sporet',
  titel: 'Pilhøjde og vridning',
  kort: 'I sporet',
  ikon: '⊢',
  beskrivelse: 'Hurtige beregninger i sporet: pilhøjde ↔ radius, vridning over målebase og hastighed ud fra målt overhøjde.',
  render(root) {
    const st = loadState<S>('sporkontrol', DEF);
    const out = h('div', { class: 'out' });
    const update = () => {
      saveState('sporkontrol', st);
      const f = versine(st.R, st.c);
      const fApprox = (st.c * st.c) / (8 * st.R) * 1000;
      const Rm = radiusFromVersine(st.f, st.c);
      const tw = Math.abs(st.h1 - st.h2) / st.b;
      const twSum = Math.abs(st.h1 - st.h2);
      const Rref = Rm;
      const Vm = maxSpeed(Rref, st.hm, st.I, rs);
      const ha = equilibriumCant(Vm, Rref, rs);
      const ial = tsiGaugeIal(st.Vs);
      const set = loadSettings();
      const tsiRows = set.tsi && st.sv > 0 ? [
        { label: `Målt sporvidde ved V = ${st.Vs} km/t`, value: `${fmt(st.sv)} mm`, graense: `${fmt(ial.min)} – ${fmt(ial.max)} mm`, status: tsiStatus(st.sv >= ial.min && st.sv <= ial.max), kilde: `${TSI_KILDE} 4.2.8.4, tabel 12` },
      ] : [];
      const kk = kvalitetsklasse(st.Vs);
      const baseStd: Base | null = st.b <= 2 ? 2 : st.b <= 3 ? 3 : ([6, 9, 12, 15] as Base[]).find((x) => Math.abs(x - st.b) < 0.01) ?? null;
      const lav = lavVridMax(Rm, st.hm);
      const vk = baseStd ? vridningKlasse(tw, kk, baseStd, lav) : null;
      const vg = baseStd ? vridGraense(kk, baseStd) : null;
      const gk = st.sv > 0 ? sporviddeKlasse(st.sv, kk) : null;
      const sg = SPORVIDDE[kk];
      const Rdiag = st.p > 0 ? radiusFraDiagram(st.p) : NaN;
      const bnRows = [
        ...(vk && vg ? [{ label: `Målt vridning over ${fmt(st.b, 1)} m (kvalitetsklasse ${kk})`, value: `${fmt(tw, 2)} mm/m`, graense: `${vg.fk3 !== undefined ? `fk 3 ${fmt(vg.fk3, 1)} · ` : ''}fk 4 ${fmt(vg.fk4, 1)} · Max ${fmt(vk.max, 1)}`, status: vk.status, tekst: vk.status === 'ok' ? undefined : `Fejlkl. ${vk.fejlklasse}`, kilde: `BN1-38-6 tabel 11.3.2-1${lav ? ', skærpet Max (afsnit 17)' : ''}` }] : []),
        ...(gk ? [{ label: `Målt sporvidde (kvalitetsklasse ${kk})`, value: `${fmt(st.sv)} mm (${st.sv - 1435 >= 0 ? '+' : ''}${fmt(st.sv - 1435)})`, graense: `fk 4 +${sg.fk4[0]}/−${sg.fk4[1]} · Max +${sg.max[0]}/−${sg.max[1]}`, status: gk.status, tekst: gk.status === 'ok' ? undefined : `Fejlkl. ${gk.fejlklasse}`, kilde: 'BN1-38-6 tabel 11.3.2-2' }] : []),
      ];
      const bases = [10, 20].map((c) => ({ c, f: versine(st.R, c) }));
      out.innerHTML = `
        <h3>Pilhøjde for radius</h3>
        ${results([
          { symbol: 'f', label: `Pilhøjde, korde ${fmt(st.c)} m`, value: fmt(f, 1), unit: 'mm', big: true, sub: `f ≈ c²/(8R) = ${fmt(fApprox, 1)} mm` },
          ...bases.map((b) => ({ symbol: `f<sub>${b.c}</sub>`, label: `Korde ${b.c} m`, value: fmt(b.f, 1), unit: 'mm' })),
        ])}
        <h3>Radius fra målt pilhøjde</h3>
        ${results([
          { symbol: 'R', label: `Målt f = ${fmt(st.f)} mm på ${fmt(st.c)} m korde`, value: fmt(Rm, 0), unit: 'm', big: true, sub: 'R = c²/(8f) + f/2' },
          { symbol: 'V<sub>max</sub>', label: `Hastighed med h = ${st.hm} mm, I = ${st.I} mm`, value: fmt(Math.floor(Vm / 5) * 5), unit: 'km/t', sub: `beregnet ${fmt(Vm, 1)} km/t · h<sub>a</sub> = ${fmt(ha)} mm` },
        ])}
        <h3>Vridning</h3>
        ${results([
          { symbol: 'v', label: `Vridning over ${fmt(st.b, 1)} m`, value: fmt(tw, 2), unit: 'mm/m', big: true, sub: `|h₁ − h₂| / b = ${fmt(twSum)} mm / ${fmt(st.b, 1)} m` },
        ])}
        ${bn138Block(bnRows, `Kvalitetsklasse ${kk} ud fra V = ${st.Vs} km/t. ${baseStd ? '' : 'Vridning vurderes kun for standardmålebaserne 1,5/2, 2,5/3, 6, 9, 12 og 15 m. '}Grænserne er for målevogn/-dræsine; for håndmåling se tabel 11.3.3.`)}
        ${st.p > 0 ? `<h3>Radius fra målevognsdiagram</h3>${results([{ symbol: 'R', label: `Pilhøjde p = ${fmt(st.p, 1)} mm på diagrammet`, value: fmt(Rdiag), unit: 'm', sub: 'R = 10 000 / p (BN1-38 afsnit 17)' }])}` : ''}
        <h3>Sporvidde – grænse for øjeblikkeligt indgreb</h3>
        ${results([{ symbol: 'G', label: `TSI tabel 12 ved V = ${st.Vs} km/t`, value: `${fmt(ial.min)} – ${fmt(ial.max)}`, unit: 'mm', sub: 'enkeltfejl, målt 14 mm under SO' }])}
        ${tsiBlock(tsiRows)}
        <p class="tip">Målebaser iht. BN1-38: 1½ eller 2, 2½ eller 3, 6, 9, 12 og 15 m. Grænseværdier for vridning afhænger af fejlklasse og findes i BN1-38. Eksempel fra Sporteknik: h₁ = 55, h₂ = 40, b = 3 m → 5 mm/m.</p>
      `;
      setReport({
        modul: 'Pilhøjde og vridning',
        inputs: [
          { label: 'Radius', symbol: 'R', value: fmt(st.R), unit: 'm' },
          { label: 'Kordelængde', symbol: 'c', value: fmt(st.c), unit: 'm' },
          { label: 'Målt pilhøjde', symbol: 'f', value: fmt(st.f), unit: 'mm' },
          { label: 'Målt overhøjde punkt 1 / 2', symbol: 'h₁ / h₂', value: `${fmt(st.h1)} / ${fmt(st.h2)}`, unit: 'mm' },
          { label: 'Målebase', symbol: 'b', value: fmt(st.b, 1), unit: 'm' },
          { label: 'Overhøjde / tilladt I', symbol: 'h / I', value: `${st.hm} / ${st.I}`, unit: 'mm' },
        ],
        steps: [
          { label: 'Pilhøjde (eksakt)', formel: 'f = R − √(R² − c²/4)', indsat: `${fmt(st.R)} − √(${fmt(st.R)}² − ${fmt(st.c)}²/4)`, resultat: `${fmt(f, 2)} mm` },
          { label: 'Pilhøjde (tilnærmet)', formel: 'f ≈ c²/(8R)', indsat: `${fmt(st.c)}²/(8·${fmt(st.R)})`, resultat: `${fmt(fApprox, 2)} mm` },
          { label: 'Radius fra pilhøjde', formel: 'R = c²/(8f) + f/2', indsat: `${fmt(st.c)}²/(8·${fmt(st.f / 1000, 3)}) + ${fmt(st.f / 1000, 3)}/2`, resultat: `${fmt(Rm, 1)} m` },
          { label: 'Hastighed', formel: 'V = √(R·(h + I)/C)', indsat: `√(${fmt(Rm, 1)}·(${st.hm} + ${st.I})/11,80)`, resultat: `${fmt(Vm, 1)} km/t` },
          { label: 'Vridning', formel: 'v = |h₁ − h₂|/b', indsat: `|${st.h1} − ${st.h2}|/${fmt(st.b, 1)}`, resultat: `${fmt(tw, 2)} mm/m` },
        ],
        checks: [...bnRows.map((r) => ({ ...r, label: `BN1-38: ${r.label}` })), ...tsiRows.map((r) => ({ ...r, label: `TSI: ${r.label}` }))],
        noter: ['Grænseværdier for vridning og overhøjdens ujævnhed fremgår af BN1-38 (fejlklasser). TSI INF 4.2.8.3 henviser for vridning til EN 13848-5 og kræver mindst én målebase mellem 2 og 5 m.'],
        refs: ['BN1-38', 'ST16', 'EN13848', 'SR87', 'TSI-INF'],
      });
    };
    const f = form<keyof S>([
      { key: 'R', label: 'Radius', symbol: 'R', unit: 'm', min: 100, max: 10000, step: 10 },
      { key: 'c', label: 'Kordelængde', symbol: 'c', unit: 'm', min: 2, max: 40, step: 1 },
      { key: 'f', label: 'Målt pilhøjde', symbol: 'f', unit: 'mm', min: 1, max: 500, step: 1 },
      { key: 'hm', label: 'Overhøjde (til hastighed)', symbol: 'h', unit: 'mm', min: 0, max: 180, step: 5 },
      { key: 'I', label: 'Tilladt overhøjdeunderskud', symbol: 'I', unit: 'mm', min: 0, max: 160, step: 5 },
      { key: 'h1', label: 'Målt overhøjde, punkt 1', symbol: 'h₁', unit: 'mm', min: -50, max: 200, step: 1 },
      { key: 'h2', label: 'Målt overhøjde, punkt 2', symbol: 'h₂', unit: 'mm', min: -50, max: 200, step: 1 },
      { key: 'b', label: 'Målebase', symbol: 'b', unit: 'm', min: 1, max: 20, step: 0.5 },
      { key: 'sv', label: 'Målt sporvidde (0 = ingen)', symbol: 'G', unit: 'mm', min: 0, max: 1480, step: 1 },
      { key: 'Vs', label: 'Hastighed (kvalitetsklasse)', symbol: 'V', unit: 'km/t', min: 10, max: 300, step: 5 },
      { key: 'p', label: 'Pilhøjde på målevognsdiagram (0 = ingen)', symbol: 'p', unit: 'mm', min: 0, max: 100, step: 0.5 },
    ], st, update);
    root.append(h('div', { class: 'grid' }, card('Input', f, 'card-input'), card('Resultat', out, 'card-out')));
    update();
  },
};
