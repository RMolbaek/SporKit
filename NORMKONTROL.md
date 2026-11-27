# Normkontrol af SporKit

Gennemgang af alle grænseværdier og formler i SporKit mod de frit tilgængelige normer. Udført 27.11.2026.

**Status:**
- ✅ = stemmer med kilden.
- 🔧 = var forkert eller forældet og er rettet.
- ➕ = krav fra kilden, der manglede og er tilføjet.
- ⚠️ = tolkning eller antagelse, som brugeren bør kende.

## Kilder

Alle kilder er åbne og kan hentes frit:

| Kilde | Udgave | Hentet fra |
|---|---|---|
| Sporregler (SR87) | Konsolideret med rettelsesblade til 01.05.2017 | bane.dk |
| Sporteknik, 2. udg. (ST16) | 2016 | bane.dk |
| BN1-6-7 Tværprofiler for ballasteret spor | 01.04.2023 | bane.dk |
| BN1-9-2 Sikkerheds- og opholdszoner på perroner | 01.06.2012 | bane.dk |
| BN1-13-4 Ledningsanlæg | 23.07.2024 | bane.dk |
| BN1-38-6 Sporbeliggenhedskontrol og sporkvalitetsnormer | 01.01.2019 | bane.dk |
| BN1-49-1 Indbyrdes placering af spor og perron | 01.10.2006 | bane.dk |
| BN1-166-1 Fritrumsprofiler | 03.02.2025 | bane.dk |
| BN2-93-1 Absolut beliggenhed og fast afmærkning | 01.03.2011 | bane.dk |
| TSI INF (EU) 1299/2014 | Konsolideret 28.09.2023 | EUR-Lex |

## Sporregler – linjeføring

| Emne | Afsnit | Krav i kilden | SporKit før | Status |
|---|---|---|---|---|
| Konstant i h<sub>a</sub> | 2.03.2 formel (1) | 11,8 | 1500/(9,81·3,6²) = 11,798 | 🔧 nu 11,8 |
| Overhøjde, stenballast | 2.03.4 (7a), 2.03.5 | 160 mm; undtagelse 180 mm kun for spor reserveret persontrafik | 160/180 uanset trafik | 🔧 undtagelse 160 mm ved blandet trafik |
| Overhøjde i sporskifter | 2.03.4 (6), 2.03.5 | 120 mm; undtagelse 160 mm | ikke med | ➕ |
| Overhøjde, grusballast | 2.03.4 (7b) | 80 mm | ikke med | ➕ |
| Overhøjde langs perroner | 2.03.4 (8), 2.03.5 | 60 mm; undtagelse 110 mm | kun TSI 110 mm | ➕ |
| Afsporingskrav | 2.03.3 (4a) | h ≤ (R − 50)/1,5 altid | ikke med | ➕ overhøjde, radius, hastighed, profil, tracétavler |
| Ønskelig overhøjde og hastighed | 2.03.3 (4), 2.04.2 (12) | h = 8·V²/R ≤ 115 mm; V = √(h·R/8) | ikke med | ➕ |
| Overhøjdeunderskud I | 2.03.4–2.03.5 | 100 mm; 130 mm (V ≤ 140), 153 mm (140–250), særlige togsæt 160 mm, DSB45 130 mm | samme | ✅ |
| I i krumme sporskifter | 2.03.6 | 100 mm (V ≤ 100), 80 mm (100–200), ingen undtagelse | 80 mm ved V > 100, ellers 100/130 | 🔧 |
| Sporskifter ved 200 < V ≤ 250 | 2.03.6 | ret spor uden overhøjde | ikke med | ➕ overhøjde og forhindringer |
| Overhøjdeoverskud E | 2.03.4 (9) | E ≤ 110 mm | 70/110 mm («antaget») | 🔧 |
| Overkørsler | 2.03.8 | højst 40 mm på ret spor | 40 mm | ✅ |
| Mindste radius | 2.02.2–2.02.4 | hovedspor 700/300/150 m, øvrige togvejsspor 500/190/150 m, sidespor 190 m, firma- og havnespor 150 m, perronspor på ny strækning ret/300 m | kun beregnet ud fra h og I | ➕ efter sportype |
| Ret spor | 2.02.1 | R ≤ 25.000 m | 25.000 m | ✅ |
| dI/dt i klotoide | 2.05.2–2.05.3 (15a/b, 18/19) | 55/90 mm/s (V ≤ 200), 50/75 mm/s (200–250) | 55/70 mm/s («antaget») | 🔧 (rettet i forrige version) |
| Mindste overgangskurve | 2.05.2 | 20 m | ikke med | ➕ (forrige version) |
| Fiktivt ryk | 2.05.2–2.05.3, tillæg 2C | ΔI·V/(3,6·20) ≤ 28/135 mm/s (hovedspor), 71 mm/s (øvrige), ΔI ≤ 130/125/85/25 mm | ikke med | ➕ (forrige version) ⚠️ formel (15) står med «L» – læst som den fiktive længde 20 m |
| dh/dt, retlinet rampe | 2.06.2–2.06.4 (24–26b) | ønskeligt 35, normal 50, undtagelse 70 (V ≤ 200)/60 mm/s | 28/46 mm/s («antaget») | 🔧 (forrige version) |
| Rampestigning | 2.06.3–2.06.4 | 2,0 ‰; undtagelse 2,5 ‰ | 2,5 mm/m | 🔧 (forrige version) |
| Ikke-sammenfaldende rampe | 2.06.5 (28) | s ≤ 125/V ‰, dvs. 1:(8·V) | 1:(10·V)/1:(6·V) | 🔧 (forrige version) |
| Retlinet mellemstykke | 2.08.2–2.08.4 | ønsket 0,40·V, normal 0,25·V (min. 20 m), undtagelse 0,20·V; 0,67/0,40·V over 200 km/t; 0,10·V ved ΔI < 40 mm | ikke med | ➕ i hastighedsprofilen ⚠️ figur 2a/2b for små radier vises ikke |
| Stigning | 2.10.2 | ønskeligt 8 ‰, normal 12,5 ‰, undtagelse 15,6/25/35 ‰ efter trafik og længde | 10/15,6 ‰ (Sporteknik) | 🔧 |
| Stigning langs perron | 2.10.2 | ønskeligt 1,5 ‰, normal 2,5 ‰ (ny) / 10 ‰ (eksisterende), undtagelse 10 ‰ | 1,5 ‰ | 🔧 |
| Afrundingsradius | 2.10.3 (37–42) | ønskeligt 1,0·V² (10.000–40.000 m); normal 0,35·V² min. 5.000 m (nyanlæg, sporskifter) / 2.000 m (eksisterende); undtagelse 0,25·V² min. 2.000 m; V > 200: 0,35·V² ≥ 20.000 m og 0,175·V² ≥ 10.000 m | 5.000/40.000 m + a<sub>v</sub> 0,22/0,31 («antaget») | 🔧 a<sub>v</sub> 0,22/0,31 svarer præcis til 0,35/0,25·V² |
| Afrundingskurvens længde | 2.10.3 | ≥ 20 m (10 m i transversaler ved V ≤ 80); knæk ≤ 1 ‰ direkte | ikke med | ➕ |
| Projekteret sporvidde | 2.12.1 | 1437 mm for sveller (1435 mm tilladt frem til 31.05.2021) | 1435 mm som standard | 🔧 standard 1437 mm |
| Sporudvidelse | 2.12.2 figur 4 | +5/+10/+15 mm ved R < 190/175/150 m | samme (fra Sporteknik) | ✅ nu verificeret direkte |

## Banenormer

| Norm | Hvad er kontrolleret | Status |
|---|---|---|
| BN1-38-6 tabel 11.3.2-1 | Overhøjdeafvigelse, absolut overhøjde 177/180 og 187/190 mm, vridning på alle målebaser, Max-værdier og afsnit 17 (h > (R − 100)/2) | ✅ |
| BN1-38-6 tabel 11.3.2-2 | Sporvidde i alle kvalitetsklasser | ✅ |
| BN1-38-6 fodnote 10 | Ved projekteret 1437 mm regnes fejlklasse 0 og 1 fra 1437 mm, men minustolerancerne i fejlklasse 3, 4 og Max fra 1435 mm | 🔧 blev regnet fra 1437 mm |
| BN1-38-6 tabel 11.5.2-1/-2 | Konicitet: grænser og beregnede værdier | ✅ 60E1-værdierne er tilføjet ➕ |
| BN1-49-1 | Figur 8.2-1 (perronafstand), tillæg for R < 250 m, perronfremspring +50 mm, figur 9-1 og 11-1 (tolerancer inkl. fodnoter), nominelle højder | ✅ ⚠️ udgaven er fra 2006 |
| BN1-9-2 | b<sub>sik</sub> 0,75/0,85/1,35 m, b<sub>oph</sub> 2,0/1,6 m, perronbredde, fri højde 2,3 m, afstribning (Ø10 cm/20 cm, 0–5 mm), tæthed 0,7/1,0 pers./m², korte genstande 2,4 m, skilte hver 50 m | ✅ |
| BN1-166-1 | e = 3750/R og 60.000/R − 225, forløb (figur 12-2–12-7), ΔhRv = 50.000/Rv, vedligeholdelsestillæg, m/n omkring skinnen, profilerne D/D-GC/SD | ✅ |
| BN1-13-4 | 1,6 m under SO, 10·D + 1 m, 2,0 m, 7·reamer + 1 m, grøft + 0,5 m, ≤ 15°, 10 m fra sporskifter, overcut 25/10 mm, D ≤ 0,2/0,4 m, gasafstande 8/15, 15/25 og 2,0/2,4 m, 0,75·D·P, bygværker, skinneafstivning (anlæg 1,5), langsgående ledninger 2,5/3,5/1,3/0,5/0,75 m, brønde 2,5/2,3 m, kabelrende tabel 12.7-1 | ✅ ⚠️ skinneafstivning ved *indvendig* diameter > 1 m – SporKit bruger den udvendige (på den sikre side) |
| BN1-6-7 | Figur 10.2.3-2, 12.1-4 og 15.1-3 med fodnoter (Pb-tillæg ved overhøjde, forhøjet skulder, korte betonsveller, aksellast), 12.1-1 og 12.1-2 (overgangszoner), 15.1 (Loz 14/17/20 m, HB 5 m, EV2 80/115/120 MPa) | ✅ |
| BN2-93-1 | Tracétavler (0-, K- og R-tavler, længdeprofiltavler), tolerance 0,3 m | ✅ kontrolleret mod bilagets eksempler 1–9 |

## TSI INF

Følgende stemmer med den konsoliderede udgave fra 28.09.2023 ✅:
- Tabel 4 (sporafstand), tabel 7 (overhøjde 160/170/180 mm, perron 110 mm, (R − 50)/1,5) og tabel 8 (I 153/100/130 mm).
- 4.2.3.3–4.2.3.5 (stigning og radier).
- Tabel 10 (konicitet), tabel 12 (sporvidde), 4.2.8.5 (180/190 mm) og 4.2.8.6 (sporskifter).
- 4.2.9 (perroner 550/760 mm og S-tog 920 mm i 7.7.4.1).
- Tabel 2/3 (profiler og perronlængder).

## Sporteknik (overbygning)

Følgende stemmer med bogen ✅:
- Overbygningstyper og betegnelser (figur 18 og 35) og km pr. type medio 2016 (figur 132).
- Skinneprofiler (figur 92) og sveller (S89/S99/S16 og træ 2600 × 260 × 160).
- Mellemlæg 94/77 kN/mm, svelleafstand 625 mm og mindste radius i langskinnespor (Dmp 400 m, Dt 700 m).

⚠️ To-blok- og stålsveller har ingen mål i bogen. De er tegnet skematisk.

## Formler

Følgende er kontrolleret og stemmer ✅:
- h<sub>a</sub>, I, E, a<sub>q</sub>, V<sub>max</sub> og R<sub>min</sub> (Sporregler formel 1–14).
- Klotoide (Fresnel-rækker, p, X<sub>m</sub>, A).
- Kurveelementer (T, L<sub>c</sub>, E).
- Lodret kurve (T = R·|Δi|/2000, f = T²/2R, a<sub>v</sub> = v²/R).
- Pilhøjde (eksakt).
- Kurveudvidelse (a²/8R og (L² − a²)/8R).
- Overhøjdens drejning om inderskinnen.

Mindste radius ved blandet trafik tager nu også højde for formel (4a) ➕.

## IFC-model

IFC-modulet bruger de samme formler som resten af SporKit. Desuden er det kontrolleret, at modellen følger normerne langs sporet, og at filerne er gyldige.

**Normer langs sporet:**

| Emne | Kilde | Sådan gør SporKit | Status |
|---|---|---|---|
| Breddeforøgelse e | BN1-166-1 afsnit 12, formel 12.1/12.2 | e = 3750/R (250–300 m) og 60.000/R − 225 (150–250 m) i hele profilhøjden; nedrunding til 0 ved R ≥ 300 m kan slås fra | ✅ |
| Forløb af e | Figur 12-2 – 12-7 | Lineært over overgangskurver (også mellem to kurver). Ved R ≤ 250 m uden overgangskurve: fra 12 m til fuld værdi 2 m før BP, fra nabokurvens værdi. Ved R > 250 m: fuld værdi i tangentpunktet | ✅ |
| Højdeændring ΔhRv | Afsnit 13, formel 13.1 | 50.000/Rv; højder ≤ 1170 mm formindskes (aldrig under SO), 3300 < h ≤ 4800/4820 mm forøges; lineært fra 25 m før tangentpunktet | ✅ |
| Vedligeholdelsestillæg | Afsnit 10.4 | Ballastspor 50/100 mm, fast spor 25/50 mm (vandret/lodret) | ✅ |
| R < 150 m og Rv < 500 m | Afsnit 12 og 13 | Kræver dispensation. Formlerne bruges alligevel med en advarsel om eftervisning efter EN 15273 | ⚠️ |
| Overhøjde | Sporregler / Banedanmark-praksis | Sporplan og fritrum drejes om den indvendige skinnes SO (skinnemidte 753,5 mm, θ = arcsin(h/1500)). I IFC 4.3 hæves kun den ydre skinne (IfcAlignmentCant, skinnehovedafstand 1,5 m) | ✅ |
| Ballast og planum | BN1-6-7 fodnote 4 og 7/8/10 | Pb-tillæg i kurvens yderside og forhøjet skulder beregnes pr. tværsnit ud fra h og R. Øvrige mål hentes fra Tværprofil-modulet | ✅ |
| Skinne | EN 13674-1 (henvisning) | Forenklet 60E2-omrids (16 punkter) med hældning 1:40. Bruges kun til visualisering og kollisionskontrol | ⚠️ |

**Måling på den eksporterede geometri.** En særskilt test-LandXML er bygget med:
- R 200 m uden overgangskurve og en sammensat kurve R 200 → 280 m.
- En overgangskurve R 280 → 180 m, R 180 m og en overgangskurve ud.
- R 350 m.
- Afrundingskurver med Rv 1000 m (cirkel), 2000 m (parabel) og 600 m (cirkel).

Knudepunkterne i IFC-filen er projiceret ind på sporet og sammenlignet med normens værdier, beregnet uafhængigt i Python. Det gælder for alle 996 tværsnit:
- Halv bredde = 2000 + e + 50 mm.
- Top = 4800 + ΔhRv + 100 mm.
- Bund i spormidten = max(0, 50 − ΔhRv).
- Hylden i 760 mm og hjørnet i 3530 mm.

Største afvigelse er 0,07 mm, dvs. koordinaternes afrunding. En regressionstest måler det samme i sporplanet med op til 120 mm overhøjde.

🔧 Fundet og rettet: Præcis i det fælles tangentpunkt mellem to kurver uden overgangskurve (R 200 → 280 m) blev den største kurves e brugt. Nu bruges det største tillæg (figur 12-4/12-5).

**Overgange for kurvetillægget, kontrolleret mod figurerne i BN1-166-1 (side 28–29).** Endnu en test-LandXML er målt på samme måde. Den indeholder:
- ret → R 270 m uden overgangskurve
- ret → overgangskurve → R 200 m → overgangskurve
- 8 m ret → modkurve R 220 m uden overgangskurve
- sammensatte kurver R 300 → 260 → 240 m

Alle 719 tværsnit stemmer:

| Figur | Regel | Status |
|---|---|---|
| 12-2 | R > 250 m: fuldt tillæg i kurvens begyndelsespunkt (spring) | ✅ |
| 12-3 | R ≤ 250 m uden overgangskurve: lineært fra 12 m til fuld værdi 2 m før BP – også når rampen rækker ind i en foregående overgangskurve | ✅ |
| 12-4 | To kurver > 250 m: tillægget er til stede i det fælles tangentpunkt | ✅ |
| 12-5 | Ind i den mindste kurve (≤ 250 m): fra e₁ 12 m før til e₂ 2 m før tangentpunktet | ✅ |
| 12-6 / 12-7 | Lineært over overgangskurven | ✅ |
| Udgang af kurve | Figurerne viser kun indgangen. SporKit spejler reglerne ved udgangen, da tog kører begge veje | ⚠️ |

🔧 Rampen for R ≤ 250 m søges nu efter afstand (alle kurver inden for 12 m) i stedet for kun to elementer frem og tilbage.

**Inderside og yderside.** Målt på modellens geometri i både en højre- og en venstrekurve (R 350 m, h = 100 mm):

| Forhold | Kilde | Resultat |
|---|---|---|
| Ydersiden bestemmes af kurveretningen (højrekurve → venstre side er yderside) | – | ✅ også i LandXML (rot cw/ccw, CantStation curvature) |
| Overhøjde: den ydre skinnestreng løftes, den indre ligger i profilkoten | Sporregler 2.03.1 | ✅ ydre skinne + h·1507/1500 |
| Fritrummet hælder med SO-planet; højder måles vinkelret på og bredder parallelt med SO-planet | BN1-166-1 10.2, fig. 10.2-1 | ✅ toppen flyttes 328 mm mod kurvens centrum; tilbage i sporplanet er profilet symmetrisk |
| Breddeforøgelse e på både inder- og yderside | BN1-166-1 fig. 12-1 | ✅ |
| Profilmidte midt i det udvidede spor | BN1-166-1 5.33 | ✅ linjeføringen er profilmidten |
| Pb-tillæg kun i kurvens yderside | BN1-6-7 fodnote 4 | ✅ +0,30 m i ydersiden, intet i indersiden |
| Forhøjet ballastskulder kun i ydersiden | BN1-6-7 fodnote 7/8/10 | ✅ |
| IFC 4.3: overhøjden på den ydre skinne (StartCantLeft/Right) | IFC 4.3 | ✅ |
| ➕ Sporudvidelse: +5/+10/+15 mm ved R < 190/175/150 m, fuld i cirkelbuens startpunkt og jævnt over overgangskurven. Uden overgangskurve etableres den med 2,5 mm pr. 5 sveller. Hver skinne flyttes det halve udad. | Sporregler 2.12.2 | ✅ tilføjet på skinnerne |

**DXF:** DXF-eksporten (R12) er valideret med ezdxf: 0 fejl, globale koordinater, og volumenerne er de samme som i IFC.

**Linjeføring:**
- Klotoider integreres numerisk (Simpson, højst 1 m mellem knudepunkter).
- Elementerne forankres i filens start-koordinater og -retninger.
- Kontrol mod en uafhængig Python-integration af eksempel-LandXML'en giver højst 0,13 mm afvigelse i endepunkterne.
- Længdeprofilet bygges ud fra PVI'er med parabler (ParaCurve) eller eksakte cirkelbuer (CircCurve). Pilhøjden ved PVI er (g₂ − g₁)·L/8.

**Validering med IfcOpenShell 0.9 (EXPRESS-regler slået til) af eksempelmodellen:**

| Format | Entiteter | Fejl |
|---|---|---|
| IFC4X3_ADD2 | ca. 2.100 | 0 |
| IFC4 | ca. 1.800 | 0 |
| IFC2X3 | ca. 280.000 | 0 |

**Geometrisk kontrol:**
- Alle legemer er lukkede og udadvendte. En test kræver, at hver kant bruges præcis én gang i hver retning.
- Alle volumener er positive.
- Mængderne svarer til håndberegning: 2 × 1.560 m skinne giver ca. 25 m³, og 2.600 sveller giver ca. 347 m³.

**IfcAlignment (IFC 4.3):**
- IfcCompositeCurve og IfcGradientCurve skrives med samme kortlægning som IfcOpenShell. Evalueret af IfcOpenShell afviger kurverne højst 0,11 mm fra SporKits egne punkter, både i plan og i kote.
- Kurverne er også genopbygget alene ud fra de semantiske segmenter (IfcAlignmentHorizontal, Vertical og Cant) med IfcOpenShell. Resultatet stemmer med 0,11 mm.
- IfcSegmentedReferenceCurve er identisk med IfcOpenShells (0,000 mm) og ligger h/2 over profilet, dvs. i spormidten ved drejning om den indvendige skinne.

⚠️ Overgangskoden mellem en klotoide og en *højre*kurve skriver SporKit som CONTSAMEGRADIENTSAMECURVATURE (matematisk korrekt), mens IfcOpenShell 0.9 vurderer den til CONTSAMEGRADIENT.

