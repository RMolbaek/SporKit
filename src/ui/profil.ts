/** Tegning af fritrumsprofil (BN1-166-1) med overhøjde, tillæg og evt. genstand. Mål i mm. */
import { PROFILER, profilMedTillaeg, fuldtProfil, type ProfilNavn, type ProfilTillaeg } from '../core/fritrum';
import { rail, fastening } from './track';
import { fmt } from './dom';

let n = 0;

export function profilSvg(o: {
  navn: ProfilNavn; t: ProfilTillaeg; hCant: number; yder: 1 | -1;
  genstand?: { x: number; z: number; fri: boolean } | null;
}): string {
  const u = `pf${n++}`;
  const rc = 753.5;
  const th = Math.asin(Math.min(0.2, Math.max(0, o.hCant) / 1500)) * o.yder;
  const deg = (-th * 180) / Math.PI; // SVG: y nedad
  const px = -o.yder * rc;
  const grund = fuldtProfil(PROFILER[o.navn]).map(([x, hh]) => `${x},${-hh}`).join(' ');
  const med = fuldtProfil(profilMedTillaeg(o.navn, o.t)).map(([x, hh]) => `${x},${-hh}`).join(' ');
  const T = 150;
  const xmin = -3100, xmax = 3100, ytop = -5600, ybot = 700;
  const halv = PROFILER[o.navn];
  // Målangivelser: kun punkter med tilstrækkelig lodret afstand, så teksterne ikke overlapper
  const maal: [number, number][] = [];
  for (const [x, hh] of halv) {
    if (x <= 0) continue;
    if (maal.length && Math.abs(hh - maal[maal.length - 1][1]) < 220) continue;
    maal.push([x, hh]);
  }
  return `
  <svg viewBox="${xmin} ${ytop} ${xmax - xmin} ${ybot - ytop}" class="viz viz-profil" role="img" aria-label="Fritrumsprofil ${o.navn}">
    <defs><pattern id="g-${u}" width="80" height="80" patternUnits="userSpaceOnUse"><rect width="80" height="80" class="t-bal-bg"/><circle cx="20" cy="22" r="12" class="t-bal-st"/><circle cx="58" cy="54" r="14" class="t-bal-st"/></pattern></defs>
    <rect x="${xmin}" y="200" width="${xmax - xmin}" height="${ybot - 200}" fill="url(#g-${u})"/>
    <g transform="rotate(${deg.toFixed(3)} ${px} 0)">
      <polygon points="${med}" class="pf-tillaeg"/>
      <polygon points="${grund}" class="pf-profil"/>
      <line x1="0" y1="200" x2="0" y2="-5300" class="tp-cl"/>
      <g transform="translate(0 182)">
        <rect x="-1250" y="0" width="2500" height="206" class="t-sleeper"/>
        ${fastening(-rc)}${fastening(rc)}${rail(-rc, -1)}${rail(rc, 1)}
      </g>
      ${maal.map(([x, hh]) => `<text x="${x + 60}" y="${-hh + T / 3}" font-size="${T * 0.75}" class="t-txt t-muted">${fmt(x)} / ${fmt(hh)}</text>`).join('')}
    </g>
    <line x1="${xmin}" y1="0" x2="${xmax}" y2="0" class="t-ref"/>
    <text x="${xmin + 80}" y="-40" font-size="${T}" class="t-txt t-muted">SO (inderskinne)</text>
    ${o.genstand ? `<circle cx="${o.genstand.x}" cy="${-o.genstand.z}" r="70" class="${o.genstand.fri ? 'pf-ok' : 'pf-fejl'}"/>
      <text x="${o.genstand.x + 110}" y="${-o.genstand.z + 50}" font-size="${T}" class="t-txt t-b">${o.genstand.fri ? 'fri' : 'i profilet'}</text>` : ''}
    <text x="${xmin + 80}" y="${ytop + 1.3 * T}" font-size="${T * 1.1}" class="t-txt t-b">Fritrumsprofil ${o.navn}${o.hCant ? ` · h = ${fmt(o.hCant)} mm` : ''}</text>
    <text x="${xmin + 80}" y="${ytop + 2.6 * T}" font-size="${T * 0.8}" class="t-txt t-muted">Fuld: profil · stiplet: inkl. e = ${fmt(o.t.e)} mm, Δh = ${fmt(o.t.dhRv)} mm, tillæg ${o.t.vandret}/${o.t.lodret} mm · mål: halv bredde / højde over SO</text>
  </svg>`;
}
