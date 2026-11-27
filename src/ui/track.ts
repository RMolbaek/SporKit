/**
 * Tegninger af sporets tværsnit, skinneunderstøtning og plan.
 * Alle mål i mm i tegningens koordinatsystem. Tegningerne er skematiske,
 * men hovedmål svarer til data i core/overbygning.ts.
 */
import {
  SVELLER, SKINNE_60E2, TVAERPROFIL, SVELLEAFSTAND, SKINNER, SVELLETYPER,
  type SvelleType, type SvelleSpec, type SkinneProfil, type BefType,
} from '../core/overbygning';

/** Hvad der skal tegnes: svelle, skinne, befæstelse og skinnehældning. */
export interface TegnSpec {
  navn: string;
  svelle: SvelleSpec;
  skinne: SkinneProfil;
  befType: BefType;
  /** 1:n, 0 = lodret */
  haeldning: number;
  befTekst: string;
}

/** Standard S99/S16-spec ud fra svelletype. */
export function standardSpec(id: SvelleType): TegnSpec {
  const sv = SVELLER[id];
  return { navn: sv.overbygning, svelle: SVELLETYPER[id], skinne: SKINNER['60E2'], befType: id === 'S16' ? 'fastclip-fe' : 'fastclip-fc', haeldning: 40, befTekst: sv.befaestelse };
}
const tilSpec = (x: SvelleType | TegnSpec): TegnSpec => (typeof x === 'string' ? standardSpec(x) : x);

/** Skinneprofil skaleret fra 60E2-stien: fod, krop og hoved skaleres hver for sig. */
function railPathFor(sk: SkinneProfil): string {
  if (sk.hoejde === 172 && sk.fod === 150 && sk.hoved === 72) return RAIL_PATH;
  const sy = sk.hoejde / 172, sf = sk.fod / 150, sh = sk.hoved / 72;
  return RAIL_PATH.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_, xs: string, ys: string) => {
    const x = Number(xs), y = Number(ys);
    const sx = y >= -40 ? (Math.abs(x) > 9 ? sf : 1) : y <= -121 ? (Math.abs(x) > 9 ? sh : 1) : 1;
    return `${(x * sx).toFixed(2)},${(y * sy).toFixed(2)}`;
  });
}

const BEF_KORT: Record<BefType, string> = {
  spiger: 'Skinnespiger', skrue: 'Svelleskrue', hageplade: 'Hageplade', 'ribbe-klemplade': 'Ribbeplade (Cr)', 'ribbe-fjeder': 'Ribbeplade (Cf)',
  'fjedrende-klemplade': 'Fjedr. klemplade', nylonklemplade: 'Nylonklemplade', vossloh: 'Vossloh Fk4', 'fastclip-fc': 'Fastclip FC', 'fastclip-fe': 'Fastclip FE',
};

/** Tykkelse af underlagsplade [mm] (skematisk) */
const pladeTyk = (b: BefType) => (b === 'spiger' || b === 'hageplade' || b === 'ribbe-klemplade' || b === 'ribbe-fjeder' ? 16 : 0);
import { fmt } from './dom';

let uidN = 0;
const esc = (t: string) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
const uid = () => `t${(uidN++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const RAIL_PATH =
  'M -75,0 L 75,0 L 75,-11 L 60,-15 L 9,-34 Q 8.25,-36 8.25,-40 L 8.25,-112 Q 8.25,-118 14,-121 ' +
  'L 34,-128 Q 36,-129 36,-132 L 36,-160 Q 34,-172 18,-172 L -18,-172 Q -34,-172 -36,-160 L -36,-132 ' +
  'Q -36,-129 -34,-128 L -14,-121 Q -8.25,-118 -8.25,-112 L -8.25,-40 Q -8.25,-36 -9,-34 L -60,-15 L -75,-11 Z';

const PAD = 10; // mellemlæg (skematisk)
const INCL = (Math.atan(1 / SKINNE_60E2.haeldning) * 180) / Math.PI;

export function rail(xc: number, side: -1 | 1, spec?: TegnSpec): string {
  // side -1 = venstre skinne (hælder mod højre/sporets midte), +1 = højre
  const inc = spec ? (spec.haeldning > 0 ? (Math.atan(1 / spec.haeldning) * 180) / Math.PI : 0) : INCL;
  const ang = side === -1 ? inc : -inc;
  const pad = PAD + (spec ? pladeTyk(spec.befType) : 0);
  return `<g transform="translate(${xc},${-pad}) rotate(${ang.toFixed(3)})">
    <path d="${spec ? railPathFor(spec.skinne) : RAIL_PATH}" class="t-rail"/></g>`;
}

export function fastening(xc: number, spec?: TegnSpec): string {
  if (spec && spec.befType !== 'fastclip-fc' && spec.befType !== 'fastclip-fe') return befaestelseGenerel(xc, spec);
  const one = (s: 1 | -1) => {
    const x0 = xc + s * 80;
    const x1 = xc + s * 112;
    return `<rect x="${Math.min(x0, x1)}" y="-48" width="32" height="48" rx="4" class="t-shoulder"/>
      <path d="M ${xc + s * 108},-38 C ${xc + s * 128},-80 ${xc + s * 66},-84 ${xc + s * 66},-26" class="t-clip"/>`;
  };
  return `<rect x="${xc - 82}" y="${-PAD}" width="164" height="${PAD}" class="t-pad"/>${one(1)}${one(-1)}`;
}

/** Skematisk befæstelse for ældre typer (spiger, skruer, plader, klemplader, Vossloh). */
function befaestelseGenerel(xc: number, spec: TegnSpec): string {
  const b = spec.befType, F = spec.skinne.fod / 2, pt = pladeTyk(b);
  const plade = pt ? `<rect x="${xc - F - 70}" y="${-pt}" width="${2 * F + 140}" height="${pt}" class="t-shoulder"/>` : '';
  const ribber = b === 'ribbe-klemplade' || b === 'ribbe-fjeder' ? [-1, 1].map((s) => `<rect x="${xc + s * (F + 6) - (s > 0 ? 0 : 14)}" y="${-pt - 26}" width="14" height="26" class="t-shoulder"/>`).join('') : '';
  const pad = b === 'skrue' ? '' : `<rect x="${xc - F - 6}" y="${-PAD - pt}" width="${2 * F + 12}" height="${PAD}" class="t-pad"/>`;
  const y0 = -pt - PAD;
  const side = (s: 1 | -1) => {
    const xf = xc + s * F;
    switch (b) {
      case 'spiger': return `<path d="M ${xf + s * 6},${y0 - 14} h ${s * 22} M ${xf + s * 12},${y0 - 14} v 70" class="t-clip"/>`;
      case 'skrue': return `<path d="M ${xf + s * 4},${y0 - 10} h ${s * 30} M ${xf + s * 19},${y0 - 10} v 90" class="t-clip"/>`;
      case 'hageplade': return s < 0 ? `<path d="M ${xf - 2},${-pt} l 0,-22 l 26,8" class="t-clip"/>` : `<rect x="${xf}" y="${y0 - 20}" width="34" height="12" class="t-shoulder"/><path d="M ${xf + 20},${y0 - 30} v 100" class="t-clip"/>`;
      case 'ribbe-klemplade': return `<rect x="${xf - (s > 0 ? 18 : 30)}" y="${y0 - 30}" width="48" height="12" class="t-shoulder"/><path d="M ${xf + s * 6},${y0 - 40} v 50" class="t-clip"/>`;
      case 'ribbe-fjeder': return `<path d="M ${xf - s * 8},${y0 - 12} C ${xf + s * 10},${y0 - 44} ${xf + s * 36},${y0 - 44} ${xf + s * 40},${y0 - 6}" class="t-clip"/><path d="M ${xf + s * 26},${y0 - 44} v 54" class="t-clip"/>`;
      case 'fjedrende-klemplade': return `<path d="M ${xf - s * 10},${y0 - 10} C ${xf + s * 10},${y0 - 34} ${xf + s * 40},${y0 - 30} ${xf + s * 56},${y0 + 8}" class="t-clip"/><path d="M ${xf + s * 32},${y0 - 34} v 90" class="t-clip"/>`;
      case 'nylonklemplade': return `<rect x="${xf - (s > 0 ? 12 : 48)}" y="${y0 - 22}" width="60" height="18" rx="4" class="t-shoulder"/><path d="M ${xf + s * 26},${y0 - 34} v 90" class="t-clip"/>`;
      case 'vossloh': return `<path d="M ${xf + s * 46},${y0 + 4} l ${-s * 34},-4 l 0,-10 M ${xf - s * 8},${y0 - 8} C ${xf + s * 14},${y0 - 40} ${xf + s * 30},${y0 - 40} ${xf + s * 34},${y0 - 10} C ${xf + s * 40},${y0 - 40} ${xf + s * 56},${y0 - 40} ${xf + s * 62},${y0 - 8}" class="t-clip"/><path d="M ${xf + s * 34},${y0 - 40} v 80" class="t-clip"/>`;
      default: return '';
    }
  };
  return `${plade}${ribber}${pad}${side(-1)}${side(1)}`;
}

/** Svelle i tværsnit efter materiale (lokale koordinater: overside y = 0). */
function svelleForm(sv: SvelleSpec, rc: number): string {
  const half = sv.laengde / 2, Hs = sv.hoejde;
  if (sv.materiale === 'trae') return `<rect x="${-half}" y="0" width="${sv.laengde}" height="${Hs}" class="t-sleeper t-trae"/>`;
  if (sv.materiale === 'toblok') {
    const bw = 700; // bloklængde (skematisk)
    return `<rect x="${-rc - bw / 2}" y="0" width="${bw}" height="${Hs}" rx="10" class="t-sleeper"/><rect x="${rc - bw / 2}" y="0" width="${bw}" height="${Hs}" rx="10" class="t-sleeper"/>
      <rect x="${-rc + bw / 2}" y="${Hs * 0.45}" width="${2 * rc - bw}" height="${Math.max(18, Hs * 0.12)}" class="t-staal"/>`;
  }
  if (sv.materiale === 'staal') return `<path d="M ${-half},${Hs} L ${-half},0 L ${half},0 L ${half},${Hs} L ${half - 12},${Hs} L ${half - 12},12 L ${-half + 12},12 L ${-half + 12},${Hs} Z" class="t-staal"/>`;
  return `<path d="M ${-half},16 L ${-half + 16},0 L ${half - 16},0 L ${half},16 L ${half},${Hs} L ${-half},${Hs} Z" class="t-sleeper"/>`;
}

export interface TrackOpts {
  svelle: SvelleType;
  /** Anden overbygning end S99/S16 (overstyrer svelle) */
  spec?: TegnSpec;
  h: number;
  V?: number;
  dims?: boolean;
}

/** Tværprofil af ballasteret spor med overhøjde h (ægte skala). */
export function trackCrossSection(o: TrackOpts): string {
  const u = uid();
  const sp = o.spec ?? standardSpec(o.svelle);
  const sv = sp.svelle;
  const Hs = sv.hoejde;
  const half = sv.laengde / 2;
  const rc = sv.sporvidde / 2 + sp.skinne.hoved / 2; // skinnemidte
  const railTop = -(PAD + pladeTyk(sp.befType) + sp.skinne.hoejde);
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

  const sleeper = svelleForm(sv, rc);
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
      ${fastening(-rc, sp)}${fastening(rc, sp)}
      ${rail(-rc, -1, sp)}${rail(rc, 1, sp)}
      ${dims ? dimH(-sv.sporvidde / 2, sv.sporvidde / 2, railTop - 120, `Sporvidde ${fmt(sv.sporvidde)}`) : ''}
      ${dims ? dimH(-half, half, Hs + 150, `${sv.id === 'BOEG' || sv.id === 'AZOBE' ? 'Træsvelle' : sv.id === 'TOBLOK' ? 'To-blok' : sv.id === 'STAAL' ? 'Stålsvelle' : sv.id}: L = ${fmt(sv.laengde)}${sv.maal === 'skematisk' ? ' (skematisk)' : ''}`) : ''}
      ${dims ? dimH(-half - sk, -half, -90, `Bsk ${TVAERPROFIL.skulder}`) : ''}
    </g>
    ${o.h > 0 ? `<g class="t-ghost">
      <rect x="${rc - sp.skinne.hoved / 2}" y="${railTop}" width="${sp.skinne.hoved}" height="${sp.skinne.hoejde}"/>
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
      <text x="${xmin + 60}" y="${ytop + 110 + T * 1.4}" font-size="${T * 0.85}" class="t-txt t-muted">${esc(sp.navn)} · ${sp.skinne.id} ${sp.haeldning ? `1:${sp.haeldning}` : 'lodret'} · mm</text>
      ${(o.V ?? 0) > 160 ? `<text x="${xmax - 60}" y="${ytop + 110 + T * 1.4}" font-size="${T * 0.85}" text-anchor="end" class="t-txt t-warn">Ballast −40 mm mellem skinner (V > 160)</text>` : ''}
    ` : ''}
  </svg>`;
}

/** Detalje: skinneunderstøtning med 60E2, mellemlæg og Fastclip. */
export function railDetail(svelle: SvelleType | TegnSpec): string {
  const u = uid();
  const sp = tilSpec(svelle);
  const sv = sp.svelle, sk = sp.skinne;
  const pt = pladeTyk(sp.befType);
  const T = 11;
  return `
  <svg viewBox="-200 -250 400 330" class="viz viz-detail" role="img" aria-label="Detalje af skinneunderstøtning">
    <defs><marker id="dA-${u}" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
      <path d="M0,1 L10,5 L0,9 z" class="t-arrow"/></marker></defs>
    <rect x="-200" y="0" width="400" height="${Math.min(80, sv.hoejde)}" class="${sv.materiale === 'staal' ? 't-staal' : sv.materiale === 'trae' ? 't-sleeper t-trae' : 't-sleeper'}"/>
    ${fastening(0, sp)}
    ${rail(0, -1, sp)}
    <g class="t-dim">
      <line x1="-140" y1="${-PAD - pt}" x2="-140" y2="${-PAD - pt - sk.hoejde}" marker-start="url(#dA-${u})" marker-end="url(#dA-${u})"/>
      <text x="-146" y="${-PAD - pt - sk.hoejde / 2}" text-anchor="end" font-size="${T}">${sk.hoejde}</text>
      <line x1="${-sk.fod / 2}" y1="40" x2="${sk.fod / 2}" y2="40" marker-start="url(#dA-${u})" marker-end="url(#dA-${u})"/>
      <text x="0" y="56" text-anchor="middle" font-size="${T}">Fod ${sk.fod}</text>
      <line x1="${-sk.hoved / 2}" y1="-222" x2="${sk.hoved / 2}" y2="-222" marker-start="url(#dA-${u})" marker-end="url(#dA-${u})"/>
      <text x="0" y="-230" text-anchor="middle" font-size="${T}">Hoved ${sk.hoved}</text>
    </g>
    <line x1="0" y1="-205" x2="${sp.haeldning ? (195 / sp.haeldning).toFixed(2) : 0}" y2="10" class="t-axis"/>
    <text x="40" y="-190" font-size="${T}" class="t-txt">Skinnehældning ${sp.haeldning ? `1:${sp.haeldning}` : 'lodret'}</text>
    <text x="106" y="-60" font-size="${T}" class="t-txt">${BEF_KORT[sp.befType]}</text>
    <line x1="104" y1="-64" x2="90" y2="-62" class="t-lead"/>
    ${sp.befType === 'skrue' ? '' : `<text x="106" y="-14" font-size="${T}" class="t-txt">Mellemlæg</text>
    <line x1="104" y1="-18" x2="70" y2="${-5 - pt}" class="t-lead"/>`}
    <text x="-190" y="30" font-size="${T}" class="t-txt">${esc(sv.navn.split(' (')[0])}</text>
    <text x="-190" y="74" font-size="${T * 0.9}" class="t-txt t-muted">Skematisk · ${sk.id} (hovedmål Sporteknik fig. 92) · mm</text>
  </svg>`;
}

/** Plan: sveller med svelleafstand 625 mm. */
export function planView(svelle: SvelleType | TegnSpec): string {
  const u = uid();
  const sv = tilSpec(svelle).svelle;
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
    <text x="${x0 + 4 * a + w / 2 + 40}" y="${T / 3}" font-size="${T * 0.8}" class="t-txt t-muted">${sv.materiale === 'trae' ? 'træ' : sv.materiale === 'toblok' ? 'to-blok' : sv.id}</text>
    <g class="t-dim">
      <line x1="${x0}" y1="${-sv.laengde / 2 - 120}" x2="${x0 + a}" y2="${-sv.laengde / 2 - 120}" marker-start="url(#pA-${u})" marker-end="url(#pA-${u})"/>
       <text x="${x0 + a / 2}" y="${-sv.laengde / 2 - 170}" text-anchor="middle" font-size="${T}">${a} c/c</text>
      <line x1="${x0 + 2 * a - w / 2}" y1="${sv.laengde / 2 + 120}" x2="${x0 + 2 * a + w / 2}" y2="${sv.laengde / 2 + 120}" marker-start="url(#pA-${u})" marker-end="url(#pA-${u})"/>
       <text x="${x0 + 2 * a}" y="${sv.laengde / 2 + 300}" text-anchor="middle" font-size="${T}">${w}</text>
    </g>
  </svg>`;
}
