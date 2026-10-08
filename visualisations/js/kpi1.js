/* ==========================================================================
   KPI 1 - Evolution du retard moyen d'un aeroport vers ses destinations
   USA : detail par liaison (origine -> destination), BTS
   Europe : moyenne de l'aeroport toutes destinations, EUROCONTROL
   ========================================================================== */
function kpi1() {
  const S = { zone: "USA", aeroport: "ATL", dests: [], metrique: "retard" };
  const root = d3.select("#kpi1");

  segment("#k1-zone", [{ value: "USA", label: "USA" }, { value: "Europe", label: "Europe" }], S.zone, z => {
    S.zone = z; initAeroports(); maj();
  });
  root.select("#k1-aeroport").on("change", function () { S.aeroport = this.value; initDestinations(); maj(); });

  function initAeroports() {
    let liste;
    if (S.zone === "USA") {
      liste = Array.from(APP.usParOrigine, ([code, rows]) => ({ code, n: d3.sum(rows, r => r.n) }));
    } else {
      liste = Array.from(APP.euParAeroport, ([code, rows]) => ({ code, n: d3.sum(rows, r => r.dep) }));
    }
    liste.sort((a, b) => b.n - a.n);
    if (!liste.find(d => d.code === S.aeroport)) S.aeroport = liste[0].code;
    if (S.zone === "Europe" && S.aeroport === "ATL") S.aeroport = liste[0].code;
    remplirSelect("#k1-aeroport", liste.map(d => ({ value: d.code, label: nomAeroport(d.code) })), S.aeroport);
    root.select("#k1-dest-wrap").style("display", S.zone === "USA" ? null : "none");
    root.select("#k1-metrique-wrap").style("display", S.zone === "USA" ? null : "none");
    initDestinations();
  }

  function initDestinations() {
    if (S.zone !== "USA") return;
    const rows = APP.usParOrigine.get(S.aeroport) || [];
    const top = d3.rollups(rows, v => d3.sum(v, r => r.n), r => r.d).sort((a, b) => b[1] - a[1]).slice(0, 10);
    S.dests = top.slice(0, 3).map(d => d[0]);
    const lab = root.select("#k1-dests").selectAll("label").data(top, d => d[0]).join(enter => {
      const l = enter.append("label");
      l.append("input").attr("type", "checkbox");
      l.append("span");
      return l;
    });
    lab.select("input").property("checked", d => S.dests.includes(d[0])).on("change", function (e, d) {
      if (this.checked) {
        if (S.dests.length >= 4) { this.checked = false; return; }   // 4 destinations max (lisibilite)
        S.dests.push(d[0]);
      } else S.dests = S.dests.filter(x => x !== d[0]);
      maj();
    });
    lab.select("span").text(d => `${d[0]} (${fmt.int(d[1])} vols)`);
  }

  segment("#k1-metrique", [
    { value: "retard", label: "Retard moyen (min)" },
    { value: "taux", label: "Part des vols ≥ 15 min" },
    { value: "vols", label: "Nombre de vols" }], S.metrique, m => { S.metrique = m; maj(); });

  // ---- series mensuelles ----
  function seriesUSA() {
    const rows = APP.usParOrigine.get(S.aeroport) || [];
    const val = s => S.metrique === "retard" ? s.retardMoyen : S.metrique === "taux" ? s.tauxRetard : s.n;
    const parMois = (rs) => {
      const m = d3.rollup(rs, sommeUS, r => r.an * 100 + r.mo);
      return Array.from(m, ([k, s]) => ({ date: new Date(Math.floor(k / 100), k % 100 - 1, 1), v: val(s), s }))
        .sort((a, b) => a.date - b.date);
    };
    const series = [{ id: "toutes", label: `${S.aeroport} → toutes destinations`, values: parMois(rows) }];
    for (const dst of S.dests) {
      series.push({ id: dst, label: `${S.aeroport} → ${dst}`, values: parMois(rows.filter(r => r.d === dst)) });
    }
    return series;
  }
  function seriesEU() {
    const rows = APP.euParAeroport.get(S.aeroport) || [];
    const m = d3.rollup(rows, sommeEU, r => r.an * 100 + r.mo);
    const pts = Array.from(m, ([k, s]) => ({ date: new Date(Math.floor(k / 100), k % 100 - 1, 1), s })).sort((a, b) => a.date - b.date);
    return [
      { id: "dep", label: "Retard moyen au départ (toutes causes)", values: pts.map(p => ({ ...p, v: p.s.retardDepart })) },
      { id: "atfm", label: "Retard ATFM moyen par arrivée", values: pts.map(p => ({ ...p, v: p.s.atfmParArrivee })) },
    ];
  }

  function maj() {
    const series = S.zone === "USA" ? seriesUSA() : seriesEU();
    const couleurs = SERIES();
    series.forEach((s, i) => s.color = couleurs[i]);
    const yLabel = S.zone === "Europe" ? "minutes par vol" :
      S.metrique === "retard" ? "retard moyen à l'arrivée (min)" : S.metrique === "taux" ? "part des vols retardés ≥ 15 min" : "nombre de vols";
    const yFmt = S.zone === "USA" && S.metrique === "taux" ? fmt.pct0 : S.zone === "USA" && S.metrique === "vols" ? FR.format(",.0f") : FR.format(",.0f");
    const valFmt = S.zone === "USA" && S.metrique === "taux" ? fmt.pct : S.zone === "USA" && S.metrique === "vols" ? fmt.int : fmt.min;

    legende("#k1-legende", series.map(s => ({ label: s.label, color: s.color })), true);
    graphiqueLignes("#k1-chart", series, { yLabel, yFmt, valFmt });

    // tableau croise : une ligne par liaison, une colonne par annee (moyennes ponderees sur l'annee)
    const annuel = (s, an) => {
      const pts = s.values.filter(p => p.date.getFullYear() === an);
      if (!pts.length) return NaN;
      if (S.zone === "USA") {
        const t = sommeUS(pts.map(p => p.s));
        return S.metrique === "retard" ? t.retardMoyen : S.metrique === "taux" ? t.tauxRetard : t.n;
      }
      const t = sommeEU(pts.map(p => p.s));
      return s.id === "dep" ? t.retardDepart : t.atfmParArrivee;
    };
    const cols = [{ label: S.zone === "USA" ? "Liaison" : "Indicateur",
                    html: l => `<span class="swatch" style="background:${l.color}"></span>${l.label}` },
                  ...APP.annees.map(an => ({ label: String(an), num: true, value: l => annuel(l, an), format: v => isNaN(v) ? "—" : valFmt(v) }))];
    tableau("#k1-table", cols, series, `Moyenne annuelle — ${yLabel}`);

    // phrase de synthese
    const all = series[0].values.filter(p => !isNaN(p.v));
    if (all.length) {
      const pire = d3.greatest(all, p => p.v), mieux = d3.least(all, p => p.v);
      root.select("#k1-insight").html(`Pour <strong>${nomAeroport(S.aeroport)}</strong>, le pic est atteint en
        <strong>${moisLabel(pire.date)}</strong> (${valFmt(pire.v)}) et le minimum en <strong>${moisLabel(mieux.date)}</strong>
        (${valFmt(mieux.v)}).`);
    }
  }

  initAeroports();
  maj();
  redessins.push(maj);
}

/* ---- graphique en lignes reutilisable (une seule echelle Y, info-bulle avec reticule) ---- */
function graphiqueLignes(sel, series, { yLabel, yFmt, valFmt }) {
  const el = d3.select(sel).html("");
  const W = largeur(sel), H = 380, M = { t: 16, r: 20, b: 34, l: 64 };
  const svg = el.append("svg").attr("viewBox", `0 0 ${W} ${H}`);
  const pts = series.flatMap(s => s.values.filter(p => !isNaN(p.v)));
  if (!pts.length) { el.html(`<div class="empty">Pas de données pour cette sélection.</div>`); return; }
  const x = d3.scaleTime().domain(d3.extent(pts, p => p.date)).range([M.l, W - M.r]);
  const yMin = d3.min(pts, p => p.v);
  const y = d3.scaleLinear().domain([Math.min(0, yMin), d3.max(pts, p => p.v)]).nice().range([H - M.b, M.t]);
  svg.append("g").attr("class", "grid").attr("transform", `translate(${M.l},0)`)
    .call(d3.axisLeft(y).ticks(6).tickSize(-(W - M.l - M.r)).tickFormat(""));
  svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - M.b})`)
    .call(d3.axisBottom(x).ticks(d3.timeYear.every(1)).tickFormat(d3.timeFormat("%Y")));
  svg.append("g").attr("class", "axis").attr("transform", `translate(${M.l},0)`)
    .call(d3.axisLeft(y).ticks(6).tickFormat(yFmt)).call(g => g.select(".domain").remove());
  svg.append("text").attr("class", "axis-title").attr("x", M.l).attr("y", 10).text(yLabel);
  if (y.domain()[0] < 0) svg.append("line").attr("x1", M.l).attr("x2", W - M.r).attr("y1", y(0)).attr("y2", y(0))
    .attr("stroke", css("--text-muted")).attr("stroke-dasharray", "3 3");

  const line = d3.line().defined(p => !isNaN(p.v)).x(p => x(p.date)).y(p => y(p.v));
  svg.append("g").selectAll("path").data(series).join("path")
    .attr("fill", "none").attr("stroke", s => s.color).attr("stroke-width", 2)
    .attr("stroke-linejoin", "round").attr("d", s => line(s.values));

  // reticule + info-bulle
  const focus = svg.append("g").style("display", "none");
  focus.append("line").attr("y1", M.t).attr("y2", H - M.b).attr("stroke", css("--text-muted")).attr("stroke-width", 1);
  const dots = focus.selectAll("circle").data(series).join("circle").attr("r", 4.5)
    .attr("fill", s => s.color).attr("stroke", css("--surface-1")).attr("stroke-width", 2);
  const dates = Array.from(new Set(pts.map(p => +p.date))).sort((a, b) => a - b);
  svg.append("rect").attr("x", M.l).attr("y", M.t).attr("width", W - M.l - M.r).attr("height", H - M.t - M.b)
    .attr("fill", "transparent")
    .on("mousemove", e => {
      const [mx] = d3.pointer(e);
      const t = x.invert(mx);
      const d = dates[Math.max(0, Math.min(dates.length - 1, d3.bisectCenter(dates, +t)))];
      focus.style("display", null).select("line").attr("x1", x(d)).attr("x2", x(d));
      let html = `<div class="t">${moisLabel(new Date(d))}</div>`;
      dots.each(function (s) {
        const p = s.values.find(v => +v.date === d);
        const ok = p && !isNaN(p.v);
        d3.select(this).style("display", ok ? null : "none").attr("cx", x(d)).attr("cy", ok ? y(p.v) : 0);
        html += ligneTip(`<span class="swatch" style="background:${s.color}"></span>${s.label}`, ok ? valFmt(p.v) : "n.d.");
      });
      tip.show(e, html);
    })
    .on("mouseleave", () => { focus.style("display", "none"); tip.hide(); });
}
