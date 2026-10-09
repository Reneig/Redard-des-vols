# Retards des vols aux États-Unis et en Europe (2019-2025)

Projet du Master Big Data · Bloc 1 · Visualisation de l'information.

**Équipe :** GBODOGBE Zinsou René · SUMAN Jaskaran · TAGHBALOUT Abdallah · KALAMI Akram · TIEMTORE Ariel Eddy

Le tableau de bord présente **5 indicateurs interactifs** construits avec **D3.js** (version 7) à partir d'une seule base de données réelles :

1. **Évolution** : les retards augmentent-ils ?
2. **Causes** : pourquoi les vols sont-ils en retard ?
3. **Aéroports** : où sont les retards ?
4. **Coût** : combien coûtent les retards (en euros de chaque année) ?
5. **Réseau** : comment le réseau aérien évolue-t-il ?

Tous les indicateurs sont calculés dans le navigateur. Le script Python ne fait que construire la base.

---

## Ouvrir le tableau de bord sur votre ordinateur

### Ce qu'il faut

- **Python 3** (déjà installé sur macOS et Linux ; sous Windows : [python.org](https://www.python.org/downloads/), cochez « Add Python to PATH »).
- **Google Chrome**, **Firefox** ou **Edge** (Safari peut échouer sur le gros fichier de données).
- Une **connexion internet** (D3.js et les fonds de carte sont chargés depuis le CDN jsDelivr).

### Étape 1 — Récupérer le projet

Sur GitHub, bouton vert **Code** → **Download ZIP**, puis décompressez le dossier.
(Ou, avec Git : `git clone https://github.com/Reneig/Redard-des-vols.git`.)

### Étape 2 — Ajouter la base de données

Le fichier `base.csv` (≈ 135 Mo) **n'est pas sur GitHub**, car il dépasse la limite de 100 Mo par fichier.
Il est fourni à part (lien partagé par l'équipe). Placez-le exactement ici :

```
Redard-des-vols/
├── base/
│   └── base.csv        ← le fichier à ajouter (créez le dossier « base » s'il n'existe pas)
├── code/
├── visualisations/
├── lancer_tableau_de_bord.bat
└── lancer_tableau_de_bord.command
```

Le nom doit être exactement `base.csv`, en minuscules.

> Pour reconstruire la base depuis les sources officielles à la place : `python code/construire_base.py`
> (télécharge plusieurs Go de données, compter un long moment).

### Étape 3 — Lancer le tableau de bord

Un navigateur refuse de lire un fichier CSV ouvert directement depuis le disque (`file://`) : il faut un petit serveur web local.
Les deux lanceurs ci-dessous le démarrent et ouvrent la page automatiquement.

| Système | Méthode la plus simple |
|---|---|
| **Windows** | Double-cliquez sur `lancer_tableau_de_bord.bat` |
| **macOS** | Double-cliquez sur `lancer_tableau_de_bord.command` (la première fois : clic droit → **Ouvrir** → **Ouvrir**) |

**Ou à la main, dans un terminal**, depuis le dossier `Redard-des-vols` (celui qui contient `base/` et `visualisations/`) :

```
python -m http.server 8000        # Windows
python3 -m http.server 8000       # macOS / Linux
```

Puis ouvrez dans le navigateur :

| Page | Adresse |
|---|---|
| **Tableau de bord (5 KPIs)** | http://localhost:8000/visualisations/synthese.html |
| Présentation du projet (construction de la base, calculs, sources) | http://localhost:8000/visualisations/presentation.html |
| Version détaillée (7 visuels d'origine) | http://localhost:8000/visualisations/ |

La base (≈ 823 000 lignes) se charge en quelques secondes. **Laissez la fenêtre du terminal ouverte** pendant la consultation ;
pour arrêter le serveur, fermez-la ou faites `Ctrl + C`.

### En cas de problème

| Message ou symptôme | Solution |
|---|---|
| « Impossible de lire la base » | Vérifiez que le fichier est bien `base/base.csv` et que le serveur a été lancé **depuis le dossier `Redard-des-vols`**, pas depuis `visualisations/`. |
| « TypeError: Load failed » dans Safari | Ouvrez la même adresse dans Chrome ou Firefox. |
| « Address already in use » / port occupé | Remplacez `8000` par `8001` dans la commande et dans l'adresse. |
| `python` n'est pas reconnu | Windows : réinstallez Python en cochant « Add Python to PATH ». macOS : utilisez `python3`. |
| La carte n'a pas de contours | Vérifiez la connexion internet (fonds de carte en ligne). Les aéroports s'affichent quand même. |

---

## Utiliser le tableau de bord

- **Barre de filtres** (en haut, toujours visible) : zone **États-Unis / Europe**, puis **État ou pays**, puis **aéroport**, et **compagnie** (USA). Tous les graphiques suivent les filtres.
- **Survol** : chaque barre, cercle, courbe ou liaison affiche son détail.
- **Clic** sur un aéroport (carte, classement ou réseau) : toute la page se filtre sur cet aéroport.
- **Bouton « ▦ Tableau visuel »** sur chaque KPI : montre, avec le classement de Mackinlay (1986), quel canal visuel code chaque variable, et les couleurs utilisées (teinte, saturation, luminosité).

## Organisation des fichiers

| Fichier | Rôle |
|---|---|
| `visualisations/synthese.html` | **Tableau de bord principal** : les 5 KPIs (HTML, CSS et script D3.js dans un seul fichier) |
| `visualisations/presentation.html` | Présentation : contexte, sources, construction de la base, variables calculées, conversion en euros, fonctions D3.js |
| `visualisations/index.html`, `css/`, `js/` | Version détaillée d'origine (7 visuels, dont satisfaction ACSI et corrélations) |
| `code/construire_base.py` | Construit `base/base.csv` à partir des fichiers officiels (BTS, EUROCONTROL, OurAirports…) |
| `SOURCES.md` | Liste des fichiers téléchargés et de leurs sources |
| `lancer_tableau_de_bord.bat` / `.command` | Lanceurs Windows / macOS |

## Principe de calcul

La base contient des **sommes** (vols, vols arrivés, minutes de retard…) et non des moyennes.
Chaque indicateur additionne d'abord les lignes sélectionnées, puis divise :
`taux de retard = Σ vols ≥ 15 min ÷ Σ vols arrivés`, `retard moyen = Σ minutes de retard ÷ Σ vols arrivés`.
Les moyennes restent ainsi correctes quel que soit le filtre choisi.

**Coûts en euros de chaque année :**
- USA : coût d'une minute publié par Airlines for America (dollars de l'année) ÷ taux de change moyen de l'année (BCE).
- Europe : 100 € par minute de retard ATFM (valeur de référence 2026), ramenés à chaque année avec l'inflation de la zone euro (Eurostat).

## Sources

Bureau of Transportation Statistics (vols USA) · EUROCONTROL Aviation Intelligence Portal (aéroports européens) ·
OurAirports (coordonnées) · Airlines for America et EUROCONTROL (coût d'une minute) · BCE (taux de change) ·
Eurostat (inflation) · ACSI (satisfaction). Détail et liens dans `visualisations/presentation.html` et `SOURCES.md`.

## Bibliothèques externes

- D3.js 7.9.0 — https://d3js.org
- topojson-client 3.1.0 — https://github.com/topojson/topojson-client
- Fonds de carte : world-atlas (pays) et us-atlas (États américains)
