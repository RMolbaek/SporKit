/**
 * Data for overbygning (svelle, skinne, befæstelse og tværprofil).
 * Kilde: Banedanmark, Sporteknik 2. udg. (2016) – sidehenvisninger i `kilde`.
 */
export type SvelleType = 'S99' | 'S16';

export interface Svelle {
  id: SvelleType;
  navn: string;
  overbygning: string;
  befaestelse: string;
  hoejde: number; // mm
  bredde: number; // mm
  laengde: number; // mm
  vaegt: number; // kg
  armering: string;
  hastighed: string;
  aksellast: string;
  sporvidde: number; // mm nominel
  kilde: string;
}

export const SVELLER: Record<SvelleType, Svelle> = {
  S99: {
    id: 'S99',
    navn: 'S99 monobloksvelle',
    overbygning: 'UIC60 Dmp (60E2)',
    befaestelse: 'Pandrol Fastclip FC',
    hoejde: 206, bredde: 300, laengde: 2500, vaegt: 240,
    armering: '10 tråde', hastighed: '180 km/t', aksellast: '22,5 t',
    sporvidde: 1435,
    kilde: 'Sporteknik s. 30, 41, 83–84',
  },
  S16: {
    id: 'S16',
    navn: 'S16 monobloksvelle',
    overbygning: 'UIC60 Dme (60E2)',
    befaestelse: 'Pandrol Fastclip FE',
    hoejde: 224, bredde: 280, laengde: 2500, vaegt: 290,
    armering: '12 tråde', hastighed: '250 km/t (25 t: 100 km/t)', aksellast: '22,5 t (25 t)',
    sporvidde: 1437,
    kilde: 'Sporteknik s. 41–42, 84, 274',
  },
};

/** Skinne 60E2 – hovedmål (DS/EN 13674-1). */
export const SKINNE_60E2 = {
  hoejde: 172, fod: 150, hoved: 72, krop: 16.5, vaegt: 60.0, haeldning: 40,
};

/** Tværprofil – eksempel for nyanlæg af hovedspor 160 < V ≤ 200 km/t (Sporteknik s. 32, BN1-6). */
export const TVAERPROFIL = {
  skulder: 550, // Bsk [mm]
  anlaeg: 1.5, // skråning 1:1,5
  ballast: 300, // Bt [mm] under svelle
  underballast: 250, // Ut [mm]
  planumHaeldning: 0.04, // 40 ‰
  saenkningV160: 40, // ballast sænkes 4 cm mellem skinnerne ved V > 160
};

export const SVELLEAFSTAND = 625; // mm c/c (Sporteknik s. 159 / BN1-66)
export const MELLEMLAEG_DMP = { haard: '94 kN/mm (V ≤ 120 km/t)', bloed: '77 kN/mm (V > 120 km/t)' };

/* =====================================================================================
 * Katalog over overbygningstyper, skinneprofiler og sveller – Sporteknik 2. udg. (2016),
 * afsnit 3.5–3.6 (benævnelser og typer, figur 18–35), 5 (sveller), 6.2 (skinner, figur 92)
 * og 7 (befæstelsesdele, figur 132 med km pr. type medio 2016).
 * ===================================================================================== */

export type SkinneId = 'DSB37' | '45E2' | 'DSB60' | '60E1' | '60E2';

export interface SkinneProfil {
  id: SkinneId; navn: string; alias: string;
  hoejde: number; fod: number; hoved: number; vaegt: number;
  note: string;
}

/** Hovedmål fra Sporteknik figur 92 (mm). */
export const SKINNER: Record<SkinneId, SkinneProfil> = {
  DSB37: { id: 'DSB37', navn: 'DSB37', alias: 'skinne IV', hoejde: 128, fod: 115, hoved: 60, vaegt: 37, note: 'Ældre dansk profil uden international betegnelse; findes på enkelte sidespor (bl.a. DSB37 A i Taastrup 2016).' },
  '45E2': { id: '45E2', navn: '45E2 (DSB45)', alias: 'skinne V', hoejde: 141, fod: 126, hoved: 70, vaegt: 45, note: 'DSB45 – korrekt betegnelse 45E2 (EN 13674-4, < 46 kg/m, ikke interoperabel jf. TSI INF).' },
  DSB60: { id: 'DSB60', navn: 'DSB60', alias: 'skinne VI', hoejde: 172, fod: 156, hoved: 70, vaegt: 60, note: 'Dansk 60 kg-profil; bredere fod end UIC60.' },
  '60E1': { id: '60E1', navn: '60E1 (UIC60)', alias: 'skinne VII', hoejde: 172, fod: 150, hoved: 72, vaegt: 60, note: 'Oprindelig UIC60 (R13 på skinnehovedets hjørner).' },
  '60E2': { id: '60E2', navn: '60E2 (UIC60 AHC)', alias: 'skinne VII', hoejde: 172, fod: 150, hoved: 72, vaegt: 60, note: 'Anti headcheck (R16). Standard ved alle nyanlæg og fornyelser; 60E1 slibes til 60E2-profil.' },
};

export type SvelleId = 'S99' | 'S16' | 'S89' | 'BOEG' | 'AZOBE' | 'TOBLOK' | 'STAAL';

export interface SvelleSpec {
  id: SvelleId; navn: string;
  materiale: 'monoblok' | 'trae' | 'toblok' | 'staal';
  hoejde: number; bredde: number; laengde: number; vaegt?: number;
  sporvidde: number;
  /** 'sporteknik' = mål angivet i bogen; 'skematisk' = ikke angivet, tegnet skematisk */
  maal: 'sporteknik' | 'skematisk';
  note: string;
}

export const SVELLETYPER: Record<SvelleId, SvelleSpec> = {
  S99: { id: 'S99', navn: 'S99 monoblok (beton)', materiale: 'monoblok', hoejde: 206, bredde: 300, laengde: 2500, vaegt: 240, sporvidde: 1435, maal: 'sporteknik', note: 'Som S89, men med Pandrol Fastclip FC (fra 2000). 180 km/t, 22,5 t (s. 83).' },
  S89: { id: 'S89', navn: 'S89 monoblok (beton)', materiale: 'monoblok', hoejde: 206, bredde: 300, laengde: 2500, vaegt: 240, sporvidde: 1435, maal: 'sporteknik', note: 'Standard 1989–2000 med Vossloh-befæstelse og indstøbte dyvler; kendt for revner (s. 83–85).' },
  S16: { id: 'S16', navn: 'S16 monoblok (beton)', materiale: 'monoblok', hoejde: 224, bredde: 280, laengde: 2500, vaegt: 290, sporvidde: 1437, maal: 'sporteknik', note: 'Pandrol Fastclip FE. 250 km/t (25 t: 100 km/t); udviklet til København–Ringsted (s. 84).' },
  BOEG: { id: 'BOEG', navn: 'Træsvelle (bøg/eg) 2600 × 260 × 160', materiale: 'trae', hoejde: 160, bredde: 260, laengde: 2600, sporvidde: 1435, maal: 'sporteknik', note: 'Figur 69. Fra TM 74/2015 anvendes kun azobé- eller egesveller; tidligere bøg, eg, fyr og azobé (s. 73).' },
  AZOBE: { id: 'AZOBE', navn: 'Azobésvelle (2 cm tyndere)', materiale: 'trae', hoejde: 140, bredde: 260, laengde: 2600, sporvidde: 1435, maal: 'sporteknik', note: 'Anvendt hvor ballastlaget er tyndt, fx perrontunneler og vejunderføringer (Dtz, Crz, Cfz) (s. 39, 140).' },
  TOBLOK: { id: 'TOBLOK', navn: 'To-bloksvelle (RS / SL / S75)', materiale: 'toblok', hoejde: 200, bredde: 290, laengde: 2300, sporvidde: 1435, maal: 'skematisk', note: 'RS 1958–68 og SL 1968–78 med sporvidde 1432 mm; S75 1978–89 (1435 mm fra 1983). Op til 180 km/t. Tværstangen ruster; må ikke genanvendes (s. 82). Mål ikke angivet – tegnet skematisk.' },
  STAAL: { id: 'STAAL', navn: 'Stålsvelle (omvendt U)', materiale: 'staal', hoejde: 100, bredde: 260, laengde: 2500, sporvidde: 1435, maal: 'skematisk', note: 'Findes i meget lille omfang; ballast kommer op i svellen, sporjustering næsten umulig (s. 43). Mål ikke angivet – tegnet skematisk.' },
};

export type BefType = 'spiger' | 'skrue' | 'hageplade' | 'ribbe-klemplade' | 'ribbe-fjeder' | 'fjedrende-klemplade' | 'nylonklemplade' | 'vossloh' | 'fastclip-fc' | 'fastclip-fe';

export interface Overbygningstype {
  id: string;
  navn: string;
  /** Varianter med skinne, fx «DSB45 Dbg» */
  varianter: string[];
  skinner: SkinneId[];
  svelle: SvelleId;
  befType: BefType;
  befaestelse: string;
  /** Skinnehældning 1:n (0 = lodret) */
  haeldning: number;
  periode: string;
  /** km medio 2016 (Sporteknik figur 132): hovedspor, togvejsspor, sidespor */
  km?: [number, number, number];
  blade: string;
  anvendelse: string;
  dele: string[];
  noter: string[];
  sider: string;
}

const DELE_A = ['Spiger', 'Underlagsplader'];
const DELE_B = ['Svelleskruer', 'Underlagsplader', 'Hagebolte', 'Hageplader'];
const DELE_C = ['Svelleskruer', 'Spænderinge', 'Dyvler', 'Hageplader', 'Ribbeunderlagsplader', 'Mellemlægsplader', 'Klemplader', 'Klempladebolte', 'Fjederklemmer'];

export const OVERBYGNINGER: Overbygningstype[] = [
  { id: 'A', navn: 'A – spiger', varianter: ['DSB32 A', 'DSB37 A', 'DSB45 A'], skinner: ['DSB37', '45E2'], svelle: 'BOEG', befType: 'spiger', befaestelse: 'Skinnespiger med underlagsplade af stål', haeldning: 20, periode: 'fra de første baner', km: [0, 0, 0], blade: '–', anvendelse: 'Anvendes ikke mere; findes på enkelte sidespor', dele: DELE_A, noter: ['Stiv konstruktion; spigerne kunne ikke holde til større belastninger.'], sider: 's. 35, 131' },
  { id: 'B', navn: 'B – skruer med underlags-/hageplade', varianter: ['DSB32 B', 'DSB37 B', 'DSB45 B'], skinner: ['DSB37', '45E2'], svelle: 'BOEG', befType: 'hageplade', befaestelse: 'Svelleskruer med underlagsplade (DSB32/37 B) eller hageplade og klemplade (DSB45 B)', haeldning: 20, periode: 'ældre', km: [0, 1, 10], blade: '–', anvendelse: 'Sidespor', dele: DELE_B, noter: ['Stiv konstruktion uden synderlig elasticitet – svelleskruer arbejder sig løse.'], sider: 's. 35–36, 132' },
  { id: 'Bt', navn: 'Bt – skruer direkte i træsvelle', varianter: ['DSB45 Bt', 'DSB45 Btl', 'DSB60 Bt', 'UIC60 Bt'], skinner: ['45E2', 'DSB60', '60E1'], svelle: 'BOEG', befType: 'skrue', befaestelse: 'Svelleskruer direkte i bøgesvelle uden underlagsplade (Btl: lodret skinne)', haeldning: 20, periode: 'ældre', km: [6, 8, 72], blade: '45E2: 5512 (Btl 5715) · 60E1: 7700', anvendelse: 'Sidespor og rangerarealer; ikke nyanlæg', dele: ['Svelleskruer (V Bt / VI Bt / VII Bt)', 'Lasker og laskebolte'], noter: ['Må ikke anvendes i langskinnespor.', 'Skinnestykker typisk 30 m (DSB45) og 60 m (DSB60/UIC60).'], sider: 's. 36, 136–137' },
  { id: 'C', navn: 'C – adskilt befæstelse med hageplade', varianter: ['DSB45 C'], skinner: ['45E2'], svelle: 'BOEG', befType: 'hageplade', befaestelse: 'Hageplade fastgjort med svelleskruer; skinnefod i «hage» og klempladebolt VC (æbleskivebolt)', haeldning: 20, periode: 'ældre', km: [0, 0, 5], blade: '5500', anvendelse: 'Sidespor', dele: DELE_C, noter: ['Skinnen kan udveksles uden at løsne underlagspladen fra svellen.'], sider: 's. 36–37, 134' },
  { id: 'Cr', navn: 'Cr – ribbeunderlagsplade med klemplader', varianter: ['DSB45 Cr', 'DSB45 Crz', 'DSB45 Crl', 'UIC60 Cr', 'UIC60 Crz', 'UIC60 Crl', 'UIC60 Cr-stål'], skinner: ['45E2', '60E1'], svelle: 'BOEG', befType: 'ribbe-klemplade', befaestelse: 'Ribbeunderlagsplade (SS-skruer), klemplader R1/R6 og klempladebolt R75 med dobbelt spændering', haeldning: 20, periode: 'ældre – stadig i sporskifter', km: [3, 14, 21], blade: '45E2: 5539 (Crz 5722) · 60E1: 7755 (Crz 7906, Cr-stål 7748)', anvendelse: 'Sporskifter og skarpe kurver', dele: DELE_C, noter: ['Største rammestivhed af Banedanmarks typer – stabilt over for vridninger, men tungere at justere.', 'Ribbeunderlagsplader findes til 1:20, 1:40 og lodret (45E2: 654/655/656, 60E2: 754/755/756).', 'z = azobésvelle, l = lodret skinne.'], sider: 's. 37, 138–139' },
  { id: 'Cf', navn: 'Cf – ribbeunderlagsplade med fjederklemmer', varianter: ['DSB45 Cf', 'DSB45 Cfz', 'UIC60 Cf', 'UIC60 Cfz', 'UIC60 Cfb', 'UIC60 Cft'], skinner: ['45E2', '60E1'], svelle: 'BOEG', befType: 'ribbe-fjeder', befaestelse: 'Ribbeunderlagsplade med fjederklemme Fk2 og klempladebolt R55', haeldning: 20, periode: 'ældre – stadig i sporskifter', km: [1, 6, 3], blade: '45E2: 5713 (Cfz 5721) · 60E1: 7789 (Cfz 7905, Cfb 7940, Cft 7939)', anvendelse: 'Sporskifter og skarpe kurver', dele: DELE_C, noter: ['Mindre stiv end Cr. Fk1 er udgået pga. konstruktionsfejl og erstattes af Fk2.'], sider: 's. 37–38, 140' },
  { id: 'Dt', navn: 'Dt – dobbeltelastisk på træsvelle', varianter: ['DSB45 Dt', 'DSB45 Dtz', 'UIC60 Dt', 'UIC60 Dtz'], skinner: ['45E2', '60E1'], svelle: 'BOEG', befType: 'fjedrende-klemplade', befaestelse: 'Fjedrende klemplader med støtteplade og D-skrue; gummimellemlæg med zigzag-riller', haeldning: 20, periode: 'ældre – stadig i hovedspor', km: [76, 26, 31], blade: '45E2: 5650 (Dtz 5716) · 60E1: 7730 (Dtz 7795)', anvendelse: 'Hovedspor; kan anvendes som langskinnespor', dele: ['Svelleskruer (D-skrue)', 'Fjedrende klemplader', 'Støtteplader', 'Mellemlægsplader (gummi)'], noter: ['45E2: to skruer pr. skinne, 60E2: tre.', 'Dtz med azobésvelle (2 cm tyndere) hvor der er lidt plads under svellen.'], sider: 's. 39, 141–143' },
  { id: 'Db', navn: 'Db – dobbeltelastisk på to-bloksvelle', varianter: ['DSB45 Db', 'DSB60 Db', 'UIC60 Db', 'DSB45 Dbg', 'UIC60 Dbg', 'Dbr', 'Dbs'], skinner: ['45E2', 'DSB60', '60E1'], svelle: 'TOBLOK', befType: 'fjedrende-klemplade', befaestelse: 'Fjedrende stålklemplader med nylonbøsning og B2/B3-bolt i profiljernet; gummimellemlæg', haeldning: 20, periode: '1958–1978 (RS, SL)', km: [278, 56, 0], blade: '45E2: 5680 (Dbg 5686, Dbr 5718, Dbs 5719) · 60E1: 7718/7780 (Dbg 7783, Dbr 7924, Dbs 7922)', anvendelse: 'Hovedspor (ældre)', dele: ['B2/B3-bolte', 'Fjedrende klemplader', 'Nylonbøsninger', 'Mellemlægsplader (gummi)', 'Nylonklemplader og Cil-plader (ved renovering)'], noter: ['g = gummi på yderste klemplader (kurver).', 'Ved renovering erstattes stålklemplader af nylonklemplader + Cil-plader: Db → Dbr, Dbg → Dbs.', 'Tværstangen tærer pga. signalstrøm, hvis nylonbøsningen ødelægges.'], sider: 's. 39–40, 144–147' },
  { id: 'Dbn', navn: 'Dbn – to-bloksvelle S75 med nylonklemplader', varianter: ['DSB37 Dbn', 'DSB45 Dbn', 'DSB60 Dbn', 'UIC60 Dbn'], skinner: ['DSB37', '45E2', 'DSB60', '60E1'], svelle: 'TOBLOK', befType: 'nylonklemplade', befaestelse: 'Nylonklemplader med Cil-plader og B12-bolt; mellemlæg af EVA-plast med hager', haeldning: 20, periode: '1978–1989 (S75)', km: [472, 110, 2], blade: '45E2: 5710 · 60E1: 7787', anvendelse: 'Hovedspor', dele: ['B12-bolte', 'Nylonklemplader (ydre/midt)', 'Cil-plader (60 × 60 og 60 × 100 mm)', 'Mellemlægsplader (EVA)'], noter: ['Boltene har ikke kontakt med profiljernet – bedre elektrisk isolering end Db.'], sider: 's. 40, 148–149' },
  { id: 'Dm', navn: 'Dm – monoblok S89 med Vossloh', varianter: ['DSB45 Dm', 'UIC60 Dm'], skinner: ['45E2', '60E1'], svelle: 'S89', befType: 'vossloh', befaestelse: 'Vossloh-fjederklemme (Fk4 til 60E2, Fk3l til 45E2), vinkelføringsplade og SS-2-skrue i indstøbt dyvel; EVA-mellemlæg', haeldning: 40, periode: '1989–2000', km: [585, 201, 65], blade: '45E2: 5725 · 60E1: 7925/7931', anvendelse: 'Hovedspor', dele: ['Svelleskruer (SS-2)', 'Dyvler', 'Vinkelføringsplader', 'Fjederklemmer', 'Mellemlægsplader (EVA)'], noter: ['Første monobloksvelle og første med skinnehældning 1:40.', 'EVA-mellemlægget er ret hårdt – begrænset elasticitet.'], sider: 's. 40, 150–151' },
  { id: 'Dmp', navn: 'Dmp – monoblok S99 med Fastclip FC', varianter: ['UIC60 Dmp'], skinner: ['60E2', '60E1'], svelle: 'S99', befType: 'fastclip-fc', befaestelse: 'Pandrol Fastclip FC i støbejernsskulder; side- og tåisolatorer; gummimellemlæg 94 kN/mm (V ≤ 120) eller 77 kN/mm (V > 120)', haeldning: 40, periode: '1999/2000–2016 (standard)', km: [882, 312, 21], blade: '7932', anvendelse: 'Hovedspor', dele: ['Fastclip FC', 'Clipisolator', 'Sideisolator', 'Mellemlægsplader'], noter: ['Mere end 1200 km bygget.', 'Ved spændingsudligning skal skinnen løftes op på ruller.'], sider: 's. 41, 152' },
  { id: 'Dme', navn: 'Dme – monoblok S16 med Fastclip FE', varianter: ['UIC60 Dme', 'DSB45 Dme'], skinner: ['60E2', '45E2'], svelle: 'S16', befType: 'fastclip-fe', befaestelse: 'Pandrol Fastclip FE (fladere og mere kompakt end FC; specialværktøj)', haeldning: 40, periode: 'fra 2016 (København–Ringsted)', blade: '8540', anvendelse: 'Hovedspor, V > 180 km/t; nuværende standard', dele: ['Fastclip FE', 'Skulder', 'Isolatorer', 'Mellemlægsplader'], noter: ['Skinneprofil kan skiftes ved at udveksle skulder/krage og klemme.'], sider: 's. 41–42' },
  { id: 'Dsp', navn: 'Dsp – stålsvelle med Fastclip FC', varianter: ['UIC60 Dsp'], skinner: ['60E2', '60E1'], svelle: 'STAAL', befType: 'fastclip-fc', befaestelse: 'Pandrol Fastclip FC på stålsvelle (omvendt U-profil)', haeldning: 40, periode: 'lille omfang', blade: '8335', anvendelse: 'Steder med problemer med ballasttykkelsen', dele: ['Fastclip FC', 'Isolatorer', 'Mellemlægsplader'], noter: ['Sporjustering næsten umulig med normale maskiner.'], sider: 's. 43' },
];

/** Bogstavkoder i overbygningsbetegnelser (Sporteknik figur 18). */
export const BETEGNELSER: { kode: string; betyder: string; gruppe: 'befæstelsestype' | 'svelle' | 'befæstelsesart' | 'skinnehældning' }[] = [
  { kode: 'A', betyder: 'Spiger', gruppe: 'befæstelsestype' },
  { kode: 'B', betyder: 'Skruer', gruppe: 'befæstelsestype' },
  { kode: 'C', betyder: 'Adskilt befæstelse', gruppe: 'befæstelsestype' },
  { kode: 'D', betyder: 'Dobbeltelastisk befæstelse', gruppe: 'befæstelsestype' },
  { kode: 'b', betyder: 'Betonsvelle (to-blok)', gruppe: 'svelle' },
  { kode: 't', betyder: 'Træsvelle', gruppe: 'svelle' },
  { kode: 'z', betyder: 'Azobésvelle', gruppe: 'svelle' },
  { kode: 'm', betyder: 'Monobloksvelle (beton)', gruppe: 'svelle' },
  { kode: 's', betyder: 'Stålsvelle', gruppe: 'svelle' },
  { kode: 'r', betyder: 'Ribbeunderlagsplade med klemplade · eller nylonklemplade til renovering af Db', gruppe: 'befæstelsesart' },
  { kode: 'f', betyder: 'Fjederklemme', gruppe: 'befæstelsesart' },
  { kode: 'g', betyder: 'Klemplade med gummi', gruppe: 'befæstelsesart' },
  { kode: 'n', betyder: 'Nylonklemplade', gruppe: 'befæstelsesart' },
  { kode: 'b', betyder: 'Bred nylonklemplade (isolerende)', gruppe: 'befæstelsesart' },
  { kode: 'p', betyder: 'Pandrol Fastclip FC (S99)', gruppe: 'befæstelsesart' },
  { kode: 'e', betyder: 'Pandrol Fastclip FE (S16)', gruppe: 'befæstelsesart' },
  { kode: 's', betyder: 'Nylonklemplade til renovering af Dbg', gruppe: 'befæstelsesart' },
  { kode: 'l', betyder: 'Lodret skinne', gruppe: 'skinnehældning' },
];

/** Afkod en betegnelse som «DSB45 Dbn» eller «UIC60 Crz». */
export function afkodBetegnelse(s: string): { skinne?: SkinneProfil; dele: string[]; type?: Overbygningstype } | null {
  const m = s.trim().match(/^(DSB\s?32|DSB\s?37|DSB\s?45|DSB\s?60|UIC\s?60|45E2|60E1|60E2)?\s*([ABCD])([a-zæøå]*)(-stål)?$/i);
  if (!m) return null;
  const sk = (m[1] ?? '').toUpperCase().replace(/\s/g, '');
  const skinne = sk === 'DSB37' ? SKINNER.DSB37 : sk === 'DSB45' || sk === '45E2' ? SKINNER['45E2'] : sk === 'DSB60' ? SKINNER.DSB60 : sk === 'UIC60' || sk === '60E1' ? SKINNER['60E1'] : sk === '60E2' ? SKINNER['60E2'] : undefined;
  const hoved = m[2].toUpperCase();
  const rest = m[3];
  const dele: string[] = [`${hoved}: ${BETEGNELSER.find((b) => b.kode === hoved)!.betyder}`];
  rest.split('').forEach((c, i) => {
    // første lille bogstav efter B/D er normalt svelletypen; efter C er det befæstelsesarten
    const grp = (hoved === 'C' || (i > 0 && !(c === 'z' || c === 'l'))) ? ['befæstelsesart', 'svelle', 'skinnehældning'] : ['svelle', 'befæstelsesart', 'skinnehældning'];
    const b = grp.map((g) => BETEGNELSER.find((x) => x.kode === c && x.gruppe === g)).find(Boolean);
    if (b) dele.push(`${c}: ${b.betyder}`);
  });
  if (m[4]) dele.push('-stål: stålsvelle');
  const id = hoved + rest;
  const type = OVERBYGNINGER.find((t) => t.id === id) ?? OVERBYGNINGER.find((t) => t.varianter.some((v) => v.toLowerCase().endsWith(' ' + id.toLowerCase()))) ?? OVERBYGNINGER.find((t) => id.startsWith(t.id) && t.id.length > 1);
  return { skinne, dele, type };
}
