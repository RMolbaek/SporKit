# SporKit

**Sporgeometri i lommen.** En mobilvenlig webapp, der beregner sporparametre efter Banedanmarks sporregler.

## Moduler

| Gruppe | Modul | Beregner |
|---|---|---|
| Linjeføring | **Overhøjde** | h<sub>a</sub>, I, E, a<sub>q</sub>, tilladt overhøjdeinterval, krumme sporskifter, tværprofil i ægte skala |
| | **Overgangskurve og rampe** | Mindste længde (dh/dt, dI/dt, rampe, stejleste rampe), også mellem ensvendte buer; klotoide, vridning fra rampe |
| | **Mindste radius** | R<sub>min</sub> for valgt h og I og ved blandet trafik |
| | **Største hastighed** | V<sub>max</sub> med hastighedsafhængig I-undtagelse og graf |
| | **Kurveelementer** | Tangentlængde, buelængde, toppunktsafstand med klotoider |
| Længdeprofil | **Lodret kurve** | T, pilhøjde, a<sub>v</sub>, kontrol af R<sub>v</sub> og stigning |
| I sporet | **Pilhøjde og vridning** | Pilhøjde ↔ radius, vridning over målebase, hastighed fra målt radius |
| | **Spor og perron** | Nominel perronafstand og tolerancer efter BN1-49-1 (drift, nyanlæg, fornyelse, sporjustering) |
| | **Sikkerhedszoner på perron** | Sikkerheds- og opholdszone, mindste perronbredde, afstribning, skilte og passagertæthed efter BN1-9-2 |
| | **Tracétavler** | Udfylder tracétavler (0, K, R, /\ og \/) med km ud fra linjeføring og længdeprofil efter BN2-93 og kontrollerer geometrien |
| | **Fritrum** | Breddeforøgelse e i kurver, højdeændring i afrundinger, vedligeholdelsestillæg og fritrum omkring skinnen efter BN1-166-1 |
| | **Kurveudvidelse** | Geometrisk overslag over køretøjers udbøjning |
| Overbygning | **Svelle og tværprofil** | Tegning af S99/S16 med 60E2, Fastclip og ballastprofil |
| | **Tværprofil (BN1-6)** | Interaktivt tværprofil for ét eller to spor med overhøjde; krav efter BN1-6-7 (nyanlæg, sporfornyelse, BN1-minimum), kontrol og mængder |
| Grundlag | **Regelgrundlag** | Grænseværdier med kildestatus og indstillinger (skinne, TSI-trafik, sportype, nyanlæg) |
| | **TSI INF** | Alle relevante grænser fra TSI INF (EU) 1299/2014 slået op efter hastighed |
| | **Referencer** | Referenceliste med anvendelse og gennemgangsstatus |

Alle moduler kan eksporteres som **PDF-beregningsrapport** med input, beregningsgang med indsatte tal, kontrol mod grænseværdier, referencer og signaturfelter (knappen *Eksportér PDF* → *Gem som PDF*).

## Grundformler

- h<sub>eq</sub> = C · V² / R, hvor C = e / (g · 3,6²) ≈ 11,8 (e = 1500 mm)
- I = h<sub>eq</sub>(V) − h  ·  E = h − h<sub>eq</sub>(V<sub>min</sub>)
- R<sub>min</sub> = C · V² / (h + I)  ·  V<sub>max</sub> = √(R · (h + I) / C)

## ⚠️ Grænseværdier

Alle grænseværdier ligger samlet i [`src/core/rules.ts`](src/core/rules.ts) med en kildestatus:

- **sekundær** – gengivet fra Banedanmarks lærebog *Sporteknik* (2016), som citerer Sporregler (fx h ≤ 160/180 mm, I ≤ 100 mm, I-undtagelse 130/153/160 mm, stigning, lodret radius)
- **antaget** – ingen dansk kilde fundet endnu (fx E, dh/dt, dI/dt, rampe 1:(k·V)) – skal kontrolleres
- **verificeret** – kontrolleret i det gældende regelsæt

**TSI INF** ([`src/core/tsi.ts`](src/core/tsi.ts)) er gengivet fra den konsoliderede udgave af forordning (EU) nr. 1299/2014 af 28.09.2023 og kontrolleres som et ekstra lag i modulerne for overhøjde, hastighed, radius, lodret kurve, pilhøjde/sporvidde og perron (kan slås fra under *Regelgrundlag*).

**BN1-38-6** ([`src/core/bn138.ts`](src/core/bn138.ts)) bruges til at kontrollere, at den projekterede geometri efterlader margin til sporkvalitetsnormerne: absolut overhøjde, vridning fra overhøjderamper pr. målebase, sporvidde og projekteret ækvivalent konicitet.

Perrontabellerne i [`src/core/perron.ts`](src/core/perron.ts) er gengivet fra BN1-49-1 (2006). Referencelisten ligger i [`src/core/references.ts`](src/core/references.ts).

SporKit er et hjælpeværktøj og erstatter ikke projektering efter gældende banenormer.

## Udvikling

```bash
npm install
npm run dev      # udviklingsserver
npm test         # enhedstest af formler
npm run build    # produktionsbygning i dist/
```

Teknik: Vite + TypeScript uden UI-framework. Appen er en PWA og virker offline efter første besøg. Ved push til `main` bygges og udgives den automatisk til GitHub Pages via `.github/workflows/deploy.yml` (Pages skal være slået til med kilden "GitHub Actions" under *Settings → Pages*).
