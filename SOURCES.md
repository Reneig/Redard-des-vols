# Sources des données – projet « Retards des vols » (2019-2025)

Aucune donnée n'est simulée ni inventée. Chaque fichier brut est téléchargé par `code/construire_base.py` depuis l'adresse ci-dessous ; chaque téléchargement est tracé (date, URL, taille) dans `donnees_brutes/journal_telechargements.csv`.

## Bases téléchargées automatiquement par le script

| # | Base | Producteur | Contenu | Fichiers / URL | Dossier |
|---|---|---|---|---|---|
| 1 | Reporting Carrier On-Time Performance (1987-present) | Bureau of Transportation Statistics (BTS), US DOT | Vol par vol, vols intérieurs des compagnies US : retards départ/arrivée, annulations, détournements, minutes de retard par cause (compagnie, météo, NAS, sûreté, avion précédent) | `https://transtats.bts.gov/PREZIP/On_Time_Reporting_Carrier_On_Time_Performance_1987_present_{année}_{mois}.zip` (84 fichiers) – description : https://www.transtats.bts.gov/Fields.asp?gnoyr_VQ=FGJ | `donnees_brutes/bts_ontime/` |
| 2 | Table des compagnies (L_UNIQUE_CARRIERS) | BTS | Code → nom de compagnie | https://www.transtats.bts.gov/Download_Lookup.asp?Y11x72=Y_haVdhR_PNeeVRef | `donnees_brutes/bts_lookup/` |
| 3 | Table des aéroports (L_AIRPORT) | BTS | Code IATA → nom de l'aéroport | https://www.transtats.bts.gov/Download_Lookup.asp?Y11x72=Y_NVecbeg | `donnees_brutes/bts_lookup/` |
| 4 | Airport Traffic | EUROCONTROL – Aviation Intelligence Portal | Départs et arrivées IFR par aéroport et par jour | `https://www.eurocontrol.int/performance/data/download/csv/airport_traffic_{année}.csv` – description : https://ansperformance.eu/reference/dataset/airport-traffic/ | `donnees_brutes/eurocontrol/` |
| 5 | Airport Arrival ATFM Delay | EUROCONTROL | Minutes de retard ATFM à l'arrivée par aéroport, jour et cause (météo, capacité, personnel ATC, grèves…) | `https://www.eurocontrol.int/performance/data/download/csv/apt_dly_{année}.csv.bz2` – description : https://ansperformance.eu/reference/dataset/airport-arrival-atfm-delay/ | `donnees_brutes/eurocontrol/` |
| 6 | All-causes pre-departure delay | EUROCONTROL | Minutes de retard au départ, toutes causes, par aéroport et par jour (publié à partir de 2020) | `https://www.eurocontrol.int/performance/data/download/csv/all_pre_departure_delays_{année}.csv` – liste : https://ansperformance.eu/csv/ | `donnees_brutes/eurocontrol/` |
| 7 | OurAirports | OurAirports (domaine public) | Coordonnées GPS, codes IATA/ICAO, pays | https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv et `countries.csv` – site : https://ourairports.com/data/ | `donnees_brutes/ourairports/` |

## Valeurs recopiées depuis des pages web officielles (écrites par le script, URL sur chaque ligne)

| # | Base | Producteur | Valeurs | Pages sources | Fichier |
|---|---|---|---|---|---|
| 8 | Coût d'une minute de retard – USA | Airlines for America (A4A), d'après DOT Form 41 | 2019 : 74,24 $ ; 2021 : 80,52 $ ; 2022 : 101,18 $ ; 2023 : 100,80 $ ; 2024 : 100,76 $ ; 2025 : 98,41 $ (aucune valeur publiée pour 2020) | Page actuelle : https://www.airlines.org/dataset/u-s-passenger-carrier-delay-costs/ — versions archivées de la même page (Internet Archive) : 2019 https://web.archive.org/web/20210619164556/https://www.airlines.org/dataset/u-s-passenger-carrier-delay-costs/ · 2021 https://web.archive.org/web/20230130155023/https://www.airlines.org/dataset/u-s-passenger-carrier-delay-costs/ · 2022 https://web.archive.org/web/20240120213649/https://www.airlines.org/dataset/u-s-passenger-carrier-delay-costs/ · 2023 https://web.archive.org/web/20241128205616/https://www.airlines.org/dataset/u-s-passenger-carrier-delay-costs/ · 2024 https://web.archive.org/web/20251208122523/https://www.airlines.org/dataset/u-s-passenger-carrier-delay-costs/ | `donnees_brutes/couts/cout_minute_retard.csv` |
| 9 | Coût d'une minute de retard ATFM – Europe | EUROCONTROL Standard Inputs for Economic Analyses, chap. 16, release 10.0.2 | 100 € par minute (prix 2022, moyenne réseau) | https://ansperformance.eu/economics/cba/standard-inputs/chapters/cost_of_delay.html | `donnees_brutes/couts/cout_minute_retard.csv` |
| 10 | Satisfaction passagers par compagnie | American Customer Satisfaction Index (ACSI) | Score 0-100 par compagnie US, années ACSI 2020-2026 | Page actuelle : https://theacsi.org/industries/travel/airlines/ — versions archivées : 2020-2021 https://web.archive.org/web/20220225220149/https://theacsi.org/industries/travel/airlines/ · 2022 https://web.archive.org/web/20220729214017/https://theacsi.org/industries/travel/airlines/ · 2023 https://web.archive.org/web/20230529195457/https://theacsi.org/industries/travel/airlines/ · 2024 https://web.archive.org/web/20240628180310/https://theacsi.org/industries/travel/airlines/ · 2025 https://web.archive.org/web/20250713143542/https://theacsi.org/industries/travel/airlines/ | `donnees_brutes/satisfaction/acsi_compagnies_aeriennes.csv` |

## Limites (à mentionner dans le rapport)

- **Pas de base mondiale réelle et gratuite** des retards vol par vol : la base couvre les **USA** (BTS) et l'**Europe** (EUROCONTROL).
- **BTS** : uniquement les vols intérieurs des compagnies américaines → pour le KPI 1, la partie « vers le reste du monde » n'existe pas en données réelles gratuites.
- **EUROCONTROL** : données par aéroport et par jour, sans destination ni compagnie ; les causes détaillées ne concernent que les retards ATFM (régulation du trafic aérien).
- **Coûts** : estimation = minutes de retard réelles × coût unitaire publié (A4A ou EUROCONTROL). USD et EUR ne sont pas additionnés ; pas de coût USA pour 2020.
- **Satisfaction** : ACSI ne couvre que 9 compagnies US + un agrégat ; l'année ACSI N correspond aux enquêtes d'avril N-1 à mars N, associée aux vols de l'année N-1.

## Autres pages consultées pour vérifier les formats

- https://ansperformance.eu/data/
- https://www.transtats.bts.gov/OT_Delay/OT_DelayCause1.asp
