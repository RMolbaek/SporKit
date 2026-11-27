/**
 * Lille, afhængighedsfri XML-parser til LandXML (virker både i browseren og i Node/tests).
 * Navnerumspræfikser fjernes (lx:Alignment → Alignment). Store, irrelevante afsnit kan springes over.
 */

export interface XNode {
  /** Lokalt navn uden navnerumspræfiks */
  name: string;
  attrs: Record<string, string>;
  children: XNode[];
  /** Nodens egen tekst (ikke børnenes) */
  text: string;
}

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function afkod(s: string): string {
  if (s.indexOf('&') < 0) return s;
  return s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENT[e] ?? m;
  });
}

const lokal = (n: string) => { const i = n.indexOf(':'); return i >= 0 ? n.slice(i + 1) : n; };

/**
 * Parser et XML-dokument. Returnerer en rod-node (name = '#document') med dokumentelementet som barn.
 * spring: elementnavne (lokale) hvis indhold ikke skal læses (fx 'Surfaces' i LandXML med store TIN-flader).
 */
export function parseXml(src: string, spring: string[] = []): XNode {
  const rod: XNode = { name: '#document', attrs: {}, children: [], text: '' };
  const stak: XNode[] = [rod];
  const skip = new Set(spring);
  let i = src.charCodeAt(0) === 0xfeff ? 1 : 0;
  const n = src.length;
  while (i < n) {
    const lt = src.indexOf('<', i);
    const top = stak[stak.length - 1];
    if (lt < 0) { top.text += afkod(src.slice(i)); break; }
    if (lt > i) top.text += afkod(src.slice(i, lt));
    if (src.startsWith('<!--', lt)) { const e = src.indexOf('-->', lt + 4); i = e < 0 ? n : e + 3; continue; }
    if (src.startsWith('<![CDATA[', lt)) { const e = src.indexOf(']]>', lt + 9); top.text += src.slice(lt + 9, e < 0 ? n : e); i = e < 0 ? n : e + 3; continue; }
    if (src.startsWith('<?', lt)) { const e = src.indexOf('?>', lt + 2); i = e < 0 ? n : e + 2; continue; }
    if (src.startsWith('<!', lt)) {
      // DOCTYPE (evt. med intern delmængde [...])
      let d = 0, j = lt + 2;
      for (; j < n; j++) { const c = src[j]; if (c === '[') d++; else if (c === ']') d--; else if (c === '>' && d <= 0) break; }
      i = j + 1; continue;
    }
    if (src[lt + 1] === '/') {
      const e = src.indexOf('>', lt + 2);
      if (e < 0) throw new Error('Ufuldstændigt sluttag.');
      const navn = lokal(src.slice(lt + 2, e).trim());
      // luk til og med det matchende element (tolerant over for fejl)
      for (let k = stak.length - 1; k > 0; k--) if (stak[k].name === navn) { stak.length = k; break; }
      i = e + 1; continue;
    }
    // starttag – find slutningen udenfor anførselstegn
    let j = lt + 1, q = '';
    for (; j < n; j++) { const c = src[j]; if (q) { if (c === q) q = ''; } else if (c === '"' || c === "'") q = c; else if (c === '>') break; }
    if (j >= n) throw new Error('Ufuldstændigt starttag.');
    let body = src.slice(lt + 1, j);
    const selvlukket = body.endsWith('/');
    if (selvlukket) body = body.slice(0, -1);
    const m = /^\s*([^\s/>]+)/.exec(body);
    if (!m) throw new Error('Ugyldigt tag.');
    const node: XNode = { name: lokal(m[1]), attrs: {}, children: [], text: '' };
    const re = /([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
    let a: RegExpExecArray | null;
    const rest = body.slice(m[0].length);
    while ((a = re.exec(rest))) {
      const k = a[1];
      if (k === 'xmlns' || k.startsWith('xmlns:')) continue;
      const v = afkod(a[3] ?? a[4] ?? '');
      const lk = lokal(k);
      node.attrs[lk in node.attrs ? k : lk] = v;
    }
    top.children.push(node);
    i = j + 1;
    if (selvlukket) continue;
    if (skip.has(node.name)) {
      // spring indholdet over: find det matchende sluttag (samme navn, evt. med præfiks)
      const re2 = new RegExp(`</(?:[\\w.-]+:)?${node.name}\\s*>`, 'g');
      re2.lastIndex = i;
      const e = re2.exec(src);
      i = e ? e.index + e[0].length : n;
      continue;
    }
    stak.push(node);
  }
  if (!rod.children.length) throw new Error('Filen indeholder intet XML-element.');
  return rod;
}

/** Alle efterkommere med et givet lokalt navn (dokumentrækkefølge). */
export function alle(node: XNode, navn: string): XNode[] {
  const out: XNode[] = [];
  const gaa = (x: XNode) => { for (const c of x.children) { if (c.name === navn) out.push(c); gaa(c); } };
  gaa(node);
  return out;
}

/** Første efterkommer med et givet lokalt navn. */
export function foerste(node: XNode, navn: string): XNode | undefined {
  for (const c of node.children) {
    if (c.name === navn) return c;
    const f = foerste(c, navn);
    if (f) return f;
  }
  return undefined;
}

/** Direkte børn med et givet navn. */
export const boern = (node: XNode, navn: string): XNode[] => node.children.filter((c) => c.name === navn);

/** Samlet tekst for noden og dens efterkommere (som DOM textContent). */
export function tekst(node: XNode): string {
  let s = node.text;
  for (const c of node.children) s += tekst(c);
  return s;
}

/** Tal i et attribut (NaN hvis det mangler). */
export const tal = (node: XNode, attr: string): number => {
  const v = node.attrs[attr];
  return v === undefined ? NaN : parseFloat(v);
};
