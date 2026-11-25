import { REFERENCES } from '../core/references';
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
    const grupper = ['Regelsæt', 'Banenorm', 'Lærebog', 'Europæisk standard', 'EU-forordning'] as const;
    const body = grupper.map((g) => {
      const list = REFERENCES.filter((r) => r.type === g);
      if (!list.length) return '';
      return `<h3>${g === 'Banenorm' ? 'Banenormer' : g === 'Europæisk standard' ? 'Europæiske standarder' : g}</h3>
        <div class="refs">${list.map((r) => `
          <div class="ref">
            <div class="ref-head"><span class="ref-id">${r.kort}</span>
              ${r.gennemgaaet ? '<span class="chip chip-ok">Gennemgået</span>' : '<span class="chip chip-undtagelse">Ikke gennemgået</span>'}</div>
            <div class="ref-title">${r.titel}</div>
            <div class="ref-pub">${r.udgiver}</div>
            <div class="ref-use"><b>Anvendes til:</b> ${r.anvendelse}</div>
            ${r.url ? `<a class="ref-link" href="${r.url}" target="_blank" rel="noopener">Åbn dokument ↗</a>` : ''}
          </div>`).join('')}</div>`;
    }).join('');
    const intro = `<div class="notice">«Gennemgået» betyder, at dokumentet er læst ved udviklingen af SporKit. De øvrige er henvist til via <i>Sporteknik</i> eller som generelt fagligt grundlag og bør kontrolleres i deres gældende udgave.</div>`;
    root.append(h('div', { class: 'grid grid-1' }, card('Referenceliste', intro + body)));
    setReport({
      modul: 'Referenceliste',
      inputs: [],
      steps: REFERENCES.map((r) => ({ label: r.kort, formel: r.titel, indsat: r.anvendelse, resultat: r.gennemgaaet ? 'Gennemgået' : 'Ikke gennemgået' })),
      checks: [],
      refs: REFERENCES.map((r) => r.id),
    });
  },
};
