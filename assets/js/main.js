function initNav() {
  const sections = document.querySelectorAll('.chapter');
  const navLinks = document.querySelectorAll('.nav-link');
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      navLinks.forEach(l => l.classList.remove('active'));
      const active = document.querySelector(`.nav-link[href="#${e.target.id}"]`);
      if (active) active.classList.add('active');
    });
  }, { threshold: 0.35 });
  sections.forEach(s => obs.observe(s));
}

(async function init() {
  try {
    const [
      stateRoadUser,
      stateAnnualTotals,
      stateCounterparty,
      fnByAge,
      fnByRoadUser,
      fnByRemoteness,
      nationalAq2,
      nationalAq4,
      geojson,
      population,
    ] = await Promise.all([
      d3.csv(DATA.stateRoadUser),
      d3.csv(DATA.stateAnnualTotals),
      d3.csv(DATA.stateCounterparty),
      d3.csv(DATA.fnByAge),
      d3.csv(DATA.fnByRoadUser),
      d3.csv(DATA.fnByRemoteness),
      d3.csv(DATA.nationalAq2),
      d3.csv(DATA.nationalAq4),
      d3.json(DATA.geojson),
      d3.csv(DATA.population),
    ]);

    // Hero stat: sum all states across all years (state-attributable total)
    const heroTotal = d3.sum(stateAnnualTotals, d => num(d[HOSPS]));
    const heroEl = document.getElementById('hero-total');
    if (heroEl) heroEl.textContent = fmt(heroTotal);

    await Promise.all([
      drawTrend(stateRoadUser, '#chart-trend'),
      drawStackedArea(stateRoadUser, '#chart-stacked'),
      drawHeatmap(nationalAq2, '#chart-heatmap'),
      drawSexRoadUser(nationalAq2, '#chart-sex-road-user'),
      drawPyramid(nationalAq2, '#chart-pyramid'),
      drawChoropleth(stateAnnualTotals, population, geojson, '#chart-choropleth'),
      drawFirstNationsSlope(fnByAge, fnByRoadUser, '#chart-fn-slope'),
      drawRemoteness(fnByRemoteness, '#chart-remoteness'),
      drawCounterpartyBar(stateCounterparty, '#chart-counterparty'),
      drawSankey(nationalAq4, '#chart-sankey'),
    ]);
  } catch (err) {
    console.error('Chart init failed:', err);
  }
  initNav();
})();
