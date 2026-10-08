/* ==========================================================================
   KPI 5 - Satisfaction des passagers (ACSI) et retard moyen par compagnie
   Un point = une compagnie pour une annee de vols (enquete ACSI de l'annee suivante)
   ========================================================================== */

// donnees compagnie x annee, partagees par les KPI 5 et 6
function compagniesAnnees() {
  if (APP._ca) return APP._ca;
  const m = d3.rollup(APP.us, sommeUS, r => r.c, r => r.an);
  const res = [];
  for (const [c, parAn] of m) for (const [an, s] of parAn) {
    const acsi = APP.acsi.get(c + "-" + an);
    if (acsi == null) continue;                         // compagnie non suivie par l'ACSI
    const cpm = APP.coutMinute.get("USA-" + an);
    const cout = s.minArr * cpm;
    res.push({ c, nom: nomCompagnie(c), an, acsi, s, vols: s.n,
               retard: s.retardMoyen, taux: s.tauxRetard,
               cout, coutParVol: cout / s.n });
  }
  return APP._ca = res;
}

function kpi5() {
  const data = compagniesAnnees();
  const annees = Array.from(new Set(data.map(d => d.an))).sort();
  const S = { an: annees.includes(2024) ? 2024 : annees[annees.length - 1], x: "retard", timer: null };
  const root = d3.select("#kpi5");

  const slider = root.select("#k5-an").attr("min", annees[0]).attr("max", annees[annees.length - 1]).attr("step", 1)
    .property("value", S.an).on("input", function () { S.an = +this.value; maj(true); });
  segment("#k5-x", [{ value: "retard", label: "Retard moyen (min)" }, { value: "taux", label: "Part des vols ≥ 15 min" }], S.x,
    v => { S.x = v; maj(false); });
  root.select("#k5-play").on("click", function () {
    if (S.timer) { clearInterval(S.timer); S.timer = null; this.textContent = "▶ Animer"; return; }
    this.textContent = "❚❚ Pause";
    S.timer = setInterval(() => {
      S.an = S.an >= annees[annees.length - 1] ? annees[0] : S.an + 1;
      slider.property("value", S.an); maj(true);
    }, 1400);
  });

  const el = d3.select("#k5-chart");
  let svg, gx, gy, gPts, x, y, r, W, H;
  const M = { t: 20, r: 30, b: 46, l: 56 };

  function cadre() {
    el.html("");
    W = largeur("#k5-chart"); H = 420;
    svg = el.append("svg").attr("viewBox", `0 0 ${W} ${H}`);
    gy = svg.append("g").attr("class", "axis").attr("transform", `translate(${M.l},0)`);
    gx = svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - M.b})`);
    svg.append("text").attr("class", "axis-title").attr("x", M.l).attr("y", 12).text("score de satisfaction ACSI (sur 100)");
    svg.append("text").attr("class", "axis-title k5-xtitle").attr("x", W - M.r).attr("y", H - 8).attr("text-anchor", "end");
    svg.append("text").attr("class", "k5-an").attr("x", W - M.r).attr("y", M.t + 40).attr("text-anchor", "end")
      .attr("font-size", 44).attr("font-weight", 700).attr("fill", css("--grid"));
    gPts = svg.append("g");
  }

  function maj(anime) {
    if (!svg) cadre();
    const vx = d => S.x === "retard" ? d.retard : d.taux;
    x = d3.scaleLinear().domain(d3.extent(data, vx)).nice().range([M.l, W - M.r]);
    y = d3.scaleLinear().domain(d3.extent(data, d => d.acsi)).nice().range([H - M.b, M.t]);
    r = d3.scaleSqrt().domain([0, d3.max(data, d => d.vols)]).range([4, 26]);
    const xf = S.x === "retard" ? (v => FR.format(",.0f")(v) + " min") : fmt.pct0;
    gx.call(d3.axisBottom(x).ticks(6).tickFormat(xf));
    gy.call(d3.axisLeft(y).ticks(6)).call(g => g.select(".domain").remove());
    svg.select(".k5-xtitle").text(S.x === "retard" ? "retard moyen à l'arrivée (min, avances incluses)" : "part des vols arrivés avec ≥ 15 min de retard");
    svg.select(".k5-an").text(S.an);
    root.select("#k5-an-val").text(`${S.an} (enquête ACSI ${S.an + 1})`);

    const pts = data.filter(d => d.an === S.an).sort((a, b) => b.vols - a.vols);
    const t = svg.transition().duration(anime ? 900 : 0);
    const g = gPts.selectAll("g.pt").data(pts, d => d.c).join(enter => {
      const g = enter.append("g").attr("class", "pt").attr("transform", d => `translate(${x(vx(d))},${y(d.acsi)})`).style("opacity", 0);
      g.append("circle").attr("fill", css("--series-1")).attr("fill-opacity", 0.75).attr("stroke", css("--surface-1")).attr("stroke-width", 2);
      g.append("text").attr("class", "direct-label").attr("dy", 4);
      return g;
    }, update => update, exit => exit.transition(t).style("opacity", 0).remove());
    g.transition(t).attr("transform", d => `translate(${x(vx(d))},${y(d.acsi)})`).style("opacity", 1);
    g.select("circle").transition(t).attr("r", d => r(d.vols));
    g.select("text").attr("x", d => r(d.vols) + 4).text(d => d.nom.replace(/ (Inc\.|Co\.|Corp\.|Airlines Inc\.)$/, ""));
    g.on("mousemove", (e, d) => tip.show(e, `<div class="t">${d.nom} — ${d.an}</div>` +
        ligneTip("Score ACSI", `${d.acsi} / 100`) + ligneTip("Retard moyen", fmt.min(d.retard)) +
        ligneTip("Vols ≥ 15 min", fmt.pct(d.taux)) + ligneTip("Vols", fmt.int(d.vols))))
      .on("mouseleave", () => tip.hide());

    tableau("#k5-table", [
      { label: "Compagnie", value: d => d.nom },
      { label: "Score ACSI", num: true, value: d => d.acsi },
      { label: "Retard moyen", num: true, value: d => d.retard, format: fmt.min },
      { label: "Vols ≥ 15 min", num: true, value: d => d.taux, format: fmt.pct },
      { label: "Vols", num: true, value: d => d.vols, format: fmt.int },
    ], pts.slice().sort((a, b) => b.acsi - a.acsi), `Vols ${S.an} — enquête ACSI ${S.an + 1} (avril ${S.an} à mars ${S.an + 1})`);
  }

  maj(false);
  redessins.push(() => { svg = null; maj(false); });
}
