import './styles.css';
import type { Module } from './ui/dom';
import { overhoejde } from './modules/overhoejde';
import { overgangskurve } from './modules/overgangskurve';
import { radius } from './modules/radius';
import { hastighed } from './modules/hastighed';
import { regler } from './modules/regler';

const MODULES: Module[] = [overhoejde, overgangskurve, radius, hastighed, regler];

const nav = document.querySelector<HTMLElement>('#nav')!;
const main = document.querySelector<HTMLElement>('#main')!;
const titel = document.querySelector<HTMLElement>('#mod-titel')!;
const besk = document.querySelector<HTMLElement>('#mod-besk')!;

nav.innerHTML = MODULES.map(
  (m) => `<a href="#${m.id}" data-id="${m.id}"><span class="ico" aria-hidden="true">${m.ikon}</span><span>${m.kort}</span></a>`,
).join('');

function show() {
  const id = location.hash.slice(1);
  const m = MODULES.find((x) => x.id === id) ?? MODULES[0];
  nav.querySelectorAll('a').forEach((a) => a.classList.toggle('active', a.dataset.id === m.id));
  titel.textContent = m.titel;
  besk.textContent = m.beskrivelse;
  document.title = `${m.titel} · SporKit`;
  main.innerHTML = '';
  m.render(main);
}
window.addEventListener('hashchange', show);
show();

/* Tema: følger systemet, kan overstyres */
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

/* Offline-understøttelse */
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
