/* ==========================================================================
   KPI 7 - Reseau dynamique des connexions entre aeroports (USA, BTS)
   Noeuds = aeroports ; liens = liaisons directes (les deux sens additionnes)
   ========================================================================== */
function kpi7(fonds) {
  const moisListe = Array.from(APP.usParMois.keys()).sort((a, b) => a - b);
  const S = { i: moisListe.indexOf(202407) >= 0 ? moisListe.indexOf(202407) : moisListe.length - 1,
              seuil: 300, vue: "carte", focus: null, timer: null };
  const root = d3.select("#kpi7");
  const lab = k => `${MOIS[k % 100 - 1]} ${Math.floor(k / 100)}`;

  const slider = root.select("#k7-mois").attr("min", 0).attr("max", moisListe.length - 1).property("value", S.i)
    .on("input", function () { S.i = +this.value; maj(); });
  root.select("#k7-seuil").property("value", S.seuil).on("input", function () { S.seuil = +this.value; root.select("#k7-seuil-val").text(fmt.int(S.seuil)); maj(); });
  root.select("#k7-seuil-val").text(fmt.int(S.seuil));
  segment("#k7-vue", [{ value: "carte", label: "Carte" }, { value: "forces", label: "Graphe de forces" }], S.vue, v => { S.vue = v; maj(); });
  root.select("#k7-play").on("click", function () {
    if (S.timer) { clearInterval(S.timer); S.timer = null; this.textContent = "▶ Animer"; return; }
    this.textContent = "❚❚ Pause";
    S.timer = setInterval(() => { S.i = (S.i + 1) % moisListe.length; slider.property("value", S.i); maj(); }, 900);
  });

  let sim = null;
  const positions = new Map();    // garde la position des noeuds entre deux mois (graphe de forces)

  function reseau(k) {
    const rows = APP.usParMois.get(k) || [];
    const liens = new Map();
    for (const r of rows) {
      const [a, b] = r.o < r.d ? [r.o, r.d] : [r.d, r.o];
      const key = a + "-" + b;
      let l = liens.get(key);
      if (!l) liens.set(key, l = { source: a, target: b, n: 0, arr: 0, sArr: 0, r15: 0 });
      l.n += r.n; l.arr += r.arr; l.sArr += r.sArr; l.r15 += r.r15;
    }
    const tous = Array.from(liens.values());
    const noeuds = new Map();
    for (const l of tous) for (const c of [l.source, l.target]) {
      let n = noeuds.get(c);
      if (!n) noeuds.set(c, n = { id: c, vols: 0, degre: 0, arr: 0, sArr: 0 });
      n.vols += l.n; n.degre += 1; n.arr += l.arr; n.sArr += l.sArr;
    }
    const liensAff = tous.filter(l => l.n >= S.seuil).map(l => ({ ...l, retard: l.arr ? l.sArr / l.arr : NaN }));
    const ids = new Set(liensAff.flatMap(l => [l.source, l.target]));
    const nds = Array.from(noeuds.values()).filter(n => ids.has(n.id)).map(n => ({ ...n, retard: n.arr ? n.sArr / n.arr : NaN }));
    return { liens: liensAff, noeuds: nds, nbLiens: tous.length, nbAeroports: noeuds.size, tousNoeuds: noeuds };
  }

  function maj() {
    const k = moisListe[S.i];
    root.select("#k7-mois-val").text(lab(k));
    root.select("#k7-fig-mois").text(lab(k));
    const R = reseau(k);
    if (sim) { sim.stop(); sim = null; }

    d3.select("#k7-tiles").html("").selectAll("div").data([
      { v: fmt.int(R.nbAeroports), l: "Aéroports desservis" },
      { v: fmt.int(R.nbLiens), l: "Liaisons directes actives" },
      { v: fmt.int(R.liens.length), l: `Liaisons affichées (≥ ${fmt.int(S.seuil)} vols)` },
      { v: fmt.dec1(2 * R.nbLiens / R.nbAeroports), l: "Connexions moyennes par aéroport" },
    ]).join("div").attr("class", "tile").html(d => `<div class="v">${d.v}</div><div class="l">${d.l}</div>`);

    const el = d3.select("#k7-chart").html("");
    const W = largeur("#k7-chart"), H = Math.round(W * 0.6);
    const svg = el.append("svg").attr("viewBox", `0 0 ${W} ${H}`);
    if (!R.liens.length) { el.html(`<div class="empty">Aucune liaison au-dessus du seuil ce mois-ci.</div>`); return; }

    const retards = R.liens.map(l => l.retard).filter(v => !isNaN(v));
    const dom = [d3.quantile(retards, 0.05), d3.quantile(retards, 0.95)];
    const ramp = d3.scaleSequential(d3.interpolateRgbBasis([css("--seq-100"), css("--seq-400"), css("--seq-700")])).domain(dom).clamp(true);
    legendeCouleur("#k7-legende", ramp, dom, fmt.min, "Couleur des liaisons : retard moyen à l'arrivée (min)");
    const w = d3.scaleLinear().domain([S.seuil, d3.max(R.liens, l => l.n)]).range([0.6, 5]);
    const rN = d3.scaleSqrt().domain([0, d3.max(R.noeuds, n => n.vols)]).range([2, 16]);
    const surf = css("--surface-1"), ink = css("--text-primary");

    const proj = d3.geoAlbersUsa().fitSize([W, H], fonds.etats);
    if (S.vue === "carte") {
      svg.append("g").selectAll("path").data(fonds.etats.features).join("path").attr("class", "land").attr("d", d3.geoPath(proj));
    }
    const gL = svg.append("g").attr("fill", "none");
    const gN = svg.append("g");
    const link = gL.selectAll("path").data(R.liens).join("path")
      .attr("stroke", l => ramp(l.retard)).attr("stroke-width", l => w(l.n)).attr("stroke-opacity", 0.7)
      .on("mousemove", (e, l) => tip.show(e, `<div class="t">${l.source.id || l.source} ↔ ${l.target.id || l.target}</div>` +
        ligneTip("Vols (2 sens)", fmt.int(l.n)) + ligneTip("Retard moyen", fmt.min(l.retard)) +
        ligneTip("Vols ≥ 15 min", fmt.pct(l.r15 / l.arr))))
      .on("mouseleave", () => tip.hide());
    const node = gN.selectAll("g").data(R.noeuds, n => n.id).join("g").style("cursor", "pointer");
    node.append("circle").attr("r", n => rN(n.vols)).attr("fill", css("--series-2")).attr("stroke", surf).attr("stroke-width", 1.5);
    node.filter(n => rN(n.vols) > 8).append("text").attr("class", "direct-label").attr("text-anchor", "middle")
      .attr("dy", n => -rN(n.vols) - 3).text(n => n.id);
    node.on("mousemove", (e, n) => tip.show(e, `<div class="t">${nomAeroport(n.id)}</div>` +
        ligneTip("Aéroports reliés (tous)", fmt.int(R.tousNoeuds.get(n.id).degre)) + ligneTip("Vols (départs + arrivées)", fmt.int(n.vols)) +
        ligneTip("Retard moyen", fmt.min(n.retard)) + `<div style="margin-top:4px;color:var(--text-muted)">Cliquer pour isoler ses liaisons</div>`))
      .on("mouseleave", () => tip.hide())
      .on("click", (e, n) => { S.focus = S.focus === n.id ? null : n.id; surligner(); });

    function surligner() {
      const lie = l => [l.source.id || l.source, l.target.id || l.target].includes(S.focus);
      link.attr("stroke-opacity", l => !S.focus ? 0.7 : lie(l) ? 0.95 : 0.06);
      const voisins = new Set(R.liens.filter(lie).flatMap(l => [l.source.id || l.source, l.target.id || l.target]));
      node.style("opacity", n => !S.focus || voisins.has(n.id) ? 1 : 0.2);
    }

    if (S.vue === "carte") {
      const xy = id => { const a = APP.aeroports.get(id); return a ? proj([a.lon, a.lat]) : null; };
      link.attr("d", l => {
        const p = xy(l.source), q = xy(l.target);
        if (!p || !q) return null;
        const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, dx = q[0] - p[0], dy = q[1] - p[1];
        return `M${p[0]},${p[1]} Q${mx - dy * 0.15},${my + dx * 0.15} ${q[0]},${q[1]}`;   // arc leger
      });
      node.attr("transform", n => { const p = xy(n.id); return p ? `translate(${p})` : "translate(-99,-99)"; });
    } else {
      R.noeuds.forEach(n => { const p = positions.get(n.id); if (p) { n.x = p.x; n.y = p.y; } else {
        const a = APP.aeroports.get(n.id); const q = a && proj([a.lon, a.lat]); n.x = q ? q[0] : W / 2; n.y = q ? q[1] : H / 2; } });
      sim = d3.forceSimulation(R.noeuds)
        .force("link", d3.forceLink(R.liens).id(n => n.id).distance(90).strength(0.25))
        .force("charge", d3.forceManyBody().strength(-160))
        .force("collide", d3.forceCollide(n => rN(n.vols) + 2))
        .force("center", d3.forceCenter(W / 2, H / 2))
        .force("x", d3.forceX(W / 2).strength(0.03)).force("y", d3.forceY(H / 2).strength(0.05))
        .on("tick", () => {
          link.attr("d", l => `M${l.source.x},${l.source.y} L${l.target.x},${l.target.y}`);
          node.attr("transform", n => `translate(${n.x},${n.y})`);
        })
        .on("end", () => R.noeuds.forEach(n => positions.set(n.id, { x: n.x, y: n.y })));
      node.call(d3.drag()
        .on("start", (e, n) => { if (!e.active) sim.alphaTarget(0.3).restart(); n.fx = n.x; n.fy = n.y; })
        .on("drag", (e, n) => { n.fx = e.x; n.fy = e.y; })
        .on("end", (e, n) => { if (!e.active) sim.alphaTarget(0); n.fx = null; n.fy = null; }));
    }
    surligner();

    const hubs = Array.from(R.tousNoeuds.values()).sort((a, b) => b.degre - a.degre || b.vols - a.vols).slice(0, 10);
    tableau("#k7-table", [
      { label: "Rang", value: (d) => hubs.indexOf(d) + 1 },
      { label: "Aéroport", value: d => nomAeroport(d.id) },
      { label: "Aéroports reliés", num: true, value: d => d.degre, format: fmt.int },
      { label: "Vols (départs + arrivées)", num: true, value: d => d.vols, format: fmt.int },
      { label: "Retard moyen", num: true, value: d => d.arr ? d.sArr / d.arr : NaN, format: fmt.min },
    ], hubs, `Les 10 plateformes les plus connectées — ${lab(k)}`);
  }
  maj();
  redessins.push(maj);
}
