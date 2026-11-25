import type { Limit, Status, Kildestatus } from '../core/rules';

export const fmt = (x: number, d = 0): string =>
  Number.isFinite(x)
    ? x.toLocaleString('da-DK', { minimumFractionDigits: d, maximumFractionDigits: d })
    : '–';

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  for (const c of children) el.append(c);
  return el;
}

export const STATUS_TEKST: Record<Status, string> = {
  ok: 'OK',
  undtagelse: 'Undtagelse',
  overskredet: 'Overskredet',
};

export function chip(s: Status): string {
  return `<span class="chip chip-${s}">${STATUS_TEKST[s]}</span>`;
}

/* ------------------------- persisteret state ------------------------- */

export function loadState<T extends object>(key: string, defaults: T): T {
  try {
    const raw = localStorage.getItem('sporkit:' + key);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch {
    /* privat vindue o.l. */
  }
  return { ...defaults };
}

export function saveState(key: string, state: object): void {
  try {
    localStorage.setItem('sporkit:' + key, JSON.stringify(state));
  } catch {
    /* ignorer */
  }
}

/* ----------------------------- input-felter ----------------------------- */

export interface FieldDef<K extends string> {
  key: K;
  label: string;
  symbol: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  hint?: string;
}

/**
 * Bygger en formular med tal-felt + skyder for hvert parameter.
 * onChange kaldes ved enhver ændring med den opdaterede state.
 */
export function form<K extends string>(
  defs: FieldDef<K>[],
  state: Record<K, number>,
  onChange: () => void,
): HTMLElement {
  const wrap = h('div', { class: 'fields' });
  for (const d of defs) {
    const id = `f-${d.key}-${Math.random().toString(36).slice(2, 7)}`;
    const num = h('input', {
      type: 'number', id, inputmode: 'decimal',
      min: String(d.min), max: String(d.max), step: String(d.step),
      value: String(state[d.key]),
    });
    const range = h('input', {
      type: 'range', 'aria-label': d.label, tabindex: '-1',
      min: String(d.min), max: String(d.max), step: String(d.step),
      value: String(state[d.key]),
    });
    const set = (v: number, src: HTMLInputElement) => {
      if (!Number.isFinite(v)) return;
      state[d.key] = v;
      if (src !== num) num.value = String(v);
      if (src !== range) range.value = String(Math.min(d.max, Math.max(d.min, v)));
      onChange();
    };
    num.addEventListener('input', () => set(parseFloat(num.value.replace(',', '.')), num));
    range.addEventListener('input', () => set(parseFloat(range.value), range));

    const field = h('div', { class: 'field' },
      h('label', { for: id },
        h('span', { class: 'sym' }, d.symbol),
        h('span', { class: 'lbl' }, d.label),
      ),
      h('div', { class: 'inp' }, num, h('span', { class: 'unit' }, d.unit)),
      range,
    );
    field.querySelector('.sym')!.innerHTML = d.symbol; // symboler er statiske og kan indeholde <sub>
    if (d.hint) field.append(h('small', { class: 'hint' }, d.hint));
    wrap.append(field);
  }
  return wrap;
}

/* --------------------------- resultatvisning --------------------------- */

export interface ResultItem {
  symbol: string;
  label: string;
  value: string;
  unit: string;
  status?: Status;
  sub?: string;
  big?: boolean;
}

export function results(items: ResultItem[]): string {
  return `<div class="results">${items
    .map(
      (r) => `
    <div class="res ${r.big ? 'res-big' : ''} ${r.status ? 'res-' + r.status : ''}">
      <div class="res-head"><span class="sym">${r.symbol}</span><span class="lbl">${r.label}</span>${
        r.status ? chip(r.status) : ''
      }</div>
      <div class="res-val">${r.value}<span class="unit">${r.unit}</span></div>
      ${r.sub ? `<div class="res-sub">${r.sub}</div>` : ''}
    </div>`,
    )
    .join('')}</div>`;
}

export function limitText(l: Limit): string {
  return l.normal === l.undtagelse
    ? `grænse ${fmt(l.normal, l.normal % 1 ? 1 : 0)} ${l.unit}`
    : `normal ≤ ${fmt(l.normal)} · undt. ≤ ${fmt(l.undtagelse)} ${l.unit}`;
}

export const KILDESTATUS_TEKST: Record<Kildestatus, string> = {
  verificeret: 'Verificeret',
  sekundaer: 'Sekundær kilde',
  antaget: 'Antaget',
};

/** Kort kildetekst til rapporter og tabeller. */
export function kildeTekst(l: Limit): string {
  return `${l.kilde.join(', ')} · ${KILDESTATUS_TEKST[l.status].toLowerCase()}`;
}

export function kildeChip(l: Limit): string {
  const cls = l.status === 'verificeret' ? 'ok' : l.status === 'sekundaer' ? 'info' : 'undtagelse';
  return `<span class="chip chip-${cls}" title="${l.kilde.join(', ')}">${KILDESTATUS_TEKST[l.status]}</span>`;
}

/** Grænsetekst til rapport: "100 / 130 mm" */
export function graense(l: Limit, prefix = '≤'): string {
  return l.normal === l.undtagelse ? `${prefix} ${fmt(l.normal, l.normal % 1 ? 1 : 0)} ${l.unit}` : `${prefix} ${fmt(l.normal, l.normal % 1 ? 1 : 0)} / ${fmt(l.undtagelse, l.undtagelse % 1 ? 1 : 0)} ${l.unit}`;
}

/** Valgfelt (select) */
export function select<K extends string>(
  label: string, key: K, options: [string, string][], state: Record<K, string>, onChange: () => void,
): HTMLElement {
  const id = `s-${key}-${Math.random().toString(36).slice(2, 7)}`;
  const sel = h('select', { id });
  for (const [v, t] of options) {
    const o = h('option', { value: v }, t);
    if (state[key] === v) o.selected = true;
    sel.append(o);
  }
  sel.addEventListener('change', () => { state[key] = sel.value; onChange(); });
  return h('div', { class: 'field' }, h('label', { for: id }, h('span', { class: 'lbl' }, label)), h('div', { class: 'inp inp-sel' }, sel));
}

export function card(title: string, body: HTMLElement | string, extraClass = ''): HTMLElement {
  const c = h('section', { class: `card ${extraClass}` }, h('h2', {}, title));
  const b = h('div', { class: 'card-body' });
  if (typeof body === 'string') b.innerHTML = body;
  else b.append(body);
  c.append(b);
  return c;
}

export interface Module {
  gruppe: 'Linjeføring' | 'Længdeprofil' | 'I sporet' | 'Overbygning' | 'Grundlag';
  id: string;
  titel: string;
  kort: string;
  ikon: string;
  beskrivelse: string;
  render(root: HTMLElement): void;
}

/* ------------------------------ TSI-sektion ------------------------------ */

export interface TsiRow { label: string; value: string; graense: string; status: Status; kilde: string }

/** Kompakt tabel med TSI INF-kontroller. */
export function tsiBlock(rows: TsiRow[], note = ''): string {
  if (!rows.length) return '';
  const total: Status = rows.some((r) => r.status === 'overskredet') ? 'overskredet' : 'ok';
  return `<div class="tsi">
    <div class="tsi-head"><span class="tsi-flag">EU</span><strong>Kontrol mod TSI INF</strong>${chip(total)}</div>
    <table class="tbl tsi-tbl"><tbody>${rows.map((r) => `
      <tr><td><div>${r.label}</div><small>${r.kilde.replace('TSI INF (EU) 1299/2014 ', '')}</small></td>
      <td>${r.value}</td><td>${r.graense}</td><td>${chip(r.status)}</td></tr>`).join('')}</tbody></table>
    ${note ? `<p class="tip">${note}</p>` : ''}
  </div>`;
}
