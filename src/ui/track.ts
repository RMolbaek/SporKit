/**
 * Tegninger af sporets tværsnit, skinneunderstøtning og plan.
 * Alle mål i mm i tegningens koordinatsystem. Tegningerne er skematiske,
 * men hovedmål svarer til data i core/overbygning.ts.
 */
import { SVELLER, SKINNE_60E2, TVAERPROFIL, SVELLEAFSTAND, type SvelleType } from '../core/overbygning';
import { fmt } from './dom';

let uidN = 0;
const uid = () => `t${(uidN++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const RAIL_PATH =
  'M -75,0 L 75,0 L 75,-11 L 60,-15 L 9,-34 Q 8.25,-36 8.25,-40 L 8.25,-112 Q 8.25,-118 14,-121 ' +
  'L 34,-128 Q 36,-129 36,-132 L 36,-160 Q 34,-172 18,-172 L -18,-172 Q -34,-172 -36,-160 L -36,-132 ' +
  'Q -36,-129 -34,-128 L -14,-121 Q -8.25,-118 -8.25,-112 L -8.25,-40 Q -8.25,-36 -9,-34 L -60,-15 L -75,-11 Z';

const PAD = 10; // mellemlæg (skematisk)
const INCL = (Math.atan(1 / SKINNE_60E2.haeldning) * 180) / Math.PI;

export function rail(xc: number, side: -1 | 1): string {
  // side -1 = venstre skinne (hælder mod højre/sporets midte), +1 = højre
  const ang = side === -1 ? INCL : -INCL;
  return `<g transform="translate(${xc},${-PAD}) rotate(${ang.toFixed(3)})">
    <path d="${RAIL_PATH}" class="t-rail"/></g>`;
}

export function fastening(xc: number): string {
  const one = (s: 1 | -1) => {
    const x0 = xc + s * 80;
    const x1 = xc + s * 112;
    return `<rect x="${Math.min(x0, x1)}" y="-48" width="32" height="48" rx="4" class="t-shoulder"/>
      <path d="M ${xc + s * 108},-38 C ${xc + s * 128},-80 ${xc + s * 66},-84 ${xc + s * 66},-26" class="t-clip"/>`;
  };
  return `<rect x="${xc - 82}" y="${-PAD}" width="164" height="${PAD}" class="t-pad"/>${one(1)}${one(-1)}`;
}

export interface TrackOpts {
  svelle: SvelleType;
  h: number;
  V?: number;
  dims?: boolean;
}

/** Tværprofil af ballasteret spor med overhøjde h (ægte skala). */
export function trackCrossSection(o: TrackOpts): string {
  const u = uid();
  const sv = SVELLER[o.svelle];
  const Hs = sv.hoejde;
  const half = sv.laengde / 2;
  const rc = sv.sporvidde / 2 + SKINNE_60E2.hoved / 2; // skinnemidte
  const railTop = -(PAD + SKINNE_60E2.hoejde);
  const theta = Math.asin(Math.min(0.2, Math.max(0, o.h) / 1500));
  const px = -rc, py = railTop; // drejepunkt: inderskinnens top
  const ca = Math.cos(-theta), sa = Math.sin(-theta);
  const rot = (x: number, y: number) => {
    const dx = x - px, dy = y - py;
    return { x: px + dx * ca - dy * sa, y: py + dx * sa + dy * ca };
  };
  const deg = (-theta * 180) / Math.PI;

  const TL = rot(-half, 0), TR = rot(half, 0), BL = rot(-half, Hs), BR = rot(half, Hs);
  const yF = rot(-rc, Hs).y + TVAERPROFIL.ballast; // underballastens overside
  const sk = TVAERPROFIL.skulder, an = TVAERPROFIL.anlaeg;
  // Ballastskulderen følger sporplanet (svellens overside) og drejes med overhøjden
  const shL = rot(-half - sk, 0), shR = rot(half + sk, 0);
  const toeL = { x: shL.x - an * (yF - shL.y), y: yF }, toeR = { x: shR.x + an * (yF - shR.y), y: yF };
  const ut = TVAERPROFIL.underballast, ph = TVAERPROFIL.planumHaeldning;
  const planY = (x: number) => yF + ut + ph * Math.abs(x);
  const outL = toeL.x - an * (ut + ph * Math.abs(toeL.x)) * 1.07;
  const outR = toeR.x + an * (ut + ph * Math.abs(toeR.x)) * 1.07;
  const bottom = planY(outR) + 200;
  const xmin = outL - 120, xmax = outR + 120;
  const ytop = railTop - 560;

  const ballast = `${shL.x},${shL.y} ${TL.x},${TL.y} ${BL.x},${BL.y} ${BR.x},${BR.y} ${TR.x},${TR.y} ${shR.x},${shR.y} ${toeR.x},${toeR.y} ${toeL.x},${toeL.y}`;
  const ub = `${toeL.x},${yF} ${toeR.x},${yF} ${outR},${planY(outR)} ${0},${planY(0)} ${outL},${planY(outL)}`;
  const ground = `${xmin},${planY(xmin)} ${outL},${planY(outL)} 0,${planY(0)} ${outR},${planY(outR)} ${xmax},${planY(xmax)} ${xmax},${bottom} ${xmin},${bottom}`;

  const outerTop = rot(rc, railTop);
  const dims = o.dims !== false;
  const T = 105; // tekststørrelse

  const sleeper = `<path d="M ${-half},16 L ${-half + 16},0 L ${half - 16},0 L ${half},16 L ${half},${Hs} L ${-half},${Hs} Z" class="t-sleeper"/>`;
  const lowered = (o.V ?? 0) > 160
    ? `<line x1="${-rc + 120}" y1="${TVAERPROFIL.saenkningV160}" x2="${rc - 120}" y2="${TVAERPROFIL.saenkningV160}" class="t-lowered"/>`
    : '';

  const dimH = (x1: number, x2: number, y: number, label: string, cls = '') => `
    <g class="t-dim ${cls}"><line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" marker-start="url(#tA-${u})" marker-end="url(#tA-${u})"/>
    <line x1="${x1}" y1="${y - 40}" x2="${x1}" y2="${y + 40}"/><line x1="${x2}" y1="${y - 40}" x2="${x2}" y2="${y + 40}"/>
    <text x="${(x1 + x2) / 2}" y="${y - 22}" text-anchor="middle" font-size="${T}">${label}</text></g>`;
  const dimV = (x: number, y1: number, y2: number, label: string, anchor: 'start' | 'end' = 'start') => `
    <g class="t-dim"><line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" marker-start="url(#tA-${u})" marker-end="url(#tA-${u})"/>
    <text x="${x + (anchor === 'start' ? 30 : -30)}" y="${(y1 + y2) / 2 + T / 3}" text-anchor="${anchor}" font-size="${T}">${label}</text></g>`;

  return `
  <svg viewBox="${xmin} ${ytop} ${xmax - xmin} ${bottom - ytop}" class="viz viz-track" role="img"
       aria-label="Tværprofil: ${sv.navn}, overhøjde ${fmt(o.h)} mm">
    <defs>
      <marker id="tA-${u}" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
        <path d="M0,1 L10,5 L0,9 z" class="t-arrow"/></marker>
      <pattern id="tBal-${u}" width="60" height="60" patternUnits="userSpaceOnUse">
        <rect width="60" height="60" class="t-bal-bg"/><circle cx="14" cy="16" r="9" class="t-bal-st"/>
        <circle cx="44" cy="40" r="11" class="t-bal-st"/><circle cx="40" cy="8" r="5" class="t-bal-st"/><circle cx="12" cy="48" r="6" class="t-bal-st"/></pattern>
      <pattern id="tUb-${u}" width="40" height="40" patternUnits="userSpaceOnUse">
        <rect width="40" height="40" class="t-ub-bg"/><circle cx="10" cy="10" r="3" class="t-ub-st"/><circle cx="30" cy="28" r="3.5" class="t-ub-st"/></pattern>
      <pattern id="tJord-${u}" width="80" height="80" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="80" height="80" class="t-jord-bg"/><line x1="0" y1="0" x2="0" y2="80" class="t-jord-st"/></pattern>
    </defs>
    <polygon points="${ground}" fill="url(#tJord-${u})"/>
    <polygon points="${ub}" fill="url(#tUb-${u})" class="t-layer"/>
    <polygon points="${ballast}" fill="url(#tBal-${u})" class="t-layer"/>
    <g transform="rotate(${deg.toFixed(3)} ${px} ${py})">
      ${sleeper}${lowered}
      ${fastening(-rc)}${fastening(rc)}
      ${rail(-rc, -1)}${rail(rc, 1)}
      ${dims ? dimH(-sv.sporvidde / 2, sv.sporvidde / 2, railTop - 120, `Sporvidde ${fmt(sv.sporvidde)}`) : ''}
      ${dims ? dimH(-half, half, Hs + 150, `${sv.id}: L = ${fmt(sv.laengde)}`) : ''}
      ${dims ? dimH(-half - sk, -half, -90, `Bsk ${TVAERPROFIL.skulder}`) : ''}
    </g>
    ${o.h > 0 ? `<g class="t-ghost">
      <rect x="${rc - 36}" y="${railTop}" width="72" height="${SKINNE_60E2.hoejde}"/>
    </g>` : ''}

    ${dims ? `
      <line x1="${px - 300}" y1="${py}" x2="${outerTop.x + 380}" y2="${py}" class="t-ref"/>
      <circle cx="${px}" cy="${py}" r="34" class="t-pivot"/>
      <text x="${px - 60}" y="${py - 60}" text-anchor="end" font-size="${T * 0.85}" class="t-txt">Inderskinne fast</text>
      ${o.h > 0 ? `<text x="${outerTop.x + 60}" y="${py + 150}" font-size="${T * 0.8}" class="t-txt t-muted">uden overhøjde</text>` : ''}
      ${o.h > 0 ? dimV(outerTop.x + 300, py, outerTop.y, `h = ${fmt(o.h)}`) : `<text x="${outerTop.x + 330}" y="${py + 25}" font-size="${T}" class="t-txt">h = 0</text>`}
      ${dimV(rot(-rc, Hs).x, rot(-rc, Hs).y, yF, `Bt ${TVAERPROFIL.ballast}`, 'end')}
      ${dimV(-150, yF, planY(0), `Ut ${TVAERPROFIL.underballast}`, 'start')}
      <text x="${(shL.x + toeL.x) / 2 - 60}" y="${(shL.y + toeL.y) / 2}" text-anchor="end" font-size="${T}" class="t-txt">1:${fmt(an, 1)}</text>
      <text x="${(toeR.x + outR) / 2 - 200}" y="${planY((toeR.x + outR) / 2) - 40}" text-anchor="end" font-size="${T}" class="t-txt">Planum ${fmt(ph * 1000)} ‰</text>
      <text x="${xmin + 60}" y="${ytop + 110}" font-size="${T * 1.15}" class="t-txt t-b">Kurvens inderside</text>
      <text x="${xmax - 60}" y="${ytop + 110}" font-size="${T * 1.15}" text-anchor="end" class="t-txt t-b">Kurvens yderside</text>
      <text x="${xmin + 60}" y="${ytop + 110 + T * 1.4}" font-size="${T * 0.85}" class="t-txt t-muted">${sv.id} · 60E2 1:40 · ${sv.befaestelse.replace('Pandrol ', '')} · mm</text>
      ${(o.V ?? 0) > 160 ? `<text x="${xmax - 60}" y="${ytop + 110 + T * 1.4}" font-size="${T * 0.85}" text-anchor="end" class="t-txt t-warn">Ballast −40 mm mellem skinner (V > 160)</text>` : ''}
    ` : ''}
  </svg>`;
}

/** Detalje: skinneunderstøtning med 60E2, mellemlæg og Fastclip. */
export function railDetail(svelle: SvelleType): string {
  const u = uid();
  const sv = SVELLER[svelle];
  const T = 11;
  return `
  <svg viewBox="-200 -250 400 330" class="viz viz-detail" role="img" aria-label="Detalje af skinneunderstøtning">
    <defs><marker id="dA-${u}" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
      <path d="M0,1 L10,5 L0,9 z" class="t-arrow"/></marker></defs>
    <rect x="-200" y="0" width="400" height="${Math.min(80, sv.hoejde)}" class="t-sleeper"/>
    ${fastening(0)}
    ${rail(0, -1)}
    <g class="t-dim">
      <line x1="-140" y1="${-PAD}" x2="-140" y2="${-PAD - 172}" marker-start="url(#dA-${u})" marker-end="url(#dA-${u})"/>
      <text x="-146" y="${-PAD - 86}" text-anchor="end" font-size="${T}">172</text>
      <line x1="-75" y1="40" x2="75" y2="40" marker-start="url(#dA-${u})" marker-end="url(#dA-${u})"/>
      <text x="0" y="56" text-anchor="middle" font-size="${T}">Fod 150</text>
      <line x1="-36" y1="-222" x2="36" y2="-222" marker-start="url(#dA-${u})" marker-end="url(#dA-${u})"/>
      <text x="0" y="-230" text-anchor="middle" font-size="${T}">Hoved 72</text>
    </g>
    <line x1="0" y1="-205" x2="${(195 / 40).toFixed(2)}" y2="10" class="t-axis"/>
    <text x="40" y="-190" font-size="${T}" class="t-txt">Skinnehældning 1:40</text>
    <text x="118" y="-60" font-size="${T}" class="t-txt">${sv.befaestelse.replace('Pandrol ', '')}</text>
    <line x1="116" y1="-64" x2="96" y2="-62" class="t-lead"/>
    <text x="118" y="-14" font-size="${T}" class="t-txt">Mellemlæg</text>
    <line x1="116" y1="-18" x2="70" y2="-5" class="t-lead"/>
    <text x="-190" y="30" font-size="${T}" class="t-txt">${sv.id}</text>
    <text x="-190" y="74" font-size="${T * 0.9}" class="t-txt t-muted">Skematisk · 60E2 (DS/EN 13674-1) · mm</text>
  </svg>`;
}

/** Plan: sveller med svelleafstand 625 mm. */
export function planView(svelle: SvelleType): string {
  const u = uid();
  const sv = SVELLER[svelle];
  const n = 5, a = SVELLEAFSTAND, w = sv.bredde;
  const x0 = -((n - 1) * a) / 2;
  const rc = sv.sporvidde / 2 + 36;
  const T = 150;
  const sl = Array.from({ length: n }, (_, k) => `<rect x="${x0 + k * a - w / 2}" y="${-sv.laengde / 2}" width="${w}" height="${sv.laengde}" rx="10" class="t-sleeper"/>`).join('');
  const W = (n - 1) * a + w + 400;
  return `
  <svg viewBox="${-W / 2} ${-sv.laengde / 2 - 340} ${W} ${sv.laengde + 720}" class="viz viz-plan" role="img" aria-label="Plan med svelleafstand">
    <defs><marker id="pA-${u}" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
      <path d="M0,1 L10,5 L0,9 z" class="t-arrow"/></marker></defs>
    ${sl}
    <rect x="${-W / 2}" y="${-rc - 36}" width="${W}" height="72" class="t-rail"/>
    <rect x="${-W / 2}" y="${rc - 36}" width="${W}" height="72" class="t-rail"/>
    <text x="${x0 + 4 * a + w / 2 + 40}" y="${T / 3}" font-size="${T * 0.8}" class="t-txt t-muted">${sv.id}</text>
    <g class="t-dim">
      <line x1="${x0}" y1="${-sv.laengde / 2 - 120}" x2="${x0 + a}" y2="${-sv.laengde / 2 - 120}" marker-start="url(#pA-${u})" marker-end="url(#pA-${u})"/>
       <text x="${x0 + a / 2}" y="${-sv.laengde / 2 - 170}" text-anchor="middle" font-size="${T}">${a} c/c</text>
      <line x1="${x0 + 2 * a - w / 2}" y1="${sv.laengde / 2 + 120}" x2="${x0 + 2 * a + w / 2}" y2="${sv.laengde / 2 + 120}" marker-start="url(#pA-${u})" marker-end="url(#pA-${u})"/>
       <text x="${x0 + 2 * a}" y="${sv.laengde / 2 + 300}" text-anchor="middle" font-size="${T}">${w}</text>
    </g>
  </svg>`;
}
