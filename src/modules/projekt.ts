import {
  analyser, DATA_TEKST, EKSEMPEL_CSV, EKSEMPEL_PROJEKT_CSV, elementerFraTabel, FELT_TEKST, gaetFelter, gemProjekter, hentProjekter, aktivtId,
  laesProjektfil, nytProjekt, parseLandXML, parseTabel, saetAktivt,
  type DataType, type Element, type ElementAnalyse, type Felt, type ImportValg, type Projekt, type Tabel,
} from '../core/projekt';
import { loadSettings, samletStatus, type Settings, type SporKlasse } from '../core/rules';
import {
  samletSpor, tilstandVed, kontrolPunkt, tavlerFraElementer, sammenlignTavler, tavlerCsv, TAVLE_STATUS_TEKST,
  type PunktKontrol, type TavleRaekke, type TilslutningInput,
} from '../core/tilslutning';
import { parseKm } from '../core/projekt';
import { setReport } from '../core/report';
import { saveState } from '../ui/dom';
import { card, chip, fmt, h, type Module } from '../ui/dom';
import { kmTekst, profilSvg } from '../ui/hastighedsprofil';

const TYPE_TEKST: Record<Element['type'], string> = { ret: 'Ret', kurve: 'Cirkelbue', overgang: 'Overgang' };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const rTekst = (R: number) => (R ? `${fmt(Math.abs(R))} ${R > 0 ? 'H' : 'V'}` : '∞');
const vTekst = (v: number) => (Number.isFinite(v) ? fmt(v) : '–');

function download(navn: string, tekst: string, type = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([tekst], { type }));
  a.download = navn;
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

interface Udkast { dataType: DataType; filnavn: string; tab?: Tabel; valg?: ImportValg; xml?: ReturnType<typeof parseLandXML>; xmlValg: number }

export const projekt: Module = {
  id: 'projekt',
  gruppe: 'Projekt',
  titel: 'Projekt og hastighedsprofil',
  kort: 'Projekt',
  ikon: '▦',
  beskrivelse: 'Opret et projekt, indlæs spordataliste og geometrirapport, og beregn hastighedsprofil med alle parametre for hvert element (Sporregler afsn. 2.03–2.06).',
  render(root) {
    let projekter = hentProjekter();
    let p = projekter.find((x) => x.id === aktivtId()) ?? projekter[0];
    if (!p) { p = nytProjekt('Mit første projekt'); projekter = [p]; gemProjekter(projekter); }
    saetAktivt(p.id);
    let udkast: Udkast | null = null;
    let valgt: number | null = null;
    let vurderVed: 'profil' | 'straekning' = 'profil';
    let besked = '';

    const left = h('div', {});
    const out = h('div', { class: 'out' });
    const elOut = h('div', {});
    const elCard = card('Elementer og parametre', elOut, 'pj-elcard');
    const tOut = h('div', {});
    const tCard = card('Tilslutning og tracétavler (BN2-93)', tOut, 'pj-elcard');
    let visUaendrede = false;
    const tilslutning = (): TilslutningInput | null => {
      const pr = p.data.projekteret?.elementer;
      if (!pr?.length) return null;
      const d = { start: pr[0].km0, slutProj: pr[pr.length - 1].km1, slutEks: pr[pr.length - 1].km1 };
      return { ...d, ...(p.tilslutning ?? {}) };
    };

    const gem = () => {
      p.opdateret = new Date().toISOString();
      projekter = projekter.map((x) => (x.id === p.id ? p : x));
      if (!gemProjekter(projekter)) besked = 'Projektet kunne ikke gemmes i browseren (privat vindue eller fuld lagerplads) – eksportér det som fil.';
    };

    /* ------------------------------ venstre panel ------------------------------ */
    const renderLeft = () => {
      left.innerHTML = '';
      // Projektvælger og handlinger
      const sel = h('select', {});
      for (const x of projekter) { const o = h('option', { value: x.id }, x.navn || 'Uden navn'); if (x.id === p.id) o.selected = true; sel.append(o); }
      sel.addEventListener('change', () => { p = projekter.find((x) => x.id === sel.value)!; saetAktivt(p.id); udkast = null; valgt = null; renderLeft(); update(); });
      const knap = (t: string, f: () => void, cls = 'btn-ghost btn-sm') => { const b = h('button', { type: 'button', class: cls }, t); b.addEventListener('click', f); return b; };
      const fil = h('input', { type: 'file', accept: '.json,application/json', hidden: '' });
      fil.addEventListener('change', async () => {
        const f = fil.files?.[0]; if (!f) return;
        try { const np = laesProjektfil(await f.text()); projekter.push(np); p = np; saetAktivt(p.id); gem(); besked = `Projektet «${np.navn}» er indlæst.`; } catch (e) { besked = (e as Error).message; }
        renderLeft(); update();
      });
      const handl = h('div', { class: 'pj-knapper' },
        knap('Nyt', () => { const np = nytProjekt(`Projekt ${projekter.length + 1}`); projekter.push(np); p = np; saetAktivt(p.id); gem(); udkast = null; valgt = null; renderLeft(); update(); }),
        knap('Eksportér', () => download(`${(p.navn || 'projekt').replace(/[^\wæøåÆØÅ-]+/g, '_')}.sporkit.json`, JSON.stringify({ format: 'sporkit-projekt-1', ...p }, null, 1))),
        knap('Importér', () => fil.click()),
        knap('Slet', () => {
          if (!confirm(`Slet projektet «${p.navn}» fra denne browser?`)) return;
          projekter = projekter.filter((x) => x.id !== p.id);
          if (!projekter.length) projekter = [nytProjekt('Nyt projekt')];
          p = projekter[0]; saetAktivt(p.id); gemProjekter(projekter); udkast = null; valgt = null; renderLeft(); update();
        }),
        fil,
      );
      const tekstFelt = (label: string, key: 'navn' | 'straekning') => {
        const i = h('input', { type: 'text', value: p[key] });
        i.addEventListener('change', () => { p[key] = i.value; gem(); if (key === 'navn') renderLeft(); update(); });
        return h('label', { class: 'ed-f' }, h('span', {}, label), h('div', { class: 'ed-inp' }, i));
      };
      const talFelt = (label: string, key: 'V' | 'Vmin', unit: string) => {
        const i = h('input', { type: 'number', inputmode: 'decimal', step: '5', value: String(p[key]) });
        i.addEventListener('input', () => { const v = parseFloat(i.value); if (v > 0) { p[key] = v; gem(); update(); } });
        return h('label', { class: 'ed-f' }, h('span', {}, label), h('div', { class: 'ed-inp' }, i, h('small', {}, unit)));
      };
      const grundlag = h('select', {});
      for (const t of ['eksisterende', 'projekteret', 'samlet'] as const) {
        const tekst = t === 'samlet' ? 'Samlet spor (eksisterende + projekt)' : DATA_TEKST[t];
        const mangler = t === 'samlet' ? !(p.data.eksisterende && p.data.projekteret) : !p.data[t];
        const o = h('option', { value: t }, `${tekst}${mangler ? ' – mangler data' : ''}`);
        if (p.grundlag === t) o.selected = true;
        grundlag.append(o);
      }
      grundlag.addEventListener('change', () => { p.grundlag = grundlag.value as Projekt['grundlag']; gem(); valgt = null; update(); });
      const kl = h('select', {});
      for (const [v, t] of [['hovedspor', 'Hovedspor / gennemgående togvejsspor'], ['oevrige', 'Øvrige togvejsspor / sidespor']]) { const o = h('option', { value: v }, t); if ((p.klasse ?? 'hovedspor') === v) o.selected = true; kl.append(o); }
      kl.addEventListener('change', () => { p.klasse = kl.value as SporKlasse; gem(); update(); });
      const vv = h('select', {});
      for (const [v, t] of [['profil', 'Tilladt hastighed (profilet)'], ['straekning', 'Strækningshastighed']]) { const o = h('option', { value: v }, t); if (vurderVed === v) o.selected = true; vv.append(o); }
      vv.addEventListener('change', () => { vurderVed = vv.value as typeof vurderVed; update(); });

      left.append(
        h('div', { class: 'field' }, h('label', {}, h('span', { class: 'lbl' }, 'Aktivt projekt')), h('div', { class: 'inp inp-sel' }, sel)),
        handl,
        h('div', { class: 'ed-fields pj-felter' }, tekstFelt('Projektnavn', 'navn'), tekstFelt('Strækning', 'straekning')),
        h('div', { class: 'ed-fields' }, talFelt('Strækningshastighed', 'V', 'km/t'), talFelt('Laveste hastighed (gods)', 'Vmin', 'km/t')),
        h('div', { class: 'field' }, h('label', {}, h('span', { class: 'lbl' }, 'Grundlag for beregningerne')), h('div', { class: 'inp inp-sel' }, grundlag)),
        h('div', { class: 'field' }, h('label', {}, h('span', { class: 'lbl' }, 'Vis parametre ved')), h('div', { class: 'inp inp-sel' }, vv)),
        h('div', { class: 'field' }, h('label', {}, h('span', { class: 'lbl' }, 'Sporklasse (fiktivt ryk)')), h('div', { class: 'inp inp-sel' }, kl)),
      );

      // Datasæt
      left.append(h('div', { class: 'ed-sec' }, 'Data'));
      for (const t of ['eksisterende', 'projekteret'] as DataType[]) {
        const d = p.data[t];
        const fi = h('input', { type: 'file', accept: '.csv,.txt,.tsv,.xml,.landxml,text/plain,text/csv', hidden: '' });
        fi.addEventListener('change', async () => { const f = fi.files?.[0]; if (f) { laesFil(t, f.name, await f.text()); } fi.value = ''; });
        const row = h('div', { class: 'pj-data' },
          h('div', {}, h('strong', {}, DATA_TEKST[t]), h('small', {}, d ? `${d.filnavn} · ${d.elementer.length} elementer · ${new Date(d.importeret).toLocaleDateString('da-DK')}` : 'Ikke indlæst')),
          h('div', { class: 'pj-knapper' },
            knap('Upload fil', () => fi.click()),
            knap('Indsæt tekst', () => { udkast = { dataType: t, filnavn: 'Indsat tekst', xmlValg: 0 }; renderLeft(); }),
            ...(d ? [knap('Fjern', () => { delete p.data[t]; gem(); valgt = null; renderLeft(); update(); })] : []),
            fi,
          ));
        left.append(row);
      }
      const eks = h('div', { class: 'pj-knapper' },
        knap('Indlæs eksempel', () => laesFil('eksisterende', 'Eksempel (fiktivt).csv', EKSEMPEL_CSV)),
        knap('Eksempel: projekt med tilslutning', () => laesFil('projekteret', 'Eksempelprojekt (fiktivt).csv', EKSEMPEL_PROJEKT_CSV)),
        knap('Hent CSV-skabelon', () => download('sporkit-skabelon.csv', EKSEMPEL_CSV, 'text/csv')),
      );
      left.append(eks, h('p', { class: 'tip' }, 'Formater: CSV/TXT (semikolon, tabulator eller komma; dansk eller engelsk decimaltegn; km som 12+345,678) og LandXML (Line/Curve/Spiral og Cant). Excel: gem arket som CSV. Data bliver i din browser og sendes ikke nogen steder hen.'));

      if (udkast) left.append(importPanel());
      if (besked) left.append(h('div', { class: 'notice' }, besked));
    };

    const laesFil = (t: DataType, navn: string, tekst: string) => {
      besked = '';
      udkast = { dataType: t, filnavn: navn, xmlValg: 0 };
      try {
        if (/^\s*<\?xml|<LandXML/i.test(tekst)) udkast.xml = parseLandXML(tekst);
        else {
          const tab = parseTabel(tekst);
          udkast.tab = tab;
          udkast.valg = { felter: gaetFelter(tab.header), kmEnhed: 'auto', positiv: 'hoejre' };
        }
      } catch (e) { besked = `Filen kunne ikke læses: ${(e as Error).message}`; udkast = null; }
      renderLeft();
    };

    /* ------------------------------ importpanel ------------------------------ */
    const importPanel = (): HTMLElement => {
      const u = udkast!;
      const box = h('div', { class: 'pj-import' }, h('div', { class: 'ed-sec' }, `Import · ${DATA_TEKST[u.dataType]}`));
      if (!u.tab && !u.xml) {
        const ta = h('textarea', { rows: '8', placeholder: 'Indsæt tabel fra regneark eller rapport (med overskriftsrække) …', class: 'pj-ta' });
        const b = h('button', { type: 'button', class: 'btn-ghost btn-sm' }, 'Læs tabel');
        b.addEventListener('click', () => laesFil(u.dataType, 'Indsat tekst', ta.value));
        box.append(ta, h('div', { class: 'pj-knapper' }, b));
        return box;
      }
      let el: Element[] = [];
      let adv: string[] = [];
      if (u.xml) {
        if (!u.xml.length) { box.append(h('p', {}, 'Ingen <Alignment> fundet i filen.')); return box; }
        const s = h('select', {});
        u.xml.forEach((a, i) => { const o = h('option', { value: String(i) }, `${a.navn} (${a.elementer.length} elementer)`); if (i === u.xmlValg) o.selected = true; s.append(o); });
        s.addEventListener('change', () => { u.xmlValg = Number(s.value); renderLeft(); });
        box.append(h('div', { class: 'field' }, h('label', {}, h('span', { class: 'lbl' }, 'Linjeføring i LandXML')), h('div', { class: 'inp inp-sel' }, s)));
        el = u.xml[u.xmlValg].elementer; adv = u.xml[u.xmlValg].advarsler;
      } else {
        const tab = u.tab!, v = u.valg!;
        const r = elementerFraTabel(tab, v); el = r.elementer; adv = r.advarsler;
        // kolonnevalg
        const map = h('div', { class: 'pj-map' });
        tab.header.forEach((hd, j) => {
          const s = h('select', {});
          for (const f of Object.keys(FELT_TEKST) as Felt[]) { const o = h('option', { value: f }, FELT_TEKST[f]); if (v.felter[j] === f) o.selected = true; s.append(o); }
          s.addEventListener('change', () => { v.felter[j] = s.value as Felt; renderLeft(); });
          const eks = tab.rows.slice(0, 2).map((rr) => rr[j] ?? '').filter(Boolean).join(' · ');
          map.append(h('label', { class: 'ed-f' }, h('span', {}, `${hd}${eks ? ` – ${eks}` : ''}`), h('div', { class: 'inp inp-sel' }, s)));
        });
        const enh = h('select', {});
        for (const [k, t] of [['auto', 'Km: gæt enhed'], ['km', 'Km angivet i km'], ['m', 'Km angivet i meter']]) { const o = h('option', { value: k }, t); if (v.kmEnhed === k) o.selected = true; enh.append(o); }
        enh.addEventListener('change', () => { v.kmEnhed = enh.value as ImportValg['kmEnhed']; renderLeft(); });
        const pos = h('select', {});
        for (const [k, t] of [['hoejre', 'Positiv radius = højrekurve'], ['venstre', 'Positiv radius = venstrekurve']]) { const o = h('option', { value: k }, t); if (v.positiv === k) o.selected = true; pos.append(o); }
        pos.addEventListener('change', () => { v.positiv = pos.value as ImportValg['positiv']; renderLeft(); });
        box.append(h('small', { class: 'tp-norm' }, `${tab.rows.length} rækker · skilletegn: ${tab.delimiter === '\t' ? 'tabulator' : tab.delimiter}`), map,
          h('div', { class: 'ed-fields' }, h('div', { class: 'inp inp-sel' }, enh), h('div', { class: 'inp inp-sel' }, pos)));
      }
      const tael = { ret: 0, kurve: 0, overgang: 0 };
      el.forEach((e) => tael[e.type]++);
      box.append(h('p', { class: 'tip' }, `Fundet: ${el.length} elementer – ${tael.ret} rette, ${tael.kurve} cirkelbuer, ${tael.overgang} overgangskurver${el.length ? `, km ${kmTekst(el[0].km0)} – ${kmTekst(el[el.length - 1].km1)}` : ''}.`));
      if (adv.length) box.append(h('div', { class: 'notice' }, ...adv.slice(0, 6).map((a) => h('div', {}, `• ${a}`))));
      const ok = h('button', { type: 'button', class: 'btn-primary btn-sm' }, `Brug ${el.length} elementer`);
      ok.addEventListener('click', () => {
        if (!el.length) return;
        p.data[u.dataType] = { filnavn: u.filnavn, importeret: new Date().toISOString(), elementer: el };
        if (p.grundlag !== 'samlet' && !p.data[p.grundlag]) p.grundlag = u.dataType;
        gem(); udkast = null; valgt = null; besked = ''; renderLeft(); update();
      });
      const annul = h('button', { type: 'button', class: 'btn-ghost btn-sm' }, 'Annullér');
      annul.addEventListener('click', () => { udkast = null; renderLeft(); });
      box.append(h('div', { class: 'pj-knapper' }, ok, annul));
      return box;
    };

    /* ------------------------------ resultat ------------------------------ */
    const update = () => {
      const s = loadSettings();
      const tl = tilslutning();
      const eksD = p.data.eksisterende, projD = p.data.projekteret;
      const samlet = p.grundlag === 'samlet' && eksD && projD && tl;
      const d = samlet
        ? { filnavn: `${eksD.filnavn} + ${projD.filnavn}`, importeret: projD.importeret, elementer: samletSpor(eksD.elementer, projD.elementer, tl) }
        : p.data[p.grundlag === 'samlet' ? 'eksisterende' : p.grundlag] ?? p.data.eksisterende ?? p.data.projekteret;
      const grundTekst = samlet ? 'Samlet spor (eksisterende + projekt)' : DATA_TEKST[(p.grundlag === 'samlet' ? (p.data.eksisterende ? 'eksisterende' : 'projekteret') : p.grundlag) as DataType];
      renderTilslutning(s);
      if (!d) {
        elCard.hidden = true;
        out.innerHTML = `<div class="pj-tom"><h3>Ingen data endnu</h3><p>Upload en spordataliste eller geometrirapport i venstre side – eller tryk «Indlæs eksempel» for at se, hvordan hastighedsprofilen virker.</p></div>`;
        setReport(null);
        return;
      }
      const valg = { V: p.V, Vmin: p.Vmin, vurderVed, klasse: p.klasse ?? 'hovedspor' as SporKlasse };
      const a = analyser(d.elementer, valg, s);
      const anden: DataType = p.grundlag === 'eksisterende' ? 'projekteret' : 'eksisterende';
      const sam = p.data[anden] ? analyser(p.data[anden]!.elementer, valg, s) : null;
      const total = samletStatus(a.map((x) => x.status));
      const kurver = a.filter((x) => x.e.type === 'kurve');
      const Vmin = Math.min(...a.map((x) => x.VtN));
      const nedsat = a.filter((x) => x.VtN < p.V);
      const laengdeNedsat = nedsat.reduce((sum, x) => sum + x.e.L, 0);
      const fig = profilSvg(a, p.V, sam, valgt);
      const tbl = tabelHtml(a, true);

      out.innerHTML = `
        <div class="summary summary-${total}">
          <div><strong>${esc(p.navn)}${p.straekning ? ` · ${esc(p.straekning)}` : ''}</strong>
          <span>${grundTekst} · ${a.length} elementer · km ${kmTekst(a[0].e.km0)} – ${kmTekst(a[a.length - 1].e.km1)} · vurderet ved ${vurderVed === 'profil' ? 'tilladt hastighed' : `V = ${p.V} km/t`}</span></div>
          ${chip(total)}
        </div>
        <div class="pj-kpi">
          <div><small>Strækningshastighed</small><b>${p.V} km/t</b></div>
          <div><small>Laveste tilladte V</small><b>${vTekst(Vmin)} km/t</b></div>
          <div><small>Strækning med nedsat V</small><b>${fmt(laengdeNedsat)} m</b></div>
          <div><small>Cirkelbuer / mindste R</small><b>${kurver.length} / ${kurver.length ? fmt(Math.min(...kurver.map((x) => Math.abs(x.e.R0)))) : '–'} m</b></div>
        </div>
        <div class="pj-fig">${fig}</div>
        <p class="tip">Hastigheden for en kurvegruppe (overgang – bue – overgang) er den laveste for gruppens elementer, rundet ned til 5 km/t. Røde markeringer under hastighedskurven viser elementer, der ikke overholder normalgrænserne ved den viste hastighed.</p>`;
      elCard.hidden = false;
      elOut.innerHTML = `<p class="tip pj-tip0">Klik på en række for at se alle parametre for elementet.</p>
        <div class="pj-tbl">${tbl}</div>
        <div class="pj-detalje"></div>`;
      elOut.querySelectorAll<HTMLTableRowElement>('tr[data-i]').forEach((tr) => {
        tr.addEventListener('click', () => { valgt = Number(tr.dataset.i); update(); elOut.querySelector('.pj-detalje')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); });
      });
      if (valgt !== null && a[valgt]) {
        const det = elOut.querySelector<HTMLElement>('.pj-detalje')!;
        det.append(detalje(a[valgt], a));
      }

      setReport({
        modul: `Hastighedsprofil – ${p.navn}`,
        inputs: [
          { label: 'Projekt / strækning', symbol: '', value: `${p.navn}${p.straekning ? ` · ${p.straekning}` : ''}`, unit: '' },
          { label: 'Grundlag', symbol: '', value: `${grundTekst} – ${d.filnavn} (${new Date(d.importeret).toLocaleDateString('da-DK')})`, unit: '' },
          { label: 'Strækningshastighed / laveste hastighed', symbol: 'V / Vmin', value: `${p.V} / ${p.Vmin}`, unit: 'km/t' },
          { label: 'Elementer', symbol: '', value: `${a.length} (km ${kmTekst(a[0].e.km0)} – ${kmTekst(a[a.length - 1].e.km1)})`, unit: '' },
          { label: 'Parametre vist ved', symbol: '', value: vurderVed === 'profil' ? 'tilladt hastighed (profilet)' : 'strækningshastighed', unit: '' },
        ],
        steps: [
          { label: 'Cirkelbue', formel: 'V = √((h + I)·R / C), C = 11,8', indsat: 'I = 100 mm (normal) / 130–153 mm (undtagelse)', resultat: 'V for buen' },
          { label: 'Overgangskurve – dh/dt', formel: 'Δh·V/(3,6·L) ≤ dh/dt', indsat: 'dh/dt = 50 / 70 mm/s (formel 25/26a)', resultat: 'V for rampen' },
          { label: 'Overgangskurve – dI/dt', formel: 'ΔI(V)·V/(3,6·L) ≤ dI/dt', indsat: 'dI/dt = 55 / 90 mm/s (formel 15a/18)', resultat: 'V for overgangen' },
          { label: 'Spring uden overgangskurve', formel: 'ΔI·V/(3,6·20) ≤ fiktivt ryk; ΔI ≤ 125 mm', indsat: p.klasse === 'oevrige' ? '71 mm/s (formel 17)' : '28 / 135 mm/s (formel 15/20)', resultat: 'V ved springet' },
          { label: 'Kurvegruppe', formel: 'min(V) for overgang + bue + overgang, rundet ned til 5 km/t', indsat: `≤ ${p.V} km/t`, resultat: `laveste ${vTekst(Vmin)} km/t` },
        ],
        checks: a.filter((x) => x.e.type !== 'ret').map((x) => ({
          label: `${x.nr}. ${TYPE_TEKST[x.e.type]} km ${kmTekst(x.e.km0)}`,
          value: `V ${vTekst(x.VtN)} km/t`,
          graense: x.begraensning,
          status: x.status,
          kilde: 'Sporregler 2.03–2.06',
        })),
        noter: [
          'Grænseværdier efter Sporregler (rettelsesblade til 01.05.2017), afsnit 2.03–2.06 og tillæg 2C – se «Regler og grænser».',
          'Hastigheden gælder hele kurvegruppen (indløbsovergang, bue, udløbsovergang). Ret spor begrænses kun af strækningshastigheden.',
          'Profilet tager ikke hensyn til sporskifter, perroner, overkørsler, lodrette kurver, sigt eller signaler.',
        ],
        refs: ['SR87', 'ST16', 'EN13803'],
        figur: fig,
        sider: [`<h2>Elementer og parametre</h2>${tabelHtml(a, false)}`, ...tilslutningSider],
      });
    };

    /* ------------------------------ tilslutning og tracétavler ------------------------------ */
    let tilslutningSider: string[] = [];
    const tTxt = (t: TavleRaekke['ny']) => t;
    void tTxt;
    const tavleCelle = (r: TavleRaekke, f: 'symbol' | 'rad' | 'okl' | 'kvl' | 'ovh' | 'rpl') => {
      const n = r.ny ? String(r.ny[f] ?? '') : '', g = r.gammel ? String(r.gammel[f] ?? '') : '';
      if (r.status === 'rettes' && r.aendret.includes(f)) return `<span class="pj-gl">${esc(g || '–')}</span> → <b class="pj-nyv">${esc(n || '–')}</b>`;
      if (!r.ny) return `<span class="pj-gl">${esc(g)}</span>`;
      return esc(n);
    };
    const tavleTabel = (rk: TavleRaekke[], rapport: boolean) => `
      <table class="${rapport ? 'rpt-tbl' : 'tbl'} pj-tv">
        <thead><tr><th>Status</th><th>Km</th><th>Symbol</th><th>Rad</th><th>Okl</th><th>Kvl</th><th>Ovh</th><th>Rpl</th><th>Punkt</th></tr></thead>
        <tbody>${rk.map((r) => {
          const t = r.ny ?? r.gammel!;
          return `<tr class="pj-tv-${r.status}"><td><span class="pj-tst pj-tst-${r.status}">${TAVLE_STATUS_TEKST[r.status]}</span>${(r.ny?.kant || r.gammel?.kant) ? ' <span class="pj-adv" title="Tavlen hører til et element, der er afskåret af datasættets start/slut – Kvl/Okl kan være ufuldstændig">⚠ kant</span>' : ''}</td>
            <td>${kmTekst(r.km, 1)}</td><td class="pj-sym">${tavleCelle(r, 'symbol')}</td><td>${tavleCelle(r, 'rad')}</td><td>${tavleCelle(r, 'okl')}</td><td>${tavleCelle(r, 'kvl')}</td><td>${tavleCelle(r, 'ovh')}</td><td>${tavleCelle(r, 'rpl')}</td><td><small>${esc(t.punkt)}</small></td></tr>`;
        }).join('')}</tbody>
      </table>`;
    const punktHtml = (k: PunktKontrol, rapport: boolean) => {
      const tl = (x: PunktKontrol['eks']) => (x ? `${TYPE_TEKST[x.e.type]} · R ${rTekst(x.R)} · h ${fmt(x.h)} mm${x.inde ? ' · <b>inde i elementet</b>' : ''}` : '–');
      return `<div class="pj-punkt">
        <h4>${k.navn} · km ${kmTekst(k.km, 3)} ${chip(k.status)}</h4>
        <table class="${rapport ? 'rpt-tbl' : 'tbl tbl-kv'}"><tbody>
          <tr><td>Eksisterende spor</td><td>${tl(k.eks)}</td></tr>
          <tr><td>Projekteret spor</td><td>${tl(k.proj)}</td></tr>
          ${k.Vmax ? `<tr><td>Største V ved springet</td><td>${vTekst(Math.floor(k.Vmax.n / 5) * 5)} / ${vTekst(Math.floor(k.Vmax.u / 5) * 5)} km/t (normal / undt.)</td></tr>` : ''}
        </tbody></table>
        <table class="${rapport ? 'rpt-tbl' : 'tbl'}"><thead><tr><th>Kontrol</th><th>Værdi</th><th>Grænse</th><th></th></tr></thead><tbody>
          ${k.checks.map((c) => `<tr><td>${esc(c.label)}<br/><small>${esc(c.kilde)}</small></td><td>${esc(c.value)}</td><td>${esc(c.graense)}</td><td>${chip(c.status)}</td></tr>`).join('')}
        </tbody></table>
        ${k.noter.length ? `<div class="notice">${k.noter.map((n) => `• ${esc(n)}`).join('<br/>')}</div>` : ''}
      </div>`;
    };

    const renderTilslutning = (s: Settings) => {
      tilslutningSider = [];
      tOut.innerHTML = '';
      const eksD = p.data.eksisterende, projD = p.data.projekteret;
      if (!eksD && !projD) { tCard.hidden = true; return; }
      tCard.hidden = false;
      const tl = tilslutning();
      const klasse = p.klasse ?? 'hovedspor';
      let raekker: TavleRaekke[];
      let punkter: PunktKontrol[] = [];
      let adv: string[] = [];
      if (eksD && projD && tl) {
        const kmFelt = (label: string, key: keyof TilslutningInput, hint: string) => {
          const i = h('input', { type: 'text', value: kmTekst(tl[key], 3) });
          i.addEventListener('change', () => {
            const v = parseKm(i.value, 'm');
            if (Number.isFinite(v)) { p.tilslutning = { ...tl, ...(p.tilslutning ?? {}), [key]: v }; if (key === 'slutProj' && !p.tilslutning.slutEks) p.tilslutning.slutEks = v; gem(); update(); }
          });
          return h('label', { class: 'ed-f' }, h('span', {}, label), h('div', { class: 'ed-inp' }, i), h('small', { class: 'tp-norm' }, hint));
        };
        tOut.append(h('div', { class: 'ed-fields pj-tl' },
          kmFelt('Projektstart (tilslutning)', 'start', 'fælles stationering'),
          kmFelt('Projektslut – projektets km', 'slutProj', 'i geometrirapporten'),
          kmFelt('Projektslut – eksisterende km', 'slutEks', `km-spring ${fmt(tl.slutEks - tl.slutProj, 3)} m`),
        ));
        const sam = samletSpor(eksD.elementer, projD.elementer, tl);
        const aS = analyser(sam, { V: p.V, Vmin: p.Vmin, vurderVed, klasse }, s);
        const vVed = (km: number) => vurderVed === 'straekning' ? p.V : (aS.find((x) => km >= x.e.km0 - 1e-3 && km <= x.e.km1 + 1e-3)?.VtN ?? p.V);
        punkter = [
          kontrolPunkt('Projektstart', tl.start, tilstandVed(eksD.elementer, tl.start, 'foer'), tilstandVed(projD.elementer, tl.start, 'efter'), vVed(tl.start), klasse, { ind: 'eks', ud: 'proj' }),
          kontrolPunkt('Projektslut', tl.slutProj, tilstandVed(projD.elementer, tl.slutProj, 'foer'), tilstandVed(eksD.elementer, tl.slutEks, 'efter'), vVed(tl.slutProj), klasse, { ind: 'proj', ud: 'eks' }),
        ];
        const gamle = tavlerFraElementer(eksD.elementer);
        const nye = tavlerFraElementer(sam);
        raekker = sammenlignTavler(nye.tavler, gamle.tavler, tl);
        adv = nye.advarsler;
      } else {
        const d = (eksD ?? projD)!;
        const r = tavlerFraElementer(d.elementer);
        raekker = r.tavler.map((t) => ({ status: 'ny' as const, km: t.km, ny: t, aendret: [] }));
        adv = r.advarsler;
        tOut.append(h('p', { class: 'tip pj-tip0' }, `Tavler for ${eksD ? DATA_TEKST.eksisterende : DATA_TEKST.projekteret}. Indlæs begge datasæt for at kontrollere tilslutningspunkterne og se, hvilke tavler uden for projektet der skal rettes.`));
      }
      const antal = (st: TavleRaekke['status']) => raekker.filter((r) => r.status === st).length;
      const vis = raekker.filter((r) => visUaendrede || r.status !== 'uaendret');
      const box = h('div', {});
      box.innerHTML = `
        ${punkter.length ? `<h3>Kontrol i tilslutningspunkterne</h3><div class="two">${punkter.map((k) => punktHtml(k, false)).join('')}</div>` : ''}
        <h3>Tracétavler</h3>
        <div class="pj-tchips">
          ${(['ny', 'rettes', 'ny-udenfor', 'fjernes-udenfor', 'udgaar', 'uaendret'] as const).filter((x) => antal(x)).map((x) => `<span class="pj-tst pj-tst-${x}">${TAVLE_STATUS_TEKST[x]}: ${antal(x)}</span>`).join('')}
        </div>
        ${antal('rettes') + antal('ny-udenfor') + antal('fjernes-udenfor') ? `<div class="notice"><b>Uden for projektets grænser:</b> ${antal('rettes')} tavle(r) skal rettes${antal('ny-udenfor') ? `, ${antal('ny-udenfor')} skal opsættes` : ''}${antal('fjernes-udenfor') ? `, ${antal('fjernes-udenfor')} skal fjernes` : ''} – typisk K-tavlen i den anden ende af en kurve, hvis længde (Kvl) ændres af tilslutningen.</div>` : ''}
        ${adv.length ? `<div class="notice">${adv.slice(0, 6).map((a) => `• ${esc(a)}`).join('<br/>')}</div>` : ''}
        <div class="pj-tbl">${tavleTabel(vis, false)}</div>
        <p class="tip">Tavlerne følger BN2-93 afsn. 10: 0-tavle ved overgangskurvens begyndelse/ende med nul overhøjde (Rad, Okl, Ovh), K-tavle mellem overgangskurve og cirkelbue (Rad, Kvl, Okl). Rampe og overgangskurve antages sammenfaldende. Tavler uden for projektet sammenlignes med de eksisterende ved samme km (± 0,5 m). Opsætningstolerance 0,3 m.</p>`;
      const knapper = h('div', { class: 'pj-knapper' });
      const b1 = h('button', { type: 'button', class: 'btn-ghost btn-sm' }, visUaendrede ? 'Skjul uændrede tavler' : `Vis uændrede tavler (${antal('uaendret')})`);
      b1.addEventListener('click', () => { visUaendrede = !visUaendrede; update(); });
      const b2 = h('button', { type: 'button', class: 'btn-ghost btn-sm' }, 'Hent tavleliste (CSV)');
      b2.addEventListener('click', () => download(`tracetavler-${(p.navn || 'projekt').replace(/[^\wæøåÆØÅ-]+/g, '_')}.csv`, '\ufeff' + tavlerCsv(raekker), 'text/csv'));
      knapper.append(b1, b2);
      tOut.append(box, knapper);
      tilslutningSider = [
        `<h2>Tilslutning og tracétavler</h2>${punkter.map((k) => punktHtml(k, true)).join('')}
         <h3>Tracétavler (BN2-93)</h3>${tavleTabel(raekker.filter((r) => r.status !== 'uaendret'), true)}
         <p>Uændrede tavler uden for projektet: ${antal('uaendret')}.</p>`,
      ];
    };

    const tabelHtml = (a: ElementAnalyse[], klik: boolean) => `
      <table class="${klik ? 'tbl' : 'rpt-tbl'} pj-t">
        <thead><tr><th>Nr</th><th>Type</th><th>Km start</th><th>L [m]</th><th>R [m]</th><th>h [mm]</th><th>V tilladt<br/><small>normal / undt.</small></th><th>Bestemt af</th><th>I / dI/dt</th><th>dh/dt</th><th>Status</th></tr></thead>
        <tbody>${a.map((x, i) => {
          const I = x.vaerdier.find((v) => v.symbol === 'I'), dIdt = x.vaerdier.find((v) => v.symbol === 'dI/dt'), dhdt = x.vaerdier.find((v) => v.symbol === 'dh/dt');
          const R = x.e.type === 'overgang' ? `${rTekst(x.e.R0)} → ${rTekst(x.e.R1)}` : rTekst(x.e.R0);
          const hh = x.e.h0 === x.e.h1 ? fmt(x.e.h0) : `${fmt(x.e.h0)} → ${fmt(x.e.h1)}`;
          const iv = I ? `${fmt(I.v)} mm` : dIdt ? `${fmt(dIdt.v, 1)} mm/s` : '';
          return `<tr${klik ? ` data-i="${i}"` : ''} class="pj-r-${x.e.type}${valgt === i && klik ? ' pj-valgt' : ''}">
            <td>${x.nr}</td><td>${TYPE_TEKST[x.e.type]}</td><td>${kmTekst(x.e.km0, 1)}</td><td>${fmt(x.e.L, 1)}</td><td>${R}</td><td>${hh}</td>
            <td><b>${vTekst(x.VtN)}</b> / ${vTekst(x.VtU)}${x.e.V && x.e.V > x.VtN ? ` <span class="pj-adv" title="Hastigheden i listen er højere">(${x.e.V})</span>` : ''}</td>
            <td>${x.e.type === 'ret' ? '' : esc(x.begraensning)}</td><td>${iv}</td><td>${dhdt ? `${fmt(dhdt.v, 1)}` : ''}</td><td>${x.e.type === 'ret' && !x.vaerdier.length ? '' : chip(x.status)}</td></tr>`;
        }).join('')}</tbody>
      </table>`;

    const detalje = (x: ElementAnalyse, a: ElementAnalyse[]): HTMLElement => {
      const e = x.e;
      const box = h('div', { class: 'pj-det' });
      box.innerHTML = `
        <h3>Element ${x.nr} · ${TYPE_TEKST[e.type]} · km ${kmTekst(e.km0, 3)} – ${kmTekst(e.km1, 3)}</h3>
        <div class="two">
          <div>
            <table class="tbl tbl-kv"><tbody>
              <tr><td>Længde L</td><td>${fmt(e.L, 3)} m</td></tr>
              <tr><td>Radius</td><td>${e.type === 'overgang' ? `${rTekst(e.R0)} → ${rTekst(e.R1)}` : rTekst(e.R0)} m</td></tr>
              <tr><td>Overhøjde</td><td>${e.h0 === e.h1 ? fmt(e.h0) : `${fmt(e.h0)} → ${fmt(e.h1)}`} mm</td></tr>
              ${e.A ? `<tr><td>Klotoideparameter A</td><td>${fmt(e.A, 1)} m</td></tr>` : ''}
              ${e.V ? `<tr><td>Hastighed i listen</td><td>${e.V} km/t</td></tr>` : ''}
              ${e.tekst ? `<tr><td>Bemærkning</td><td>${esc(e.tekst)}</td></tr>` : ''}
              <tr><td><b>Tilladt V (gruppe)</b></td><td><b>${vTekst(x.VtN)}</b> / ${vTekst(x.VtU)} km/t</td></tr>
              <tr><td>Bestemt af</td><td>${esc(x.begraensning)}</td></tr>
            </tbody></table>
          </div>
          <div>
            <table class="tbl"><thead><tr><th>Kriterium</th><th>V normal</th><th>V undt.</th></tr></thead><tbody>
              ${x.kriterier.length ? x.kriterier.map((k) => `<tr><td>${k.navn}<br/><small>${k.formel}</small></td><td>${vTekst(k.Vn)}</td><td>${vTekst(k.Vu)}</td></tr>`).join('') : '<tr><td colspan="3">Ret spor – kun strækningshastigheden</td></tr>'}
            </tbody></table>
          </div>
        </div>
        ${x.vaerdier.length ? `<h3>Parametre ved V = ${vTekst(x.Veval)} km/t</h3>
        <table class="tbl"><thead><tr><th>Parameter</th><th>Værdi</th><th>Grænse (normal / undt.)</th><th></th></tr></thead><tbody>
          ${x.vaerdier.map((v) => `<tr><td>${v.label} <small>${v.symbol}${v.formel ? ` = ${v.formel}` : ''}</small></td><td>${Number.isFinite(v.v) ? `${fmt(v.v, v.d)} ${v.unit}` : v.unit}</td><td>${v.graense ?? ''}</td><td>${v.status ? chip(v.status) : ''}</td></tr>`).join('')}
        </tbody></table>` : ''}`;
      const knapper = h('div', { class: 'pj-knapper' });
      const aabn = (t: string, f: () => void) => { const b = h('button', { type: 'button', class: 'btn-ghost btn-sm' }, t); b.addEventListener('click', f); knapper.append(b); };
      if (e.type === 'kurve') aabn('Åbn i Overhøjde', () => { saveState('overhoejde', { R: Math.abs(e.R0), V: x.VtN || p.V, Vmin: p.Vmin, h: e.h0 }); location.hash = 'overhoejde'; });
      if (e.type === 'overgang') {
        const curveR = e.R1 || e.R0, curveH = e.R1 ? e.h1 : e.h0, otherR = e.R1 ? e.R0 : e.R1, otherH = e.R1 ? e.h0 : e.h1;
        aabn('Åbn i Overgangskurve', () => { saveState('overgangskurve2', { V: x.VtN || p.V, R1: Math.abs(otherR), h1: otherH, R: Math.abs(curveR), h: curveH, L: Math.round(e.L) }); location.hash = 'overgangskurve'; });
      }
      const forr = h('button', { type: 'button', class: 'btn-ghost btn-sm' }, '← Forrige');
      forr.addEventListener('click', () => { valgt = Math.max(0, x.nr - 2); update(); });
      const naeste = h('button', { type: 'button', class: 'btn-ghost btn-sm' }, 'Næste →');
      naeste.addEventListener('click', () => { valgt = Math.min(a.length - 1, x.nr); update(); });
      knapper.prepend(forr, naeste);
      box.append(knapper);
      return box;
    };

    renderLeft();
    root.append(h('div', { class: 'grid' }, card('Projekt', left, 'card-input card-scroll'), card('Hastighedsprofil', out, 'card-out')), elCard, tCard);
    update();
  },
};
