/* ==========================================================================
   KPI 3 - Carte des aeroports : nombre de vols (taille) et retards (couleur)
   ========================================================================== */
function kpi3(fonds) {
  const S = { zone: "USA", annee: 2024, mois: "tous", metrique: "taux" };
  const root = d3.select("#kpi3");

  segment("#k3-zone", [{ value: "USA", label: "USA" }, { value: "Europe", label: "Europe" }, { value: "Monde", label: "USA + Europe" }],
    S.zone, z => { S.zone = z; initMetrique(); maj(); });
  remplirSelect("#k3-annee", APP.annees.map(a => ({ value: a, label: a })), S.annee)
    .on("change", function () { S.annee = +this.value; maj(); });
  remplirSelect("#k3-mois", [{ value: "tous", label: "Toute l'année" }, ...MOIS.map((m, i) => ({ value: i + 1, label: m }))], S.mois)
    .on("change", function () { S.mois = this.value === "tous" ? "tous" : +this.value; maj(); });

  function initMetrique() {
    let opts;
    if (S.zone === "USA") opts = [{ value: "taux", label: "Part des vols ≥ 15 min" }, { value: "retard", label: "Retard moyen à l'arrivée" }];
    else if (S.zone === "Europe") opts = [{ value: "depart", label: "Retard moyen au départ" }, { value: "atfm", label: "Retard ATFM / arrivée" }];
    else opts = [{ value: "zone", label: "Couleur = zone" }];
    S.metrique = opts[0].value;
    segment("#k3-metrique", opts, S.metrique, m => { S.metrique = m; maj(); });
  }

  function donnees() {
    const filtre = r => r.an === S.annee && (S.mois === "tous" || r.mo === S.mois);
    const res = [];
    if (S.zone !== "Europe") {
      for (const [code, rows] of APP.usParOrigine) {
        const s = sommeUS(rows.filter(filtre));
        if (!s.n) continue;
        const a = APP.aeroports.get(code);
        res.push({ code, zone: "USA", a, vols: s.n,
                   v: S.metrique === "retard" ? s.retardMoyen : s.tauxRetard, s });
      }
    }
    if (S.zone !== "USA") {
      for (const [code, rows] of APP.euParAeroport) {
        const s = sommeEU(rows.filter(filtre));
        if (!s.dep) continue;
        const a = APP.aeroports.get(code);
        res.push({ code, zone: "Europe", a, vols: s.dep,
                   v: S.metrique === "atfm" ? s.atfmParArrivee : s.retardDepart, s });
      }
    }
    return res.filter(d => !isNaN(d.a.lat) && !isNaN(d.a.lon));
  }

  function maj() {
    const data = donnees().sort((a, b) => b.vols - a.vols);
    const el = d3.select("#k3-chart").html("");
    const W = largeur("#k3-chart"), H = Math.round(W * (S.zone === "Monde" ? 0.5 : 0.6));
    const svg = el.append("svg").attr("viewBox", `0 0 ${W} ${H}`);
    let proj, terre;
    if (S.zone === "USA") {
      proj = d3.geoAlbersUsa().fitSize([W, H], fonds.etats);
      terre = fonds.etats;
    } else if (S.zone === "Europe") {
      proj = d3.geoConicConformal().rotate([-10, 0]).center([0, 52]).parallels([35, 65])
        .fitExtent([[10, 10], [W - 10, H - 10]], { type: "MultiPoint", coordinates: data.map(d => [d.a.lon, d.a.lat]) });
      terre = fonds.pays;
    } else {
      proj = d3.geoNaturalEarth1().fitExtent([[0, 0], [W, H]],
        { type: "MultiPoint", coordinates: [[-170, 15], [-50, 72], [45, 30], [45, 72], [-170, 72]] });
      terre = fonds.pays;
    }
    const path = d3.geoPath(proj);
    svg.append("g").selectAll("path").data(terre.features).join("path").attr("class", "land").attr("d", path);

    const r = d3.scaleSqrt().domain([0, d3.max(data, d => d.vols) || 1]).range([0, S.zone === "Monde" ? 16 : 22]);
    let color, vFmt, legendeTitre;
    if (S.zone === "Monde") {
      const c = SERIES();
      color = d => d.zone === "USA" ? c[0] : c[1];
      legende("#k3-legende", [{ label: "USA (BTS) — vols intérieurs", color: c[0] }, { label: "Europe (EUROCONTROL) — départs", color: c[1] }]);
    } else {
      const vals = data.map(d => d.v).filter(v => !isNaN(v));
      const dom = [d3.quantile(vals, 0.05) ?? 0, d3.quantile(vals, 0.95) ?? 1];
      const ramp = d3.scaleSequential(d3.interpolateRgbBasis([css("--seq-100"), css("--seq-400"), css("--seq-700")])).domain(dom).clamp(true);
      color = d => isNaN(d.v) ? css("--text-muted") : ramp(d.v);
      vFmt = S.metrique === "taux" ? fmt.pct : fmt.min;
      legendeTitre = { taux: "Part des vols arrivés avec ≥ 15 min de retard", retard: "Retard moyen à l'arrivée (min)",
                       depart: "Retard moyen au départ, toutes causes (min / départ)", atfm: "Retard ATFM moyen (min / arrivée)" }[S.metrique];
      legendeCouleur("#k3-legende", ramp, dom, vFmt, legendeTitre);
      d3.select("#k3-legende").append("div").style("font-size", "12px").style("color", "var(--text-muted)")
        .html(`<span class="swatch" style="background:${css("--text-muted")}"></span>gris : valeur non publiée pour cet aéroport`);
    }
    const pts = data.map(d => ({ ...d, xy: proj([d.a.lon, d.a.lat]) })).filter(d => d.xy);
    svg.append("g").selectAll("circle").data(pts).join("circle")
      .attr("cx", d => d.xy[0]).attr("cy", d => d.xy[1]).attr("r", d => Math.max(2, r(d.vols)))
      .attr("fill", color).attr("fill-opacity", 0.85)
      .attr("stroke", css("--surface-1")).attr("stroke-width", 1)
      .on("mousemove", (e, d) => {
        let h = `<div class="t">${nomAeroport(d.code)}</div>` + ligneTip("Pays", d.a.pays);
        if (d.zone === "USA") h += ligneTip("Vols", fmt.int(d.s.n)) + ligneTip("Retard moyen", fmt.min(d.s.retardMoyen)) +
          ligneTip("Vols ≥ 15 min", fmt.pct(d.s.tauxRetard)) + ligneTip("Annulations", fmt.pct(d.s.tauxAnnul));
        else h += ligneTip("Départs", fmt.int(d.s.dep)) + ligneTip("Retard moyen au départ", fmt.min(d.s.retardDepart)) +
          ligneTip("Retard ATFM / arrivée", fmt.min(d.s.atfmParArrivee));
        tip.show(e, h);
      })
      .on("mouseleave", () => tip.hide());

    // legende des tailles
    const lg = svg.append("g").attr("transform", `translate(${W - 120},${H - 20})`);
    const maxV = d3.max(data, d => d.vols) || 0;
    const tailles = [maxV, maxV / 4].map(v => +d3.format(".1r")(v)).filter(v => v > 0);
    lg.selectAll("circle").data(tailles).join("circle").attr("cx", 30).attr("cy", v => -r(v)).attr("r", v => r(v))
      .attr("fill", "none").attr("stroke", css("--text-muted"));
    lg.selectAll("text").data(tailles).join("text").attr("x", 30 + r(maxV) + 6).attr("y", v => -2 * r(v) + 4)
      .text(v => fmt.int(v) + " vols");

    // tableau des 15 aeroports les plus frequentes
    const cols = [{ label: "Aéroport", value: d => nomAeroport(d.code) }, { label: "Pays", value: d => d.a.pays },
                  { label: "Vols / départs", num: true, value: d => d.vols, format: fmt.int }];
    if (S.zone !== "Europe") cols.push({ label: "Vols ≥ 15 min (USA)", num: true, value: d => d.zone === "USA" ? d.s.tauxRetard : NaN, format: v => isNaN(v) ? "—" : fmt.pct(v) });
    if (S.zone !== "USA") cols.push({ label: "Retard moyen au départ (Europe)", num: true, value: d => d.zone === "Europe" ? d.s.retardDepart : NaN, format: v => isNaN(v) ? "—" : fmt.min(v) });
    const periode = S.mois === "tous" ? S.annee : `${MOIS[S.mois - 1]} ${S.annee}`;
    tableau("#k3-table", cols, data.slice(0, 15), `Les 15 aéroports les plus fréquentés — ${periode}`);
    const sansMesure = S.zone !== "USA" && S.annee === 2019 && S.metrique === "depart";
    root.select("#k3-note2").style("display", sansMesure ? null : "none");
  }

  initMetrique();
  maj();
  redessins.push(maj);
}

function legendeCouleur(sel, ramp, dom, f, titre) {
  const el = d3.select(sel).attr("class", null).html("");
  const W = 280, H = 44;
  const svg = el.append("svg").attr("width", W).attr("height", H).style("overflow", "visible");
  const id = "grad-" + Math.random().toString(36).slice(2);
  const g = svg.append("defs").append("linearGradient").attr("id", id);
  d3.range(0, 1.01, 0.1).forEach(t => g.append("stop").attr("offset", t).attr("stop-color", ramp(dom[0] + t * (dom[1] - dom[0]))));
  svg.append("text").attr("x", 0).attr("y", 11).attr("font-size", 12).attr("fill", css("--text-secondary")).text(titre);
  svg.append("rect").attr("x", 0).attr("y", 18).attr("width", W).attr("height", 10).attr("rx", 3).attr("fill", `url(#${id})`);
  svg.append("text").attr("x", 0).attr("y", 42).attr("font-size", 11).attr("fill", css("--text-muted")).text(f(dom[0]));
  svg.append("text").attr("x", W).attr("y", 42).attr("text-anchor", "end").attr("font-size", 11).attr("fill", css("--text-muted")).text(f(dom[1]) + " et plus");
}
