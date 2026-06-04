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

let _chartData = null;

function drawAllCharts() {
  if (!_chartData) return;
  const {
    stateRoadUser, stateAnnualTotals, stateCounterparty,
    fnByAge, fnByRoadUser, fnByRemoteness,
    nationalAq2, nationalAq4, geojson, population,
  } = _chartData;
  // Clear filter buttons so drawTrend can rebuild them cleanly on each redraw
  const filterRow = document.getElementById('aq1-filters');
  if (filterRow) filterRow.innerHTML = '';
  drawTrend(stateRoadUser, '#chart-trend');
  drawStackedArea(stateRoadUser, '#chart-stacked');
  drawHeatmap(nationalAq2, '#chart-heatmap');
  drawSexRoadUser(nationalAq2, '#chart-sex-road-user');
  drawPyramid(nationalAq2, '#chart-pyramid');
  drawChoropleth(stateAnnualTotals, population, geojson, '#chart-choropleth');
  drawFirstNationsSlope(fnByAge, fnByRoadUser, '#chart-fn-slope');
  drawRemoteness(fnByRemoteness, '#chart-remoteness');
  drawCounterpartyBar(stateCounterparty, '#chart-counterparty');
  drawSankey(nationalAq4, '#chart-sankey');
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

    const heroTotal = d3.sum(stateAnnualTotals, d => num(d[HOSPS]));
    const heroEl = document.getElementById('hero-total');
    if (heroEl) heroEl.textContent = fmt(heroTotal);

    _chartData = {
      stateRoadUser, stateAnnualTotals, stateCounterparty,
      fnByAge, fnByRoadUser, fnByRemoteness,
      nationalAq2, nationalAq4, geojson, population,
    };
    drawAllCharts();
  } catch (err) {
    console.error('Chart init failed:', err);
  }
  initNav();

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      d3.selectAll('svg, .data-note').remove();
      drawAllCharts();
    }, 250);
  });
})();
