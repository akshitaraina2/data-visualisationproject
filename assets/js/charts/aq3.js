// ─────────────────────────────────────────────────────────────────────────────
// aq3.js — AQ3: Where It Happens
// Visualises geographic and demographic disparities in hospitalisation rates.
//
// drawState        → multi-line chart, one series per state/territory
// drawFirstNations → dual y-axis line chart: First Nations vs Non-Indigenous
//
// Depends on: constants.js (fmt, num, M, DATA, ST_COUNT, getContainerWidth,
//             showTooltip, hideTooltip)
// ─────────────────────────────────────────────────────────────────────────────


/**
 * Draws one line per state/territory showing annual hospitalisation counts 2011–2021.
 * Data is aggregated from state_territory_1: both 6-monthly halves are summed per
 * state per calendar year. End-of-series labels identify each state.
 *
 * Note: raw counts reflect population size, not road safety risk.
 * NSW and Victoria dominate because of their larger populations.
 */
async function drawState() {
  const rawCsv = await d3.csv(DATA.state);

  // Aggregate to { state, year, hospitalisations }.
  // Header in one file has a trailing space on the state column — trim defensively.
  const rolled = d3.rollup(
    rawCsv,
    v => d3.sum(v, d => num(d[ST_COUNT])),
    d => d['state or territory'].trim(),
    d => +d['calendar year']
  );

  const raw = [];
  rolled.forEach((years, state) => {
    years.forEach((hospitalisations, year) => {
      raw.push({ year, state, hospitalisations });
    });
  });

  const states     = [...new Set(raw.map(d => d.state))].sort();
  const stateColor = d3.scaleOrdinal()
    .domain(states)
    .range(['#4fc3f7', '#f5a623', '#81c784', '#e8453c', '#7986cb', '#a1887f', '#ff8a65', '#ce93d8']);

  const id = 'chart-state';
  const W  = getContainerWidth(id);
  const H  = 400;
  const w  = W - M.left - M.right;
  const h  = H - M.top  - M.bottom;

  const svg = d3.select(`#${id}`)
    .append('svg').attr('width', W).attr('height', H)
    .append('g').attr('transform', `translate(${M.left},${M.top})`);

  const x = d3.scaleLinear().domain([2011, 2021]).range([0, w]);
  const y = d3.scaleLinear().domain([0, d3.max(raw, d => d.hospitalisations) * 1.2]).range([h, 0]);

  svg.append('g').attr('class', 'grid')
    .call(d3.axisLeft(y).ticks(5).tickSize(-w).tickFormat(''));

  const grouped = d3.group(raw, d => d.state);
  const lineGen = d3.line().x(d => x(d.year)).y(d => y(d.hospitalisations)).curve(d3.curveCatmullRom);

  grouped.forEach((vals, state) => {
    const sorted = vals.sort((a, b) => a.year - b.year);

    svg.append('path').datum(sorted)
      .attr('fill', 'none')
      .attr('stroke', stateColor(state))
      .attr('stroke-width', 2)
      .attr('opacity', 0.85)
      .attr('d', lineGen);

    // Inline label at the 2021 endpoint avoids a separate legend.
    const last = sorted[sorted.length - 1];
    svg.append('text')
      .attr('x', x(last.year) + 6)
      .attr('y', y(last.hospitalisations) + 4)
      .attr('fill', stateColor(state))
      .attr('font-family', "'DM Mono', monospace")
      .attr('font-size', '10px')
      .text(state);

    // Invisible hover dots per data point.
    sorted.forEach(d => {
      svg.append('circle')
        .attr('cx', x(d.year)).attr('cy', y(d.hospitalisations))
        .attr('r', 4).attr('fill', stateColor(state)).attr('opacity', 0)
        .style('cursor', 'pointer')
        .on('mousemove', event => showTooltip('tooltip-state',
          `<strong>${state}</strong><br/>${d.year}: ${fmt(d.hospitalisations)}`, event))
        .on('mouseenter', function () { d3.select(this).attr('opacity', 1); })
        .on('mouseleave', function () { d3.select(this).attr('opacity', 0); hideTooltip('tooltip-state'); });
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
}


/**
 * Draws a dual y-axis line chart comparing First Nations and Non-Indigenous
 * hospitalisation trends 2011–2021.
 * Data is aggregated from first_nations_1: age groups + both half-year periods
 * are summed per Indigenous status per calendar year.
 *
 * Dual y-axes are required because First Nations counts are ~15× smaller than
 * Non-Indigenous counts. A shared axis would flatten the First Nations series
 * and hide its growth trend — the key story this chart needs to show.
 */
async function drawFirstNations() {
  const rawCsv = await d3.csv(DATA.firstNations);

  // first_nations files use "Hospitalisations" and "Calendar year" (title-case),
  // unlike the state_territory files which use lowercase column names.
  const rolled = d3.rollup(
    rawCsv,
    v => d3.sum(v, d => num(d['Hospitalisations'])),
    d => d['First Nations status'],
    d => +d['Calendar year']
  );

  const raw = [];
  rolled.forEach((years, fn_status) => {
    years.forEach((hospitalisations, year) => {
      raw.push({ year, fn_status, hospitalisations });
    });
  });

  const fn   = raw.filter(d => d.fn_status === 'First Nations people').sort((a, b) => a.year - b.year);
  const noni = raw.filter(d => d.fn_status === 'Non-Indigenous').sort((a, b) => a.year - b.year);

  const id = 'chart-fn';
  const W  = getContainerWidth(id);
  const H  = 400;
  const w  = W - M.left - M.right;
  const h  = H - M.top  - M.bottom;

  const svg = d3.select(`#${id}`)
    .append('svg').attr('width', W).attr('height', H)
    .append('g').attr('transform', `translate(${M.left},${M.top})`);

  const x  = d3.scaleLinear().domain([2011, 2021]).range([0, w]);
  const yL = d3.scaleLinear().domain([0, d3.max(noni, d => d.hospitalisations) * 1.2]).range([h, 0]);
  const yR = d3.scaleLinear().domain([0, d3.max(fn,   d => d.hospitalisations) * 1.2]).range([h, 0]);

  svg.append('g').attr('class', 'grid')
    .call(d3.axisLeft(yL).ticks(5).tickSize(-w).tickFormat(''));

  const lineGen = scale => d3.line()
    .x(d => x(d.year))
    .y(d => scale(d.hospitalisations))
    .curve(d3.curveCatmullRom);

  // Non-Indigenous series reads from the left y-axis.
  svg.append('path').datum(noni)
    .attr('fill', 'none').attr('stroke', 'var(--nonindig)').attr('stroke-width', 2.5)
    .attr('d', lineGen(yL));

  // First Nations series reads from the right y-axis.
  svg.append('path').datum(fn)
    .attr('fill', 'none').attr('stroke', 'var(--fn-color)').attr('stroke-width', 2.5)
    .attr('d', lineGen(yR));

  // Dots with tooltips for both series.
  [[fn, yR, 'var(--fn-color)', 'First Nations people'],
   [noni, yL, 'var(--nonindig)', 'Non-Indigenous']].forEach(([dataset, scale, col, label]) => {
    dataset.forEach(d => {
      svg.append('circle')
        .attr('cx', x(d.year)).attr('cy', scale(d.hospitalisations))
        .attr('r', 5).attr('fill', col).attr('stroke', '#0d0f14').attr('stroke-width', 2)
        .style('cursor', 'pointer')
        .on('mousemove', event => showTooltip('tooltip-fn',
          `<strong>${label}</strong><br/>${d.year}: ${fmt(d.hospitalisations)}`, event))
        .on('mouseleave', () => hideTooltip('tooltip-fn'));
    });
  });

  // Axes — left for Non-Indigenous, right for First Nations.
  svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).ticks(11).tickFormat(d3.format('d')));
  svg.append('g').attr('class', 'axis')
    .call(d3.axisLeft(yL).ticks(5).tickFormat(d => d3.format(',')(d)));
  svg.append('g').attr('class', 'axis').attr('transform', `translate(${w},0)`)
    .call(d3.axisRight(yR).ticks(5).tickFormat(d => d3.format(',')(d)));

  // Axis labels coloured to match their respective series.
  svg.append('text').attr('transform', 'rotate(-90)')
    .attr('x', -h / 2).attr('y', -52)
    .attr('text-anchor', 'middle').attr('fill', 'var(--nonindig)')
    .attr('font-family', "'DM Mono', monospace").attr('font-size', '10px')
    .text('Non-Indigenous hospitalisations');

  svg.append('text').attr('transform', 'rotate(90)')
    .attr('x', h / 2).attr('y', -(w + 52))
    .attr('text-anchor', 'middle').attr('fill', 'var(--fn-color)')
    .attr('font-family', "'DM Mono', monospace").attr('font-size', '10px')
    .text('First Nations hospitalisations');

  // Legend.
  const leg = svg.append('g').attr('transform', `translate(${w / 2 - 180}, ${h - 30})`);
  [['First Nations people', 'var(--fn-color)'], ['Non-Indigenous', 'var(--nonindig)']].forEach(([lbl, col], i) => {
    leg.append('rect').attr('x', i * 190).attr('y', 0).attr('width', 12).attr('height', 3)
      .attr('fill', col).attr('rx', 1);
    leg.append('text').attr('x', i * 190 + 18).attr('y', 5)
      .attr('fill', 'var(--muted)').attr('font-family', "'DM Mono', monospace")
      .attr('font-size', '10px').text(lbl);
  });
}
