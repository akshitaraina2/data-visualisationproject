// ─────────────────────────────────────────────────────────────────────────────
// aq1.js — AQ1: The Big Picture
// Visualises national road crash hospitalisation trends 2011–2021.
//
// drawTrend     → animated area + line chart of national annual totals
// drawRoadUser  → multi-line chart per road user category with filter buttons
//
// Depends on: constants.js (fmt, num, M, DATA, ST_COUNT, roadUserColors,
//             roadUserShort, getContainerWidth, showTooltip, hideTooltip)
// ─────────────────────────────────────────────────────────────────────────────


/**
 * Draws an animated area + line chart of national annual hospitalisations.
 * Data is aggregated from state_territory_1: all states + both 6-monthly halves
 * are summed into a single national total per year.
 * Also populates the hero stat counter in the page header.
 */
async function drawTrend() {
  const raw = await d3.csv(DATA.state);

  // Sum every state and both half-year periods into one total per calendar year.
  const byYear = d3.rollup(
    raw,
    v => d3.sum(v, d => num(d[ST_COUNT])),
    d => +d['calendar year']
  );
  const data = Array.from(byYear, ([year, hospitalisations]) => ({ year, hospitalisations }))
    .sort((a, b) => a.year - b.year);

  // Populate the decade-total hero stat displayed above the fold.
  const total  = d3.sum(data, d => d.hospitalisations);
  const heroEl = document.getElementById('hero-total');
  if (heroEl) heroEl.textContent = fmt(total);

  const id = 'chart-trend';
  const W  = getContainerWidth(id);
  const H  = 380;
  const w  = W - M.left - M.right;
  const h  = H - M.top  - M.bottom;

  const svg = d3.select(`#${id}`)
    .append('svg').attr('width', W).attr('height', H)
    .append('g').attr('transform', `translate(${M.left},${M.top})`);

  const x = d3.scaleLinear().domain([2011, 2021]).range([0, w]);
  const y = d3.scaleLinear().domain([0, d3.max(data, d => d.hospitalisations) * 1.15]).range([h, 0]);

  // Horizontal grid lines for readability.
  svg.append('g').attr('class', 'grid')
    .call(d3.axisLeft(y).ticks(5).tickSize(-w).tickFormat(''));

  // Filled area under the trend line.
  const area = d3.area()
    .x(d => x(d.year))
    .y0(h).y1(d => y(d.hospitalisations))
    .curve(d3.curveCatmullRom);

  svg.append('path').datum(data)
    .attr('fill', 'rgba(245,166,35,0.12)')
    .attr('d', area);

  // Trend line, animated with stroke-dashoffset to draw from left to right.
  const line = d3.line()
    .x(d => x(d.year))
    .y(d => y(d.hospitalisations))
    .curve(d3.curveCatmullRom);

  const path = svg.append('path').datum(data)
    .attr('fill', 'none')
    .attr('stroke', '#f5a623')
    .attr('stroke-width', 2.5)
    .attr('d', line);

  const len = path.node().getTotalLength();
  path.attr('stroke-dasharray', len).attr('stroke-dashoffset', len)
    .transition().duration(1800).ease(d3.easeCubicInOut)
    .attr('stroke-dashoffset', 0);

  // Data point dots with hover tooltips.
  svg.selectAll('circle').data(data).enter().append('circle')
    .attr('cx', d => x(d.year))
    .attr('cy', d => y(d.hospitalisations))
    .attr('r', 5)
    .attr('fill', '#f5a623')
    .attr('stroke', '#0d0f14')
    .attr('stroke-width', 2)
    .style('cursor', 'pointer')
    .on('mousemove', (event, d) => showTooltip('tooltip-trend',
      `<strong>${d.year}</strong><br/>${fmt(d.hospitalisations)} hospitalisations`, event))
    .on('mouseleave', () => hideTooltip('tooltip-trend'));

  // COVID-19 annotation — marks the 2020 mobility-related dip.
  // The drop reflects reduced travel, not improved road safety.
  svg.append('line')
    .attr('x1', x(2020)).attr('x2', x(2020))
    .attr('y1', 0).attr('y2', h)
    .attr('stroke', '#e8453c').attr('stroke-width', 1)
    .attr('stroke-dasharray', '4,3');

  svg.append('text')
    .attr('x', x(2020) + 6).attr('y', 18)
    .attr('fill', '#e8453c')
    .attr('font-family', "'DM Mono', monospace")
    .attr('font-size', '10px')
    .text('COVID-19 dip');

  // Axes.
  svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).ticks(11).tickFormat(d3.format('d')));

  svg.append('g').attr('class', 'axis')
    .call(d3.axisLeft(y).ticks(5).tickFormat(d => d3.format(',')(d)));

  svg.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -h / 2).attr('y', -52)
    .attr('text-anchor', 'middle')
    .attr('fill', 'var(--muted)')
    .attr('font-family', "'DM Mono', monospace")
    .attr('font-size', '11px')
    .text('Hospitalisations');
}


/**
 * Draws a multi-line chart with one series per road user category.
 * Data is aggregated from state_territory_2: all states + both half-year periods
 * are summed per road user per calendar year.
 * Filter buttons above the chart let users isolate a single road user series.
 */
async function drawRoadUser() {
  const rawCsv = await d3.csv(DATA.roadUser);

  // Aggregate to { road_user, year, hospitalisations }.
  const rolled = d3.rollup(
    rawCsv,
    v => d3.sum(v, d => num(d[ST_COUNT])),
    d => d['road user'],
    d => +d['calendar year']
  );

  const raw = [];
  rolled.forEach((years, road_user) => {
    years.forEach((hospitalisations, year) => {
      raw.push({ year, road_user, hospitalisations });
    });
  });

  const grouped = d3.group(raw, d => d.road_user);
  const users   = Array.from(grouped.keys()).sort();

  // Build filter buttons — one per road user category plus an "All" toggle.
  const filterRow = document.getElementById('road-user-filters');
  const allBtn    = document.createElement('button');
  allBtn.className   = 'filter-btn active';
  allBtn.textContent = 'All';
  allBtn.dataset.user = 'all';
  filterRow.appendChild(allBtn);

  users.forEach(u => {
    const btn = document.createElement('button');
    btn.className    = 'filter-btn';
    btn.textContent  = roadUserShort[u] || u;
    btn.dataset.user = u;
    filterRow.appendChild(btn);
  });

  const id = 'chart-roaduser';
  const W  = getContainerWidth(id);
  const H  = 400;
  const w  = W - M.left - M.right;
  const h  = H - M.top  - M.bottom;

  const svg = d3.select(`#${id}`)
    .append('svg').attr('width', W).attr('height', H)
    .append('g').attr('transform', `translate(${M.left},${M.top})`);

  const x = d3.scaleLinear().domain([2011, 2021]).range([0, w]);
  const y = d3.scaleLinear()
    .domain([0, d3.max(raw, d => d.hospitalisations) * 1.2])
    .range([h, 0]);

  svg.append('g').attr('class', 'grid')
    .call(d3.axisLeft(y).ticks(5).tickSize(-w).tickFormat(''));

  const lineGen = d3.line()
    .x(d => x(d.year))
    .y(d => y(d.hospitalisations))
    .curve(d3.curveCatmullRom);

  // Draw one path per road user; data-user attribute is used by the filter interaction.
  const lines = svg.selectAll('.road-line')
    .data(Array.from(grouped.entries()))
    .enter().append('path')
      .attr('class', 'road-line')
      .attr('data-user', ([u]) => u)
      .attr('fill', 'none')
      .attr('stroke', ([u]) => roadUserColors[u] || '#888')
      .attr('stroke-width', 2)
      .attr('opacity', 0.85)
      .attr('d', ([, vals]) => lineGen(vals.sort((a, b) => a.year - b.year)));

  // Invisible hover dots per data point — become visible on mouseenter.
  grouped.forEach((vals, u) => {
    vals.sort((a, b) => a.year - b.year).forEach(d => {
      svg.append('circle')
        .attr('cx', x(d.year)).attr('cy', y(d.hospitalisations))
        .attr('r', 5).attr('fill', roadUserColors[u] || '#888')
        .attr('opacity', 0)
        .attr('data-user', u)
        .style('cursor', 'pointer')
        .on('mousemove', event => showTooltip('tooltip-roaduser',
          `<strong>${roadUserShort[u] || u}</strong><br/>${d.year}: ${fmt(d.hospitalisations)}`, event))
        .on('mouseenter', function () { d3.select(this).attr('opacity', 1); })
        .on('mouseleave', function () { d3.select(this).attr('opacity', 0); hideTooltip('tooltip-roaduser'); });
    });
  });

  // Axes.
  svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).ticks(11).tickFormat(d3.format('d')));
  svg.append('g').attr('class', 'axis')
    .call(d3.axisLeft(y).ticks(5).tickFormat(d => d3.format(',')(d)));
  svg.append('text').attr('transform', 'rotate(-90)')
    .attr('x', -h / 2).attr('y', -52)
    .attr('text-anchor', 'middle').attr('fill', 'var(--muted)')
    .attr('font-family', "'DM Mono', monospace").attr('font-size', '11px')
    .text('Hospitalisations');

  // Legend using shortened road user labels.
  const leg = svg.append('g').attr('transform', `translate(${w - 150}, 0)`);
  users.forEach((u, i) => {
    leg.append('rect').attr('x', 0).attr('y', i * 18).attr('width', 10).attr('height', 3)
      .attr('fill', roadUserColors[u] || '#888').attr('rx', 1);
    leg.append('text').attr('x', 16).attr('y', i * 18 + 4)
      .attr('fill', 'var(--muted)').attr('font-family', "'DM Mono', monospace")
      .attr('font-size', '9px').text(roadUserShort[u] || u);
  });

  // Filter buttons: clicking a road user fades all other lines to near-invisible.
  filterRow.addEventListener('click', e => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    document.querySelectorAll('#road-user-filters .filter-btn')
      .forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const selected = btn.dataset.user;

    svg.selectAll('.road-line')
      .transition().duration(300)
      .attr('opacity',      ([u]) => selected === 'all' || u === selected ? 0.85 : 0.08)
      .attr('stroke-width', ([u]) => selected !== 'all' && u === selected ? 3.5 : 2);
  });
}
