import {
  tsiCantMax, TSI_CANT_PERRON, tsiCantInService, tsiCantDeficiency, TSI_CANT_DEFICIENCY_WAG, tsiAbruptChange,
  tsiTrackCentres, tsiGaugeIal, tsiConicity, TSI_R_MIN, TSI_RV_MIN, TSI_GRADIENT, TSI_RAIL_INCLINATION, TSI_SC,
  TSI_PERRON_HOEJDER, TSI_PERRON_HOEJDE_STOG, TSI_PERRON_R_MIN, TSI_PERRON_BQ_TOL, TSI_PERRON_LAENGDE, tsiCantSmallRadius,
  tsiStatus, TSI_KILDE,
} from '../core/tsi';
import { loadSettings } from '../core/rules';
import { setReport } from '../core/report';
import { card, fmt, form, h, loadState, results, saveState, tsiBlock, type Module } from '../ui/dom';

type S = { V: number; R: number; I1: number; I2: number };
const DEF: S = { V: 160, R: 0, I1: 60, I2: 0 };

export const tsi: Module = {
  id: 'tsi',
  gruppe: 'Grundlag',
  titel: 'TSI INF',
  kort: 'TSI INF',
  ikon: '★',
  beskrivelse: 'Grænseværdier fra TSI for infrastruktur, forordning (EU) nr. 1299/2014 (konsolideret 28.09.2023), slået op efter hastighed.',
  render(root) {
    const st = loadState<S>('tsi', DEF);
    const out = h('div', { class: 'out' });
    const update = () => {
      saveState('tsi', st);
      const set = loadSettings();
      const V = st.V;
      const ac = tsiAbruptChange(V, st.I1, st.I2);
      const dI = Math.abs(st.I1 - st.I2);
      const tc = tsiTrackCentres(V);
      const g = tsiGaugeIal(V);
      const con = tsiConicity(V);
      const hMax = tsiCantMax(set.tsiTrafik, set.tsiSpor);
      const rows = [
        { label: 'Pludselig ændring af overhøjdeunderskud', value: `${fmt(dI)} mm`, graense: `≤ ${ac} mm`, status: tsiStatus(dI <= ac), kilde: `${TSI_KILDE} 4.2.4.4` },
        ...(st.R > 0 && st.R < 305 ? [{ label: 'Største overhøjde ved R < 305 m (nye, blandet/gods)', value: `R = ${fmt(st.R)} m`, graense: `≤ ${fmt(tsiCantSmallRadius(st.R))} mm`, status: 'ok' as const, kilde: `${TSI_KILDE} 4.2.4.2(3)` }] : []),
      ];

      out.innerHTML = `
        <div class="notice"><strong>Kilde:</strong> Kommissionens forordning (EU) nr. 1299/2014 (TSI INF), konsolideret udgave 28.09.2023, bilag afsnit 4.2 og 7.7.4. Værdier for sporvidde 1 435 mm. Krav til «nye strækninger» gælder ved nyanlæg; for opgradering/fornyelse se TSI afsnit 7.3.</div>
        <h3>Ved V = ${V} km/t</h3>
        ${results([
          { symbol: 'h', label: 'Projekteret overhøjde (tabel 7)', value: `≤ ${hMax}`, unit: 'mm', sub: `${set.tsiTrafik === 'person' ? 'persontrafik' : 'blandet/gods'}, ${set.tsiSpor === 'ballast' ? 'ballasteret' : 'fast'} spor · ved perron ≤ ${TSI_CANT_PERRON} mm` },
          { symbol: 'I', label: 'Overhøjdeunderskud (tabel 8)', value: `≤ ${tsiCantDeficiency(V)}`, unit: 'mm', sub: `LOC&PAS${V <= 160 ? ` · godsvogne (WAG) ≤ ${TSI_CANT_DEFICIENCY_WAG} mm` : ''}` },
          { symbol: 'ΔI', label: 'Pludselig ændring af I (4.2.4.4)', value: `≤ ${tsiAbruptChange(V)}`, unit: 'mm', sub: 'fx i sporskifter uden overgangskurve' },
          { symbol: 'a', label: 'Sporafstand, nye strækninger (tabel 4)', value: tc !== null ? `≥ ${fmt(tc, 2)}` : 'Ikke fastsat', unit: tc !== null ? 'm' : '', sub: 'V ≤ 160: efter installationsgrænse (EN 15273-3 afsn. 9)' },
          { symbol: 'G', label: 'Sporvidde, øjeblikkeligt indgreb (tabel 12)', value: `${fmt(g.min)} – ${fmt(g.max)}`, unit: 'mm' },
          { symbol: 'λ', label: 'Ækvivalent konicitet, projektering (tabel 10)', value: con !== null ? `≤ ${fmt(con, 2)}` : 'Ikke krævet', unit: '' },
          { symbol: 'h<sub>drift</sub>', label: 'Overhøjde i drift (4.2.8.5)', value: `≤ ${tsiCantInService(set.tsiTrafik)}`, unit: 'mm', sub: '190 mm kun på rene passagerbaner' },
          { symbol: '1:n', label: 'Skinnehældning (4.2.4.7)', value: V > TSI_RAIL_INCLINATION.fraV ? `1:${TSI_RAIL_INCLINATION.min} – 1:${TSI_RAIL_INCLINATION.max}` : 'Ikke krævet', unit: '', sub: 'Banedanmark: 1:40' },
        ])}
        ${tsiBlock(rows, 'Pludselig ændring: indtast overhøjdeunderskud før og efter en krumningsændring uden overgangskurve. Ved V ≤ 40 km/t og I ≤ 75 mm på begge sider tillades 150 mm.')}

        <h3>Linjeføring og længdeprofil (4.2.3)</h3>
        <table class="tbl tbl-kv"><tbody>
          <tr><td>Mindste vandrette radius, nye strækninger</td><td>${TSI_R_MIN} m (4.2.3.4(1))</td></tr>
          <tr><td>Modvendte kurver med små radier</td><td>Mellemliggende retlinje efter EN 13803 tabel N.1/N.2, så bufferlåsning undgås (4.2.3.4(2))</td></tr>
          <tr><td>Mindste lodrette radius</td><td>${TSI_RV_MIN.top} m i top · ${TSI_RV_MIN.lavning} m i lavning (pukler: ${TSI_RV_MIN.pukkelTop}/${TSI_RV_MIN.pukkelLavning} m) (4.2.3.5)</td></tr>
          <tr><td>Hældning ved perroner / opstillingsspor (nye)</td><td>≤ ${fmt(TSI_GRADIENT.perron, 1)} mm/m (4.2.3.3(1)–(2))</td></tr>
          <tr><td>Hældning på nye P1-strækninger</td><td>≤ ${TSI_GRADIENT.p1Maks} mm/m, gennemsnit over 10 km ≤ ${TSI_GRADIENT.p1Middel10km} mm/m, højst ${TSI_GRADIENT.p1MaksLaengde} km sammenhængende (4.2.3.3(3))</td></tr>
          <tr><td>Nominel sporvidde</td><td>1 435 mm (4.2.4.1)</td></tr>
        </tbody></table>

        <h3>Perroner (4.2.9)</h3>
        <table class="tbl tbl-kv"><tbody>
          <tr><td>Nominel perronhøjde</td><td>${TSI_PERRON_HOEJDER.join(' eller ')} mm ved R ≥ ${TSI_PERRON_R_MIN} m; Danmark, S-tog: ${TSI_PERRON_HOEJDE_STOG} mm (7.7.4.1)</td></tr>
          <tr><td>Perronafstand</td><td>bq<sub>lim</sub> ≤ bq ≤ bq<sub>lim</sub> + ${TSI_PERRON_BQ_TOL} mm, bq<sub>lim</sub> for profil G1 (4.2.9.3)</td></tr>
          <tr><td>Spor langs nye perroner</td><td>Helst ret, aldrig R < ${TSI_PERRON_R_MIN} m (4.2.9.4)</td></tr>
          <tr><td>Overhøjde ved perroner</td><td>≤ ${TSI_CANT_PERRON} mm (4.2.4.2(2))</td></tr>
        </tbody></table>
        <table class="tbl tbl-mini"><thead><tr><th>Trafikkode</th><th>Hastighed [km/t]</th><th>Anvendelig perronlængde [m]</th></tr></thead>
          <tbody>${TSI_PERRON_LAENGDE.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</tbody></table>

        <h3>Sporskifter og krydsninger i drift (4.2.8.6)</h3>
        <table class="tbl tbl-kv"><tbody>
          <tr><td>Fri hjulpassage i sporskifte</td><td>≤ ${fmt(TSI_SC.friHjulpassageSporskifte)} mm</td></tr>
          <tr><td>Hjertestykkebeskyttelse (faste hjertestykker)</td><td>≥ ${fmt(TSI_SC.hjertestykkebeskyttelse)} mm</td></tr>
          <tr><td>Fri hjulpassage ved hjertespids</td><td>≤ ${fmt(TSI_SC.friHjulpassageHjertespids)} mm</td></tr>
          <tr><td>Fri hjulpassage ved tvang-/vingeskinneindløb</td><td>≤ ${fmt(TSI_SC.friHjulpassageTvangskinne)} mm</td></tr>
          <tr><td>Rillebredde / rilledybde</td><td>≥ ${TSI_SC.rilleBreddeMin} mm / ≥ ${TSI_SC.rilleDybdeMin} mm</td></tr>
          <tr><td>Højde af tvangskinne</td><td>≤ ${TSI_SC.tvangskinneHoejdeMax} mm</td></tr>
        </tbody></table>
      `;
      setReport({
        modul: 'TSI INF – grænseværdier',
        inputs: [
          { label: 'Hastighed', symbol: 'V', value: fmt(V), unit: 'km/t' },
          { label: 'Overhøjdeunderskud før / efter', symbol: 'I₁ / I₂', value: `${fmt(st.I1)} / ${fmt(st.I2)}`, unit: 'mm' },
          { label: 'Trafik / spor', symbol: '', value: `${set.tsiTrafik === 'person' ? 'Persontrafik' : 'Blandet/gods'} / ${set.tsiSpor === 'ballast' ? 'ballasteret' : 'fast'}`, unit: '' },
        ],
        steps: [
          { label: 'Projekteret overhøjde', formel: '4.2.4.2, tabel 7', indsat: '', resultat: `≤ ${hMax} mm (perron ≤ ${TSI_CANT_PERRON} mm)` },
          { label: 'Overhøjdeunderskud', formel: '4.2.4.3, tabel 8', indsat: `V = ${V}`, resultat: `≤ ${tsiCantDeficiency(V)} mm` },
          { label: 'Pludselig ændring af I', formel: '4.2.4.4', indsat: `|${st.I1} − ${st.I2}|`, resultat: `${fmt(dI)} mm ≤ ${ac} mm` },
          { label: 'Sporafstand (nye)', formel: '4.2.3.2, tabel 4', indsat: `V = ${V}`, resultat: tc !== null ? `≥ ${fmt(tc, 2)} m` : 'ikke fastsat' },
          { label: 'Sporvidde IAL', formel: '4.2.8.4, tabel 12', indsat: `V = ${V}`, resultat: `${g.min}–${g.max} mm` },
          { label: 'Ækvivalent konicitet', formel: '4.2.4.5, tabel 10', indsat: `V = ${V}`, resultat: con !== null ? `≤ ${fmt(con, 2)}` : 'ikke krævet' },
          { label: 'Overhøjde i drift', formel: '4.2.8.5', indsat: '', resultat: `≤ ${tsiCantInService(set.tsiTrafik)} mm` },
          { label: 'Lodret radius', formel: '4.2.3.5', indsat: '', resultat: `≥ ${TSI_RV_MIN.top} m (top) / ${TSI_RV_MIN.lavning} m (lavning)` },
          { label: 'Vandret radius (nye)', formel: '4.2.3.4', indsat: '', resultat: `≥ ${TSI_R_MIN} m` },
          { label: 'Perronhøjde', formel: '4.2.9.2 / 7.7.4.1', indsat: '', resultat: `${TSI_PERRON_HOEJDER.join('/')} mm (S-tog ${TSI_PERRON_HOEJDE_STOG} mm)` },
        ],
        checks: rows.map((r) => ({ ...r, label: `TSI: ${r.label}` })),
        refs: ['TSI-INF', 'EN13803', 'EN13848'],
      });
    };
    const f = form<keyof S>([
      { key: 'V', label: 'Hastighed', symbol: 'V', unit: 'km/t', min: 10, max: 350, step: 5 },
      { key: 'R', label: 'Radius (0 = ikke relevant)', symbol: 'R', unit: 'm', min: 0, max: 5000, step: 10 },
      { key: 'I1', label: 'Overhøjdeunderskud før', symbol: 'I₁', unit: 'mm', min: 0, max: 200, step: 5 },
      { key: 'I2', label: 'Overhøjdeunderskud efter', symbol: 'I₂', unit: 'mm', min: 0, max: 200, step: 5 },
    ], st, update);
    root.append(h('div', { class: 'grid' }, card('Input', f, 'card-input'), card('TSI INF', out, 'card-out')));
    update();
  },
};
