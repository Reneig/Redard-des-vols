/* ==========================================================================
   commun.js - chargement de la base "base.csv" avec D3.js + fonctions partagees
   Tous les KPIs sont calcules ici, dans le navigateur, a partir de base.csv.
   ========================================================================== */
const APP = {
  CHEMIN_BASE: "../base/base.csv",          // la base construite par code/construire_base.py
  // fonds de carte (TopoJSON, projets "world-atlas" et "us-atlas" de Mike Bostock)
  URL_MONDE: "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json",
  URL_USA: "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json",
  us: [],            // lignes USA (BTS) : compagnie x origine x destination x mois
  eu: [],            // lignes Europe (EUROCONTROL) : aeroport x mois
  aeroports: new Map(),   // code -> {code, nom, lat, lon, pays, zone}
  compagnies: new Map(),  // code -> nom
  coutMinute: new Map(),  // "USA-2024" -> cout d'une minute (valeur de la base)
  acsi: new Map(),        // "DL-2024" -> score ACSI rattache aux vols de 2024
  annees: d3.range(2019, 2026),
};

/* ---------- format francais ---------- */
const FR = d3.formatLocale({ decimal: ",", thousands: " ", grouping: [3], currency: ["", " €"] });
const fmt = {
  int: FR.format(",d"),
  dec1: FR.format(",.1f"),
  dec2: FR.format(",.2f"),
  pct: FR.format(".1%"),
  pct0: FR.format(".0%"),
  money: (v, devise) => {
    if (v == null || isNaN(v)) return "n.d.";
    const s = devise === "EUR" ? "€" : "$";
    if (Math.abs(v) >= 1e9) return FR.format(",.2f")(v / 1e9) + " Md" + s;
    if (Math.abs(v) >= 1e6) return FR.format(",.1f")(v / 1e6) + " M" + s;
    if (Math.abs(v) >= 1e3) return FR.format(",.0f")(v / 1e3) + " k" + s;
    return FR.format(",.0f")(v) + " " + s;
  },
  min: v => (v == null || isNaN(v)) ? "n.d." : FR.format(",.1f")(v) + " min",
};
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const moisLabel = d => `${MOIS[d.getMonth()]} ${d.getFullYear()}`;
const num = v => (v === "" || v == null) ? NaN : +v;
const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const SERIES = () => d3.range(1, 9).map(i => css(`--series-${i}`));

/* ---------- lecture de la base ---------- */
// Seules les colonnes utiles sont gardees en memoire (la base fait ~800 000 lignes).
function lireLigne(d) {
  const code = d.aeroport_origine;
  if (!APP.aeroports.has(code)) {
    APP.aeroports.set(code, { code, nom: d.nom_origine, lat: num(d.latitude_origine),
                              lon: num(d.longitude_origine), pays: d.pays, zone: d.zone });
  }
  const an = +d.annee;
  const cle = d.zone + "-" + an;
  if (!APP.coutMinute.has(cle)) APP.coutMinute.set(cle, num(d.cout_par_minute));

  if (d.zone === "USA") {
    if (!APP.compagnies.has(d.compagnie_code)) APP.compagnies.set(d.compagnie_code, d.compagnie_nom || d.compagnie_code);
    if (d.score_acsi_0_100 !== "") APP.acsi.set(d.compagnie_code + "-" + an, +d.score_acsi_0_100);
    APP.us.push({
      an, mo: +d.mois, o: code, d: d.aeroport_destination, c: d.compagnie_code,
      n: +d.nb_vols, ann: +d.nb_annules || 0, arr: +d.nb_vols_arrives || 0,
      r15: +d.nb_retards_arrivee_15 || 0, sArr: +d.somme_retard_arrivee_min || 0,
      minArr: +d.minutes_retard_arrivee_totales || 0,
      kC: +d.min_cause_compagnie || 0, kM: +d.min_cause_meteo || 0, kN: +d.min_cause_systeme_aviation_nas || 0,
      kS: +d.min_cause_surete || 0, kA: +d.min_cause_avion_precedent_retarde || 0,
    });
  } else {
    APP.eu.push({
      an, mo: +d.mois, o: code, pays: d.pays,
      dep: +d.nb_departs || 0, arrE: +d.nb_arrivees || 0,
      atfm: +d.atfm_min_total || 0, aM: +d.atfm_min_meteo || 0, aC: +d.atfm_min_capacite || 0,
      aP: +d.atfm_min_personnel_atc || 0, aG: +d.atfm_min_perturbations_greves || 0, aE: +d.atfm_min_evenements || 0,
      atfm15: +d.atfm_nb_arrivees_retardees_15 || 0,
      depMin: num(d.depart_min_retard_toutes_causes), depMes: num(d.nb_departs_avec_mesure_retard),
    });
  }
  return null;   // on ne garde pas la ligne brute (economie de memoire)
}

async function chargerBase() {
  const t0 = performance.now();
  await d3.csv(APP.CHEMIN_BASE, lireLigne);
  // index utiles
  APP.usParOrigine = d3.group(APP.us, r => r.o);
  APP.usParMois = d3.group(APP.us, r => r.an * 100 + r.mo);
  APP.euParAeroport = d3.group(APP.eu, r => r.o);
  APP.dureeChargement = (performance.now() - t0) / 1000;
}

/* ---------- agregations reutilisables ---------- */
// Somme des indicateurs USA sur un ensemble de lignes -> moyennes ponderees correctes
function sommeUS(rows) {
  const s = { n: 0, ann: 0, arr: 0, r15: 0, sArr: 0, minArr: 0, kC: 0, kM: 0, kN: 0, kS: 0, kA: 0 };
  for (const r of rows) for (const k in s) s[k] += r[k];
  s.retardMoyen = s.arr ? s.sArr / s.arr : NaN;      // retard moyen a l'arrivee (min, avances incluses)
  s.tauxRetard = s.arr ? s.r15 / s.arr : NaN;         // part des vols arrives avec >= 15 min de retard
  s.tauxAnnul = s.n ? s.ann / s.n : NaN;
  return s;
}
function sommeEU(rows) {
  const s = { dep: 0, arrE: 0, atfm: 0, aM: 0, aC: 0, aP: 0, aG: 0, aE: 0, atfm15: 0, depMin: 0, depMes: 0 };
  for (const r of rows) for (const k in s) { const v = r[k]; if (!isNaN(v)) s[k] += v; }
  s.retardDepart = s.depMes ? s.depMin / s.depMes : NaN;    // retard moyen au depart (toutes causes)
  s.atfmParArrivee = s.arrE ? s.atfm / s.arrE : NaN;        // retard ATFM moyen par arrivee
  return s;
}
const nomAeroport = code => { const a = APP.aeroports.get(code); return a && a.nom ? `${code} — ${a.nom}` : code; };
const nomCompagnie = code => APP.compagnies.get(code) || code;

/* ---------- interface : selecteurs, boutons, tableaux, info-bulle ---------- */
function remplirSelect(sel, options, valeur) {
  sel = d3.select(sel);
  sel.selectAll("option").data(options).join("option")
    .attr("value", d => d.value).text(d => d.label);
  if (valeur != null) sel.property("value", valeur);
  return sel;
}
function segment(conteneur, options, valeur, onChange) {
  const root = d3.select(conteneur).attr("class", "seg");
  root.selectAll("button").data(options).join("button")
    .attr("type", "button").text(d => d.label)
    .classed("on", d => d.value === valeur)
    .on("click", function (e, d) {
      root.selectAll("button").classed("on", x => x.value === d.value);
      onChange(d.value);
    });
}
function tableau(conteneur, colonnes, lignes, legende) {
  const wrap = d3.select(conteneur).html("").append("div").attr("class", "table-wrap");
  const t = wrap.append("table").attr("class", "data");
  if (legende) t.append("caption").text(legende);
  t.append("thead").append("tr").selectAll("th").data(colonnes).join("th")
    .attr("class", c => c.num ? "num" : null).text(c => c.label);
  t.append("tbody").selectAll("tr").data(lignes).join("tr")
    .selectAll("td").data(l => colonnes.map(c => ({ c, l }))).join("td")
    .attr("class", d => d.c.num ? "num" : null)
    .html(d => d.c.html ? d.c.html(d.l) : (d.c.format ? d.c.format(d.c.value(d.l)) : d.c.value(d.l)));
}
const tip = {
  el: null,
  show(event, html) {
    if (!this.el) this.el = d3.select("body").append("div").attr("class", "tooltip");
    this.el.html(html).style("opacity", 1);
    const w = this.el.node().offsetWidth, h = this.el.node().offsetHeight;
    let x = event.clientX + 14, y = event.clientY + 14;
    if (x + w > window.innerWidth - 8) x = event.clientX - w - 14;
    if (y + h > window.innerHeight - 8) y = event.clientY - h - 14;
    this.el.style("left", x + "px").style("top", y + "px");
  },
  hide() { if (this.el) this.el.style("opacity", 0); },
};
const ligneTip = (label, valeur) => `<div class="row"><span>${label}</span><span>${valeur}</span></div>`;

function legende(conteneur, items, ligne = false) {
  d3.select(conteneur).attr("class", "legend").selectAll("span").data(items).join("span")
    .html(d => `<i class="${ligne ? "line" : ""}" style="background:${d.color}"></i>${d.label}`);
}
function largeur(el, min = 320) { return Math.max(min, d3.select(el).node().getBoundingClientRect().width); }

// redessine tous les graphiques quand la fenetre change de taille
const redessins = [];
window.addEventListener("resize", (() => { let t; return () => { clearTimeout(t); t = setTimeout(() => redessins.forEach(f => f()), 200); }; })());
