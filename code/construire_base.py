# -*- coding: utf-8 -*-
"""
=====================================================================
 Projet "Visualisation de l'information" - Retards des vols (D3.js)
 Construction de la base finale  ->  base/base.csv
 + fichiers KPI 6 (correlation cout/satisfaction) et KPI 7 (reseau des aeroports)
=====================================================================

Principe : AUCUNE donnée simulée ni inventée.
Toutes les données sont téléchargées depuis leurs sites officiels par ce script
(ou recopiées à l'identique depuis une page web officielle citée ligne par ligne),
puis nettoyées et agrégées avec pandas.

Sources (détail dans SOURCES.md et donnees_brutes/journal_telechargements.csv) :
  1. BTS (US DOT) - Reporting Carrier On-Time Performance (vol par vol, USA)
  2. BTS - tables de correspondance (compagnies, aéroports)
  3. EUROCONTROL (Aviation Intelligence Portal) - trafic, retards ATFM, retards au départ
  4. OurAirports - coordonnées des aéroports
  5. Airlines for America (A4A) - coût d'une minute de retard (USA)
  6. EUROCONTROL Standard Inputs - coût d'une minute de retard ATFM (Europe)
  7. ACSI - indice de satisfaction client des compagnies aériennes (USA)

Utilisation (dans Anaconda Prompt) :
    cd "C:\\Users\\gbodo\\Desktop\\Master_Big_Data\\Bloc1\\Visualisation de l'information\\projet_retards_vols"
    python code\\construire_base.py
Le script reprend là où il s'est arrêté (fichiers déjà téléchargés / déjà agrégés ignorés).
"""
import os, io, sys, time, zipfile, datetime, warnings
import numpy as np
import pandas as pd
import requests

# --------------------------------------------------------------------------- paramètres
ANNEES = list(range(2019, 2026))          # 2019 -> 2025
MOIS = list(range(1, 13))
RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BRUT = os.path.join(RACINE, "donnees_brutes")
INTER = os.path.join(RACINE, "donnees_intermediaires")
BASE = os.path.join(RACINE, "base")
for d in [BRUT, INTER, BASE] + [os.path.join(BRUT, s) for s in
          ["bts_ontime", "bts_lookup", "eurocontrol", "ourairports", "couts", "satisfaction"]]:
    os.makedirs(d, exist_ok=True)

URL_BTS = ("https://transtats.bts.gov/PREZIP/"
           "On_Time_Reporting_Carrier_On_Time_Performance_1987_present_{a}_{m}.zip")
URL_BTS_CARRIERS = "https://www.transtats.bts.gov/Download_Lookup.asp?Y11x72=Y_haVdhR_PNeeVRef"
URL_BTS_AIRPORTS = "https://www.transtats.bts.gov/Download_Lookup.asp?Y11x72=Y_NVecbeg"
URL_EC = "https://www.eurocontrol.int/performance/data/download/csv/{f}"
URL_OURAIRPORTS = "https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/{f}"

JOURNAL = os.path.join(BRUT, "journal_telechargements.csv")
HEADERS = {"User-Agent": "Mozilla/5.0 (projet universitaire - visualisation de l'information)"}


# --------------------------------------------------------------------------- téléchargement
def journaliser(url, chemin, statut, remarque=""):
    ligne = pd.DataFrame([{
        "date_telechargement": datetime.datetime.now().isoformat(timespec="seconds"),
        "url": url, "fichier": os.path.relpath(chemin, RACINE),
        "taille_octets": os.path.getsize(chemin) if os.path.exists(chemin) else 0,
        "statut": statut, "remarque": remarque}])
    ligne.to_csv(JOURNAL, mode="a", header=not os.path.exists(JOURNAL), index=False)


def telecharger(url, chemin, obligatoire=True):
    """Télécharge url -> chemin (si absent). Renvoie True si le fichier est disponible."""
    if os.path.exists(chemin) and os.path.getsize(chemin) > 0:
        return True
    remarque = ""
    for essai in range(4):
        try:
            try:
                r = requests.get(url, headers=HEADERS, timeout=300, stream=True)
            except requests.exceptions.SSLError:
                # transtats.bts.gov envoie parfois une chaîne de certificats incomplète
                warnings.filterwarnings("ignore")
                remarque = "verification SSL desactivee (chaine de certificats incomplete du serveur)"
                r = requests.get(url, headers=HEADERS, timeout=300, stream=True, verify=False)
            if r.status_code == 404:
                journaliser(url, chemin, "absent (404)")
                if obligatoire:
                    print(f"  !! fichier absent : {url}")
                return False
            r.raise_for_status()
            tmp = chemin + ".part"
            with open(tmp, "wb") as f:
                for bloc in r.iter_content(1 << 20):
                    f.write(bloc)
            os.replace(tmp, chemin)
            journaliser(url, chemin, "ok", remarque)
            print(f"  telecharge : {os.path.basename(chemin)} ({os.path.getsize(chemin)/1e6:.1f} Mo)")
            return True
        except Exception as e:
            print(f"  essai {essai+1} echoue pour {url} : {e}")
            time.sleep(5 * (essai + 1))
    journaliser(url, chemin, "echec")
    if obligatoire:
        raise RuntimeError(f"Impossible de telecharger {url}")
    return False


# --------------------------------------------------------------------------- 1. BTS vols USA
COLS_BTS = ["Year", "Month", "Reporting_Airline", "Origin", "OriginCityName", "OriginState",
            "Dest", "DestCityName", "DestState", "DepDelay", "DepDel15", "ArrDelay",
            "ArrDelayMinutes", "ArrDel15", "Cancelled", "Diverted", "Distance",
            "CarrierDelay", "WeatherDelay", "NASDelay", "SecurityDelay", "LateAircraftDelay"]
CAUSES_BTS = {"CarrierDelay": "min_cause_compagnie",
              "WeatherDelay": "min_cause_meteo",
              "NASDelay": "min_cause_systeme_aviation_nas",
              "SecurityDelay": "min_cause_surete",
              "LateAircraftDelay": "min_cause_avion_precedent_retarde"}


def agreger_bts(a, m):
    """Lit un fichier mensuel BTS (vol par vol) et l'agrège par compagnie x origine x destination."""
    sortie = os.path.join(INTER, f"bts_{a}_{m:02d}.csv")
    if os.path.exists(sortie):
        return pd.read_csv(sortie)
    url = URL_BTS.format(a=a, m=m)
    zp = os.path.join(BRUT, "bts_ontime", os.path.basename(url))
    if not telecharger(url, zp, obligatoire=False):
        return None
    with zipfile.ZipFile(zp) as z:
        nom = [n for n in z.namelist() if n.lower().endswith(".csv")][0]
        with z.open(nom) as f:
            v = pd.read_csv(f, usecols=COLS_BTS, low_memory=False,
                            dtype={"Reporting_Airline": str, "Origin": str, "Dest": str})
    v["arrive"] = v["ArrDelay"].notna().astype(int)
    v["distance_km"] = v["Distance"] * 1.609344
    cles = ["Year", "Month", "Reporting_Airline", "Origin", "Dest"]
    g = v.groupby(cles, as_index=False).agg(
        ville_origine=("OriginCityName", "first"), etat_origine=("OriginState", "first"),
        ville_destination=("DestCityName", "first"), etat_destination=("DestState", "first"),
        nb_vols=("Origin", "size"),
        nb_annules=("Cancelled", "sum"),
        nb_detournes=("Diverted", "sum"),
        nb_vols_arrives=("arrive", "sum"),
        nb_retards_arrivee_15=("ArrDel15", "sum"),
        nb_retards_depart_15=("DepDel15", "sum"),
        somme_retard_arrivee_signe_min=("ArrDelay", "sum"),
        somme_retard_depart_signe_min=("DepDelay", "sum"),
        nb_vols_partis=("DepDelay", "count"),
        minutes_retard_arrivee_totales=("ArrDelayMinutes", "sum"),
        distance_km=("distance_km", "mean"),
        **{v_: (k, "sum") for k, v_ in CAUSES_BTS.items()})
    g = g.rename(columns={"Year": "annee", "Month": "mois", "Reporting_Airline": "compagnie_code",
                          "Origin": "aeroport_origine", "Dest": "aeroport_destination"})
    g.to_csv(sortie, index=False)
    print(f"  BTS {a}-{m:02d} : {len(v):,} vols -> {len(g):,} lignes agregees")
    return g


def construire_usa():
    print("\n[1] BTS - vols USA")
    morceaux = [agreger_bts(a, m) for a in ANNEES for m in MOIS]
    us = pd.concat([x for x in morceaux if x is not None], ignore_index=True)
    us["retard_moyen_arrivee_min"] = us.somme_retard_arrivee_signe_min / us.nb_vols_arrives
    us["retard_moyen_depart_min"] = us.somme_retard_depart_signe_min / us.nb_vols_partis
    us["taux_retard_arrivee_15"] = us.nb_retards_arrivee_15 / us.nb_vols_arrives
    us["taux_annulation"] = us.nb_annules / us.nb_vols
    us = us.drop(columns=["somme_retard_arrivee_signe_min", "somme_retard_depart_signe_min", "nb_vols_partis"])

    # tables de correspondance BTS
    f_car = os.path.join(BRUT, "bts_lookup", "L_UNIQUE_CARRIERS.csv")
    f_apt = os.path.join(BRUT, "bts_lookup", "L_AIRPORT.csv")
    telecharger(URL_BTS_CARRIERS, f_car)
    telecharger(URL_BTS_AIRPORTS, f_apt)
    car = pd.read_csv(f_car).rename(columns={"Code": "compagnie_code", "Description": "compagnie_nom"})
    apt = pd.read_csv(f_apt).rename(columns={"Code": "code", "Description": "nom_bts"})
    us = us.merge(car, on="compagnie_code", how="left")
    us["nom_aeroport_origine"] = us.aeroport_origine.map(apt.set_index("code").nom_bts)
    us["nom_aeroport_destination"] = us.aeroport_destination.map(apt.set_index("code").nom_bts)
    us["source_donnees"] = "BTS On-Time Performance"
    us["zone"] = "USA"
    us["pays"] = "United States"
    us["type_liaison"] = "domestique (USA)"
    us["devise_cout"] = "USD"
    return us


# --------------------------------------------------------------------------- 2. EUROCONTROL
GROUPES_ATFM = {   # codes de cause ATFM (définitions : ansperformance.eu/reference/dataset/airport-arrival-atfm-delay/)
    "atfm_min_meteo": ["W", "D"],
    "atfm_min_capacite": ["C", "G", "M", "R", "V"],
    "atfm_min_personnel_atc": ["S"],
    "atfm_min_perturbations_greves": ["A", "E", "I", "N", "O", "T", "NA"],
    "atfm_min_evenements": ["P"],
}


def lire_ec(fichier):
    url = URL_EC.format(f=fichier)
    chemin = os.path.join(BRUT, "eurocontrol", fichier)
    if not telecharger(url, chemin, obligatoire=False):
        return None
    d = pd.read_csv(chemin, compression="bz2" if fichier.endswith(".bz2") else None, low_memory=False)
    d.columns = [c.upper() for c in d.columns]
    return d


def construire_europe():
    print("\n[2] EUROCONTROL - aeroports europeens")
    cles = ["YEAR", "MONTH_NUM", "APT_ICAO"]
    res = []
    for a in ANNEES:
        tr = lire_ec(f"airport_traffic_{a}.csv")
        if tr is None:
            continue
        t = tr.groupby(cles, as_index=False).agg(
            nom_aeroport_origine=("APT_NAME", "first"), pays=("STATE_NAME", "first"),
            nb_departs=("FLT_DEP_1", "sum"), nb_arrivees=("FLT_ARR_1", "sum"))

        dl = lire_ec(f"apt_dly_{a}.csv.bz2")
        if dl is not None:
            agg = {"atfm_min_total": ("DLY_APT_ARR_1", "sum"),
                   "atfm_nb_arrivees_retardees": ("FLT_ARR_1_DLY", "sum"),
                   "atfm_nb_arrivees_retardees_15": ("FLT_ARR_1_DLY_15", "sum")}
            for grp, codes in GROUPES_ATFM.items():
                cols = [f"DLY_APT_ARR_{c}_1" for c in codes if f"DLY_APT_ARR_{c}_1" in dl.columns]
                dl[grp] = dl[cols].fillna(0).sum(axis=1)
                agg[grp] = (grp, "sum")
            t = t.merge(dl.groupby(cles, as_index=False).agg(**agg), on=cles, how="left")

        pr = lire_ec(f"all_pre_departure_delays_{a}.csv")   # publié à partir de 2020
        if pr is not None:
            pr = pr[pr["DLY_ALL_PRE_2"].notna() & pr["FLT_DEP_IFR_2"].notna()]
            p = pr.groupby(cles, as_index=False).agg(
                depart_min_retard_toutes_causes=("DLY_ALL_PRE_2", "sum"),
                nb_departs_avec_mesure_retard=("FLT_DEP_IFR_2", "sum"))
            t = t.merge(p, on=cles, how="left")
        res.append(t)
        print(f"  EUROCONTROL {a} : {len(t)} aeroport-mois")
    eu = pd.concat(res, ignore_index=True).rename(
        columns={"YEAR": "annee", "MONTH_NUM": "mois", "APT_ICAO": "aeroport_origine"})
    eu["nb_vols"] = eu.nb_departs
    eu["retard_moyen_depart_min"] = eu.depart_min_retard_toutes_causes / eu.nb_departs_avec_mesure_retard
    eu["atfm_retard_moyen_par_arrivee_min"] = eu.atfm_min_total / eu.nb_arrivees
    eu["source_donnees"] = "EUROCONTROL Aviation Intelligence Portal"
    eu["zone"] = "Europe"
    eu["type_liaison"] = "toutes destinations (pas de detail origine-destination publie)"
    eu["devise_cout"] = "EUR"
    return eu


# --------------------------------------------------------------------------- 3. références recopiées des pages web
def tables_reference():
    """Valeurs recopiées à l'identique depuis les pages citées (colonne url_source)."""
    print("\n[3] Tables de reference (couts, satisfaction)")
    A4A = "https://www.airlines.org/dataset/u-s-passenger-carrier-delay-costs/"
    WB = "https://web.archive.org/web/{ts}/" + A4A
    couts = pd.DataFrame([
        # A4A ne publie pas de valeur pour 2020 (aucune trouvée dans les archives de la page)
        (2019, 74.24, WB.format(ts="20210619164556")),
        (2021, 80.52, WB.format(ts="20230130155023")),
        (2022, 101.18, WB.format(ts="20240120213649")),
        (2023, 100.80, WB.format(ts="20241128205616")),
        (2024, 100.76, WB.format(ts="20251208122523")),
        (2025, 98.41, A4A),
    ], columns=["annee", "cout_par_minute", "url_source"])
    couts["zone"] = "USA"
    couts["devise"] = "USD (courants)"
    couts["definition"] = "Cout direct moyen d'une minute de block time des compagnies passagers US (A4A, DOT Form 41)"
    eu = pd.DataFrame({"annee": ANNEES, "cout_par_minute": 100.0, "zone": "Europe",
                       "devise": "EUR (prix 2022)",
                       "definition": "Cout moyen reseau d'une minute de retard ATFM (EUROCONTROL Standard Inputs, release 10.0.2)",
                       "url_source": "https://ansperformance.eu/economics/cba/standard-inputs/chapters/cost_of_delay.html"})
    couts = pd.concat([couts, eu], ignore_index=True)
    couts.to_csv(os.path.join(BRUT, "couts", "cout_minute_retard.csv"), index=False)

    # ACSI : l'année ACSI N correspond aux enquêtes d'avril N-1 à mars N
    ACSI = "https://theacsi.org/industries/travel/airlines/"
    W = "https://web.archive.org/web/{ts}/" + ACSI
    src = {2020: W.format(ts="20220225220149"), 2021: W.format(ts="20220225220149"),
           2022: W.format(ts="20220729214017"), 2023: W.format(ts="20230529195457"),
           2024: W.format(ts="20240628180310"), 2025: W.format(ts="20250713143542"), 2026: ACSI}
    scores = {  # compagnie : {annee_acsi: score}
        "Ensemble des compagnies": {2020: 75, 2021: 76, 2022: 75, 2023: 76, 2024: 77, 2025: 74, 2026: 76},
        "Delta":     {2020: 77, 2021: 79, 2022: 77, 2023: 76, 2024: 77, 2025: 77, 2026: 79},
        "Southwest": {2020: 79, 2021: 79, 2022: 77, 2023: 78, 2024: 78, 2025: 80, 2026: 77},
        "Alaska":    {2020: 78, 2021: 77, 2022: 75, 2023: 81, 2024: 82, 2025: 76, 2026: 75},
        "JetBlue":   {2020: 78, 2021: 77, 2022: 79, 2023: 76, 2024: 77, 2025: 77, 2026: 78},
        "American":  {2020: 74, 2021: 75, 2022: 77, 2023: 78, 2024: 79, 2025: 73, 2026: 78},
        "United":    {2020: 75, 2021: 75, 2022: 77, 2023: 77, 2024: 75, 2025: 73, 2026: 75},
        "Allegiant": {2020: 74, 2021: 72, 2022: 70, 2023: 75, 2024: 78},
        "Frontier":  {2020: 66, 2021: 68, 2022: 66, 2023: 67, 2024: 69, 2025: 65, 2026: 69},
        "Spirit":    {2020: 65, 2021: 66, 2022: 63, 2023: 64, 2024: 67, 2025: 69, 2026: 66},
        "Autres compagnies (agregat ACSI)": {2020: 70, 2021: 74, 2022: 71, 2023: 72, 2024: 73, 2025: 70, 2026: 75},
    }
    code = {"Delta": "DL", "Southwest": "WN", "Alaska": "AS", "JetBlue": "B6", "American": "AA",
            "United": "UA", "Allegiant": "G4", "Frontier": "F9", "Spirit": "NK"}
    acsi = pd.DataFrame([(c, code.get(c), a, s, src[a]) for c, d in scores.items() for a, s in d.items()],
                        columns=["compagnie_acsi", "compagnie_code", "annee_acsi", "score_acsi_0_100", "url_source"])
    acsi["periode_enquete"] = acsi.annee_acsi.map(lambda a: f"avril {a-1} - mars {a}")
    acsi["annee_vols_associee"] = acsi.annee_acsi - 1   # l'essentiel de l'enquête porte sur l'année N-1
    acsi.to_csv(os.path.join(BRUT, "satisfaction", "acsi_compagnies_aeriennes.csv"), index=False)
    return couts, acsi


# --------------------------------------------------------------------------- 4. coordonnées
def coordonnees():
    print("\n[4] OurAirports - coordonnees")
    for f in ["airports.csv", "countries.csv"]:
        telecharger(URL_OURAIRPORTS.format(f=f), os.path.join(BRUT, "ourairports", f))
    ap = pd.read_csv(os.path.join(BRUT, "ourairports", "airports.csv"), low_memory=False,
                     usecols=["ident", "iata_code", "gps_code", "name", "latitude_deg", "longitude_deg",
                              "iso_country", "municipality", "type"])
    return ap


# --------------------------------------------------------------------------- 6. fichiers KPI 6 et 7 (dérivés de base.csv)
def fichiers_kpi(base):
    """KPI 6 : correlation cout du retard / satisfaction ; KPI 7 : reseau des aeroports (USA, BTS)."""
    print("\n[6] Fichiers KPI 6 (correlation) et KPI 7 (reseau)")
    us = base[base.zone == "USA"]

    # KPI 6 : une ligne = une compagnie x une annee
    k6 = us.groupby(["annee", "compagnie_code", "compagnie_nom"], as_index=False, dropna=False).agg(
        nb_vols=("nb_vols", "sum"), nb_vols_arrives=("nb_vols_arrives", "sum"),
        nb_retards_arrivee_15=("nb_retards_arrivee_15", "sum"),
        minutes_retard_arrivee_totales=("minutes_retard_arrivee_totales", "sum"),
        cout_retard_total_usd=("cout_retard_estime", lambda x: x.sum(min_count=1)),
        score_acsi_0_100=("score_acsi_0_100", "first"), annee_acsi=("annee_acsi", "first"))
    k6["cout_moyen_retard_par_vol_usd"] = (k6.cout_retard_total_usd / k6.nb_vols).round(2)
    k6["taux_retard_arrivee_15"] = (k6.nb_retards_arrivee_15 / k6.nb_vols_arrives).round(4)
    k6 = k6[k6.score_acsi_0_100.notna() & k6.cout_moyen_retard_par_vol_usd.notna()]
    k6.to_csv(os.path.join(BASE, "kpi6_correlation_cout_satisfaction.csv"), index=False)
    if len(k6) >= 3:
        r = k6.cout_moyen_retard_par_vol_usd.corr(k6.score_acsi_0_100)
        rho = k6.cout_moyen_retard_par_vol_usd.corr(k6.score_acsi_0_100, method="spearman")
        pd.DataFrame([{"periode": "toutes annees", "n_points": len(k6), "pearson_r": round(r, 3),
                       "spearman_rho": round(rho, 3)}] +
                     [{"periode": int(a), "n_points": len(g),
                       "pearson_r": round(g.cout_moyen_retard_par_vol_usd.corr(g.score_acsi_0_100), 3) if len(g) >= 3 else np.nan,
                       "spearman_rho": round(g.cout_moyen_retard_par_vol_usd.corr(g.score_acsi_0_100, method="spearman"), 3) if len(g) >= 3 else np.nan}
                      for a, g in k6.groupby("annee")]
                     ).to_csv(os.path.join(BASE, "kpi6_coefficients_correlation.csv"), index=False)
        print(f"  KPI 6 : {len(k6)} points, Pearson r = {r:.3f}, Spearman rho = {rho:.3f}")

    # KPI 7 : liens = liaisons directes (toutes compagnies), par annee et mois
    liens = us.groupby(["annee", "mois", "aeroport_origine", "aeroport_destination"], as_index=False).agg(
        nb_vols=("nb_vols", "sum"), nb_vols_arrives=("nb_vols_arrives", "sum"),
        nb_retards_arrivee_15=("nb_retards_arrivee_15", "sum"),
        somme_retard=("retard_moyen_arrivee_min", lambda x: (x * us.loc[x.index, "nb_vols_arrives"]).sum()),
        nb_compagnies=("compagnie_code", "nunique"), distance_km=("distance_km", "mean"))
    liens["retard_moyen_arrivee_min"] = (liens.somme_retard / liens.nb_vols_arrives).round(2)
    liens["taux_retard_arrivee_15"] = (liens.nb_retards_arrivee_15 / liens.nb_vols_arrives).round(4)
    liens = liens.drop(columns="somme_retard")
    liens["distance_km"] = liens.distance_km.round(0)
    liens.to_csv(os.path.join(BASE, "kpi7_reseau_liens.csv"), index=False)

    # noeuds = aeroports, par annee et mois (vols au depart + a l'arrivee, nombre de connexions)
    dep = liens.groupby(["annee", "mois", "aeroport_origine"]).agg(
        vols_depart=("nb_vols", "sum"), retards_dep=("nb_retards_arrivee_15", "sum"),
        arrives_dep=("nb_vols_arrives", "sum"), destinations=("aeroport_destination", "nunique"))
    arr = liens.groupby(["annee", "mois", "aeroport_destination"]).agg(
        vols_arrivee=("nb_vols", "sum"), provenances=("aeroport_origine", "nunique"))
    dep.index.names = arr.index.names = ["annee", "mois", "aeroport"]
    noeuds = dep.join(arr, how="outer").fillna(0).reset_index()
    noeuds["nb_vols_total"] = noeuds.vols_depart + noeuds.vols_arrivee
    noeuds["degre_sortant"] = noeuds.destinations.astype(int)
    noeuds["degre_entrant"] = noeuds.provenances.astype(int)
    noeuds["taux_retard_arrivee_15_vols_partis"] = (noeuds.retards_dep / noeuds.arrives_dep.replace(0, np.nan)).round(4)
    cols = ["nom_aeroport", "ville", "etat", "latitude", "longitude"]
    o = us[["aeroport_origine"] + [c + "_origine" for c in cols]]
    o.columns = ["aeroport"] + cols
    d = us[["aeroport_destination"] + [c + "_destination" for c in cols]]
    d.columns = ["aeroport"] + cols
    info = pd.concat([o, d]).dropna(subset=["nom_aeroport"]).drop_duplicates("aeroport").set_index("aeroport")
    for c in cols:
        noeuds[c] = noeuds.aeroport.map(info[c])
    noeuds = noeuds[["annee", "mois", "aeroport", "nom_aeroport", "ville", "etat", "latitude", "longitude",
                     "nb_vols_total", "vols_depart", "vols_arrivee", "degre_sortant", "degre_entrant",
                     "taux_retard_arrivee_15_vols_partis"]]
    noeuds.to_csv(os.path.join(BASE, "kpi7_reseau_noeuds.csv"), index=False)
    print(f"  KPI 7 : {len(noeuds):,} noeuds-mois, {len(liens):,} liens-mois")


# --------------------------------------------------------------------------- 5. assemblage
def main():
    us = construire_usa()
    eu = construire_europe()
    couts, acsi = tables_reference()
    ap = coordonnees()

    # coordonnées : USA par code IATA, Europe par code ICAO
    rang = {"large_airport": 0, "medium_airport": 1, "small_airport": 2}
    ap["r"] = ap["type"].map(rang).fillna(3)
    iata = ap[ap.iata_code.notna()].sort_values("r").drop_duplicates("iata_code").set_index("iata_code")
    icao = ap.drop_duplicates("ident").set_index("ident")
    for col, src in [("latitude_origine", "latitude_deg"), ("longitude_origine", "longitude_deg")]:
        us[col] = us.aeroport_origine.map(iata[src])
        eu[col] = eu.aeroport_origine.map(icao[src])
    us["latitude_destination"] = us.aeroport_destination.map(iata.latitude_deg)
    us["longitude_destination"] = us.aeroport_destination.map(iata.longitude_deg)
    us["code_iata_origine"] = us.aeroport_origine
    us["code_icao_origine"] = us.aeroport_origine.map(iata.ident)
    eu["code_icao_origine"] = eu.aeroport_origine
    eu["code_iata_origine"] = eu.aeroport_origine.map(icao.iata_code)

    # coûts
    cu = couts[couts.zone == "USA"].set_index("annee").cout_par_minute
    us["cout_par_minute"] = us.annee.map(cu)                       # NaN pour 2020 (non publié)
    us["cout_retard_estime"] = us.minutes_retard_arrivee_totales * us.cout_par_minute
    us["base_calcul_cout"] = "minutes de retard a l'arrivee x cout A4A par minute"
    eu["cout_par_minute"] = 100.0
    eu["cout_retard_estime"] = eu.atfm_min_total * eu.cout_par_minute
    eu["base_calcul_cout"] = "minutes de retard ATFM a l'arrivee x 100 EUR (EUROCONTROL)"

    # satisfaction (USA uniquement)
    s = acsi[acsi.compagnie_code.notna()][["compagnie_code", "annee_vols_associee", "score_acsi_0_100", "annee_acsi"]]
    us = us.merge(s.rename(columns={"annee_vols_associee": "annee"}), on=["compagnie_code", "annee"], how="left")

    colonnes = [
        "source_donnees", "zone", "pays", "annee", "mois",
        "aeroport_origine", "code_icao_origine", "code_iata_origine", "nom_aeroport_origine", "ville_origine",
        "etat_origine", "latitude_origine", "longitude_origine",
        "type_liaison", "aeroport_destination", "nom_aeroport_destination", "ville_destination",
        "etat_destination", "latitude_destination", "longitude_destination", "distance_km",
        "compagnie_code", "compagnie_nom",
        "nb_vols", "nb_departs", "nb_arrivees", "nb_annules", "nb_detournes", "nb_vols_arrives",
        "nb_retards_arrivee_15", "nb_retards_depart_15", "taux_retard_arrivee_15", "taux_annulation",
        "retard_moyen_arrivee_min", "retard_moyen_depart_min", "minutes_retard_arrivee_totales",
        *CAUSES_BTS.values(),
        "atfm_min_total", *GROUPES_ATFM.keys(), "atfm_nb_arrivees_retardees", "atfm_nb_arrivees_retardees_15",
        "atfm_retard_moyen_par_arrivee_min", "depart_min_retard_toutes_causes", "nb_departs_avec_mesure_retard",
        "cout_par_minute", "devise_cout", "cout_retard_estime", "base_calcul_cout",
        "score_acsi_0_100", "annee_acsi"]
    base = pd.concat([us, eu], ignore_index=True)
    for c in colonnes:
        if c not in base.columns:
            base[c] = np.nan
    base = base[colonnes].sort_values(["zone", "annee", "mois", "aeroport_origine"]).reset_index(drop=True)
    for c in base.select_dtypes("float").columns:
        base[c] = base[c].round(3)
    base.to_csv(os.path.join(BASE, "base.csv"), index=False, encoding="utf-8")

    print("\n=== base/base.csv ecrite ===")
    print(f"  lignes : {len(base):,}  |  colonnes : {base.shape[1]}")
    print(base.groupby("zone").agg(lignes=("annee", "size"), annee_min=("annee", "min"),
                                   annee_max=("annee", "max"), aeroports=("aeroport_origine", "nunique")))
    manq = us[(us.latitude_origine.isna())].aeroport_origine.unique().tolist() + \
           eu[eu.latitude_origine.isna()].aeroport_origine.unique().tolist()
    print(f"  aeroports sans coordonnees : {len(manq)} {manq[:20]}")

    fichiers_kpi(base)


if __name__ == "__main__":
    main()
