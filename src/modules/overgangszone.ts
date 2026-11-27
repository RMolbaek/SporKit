import { underfoering, baerelag, ev2Krav, type Projekt, type Situation } from '../core/overgangszone';
import { setReport } from '../core/report';
import { card, chip, fmt, form, h, loadState, results, saveState, select, type Module } from '../ui/dom';

type S = { V: number; saetningsplade: number; laengde: number; Bt: number; Ut: number; BtNy: number; UtNy: number; L1: number; L2: number; aSvejs: number };
const DEF: S = { V: 160, saetningsplade: 0, laengde: 200, Bt: 0.3, Ut: 0.3, BtNy: 0.3, UtNy: 0.25, L1: 3, L2: 3, aSvejs: 1.5 };
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
  // Fig. 12.1-1: kile af stabilt grus lige under ballasten (planum), ≥ 0,50 m tyk ved broen og aftagende til 0 over L
  const yK = yU + hoejde * vz;
  const trekant = hoejde > 0 ? `<polygon points="${X(0)},${yU} ${X(L)},${yU} ${X(0)},${yK}" class="oz-trekant"/>` : '';
  const hbz = hb ? `<rect x="${X(0)}" y="${yU}" width="${X(hb) - X(0)}" height="${Math.max(yR, yK) - yU}" class="oz-hb"/>` : '';
  const yE = (v: number) => HU - 14 - (v / 130) * 46;
  const ev2Line = ev2 ? `<line x1="${X(0)}" y1="${HU - 14}" x2="${X(total)}" y2="${HU - 14}" class="axis"/>
    <polyline points="${X(0)},${yE(ev2[0])} ${X(L)},${yE(ev2[1])} ${X(total)},${yE(ev2[1])}" class="curve-i"/>
    <text x="${X(0) + 4}" y="${yE(ev2[0]) - 5}" class="lbl-svg accent2">EV2 på planum: ${ev2[0]} MPa</text>
    <text x="${X(L) + 4}" y="${yE(ev2[1]) - 5}" class="lbl-svg accent2">${ev2[1]} MPa</text>` : '';
  return `
  <svg viewBox="0 0 ${W} ${ev2 ? HU : H}" class="viz viz-oz" role="img" aria-label="Længdesnit af overgangszone ved underføring">
    <rect x="${X(-broL)}" y="${yB}" width="${X(total) - X(-broL)}" height="${yU - yB}" class="oz-ballast"/>
    <rect x="${X(0)}" y="${yU}" width="${X(total) - X(0)}" height="${yR - yU}" class="oz-ub"/>
    <rect x="${X(0)}" y="${yR}" width="${X(total) - X(0)}" height="${Math.max(yK, yR) + 28 - yR}" class="oz-raajord"/>
    ${trekant}${hbz}
    <rect x="${X(-broL)}" y="${yU}" width="${X(0) - X(-broL)}" height="${Math.max(yR, yK) - yU + 28}" class="oz-bro"/>
    <polyline points="${X(0)},${yK} ${X(L)},${yU}" class="oz-graense"/>
    ${hoejde > 0 ? `<circle cx="${X(0.45)}" cy="${yU + 12}" r="4" class="oz-draen"/>${hb ? '' : `<text x="${X(0.8)}" y="${yU + 15}" class="lbl-svg muted">dræn</text>`}` : ''}
    <line x1="${X(-broL)}" y1="${ySveller}" x2="${X(total)}" y2="${ySveller}" class="oz-skinne"/>
    ${sveller}
    <line x1="${X(L)}" y1="${ySveller - 20}" x2="${X(L)}" y2="${Math.max(yR, yK) + 10}" class="tick"/>
    <g class="oz-dim"><line x1="${X(0)}" y1="${ySveller - 26}" x2="${X(L)}" y2="${ySveller - 26}"/>
      <text x="${(X(0) + X(L)) / 2}" y="${ySveller - 32}" text-anchor="middle" class="lbl-svg">L<tspan font-size="8">oz</tspan> ≥ ${fmt(L)} m</text></g>
    ${hoejde > 0 ? `<g class="oz-dim"><line x1="${X(0) + 4}" y1="${yU}" x2="${X(0) + 4}" y2="${yK}"/></g><text x="${X(0) + 8}" y="${(yU + yK) / 2 + 10}" class="lbl-svg accent2">≥ ${fmt(hoejde, 2)} m</text>
    <text x="${X(L * 0.3)}" y="${yU + 13}" class="lbl-svg">Stabilt grus (kile)</text>` : ''}
    ${hb ? `<text x="${X(hb) - 4}" y="${Math.max(yR, yK) - 5}" text-anchor="end" class="lbl-svg">HB ${hb} m</text>` : ''}
    <text x="${(X(-broL) + X(0)) / 2}" y="${yU + 30}" text-anchor="middle" class="lbl-svg lys">Bro</text>
    <text x="${X(total) - 6}" y="${(yB + yU) / 2 + 4}" text-anchor="end" class="lbl-svg">Ballast</text>
    <text x="${X(total) - 6}" y="${(yU + yR) / 2 + 4}" text-anchor="end" class="lbl-svg">Underballast</text>
    ${ev2Line}
    <text x="${l}" y="14" class="lbl-svg muted">Længdesnit · lodret skala overdrevet</text>
  </svg>`;
}

/** Længdesnit for overgang mellem eksisterende og nyt bærelag – trappe efter fig. 12.1-2 eller jævn overgang. */
function snitBaerelag(b: ReturnType<typeof baerelag>, st: S, alternativ: boolean): string {
  const HB = 300;
  const foer = Math.max(st.aSvejs, 1.5) + 2; // område uden udskiftning
  const x0 = foer; // overgangszonens start (udgravningen begynder)
  const zone = alternativ ? Math.max(b.Ljaevn, 20) : b.Ltrin;
  const efter = alternativ ? 4 : 4.5;
  const total = x0 + zone + efter;
  const X = (x: number) => l + ((W - l - r) * x) / total;
  const Dvis = Math.max(b.D, b.P2 + 0.1, st.Bt + st.Ut);
  const vz = Math.min(230, 170 / Dvis); // px pr. m lodret (overdrevet)
  const ySv = 86, yU = ySv + 16; // svelleunderkant = 0 m
  const Y = (d: number) => yU + d * vz;
  const yBund = Y(Math.max(Dvis, st.Bt + st.Ut) + 0.12);
  // Udgravningens bundlinje (fed linje i figuren)
  const s1 = b.P1, sT = 0.15, s3 = Math.max(0, b.D - b.P2); // skråninger 1:1 i virkelig skala
  const g: [number, number][] = alternativ
    ? [[x0, 0], [x0 + zone, b.D], [total, b.D]]
    : [[x0, 0], [x0 + s1, b.P1], [x0 + st.L1, b.P1], [x0 + st.L1 + sT, b.P2], [x0 + st.L1 + st.L2, b.P2], [x0 + st.L1 + st.L2 + s3, b.D], [total, b.D]];
  const P = (q: [number, number]) => `${X(q[0]).toFixed(1)},${Y(q[1]).toFixed(1)}`;
  // Nyt materiale = mellem svelleunderkant og udgravningens bund; ny ballast ned til Bt,ny, ny underballast derunder
  const nytAlt = [[x0, 0], [total, 0], ...g.slice().reverse()] as [number, number][];
  const klippet: [number, number][] = [];
  for (let k = 0; k < g.length; k++) {
    const [xa, da] = g[k];
    if (k > 0) {
      const [xp, dp] = g[k - 1];
      if ((dp - st.BtNy) * (da - st.BtNy) < 0) klippet.push([xp + (xa - xp) * (st.BtNy - dp) / (da - dp), st.BtNy]);
    }
    klippet.push([xa, Math.min(da, st.BtNy)]);
  }
  const nytBallast = [[x0, 0], [total, 0], ...klippet.slice().reverse()] as [number, number][];
  const sveller = Array.from({ length: Math.floor(total / 0.625) + 1 }, (_, k) => `<path d="M ${X(k * 0.625 + 0.05) - 5},${ySv} h 10 l -2,${yU - ySv} h -6 z" class="oz-svelle"/>`).join('');
  const dim = (a: number, c: number, y: number, t: string) => `<g class="oz-dim"><line x1="${X(a)}" y1="${y}" x2="${X(c)}" y2="${y}"/>
      <line x1="${X(a)}" y1="${y - 5}" x2="${X(a)}" y2="${y + 5}"/><line x1="${X(c)}" y1="${y - 5}" x2="${X(c)}" y2="${y + 5}"/>
      <text x="${(X(a) + X(c)) / 2}" y="${y + 14}" text-anchor="middle" class="lbl-svg">${t}</text></g>`;
  const yD = yBund + 16;
  const svejsX = x0 - st.aSvejs;
  return `
  <svg viewBox="0 0 ${W} ${HB + Math.max(0, yD + 30 - HB)}" class="viz viz-oz" role="img" aria-label="Længdesnit af overgang mellem eksisterende og nyt bærelag">
    <rect x="${X(0)}" y="${Y(0)}" width="${X(total) - X(0)}" height="${Y(st.Bt) - Y(0)}" class="oz-ballast"/>
    <rect x="${X(0)}" y="${Y(st.Bt)}" width="${X(total) - X(0)}" height="${Y(st.Bt + st.Ut) - Y(st.Bt)}" class="oz-ub"/>
    <rect x="${X(0)}" y="${Y(st.Bt + st.Ut)}" width="${X(total) - X(0)}" height="${yBund - Y(st.Bt + st.Ut)}" class="oz-raajord"/>
    <polygon points="${nytAlt.map(P).join(' ')}" class="oz-nyub"/>
    <polygon points="${nytBallast.map(P).join(' ')}" class="oz-ny"/>
    <line x1="${X(0)}" y1="${Y(st.Bt)}" x2="${X(total)}" y2="${Y(st.Bt)}" class="oz-eks"/>
    <line x1="${X(0)}" y1="${Y(st.Bt + st.Ut)}" x2="${X(total)}" y2="${Y(st.Bt + st.Ut)}" class="oz-eks"/>
    <polyline points="${g.map(P).join(' ')}" class="oz-trappe"/>
    <line x1="${X(0)}" y1="${ySv}" x2="${X(total)}" y2="${ySv}" class="oz-skinne"/>
    ${sveller}
    <line x1="${X(x0)}" y1="${ySv - 44}" x2="${X(x0)}" y2="${yBund}" class="tick"/>
    <line x1="${X(x0 + zone)}" y1="${ySv - 44}" x2="${X(x0 + zone)}" y2="${yBund}" class="tick"/>
    <line x1="${X(svejsX)}" y1="${ySv - 16}" x2="${X(svejsX)}" y2="${ySv + 4}" class="oz-svejs"/>
    <text x="${Math.max(l, X(svejsX) - 14)}" y="${ySv - 20}" class="lbl-svg accent2">svejsning / isolerklæbestød</text>
    <text x="${X(0)}" y="${ySv - 50}" class="lbl-svg muted">UDEN udskiftning</text>
    <text x="${X(x0 + zone / 2)}" y="${ySv - 50}" text-anchor="middle" class="lbl-svg">Overgangszone</text>
    <text x="${X(total)}" y="${ySv - 50}" text-anchor="end" class="lbl-svg muted">MED udskiftning</text>
    <text x="${X(0.2)}" y="${(Y(0) + Y(st.Bt)) / 2 + 4}" class="lbl-svg">Eksist. ballast</text>
    <text x="${X(0.2)}" y="${(Y(st.Bt) + Y(st.Bt + st.Ut)) / 2 + 4}" class="lbl-svg">Eksist. underballast</text>
    <text x="${X(total) - 4}" y="${(Y(0) + Y(Math.min(st.BtNy, b.D))) / 2 + 4}" text-anchor="end" class="lbl-svg">Ny ballast</text>
    ${b.D > st.BtNy ? `<text x="${X(total) - 4}" y="${(Y(st.BtNy) + Y(b.D)) / 2 + 4}" text-anchor="end" class="lbl-svg">Ny underballast</text>` : ''}
    ${alternativ ? '' : `<g class="oz-dim"><line x1="${X(x0 + st.L1 + 0.6)}" y1="${Y(b.P1)}" x2="${X(x0 + st.L1 + 0.6)}" y2="${Y(b.P2)}"/>
      <text x="${X(x0 + st.L1 + 0.75)}" y="${(Y(b.P1) + Y(b.P2)) / 2 + 4}" class="lbl-svg accent2">0,15 m</text></g>`}
    ${dim(svejsX, x0, yD, `a ${fmt(st.aSvejs, 2)}`)}
    ${alternativ ? dim(x0, x0 + zone, yD, `${fmt(zone, 1)} m (min. 20) · ${fmt(b.haeldningJaevn, 1)} ‰`)
      : dim(x0, x0 + st.L1, yD, `L1 ${fmt(st.L1, 2)} m`) + dim(x0 + st.L1, x0 + st.L1 + st.L2, yD, `L2 ${fmt(st.L2, 2)} m`)}
    <text x="${X(total)}" y="${yD + 14}" text-anchor="end" class="lbl-svg muted">${alternativ ? '' : 'min.: a 1,50 · L1 og L2 3,00 m'}</text>
    <text x="${l}" y="14" class="lbl-svg muted">Længdesnit efter BN1-6-7 fig. 12.1-2 · lodret skala overdrevet · udgravningens bund vist med fed linje</text>
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
      let checks: { label: string; value: string; graense: string; status: 'ok' | 'overskredet'; kilde: string }[] = [];
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
        const b = baerelag({ BtEks: st.Bt, BtNy: st.BtNy, UtNy: st.UtNy, L1: st.L1, L2: st.L2, aSvejs: st.aSvejs, laengdeFornyelse: st.laengde, sidespor: opt.sidespor === 'ja', projekt });
        noter = b.noter;
        checks = b.checks;
        const alt = opt.alternativ === 'ja';
        fig = b.kraeves ? snitBaerelag(b, st, alt) : '';
        const total = b.checks.some((c) => c.status === 'overskredet') ? 'overskredet' : 'ok';
        html = `
          <div class="summary summary-${b.kraeves ? total : 'ok'}"><div><strong>${b.kraeves ? (alt ? 'Jævn overgang mellem nyt og eksisterende bærelag' : 'Trappeformet overgang mellem nyt og eksisterende bærelag') : 'Ingen overgangszone krævet'}</strong><span>Fig. 12.1-2 · nyt bærelag ${fmt(b.D, 2)} m under svelleunderkant · eksisterende planum ${fmt(b.P2, 2)} m</span></div>
          <div class="summary-val">${b.kraeves ? `${fmt(alt ? b.Ljaevn : b.Ltrin, 1)} m` : '–'}</div></div>
          ${b.kraeves ? results([
            { symbol: 'P<sub>1</sub>', label: 'Plateau 1', value: fmt(b.P1, 2), unit: 'm', sub: `under svelleunderkant · længde ${fmt(st.L1, 2)} m (≥ 3,00)`, status: st.L1 >= 3 - 1e-9 ? 'ok' : 'overskredet' },
            { symbol: 'P<sub>2</sub>', label: 'Plateau 2 = eksisterende planum', value: fmt(b.P2, 2), unit: 'm', sub: `0,15 m under plateau 1 · længde ${fmt(st.L2, 2)} m (≥ 3,00)`, status: st.L2 >= 3 - 1e-9 ? 'ok' : 'overskredet' },
            { symbol: 'D', label: 'Nyt bærelags underkant', value: fmt(b.D, 2), unit: 'm', sub: `ballast ${fmt(st.BtNy, 2)} + underballast ${fmt(st.UtNy, 2)} m` },
            { symbol: 'L<sub>trin</sub>', label: 'Trappeformet overgangszone', value: fmt(b.Ltrin, 1), unit: 'm', big: !alt, sub: `mindst 2 × 3,00 = ${fmt(b.LtrinMin, 1)} m` },
            { symbol: 'L<sub>jævn</sub>', label: 'Alternativ: jævn overgang', value: `≥ ${fmt(b.Ljaevn)}`, unit: 'm', big: alt, sub: `hældning ${fmt(b.haeldningJaevn, 1)} ‰ – bør bruges ved maskinel ombygning` },
            { symbol: 'a<sub>s</sub>', label: 'Svejsning/isolerklæbestød', value: fmt(st.aSvejs, 2), unit: 'm', sub: 'fra udskiftningsområdet (≥ 1,50 m)', status: st.aSvejs >= 1.5 - 1e-9 ? 'ok' : 'overskredet' },
          ]) : ''}
          ${fig}
          ${b.checks.length ? `<table class="tbl"><tbody>${b.checks.map((c) => `<tr><td>${c.label}<br/><small>${c.kilde}</small></td><td>${c.value}</td><td>${c.graense}</td><td>${chip(c.status)}</td></tr>`).join('')}</tbody></table>` : ''}`;
        steps.push(
          { label: 'Krav om overgangszone', formel: 'afsnit 12.1 / 15.1', indsat: `fornyelse ${fmt(st.laengde)} m${opt.sidespor === 'ja' ? ', sidespor' : ''}`, resultat: b.kraeves ? 'ja' : 'nej' },
          { label: 'Plateau 2 (eksisterende planum)', formel: 'P2 = Bt,eks', indsat: fmt(st.Bt, 2), resultat: `${fmt(b.P2, 2)} m` },
          { label: 'Plateau 1', formel: 'P1 = P2 − 0,15', indsat: `${fmt(b.P2, 2)} − 0,15`, resultat: `${fmt(b.P1, 2)} m` },
          { label: 'Nyt bærelags underkant', formel: 'D = Bt,ny + Ut,ny', indsat: `${fmt(st.BtNy, 2)} + ${fmt(st.UtNy, 2)}`, resultat: `${fmt(b.D, 2)} m` },
          { label: 'Trappeformet zone', formel: 'L1 + L2 (hver ≥ 3,00 m)', indsat: `${fmt(st.L1, 2)} + ${fmt(st.L2, 2)}`, resultat: `${fmt(b.Ltrin, 2)} m` },
          { label: 'Jævn overgang', formel: 'L ≥ 20 m', indsat: `D/20 = ${fmt(b.D, 2)}/20`, resultat: `${fmt(b.haeldningJaevn, 1)} ‰` },
        );
      } else {
        noter = ['Overgangszoner mellem fast befæstet spor og ballasteret spor udføres efter DS/EN 16432-2:2017.', 'Overgangszoner op til overkørsler med fast befæstet spor: Normaltegning blad nr. 7184.'];
        html = `<div class="summary summary-ok"><div><strong>Fast spor ↔ ballasteret spor</strong><span>BN1-6-7 afsnit 15.1 henviser til DS/EN 16432-2</span></div></div>`;
      }
      out.innerHTML = `${html}
        <div class="notice">${noter.map((n) => `• ${n}`).join('<br/>')}</div>
        <p class="tip">Trappen følger fig. 12.1-2: udgravningen går fra svelleunderkant ned til plateau 1 (0,15 m over eksisterende planum), derefter 0,15 m ned til plateau 2 i eksisterende planum og til sidst ned til det nye bærelags underkant. Skråningerne mellem niveauerne er vist som 1:1 (ikke dimensioneret i normen). Detaljer om materialer (stabilt grus, filter, dræn) fremgår af figurerne og BN1-11 «Afvanding af sporarealer».</p>`;
      setReport({
        modul: 'Overgangszoner (BN1-6-7)',
        inputs: [
          { label: 'Situation', symbol: '', value: sit === 'underfoering' ? 'Underføring' : sit === 'baerelag' ? 'Nyt / eksisterende bærelag' : 'Fast spor / ballast', unit: '' },
          { label: 'Projekttype', symbol: '', value: projekt === 'nyanlaeg' ? 'Nyanlæg' : 'Sporfornyelse', unit: '' },
          { label: 'Hastighed', symbol: 'V', value: fmt(st.V), unit: 'km/t' },
          ...(sit === 'baerelag' ? [{ label: 'Eksisterende ballast / underballast', symbol: 'Bt / Ut', value: `${fmt(st.Bt, 2)} / ${fmt(st.Ut, 2)}`, unit: 'm' }, { label: 'Nyt bærelag: ballast / underballast', symbol: 'Bt / Ut', value: `${fmt(st.BtNy, 2)} / ${fmt(st.UtNy, 2)}`, unit: 'm' }, { label: 'Plateaulængder', symbol: 'L1 / L2', value: `${fmt(st.L1, 2)} / ${fmt(st.L2, 2)}`, unit: 'm' }, { label: 'Afstand til svejsning/isolerklæbestød', symbol: 'a', value: fmt(st.aSvejs, 2), unit: 'm' }, { label: 'Længde af fornyelse', symbol: '', value: fmt(st.laengde), unit: 'm' }] : []),
        ],
        steps, checks: checks.map((c) => ({ ...c })), noter, refs: ['BN1-6', 'BN1-38'], figur: fig,
      });
    };
    const f = form<keyof S>([
      { key: 'V', label: 'Hastighed', symbol: 'V', unit: 'km/t', min: 10, max: 250, step: 10 },
      { key: 'saetningsplade', label: 'Sætningsplade ved broen (0 = ingen)', symbol: 'L<sub>sp</sub>', unit: 'm', min: 0, max: 20, step: 1 },
      { key: 'laengde', label: 'Længde af fornyelse af bærelag', symbol: 'L<sub>f</sub>', unit: 'm', min: 1, max: 2000, step: 1 },
      { key: 'Bt', label: 'Eksisterende ballasttykkelse', symbol: 'B<sub>t,eks</sub>', unit: 'm', min: 0.1, max: 0.8, step: 0.05 },
      { key: 'Ut', label: 'Eksisterende underballasttykkelse', symbol: 'U<sub>t,eks</sub>', unit: 'm', min: 0, max: 0.8, step: 0.05 },
      { key: 'BtNy', label: 'Nyt bærelag: ballast', symbol: 'B<sub>t,ny</sub>', unit: 'm', min: 0.2, max: 0.6, step: 0.05, hint: 'BN1-6-7 fig. 12.1-4 / 15.1-3' },
      { key: 'UtNy', label: 'Nyt bærelag: underballast', symbol: 'U<sub>t,ny</sub>', unit: 'm', min: 0, max: 0.8, step: 0.05 },
      { key: 'L1', label: 'Plateau 1 (bærelag) længde', symbol: 'L<sub>1</sub>', unit: 'm', min: 0, max: 20, step: 0.5, hint: 'fig. 12.1-2: min. 3,00 m' },
      { key: 'L2', label: 'Plateau 2 (bærelag) længde', symbol: 'L<sub>2</sub>', unit: 'm', min: 0, max: 20, step: 0.5, hint: 'fig. 12.1-2: min. 3,00 m' },
      { key: 'aSvejs', label: 'Afstand til svejsning/isolerklæbestød', symbol: 'a<sub>s</sub>', unit: 'm', min: 0, max: 20, step: 0.5, hint: 'min. 1,50 m' },
    ], st, update);
    f.prepend(
      select('Situation', 'situation', [['underfoering', 'Ved underføring (bro)'], ['baerelag', 'Nyt ↔ eksisterende bærelag'], ['fastspor', 'Fast spor ↔ ballasteret spor']], opt, update),
      select('Projekttype', 'projekt', [['nyanlaeg', 'Nyanlæg (afsnit 15.1)'], ['fornyelse', 'Sporfornyelse (afsnit 12.1)']], opt, update),
      select('Hyppige sporjusteringer (fornyelse)', 'hyppige', [['ja', 'Ja / forventes'], ['nej', 'Nej']], opt, update),
      select('Geonet under kilen', 'geonet', [['nej', 'Nej'], ['ja', 'Ja']], opt, update),
      select('Sidespor', 'sidespor', [['nej', 'Nej – hoved-/togvejsspor'], ['ja', 'Ja']], opt, update),
      select('Bærelag: udformning', 'alternativ', [['nej', 'Trappe (fig. 12.1-2)'], ['ja', 'Jævn overgang ≥ 20 m']], opt, update),
    );
    root.append(h('div', { class: 'grid' }, card('Input', f, 'card-input'), card('Resultat', out, 'card-out')));
    update();
  },
};
