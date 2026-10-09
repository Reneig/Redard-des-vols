# Retards des vols aux États-Unis et en Europe (2019-2025)

Projet du Master Big Data · Bloc 1 · Visualisation de l'information.

**Équipe :** GBODOGBE Zinsou René · SUMAN Jaskaran · TAGHBALOUT Abdallah · KALAMI Akram · TIEMTORE Ariel Eddy

Le tableau de bord présente **5 indicateurs interactifs** construits avec **D3.js** (version 7) à partir d'une seule base de données réelles (aucune donnée simulée) :

1. **Évolution** : les retards augmentent-ils ?
2. **Causes** : pourquoi les vols sont-ils en retard ?
3. **Aéroports** : où sont les retards ?
4. **Coût** : combien coûtent les retards (en euros de chaque année) ?
5. **Réseau** : comment le réseau aérien évolue-t-il ?

Tous les indicateurs sont calculés **dans le navigateur**, à partir de la base. Le script Python ne sert qu'à construire la base.

---

## Démarrage rapide (3 étapes)

> **La base de données est déjà incluse** dans le dépôt, sous forme compressée : `base/base.csv.gz` (≈ 23 Mo).
> Il n'y a **rien à télécharger ni à décompresser** : le tableau de bord la lit directement.

### Ce qu'il faut

- **Python 3** — uniquement pour lancer un petit serveur web local (aucune bibliothèque à installer).
  Sous Windows : [python.org/downloads](https://www.python.org/downloads/), en cochant **« Add Python to PATH »** pendant l'installation.
- Un navigateur récent : **Google Chrome**, **Microsoft Edge** ou **Firefox**.
- Une **connexion internet** (D3.js et les fonds de carte sont chargés depuis le CDN jsDelivr).

### Étape 1 — Récupérer le projet

Sur la page GitHub du projet : bouton vert **Code** → **Download ZIP**, puis **décompressez** le fichier ZIP
(clic droit → *Extraire tout…*). Ne lancez pas le projet depuis l'intérieur du ZIP.

Avec Git, à la place : `git clone https://github.com/Reneig/Redard-des-vols.git`

### Étape 2 — Lancer le tableau de bord

**Windows :** double-cliquez sur **`lancer_tableau_de_bord.bat`**.
Une fenêtre noire s'ouvre (le serveur), puis le navigateur affiche le tableau de bord après 2 secondes.

**macOS / Linux, ou à la main sous Windows :** ouvrez un terminal **dans le dossier du projet**
(celui qui contient `base/` et `visualisations/`) et tapez :

```
python -m http.server 8000        # Windows
python3 -m http.server 8000       # macOS / Linux
```

puis ouvrez dans le navigateur : **http://localhost:8000/visualisations/synthese.html**

### Étape 3 — Consulter

La base (≈ 823 000 lignes) se charge en **5 à 15 secondes**. **Laissez la fenêtre du serveur ouverte** pendant la consultation ;
pour arrêter, fermez-la (ou `Ctrl + C`).

| Page | Adresse |
|---|---|
| **Tableau de bord principal (5 KPIs)** | http://localhost:8000/visualisations/synthese.html |
| Présentation du projet (construction de la base, calculs, sources) | http://localhost:8000/visualisations/presentation.html |
| Version détaillée (7 visuels d'origine, dont satisfaction ACSI et corrélations) | http://localhost:8000/visualisations/ |

> **Pourquoi un serveur local ?** Par sécurité, un navigateur refuse de lire un fichier de données depuis une page
> ouverte directement depuis le disque (adresse en `file://`). Le serveur Python contourne ce blocage, sur votre seul ordinateur.

---

## En cas de problème

| Message ou symptôme | Solution |
|---|---|
| « Impossible de lire la base » | Vérifiez que `base/base.csv.gz` est présent, et que le serveur a été lancé **depuis le dossier du projet** (celui qui contient `base/` et `visualisations/`), pas depuis `visualisations/`. |
| `python` n'est pas reconnu | Windows : réinstallez Python en cochant « Add Python to PATH », ou essayez `py -m http.server 8000`. macOS : utilisez `python3`. |
| « Address already in use » / port occupé | Remplacez `8000` par `8001` dans la commande **et** dans l'adresse. |
| Le navigateur affiche « Impossible de se connecter » | Le serveur n'est pas lancé, ou a été fermé : relancez `lancer_tableau_de_bord.bat`. |
| Page blanche ou « d3 is not defined » | Pas de connexion internet : D3.js n'a pas pu être chargé. |
| La carte n'a pas de contours | Fonds de carte indisponibles (connexion internet). Les aéroports s'affichent quand même. |
| Safari : erreur de chargement | Utilisez Chrome, Edge ou Firefox (ou Safari 16.4 minimum). |
| Les modifications n'apparaissent pas | Rechargez sans le cache : `Ctrl + F5` (Windows) ou `Cmd + Shift + R` (macOS). |

---

## Utiliser le tableau de bord

- **Zone** (en haut) : **États-Unis** ou **Europe**.
- **Barre de filtres** (toujours visible) : **État ou pays**, puis **aéroport**, et **compagnie** (USA). Tous les graphiques suivent les filtres.
- **Survol** : chaque barre, cercle, courbe ou liaison affiche son détail dans une info-bulle.
- **Clic** sur un aéroport (carte, classement ou réseau) : toute la page se filtre sur cet aéroport.
- **Bouton « ∑ Méthode de calcul »** sur chaque KPI : colonnes utilisées, étapes, formules et exemple chiffré.
- **Bouton « ▦ Tableau visuel »** sur chaque KPI : quel canal visuel code chaque variable (classement de Mackinlay, 1986) et quelles couleurs sont utilisées.
- **KPI 5 (Réseau)** : curseur des mois, bouton **▶ Animer**, seuil de vols, vue **Carte** ou **Graphe de forces**.

---

## Organisation des fichiers

```
Redard-des-vols/
├── base/
│   └── base.csv.gz              ← la base de données (compressée, lue directement par le navigateur)
├── code/
│   └── construire_base.py       ← construit la base à partir des sources officielles
├── visualisations/
│   ├── synthese.html            ← TABLEAU DE BORD PRINCIPAL (5 KPIs : HTML, CSS et D3.js dans un seul fichier)
│   ├── presentation.html        ← présentation du projet
│   ├── index.html               ← version détaillée (7 visuels)
│   ├── css/                     ← styles de la version détaillée
│   └── js/                      ← scripts D3.js de la version détaillée (commun.js, kpi1.js … kpi7.js)
├── lancer_tableau_de_bord.bat   ← lanceur Windows
├── SOURCES.md                   ← sources des données, avec les liens
└── README.md                    ← ce fichier
```

---

## La base de données

| | |
|---|---|
| Fichier | `base/base.csv.gz` (≈ 23 Mo compressé, ≈ 135 Mo décompressé) |
| Lignes | ≈ 823 000 (≈ 795 000 USA + ≈ 28 600 Europe) |
| Colonnes | 43 |
| Période | janvier 2019 – décembre 2025, au mois |
| USA | une ligne = compagnie × aéroport de départ × aéroport d'arrivée × mois (≈ 45,8 millions de vols) |
| Europe | une ligne = aéroport × mois |

**Pourquoi compressée ?** GitHub refuse les fichiers de plus de 100 Mo. Le CSV fait environ 135 Mo ; compressé en gzip,
il tient en environ 23 Mo. Le navigateur le décompresse lui-même (`DecompressionStream`) au chargement.
Si `base.csv.gz` est absent, le tableau de bord lit `base/base.csv` à la place.

La base contient des **sommes** (vols, vols arrivés, minutes de retard…) et non des moyennes.
Chaque indicateur additionne d'abord les lignes sélectionnées, puis divise :

- `taux de retard = Σ vols arrivés avec ≥ 15 min de retard ÷ Σ vols arrivés`
- `retard moyen = Σ minutes de retard ÷ Σ vols arrivés`

Les moyennes restent ainsi justes, quel que soit le filtre choisi.

**Coûts en euros de chaque année :**
- USA : coût d'une minute publié par Airlines for America (en dollars de l'année) ÷ taux de change moyen de l'année (BCE).
- Europe : 100 € par minute de retard ATFM (valeur de référence 2026), ramenés à chaque année avec l'inflation de la zone euro (Eurostat).

---

## Reconstruire la base (facultatif)

Inutile pour consulter le tableau de bord. Pour refaire la base depuis les sources officielles :

```
pip install pandas numpy requests
python code/construire_base.py
```

Le script télécharge plusieurs Go de données (84 fichiers mensuels du BTS, fichiers EUROCONTROL, OurAirports) :
compter de 30 minutes à plus d'une heure. S'il s'interrompt, relancez-le : il reprend là où il s'était arrêté.
Il écrit `base/base.csv`. Comme le tableau de bord lit en priorité `base.csv.gz`, **recompressez ensuite la nouvelle base** :

```
python -c "import gzip,shutil;shutil.copyfileobj(open('base/base.csv','rb'),gzip.open('base/base.csv.gz','wb',9))"
```

Les dossiers `donnees_brutes/`, `donnees_intermediaires/` et le fichier `base/base.csv` ne sont pas envoyés sur GitHub (voir `.gitignore`).

---

## Sources

Bureau of Transportation Statistics (vols USA) · EUROCONTROL Aviation Intelligence Portal (aéroports européens) ·
OurAirports (coordonnées) · Airlines for America et EUROCONTROL (coût d'une minute de retard) · BCE (taux de change) ·
Eurostat (inflation) · ACSI (satisfaction des passagers). Détail et liens dans `SOURCES.md` et `visualisations/presentation.html`.

**Limites principales :** pas de base mondiale gratuite des retards vol par vol, donc USA (BTS) et Europe (EUROCONTROL) seulement ;
les données européennes sont par aéroport et par jour, sans compagnie ni destination ; les coûts sont des estimations
(minutes réelles × coût unitaire publié), pas des coûts comptables.

## Bibliothèques externes

- D3.js 7.9.0 — https://d3js.org
- topojson-client 3.1.0 — https://github.com/topojson/topojson-client
- Fonds de carte : world-atlas (pays) et us-atlas (États américains)
