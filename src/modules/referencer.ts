import { REFERENCES, ADGANG_TEKST, BANENORM_OVERSIGT } from '../core/references';
import { setReport } from '../core/report';
import { card, h, type Module } from '../ui/dom';

export const referencer: Module = {
  id: 'referencer',
  gruppe: 'Grundlag',
  titel: 'Referencer',
  kort: 'Referencer',
  ikon: '❐',
  beskrivelse: 'Normer, regelsæt og standarder som SporKit bygger på, og hvad de bruges til.',
  render(root) {
    const grupper = ['Regelsæt', 'Banenorm', 'Lærebog', 'Europæisk standard', 'EU-forordning', 'Åben dataformat'] as const;
    const body = grupper.map((g) => {
      const list = REFERENCES.filter((r) => r.type === g);
      if (!list.length) return '';
      return `<h3>${g === 'Banenorm' ? 'Banenormer' : g === 'Europæisk standard' ? 'Europæiske standarder' : g === 'Åben dataformat' ? 'Åbne dataformater' : g}</h3>
        <div class="refs">${list.map((r) => `
          <div class="ref">
            <div class="ref-head"><span class="ref-id">${r.kort}</span>
              <span class="chip ${r.adgang === 'aaben' ? 'chip-ok' : r.adgang === 'betaling' ? 'chip-undtagelse' : 'chip-overskredet'}">${ADGANG_TEKST[r.adgang]}</span>
              ${r.gennemgaaet ? '<span class="chip chip-info">Læst</span>' : ''}</div>
            <div class="ref-title">${r.titel}</div>
            <div class="ref-pub">${r.udgiver}</div>
            <div class="ref-use"><b>Anvendes til:</b> ${r.anvendelse}</div>
            ${r.url ? `<a class="ref-link" href="${r.url}" target="_blank" rel="noopener">${r.url === BANENORM_OVERSIGT ? 'Find på Banedanmarks normside ↗' : 'Åbn dokument ↗'}</a>` : r.adgang === 'betaling' ? '<span class="ref-pub">Købes hos Dansk Standard (ds.dk)</span>' : ''}
          </div>`).join('')}</div>`;
    }).join('');
    const aabne = REFERENCES.filter((r) => r.adgang === 'aaben').length;
    const intro = `<div class="notice"><strong>Åbenhed:</strong> ${aabne} af ${REFERENCES.length} kilder er frit tilgængelige online og linket herfra. DS/EN-standarder skal købes og er kun henvist til – SporKit bruger ikke indhold fra dem. Sporregler 1987 er ikke fundet offentligt; værdierne herfra er gengivet fra den frit tilgængelige lærebog <i>Sporteknik</i>. «Læst» betyder, at dokumentet er gennemgået ved udviklingen af SporKit.</div>`;
    root.append(h('div', { class: 'grid grid-1' }, card('Referenceliste', intro + body)));
    setReport({
      modul: 'Referenceliste',
      inputs: [],
      steps: REFERENCES.map((r) => ({ label: r.kort, formel: r.titel, indsat: r.anvendelse, resultat: `${ADGANG_TEKST[r.adgang]}${r.url ? ` · ${r.url}` : ''}` })),
      checks: [],
      refs: REFERENCES.map((r) => r.id),
    });
  },
};
