/** Hastighedsprofil med krumnings- og overhøjdediagram. x = stationering [m]. */
import type { ElementAnalyse } from '../core/projekt';
import { fmt } from './dom';

export const kmTekst = (m: number, d = 0) => {
  if (!Number.isFinite(m)) return '–';
  const km = Math.floor(m / 1000 + 1e-9);
  const rest = m - km * 1000;
  return `${km}+${rest.toFixed(d).padStart(d ? 4 + d : 3, '0').replace('.', ',')}`;
};

let n = 0;

export function profilSvg(a: ElementAnalyse[], V: number, sammenlign: ElementAnalyse[] | null, valgt: number | null): string {
  if (!a.length) return '';
  const u = `hp${n++}`;
  const W = 1000, padL = 56, padR = 14;
  const k0 = a[0].e.km0, k1 = a[a.length - 1].e.km1;
  const x = (m: number) => padL + ((m - k0) / Math.max(1, k1 - k0)) * (W - padL - padR);
  // bånd: hastighed, krumning, overhøjde
  const bV = { y0: 24, y1: 214 }, bK = { y0: 246, y1: 330 }, bH = { y0: 356, y1: 430 }, H = 470;
  const Vtop = Math.max(V, ...a.map((e) => (e.e.V ?? 0)), ...(sammenlign ?? []).map((e) => e.VtN)) * 1.1 || 100;
  const yV = (v: number) => bV.y1 - (Math.min(v, Vtop) / Vtop) * (bV.y1 - bV.y0);
  const kMax = Math.max(1e-6, ...a.map((e) => Math.max(Math.abs(e.e.R0 ? 1000 / e.e.R0 : 0), Math.abs(e.e.R1 ? 1000 / e.e.R1 : 0))));
  const kMid = (bK.y0 + bK.y1) / 2;
  const yK = (R: number) => kMid - ((R ? 1000 / R : 0) / kMax) * ((bK.y1 - bK.y0) / 2);
  const hMax = Math.max(1, ...a.map((e) => Math.max(e.e.h0, e.e.h1)));
  const yH = (h: number) => bH.y1 - (h / hMax) * (bH.y1 - bH.y0);

  const trin = (vals: (e: ElementAnalyse) => number, list = a) => list.map((e) => {
    const v = vals(e);
    return Number.isFinite(v) ? `${x(e.e.km0).toFixed(1)},${yV(v).toFixed(1)} ${x(e.e.km1).toFixed(1)},${yV(v).toFixed(1)}` : '';
  }).filter(Boolean).join(' ');
  const baggrund = a.map((e, i) => e.e.type === 'ret' ? '' :
    `<rect x="${x(e.e.km0)}" y="${bV.y0}" width="${Math.max(0.5, x(e.e.km1) - x(e.e.km0))}" height="${bH.y1 - bV.y0}" class="hp-${e.e.type}${valgt === i ? ' hp-valgt' : ''}"/>`).join('');
  const valgtRamme = valgt !== null && a[valgt] ? `<rect x="${x(a[valgt].e.km0)}" y="${bV.y0 - 6}" width="${Math.max(2, x(a[valgt].e.km1) - x(a[valgt].e.km0))}" height="${bH.y1 - bV.y0 + 12}" class="hp-ramme"/>` : '';
  const status = a.map((e) => e.status !== 'ok' ? `<rect x="${x(e.e.km0)}" y="${bV.y1 + 3}" width="${Math.max(1.5, x(e.e.km1) - x(e.e.km0))}" height="6" class="hp-st-${e.status}"/>` : '').join('');
  const krum = a.map((e) => `${x(e.e.km0).toFixed(1)},${yK(e.e.R0).toFixed(1)} ${x(e.e.km1).toFixed(1)},${yK(e.e.R1).toFixed(1)}`).join(' ');
  const oh = a.map((e) => `${x(e.e.km0).toFixed(1)},${yH(e.e.h0).toFixed(1)} ${x(e.e.km1).toFixed(1)},${yH(e.e.h1).toFixed(1)}`).join(' ');
  const skiltet = a.some((e) => e.e.V) ? trin((e) => e.e.V ?? NaN) : '';
  // km-akse
  const span = k1 - k0;
  const step = [50, 100, 200, 250, 500, 1000, 2000, 5000, 10000].find((s) => span / s <= 10) ?? 20000;
  const ticks: string[] = [];
  for (let m = Math.ceil(k0 / step) * step; m <= k1 + 1e-6; m += step) {
    ticks.push(`<line x1="${x(m)}" y1="${bV.y0}" x2="${x(m)}" y2="${bH.y1}" class="hp-grid"/><text x="${x(m)}" y="${bH.y1 + 18}" text-anchor="middle" class="hp-t">${kmTekst(m)}</text>`);
  }
  const vTicks: string[] = [];
  for (let v = 0; v <= Vtop; v += Vtop > 150 ? 40 : 20) vTicks.push(`<line x1="${padL}" y1="${yV(v)}" x2="${W - padR}" y2="${yV(v)}" class="hp-grid"/><text x="${padL - 6}" y="${yV(v) + 4}" text-anchor="end" class="hp-t">${v}</text>`);
  // V-etiketter pr. kurvegruppe (ved første element i gruppen)
  const lbl = a.map((e, i) => (e.e.type !== 'ret' && (i === 0 || a[i - 1].VtN !== e.VtN || a[i - 1].e.type === 'ret') && e.VtN < V)
    ? `<text x="${(x(e.e.km0) + x(e.e.km1)) / 2}" y="${yV(e.VtN) + 16}" text-anchor="middle" class="hp-vl">${e.VtN}</text>` : '').join('');

  return `<svg viewBox="0 0 ${W} ${H}" class="viz viz-hp" role="img" aria-label="Hastighedsprofil">
    ${baggrund}${valgtRamme}
    ${vTicks.join('')}${ticks.join('')}
    <text x="${padL}" y="${bV.y0 - 8}" class="hp-t hp-b">Hastighed [km/t]</text>
    <line x1="${padL}" y1="${yV(V)}" x2="${W - padR}" y2="${yV(V)}" class="hp-vstr"/>
    ${sammenlign?.length ? `<polyline points="${trin((e) => e.VtN, sammenlign)}" class="hp-vsam"/>` : ''}
    ${skiltet ? `<polyline points="${skiltet}" class="hp-vskilt"/>` : ''}
    <polyline points="${trin((e) => e.VtU)}" class="hp-vu"/>
    <polyline points="${trin((e) => e.VtN)}" class="hp-vn"/>
    ${lbl}${status}
    <text x="${padL}" y="${bK.y0 - 8}" class="hp-t hp-b">Krumning 1000/R (højre +)</text>
    <line x1="${padL}" y1="${kMid}" x2="${W - padR}" y2="${kMid}" class="hp-akse"/>
    <polyline points="${krum}" class="hp-krum"/>
    <text x="${padL}" y="${bH.y0 - 8}" class="hp-t hp-b">Overhøjde h [mm] · maks. ${fmt(hMax)}</text>
    <line x1="${padL}" y1="${bH.y1}" x2="${W - padR}" y2="${bH.y1}" class="hp-akse"/>
    <polyline points="${oh}" class="hp-oh"/>
    <g class="hp-leg" transform="translate(${W - padR - 470} ${bV.y0 - 14})">
      <line x1="0" y1="-4" x2="22" y2="-4" class="hp-vn"/><text x="27" y="0" class="hp-t">Tilladt V (normal)</text>
      <line x1="140" y1="-4" x2="162" y2="-4" class="hp-vu"/><text x="167" y="0" class="hp-t">Undtagelse</text>
      ${skiltet ? '<line x1="245" y1="-4" x2="267" y2="-4" class="hp-vskilt"/><text x="272" y="0" class="hp-t">V i listen</text>' : ''}
      ${sammenlign?.length ? '<line x1="345" y1="-4" x2="367" y2="-4" class="hp-vsam"/><text x="372" y="0" class="hp-t">Andet datasæt</text>' : ''}
    </g>
    <defs><clipPath id="c-${u}"><rect x="0" y="0" width="${W}" height="${H}"/></clipPath></defs>
  </svg>`;
}
