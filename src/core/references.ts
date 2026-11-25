/**
 * Referenceliste. Hver grænseværdi i rules.ts peger på én eller flere af
 * disse referencer via `id`.
 */
export interface Reference {
  id: string;
  kort: string;
  titel: string;
  udgiver: string;
  type: 'Banenorm' | 'Regelsæt' | 'Lærebog' | 'Europæisk standard' | 'EU-forordning';
  anvendelse: string;
  url?: string;
  /** Om SporKit-udvikleren har haft dokumentet i hænde */
  gennemgaaet: boolean;
  /**
   * Tilgængelighed: 'aaben' = frit tilgængelig online, 'betaling' = skal købes (fx DS/EN-standarder),
   * 'ikke-fundet' = ikke fundet offentligt tilgængelig.
   */
  adgang: 'aaben' | 'betaling' | 'ikke-fundet';
}

/** Banedanmarks offentlige oversigt over banenormer. */
export const BANENORM_OVERSIGT = 'https://www.bane.dk/da/Leverandoer/Krav/Tekniske-normer-og-regler/Banenormer';

export const ADGANG_TEKST: Record<Reference['adgang'], string> = {
  aaben: 'Frit tilgængelig',
  betaling: 'Skal købes',
  'ikke-fundet': 'Ikke fundet offentligt',
};

export const REFERENCES: Reference[] = [
  {
    id: 'SR87',
    kort: 'Sporregler 1987',
    titel: 'Sporregler (del 1: normal- og undtagelsesbestemmelser), afsnit 2.02–2.10 og tillæg 2E',
    udgiver: 'DSB / Banedanmark',
    type: 'Regelsæt',
    anvendelse:
      'Primær kilde for linjeføring: cirkelbuer (2.02), overhøjde (2.03), hastighed (2.04), overgangskurver (2.05), overhøjderamper (2.06), sammenstødende kurver (2.07–2.08) og længdeprofil (2.10).',
    gennemgaaet: false,
    adgang: 'ikke-fundet',
  },
  {
    id: 'ST16',
    kort: 'Sporteknik, 2. udg.',
    titel: 'Sporteknik – Danske jernbanespors opbygning, konstruktion og komponenter, 2. udgave, 2. oplag',
    udgiver: 'Banedanmark, Teknik, LCC Spor (2016)',
    type: 'Lærebog',
    anvendelse:
      'Gengiver Sporreglernes krav til overhøjde og overhøjdeunderskud (s. 243–245), krumme sporskifter (s. 246–247), længdeprofil (s. 240), samt svelle-, skinne- og tværprofildata (s. 30–42, 83–84, 93).',
    url: 'https://www.bane.dk/-/media/Bane/Gamle/Presse/Temasider/Sporteknik_2udgave_2oplagx_compressed.pdf',
    gennemgaaet: true,
    adgang: 'aaben',
  },
  {
    id: 'BN1-38',
    kort: 'BN1-38-6',
    titel: 'Sporbeliggenhedskontrol og sporkvalitetsnormer (udgivet 01.01.2019)',
    udgiver: 'Banedanmark',
    type: 'Banenorm',
    anvendelse: 'Kvalitetsklasser, absolut overhøjde (177/187 og 180/190 mm), vridning pr. målebase (tabel 11.3.2-1, afsnit 17), sporvidde (tabel 11.3.2-2), projekteret ækvivalent konicitet (tabel 11.5.2-1/-2) og R = 10 000/p fra målevognsdiagram.',
    url: 'https://www.bane.dk/-/media/Bane/Dokumenter/Leverandoer/Teknisk-dokumentation/Tekniske-normer-og-regler/Banenormer/BN1_38_6-Sporbeliggenhedskontrol-og-sporkvalitetsnormer.pdf',
    gennemgaaet: true,
    adgang: 'aaben',
  },
  {
    id: 'BN1-49',
    kort: 'BN1-49-1',
    titel: 'Indbyrdes placering af spor og perron (udgivet 01.10.2006)',
    udgiver: 'Banedanmark',
    type: 'Banenorm',
    anvendelse: 'Nominel perronafstand (fig. 8.2-1), tillæg for R < 250 m og perronfremspring, tolerancer for spor i drift (fig. 9-1) og ved nyanlæg/fornyelse/sporjustering (fig. 11-1).',
    url: 'https://sitecore.bane.dk/Leverandoer/Krav/-/media/95B180A9B62541D9A14B366E31CE2CC5.ashx',
    gennemgaaet: true,
    adgang: 'aaben',
  },
  {
    id: 'BN1-9',
    kort: 'BN1-9-2',
    titel: 'Sikkerheds- og opholdszoner på perroner (udgivet 01.06.2012)',
    udgiver: 'Banedanmark',
    type: 'Banenorm',
    anvendelse: 'Bredde af sikkerhedszone (fig. 10.1-1), opholdszone (fig. 11.2-1), perronbredde (fig. 11.1-1), fri højde 2,3 m, passagertæthed, afstribning og skiltning.',
    url: 'https://sitecore.bane.dk/Leverandoer/Krav/-/media/2CE6350732E9493CA7439A3E7EE64550.ashx',
    gennemgaaet: true,
    adgang: 'aaben',
  },
  {
    id: 'BN1-18',
    kort: 'BN1-18',
    titel: 'Opmåling af genstande inden for profilgrænserne',
    udgiver: 'Banedanmark',
    type: 'Banenorm',
    anvendelse: 'Kontrolmåling af perronafstand og perronhøjde (henvist fra BN1-49).',
    url: BANENORM_OVERSIGT,
    gennemgaaet: false,
    adgang: 'aaben',
  },
  {
    id: 'BN1-6',
    kort: 'BN1-6-7',
    titel: 'Tværprofiler for ballasteret spor (udgivet 01.04.2023)',
    udgiver: 'Banedanmark',
    type: 'Banenorm',
    anvendelse: 'Krav til Bsk, a, Bt, Ut, Pb, Xp og Xrp ved nyanlæg (fig. 15.1-3), sporfornyelse (fig. 12.1-4) og BN1-minimum (fig. 10.2.3-2), forhøjet ballastskulder, sænket ballast ved V > 160 km/t.',
    url: 'https://bane.dk/Leverandoer/Krav/-/media/D182D206F03B4955808C7448FF6B8CC7.ashx',
    gennemgaaet: true,
    adgang: 'aaben',
  },
  {
    id: 'BN1-66',
    kort: 'BN1-66',
    titel: 'Langskinnespor. Spændingsudligning og indgreb i spændingsudlignet spor',
    udgiver: 'Banedanmark',
    type: 'Banenorm',
    anvendelse: 'Mindste radius i langskinnespor (fx UIC60 Dmp: 400 m, UIC60 Dt: 700 m) og svelleafstand 625 mm.',
    url: BANENORM_OVERSIGT,
    gennemgaaet: false,
    adgang: 'aaben',
  },
  {
    id: 'BN1-14',
    kort: 'BN1-14',
    titel: 'Projektering, tilstand og eftersyn af sporskifter og sporskæringer',
    udgiver: 'Banedanmark',
    type: 'Banenorm',
    anvendelse: 'Sporskifter – overhøjdeunderskud i krumme sporskifter.',
    url: BANENORM_OVERSIGT,
    gennemgaaet: false,
    adgang: 'aaben',
  },
  {
    id: 'BN1-154',
    kort: 'BN1-154',
    titel: 'Sporafstand og frispormærker',
    udgiver: 'Banedanmark',
    type: 'Banenorm',
    anvendelse: 'Gældende krav til sporafstand. SporKits kurveudvidelse er kun et geometrisk overslag.',
    url: 'https://www.bane.dk/da/Leverandoer/Krav/Tekniske-normer-og-regler/-/media/5A444D0AE6744AFFBA98BBFF7FB9F116.ashx',
    gennemgaaet: false,
    adgang: 'aaben',
  },
  {
    id: 'BN1-13',
    kort: 'BN1-13-4',
    titel: 'Ledningsanlæg på arealer og under spor, hvor Banedanmark er infrastrukturforvalter (udgivet 23.07.2024)',
    udgiver: 'Banedanmark',
    type: 'Banenorm',
    anvendelse: 'Krydsende ledninger: dybde under SO (1,6 m, 10·D + 1, 2,0 m, 7·reamer + 1, gas/olie 2,0/2,4 m), vinkel ≤ 15°, 10 m fra sporskifter, diametergrænser, skinneafstivning; langsgående: ≥ 2,50 m fra spormidte, 1,3 m under SO, kabelrender 2,75/3,25 m; gas/olie-afstande.',
    url: 'https://www.bane.dk/-/media/Bane/Dokumenter/Leverandoer/Teknisk-dokumentation/Tekniske-normer-og-regler/Banenormer/BN1_13_4.pdf',
    gennemgaaet: true,
    adgang: 'aaben',
  },
  {
    id: 'BN1-166',
    kort: 'BN1-166-1',
    titel: 'Fritrumsprofiler, læsseprofil og kinematiske referencelinjer (udgivet 03.02.2025)',
    udgiver: 'Banedanmark',
    type: 'Banenorm',
    anvendelse: 'Breddeforøgelse e i kurver (formel 12.1/12.2), højdeændring i afrundingskurver (formel 13.1), vedligeholdelsestillæg (tabel 10.4-1), fritrum omkring skinnen (afsnit 14) og profiltype D/D-GC/SD.',
    url: 'https://www.bane.dk/leverandoer/krav/-/media/FCA33F860B424734AB5C543BFB437865.ashx',
    gennemgaaet: true,
    adgang: 'aaben',
  },
  {
    id: 'BN2-93',
    kort: 'BN2-93-1',
    titel: 'Absolut beliggenhed og fast afmærkning af sporets tracé (udgivet 01.03.2011)',
    udgiver: 'Banedanmark',
    type: 'Banenorm',
    anvendelse: 'Tracétavlernes felter og symboler (afsn. 10.1–10.3), placering og tolerance ±0,3 m (afsn. 10.4), udfyldningseksempler (bilag 1–2).',
    url: 'https://bane.dk/Leverandoer/Krav/-/media/F28F8BE73B814CD5A2497A129568AB65.ashx',
    gennemgaaet: true,
    adgang: 'aaben',
  },
  {
    id: 'EN13803',
    kort: 'DS/EN 13803',
    titel: 'Railway applications – Track – Track alignment design parameters – Track gauges 1435 mm and wider',
    udgiver: 'CEN / Dansk Standard',
    type: 'Europæisk standard',
    anvendelse: 'Generelle sporgeometriske sammenhænge (h_eq, I, E, ramper, ændringshastigheder, lodrette kurver).',
    gennemgaaet: false,
    adgang: 'betaling',
  },
  {
    id: 'EN13848',
    kort: 'DS/EN 13848',
    titel: 'Railway applications – Track – Track geometry quality',
    udgiver: 'CEN / Dansk Standard',
    type: 'Europæisk standard',
    anvendelse: 'Definition af sporvidde, vridning og overhøjde ved måling.',
    gennemgaaet: false,
    adgang: 'betaling',
  },
  {
    id: 'EN13674',
    kort: 'DS/EN 13674-1',
    titel: 'Railway applications – Track – Rail – Vignole railway rails 46 kg/m and above',
    udgiver: 'CEN / Dansk Standard',
    type: 'Europæisk standard',
    anvendelse: 'Skinneprofil 60E2 (mål i tværsnitstegningen).',
    gennemgaaet: false,
    adgang: 'betaling',
  },
  {
    id: 'EN15273',
    kort: 'DS/EN 15273-1…3',
    titel: 'Railway applications – Gauges (del 1: generelt, del 2: rullende materiel, del 3: fritrumsprofiler)',
    udgiver: 'CEN / Dansk Standard',
    type: 'Europæisk standard',
    anvendelse: 'Profilberegning ved R < 150 m og R<sub>v</sub> < 500 m; installationsgrænse for sporafstand og perronafstand (TSI).',
    gennemgaaet: false,
    adgang: 'betaling',
  },
  {
    id: 'EN13230',
    kort: 'DS/EN 13230',
    titel: 'Railway applications – Track – Concrete sleepers and bearers',
    udgiver: 'CEN / Dansk Standard',
    type: 'Europæisk standard',
    anvendelse: 'Tekniske betingelser for betonsveller.',
    gennemgaaet: false,
    adgang: 'betaling',
  },
  {
    id: 'TSI-PRM',
    url: 'https://eur-lex.europa.eu/eli/reg/2014/1300/oj',
    kort: 'TSI PRM',
    titel: 'Teknisk specifikation for interoperabilitet – tilgængelighed for personer med handicap og bevægelseshæmmede, Forordning (EU) nr. 1300/2014',
    udgiver: 'Europa-Kommissionen',
    type: 'EU-forordning',
    anvendelse: 'Perronbredde, sikkerheds- og opholdszoner, perronafslutning og skiltning (henvist fra BN1-9-2).',
    gennemgaaet: false,
    adgang: 'aaben',
  },
  {
    id: 'TSI-INF',
    kort: 'TSI INF',
    titel: 'Kommissionens forordning (EU) nr. 1299/2014 om TSI for delsystemet «infrastruktur», konsolideret udgave 28.09.2023 (inkl. 2019/776 og 2023/1694)',
    udgiver: 'Europa-Kommissionen',
    type: 'EU-forordning',
    anvendelse: 'Overhøjde (4.2.4.2), overhøjdeunderskud (4.2.4.3), pludselig ændring af I (4.2.4.4), radier og hældninger (4.2.3), sporafstand (tabel 4), sporvidde-IAL (tabel 12), konicitet (tabel 10), perroner (4.2.9) og dansk særtilfælde 7.7.4.1.',
    url: 'https://eur-lex.europa.eu/legal-content/DA/TXT/?uri=CELEX:02014R1299-20230928',
    gennemgaaet: true,
    adgang: 'aaben',
  },
];

export const refById = (id: string): Reference | undefined => REFERENCES.find((r) => r.id === id);

/** Har en grænseværdi mindst én frit tilgængelig kilde? kilde-strenge starter med reference-id. */
export function harAabenKilde(kilder: string[]): boolean {
  return kilder.some((k) => refById(k.split(' ')[0])?.adgang === 'aaben');
}
