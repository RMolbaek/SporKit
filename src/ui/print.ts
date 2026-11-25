import type { Report } from '../core/report';
import { REFERENCES } from '../core/references';
import { BANEDANMARK as rs, loadSettings } from '../core/rules';
import { STATUS_TEKST } from './dom';

const esc = (s: string) => s; // indholdet genereres af appen selv (ingen brugertekst)

/** Giver SVG-id'er i rapportens kopi af figuren nye navne, så de ikke kolliderer med skærmversionen. */
function uniqueIds(svg: string): string {
  const ids = [...svg.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
  let out = svg;
  for (const id of ids) out = out.split(`"${id}"`).join(`"${id}-r"`).split(`#${id})`).join(`#${id}-r)`);
  return out;
}

export function buildReportHtml(r: Report, projekt: { navn: string; sted: string; udfoert: string }): string {
  const now = new Date();
  const dato = now.toLocaleDateString('da-DK', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const tid = now.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
  const s = loadSettings();
  const refIds = new Set(r.refs.map((x) => x.split(' ')[0]));
  const refs = REFERENCES.filter((x) => refIds.has(x.id));
  const status = r.checks.some((c) => c.status === 'overskredet')
    ? 'overskredet' : r.checks.some((c) => c.status === 'undtagelse') ? 'undtagelse' : 'ok';

  return `
  <article class="rpt">
    <header class="rpt-head">
      <div class="rpt-brand"><img src="./icon.svg" alt="" width="34" height="34"/><div><strong>SporKit</strong><span>Beregningsrapport</span></div></div>
      <div class="rpt-meta">
        <div><b>Modul:</b> ${esc(r.modul)}</div>
        <div><b>Dato:</b> ${dato} kl. ${tid}</div>
        <div><b>Regelgrundlag:</b> ${rs.navn}</div>
        <div><b>Skinne:</b> ${s.skinne}${s.saerligeTogsaet ? ' · særlige togsæt' : ''}</div>
      </div>
    </header>

    <table class="rpt-proj">
      <tr><th>Projekt / strækning</th><td>${esc(projekt.navn) || '&nbsp;'}</td><th>Km / lokation</th><td>${esc(projekt.sted) || '&nbsp;'}</td></tr>
    </table>

    <h2>1. Inputdata</h2>
    <table class="rpt-tbl">
      <thead><tr><th>Parameter</th><th>Symbol</th><th class="r">Værdi</th><th>Enhed</th></tr></thead>
      <tbody>${r.inputs.map((i) => `<tr><td>${i.label}</td><td class="sym">${i.symbol}</td><td class="r">${i.value}</td><td>${i.unit}</td></tr>`).join('')}</tbody>
    </table>

    <h2>2. Beregningsgang</h2>
    <table class="rpt-tbl rpt-steps">
      <thead><tr><th>#</th><th>Størrelse</th><th>Formel</th><th>Indsat</th><th class="r">Resultat</th></tr></thead>
      <tbody>${r.steps.map((st, k) => `<tr><td>${k + 1}</td><td>${st.label}</td><td class="f">${st.formel}</td><td class="f">${st.indsat}</td><td class="r"><b>${st.resultat}</b></td></tr>`).join('')}</tbody>
    </table>

    ${r.checks.length ? `
    <h2>3. Kontrol mod grænseværdier</h2>
    <table class="rpt-tbl">
      <thead><tr><th>Kontrol</th><th class="r">Værdi</th><th>Grænse (normal / undt.)</th><th>Kilde</th><th>Status</th></tr></thead>
      <tbody>${r.checks.map((c) => `<tr><td>${c.label}</td><td class="r">${c.value}</td><td>${c.graense}</td><td class="src">${c.kilde ?? ''}</td><td><span class="st st-${c.status}">${STATUS_TEKST[c.status]}</span></td></tr>`).join('')}</tbody>
    </table>
    <p class="rpt-total">Samlet vurdering: <span class="st st-${status}">${STATUS_TEKST[status]}</span></p>` : ''}

    ${r.figur ? `<div class="rpt-fig">${uniqueIds(r.figur)}</div>` : ''}

    ${r.noter?.length ? `<h2>Bemærkninger</h2><ul class="rpt-notes">${r.noter.map((n) => `<li>${n}</li>`).join('')}</ul>` : ''}

    <h2>Referencer</h2>
    <ol class="rpt-refs">${refs.map((x) => `<li><b>${x.kort}</b> – ${x.titel}. ${x.udgiver}.${x.gennemgaaet ? '' : ' <i>(ikke gennemgået af SporKit)</i>'}</li>`).join('')}</ol>

    <div class="rpt-disc">
      Grænseværdier markeret som «antaget» er ikke fundet i dansk kilde og skal kontrolleres. «Sekundær» betyder gengivet
      fra Banedanmarks lærebog <i>Sporteknik</i> (2016), der citerer Sporregler. SporKit er et hjælpeværktøj og
      erstatter ikke projektering efter gældende banenormer.
    </div>

    <table class="rpt-sign">
      <tr><th>Udført af</th><th>Kontrolleret af</th><th>Godkendt af</th></tr>
      <tr><td>${esc(projekt.udfoert) || '&nbsp;'}<br/><small>Dato: ${dato}</small></td><td><br/><small>Dato:</small></td><td><br/><small>Dato:</small></td></tr>
    </table>
  </article>`;
}
