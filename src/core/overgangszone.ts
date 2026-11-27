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

export interface BaerelagInput {
  /** Eksisterende ballasttykkelse under svellen = dybde til eksisterende planum [m] */
  BtEks: number;
  /** Nyt bærelag: ballast og underballast [m] */
  BtNy: number; UtNy: number;
  /** Længde af trappens to plateauer [m] (hver ≥ 3,00 m) */
  L1: number; L2: number;
  /** Afstand fra nærmeste skinnesvejsning/isolerklæbestød til overgangszonens start [m] */
  aSvejs: number;
  laengdeFornyelse: number;
  sidespor: boolean;
  projekt: Projekt;
}

export interface Baerelag {
  kraeves: boolean;
  /** Dybder under svelleunderside [m]: plateau 1, plateau 2 (= eksisterende planum) og nyt bærelags underkant */
  P1: number; P2: number; D: number;
  /** Trinhøjde mellem plateauerne (0,15 m) og mindste plateaulængde (3,00 m) */
  trinHoejde: number; minPlateau: number;
  /** Trappens længde (overgangszonen) og mindste længde */
  Ltrin: number; LtrinMin: number;
  /** Alternativ: jævn overgang ≥ 20 m */
  Ljaevn: number; haeldningJaevn: number;
  /** Svejsninger/isolerklæbestød mindst 1,50 m uden for udskiftningsområdet */
  svejsAfstand: number;
  checks: { label: string; value: string; graense: string; status: 'ok' | 'overskredet'; kilde: string }[];
  noter: string[];
}

const f2 = (x: number) => x.toFixed(2).replace('.', ',');

/**
 * Overgang mellem nyt bærelag af ballast og underballast og område uden udskiftning af underballast (fig. 12.1-2):
 * trappeformet udgravning med to plateauer – det første 0,15 m over eksisterende planum, det andet i eksisterende
 * planum – hver mindst 3,00 m lange, før udgravningen går ned til det nye bærelags fulde dybde.
 * Alternativt jævn forøgelse af det nye bærelag over mindst 20 m.
 */
export function baerelag(o: BaerelagInput): Baerelag {
  const noter: string[] = [];
  let kraeves = true;
  if (o.sidespor) { kraeves = false; noter.push('Sidespor: ingen krav om overgangszone ved fornyelse af bærelag (note 12.1-13).'); }
  if (o.laengdeFornyelse <= 10 && !o.sidespor) { kraeves = false; noter.push('Fornyelse af højst 10 m bærelag i hoved- og togvejsspor: overgangszone efter fig. 12.1-2 kræves ikke (afsnit 12.1).'); }
  const trinHoejde = 0.15, minPlateau = 3.0;
  const P2 = o.BtEks, P1 = Math.max(0, o.BtEks - trinHoejde), D = o.BtNy + o.UtNy;
  const checks: Baerelag['checks'] = [];
  if (kraeves) {
    checks.push({ label: 'Plateau 1 (0,15 m over eksisterende planum)', value: `${f2(o.L1)} m`, graense: '≥ 3,00 m', status: o.L1 >= minPlateau - 1e-9 ? 'ok' : 'overskredet', kilde: 'BN1-6-7 fig. 12.1-2' });
    checks.push({ label: 'Plateau 2 (i eksisterende planum)', value: `${f2(o.L2)} m`, graense: '≥ 3,00 m', status: o.L2 >= minPlateau - 1e-9 ? 'ok' : 'overskredet', kilde: 'BN1-6-7 fig. 12.1-2' });
    checks.push({ label: 'Svejsning/isolerklæbestød uden for udskiftningsområdet', value: `${f2(o.aSvejs)} m`, graense: '≥ 1,50 m', status: o.aSvejs >= 1.5 - 1e-9 ? 'ok' : 'overskredet', kilde: 'BN1-6-7 afsn. 12.1' });
  }
  if (D <= P2 + 1e-9) noter.push(`Det nye bærelag (${f2(D)} m) går ikke dybere end eksisterende planum (${f2(P2)} m) – trappen ender i eksisterende planum.`);
  if (o.BtEks < trinHoejde) noter.push('Eksisterende ballast er tyndere end 0,15 m – plateau 1 ligger i svelleunderkant.');
  noter.push('Overgangszoner skal altid etableres uden for sporskifter (afsnit 12.1).');
  noter.push('Som alternativ tillades en overgangszone på mindst 20 m med jævn forøgelse af det nye bærelag – kan og bør anvendes ved maskinel ombygning (note 12.1-14).');
  if (o.projekt === 'nyanlaeg') noter.push('Nyanlæg: mellem nybygget spor og eksisterende spor uden udskiftning af underballast etableres overgangszone efter fig. 12.1-2 (afsnit 15.1).');
  return {
    kraeves, P1, P2, D, trinHoejde, minPlateau,
    Ltrin: o.L1 + o.L2, LtrinMin: 2 * minPlateau,
    Ljaevn: 20, haeldningJaevn: (D / 20) * 1000, svejsAfstand: 1.5, checks, noter,
  };
}
