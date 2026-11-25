import type { Limit, Status } from '../core/rules';

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

export function card(title: string, body: HTMLElement | string, extraClass = ''): HTMLElement {
  const c = h('section', { class: `card ${extraClass}` }, h('h2', {}, title));
  const b = h('div', { class: 'card-body' });
  if (typeof body === 'string') b.innerHTML = body;
  else b.append(body);
  c.append(b);
  return c;
}

export interface Module {
  id: string;
  titel: string;
  kort: string;
  ikon: string;
  beskrivelse: string;
  render(root: HTMLElement): void;
}
