# Visualisations D3.js — Retards des vols 2019-2025

Les visualisations sont faites avec **D3.js** (version 7) et lisent directement la base `base/base.csv`.
**Tous les KPIs sont calculés dans le navigateur** (moyennes, taux, coûts, corrélations, réseau) :
le script Python `code/construire_base.py` construit uniquement la base.

## Ouvrir le tableau de bord

Un navigateur refuse de lire un fichier CSV ouvert directement depuis le disque (`file://`).
Il faut donc lancer un petit serveur web local, **depuis la racine du projet** (le dossier qui contient `base/` et `visualisations/`) :

```
cd /d "C:\Users\gbodo\Desktop\Master_Big_Data\Bloc1\Visualisation de l'information\projet_retards_vols\Redard-des-vols"
python -m http.server 8000
```

Puis ouvrir **http://localhost:8000/visualisations/** dans Chrome ou Edge.
La base (≈ 820 000 lignes) se charge en quelques secondes. Une connexion internet est nécessaire pour
D3.js et les fonds de carte (CDN jsDelivr).

## Organisation des fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | page : textes, filtres, emplacements des graphiques et des tableaux |
| `css/style.css` | mise en forme (couleurs, cartes, tableaux, mode sombre) |
| `js/commun.js` | `d3.csv()` : lecture de la base, sommes et moyennes pondérées, format français, info-bulles, tableaux HTML |
| `js/kpi1.js` | KPI 1 — évolution mensuelle du retard d'un aéroport vers ses destinations (`d3.line`) |
| `js/kpi2.js` | KPI 2 — causes de retard en barres empilées (`d3.stack`) |
| `js/kpi3.js` | KPI 3 — carte des aéroports (`d3.geoAlbersUsa`, `d3.geoConicConformal`, `d3.geoNaturalEarth1`) |
| `js/kpi4.js` | KPI 4 — coût estimé des retards (barres) |
| `js/kpi5.js` | KPI 5 — satisfaction ACSI et retard, nuage de points animé (`transition`) |
| `js/kpi6.js` | KPI 6 — corrélation coût / satisfaction : Pearson, Spearman, droite de régression |
| `js/kpi7.js` | KPI 7 — réseau des aéroports, sur carte ou en graphe de forces (`d3.forceSimulation`) |

## Principe de calcul

La base contient des **sommes** (vols, vols arrivés, minutes de retard…) et non des moyennes.
Chaque indicateur additionne d'abord les lignes sélectionnées, puis divise :
`retard moyen = somme des retards / nombre de vols arrivés`, `taux de retard = vols ≥ 15 min / vols arrivés`.
Les moyennes sont ainsi correctement pondérées, quel que soit le filtre choisi.

## Bibliothèques externes

- D3.js 7 — https://d3js.org
- topojson-client — https://github.com/topojson/topojson-client
- Fonds de carte : world-atlas (pays, Natural Earth) et us-atlas (États américains, US Census Bureau)
