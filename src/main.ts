import './styles.css';
import type { Module } from './ui/dom';
import { overhoejde } from './modules/overhoejde';
import { overgangskurve } from './modules/overgangskurve';
import { radius } from './modules/radius';
import { hastighed } from './modules/hastighed';
import { kurveelementer } from './modules/kurveelementer';
import { lodret } from './modules/lodret';
import { sporkontrol } from './modules/sporkontrol';
import { kurveudvidelse } from './modules/kurveudvidelse';
import { perron } from './modules/perron';
import { sikkerhedszone } from './modules/sikkerhedszone';
import { tracetavler } from './modules/tracetavler';
import { fritrum } from './modules/fritrum';
import { overbygning } from './modules/overbygning';
import { tvaerprofil } from './modules/tvaerprofil';
import { overgangszone } from './modules/overgangszone';
import { regler } from './modules/regler';
import { tsi } from './modules/tsi';
import { referencer } from './modules/referencer';
import { getReport, setReport } from './core/report';
import { buildReportHtml } from './ui/print';

const MODULES: Module[] = [
  overhoejde, overgangskurve, radius, hastighed, kurveelementer,
  lodret, sporkontrol, perron, sikkerhedszone, tracetavler, fritrum, kurveudvidelse, overbygning, tvaerprofil, overgangszone, regler, tsi, referencer,
];

const nav = document.querySelector<HTMLElement>('#nav')!;
const main = document.querySelector<HTMLElement>('#main')!;
const titel = document.querySelector<HTMLElement>('#mod-titel')!;
const besk = document.querySelector<HTMLElement>('#mod-besk')!;
const printRoot = document.querySelector<HTMLElement>('#print-root')!;

const grupper = [...new Set(MODULES.map((m) => m.gruppe))];
nav.innerHTML = grupper.map((g) => `
  <div class="nav-group"><div class="nav-title">${g}</div>
  ${MODULES.filter((m) => m.gruppe === g).map((m) =>
    `<a href="#${m.id}" data-id="${m.id}"><span class="ico" aria-hidden="true">${m.ikon}</span><span class="nav-l">${m.titel}</span><span class="nav-s">${m.kort}</span></a>`).join('')}
  </div>`).join('');

let currentId = '';
function show() {
  const id = location.hash.slice(1);
  const m = MODULES.find((x) => x.id === id) ?? MODULES[0];
  currentId = m.id;
  nav.querySelectorAll('a').forEach((a) => a.classList.toggle('active', a.dataset.id === m.id));
  nav.querySelector('a.active')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  titel.textContent = m.titel;
  besk.textContent = m.beskrivelse;
  document.title = `${m.titel} · SporKit`;
  main.innerHTML = '';
  setReport(null);
  m.render(main);
}
window.addEventListener('hashchange', show);
show();

/* ---------------------------- PDF-eksport ---------------------------- */
const dlg = document.querySelector<HTMLDialogElement>('#pdf-dlg')!;
const fProj = document.querySelector<HTMLInputElement>('#p-navn')!;
const fSted = document.querySelector<HTMLInputElement>('#p-sted')!;
const fUdf = document.querySelector<HTMLInputElement>('#p-udf')!;
try {
  const p = JSON.parse(localStorage.getItem('sporkit:projekt') ?? '{}');
  fProj.value = p.navn ?? ''; fSted.value = p.sted ?? ''; fUdf.value = p.udfoert ?? '';
} catch { /* */ }

document.querySelector('#pdf')!.addEventListener('click', () => {
  if (typeof dlg.showModal === 'function') dlg.showModal(); else doPrint();
});
document.querySelector('#pdf-cancel')!.addEventListener('click', () => dlg.close());
document.querySelector('#pdf-form')!.addEventListener('submit', (e) => {
  e.preventDefault();
  dlg.close();
  doPrint();
});

function doPrint() {
  const r = getReport();
  if (!r) return;
  const projekt = { navn: fProj.value.trim(), sted: fSted.value.trim(), udfoert: fUdf.value.trim() };
  try { localStorage.setItem('sporkit:projekt', JSON.stringify(projekt)); } catch { /* */ }
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
  printRoot.innerHTML = buildReportHtml(r, { navn: esc(projekt.navn), sted: esc(projekt.sted), udfoert: esc(projekt.udfoert) });
  const d = new Date().toISOString().slice(0, 10);
  const old = document.title;
  document.title = `SporKit_${currentId}_${d}`; // bliver filnavnet ved "Gem som PDF"
  const done = () => { document.title = old; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => window.print(), 50);
}

/* -------------------------------- Tema -------------------------------- */
const themeBtn = document.querySelector<HTMLButtonElement>('#theme')!;
const applyTheme = (t: string | null) => {
  if (t) document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
};
try { applyTheme(localStorage.getItem('sporkit:theme')); } catch { /* */ }
themeBtn.addEventListener('click', () => {
  const dark = document.documentElement.dataset.theme
    ? document.documentElement.dataset.theme === 'dark'
    : matchMedia('(prefers-color-scheme: dark)').matches;
  const next = dark ? 'light' : 'dark';
  applyTheme(next);
  try { localStorage.setItem('sporkit:theme', next); } catch { /* */ }
});

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
