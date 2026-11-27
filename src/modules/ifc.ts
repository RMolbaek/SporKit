import { aktivtId, DATA_TEKST, hentProjekter, parseKm, type DataType, type Element, type Projekt } from '../core/projekt';
import { samletSpor } from '../core/tilslutning';
import { parseLandXML, type GeoData } from '../core/landxml';
import { EKSEMPEL_LANDXML } from '../core/eksempel-landxml';
import { byggLinjefoering, cantVed, dVed, hPunkt, stationVed, type Linjefoering } from '../core/linjefoering';
import { BN16_STANDARD, byggModel, DEL_TEKST, dhRvVed, eVed, foreslaaOrigo, kmTxt, type Bn16Valg, type Del, type Model, type ModelValg } from '../core/ifcmodel';
import { CRS, FARVE, skrivIfc, SKEMA_NOTE, SKEMA_TEKST, type IfcSkema } from '../core/ifc';
import { zip } from '../core/zip';
import { FALD_TEKST, SVELLE_DATA, type Fald, type Projekt as BnProjekt, type Svelletype } from '../core/bn16';
import type { ProfilNavn } from '../core/fritrum';
import { setReport, type ReportCheck } from '../core/report';
import { lav3D, type Visning } from '../ui/ifcvisning';
import { download, laesTekstfil } from '../ui/fil';
import { card, fmt, h, loadState, saveState, type Module } from '../ui/dom';

type Kilde = DataType | 'samlet' | 'fil';

interface St {
  kilde: Kilde;
  fra: string; til: string;
  trin: number; maxObjekt: number;
  profil: ProfilNavn;
  tillaeg: 'ballast' | 'fast' | 'ingen';
  bredde: boolean; hoejde: boolean; overhoejde: boolean; afrundE: boolean; afrundRv: boolean;
  skinner: boolean; ballast: boolean; sveller: boolean; daemning: boolean;
  epsg: string;
  origo: 'auto' | 'global' | 'manuel';
  E0: number; N0: number;
  zip: boolean;
  fritrumKlasse: 'virtual' | 'proxy';
  /** Station for forhåndsvisningen [m]; −1 = midt på strækningen */
  fokus: number;
}

const DEF: St = {
  kilde: 'fil', fra: '', til: '', trin: 5, maxObjekt: 250, profil: 'D', tillaeg: 'ballast',
  bredde: true, hoejde: true, overhoejde: true, afrundE: true, afrundRv: true,
  skinner: true, ballast: true, sveller: false, daemning: false,
  epsg: '25832', origo: 'auto', E0: 0, N0: 0, zip: false, fritrumKlasse: 'virtual', fokus: -1,
};

interface FilData { filnavn: string; valg: number; linjer: { navn: string; elementer: Element[]; geo: GeoData; advarsler: string[] }[] }

interface Grundlag { navn: string; filnavn: string; elementer: Element[]; geo?: GeoData; advarsler: string[] }

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const slug = (s: string) => s.replace(/æ/g, 'ae').replace(/ø/g, 'oe').replace(/å/g, 'aa').replace(/Æ/g, 'Ae').replace(/Ø/g, 'Oe').replace(/Å/g, 'Aa')
  .normalize('NFKD').replace(/[^\w-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || 'model';
const mb = (n: number) => (n > 1e6 ? `${fmt(n / 1e6, 1)} MB` : `${fmt(n / 1e3, 0)} kB`);

/** BN1-6-parametre fra Tværprofil-modulet (hvis brugt), ellers standard. */
function bn16FraTvaerprofil(): { v: Bn16Valg; fraModul: boolean } {
  let fraModul = false;
  try { fraModul = !!localStorage.getItem('sporkit:tvaerprofil'); } catch { /* */ }
  const st = loadState<Record<string, number>>('tvaerprofil', {});
  const opt = loadState<Record<string, string>>('tvaerprofil-opt', {});
  const n = (k: keyof Bn16Valg, d: number) => (Number.isFinite(st[k as string]) ? st[k as string] : d);
  const fald = (opt.antal === '1' && opt.fald ? opt.fald : 'hoejre') as Fald;
  return {
    fraModul,
    v: {
      Bsk: n('Bsk', BN16_STANDARD.Bsk), a: n('a', BN16_STANDARD.a), Bt: n('Bt', BN16_STANDARD.Bt), Ut: n('Ut', BN16_STANDARD.Ut), Pb: n('Pb', BN16_STANDARD.Pb),
      Xp: n('Xp', BN16_STANDARD.Xp), Xrp: n('Xrp', BN16_STANDARD.Xrp), as: n('as', BN16_STANDARD.as), daemning: n('daemning', BN16_STANDARD.daemning),
      V: n('V', BN16_STANDARD.V), L: n('L', BN16_STANDARD.L),
      fald, projekt: (opt.projekt as BnProjekt) || BN16_STANDARD.projekt, sidespor: opt.sidespor === 'ja',
      svelle: (opt.svelle as Svelletype) || BN16_STANDARD.svelle, ls60: opt.ls60 ? opt.ls60 === 'ja' : true,
    },
  };
}

export const ifc: Module = {
  id: 'ifc',
  gruppe: 'Projekt',
  titel: 'IFC-model',
  kort: 'IFC',
  ikon: '⬢',
  beskrivelse: 'Byg en 3D-model af sporet ud fra LandXML-linjeføringen eller projektets data: fritrumsprofil med breddeforøgelse e og højdeændring ΔhRv (BN1-166-1), overhøjde, skinner, ballast og underballast (BN1-6-7) – og eksportér som IFC 4.3, IFC4 eller IFC2x3.',
  render(root) {
    const st = loadState<St>('ifc', DEF);
    let fil = loadState<FilData | { linjer?: undefined }>('ifc-fil', {}) as FilData | { linjer?: undefined; valg?: undefined; filnavn?: undefined };
    const projekter = hentProjekter();
    const p: Projekt | undefined = projekter.find((x) => x.id === aktivtId()) ?? projekter[0];
    const meta0 = (() => { try { return JSON.parse(localStorage.getItem('sporkit:projekt') ?? '{}') as { navn?: string; sted?: string; udfoert?: string }; } catch { return {}; } })();

    const left = h('div', {});
    const out = h('div', { class: 'out' });
    let visning: Visning | null = null;
    let besked = '';
    let lfCache: { noegle: string; lf: Linjefoering } | null = null;
    let model: Model | null = null;
    let lf: Linjefoering | null = null;
    let eksportInfo = '';

    /* ---------------------------- grundlag ---------------------------- */
    const kilder = (): { id: Kilde; tekst: string; g: Grundlag | null }[] => {
      const k: { id: Kilde; tekst: string; g: Grundlag | null }[] = [];
      for (const t of ['projekteret', 'eksisterende'] as DataType[]) {
        const d = p?.data[t];
        if (d?.elementer.length) k.push({ id: t, tekst: `${p!.navn}: ${DATA_TEKST[t]}${d.geo?.koordinater ? '' : ' (uden koordinater)'}`, g: { navn: `${p!.navn} – ${t === 'projekteret' ? 'projekt' : 'eksisterende'}`, filnavn: d.filnavn, elementer: d.elementer, geo: d.geo, advarsler: [] } });
      }
      const eks = p?.data.eksisterende, proj = p?.data.projekteret;
      if (eks && proj && proj.elementer.length) {
        const pr = proj.elementer;
        const tl = { start: pr[0].km0, slutProj: pr[pr.length - 1].km1, slutEks: pr[pr.length - 1].km1, ...(p!.tilslutning ?? {}) };
        k.push({ id: 'samlet', tekst: `${p!.navn}: samlet spor (eksisterende + projekt, lokale koordinater)`, g: { navn: `${p!.navn} – samlet`, filnavn: `${eks.filnavn} + ${proj.filnavn}`, elementer: samletSpor(eks.elementer, proj.elementer, tl), advarsler: [] } });
      }
      if (fil.linjer?.length) {
        const l = fil.linjer[Math.min(fil.valg ?? 0, fil.linjer.length - 1)];
        k.push({ id: 'fil', tekst: `LandXML: ${fil.filnavn} – ${l.navn}`, g: { navn: l.navn, filnavn: fil.filnavn!, elementer: l.elementer, geo: l.geo, advarsler: l.advarsler } });
      }
      return k;
    };
    const aktivKilde = () => {
      const k = kilder();
      return k.find((x) => x.id === st.kilde) ?? k.find((x) => x.g?.geo?.koordinater) ?? k[0];
    };

    const laesXml = (navn: string, tekst: string) => {
      besked = '';
      try {
        const a = parseLandXML(tekst);
        if (!a.length) { besked = 'Filen indeholder ingen <Alignment>.'; return; }
        fil = { filnavn: navn, valg: 0, linjer: a.map((x) => ({ navn: x.navn, elementer: x.elementer, geo: x.geo, advarsler: x.advarsler })) };
        saveState('ifc-fil', fil);
        st.kilde = 'fil'; st.fra = ''; st.til = ''; st.fokus = -1;
        lfCache = null;
      } catch (e) { besked = `Filen kunne ikke læses: ${(e as Error).message}`; }
    };

    /* ---------------------------- venstre panel ---------------------------- */
    const chk = (label: string, key: keyof St, hint?: string) => {
      const i = h('input', { type: 'checkbox' });
      i.checked = !!st[key];
      i.addEventListener('change', () => { (st as unknown as Record<string, boolean>)[key] = i.checked; opdater(); });
      const l = h('label', { class: 'pj-cb ifc-cb' }, i, h('span', {}, label));
      if (hint) l.title = hint;
      return l;
    };
    const valg = <K extends keyof St>(label: string, key: K, opts: [string, string][], efter?: () => void) => {
      const s = h('select', {});
      for (const [v, t] of opts) { const o = h('option', { value: v }, t); if (String(st[key]) === v) o.selected = true; s.append(o); }
      s.addEventListener('change', () => { (st as unknown as Record<string, string>)[key as string] = s.value; efter?.(); opdater(); });
      return h('div', { class: 'field' }, h('label', {}, h('span', { class: 'lbl' }, label)), h('div', { class: 'inp inp-sel' }, s));
    };
    const tal = (label: string, key: 'trin' | 'maxObjekt' | 'E0' | 'N0', unit: string, step: string) => {
      const i = h('input', { type: 'number', inputmode: 'decimal', step, value: String(st[key]) });
      i.addEventListener('change', () => { const v = parseFloat(i.value.replace(',', '.')); if (Number.isFinite(v)) { st[key] = v; opdater(); } });
      return h('label', { class: 'ed-f' }, h('span', {}, label), h('div', { class: 'ed-inp' }, i, h('small', {}, unit)));
    };
    const tekstFelt = (label: string, key: 'fra' | 'til', ph: string) => {
      const i = h('input', { type: 'text', value: st[key], placeholder: ph });
      i.addEventListener('change', () => { st[key] = i.value.trim(); st.fokus = -1; opdater(); });
      return h('label', { class: 'ed-f' }, h('span', {}, label), h('div', { class: 'ed-inp' }, i));
    };

    const renderLeft = () => {
      left.innerHTML = '';
      const k = kilder();
      const ak = aktivKilde();
      // Grundlag
      left.append(h('div', { class: 'ed-sec' }, 'Grundlag'));
      if (k.length) {
        const s = h('select', {});
        for (const x of k) { const o = h('option', { value: x.id }, x.tekst); if (ak && x.id === ak.id) o.selected = true; s.append(o); }
        s.addEventListener('change', () => { st.kilde = s.value as Kilde; st.fra = ''; st.til = ''; st.fokus = -1; lfCache = null; renderLeft(); opdater(); });
        left.append(h('div', { class: 'field' }, h('label', {}, h('span', { class: 'lbl' }, 'Linjeføring')), h('div', { class: 'inp inp-sel' }, s)));
        if (ak?.id === 'fil' && fil.linjer && fil.linjer.length > 1) {
          const s2 = h('select', {});
          fil.linjer.forEach((l, i) => { const o = h('option', { value: String(i) }, `${l.navn} (${l.elementer.length} elementer)`); if (i === fil.valg) o.selected = true; s2.append(o); });
          s2.addEventListener('change', () => { (fil as FilData).valg = Number(s2.value); saveState('ifc-fil', fil); lfCache = null; st.fra = ''; st.til = ''; st.fokus = -1; opdater(); });
          left.append(h('div', { class: 'field' }, h('label', {}, h('span', { class: 'lbl' }, 'Alignment i filen')), h('div', { class: 'inp inp-sel' }, s2)));
        }
      }
      const fi = h('input', { type: 'file', accept: '.xml,.landxml,text/xml,application/xml', hidden: '' });
      fi.addEventListener('change', async () => { const f = fi.files?.[0]; if (f) { laesXml(f.name, await laesTekstfil(f)); renderLeft(); opdater(); } fi.value = ''; });
      const knap = (t: string, fn: () => void, cls = 'btn-ghost btn-sm') => { const b = h('button', { type: 'button', class: cls }, t); b.addEventListener('click', fn); return b; };
      left.append(h('div', { class: 'pj-knapper' },
        knap('Indlæs LandXML …', () => fi.click()),
        knap('Eksempel (fiktiv, UTM32)', () => { laesXml('Eksempel.xml', EKSEMPEL_LANDXML); renderLeft(); opdater(); }),
        fi));
      left.append(h('p', { class: 'tip pj-tip0' }, 'LandXML med Line/Curve/Spiral (koordinater), længdeprofil (PVI, ParaCurve, CircCurve) og Cant. Spordatalister og geometrirapporter fra Projekt-modulet kan også bruges – uden koordinater bygges sporet lokalt. Alt bliver i browseren.'));
      if (besked) left.append(h('div', { class: 'notice' }, besked));

      // Strækning
      left.append(h('div', { class: 'ed-sec' }, 'Strækning og opløsning'));
      left.append(h('div', { class: 'ed-fields' }, tekstFelt('Fra km', 'fra', 'start'), tekstFelt('Til km', 'til', 'slut')));
      left.append(h('div', { class: 'ed-fields' }, tal('Største snitafstand', 'trin', 'm', '0.5'), tal('Objektlængde maks.', 'maxObjekt', 'm', '50')));

      // Fritrum
      left.append(h('div', { class: 'ed-sec' }, 'Fritrum (BN1-166-1)'));
      left.append(valg('Fritrumsprofil', 'profil', [['D', 'D – fjern- og regionaltog'], ['D-GC', 'D-GC – trafikkode P1/F1'], ['SD', 'SD – S-bane']]));
      left.append(valg('Vedligeholdelsestillæg (afsnit 10.4)', 'tillaeg', [['ballast', 'Ballastspor: 50 mm vandret / 100 mm lodret'], ['fast', 'Fast spor: 25 / 50 mm'], ['ingen', 'Intet tillæg']]));
      left.append(h('div', { class: 'ifc-cbs' },
        chk('Breddeforøgelse e i kurver (afsnit 12)', 'bredde'),
        chk('Højdeændring ΔhRv i afrundingskurver (afsnit 13)', 'hoejde'),
        chk('Overhøjde – drejning om indvendig skinne', 'overhoejde'),
        chk('Nedrunding: e = 0 ved R ≥ 300 m', 'afrundE', 'BN1-166-1 afsnit 12: tilladt at runde ned til 0'),
        chk('Nedrunding: ΔhRv = 0 ved Rv ≥ 10.000 m', 'afrundRv', 'BN1-166-1 afsnit 13: tilladt at runde ned til 0'),
      ));

      // Spor
      const b = bn16FraTvaerprofil();
      left.append(h('div', { class: 'ed-sec' }, 'Spor og underbygning (BN1-6-7)'));
      left.append(h('div', { class: 'ifc-cbs' },
        chk('Skinner (60E2, hældning 1:40)', 'skinner'),
        chk('Ballast og underballast', 'ballast'),
        chk('Sveller (a = 0,6 m)', 'sveller', 'Mange objekter – bedst til kortere strækninger'),
        chk('Dæmning', 'daemning'),
      ));
      const sv = SVELLE_DATA[b.v.svelle];
      left.append(h('p', { class: 'tip pj-tip0' },
        `${b.fraModul ? 'Fra Tværprofil-modulet' : 'Standard'}: Bsk ${fmt(b.v.Bsk, 2)} m · Bt ${fmt(b.v.Bt, 2)} m · Ut ${fmt(b.v.Ut, 2)} m · Pb ${fmt(b.v.Pb, 2)} m · ${FALD_TEKST[b.v.fald].toLowerCase()} · ${sv.navn}. Pb-tillæg i kurvens yderside og forhøjet skulder beregnes pr. snit. `,
        h('a', { href: '#tvaerprofil' }, 'Ret i Tværprofil (BN1-6)')));

      // Georeference
      left.append(h('div', { class: 'ed-sec' }, 'Georeference'));
      const crsOpt: [string, string][] = [...Object.values(CRS).map((c) => [c.epsg, `${c.navn} (EPSG:${c.epsg})`] as [string, string]), ['', 'Ingen (lokale koordinater)']];
      left.append(valg('Koordinatsystem (+ DVR90)', 'epsg', crsOpt));
      left.append(valg('Lokalt nulpunkt', 'origo', [['auto', 'Automatisk (hele km nær start) + IfcMapConversion'], ['manuel', 'Angiv nulpunkt'], ['global', 'Ingen forskydning (globale koordinater)']], () => renderLeft()));
      if (st.origo === 'manuel') left.append(h('div', { class: 'ed-fields' }, tal('Østlig E₀', 'E0', 'm', '1'), tal('Nordlig N₀', 'N0', 'm', '1')));

      // Eksport
      left.append(h('div', { class: 'ed-sec' }, 'Eksport'));
      left.append(valg('Fritrum i IFC 4.3 som', 'fritrumKlasse', [['virtual', 'IfcVirtualElement (CLEARANCE)'], ['proxy', 'IfcBuildingElementProxy']]));
      left.append(h('div', { class: 'ifc-cbs' }, chk('Komprimér som ifcZIP', 'zip')));
      const eks = h('div', { class: 'ifc-eks' });
      for (const sk of ['IFC4X3_ADD2', 'IFC4', 'IFC2X3'] as IfcSkema[]) {
        const btn = h('button', { type: 'button', class: sk === 'IFC4X3_ADD2' ? 'btn-primary btn-sm' : 'btn-ghost btn-sm' }, `Hent ${SKEMA_TEKST[sk]}`);
        btn.title = SKEMA_NOTE[sk];
        btn.addEventListener('click', () => eksporter(sk, btn));
        eks.append(h('div', { class: 'ifc-eks-r' }, btn, h('small', {}, SKEMA_NOTE[sk])));
      }
      left.append(eks);
      if (eksportInfo) left.append(h('p', { class: 'tip' }, eksportInfo));
    };

    /* ---------------------------- model ---------------------------- */
    const valgNu = (l: Linjefoering): ModelValg => {
      const kmTilD = (s: string, def: number) => {
        if (!s) return def;
        const v = parseKm(s, 'm');
        return Number.isFinite(v) ? Math.max(0, Math.min(l.laengde, dVed(l, v))) : def;
      };
      const origo: [number, number, number] = st.origo === 'global' ? [0, 0, 0] : st.origo === 'manuel' ? [st.E0, st.N0, 0] : foreslaaOrigo(l);
      return {
        d0: kmTilD(st.fra, 0), d1: kmTilD(st.til, l.laengde), trin: Math.max(0.5, Math.min(50, st.trin || 5)),
        profil: st.profil, tillaeg: st.tillaeg, bredde: st.bredde, hoejde: st.hoejde, overhoejde: st.overhoejde,
        afrundE: st.afrundE, afrundRv: st.afrundRv, skinner: st.skinner, ballast: st.ballast, sveller: st.sveller, daemning: st.daemning,
        bn16: bn16FraTvaerprofil().v, maxObjekt: Math.max(20, st.maxObjekt || 250), origo,
      };
    };

    const eksporter = async (sk: IfcSkema, btn: HTMLButtonElement) => {
      if (!model || !lf) return;
      const t0 = btn.textContent;
      btn.disabled = true; btn.textContent = 'Genererer …';
      await new Promise((r) => setTimeout(r, 20));
      try {
        const ak = aktivKilde();
        const pn = p?.navn || 'SporKit';
        const navnBase = slug(ak?.id === 'fil' ? `${pn}_${lf.navn}` : lf.navn);
        const filnavn = `${navnBase}_${sk}.ifc`;
        const r = skrivIfc(model, lf, sk, {
          projekt: p?.navn || meta0.navn || 'SporKit-projekt', sted: p?.straekning || meta0.sted || lf.navn,
          forfatter: meta0.udfoert, filnavn, epsg: lf.koordinater ? st.epsg : '',
          kilde: ak?.g?.filnavn, seed: `${p?.id ?? 'sporkit'}|${ak?.id}|${lf.navn}`, fritrumKlasse: st.fritrumKlasse,
        });
        if (st.zip) {
          const z = await zip([{ navn: filnavn, data: new TextEncoder().encode(r.tekst) }]);
          download(filnavn.replace(/\.ifc$/, '.ifczip'), z, 'application/zip');
          eksportInfo = `Hentet ${filnavn.replace(/\.ifc$/, '.ifczip')} – ${mb(z.length)} (${fmt(r.entiteter)} entiteter, ukomprimeret ${mb(r.tekst.length)}).`;
        } else {
          download(filnavn, r.tekst, 'application/x-step');
          eksportInfo = `Hentet ${filnavn} – ${mb(r.tekst.length)} (${fmt(r.entiteter)} entiteter).`;
        }
      } catch (e) {
        eksportInfo = `Eksporten fejlede: ${(e as Error).message}`;
      }
      btn.disabled = false; btn.textContent = t0;
      renderLeft();
    };

    /* ---------------------------- tegninger ---------------------------- */
    const planSvg = (l: Linjefoering, v: ModelValg, fokusD: number): string => {
      const W = 640, H = 230, m = 16;
      const n = 360;
      const pts = Array.from({ length: n + 1 }, (_, i) => { const d = (l.laengde * i) / n; const q = hPunkt(l, d); return { d, x: q.x, y: q.y }; });
      const xs = pts.map((q) => q.x), ys = pts.map((q) => q.y);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      const sk = Math.min((W - 2 * m) / Math.max(1, x1 - x0), (H - 2 * m - 14) / Math.max(1, y1 - y0));
      const X = (x: number) => m + (x - x0) * sk + ((W - 2 * m) - (x1 - x0) * sk) / 2;
      const Y = (y: number) => H - m - (y - y0) * sk - ((H - 2 * m - 14) - (y1 - y0) * sk) / 2;
      const poly = (a: typeof pts) => a.map((q) => `${X(q.x).toFixed(1)},${Y(q.y).toFixed(1)}`).join(' ');
      const udsnit = pts.filter((q) => q.d >= v.d0 - 1e-6 && q.d <= v.d1 + 1e-6);
      const f = hPunkt(l, fokusD);
      // elementgrænser
      const tick = l.h.map((s) => { const q = hPunkt(l, s.d0); const nx = -Math.sin(q.phi) * 5, ny = Math.cos(q.phi) * 5; return `<line x1="${(X(q.x) - nx).toFixed(1)}" y1="${(Y(q.y) + ny).toFixed(1)}" x2="${(X(q.x) + nx).toFixed(1)}" y2="${(Y(q.y) - ny).toFixed(1)}" class="ifc-tick"/>`; }).join('');
      const skala = (() => { const mm = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000]; const L = mm.find((x) => x * sk > 60) ?? 5000; return `<line x1="${m}" y1="${H - 8}" x2="${m + L * sk}" y2="${H - 8}" class="ifc-skala"/><text x="${m + L * sk + 6}" y="${H - 4}" class="ifc-t">${fmt(L)} m</text>`; })();
      return `<svg viewBox="0 0 ${W} ${H}" class="viz ifc-plan" role="img" aria-label="Plan af linjeføringen">
        <polyline points="${poly(pts)}" class="ifc-akse"/>
        <polyline points="${poly(udsnit)}" class="ifc-udsnit"/>
        ${tick}
        <circle cx="${X(f.x).toFixed(1)}" cy="${Y(f.y).toFixed(1)}" r="6" class="ifc-fokus"/>
        <text x="${(X(pts[0].x) + 8).toFixed(1)}" y="${(Y(pts[0].y) - 8).toFixed(1)}" class="ifc-t">km ${kmTxt(stationVed(l, 0))}</text>
        <text x="${(X(pts[n].x) - 8).toFixed(1)}" y="${(Y(pts[n].y) - 8).toFixed(1)}" text-anchor="end" class="ifc-t">km ${kmTxt(stationVed(l, l.laengde))}</text>
        <g transform="translate(${W - 24},26)"><path d="M0,-12 L5,4 L0,0 L-5,4 Z" class="ifc-nord"/><text y="16" text-anchor="middle" class="ifc-t">N</text></g>
        ${skala}
      </svg>`;
    };

    const kurveSvg = (mdl: Model): string => {
      const W = 640, H = 236, l = 44, r = 14, t = 20, b = 26, gap = 30;
      const sn = mdl.snit;
      if (sn.length < 2) return '';
      const k0 = sn[0].km, k1 = sn[sn.length - 1].km;
      const X = (k: number) => l + ((W - l - r) * (k - k0)) / Math.max(1e-9, k1 - k0);
      const maxE = Math.max(10, ...sn.map((s) => Math.max(s.e, s.dhRv)));
      const maxH = Math.max(10, ...sn.map((s) => s.h));
      const h1 = (H - t - b - gap) * 0.55, h2 = (H - t - b - gap) * 0.45;
      const Y1 = (v: number) => t + h1 - (h1 * v) / maxE;
      const Y2 = (v: number) => t + h1 + gap + h2 - (h2 * v) / maxH;
      const line = (f: (s: Model['snit'][number]) => number, Y: (v: number) => number) => sn.map((s) => `${X(s.km).toFixed(1)},${Y(f(s)).toFixed(1)}`).join(' ');
      const kurver = mdl.snit.length ? lfKurver(mdl).map(([a, c]) => `<rect x="${X(a).toFixed(1)}" y="${t}" width="${Math.max(0.5, X(c) - X(a)).toFixed(1)}" height="${H - t - b}" class="ifc-kurve"/>`).join('') : '';
      return `<svg viewBox="0 0 ${W} ${H}" class="viz ifc-graf" role="img" aria-label="Tillæg langs sporet">
        ${kurver}
        <line x1="${l}" y1="${Y1(0)}" x2="${W - r}" y2="${Y1(0)}" class="ifc-ax"/>
        <line x1="${l}" y1="${Y2(0)}" x2="${W - r}" y2="${Y2(0)}" class="ifc-ax"/>
        <polyline points="${line((s) => s.e, Y1)}" class="ifc-e"/>
        <polyline points="${line((s) => s.dhRv, Y1)}" class="ifc-dh"/>
        <polyline points="${line((s) => s.h, Y2)}" class="ifc-h"/>
        <text x="${l - 6}" y="${Y1(maxE) + 4}" text-anchor="end" class="ifc-t">${fmt(maxE)}</text>
        <text x="${l - 6}" y="${Y1(0) + 4}" text-anchor="end" class="ifc-t">0</text>
        <text x="${l - 6}" y="${Y2(maxH) + 4}" text-anchor="end" class="ifc-t">${fmt(maxH)}</text>
        <text x="${l - 6}" y="${Y2(0) + 4}" text-anchor="end" class="ifc-t">0</text>
        <text x="${l + 4}" y="${t - 5}" class="ifc-t"><tspan class="ifc-le">━ e</tspan>  <tspan class="ifc-ldh">━ ΔhRv</tspan>  [mm]</text>
        <text x="${l + 4}" y="${Y2(maxH) - 6}" class="ifc-t"><tspan class="ifc-lh">━ overhøjde h</tspan> [mm]</text>
        <text x="${l}" y="${H - 8}" class="ifc-t">km ${kmTxt(k0)}</text>
        <text x="${W - r}" y="${H - 8}" text-anchor="end" class="ifc-t">km ${kmTxt(k1)}</text>
      </svg>`;
    };
    const lfKurver = (mdl: Model): [number, number][] => {
      const out: [number, number][] = [];
      let a: number | null = null;
      for (const s of mdl.snit) {
        if (s.R && a === null) a = s.km;
        if (!s.R && a !== null) { out.push([a, s.km]); a = null; }
      }
      if (a !== null) out.push([a, mdl.snit[mdl.snit.length - 1].km]);
      return out;
    };

    /* ---------------------------- opdatering ---------------------------- */
    let timer = 0;
    const opdater = () => { saveState('ifc', st); clearTimeout(timer); timer = window.setTimeout(beregn, 120); };

    const beregn = () => {
      visning?.destroy(); visning = null;
      out.innerHTML = '';
      const ak = aktivKilde();
      if (!ak?.g) {
        lf = null; model = null;
        out.append(h('div', { class: 'ifc-tom' },
          h('p', {}, 'Indlæs en LandXML-fil med linjeføringen, eller brug eksemplet. Du kan også indlæse spordataliste/geometrirapport i '), h('a', { href: '#projekt' }, 'Projekt-modulet'), h('span', {}, '.')));
        setReport(null);
        return;
      }
      const g = ak.g;
      try {
        const noegle = `${ak.id}|${g.filnavn}|${g.navn}|${g.elementer.length}|${g.elementer[0]?.km0}|${g.elementer[g.elementer.length - 1]?.km1}`;
        if (!lfCache || lfCache.noegle !== noegle) lfCache = { noegle, lf: byggLinjefoering(g.navn, g.elementer, g.geo) };
        lf = lfCache.lf;
        const v = valgNu(lf);
        const t0 = performance.now();
        model = byggModel(lf, v);
        const ms = performance.now() - t0;
        const fokus = st.fokus >= 0 ? Math.max(v.d0, Math.min(v.d1, dVed(lf, st.fokus))) : (v.d0 + v.d1) / 2;
        // Forhåndsvisning omkring fokus
        const halv = 30;
        const a = Math.max(v.d0, Math.min(fokus - halv, v.d1 - 2 * halv)), bb = Math.min(v.d1, a + 2 * halv);
        const fp = hPunkt(lf, fokus);
        const pv = byggModel(lf, { ...v, d0: a, d1: bb, trin: Math.min(v.trin, 1.5), maxObjekt: 1e6, ringe: true });
        const LAG: Record<Del, number> = { daemning: 0, underballast: 1, ballast: 2, sveller: 3, skinne: 4, fritrum: 5 };
        const meshes = pv.objekter.filter((o) => o.del !== 'fritrum').map((o) => ({ pts: o.pts, tri: o.tri, farve: FARVE[o.del].rgb, lukket: o.lukket, lag: LAG[o.del] }));
        const fz = pv.snit.reduce((s, x) => s + x.z, 0) / pv.snit.length - v.origo[2];
        const canvas = h('canvas', { class: 'ifc-3d', 'aria-label': '3D-forhåndsvisning af sporet' }) as HTMLCanvasElement;
        const viewBtns = h('div', { class: 'ifc-vb' });
        for (const [k, t] of [['skraa', 'Skråt'], ['langs', 'Langs sporet'], ['side', 'Fra siden'], ['top', 'Oppefra']] as const) {
          const bt = h('button', { type: 'button', class: 'btn-ghost btn-sm' }, t);
          bt.addEventListener('click', () => visning?.saet(k));
          viewBtns.append(bt);
        }
        const slider = h('input', { type: 'range', min: String(v.d0), max: String(v.d1), step: '1', value: String(fokus), 'aria-label': 'Station for forhåndsvisning' });
        slider.addEventListener('change', () => { st.fokus = stationVed(lf!, parseFloat(slider.value)); opdater(); });
        const hF = v.overhoejde ? cantVed(lf, fokus).h : 0, eF = v.bredde ? eVed(lf, fokus, v.afrundE) : 0, dhF = v.hoejde ? dhRvVed(lf, fokus, v.afrundRv) : 0;
        const info3d = h('div', { class: 'ifc-3d-info' },
          h('strong', {}, `km ${kmTxt(stationVed(lf, fokus))}`),
          h('span', {}, ` · ${fp.k ? `R = ${fmt(Math.abs(1 / fp.k))} m` : 'ret spor'} · h = ${fmt(hF)} mm · e = ${fmt(eF, 1)} mm · ΔhRv = ${fmt(dhF, 1)} mm`));
        const plan = h('div', { class: 'ifc-planw' });
        plan.innerHTML = planSvg(lf, v, fokus);
        plan.querySelector('svg')!.addEventListener('click', (e) => {
          const svg = e.currentTarget as SVGSVGElement;
          const r = svg.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * 640, py = ((e.clientY - r.top) / r.height) * 230;
          // nærmeste punkt på linjeføringen
          let best = 0, bd = Infinity;
          const pts = Array.from(svg.querySelectorAll('polyline')[0].getAttribute('points')!.split(' ')).map((s) => s.split(',').map(Number));
          pts.forEach((q, i) => { const d = (q[0] - px) ** 2 + (q[1] - py) ** 2; if (d < bd) { bd = d; best = i; } });
          const d = (lf!.laengde * best) / (pts.length - 1);
          st.fokus = stationVed(lf!, Math.max(v.d0, Math.min(v.d1, d)));
          opdater();
        });

        // statistik
        const tael = new Map<Del, number>();
        let tri = 0, pkt = 0;
        for (const o of model.objekter) { tael.set(o.del, (tael.get(o.del) ?? 0) + 1); tri += o.tri.length / 3; pkt += o.pts.length / 3; }
        const est = { IFC4X3_ADD2: pkt * 26 + tri * 16, IFC4: pkt * 26 + tri * 16, IFC2X3: pkt * 50 + tri * 124 };
        const sn = model.snit;
        const eM = Math.max(...sn.map((s) => s.e)), dhM = Math.max(...sn.map((s) => s.dhRv)), hM = Math.max(...sn.map((s) => s.h));
        const Rmin = Math.min(Infinity, ...sn.filter((s) => s.R).map((s) => Math.abs(s.R)));
        const Rvmin = Math.min(Infinity, ...sn.filter((s) => s.Rv).map((s) => Math.abs(s.Rv)));
        const res = h('div', { class: 'results' });
        res.innerHTML = [
          ['Strækning', `${fmt(v.d1 - v.d0)} m`, `km ${kmTxt(stationVed(lf, v.d0))} – ${kmTxt(stationVed(lf, v.d1))}`],
          ['Tværsnit', fmt(sn.length), `${fmt(model.objekter.length)} objekter · ${fmt(tri)} trekanter`],
          ['Breddeforøgelse e maks.', `${fmt(eM, 1)} mm`, Number.isFinite(Rmin) ? `R min. ${fmt(Rmin)} m` : 'ingen kurver'],
          ['Højdeændring ΔhRv maks.', `${fmt(dhM, 1)} mm`, Number.isFinite(Rvmin) ? `Rv min. ${fmt(Rvmin)} m` : 'ingen afrundingskurver'],
          ['Overhøjde maks.', `${fmt(hM)} mm`, lf.harCant ? 'drejet om indvendig skinne' : 'ingen overhøjde i data'],
          ['Filstørrelse ca.', mb(est.IFC4X3_ADD2), `IFC2x3 ca. ${mb(est.IFC2X3)} · beregnet på ${fmt(ms)} ms`],
        ].map(([lbl, val, sub]) => `<div class="res"><div class="res-head"><span class="lbl">${lbl}</span></div><div class="res-val">${val}</div><div class="res-sub">${sub}</div></div>`).join('');

        const objTxt = [...tael.entries()].map(([d, n]) => `<span class="ifc-obj"><i style="background:rgb(${FARVE[d].rgb.map((c) => Math.round(c * 255)).join(',')})"></i>${DEL_TEKST[d]} × ${n}</span>`).join('');
        const objs = h('div', { class: 'ifc-objs' }); objs.innerHTML = objTxt;
        const graf = h('div', {}); graf.innerHTML = kurveSvg(model);

        const noter = [...g.advarsler, ...lf.advarsler, ...model.advarsler];
        const kontrol = h('div', { class: 'ifc-kontrol' });
        kontrol.innerHTML = `<table class="tbl"><tbody>
          <tr><td>Koordinater</td><td>${lf.koordinater ? `fra filen${g.geo?.orden === 'EN' ? ' (østlig/nordlig byttet)' : ''}` : 'lokale (0, 0)'}</td></tr>
          <tr><td>Kontrol af elementendepunkter</td><td>${lf.koordinater ? `maks. ${fmt(lf.maksAfvigelse * 1000, 1)} mm afvigelse` : '–'}</td></tr>
          <tr><td>Længdeprofil</td><td>${lf.harProfil ? `${lf.v.length} segmenter (${lf.v.filter((s) => s.type !== 'ret').length} afrundingskurver)` : 'mangler – vandret i kote 0'}</td></tr>
          <tr><td>Overhøjde</td><td>${lf.harCant ? `${lf.cant.length} stationer` : 'ingen'}</td></tr>
          <tr><td>Georeference</td><td>${lf.koordinater && st.epsg ? `${esc(CRS[st.epsg].navn)} · nulpunkt E ${fmt(v.origo[0])} / N ${fmt(v.origo[1])}` : 'ingen'}</td></tr>
        </tbody></table>`;

        out.append(
          h('div', { class: 'ifc-3dw' }, canvas, info3d, viewBtns),
          h('div', { class: 'ifc-slider' }, h('small', {}, 'Vis station'), slider),
          h('p', { class: 'tip pj-tip0' }, 'Træk for at dreje, Shift-træk (eller to fingre) for at panorere, hjul/knib for at zoome. Forhåndsvisningen viser 60 m omkring den valgte station – eksporten indeholder hele strækningen.'),
          objs, res, h('h3', {}, 'Plan'), plan, h('h3', {}, 'Tillæg langs sporet'), graf, h('h3', {}, 'Grundlag og kontrol'), kontrol,
        );
        if (noter.length) out.append(h('div', { class: 'notice' }, ...noter.slice(0, 8).map((x) => h('div', {}, `• ${x}`))));
        visning = lav3D(canvas, meshes, pv.ringe ?? [], [fp.x - v.origo[0], fp.y - v.origo[1], fz], fp.phi);

        // rapport
        const checks: ReportCheck[] = [];
        if (Number.isFinite(Rmin)) checks.push({ label: 'Mindste radius (formel 12.1/12.2 gælder for R ≥ 150 m)', value: `${fmt(Rmin)} m`, graense: '≥ 150 m', status: Rmin >= 150 ? 'ok' : 'overskredet', kilde: 'BN1-166-1 afsnit 12' });
        if (Number.isFinite(Rvmin)) checks.push({ label: 'Mindste afrundingsradius (formel 13.1 gælder for Rv ≥ 500 m)', value: `${fmt(Rvmin)} m`, graense: '≥ 500 m', status: Rvmin >= 500 ? 'ok' : 'overskredet', kilde: 'BN1-166-1 afsnit 13' });
        if (lf.koordinater) checks.push({ label: 'Beregnede elementendepunkter mod filens koordinater', value: `${fmt(lf.maksAfvigelse * 1000, 1)} mm`, graense: '≤ 10 mm', status: lf.maksAfvigelse <= 0.01 ? 'ok' : 'undtagelse', kilde: 'LandXML' });
        setReport({
          modul: 'IFC-model',
          inputs: [
            { label: 'Linjeføring', symbol: '', value: `${g.navn} (${g.filnavn})`, unit: '' },
            { label: 'Strækning', symbol: '', value: `km ${kmTxt(stationVed(lf, v.d0))} – ${kmTxt(stationVed(lf, v.d1))}`, unit: '' },
            { label: 'Fritrumsprofil', symbol: '', value: `${v.profil}, vedligeholdelsestillæg: ${v.tillaeg}`, unit: '' },
            { label: 'Største snitafstand', symbol: 'Δs', value: fmt(v.trin, 1), unit: 'm' },
            { label: 'Koordinatsystem', symbol: '', value: lf.koordinater && st.epsg ? `${CRS[st.epsg].navn} + DVR90` : 'lokalt', unit: '' },
          ],
          steps: [
            { label: 'Breddeforøgelse, 250 ≤ R < 300 m', formel: 'e = 3750 / R', indsat: 'formel 12.1', resultat: 'mm' },
            { label: 'Breddeforøgelse, 150 ≤ R < 250 m', formel: 'e = 60.000 / R − 225', indsat: 'formel 12.2', resultat: 'mm' },
            { label: 'Højdeændring i afrundingskurve', formel: 'ΔhRv = 50.000 / Rv', indsat: 'formel 13.1, lineært fra 25 m før tangentpunktet', resultat: 'mm' },
            { label: 'Overhøjde, drejning om indvendig skinne', formel: 'θ = arcsin(h / 1500)', indsat: 'skinnemidte 753,5 mm fra spormidte', resultat: 'rad' },
          ],
          checks,
          noter: [
            `Resultat: ${fmt(model.objekter.length)} objekter, ${fmt(sn.length)} tværsnit, e maks. ${fmt(eM, 1)} mm, ΔhRv maks. ${fmt(dhM, 1)} mm, h maks. ${fmt(hM)} mm.`,
            'e følger figur 12-2 – 12-7 (lineært over overgangskurver; ved R ≤ 250 m uden overgangskurve fra 12 m til 2 m før BP).',
            ...noter,
          ],
          refs: ['BN1-166', 'BN1-6', 'SR87', 'IFC', 'LandXML'],
          figur: kurveSvg(model),
        });
      } catch (e) {
        out.append(h('div', { class: 'notice' }, `Modellen kunne ikke bygges: ${(e as Error).message}`));
        setReport(null);
      }
    };

    renderLeft();
    beregn();
    root.append(h('div', { class: 'grid' }, card('Grundlag og indstillinger', left, 'card-input card-scroll'), card('3D-model', out, 'card-out')));
  },
};
