import {
  SVELLER, TVAERPROFIL, SVELLEAFSTAND, MELLEMLAEG_DMP, OVERBYGNINGER, SKINNER, SVELLETYPER, afkodBetegnelse,
  type SkinneId,
} from '../core/overbygning';
import { setReport } from '../core/report';
import { projekteretKonicitet, konicitetGraense } from '../core/bn138';
import { trackCrossSection, railDetail, planView, type TegnSpec } from '../ui/track';
import { card, fmt, form, h, loadState, saveState, select, type Module } from '../ui/dom';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export const overbygning: Module = {
  id: 'overbygning',
  gruppe: 'Overbygning',
  titel: 'Overbygningstyper og svelle',
  kort: 'Overbygning',
  ikon: '▭',
  beskrivelse: 'Banedanmarks overbygningstyper (A, B, Bt, C, Cr, Cf, Dt, Db, Dbn, Dm, Dmp, Dme, Dsp) med skinne, svelle og befæstelse efter Sporteknik – tegning, data og afkodning af betegnelser.',
  render(root) {
    const st = loadState<{ h: number; V: number }>('overbygning', { h: 100, V: 180 });
    const opt = loadState<{ type: string; skinne: string; betegnelse: string }>('overbygning-opt2', { type: 'Dmp', skinne: '60E2', betegnelse: 'DSB45 Dbn' });
    const out = h('div', { class: 'out' });
    const left = h('div', {});

    const update = () => {
      saveState('overbygning', st);
      saveState('overbygning-opt2', opt);
      const ob = OVERBYGNINGER.find((t) => t.id === opt.type) ?? OVERBYGNINGER[0];
      if (!ob.skinner.includes(opt.skinne as SkinneId)) opt.skinne = ob.skinner[0];
      const sk = SKINNER[opt.skinne as SkinneId];
      const svs = SVELLETYPER[ob.svelle];
      const spec: TegnSpec = { navn: `${sk.id === '45E2' ? 'DSB45' : sk.id === '60E1' || sk.id === '60E2' ? 'UIC60' : sk.id} ${ob.id}`, svelle: svs, skinne: sk, befType: ob.befType, haeldning: ob.haeldning, befTekst: ob.befaestelse };
      const svelleId = ob.svelle === 'S16' ? 'S16' : 'S99';
      const fig = trackCrossSection({ svelle: svelleId, spec, h: st.h, V: st.V });
      const km = ob.km ? ob.km[0] + ob.km[1] + ob.km[2] : null;
      const kon = sk.hoved === 72 && ob.haeldning === 40 ? projekteretKonicitet(svs.sporvidde as 1435 | 1437, 40) : null;
      const konG = konicitetGraense(st.V);
      const rows: [string, string][] = [
        ['Betegnelse', `${esc(spec.navn)} – varianter: ${ob.varianter.map(esc).join(', ')}`],
        ['Befæstelse', esc(ob.befaestelse)],
        ['Befæstelsesdele', ob.dele.map(esc).join(' · ')],
        ['Svelle', `${esc(svs.navn.split(' 2600')[0])} – ${svs.maal === 'sporteknik' ? `${fmt(svs.laengde)} × ${svs.bredde} × ${svs.hoejde} mm${svs.vaegt ? `, ca. ${svs.vaegt} kg` : ''}` : 'mål ikke angivet i Sporteknik (tegnet skematisk)'}`],
        ['Skinne', `${esc(sk.navn)} (${sk.alias}) · højde ${sk.hoejde} · fod ${sk.fod} · hoved ${sk.hoved} mm · ca. ${sk.vaegt} kg/m`],
        ['Skinnehældning', ob.haeldning ? `1:${ob.haeldning}${ob.haeldning === 20 ? ' (skinnehovedet slibes til 1:40-kontakt)' : ''}` : 'lodret'],
        ['Nominel sporvidde', `${fmt(svs.sporvidde)} mm${ob.svelle === 'TOBLOK' ? ' (RS og SL: 1432 mm)' : ''}`],
        ['Periode', esc(ob.periode)],
        ['Anvendelse', esc(ob.anvendelse)],
        ['Omfang medio 2016', ob.km ? `${fmt(km!)} km – hovedspor ${ob.km[0]}, togvejsspor ${ob.km[1]}, sidespor ${ob.km[2]} (figur 132)` : 'ikke opgjort (ny eller lille type)'],
        ['Normaltegning', esc(ob.blade)],
        ...(ob.id === 'Dmp' ? [['Mellemlæg', `${MELLEMLAEG_DMP.haard}; ${MELLEMLAEG_DMP.bloed}`] as [string, string]] : []),
        ...(kon !== null ? [['Projekteret ækvivalent konicitet', `${fmt(kon, 3)} · grænse ${konG !== null ? `≤ ${fmt(konG, 2)} ved V = ${st.V} km/t ${kon <= konG ? '✓' : '✗'}` : 'ingen (V ≤ 60)'} – BN1-38 tabel 11.5.2`] as [string, string]] : []),
        ['Svelleafstand', `${SVELLEAFSTAND} mm c/c (hoved-, regional- og S-baner)`],
        ['Kilde', `Sporteknik 2. udg. (2016) ${ob.sider}, figur 18, 35, 92 og 132`],
      ];
      const oversigt = OVERBYGNINGER.map((t) => {
        const k = t.km ? t.km[0] + t.km[1] + t.km[2] : null;
        return `<tr class="${t.id === ob.id ? 'pj-valgt' : ''}" data-ob="${t.id}"><td><b>${t.id}</b></td><td>${esc(SVELLETYPER[t.svelle].navn.split(' (')[0].split(' 2600')[0])}</td><td>${esc(t.befaestelse.split(/[;,(]/)[0])}</td><td>${t.haeldning ? `1:${t.haeldning}` : 'lodret'}</td><td>${esc(t.periode)}</td><td>${k !== null ? fmt(k) : '–'}</td></tr>`;
      }).join('');
      const afk = afkodBetegnelse(opt.betegnelse);
      out.innerHTML = `
        <h3 style="margin-top:0">Tværprofil – ${esc(spec.navn)}</h3>
        ${fig}
        <div class="two">
          <div><h3>Detalje – skinneunderstøtning</h3>${railDetail(spec)}</div>
          <div><h3>Plan – svelleafstand</h3>${planView(spec)}</div>
        </div>
        <h3>Data</h3>
        <table class="tbl tbl-kv"><tbody>${rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</tbody></table>
        ${ob.noter.length || svs.note ? `<div class="notice">${[...ob.noter, svs.note, sk.note].map((n) => `• ${esc(n)}`).join('<br/>')}</div>` : ''}
        <h3>Alle overbygningstyper</h3>
        <div class="pj-tbl"><table class="tbl ob-t"><thead><tr><th>Type</th><th>Svelle</th><th>Befæstelse</th><th>Hældning</th><th>Periode</th><th>km 2016</th></tr></thead><tbody>${oversigt}</tbody></table></div>
        <p class="tip">Klik på en række for at vælge typen. Omfang i km medio 2016 for hoved-, togvejs- og sidespor (Sporteknik figur 132); derudover Fast befæstelse 8 km. Mange ældre overbygninger findes stadig, især i sidespor.</p>
        <h3>Afkod en betegnelse</h3>
        <div class="ob-afk">
          ${afk ? `<b>${esc(opt.betegnelse)}</b>: ${afk.skinne ? `${esc(afk.skinne.navn)} · ` : ''}${afk.dele.map(esc).join(' · ')}${afk.type ? ` <small>(type ${afk.type.id})</small>` : ''}` : `<span class="pj-adv">«${esc(opt.betegnelse)}» kunne ikke afkodes – skriv fx «DSB45 Dbn», «UIC60 Crz» eller «UIC60 Dmp».</span>`}
        </div>
        <p class="tip">Systemet (Sporteknik afsn. 3.5, figur 18): skinnetype + befæstelsestype (A spiger, B skruer, C adskilt, D dobbeltelastisk) + små bogstaver for svelle (t træ, b to-blok beton, m monoblok, z azobé, s stål) og befæstelsesart (r ribbeplade/klemplade, f fjederklemme, g gummi, n nylon, p Fastclip FC, e Fastclip FE, l lodret skinne). Tegningerne er skematiske; hovedmål for skinner og sveller er fra Sporteknik.</p>
        <h3>Tværprofil (eksempel)</h3>
        <table class="tbl tbl-kv"><tbody>
          <tr><td>Ballastskulder B<sub>sk</sub></td><td>${TVAERPROFIL.skulder} mm</td></tr>
          <tr><td>Ballastskråning</td><td>1:${fmt(TVAERPROFIL.anlaeg, 1)}</td></tr>
          <tr><td>Ballasttykkelse B<sub>t</sub> under svelle</td><td>${TVAERPROFIL.ballast} mm</td></tr>
          <tr><td>Underballast U<sub>t</sub></td><td>${TVAERPROFIL.underballast} mm</td></tr>
          <tr><td>Planumhældning</td><td>${fmt(TVAERPROFIL.planumHaeldning * 1000)} ‰</td></tr>
          <tr><td>V > 160 km/t</td><td>Ballast mellem skinnerne sænkes ${TVAERPROFIL.saenkningV160} mm under svelleoverkant</td></tr>
        </tbody></table>
        <p class="tip">Gældende krav til tværprofilet: se modulet «Tværprofil (BN1-6)».</p>`;
      out.querySelectorAll<HTMLTableRowElement>('tr[data-ob]').forEach((tr) => tr.addEventListener('click', () => { opt.type = tr.dataset.ob!; renderLeft(); update(); out.scrollIntoView({ block: 'start', behavior: 'smooth' }); }));
      void SVELLER;
      setReport({
        modul: `Overbygning ${spec.navn}`,
        inputs: [
          { label: 'Overbygningstype', symbol: '', value: `${spec.navn} – ${ob.navn}`, unit: '' },
          { label: 'Overhøjde i tegning', symbol: 'h', value: fmt(st.h), unit: 'mm' },
          { label: 'Hastighed', symbol: 'V', value: fmt(st.V), unit: 'km/t' },
        ],
        steps: [
          { label: 'Hældning af svelle', formel: 'θ = arcsin(h/e)', indsat: `arcsin(${st.h}/1500)`, resultat: `${fmt((Math.asin(st.h / 1500) * 180) / Math.PI, 2)}°` },
          ...rows.map(([k, v]) => ({ label: k, formel: '', indsat: '', resultat: v.replace(/<[^>]+>/g, '') })),
        ],
        checks: [],
        noter: [...ob.noter, svs.note],
        refs: ['ST16', 'BN1-6', 'BN1-66', 'BN1-38', 'EN13674', 'EN13230'],
        figur: fig + railDetail(spec),
      });
    };

    const renderLeft = () => {
      left.innerHTML = '';
      const ob = OVERBYGNINGER.find((t) => t.id === opt.type) ?? OVERBYGNINGER[0];
      const f = form<'h' | 'V'>([
        { key: 'h', label: 'Overhøjde', symbol: 'h', unit: 'mm', min: 0, max: 180, step: 5 },
        { key: 'V', label: 'Hastighed', symbol: 'V', unit: 'km/t', min: 10, max: 250, step: 10, hint: 'Over 160 km/t vises sænket ballast mellem skinnerne.' },
      ], st, update);
      const betInp = h('input', { type: 'text', value: opt.betegnelse });
      betInp.addEventListener('input', () => { opt.betegnelse = betInp.value; update(); });
      f.prepend(
        select('Overbygningstype', 'type', OVERBYGNINGER.map((t) => [t.id, t.navn]), opt, () => { renderLeft(); update(); }),
        select('Skinneprofil', 'skinne', ob.skinner.map((s) => [s, `${SKINNER[s].navn} – ${SKINNER[s].hoejde} mm`]), opt, update),
      );
      f.append(h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'Afkod betegnelse'), h('div', { class: 'ed-inp' }, betInp)));
      left.append(f);
    };
    renderLeft();
    root.append(h('div', { class: 'grid' }, card('Input', left, 'card-input'), card('Tegning', out, 'card-out')));
    update();
  },
};
