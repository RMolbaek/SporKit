# SporKit

**Sporgeometri i lommen.** En mobilvenlig webapp, der beregner sporparametre efter Banedanmarks sporregler.

## Moduler

| Modul | Beregner |
|---|---|
| **Overhøjde** | Ligevægtsoverhøjde h<sub>eq</sub>, manglende overhøjde I, overskydende overhøjde E, sideacceleration a<sub>q</sub>, tilladt overhøjdeinterval og forslag til h |
| **Overgangskurve** | Mindste længde (dh/dt, dI/dt, rampe 1:(k·V), stejleste rampe), kontrol af valgt længde og klotoidens geometri (A, p, τ, X/Y, X<sub>m</sub>) |
| **Mindste radius** | R<sub>min</sub> for valgt h og I, samt ved blandet trafik (V og V<sub>min</sub>) |
| **Største hastighed** | V<sub>max</sub> for given R, h og I, med graf over V(R) |
| **Regelgrundlag** | Oversigt over alle grænseværdier og konstanter |

Hver kontrol vurderes som **OK** (≤ normalværdi), **Undtagelse** (≤ undtagelsesværdi) eller **Overskredet**.

## Grundformler

- h<sub>eq</sub> = C · V² / R, hvor C = e / (g · 3,6²) ≈ 11,8 (e = 1500 mm)
- I = h<sub>eq</sub>(V) − h  ·  E = h − h<sub>eq</sub>(V<sub>min</sub>)
- R<sub>min</sub> = C · V² / (h + I)  ·  V<sub>max</sub> = √(R · (h + I) / C)

## ⚠️ Grænseværdier

Alle grænseværdier ligger samlet i [`src/core/rules.ts`](src/core/rules.ts). De er et **arbejdsgrundlag og ikke verificeret** mod den gældende udgave af Banedanmarks sporregler. Når en værdi er kontrolleret, skal kilden (dokument, afsnit, udgave) skrives i `note`, og `verificeret` sættes til `true`.

SporKit er et hjælpeværktøj og erstatter ikke projektering efter gældende banenormer.

## Udvikling

```bash
npm install
npm run dev      # udviklingsserver
npm test         # enhedstest af formler
npm run build    # produktionsbygning i dist/
```

Teknik: Vite + TypeScript uden UI-framework. Appen er en PWA og virker offline efter første besøg. Ved push til `main` bygges og udgives den automatisk til GitHub Pages via `.github/workflows/deploy.yml` (Pages skal være slået til med kilden "GitHub Actions" under *Settings → Pages*).
