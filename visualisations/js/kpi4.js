/* ==========================================================================
   KPI 4 - Cout estime des retards
   USA : minutes de retard a l'arrivee x cout A4A d'une minute (USD de l'annee)
   Europe : minutes de retard ATFM x 100 EUR (EUROCONTROL Standard Inputs)
   ========================================================================== */
function kpi4() {
  const S = { zone: "USA", annee: 2024 };
  const root = d3.select("#kpi4");
  segment("#k4-zone", [{ value: "USA", label: "USA (compagnies)" }, { value: "Europe", label: "Europe (pays)" }], S.zone, z => { S.zone = z; maj(); });
  remplirSelect("#k4-annee", APP.annees.map(a => ({ value: a, label: a })), S.annee)
    .on("change", function () { S.annee = +this.value; maj(); });

  const cpm = (zone, an) => APP.coutMinute.get(zone + "-" + an);

  function parEntite(an) {
    if (S.zone === "USA") {
      return d3.rollups(APP.us.filter(r => r.an === an), v => sommeUS(v), r => r.c).map(([c, s]) => ({
        id: c, label: nomCompagnie(c), vols: s.n, minutes: s.minArr, cout: s.minArr * cpm("USA", an),
      }));
    }
    return d3.rollups(APP.eu.filter(r => r.an === an), v => sommeEU(v), r => r.pays).map(([p, s]) => ({
      id: p, label: p, vols: s.dep, minutes: s.atfm, cout: s.atfm * cpm("Europe", an),
    }));
  }

  function maj() {
    const devise = S.zone === "USA" ? "USD" : "EUR";
    const c = cpm(S.zone, S.annee);
    const lignes = parEntite(S.annee).filter(d => d.vols > 0)
      .map(d => ({ ...d, parVol: d.cout / d.vols })).sort((a, b) => (b.cout || 0) - (a.cout || 0));

    // chiffres cles
    const total = d3.sum(lignes, d => d.cout), minutes = d3.sum(lignes, d => d.minutes), vols = d3.sum(lignes, d => d.vols);
    d3.select("#k4-tiles").html("").selectAll("div").data([
      { v: isNaN(c) ? "n.d." : fmt.money(total, devise), l: `Coût total estimé ${S.annee}` },
      { v: fmt.int(Math.round(minutes)), l: S.zone === "USA" ? "Minutes de retard à l'arrivée" : "Minutes de retard ATFM" },
      { v: isNaN(c) ? "n.d." : FR.format(",.0f")(total / vols) + (devise === "USD" ? " $" : " €"), l: "Coût moyen par vol" },
      { v: isNaN(c) ? "non publié" : FR.format(",.2f")(c) + (devise === "USD" ? " $" : " €"), l: "Coût d'une minute (référence)" },
    ]).join("div").attr("class", "tile").html(d => `<div class="v">${d.v}</div><div class="l">${d.l}</div>`);

    root.select("#k4-note2020").style("display", isNaN(c) ? null : "none");

    // barres horizontales : cout par compagnie / pays
    const top = lignes.filter(d => !isNaN(d.cout)).slice(0, 15);
    barresH("#k4-bars", top, d => d.cout, v => fmt.money(v, devise), css("--series-1"),
      d => `<div class="t">${d.label}</div>` + ligneTip("Coût estimé", fmt.money(d.cout, devise)) +
        ligneTip("Minutes de retard", fmt.int(Math.round(d.minutes))) + ligneTip("Vols", fmt.int(d.vols)) +
        ligneTip("Coût moyen par vol", FR.format(",.0f")(d.parVol) + (devise === "USD" ? " $" : " €")));
    root.select("#k4-bars-titre").text(S.zone === "USA" ? `Coût estimé des retards par compagnie — ${S.annee}` : `Coût estimé des retards ATFM par pays (15 premiers) — ${S.annee}`);

    // evolution annuelle du total
    const evol = APP.annees.map(an => {
      const l = parEntite(an);
      const cc = cpm(S.zone, an);
      return { an, cout: isNaN(cc) ? NaN : d3.sum(l, d => d.cout), minutes: d3.sum(l, d => d.minutes) };
    });
    barresAnnees("#k4-evol", evol, v => fmt.money(v, devise), S.annee);

    tableau("#k4-table", [
      { label: S.zone === "USA" ? "Compagnie" : "Pays", value: d => d.label },
      { label: "Vols", num: true, value: d => d.vols, format: fmt.int },
      { label: "Minutes de retard", num: true, value: d => d.minutes, format: v => fmt.int(Math.round(v)) },
      { label: "Coût total estimé", num: true, value: d => d.cout, format: v => fmt.money(v, devise) },
      { label: "Coût moyen par vol", num: true, value: d => d.parVol, format: v => isNaN(v) ? "n.d." : FR.format(",.0f")(v) + (devise === "USD" ? " $" : " €") },
    ], lignes.slice(0, 20), `Détail ${S.annee} (${devise} courants)`);
  }
  maj();
  redessins.push(maj);
}

/* ---- barres horizontales triees, etiquettes directes ---- */
function barresH(sel, data, val, f, couleur, tipHtml) {
  const el = d3.select(sel).html("");
  if (!data.length) { el.html(`<div class="empty">Pas de coût calculable pour cette sélection.</div>`); return; }
  const W = largeur(sel), bh = 22, gap = 6, M = { t: 4, r: 80, b: 4, l: 190 };
  const H = M.t + M.b + data.length * (bh + gap);
  const svg = el.append("svg").attr("viewBox", `0 0 ${W} ${H}`);
  const x = d3.scaleLinear().domain([0, d3.max(data, val)]).range([M.l, W - M.r]);
  const y = (d, i) => M.t + i * (bh + gap);
  const g = svg.selectAll("g").data(data).join("g").attr("transform", (d, i) => `translate(0,${y(d, i)})`);
  g.append("text").attr("x", M.l - 8).attr("y", bh / 2 + 4).attr("text-anchor", "end")
    .text(d => d.label.length > 28 ? d.label.slice(0, 27) + "…" : d.label);
  g.append("path").attr("fill", couleur)
    .attr("d", d => { const w = Math.max(1, x(val(d)) - M.l), r = Math.min(4, w); return `M${M.l},0 h${w - r} a${r},${r} 0 0 1 ${r},${r} v${bh - 2 * r} a${r},${r} 0 0 1 ${-r},${r} h${-(w - r)} Z`; })
    .on("mousemove", (e, d) => tip.show(e, tipHtml(d))).on("mouseleave", () => tip.hide());
  g.append("text").attr("x", d => x(val(d)) + 6).attr("y", bh / 2 + 4).attr("class", "direct-label").style("font-weight", 500).text(d => f(val(d)));
}

/* ---- petites barres verticales par annee (annee selectionnee accentuee) ---- */
function barresAnnees(sel, data, f, anSel) {
  const el = d3.select(sel).html("");
  const W = largeur(sel), H = 260, M = { t: 24, r: 10, b: 30, l: 10 };
  const svg = el.append("svg").attr("viewBox", `0 0 ${W} ${H}`);
  const x = d3.scaleBand().domain(data.map(d => d.an)).range([M.l, W - M.r]).padding(0.3);
  const y = d3.scaleLinear().domain([0, d3.max(data, d => d.cout) || 1]).range([H - M.b, M.t]);
  svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - M.b})`).call(d3.axisBottom(x).tickSizeOuter(0));
  const g = svg.selectAll(".b").data(data).join("g");
  g.filter(d => !isNaN(d.cout)).append("path")
    .attr("fill", d => d.an === anSel ? css("--series-1") : css("--seq-250"))
    .attr("d", d => { const x0 = x(d.an), w = x.bandwidth(), y0 = y(d.cout), h = Math.max(1, H - M.b - y0), r = Math.min(4, h);
      return `M${x0},${H - M.b} v${-(h - r)} a${r},${r} 0 0 1 ${r},${-r} h${w - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${h - r} Z`; });
  g.append("text").attr("x", d => x(d.an) + x.bandwidth() / 2).attr("y", d => isNaN(d.cout) ? H - M.b - 6 : y(d.cout) - 6)
    .attr("text-anchor", "middle").attr("class", "direct-label").style("font-weight", d => d.an === anSel ? 700 : 500)
    .text(d => isNaN(d.cout) ? "n.d." : f(d.cout));
}
