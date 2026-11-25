import { underfoering, baerelag, ev2Krav, type Projekt, type Situation } from '../core/overgangszone';
import { setReport } from '../core/report';
import { card, fmt, form, h, loadState, results, saveState, select, type Module } from '../ui/dom';

type S = { V: number; saetningsplade: number; dybde: number; laengde: number; Bt: number; Ut: number };
const DEF: S = { V: 160, saetningsplade: 0, dybde: 0.3, laengde: 200, Bt: 0.3, Ut: 0.3 };
type Opt = { situation: string; projekt: string; hyppige: string; geonet: string; sidespor: string; alternativ: string };

const W = 640, H = 230, l = 20, r = 20;
const HU = 290; // højde for snit ved underføring (inkl. EV2-graf)

/** Længdesnit ved underføring (vertikal skala overdrevet). */
function snitUnderfoering(L: number, hoejde: number, hb: number | undefined, Bt: number, Ut: number, ev2: [number, number] | null): string {
  const total = Math.max(L * 1.6, 16);
  const broL = 3;
  const X = (x: number) => l + ((W - l - r) * (x + broL)) / (total + broL);
  const vz = 120; // px pr. m lodret (overdrevet)
  const ySveller = 60;
  const yB = ySveller + 18, yU = yB + Bt * vz, yR = yU + Ut * vz;
  const sveller = Array.from({ length: Math.floor((total + broL) / 0.625) }, (_, k) => {
    const x = -broL + k * 0.625;
    return `<rect x="${X(x) - 3}" y="${ySveller}" width="6" height="12" class="oz-svelle"/>`;
  }).join('');
  const trekant = hoejde > 0 ? `<polygon points="${X(0)},${yR} ${X(L)},${yR} ${X(0)},${yR + hoejde * vz}" class="oz-trekant"/>` : '';
  const hbz = hb ? `<rect x="${X(0)}" y="${yU}" width="${X(hb) - X(0)}" height="${yR - yU + hoejde * vz}" class="oz-hb"/>` : '';
  const yE = (v: number) => HU - 14 - (v / 130) * 46;
  const ev2Line = ev2 ? `<line x1="${X(0)}" y1="${HU - 14}" x2="${X(total)}" y2="${HU - 14}" class="axis"/>
    <polyline points="${X(0)},${yE(ev2[0])} ${X(L)},${yE(ev2[1])} ${X(total)},${yE(ev2[1])}" class="curve-i"/>
    <text x="${X(0) + 4}" y="${yE(ev2[0]) - 5}" class="lbl-svg accent2">EV2 på planum: ${ev2[0]} MPa</text>
    <text x="${X(L) + 4}" y="${yE(ev2[1]) - 5}" class="lbl-svg accent2">${ev2[1]} MPa</text>` : '';
  return `
  <svg viewBox="0 0 ${W} ${ev2 ? HU : H}" class="viz viz-oz" role="img" aria-label="Længdesnit af overgangszone ved underføring">
    <rect x="${X(-broL)}" y="${yB}" width="${X(total) - X(-broL)}" height="${yU - yB}" class="oz-ballast"/>
    <rect x="${X(0)}" y="${yU}" width="${X(total) - X(0)}" height="${yR - yU}" class="oz-ub"/>
    ${trekant}${hbz}
    <rect x="${X(-broL)}" y="${yU}" width="${X(0) - X(-broL)}" height="${yR - yU + 70}" class="oz-bro"/>
    <polyline points="${X(0)},${yR + hoejde * vz} ${X(L)},${yR} ${X(total)},${yR}" class="oz-graense"/>
    <line x1="${X(-broL)}" y1="${ySveller}" x2="${X(total)}" y2="${ySveller}" class="oz-skinne"/>
    ${sveller}
    <line x1="${X(L)}" y1="${ySveller - 20}" x2="${X(L)}" y2="${yR + hoejde * vz + 10}" class="tick"/>
    <g class="oz-dim"><line x1="${X(0)}" y1="${ySveller - 26}" x2="${X(L)}" y2="${ySveller - 26}"/>
      <text x="${(X(0) + X(L)) / 2}" y="${ySveller - 32}" text-anchor="middle" class="lbl-svg">L<tspan font-size="8">oz</tspan> ≥ ${fmt(L)} m</text></g>
    ${hoejde > 0 ? `<text x="${X(0) + 6}" y="${yR + hoejde * vz - 6}" class="lbl-svg">${fmt(hoejde, 2)} m</text>` : ''}
    ${hb ? `<text x="${(X(0) + X(hb)) / 2}" y="${yU + 14}" text-anchor="middle" class="lbl-svg">HB ${hb} m</text>` : ''}
    <text x="${(X(-broL) + X(0)) / 2}" y="${yU + 30}" text-anchor="middle" class="lbl-svg lys">Bro</text>
    <text x="${X(total) - 6}" y="${(yB + yU) / 2 + 4}" text-anchor="end" class="lbl-svg">Ballast</text>
    <text x="${X(total) - 6}" y="${(yU + yR) / 2 + 4}" text-anchor="end" class="lbl-svg">Underballast</text>
    ${ev2Line}
    <text x="${l}" y="14" class="lbl-svg muted">Længdesnit · lodret skala overdrevet</text>
  </svg>`;
}

/** Længdesnit for overgang mellem eksisterende og nyt bærelag. */
function snitBaerelag(b: ReturnType<typeof baerelag>, dybde: number, Bt: number, alternativ: boolean): string {
  const zone = alternativ ? b.Ljaevn : b.Ltrin;
  const total = zone + 9;
  const x0 = 4; // zonens start
  const X = (x: number) => l + ((W - l - r) * x) / total;
  const vz = 160;
  const ySv = 70, yTop = ySv + 14;
  const yEx = yTop + Bt * vz; // eksisterende ballasts underkant
  const yNy = yEx + dybde * vz; // nyt bærelags underkant
  const yBund = H - 22;
  // Grænse mellem nyt bærelag og eksisterende materiale (fra zonens start)
  const g: [number, number][] = [[x0, yEx]];
  if (alternativ) g.push([x0 + zone, yNy]);
  else for (let k = 0; k < b.trin; k++) {
    const xs = x0 + k * b.trinLaengde, y = yEx + (k + 1) * b.trinHoejde * vz;
    g.push([xs, y], [xs + b.trinLaengde, y]);
  }
  g.push([total, yNy]);
  const P = (q: [number, number]) => `${X(q[0]).toFixed(1)},${q[1].toFixed(1)}`;
  const nyt = [[x0, yTop], [total, yTop], ...g.slice().reverse()] as [number, number][];
  const sveller = Array.from({ length: Math.floor(total / 0.625) }, (_, k) => `<rect x="${X(k * 0.625) - 3}" y="${ySv}" width="6" height="12" class="oz-svelle"/>`).join('');
  return `
  <svg viewBox="0 0 ${W} ${H}" class="viz viz-oz" role="img" aria-label="Længdesnit af overgang mellem eksisterende og nyt bærelag">
    <rect x="${X(0)}" y="${yTop}" width="${X(total) - X(0)}" height="${yBund - yTop}" class="oz-ex"/>
    <rect x="${X(0)}" y="${yTop}" width="${X(x0) - X(0)}" height="${yEx - yTop}" class="oz-ballast"/>
    <polygon points="${nyt.map(P).join(' ')}" class="oz-ny"/>
    <polyline points="${[[0, yEx] as [number, number], ...g].map(P).join(' ')}" class="oz-graense"/>
    <line x1="${X(0)}" y1="${ySv}" x2="${X(total)}" y2="${ySv}" class="oz-skinne"/>
    ${sveller}
    <line x1="${X(x0 - b.svejsAfstand)}" y1="${ySv - 14}" x2="${X(x0 - b.svejsAfstand)}" y2="${ySv + 6}" class="oz-svejs"/>
    <text x="${X(x0 - b.svejsAfstand)}" y="${ySv - 18}" text-anchor="middle" class="lbl-svg accent2">svejs</text>
    <g class="oz-dim"><line x1="${X(x0)}" y1="${ySv - 34}" x2="${X(x0 + zone)}" y2="${ySv - 34}"/>
      <line x1="${X(x0)}" y1="${ySv - 40}" x2="${X(x0)}" y2="${ySv - 28}"/><line x1="${X(x0 + zone)}" y1="${ySv - 40}" x2="${X(x0 + zone)}" y2="${ySv - 28}"/>
      <text x="${(X(x0) + X(x0 + zone)) / 2}" y="${ySv - 39}" text-anchor="middle" class="lbl-svg">Overgangszone ${fmt(zone, 1)} m</text></g>
    <text x="${X(0.3)}" y="${(yTop + yEx) / 2 + 4}" class="lbl-svg">Eksist. ballast</text>
    <text x="${X(0.3)}" y="${yEx + 18}" class="lbl-svg">Eksisterende underballast</text>
    <text x="${X(total) - 6}" y="${(yTop + yNy) / 2 + 4}" text-anchor="end" class="lbl-svg">Nyt bærelag (ballast + underballast)</text>
    <text x="${X(x0 + zone / 2)}" y="${yNy + 18}" text-anchor="middle" class="lbl-svg muted">${alternativ ? `jævn overgang: ${fmt(b.haeldningJaevn, 1)} ‰` : `${b.trin} trin à ${fmt(b.trinLaengde, 2)} m × ${fmt(b.trinHoejde * 1000, 0)} mm`}</text>
    <text x="${l}" y="14" class="lbl-svg muted">Uden udskiftning ← | → med udskiftning · lodret skala overdrevet</text>
  </svg>`;
}

export const overgangszone: Module = {
  id: 'overgangszone',
  gruppe: 'Overbygning',
  titel: 'Overgangszoner (BN1-6)',
  kort: 'Overgangszoner',
  ikon: '⟋',
  beskrivelse: 'Overgangszoner ved underføringer og mellem nyt og eksisterende bærelag efter BN1-6-7 afsnit 12.1 og 15.1.',
  render(root) {
    const st = loadState<S>('overgangszone', DEF);
    const opt = loadState<Opt>('overgangszone-opt', { situation: 'underfoering', projekt: 'nyanlaeg', hyppige: 'ja', geonet: 'nej', sidespor: 'nej', alternativ: 'nej' });
    const out = h('div', { class: 'out' });
    const update = () => {
      saveState('overgangszone', st);
      saveState('overgangszone-opt', opt);
      const sit = opt.situation as Situation, projekt = opt.projekt as Projekt;
      let html = '', fig = '';
      const steps: { label: string; formel: string; indsat: string; resultat: string }[] = [];
      let noter: string[] = [];
      if (sit === 'underfoering') {
        const u = underfoering({ projekt, V: st.V, hyppige: opt.hyppige === 'ja', geonet: opt.geonet === 'ja', saetningsplade: st.saetningsplade, sidespor: opt.sidespor === 'ja' });
        noter = u.noter;
        fig = u.type === 'ingen' ? '' : snitUnderfoering(u.Loz, u.hoejde ?? 0, u.hydrauliskBundet, st.Bt, st.Ut, u.ev2Bro ? [u.ev2Bro, u.ev2Normal ?? ev2Krav(st.V)] : null);
        html = `
          <div class="summary summary-ok"><div><strong>${u.type === 'ingen' ? 'Ingen overgangszone krævet' : u.type === 'trekant' ? 'Trekantformet udskiftning' : 'Overgangszone ved underføring'}</strong><span>${projekt === 'nyanlaeg' ? 'Nyanlæg (afsnit 15.1)' : 'Sporfornyelse (afsnit 12.1)'} · V = ${st.V} km/t</span></div>
          <div class="summary-val">${u.Loz ? `≥ ${fmt(u.Loz)} m` : '–'}</div></div>
          ${u.type === 'ingen' ? '' : results([
            { symbol: 'L<sub>oz</sub>', label: 'Mindste længde', value: fmt(u.Loz), unit: 'm', big: true, sub: u.type === 'trekant' ? 'fig. 12.1-1' : 'afsnit 15.1' },
            { symbol: 'h', label: 'Højde af underballastkile', value: fmt(u.hoejde ?? 0, 2), unit: 'm', big: true, sub: opt.geonet === 'ja' ? 'med geonet under kilen (0,35 m)' : 'uden geonet (0,50 m)' },
            ...(u.hydrauliskBundet ? [{ symbol: 'HB', label: 'Hydraulisk bundet bærelag', value: `≥ ${u.hydrauliskBundet}`, unit: 'm', sub: 'nærmest underføringen' }] : []),
            ...(u.ev2Bro ? [{ symbol: 'EV2', label: 'Overflademodul på planum', value: `${u.ev2Bro} → ${u.ev2Normal}`, unit: 'MPa', sub: 'jævn ændring over overgangszonen' }] : []),
          ])}
          ${fig}`;
        steps.push(
          { label: 'Situation', formel: projekt === 'nyanlaeg' ? 'afsnit 15.1' : 'afsnit 12.1', indsat: `V = ${st.V} km/t${projekt === 'fornyelse' ? `, hyppige sporjusteringer: ${opt.hyppige}` : ''}`, resultat: u.type },
          { label: 'Overgangszonens længde', formel: 'Loz', indsat: '', resultat: `${fmt(u.Loz)} m` },
          { label: 'Kilehøjde', formel: 'min. 0,50 m (0,35 m med geonet)', indsat: `geonet: ${opt.geonet}`, resultat: `${fmt(u.hoejde ?? 0, 2)} m` },
          ...(u.ev2Bro ? [{ label: 'EV2', formel: 'fig. 15.1-1', indsat: `V = ${st.V}`, resultat: `${u.ev2Bro} MPa ved bro → ${u.ev2Normal} MPa` }] : []),
        );
      } else if (sit === 'baerelag') {
        const b = baerelag({ dybde: st.dybde, laengdeFornyelse: st.laengde, sidespor: opt.sidespor === 'ja', projekt });
        noter = b.noter;
        const alt = opt.alternativ === 'ja';
        fig = b.kraeves ? snitBaerelag(b, st.dybde, st.Bt, alt) : '';
        html = `
          <div class="summary summary-ok"><div><strong>${b.kraeves ? 'Overgang mellem nyt og eksisterende bærelag' : 'Ingen overgangszone krævet'}</strong><span>Fig. 12.1-2 · dybdeforskel ${fmt(st.dybde, 2)} m</span></div>
          <div class="summary-val">${b.kraeves ? `${fmt(alt ? b.Ljaevn : b.Ltrin, 1)} m` : '–'}</div></div>
          ${b.kraeves ? results([
            { symbol: 'L<sub>trin</sub>', label: 'Trinvis overgang', value: fmt(b.Ltrin, 1), unit: 'm', big: !alt, sub: `${b.trin} trin à ≥ 3,00 m og ≤ 0,15 m (her ${fmt(b.trinHoejde * 1000, 0)} mm)` },
            { symbol: 'L<sub>jævn</sub>', label: 'Alternativ: jævn overgang', value: `≥ ${fmt(b.Ljaevn)}`, unit: 'm', big: alt, sub: `hældning ${fmt(b.haeldningJaevn, 1)} ‰ – bør bruges ved maskinel ombygning` },
            { symbol: 'a<sub>s</sub>', label: 'Svejsninger/isolerklæbestød', value: `≥ ${fmt(b.svejsAfstand, 2)}`, unit: 'm', sub: 'uden for området, hvor ballasten udskiftes' },
          ]) : ''}
          ${fig}`;
        steps.push(
          { label: 'Krav om overgangszone', formel: 'afsnit 12.1 / 15.1', indsat: `fornyelse ${fmt(st.laengde)} m${opt.sidespor === 'ja' ? ', sidespor' : ''}`, resultat: b.kraeves ? 'ja' : 'nej' },
          { label: 'Antal trin', formel: 'n = ⌈Δ / 0,15⌉', indsat: `⌈${fmt(st.dybde, 2)} / 0,15⌉`, resultat: `${b.trin}` },
          { label: 'Trinvis zonelængde', formel: 'n · 3,00 m', indsat: `${b.trin} · 3,00`, resultat: `${fmt(b.Ltrin, 1)} m` },
          { label: 'Jævn overgang', formel: 'L ≥ 20 m', indsat: `Δ/20 = ${fmt(st.dybde, 2)}/20`, resultat: `${fmt(b.haeldningJaevn, 1)} ‰` },
        );
      } else {
        noter = ['Overgangszoner mellem fast befæstet spor og ballasteret spor udføres efter DS/EN 16432-2:2017.', 'Overgangszoner op til overkørsler med fast befæstet spor: Normaltegning blad nr. 7184.'];
        html = `<div class="summary summary-ok"><div><strong>Fast spor ↔ ballasteret spor</strong><span>BN1-6-7 afsnit 15.1 henviser til DS/EN 16432-2</span></div></div>`;
      }
      out.innerHTML = `${html}
        <div class="notice">${noter.map((n) => `• ${n}`).join('<br/>')}</div>
        <p class="tip">Trinvis overgang er tolket ud fra fig. 12.1-2 (trin på mindst 3,00 m med højst 0,15 m højdespring). Detaljer om materialer (stabilt grus, filter, dræn) fremgår af figurerne og BN1-11 «Afvanding af sporarealer».</p>`;
      setReport({
        modul: 'Overgangszoner (BN1-6-7)',
        inputs: [
          { label: 'Situation', symbol: '', value: sit === 'underfoering' ? 'Underføring' : sit === 'baerelag' ? 'Nyt / eksisterende bærelag' : 'Fast spor / ballast', unit: '' },
          { label: 'Projekttype', symbol: '', value: projekt === 'nyanlaeg' ? 'Nyanlæg' : 'Sporfornyelse', unit: '' },
          { label: 'Hastighed', symbol: 'V', value: fmt(st.V), unit: 'km/t' },
          ...(sit === 'baerelag' ? [{ label: 'Dybdeforskel nyt/eksisterende bærelag', symbol: 'Δ', value: fmt(st.dybde, 2), unit: 'm' }, { label: 'Længde af fornyelse', symbol: '', value: fmt(st.laengde), unit: 'm' }] : []),
        ],
        steps, checks: [], noter, refs: ['BN1-6', 'BN1-38'], figur: fig,
      });
    };
    const f = form<keyof S>([
      { key: 'V', label: 'Hastighed', symbol: 'V', unit: 'km/t', min: 10, max: 250, step: 10 },
      { key: 'saetningsplade', label: 'Sætningsplade ved broen (0 = ingen)', symbol: 'L<sub>sp</sub>', unit: 'm', min: 0, max: 20, step: 1 },
      { key: 'dybde', label: 'Dybdeforskel nyt/eksisterende bærelag', symbol: 'Δ', unit: 'm', min: 0.05, max: 1, step: 0.05 },
      { key: 'laengde', label: 'Længde af fornyelse af bærelag', symbol: 'L<sub>f</sub>', unit: 'm', min: 1, max: 2000, step: 1 },
      { key: 'Bt', label: 'Ballasttykkelse (til tegning)', symbol: 'B<sub>t</sub>', unit: 'm', min: 0.2, max: 0.6, step: 0.05 },
      { key: 'Ut', label: 'Underballasttykkelse (til tegning)', symbol: 'U<sub>t</sub>', unit: 'm', min: 0.1, max: 0.8, step: 0.05 },
    ], st, update);
    f.prepend(
      select('Situation', 'situation', [['underfoering', 'Ved underføring (bro)'], ['baerelag', 'Nyt ↔ eksisterende bærelag'], ['fastspor', 'Fast spor ↔ ballasteret spor']], opt, update),
      select('Projekttype', 'projekt', [['nyanlaeg', 'Nyanlæg (afsnit 15.1)'], ['fornyelse', 'Sporfornyelse (afsnit 12.1)']], opt, update),
      select('Hyppige sporjusteringer (fornyelse)', 'hyppige', [['ja', 'Ja / forventes'], ['nej', 'Nej']], opt, update),
      select('Geonet under kilen', 'geonet', [['nej', 'Nej'], ['ja', 'Ja']], opt, update),
      select('Sidespor', 'sidespor', [['nej', 'Nej – hoved-/togvejsspor'], ['ja', 'Ja']], opt, update),
      select('Bærelag: vis alternativ', 'alternativ', [['nej', 'Trinvis (fig. 12.1-2)'], ['ja', 'Jævn ≥ 20 m']], opt, update),
    );
    root.append(h('div', { class: 'grid' }, card('Input', f, 'card-input'), card('Resultat', out, 'card-out')));
    update();
  },
};
