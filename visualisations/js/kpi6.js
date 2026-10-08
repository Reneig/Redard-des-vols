/* ==========================================================================
   KPI 6 - Correlation entre le cout du retard et la satisfaction (ACSI)
   Pearson r, Spearman rho et droite des moindres carres calcules en JavaScript
   ========================================================================== */
function pearson(xs, ys) {
  const n = xs.length; if (n < 3) return NaN;
  const mx = d3.mean(xs), my = d3.mean(ys);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const a = xs[i] - mx, b = ys[i] - my; sxy += a * b; sxx += a * a; syy += b * b; }
  return sxy / Math.sqrt(sxx * syy);
}
function rangs(v) {                       // rangs moyens (gestion des ex aequo)
  const idx = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]);
  const r = new Array(v.length);
  for (let i = 0; i < idx.length;) {
    let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2 + 1;
    i = j + 1;
  }
  return r;
}
const spearman = (xs, ys) => pearson(rangs(xs), rangs(ys));
function regression(xs, ys) {
  const mx = d3.mean(xs), my = d3.mean(ys);
  const b = d3.sum(xs, (x, i) => (x - mx) * (ys[i] - my)) / d3.sum(xs, x => (x - mx) ** 2);
  return { a: my - b * mx, b };
}
function interpretation(r) {
  if (isNaN(r)) return "non calculable (moins de 3 points)";
  const a = Math.abs(r);
  const force = a < 0.1 ? "nulle" : a < 0.3 ? "faible" : a < 0.5 ? "modérée" : a < 0.7 ? "assez forte" : "forte";
  return a < 0.1 ? "corrélation quasi nulle" : `corrélation ${force} ${r < 0 ? "négative" : "positive"}`;
}

function kpi6() {
  const tout = compagniesAnnees().filter(d => !isNaN(d.coutParVol));   // 2020 : pas de cout publie
  const annees = Array.from(new Set(tout.map(d => d.an))).sort();
  const S = { an: "toutes", focus: null };
  const root = d3.select("#kpi6");
  remplirSelect("#k6-an", [{ value: "toutes", label: "Toutes les années" }, ...annees.map(a => ({ value: a, label: a }))], S.an)
    .on("change", function () { S.an = this.value === "toutes" ? "toutes" : +this.value; maj(); });
  const comps = Array.from(new Set(tout.map(d => d.c)));
  remplirSelect("#k6-focus", [{ value: "", label: "Aucune" }, ...comps.map(c => ({ value: c, label: nomCompagnie(c) }))], "")
    .on("change", function () { S.focus = this.value || null; maj(); });

  function maj() {
    const data = S.an === "toutes" ? tout : tout.filter(d => d.an === S.an);
    const xs = data.map(d => d.coutParVol), ys = data.map(d => d.acsi);
    const r = pearson(xs, ys), rho = spearman(xs, ys);

    d3.select("#k6-tiles").html("").selectAll("div").data([
      { v: isNaN(r) ? "—" : FR.format("+.2f")(r), l: "Pearson r (relation linéaire)" },
      { v: isNaN(rho) ? "—" : FR.format("+.2f")(rho), l: "Spearman ρ (relation de rang)" },
      { v: fmt.int(data.length), l: "Points (compagnie × année)" },
      { v: isNaN(r) ? "—" : FR.format(".0%")(r * r), l: "R² : part de variance expliquée" },
    ]).join("div").attr("class", "tile").html(d => `<div class="v">${d.v}</div><div class="l">${d.l}</div>`);

    // nuage de points + droite de regression
    const el = d3.select("#k6-chart").html("");
    const W = largeur("#k6-chart"), H = 420, M = { t: 20, r: 24, b: 46, l: 56 };
    const svg = el.append("svg").attr("viewBox", `0 0 ${W} ${H}`);
    const x = d3.scaleLinear().domain(d3.extent(tout, d => d.coutParVol)).nice().range([M.l, W - M.r]);
    const y = d3.scaleLinear().domain(d3.extent(tout, d => d.acsi)).nice().range([H - M.b, M.t]);
    svg.append("g").attr("class", "grid").attr("transform", `translate(${M.l},0)`).call(d3.axisLeft(y).ticks(6).tickSize(-(W - M.l - M.r)).tickFormat(""));
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - M.b})`).call(d3.axisBottom(x).ticks(6).tickFormat(v => FR.format(",.0f")(v) + " $"));
    svg.append("g").attr("class", "axis").attr("transform", `translate(${M.l},0)`).call(d3.axisLeft(y).ticks(6)).call(g => g.select(".domain").remove());
    svg.append("text").attr("class", "axis-title").attr("x", M.l).attr("y", 12).text("score de satisfaction ACSI (sur 100)");
    svg.append("text").attr("class", "axis-title").attr("x", W - M.r).attr("y", H - 8).attr("text-anchor", "end")
      .text("coût moyen du retard par vol (USD de l'année)");
    if (data.length >= 3) {
      const { a, b } = regression(xs, ys);
      const [x0, x1] = d3.extent(xs);
      svg.append("line").attr("x1", x(x0)).attr("x2", x(x1)).attr("y1", y(a + b * x0)).attr("y2", y(a + b * x1))
        .attr("stroke", css("--series-2")).attr("stroke-width", 2).attr("stroke-dasharray", "6 4");
      svg.append("text").attr("x", x(x1)).attr("y", y(a + b * x1) - 8).attr("text-anchor", "end").attr("class", "direct-label")
        .text(`tendance : ${FR.format("+.2f")(b * 100)} point ACSI pour +100 $ par vol`);
    }
    const c1 = css("--series-1"), surf = css("--surface-1"), muted = css("--text-muted");
    svg.append("g").selectAll("circle").data(data).join("circle")
      .attr("cx", d => x(d.coutParVol)).attr("cy", d => y(d.acsi))
      .attr("r", d => S.focus === d.c ? 8 : 6)
      .attr("fill", d => !S.focus || S.focus === d.c ? c1 : muted)
      .attr("fill-opacity", d => !S.focus || S.focus === d.c ? 0.85 : 0.35)
      .attr("stroke", surf).attr("stroke-width", 2)
      .on("mousemove", (e, d) => tip.show(e, `<div class="t">${d.nom} — vols ${d.an}</div>` +
        ligneTip("Score ACSI", `${d.acsi} / 100`) + ligneTip("Coût moyen par vol", FR.format(",.0f")(d.coutParVol) + " $") +
        ligneTip("Coût total", fmt.money(d.cout, "USD")) + ligneTip("Vols", fmt.int(d.vols))))
      .on("mouseleave", () => tip.hide());
    if (S.focus) {
      const f = data.filter(d => d.c === S.focus).sort((a, b) => a.an - b.an);
      svg.append("path").datum(f).attr("fill", "none").attr("stroke", c1).attr("stroke-width", 1.5)
        .attr("d", d3.line().x(d => x(d.coutParVol)).y(d => y(d.acsi)));
      svg.append("g").selectAll("text").data(f).join("text").attr("class", "direct-label")
        .attr("x", d => x(d.coutParVol) + 9).attr("y", d => y(d.acsi) + 4).text(d => d.an);
    }

    root.select("#k6-insight").html(`Sur ${S.an === "toutes" ? "l'ensemble des années (hors 2020)" : "l'année " + S.an},
      on observe une <strong>${interpretation(r)}</strong> (r = ${isNaN(r) ? "—" : FR.format("+.2f")(r)}, n = ${data.length}).
      ${!isNaN(r) && r < 0 ? "Les compagnies dont les retards coûtent le plus par vol ont, en moyenne, des passagers un peu moins satisfaits." : ""}
      Une corrélation ne prouve pas un lien de cause à effet.`);

    // tableau des coefficients par annee
    const lignes = [{ an: "Toutes (hors 2020)", d: tout }, ...annees.map(a => ({ an: a, d: tout.filter(x => x.an === a) }))]
      .map(l => { const X = l.d.map(d => d.coutParVol), Y = l.d.map(d => d.acsi);
        return { an: l.an, n: l.d.length, r: pearson(X, Y), rho: spearman(X, Y) }; });
    tableau("#k6-table", [
      { label: "Années de vols", value: d => d.an },
      { label: "n", num: true, value: d => d.n },
      { label: "Pearson r", num: true, value: d => d.r, format: v => isNaN(v) ? "—" : FR.format("+.2f")(v) },
      { label: "Spearman ρ", num: true, value: d => d.rho, format: v => isNaN(v) ? "—" : FR.format("+.2f")(v) },
      { label: "Lecture", value: d => interpretation(d.r) },
    ], lignes, "Coefficients de corrélation coût du retard / satisfaction");
  }
  maj();
  redessins.push(maj);
}
