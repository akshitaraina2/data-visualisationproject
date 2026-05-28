// ─────────────────────────────────────────────────────────────────────────────
// aq2.js — AQ2: Who Is Affected
// Visualises hospitalisation distribution by age group 2011–2021.
//
// drawAge → animated bar chart with a year slider for temporal exploration
//
// Depends on: constants.js (fmt, num, M, DATA, ST_COUNT, AGE_ORDER, ageColors,
//             getContainerWidth, showTooltip, hideTooltip)
// ─────────────────────────────────────────────────────────────────────────────


/**
 * Draws a bar chart showing hospitalisations per age group for a selected year.
 * Data is aggregated from state_territory_4: all states + both half-year periods
 * are summed per age group per calendar year.
 * A year slider lets users scrub through 2011–2021; bars animate on each change.
 */
async function drawAge() {
  const rawCsv = await d3.csv(DATA.age);

  // Aggregate to { age_group, year, hospitalisations }.
  const rolled = d3.rollup(
    rawCsv,
    v => d3.sum(v, d => num(d[ST_COUNT])),
    d => d['age group'],
    d => +d['calendar year']
  );

  const raw = [];
  rolled.forEach((years, age_group) => {
    years.forEach((hospitalisations, year) => {
      raw.push({ year, age_group, hospitalisations });
    });
  });

  const id = 'chart-age';
  const W  = getContainerWidth(id);
  const H  = 380;
  const w  = W - M.left  - M.right;
  const h  = H - M.top   - M.bottom;

  const svg = d3.select(`#${id}`)
    .append('svg').attr('width', W).attr('height', H)
    .append('g').attr('transform', `translate(${M.left},${M.top})`);

  // Band scale uses AGE_ORDER to enforce demographic ordering, not alphabetical.
  const x      = d3.scaleBand().domain(AGE_ORDER).range([0, w]).padding(0.25);
  const maxVal = d3.max(raw, d => d.hospitalisations);
  const y      = d3.scaleLinear().domain([0, maxVal * 1.15]).range([h, 0]);

  svg.append('g').attr('class', 'grid')
    .call(d3.axisLeft(y).ticks(5).tickSize(-w).tickFormat(''));

  // All bars start at baseline height 0; the update() function animates them.
  const bars = svg.selectAll('.age-bar').data(AGE_ORDER).enter()
    .append('rect').attr('class', 'age-bar')
    .attr('x', d => x(d)).attr('width', x.bandwidth())
    .attr('y', h).attr('height', 0)
    .attr('fill', d => ageColors(d))
    .attr('rx', 2).style('cursor', 'pointer');

  // Axes.
  svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x));
  svg.append('g').attr('class', 'axis')
    .call(d3.axisLeft(y).ticks(5).tickFormat(d => d3.format(',')(d)));
  svg.append('text').attr('transform', 'rotate(-90)')
    .attr('x', -h / 2).attr('y', -52)
    .attr('text-anchor', 'middle').attr('fill', 'var(--muted)')
    .attr('font-family', "'DM Mono', monospace").attr('font-size', '11px')
    .text('Hospitalisations');

  /** Filters data to the selected year and transitions bars to their new heights. */
  function update(year) {
    document.getElementById('yearLabel').textContent = year;
    const yearData = raw.filter(d => d.year === year);
    const byAge    = Object.fromEntries(yearData.map(d => [d.age_group, d.hospitalisations]));

    bars.data(AGE_ORDER)
      .on('mousemove', (event, d) => showTooltip('tooltip-age',
        `<strong>${d}</strong><br/>${year}: ${fmt(byAge[d] || 0)}`, event))
      .on('mouseleave', () => hideTooltip('tooltip-age'))
      .transition().duration(500).ease(d3.easeCubicOut)
      .attr('y',      d => y(byAge[d] || 0))
      .attr('height', d => h - y(byAge[d] || 0));
  }

  // Initialise to the most recent year, then wire the slider.
  update(2021);
  document.getElementById('yearSlider').addEventListener('input', e => update(+e.target.value));
}
