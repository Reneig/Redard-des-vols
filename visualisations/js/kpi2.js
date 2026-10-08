/* ==========================================================================
   KPI 2 - Repartition des causes de retard (barres empilees par annee)
   USA : 5 causes BTS ; Europe : categories des retards ATFM (EUROCONTROL)
   ========================================================================== */
const CAUSES = {
  USA: [
    { k: "kA", label: "Avion précédent en retard" },
    { k: "kC", label: "Compagnie aérienne" },
    { k: "kN", label: "Système aérien (NAS : contrôle, trafic)" },
    { k: "kM", label: "Météo" },
    { k: "kS", label: "Sûreté" },
  ],
  Europe: [
    { k: "aC", label: "Capacité (contrôle, aéroport)" },
    { k: "aP", label: "Personnel du contrôle aérien" },
    { k: "aM", label: "Météo" },
    { k: "aG", label: "Perturbations et grèves" },
    { k: "aE", label: "Événements" },
  ],
};

function kpi2() {
  const S = { zone: "USA", filtre1: "tous", filtre2: "tous", mode: "part" };
  const root = d3.select("#kpi2");

  segment("#k2-zone", [{ value: "USA", label: "USA" }, { value: "Europe", label: "Europe" }], S.zone, z => {
    S.zone = z; S.filtre1 = "tous"; S.filtre2 = "tous"; initFiltres(); maj();
  });
  segment("#k2-mode", [{ value: "part", label: "Parts (%)" }, { value: "minutes", label: "Minutes" }], S.mode, m => { S.mode = m; maj(); });
  root.select("#k2-f1").on("change", function () { S.filtre1 = this.value; S.filtre2 = "tous"; initFiltre2(); maj(); });
  root.select("#k2-f2").on("change", function () { S.filtre2 = this.value; maj(); });

  function initFiltres() {
    if (S.zone === "USA") {
      root.select("#k2-f1-lab").text("Compagnie");
      const comp = d3.rollups(APP.us, v => d3.sum(v, r => r.n), r => r.c).sort((a, b) => b[1] - a[1]);
      remplirSelect("#k2-f1", [{ value: "tous", label: "Toutes les compagnies" },
        ...comp.map(([c]) => ({ value: c, label: nomCompagnie(c) }))], S.filtre1);
    } else {
      root.select("#k2-f1-lab").text("Pays");
      const pays = Array.from(new Set(APP.eu.map(r => r.pays))).sort(d3.ascending);
      remplirSelect("#k2-f1", [{ value: "tous", label: "Tous les pays" }, ...pays.map(p => ({ value: p, label: p }))], S.filtre1);
    }
    initFiltre2();
  }
  function lignesFiltrees(sansFiltre2) {
    if (S.zone === "USA") {
      let rows = APP.us;
      if (S.filtre1 !== "tous") rows = rows.filter(r => r.c === S.filtre1);
      if (!sansFiltre2 && S.filtre2 !== "tous") rows = rows.filter(r => r.o === S.filtre2);
      return rows;
    }
    let rows = APP.eu;
    if (S.filtre1 !== "tous") rows = rows.filter(r => r.pays === S.filtre1);
    if (!sansFiltre2 && S.filtre2 !== "tous") rows = rows.filter(r => r.o === S.filtre2);
    return rows;
  }
  function initFiltre2() {
    const rows = lignesFiltrees(true);
    const v = S.zone === "USA" ? (r => r.n) : (r => r.dep);
    const apts = d3.rollups(rows, x => d3.sum(x, v), r => r.o).sort((a, b) => b[1] - a[1]).slice(0, 80);
    remplirSelect("#k2-f2", [{ value: "tous", label: "Tous les aéroports" },
      ...apts.map(([c]) => ({ value: c, label: nomAeroport(c) }))], S.filtre2);
  }

  function maj() {
    const causes = CAUSES[S.zone];
    const couleurs = SERIES();
    causes.forEach((c, i) => c.color = couleurs[i]);
    const rows = lignesFiltrees(false);
    const parAn = d3.rollups(rows, v => {
      const o = { total: 0 };
      for (const c of causes) { o[c.k] = d3.sum(v, r => r[c.k]); o.total += o[c.k]; }
      return o;
    }, r => r.an).map(([an, o]) => ({ an, ...o })).sort((a, b) => a.an - b.an);

    legende("#k2-legende", causes.map(c => ({ label: c.label, color: c.color })));
    barresEmpilees("#k2-chart", parAn, causes, S.mode);

    // tableau : minutes et parts par cause et par annee
    const cols = [{ label: "Année", value: d => d.an }];
    for (const c of causes) {
      cols.push({ label: c.label, num: true, html: d => d.total ? `${fmt.pct(d[c.k] / d.total)}<br><small style="color:var(--text-muted)">${fmt.int(Math.round(d[c.k]))} min</small>` : "—" });
    }
    cols.push({ label: "Total (min)", num: true, value: d => d.total, format: v => fmt.int(Math.round(v)) });
    tableau("#k2-table", cols, parAn, "Minutes de retard attribuées à chaque cause");

    // synthese sur toute la periode
    const tot = {}; let T = 0;
    for (const c of causes) { tot[c.k] = d3.sum(parAn, d => d[c.k]); T += tot[c.k]; }
    if (T > 0) {
      const top = causes.slice().sort((a, b) => tot[b.k] - tot[a.k]);
      root.select("#k2-insight").html(`Sur 2019-2025, la première cause est <strong>« ${top[0].label} »</strong>
        (${fmt.pct(tot[top[0].k] / T)} des minutes), suivie de <strong>« ${top[1].label} »</strong> (${fmt.pct(tot[top[1].k] / T)}).`);
    } else root.select("#k2-insight").html("");
    root.select("#k2-note").style("display", S.zone === "Europe" ? null : "none");
  }

  initFiltres();
  maj();
  redessins.push(maj);
}

function barresEmpilees(sel, data, causes, mode) {
  const el = d3.select(sel).html("");
  if (!data.length || !d3.sum(data, d => d.total)) { el.html(`<div class="empty">Pas de minutes de retard pour cette sélection.</div>`); return; }
  const W = largeur(sel), H = 380, M = { t: 16, r: 16, b: 34, l: 64 };
  const svg = el.append("svg").attr("viewBox", `0 0 ${W} ${H}`);
  const keys = causes.map(c => c.k);
  const valeurs = data.map(d => {
    const o = { an: d.an, total: d.total };
    for (const k of keys) o[k] = mode === "part" ? (d.total ? d[k] / d.total : 0) : d[k];
    return o;
  });
  const stack = d3.stack().keys(keys)(valeurs);
  const x = d3.scaleBand().domain(data.map(d => d.an)).range([M.l, W - M.r]).padding(0.35);
  const y = d3.scaleLinear().domain([0, mode === "part" ? 1 : d3.max(valeurs, d => keys.reduce((s, k) => s + d[k], 0))]).nice()
    .range([H - M.b, M.t]);
  const yFmt = mode === "part" ? fmt.pct0 : (v => v >= 1e6 ? FR.format(",.0f")(v / 1e6) + " M" : FR.format(",.0f")(v));
  svg.append("g").attr("class", "grid").attr("transform", `translate(${M.l},0)`)
    .call(d3.axisLeft(y).ticks(5).tickSize(-(W - M.l - M.r)).tickFormat(""));
  svg.append("g").attr("class", "axis").attr("transform", `translate(${M.l},0)`)
    .call(d3.axisLeft(y).ticks(5).tickFormat(yFmt)).call(g => g.select(".domain").remove());
  svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - M.b})`).call(d3.axisBottom(x));
  svg.append("text").attr("class", "axis-title").attr("x", M.l).attr("y", 10)
    .text(mode === "part" ? "part des minutes de retard" : "minutes de retard");
  const surf = css("--surface-1");
  svg.append("g").selectAll("g").data(stack).join("g")
    .attr("fill", (s, i) => causes[i].color)
    .selectAll("rect").data(s => s.map(p => ({ p, k: s.key }))).join("rect")
    .attr("x", d => x(d.p.data.an)).attr("width", x.bandwidth())
    .attr("y", d => y(d.p[1])).attr("height", d => Math.max(0, y(d.p[0]) - y(d.p[1])))
    .attr("stroke", surf).attr("stroke-width", 2)          // ecart de 2 px entre segments
    .on("mousemove", (e, d) => {
      const c = causes.find(c => c.k === d.k);
      const brut = data.find(x => x.an === d.p.data.an);
      tip.show(e, `<div class="t">${d.p.data.an} — ${c.label}</div>` +
        ligneTip("Part", fmt.pct(brut[d.k] / brut.total)) + ligneTip("Minutes", fmt.int(Math.round(brut[d.k]))));
    })
    .on("mouseleave", () => tip.hide());
}
