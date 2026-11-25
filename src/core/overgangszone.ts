/**
 * Overgangszoner – Banenorm BN1-6-7, afsnit 12.1 (sporfornyelse, fig. 12.1-1 og 12.1-2),
 * afsnit 15.1 (nyanlæg) og bilag 2 (informativt).
 */

export type Situation = 'underfoering' | 'baerelag' | 'fastspor';
export type Projekt = 'nyanlaeg' | 'fornyelse';

export interface Underfoering {
  /** Mindste længde af overgangszonen [m] */
  Loz: number;
  /** Type udførelse */
  type: 'trekant' | 'loz' | 'ingen';
  /** Højde af trekantformet udskiftning [m] */
  hoejde?: number;
  /** Længde af hydraulisk bundet bærelag nærmest broen [m] */
  hydrauliskBundet?: number;
  /** EV2 ved broen og på fri strækning [MPa] */
  ev2Bro?: number;
  ev2Normal?: number;
  noter: string[];
}

/** EV2 på overside planum ved nyanlæg (fig. 15.1-1). */
export function ev2Krav(V: number): number {
  return V <= 160 ? 80 : V <= 200 ? 115 : 120;
}

export function underfoering(o: {
  projekt: Projekt; V: number; hyppige: boolean; geonet: boolean; saetningsplade: number; sidespor: boolean;
}): Underfoering {
  const noter: string[] = [];
  if (o.projekt === 'fornyelse') {
    if (!o.hyppige) {
      return { Loz: 0, type: 'ingen', noter: ['Ved sporfornyelse kræves trekantformet udskiftning kun for spor med (forventet) hyppige sporjusteringer (afsnit 12.1).'] };
    }
    if (o.saetningsplade >= 10) {
      return { Loz: 0, type: 'ingen', noter: [`Broen har sætningsplade på ${o.saetningsplade} m ≥ 10 m – trekantformet udskiftning kan udelades.`] };
    }
    noter.push('Råjorden i bunden af udskiftningsområdet skal komprimeres.');
    noter.push('Ballasten skal udskiftes på underføringer, hvor den ikke kan renses maskinelt (medmindre andelen < 22,4 mm er under 22 vægt-%).');
    return { Loz: 10, type: 'trekant', hoejde: o.geonet ? 0.35 : 0.5, noter };
  }
  // Nyanlæg
  const ev2Normal = ev2Krav(o.V);
  if (o.V <= 120) {
    noter.push('V ≤ 120 km/t: overgangszone udføres som trekantformet udskiftning efter fig. 12.1-1.');
    return { Loz: 10, type: 'trekant', hoejde: o.geonet ? 0.35 : 0.5, ev2Bro: 120, ev2Normal, noter };
  }
  const Loz = o.V <= 160 ? 14 : o.V <= 200 ? 17 : 20;
  noter.push(`${o.V <= 200 ? '120 < V ≤ 200' : '200 < V ≤ 250'} km/t: udføres efter principperne i fig. 12.1-1 med Loz ≥ ${Loz} m.`);
  const hb = o.V > 200 ? 5 : undefined;
  if (hb) noter.push('De første mindst 5 m op mod underføringen udføres som hydraulisk bundet bærelag (Vejregler). Se bilag 2 (Ny Bane København–Ringsted).');
  noter.push('EV2 skal være 120 MPa umiddelbart op til underføringen og ændres jævnt over overgangszonens længde (fig. 15.1-1, fodnote 2).');
  return { Loz, type: 'loz', hoejde: o.geonet ? 0.35 : 0.5, hydrauliskBundet: hb, ev2Bro: 120, ev2Normal, noter };
}

export interface Baerelag {
  kraeves: boolean;
  /** Trinvis overgang: antal trin à højst 0,15 m og mindst 3,00 m */
  trin: number;
  trinHoejde: number;
  trinLaengde: number;
  Ltrin: number;
  /** Alternativ: jævn overgang */
  Ljaevn: number;
  haeldningJaevn: number;
  /** Svejsninger/isolerklæbestød mindst x m uden for udskiftningsområdet */
  svejsAfstand: number;
  noter: string[];
}

/**
 * Overgang mellem nyt bærelag og område uden udskiftning af underballast (fig. 12.1-2).
 * dybde = forskel i bærelagets underkant mellem nyt og eksisterende [m].
 */
export function baerelag(o: { dybde: number; laengdeFornyelse: number; sidespor: boolean; projekt: Projekt }): Baerelag {
  const noter: string[] = [];
  let kraeves = true;
  if (o.sidespor) { kraeves = false; noter.push('Sidespor: ingen krav om overgangszone ved fornyelse af bærelag (note 12.1-13).'); }
  if (o.projekt === 'fornyelse' && o.laengdeFornyelse <= 10) { kraeves = false; noter.push('Fornyelse af højst 10 m bærelag: overgangszone efter fig. 12.1-2 kræves ikke.'); }
  const trinHoejde = 0.15, trinLaengde = 3.0;
  const trin = Math.max(1, Math.ceil(o.dybde / trinHoejde - 1e-9));
  noter.push('Overgangszoner skal altid etableres uden for sporskifter.');
  noter.push('Den jævne overgang på mindst 20 m kan og bør anvendes ved maskinel ombygning (note 12.1-14).');
  if (o.projekt === 'nyanlaeg') noter.push('Nyanlæg: mellem nybygget spor og eksisterende spor uden udskiftning af underballast etableres overgangszone efter fig. 12.1-2 (afsnit 15.1).');
  return {
    kraeves, trin, trinHoejde: o.dybde / trin, trinLaengde, Ltrin: trin * trinLaengde,
    Ljaevn: 20, haeldningJaevn: (o.dybde / 20) * 1000, svejsAfstand: 1.5, noter,
  };
}
