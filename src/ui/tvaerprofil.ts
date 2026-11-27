/** Tegning af tværprofil efter BN1-6 (ét eller to spor). Koordinater i mm, y nedad. */
import type { Geometri, Parametre, SporInput, Svelle } from '../core/bn16';
import { rail, fastening } from './track';
import { fmt } from './dom';

let n = 0;

export interface RendeTegning {
  cx: number; xi: number; x1: number; x2: number; top: number; bund: number; terr: number; a: number; side: -1 | 1;
}

export function tvaerprofilSvg(g: Geometri, p: Parametre, spor: SporInput[], sv: Svelle, saenket: boolean, render: RendeTegning[] = []): string {
  const u = `tp${n++}`;
  const M = (v: number) => v * 1000;
  const pt = (q: { x: number; y: number }) => `${M(q.x).toFixed(1)},${M(q.y).toFixed(1)}`;
  const xmin = M(g.footL.x) - 300, xmax = M(g.footR.x) + 300;
  const T = Math.max(110, (xmax - xmin) / 55);
  const ytop = -Math.max(900, 6.5 * T);
  const ybot0 = M(Math.max(g.footL.y, g.footR.y));
  const groundY = ybot0;
  const ybot = ybot0 + (render.length ? 4.5 : 2.6) * Math.max(110, (M(g.footR.x) - M(g.footL.x) + 600) / 55);

  const dimH = (x1: number, x2: number, y: number, label: string, above = true) => `
    <g class="t-dim"><line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" marker-start="url(#a-${u})" marker-end="url(#a-${u})"/>
    <line x1="${x1}" y1="${y - 45}" x2="${x1}" y2="${y + 45}"/><line x1="${x2}" y1="${y - 45}" x2="${x2}" y2="${y + 45}"/>
    <text x="${(x1 + x2) / 2}" y="${above ? y - 25 : y + T + 10}" text-anchor="middle" font-size="${T}">${label}</text></g>`;
  const dimV = (x: number, y1: number, y2: number, label: string, anchor: 'start' | 'end' = 'start') => `
    <g class="t-dim"><line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" marker-start="url(#a-${u})" marker-end="url(#a-${u})"/>
    <text x="${x + (anchor === 'start' ? 30 : -30)}" y="${(y1 + y2) / 2 + T / 3}" text-anchor="${anchor}" font-size="${T}">${label}</text></g>`;

  // Spor (svelle, befæstelse, skinner) drejet om inderskinnens SO
  const sporSvg = g.spor.map((t, i) => {
    const deg = (t.theta * 180) / Math.PI;
    const L = sv.L, Hs = sv.H;
    const rc = 753.5;
    const hsk = spor[i].yder === 1 ? p.hSkulder : 0;
    const hskL = spor[i].yder === -1 ? p.hSkulder : 0;
    return `<g transform="rotate(${deg.toFixed(3)} ${M(t.pivot.x)} ${M(t.pivot.y)}) translate(${M(t.cx)} 182)">
      <path d="M ${-L / 2},16 L ${-L / 2 + 16},0 L ${L / 2 - 16},0 L ${L / 2},16 L ${L / 2},${Hs} L ${-L / 2},${Hs} Z" class="t-sleeper"/>
      ${saenket ? `<line x1="${-rc + 120}" y1="40" x2="${rc - 120}" y2="40" class="t-lowered"/>` : ''}
      ${fastening(-rc)}${fastening(rc)}${rail(-rc, -1)}${rail(rc, 1)}
      <line x1="0" y1="-420" x2="0" y2="${Hs + 120}" class="tp-cl"/>
      ${dimH(L / 2, L / 2 + M(p.Bsk), -M(hsk) - 140, `Bsk ${fmt(p.Bsk, 2)}`)}
      ${i === 0 && g.spor.length === 1 ? '' : ''}
      ${hskL > 0 ? dimH(-L / 2 - M(p.Bsk), -L / 2, -M(hskL) - 140, `Bsk ${fmt(p.Bsk, 2)}`) : ''}
    </g>
     <text x="${M(t.cx)}" y="${-3.4 * T}" text-anchor="middle" font-size="${T}" class="t-txt t-b">Spor ${i + 1}${spor[i].h > 0 ? ` · h = ${fmt(spor[i].h)} mm` : ''}</text>`;
  }).join('');

  // Bt ved den tyndeste skinnestreng
  const btDims = g.spor.map((t) => {
    const venstre = t.btVenstre <= t.btHoejre;
    const xr = venstre ? t.railX[0] : t.railX[1];
    const yPl = g.planum(xr);
    const bt = Math.min(t.btVenstre, t.btHoejre);
    return dimV(M(xr), M(yPl - bt), M(yPl), `Bt ${fmt(bt, 3)}`, 'end');
  }).join('');

  const first = g.spor[0], last = g.spor[g.spor.length - 1];
  const yDimPb = groundY + 0.9 * T;
  const pbDims = `${dimH(M(g.edgeL.x), M(first.cx), yDimPb, `Pb ${fmt(g.PbL, 2)}`, false)}${dimH(M(last.cx), M(g.edgeR.x), yDimPb, `Pb ${fmt(g.PbR, 2)}`, false)}`;
  const fsDim = g.spor.length === 2 ? dimH(M(first.cx), M(last.cx), -5 * T, `fs ${fmt(p.fs, 2)}`) : '';
  // Kabelrender (BN1-13-4): betonrende med låg og kabler, mål fra spormidte til nærmeste flade
  const rendeSvg = render.map((r) => {
    const w = M(r.x2 - r.x1), hgt = M(r.bund - r.top), wall = Math.min(60, w * 0.15);
    const x = M(r.x1), y = M(r.top);
    const kabler = [0.3, 0.5, 0.7].map((f, j) => `<circle cx="${x + w * f}" cy="${y + hgt - wall - 45 - (j % 2) * 30}" r="${Math.min(38, w * 0.09)}" class="tp-kabel"/>`).join('');
    const yd = groundY + 2.7 * T; // under Pb-målene, så målene ikke krydser ballasten
    return `<g>
      <path d="M ${x},${y + 30} L ${x},${y + hgt} L ${x + w},${y + hgt} L ${x + w},${y + 30} L ${x + w - wall},${y + 30} L ${x + w - wall},${y + hgt - wall} L ${x + wall},${y + hgt - wall} L ${x + wall},${y + 30} Z" class="tp-rende"/>
      <rect x="${x - 10}" y="${y}" width="${w + 20}" height="30" class="tp-laag"/>
      ${kabler}
      ${dimH(M(r.cx), M(r.xi), yd, `a ${fmt(r.a, 2)}`, false)}
      <line x1="${M(r.xi)}" y1="${M(r.bund)}" x2="${M(r.xi)}" y2="${yd}" class="tp-hjlp"/>
      <text x="${x + w / 2}" y="${y - 0.45 * T}" text-anchor="middle" font-size="${T * 0.8}" class="t-txt">Kabelrende</text>
    </g>`;
  }).join('');
  const pbKant = [g.edgeL, g.edgeR].filter((e, i) => Math.abs(e.x - (i ? g.crestR.x : g.crestL.x)) > 1e-6)
    .map((e) => `<line x1="${M(e.x)}" y1="${M(e.y) - 160}" x2="${M(e.x)}" y2="${M(e.y) + 160}" class="tp-pbkant"/>`).join('');
  const xUt = g.edgeL.x + 0.35;
  const utDim = dimV(M(xUt), M(g.planum(xUt)), M(g.raajord(xUt)), `Ut ${fmt(p.Ut, 2)}`);

  return `
  <svg viewBox="${xmin} ${ytop} ${xmax - xmin} ${ybot - ytop}" class="viz viz-tp" role="img" aria-label="Tværprofil for ballasteret spor">
    <defs>
      <marker id="a-${u}" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,1 L10,5 L0,9 z" class="t-arrow"/></marker>
      <pattern id="b-${u}" width="60" height="60" patternUnits="userSpaceOnUse"><rect width="60" height="60" class="t-bal-bg"/><circle cx="14" cy="16" r="9" class="t-bal-st"/><circle cx="44" cy="40" r="11" class="t-bal-st"/><circle cx="40" cy="8" r="5" class="t-bal-st"/><circle cx="12" cy="48" r="6" class="t-bal-st"/></pattern>
      <pattern id="u-${u}" width="40" height="40" patternUnits="userSpaceOnUse"><rect width="40" height="40" class="t-ub-bg"/><circle cx="10" cy="10" r="3" class="t-ub-st"/><circle cx="30" cy="28" r="3.5" class="t-ub-st"/></pattern>
      <pattern id="j-${u}" width="80" height="80" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="80" height="80" class="t-jord-bg"/><line x1="0" y1="0" x2="0" y2="80" class="t-jord-st"/></pattern>
    </defs>
    <line x1="${xmin}" y1="${groundY}" x2="${xmax}" y2="${groundY}" class="tp-terraen"/>
    <polygon points="${g.daemning.map(pt).join(' ')}" fill="url(#j-${u})"/>
    <polygon points="${g.underballast.map(pt).join(' ')}" fill="url(#u-${u})" class="t-layer"/>
    <polygon points="${g.ballast.map(pt).join(' ')}" fill="url(#b-${u})" class="t-layer"/>
    ${sporSvg}
    ${pbKant}${rendeSvg}
    ${btDims}${utDim}${pbDims}${fsDim}
    <circle cx="${M(g.toeL.x)}" cy="${M(g.toeL.y)}" r="22" class="t-pivot"/><circle cx="${M(g.toeR.x)}" cy="${M(g.toeR.y)}" r="22" class="t-pivot"/>
    <text x="${(M(g.toeL.x) + M(first.shL.x)) / 2 - 80}" y="${(M(g.toeL.y) + M(first.shL.y)) / 2}" text-anchor="end" font-size="${T}" class="t-txt">1:${fmt(p.a, 1)}</text>
    <text x="${(M(g.crestR.x) + M(g.footR.x)) / 2 + 80}" y="${(M(g.crestR.y) + M(g.footR.y)) / 2}" font-size="${T}" class="t-txt">1:${fmt(p.as, 1)}</text>
    <text x="${M(g.edgeR.x)}" y="${M(g.raajord(g.edgeR.x)) + 1.6 * T}" text-anchor="end" font-size="${T * 0.9}" class="t-txt tp-lys">Planum / råjordsplanum ${fmt(p.Xp)} / ${fmt(p.Xrp)} ‰${g.fald === 'hoejre' ? ' →' : g.fald === 'venstre' ? ' ←' : ''}</text>
    <text x="${M(g.toeR.x) + 40}" y="${M(g.toeR.y) - 0.4 * T}" font-size="${T * 0.85}" class="t-txt t-muted">Pbb ${fmt(g.pbbR, 2)}</text>
    <text x="${M(g.toeL.x) - 40}" y="${M(g.toeL.y) - 0.4 * T}" text-anchor="end" font-size="${T * 0.85}" class="t-txt t-muted">Pbb ${fmt(g.pbbL, 2)}</text>
    <text x="${xmin + 60}" y="${ytop + 1.2 * T}" font-size="${T}" class="t-txt t-muted">Mål i m · svelle L = ${fmt(sv.L)} mm${saenket ? ' · ballast −40 mm mellem skinner' : ''}</text>
  </svg>`;
}
