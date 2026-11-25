import { SVELLER, SKINNE_60E2, TVAERPROFIL, SVELLEAFSTAND, MELLEMLAEG_DMP, type SvelleType } from '../core/overbygning';
import { setReport } from '../core/report';
import { trackCrossSection, railDetail, planView } from '../ui/track';
import { card, fmt, form, h, loadState, saveState, select, type Module } from '../ui/dom';

export const overbygning: Module = {
  id: 'overbygning',
  gruppe: 'Overbygning',
  titel: 'Svelle og tværprofil',
  kort: 'Svelle',
  ikon: '▭',
  beskrivelse: 'Tegning af Banedanmarks standardoverbygning: S99/S16-svelle, 60E2-skinne med hældning 1:40, Fastclip og ballastprofil.',
  render(root) {
    const st = loadState<{ h: number; V: number }>('overbygning', { h: 100, V: 180 });
    const opt = loadState<{ svelle: string }>('overbygning-opt', { svelle: 'S99' });
    const out = h('div', { class: 'out' });
    const update = () => {
      saveState('overbygning', st);
      saveState('overbygning-opt', opt);
      const sv = SVELLER[opt.svelle as SvelleType];
      const fig = trackCrossSection({ svelle: sv.id, h: st.h, V: st.V });
      const rows: [string, string][] = [
        ['Overbygning', sv.overbygning], ['Befæstelse', sv.befaestelse],
        ['Højde', `${sv.hoejde} mm`], ['Bredde', `${sv.bredde} mm`], ['Længde', `${fmt(sv.laengde)} mm`],
        ['Vægt', `ca. ${sv.vaegt} kg`], ['Armering', sv.armering], ['Hastighed', sv.hastighed], ['Aksellast', sv.aksellast],
        ['Nominel sporvidde', `${fmt(sv.sporvidde)} mm`], ['Svelleafstand', `${SVELLEAFSTAND} mm c/c (hoved-, regional- og S-baner)`],
        ['Skinne', `60E2 · ${SKINNE_60E2.hoejde} mm høj · fod ${SKINNE_60E2.fod} mm · hoved ${SKINNE_60E2.hoved} mm · ca. 60 kg/m`],
        ['Skinnehældning', `1:${SKINNE_60E2.haeldning}`],
        ...(sv.id === 'S99' ? [['Mellemlæg (Dmp)', `${MELLEMLAEG_DMP.haard}; ${MELLEMLAEG_DMP.bloed}`] as [string, string]] : []),
      ];
      out.innerHTML = `
        <h3 style="margin-top:0">Tværprofil – ${sv.navn}</h3>
        ${fig}
        <div class="two">
          <div><h3>Detalje A – skinneunderstøtning</h3>${railDetail(sv.id)}</div>
          <div><h3>Plan – svelleafstand</h3>${planView(sv.id)}</div>
        </div>
        <h3>Data</h3>
        <table class="tbl tbl-kv"><tbody>${rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</tbody></table>
        <h3>Tværprofil (eksempel)</h3>
        <table class="tbl tbl-kv"><tbody>
          <tr><td>Ballastskulder B<sub>sk</sub></td><td>${TVAERPROFIL.skulder} mm</td></tr>
          <tr><td>Ballastskråning</td><td>1:${fmt(TVAERPROFIL.anlaeg, 1)}</td></tr>
          <tr><td>Ballasttykkelse B<sub>t</sub> under svelle</td><td>${TVAERPROFIL.ballast} mm</td></tr>
          <tr><td>Underballast U<sub>t</sub></td><td>${TVAERPROFIL.underballast} mm</td></tr>
          <tr><td>Planumhældning</td><td>${fmt(TVAERPROFIL.planumHaeldning * 1000)} ‰</td></tr>
          <tr><td>V > 160 km/t</td><td>Ballast mellem skinnerne sænkes ${TVAERPROFIL.saenkningV160} mm under svelleoverkant</td></tr>
        </tbody></table>
        <p class="tip">Mål iht. Sporteknik (2016): svelle s. 83–84, Fastclip s. 30 og 41–42, tværprofil s. 32 (eksempel for nyanlæg af hovedspor 160 &lt; V ≤ 200 km/t; gældende krav i BN1-6), svelleafstand s. 159. Skinneprofilet er tegnet skematisk ud fra hovedmålene.</p>
      `;
      setReport({
        modul: 'Svelle og tværprofil',
        inputs: [
          { label: 'Svelletype', symbol: '', value: sv.navn, unit: '' },
          { label: 'Overhøjde i tegning', symbol: 'h', value: fmt(st.h), unit: 'mm' },
          { label: 'Hastighed', symbol: 'V', value: fmt(st.V), unit: 'km/t' },
        ],
        steps: [
          { label: 'Hældning af svelle', formel: 'θ = arcsin(h/e)', indsat: `arcsin(${st.h}/1500)`, resultat: `${fmt((Math.asin(st.h / 1500) * 180) / Math.PI, 2)}°` },
          ...rows.map(([k, v]) => ({ label: k, formel: '', indsat: '', resultat: v })),
        ],
        checks: [],
        refs: ['ST16', 'BN1-6', 'BN1-66', 'EN13674', 'EN13230'],
        figur: fig + railDetail(sv.id),
      });
    };
    const f = form<'h' | 'V'>([
      { key: 'h', label: 'Overhøjde', symbol: 'h', unit: 'mm', min: 0, max: 180, step: 5 },
      { key: 'V', label: 'Hastighed', symbol: 'V', unit: 'km/t', min: 10, max: 250, step: 10, hint: 'Over 160 km/t vises sænket ballast mellem skinnerne.' },
    ], st, update);
    f.prepend(select('Svelletype', 'svelle', [['S99', 'S99 – UIC60 Dmp (Fastclip FC)'], ['S16', 'S16 – UIC60 Dme (Fastclip FE)']], opt, update));
    root.append(h('div', { class: 'grid' }, card('Input', f, 'card-input'), card('Tegning', out, 'card-out')));
    update();
  },
};
