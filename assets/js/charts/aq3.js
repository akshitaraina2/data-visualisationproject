// ── AQ3: WHERE IT HAPPENS ────────────────────────────────────────────────────
// drawChoropleth       → choropleth map; colour = avg annual rate per 100,000
// drawFirstNationsSlope → dual-axis line; FN vs Non-Indigenous total trend
// drawRemoteness       → small multiples line by remoteness area
//
// Depends on: constants.js

function drawChoropleth(stateData, population, geojson, sel) {
  // Build population lookup: state → year → population
  const popLookup = {};
  population.forEach(d => {
    if (!popLookup[d.state]) popLookup[d.state] = {};
    popLookup[d.state][+d.year] = +d.population;
  });

  // Per-state annual hospitalisations
  const byStateYear = d3.rollup(
    stateData,
    v => d3.sum(v, d => num(d[HOSPS])),
    d => d.state,
    d => +d.year
  );

  // Average annual rate per 100k for each state
  const rateByState = {};
  byStateYear.forEach((yearMap, st) => {
    const rates = [];
    yearMap.forEach((count, yr) => {
      const pop = popLookup[st]?.[yr];
      if (pop && pop > 0) rates.push((count / pop) * 100000);
    });
    if (rates.length > 0) rateByState[st] = d3.mean(rates);
  });

  const rateValues = Object.values(rateByState).filter(v => v > 0);
  const colorScale = d3.scaleSequential(d3.interpolateOranges)
    .domain([0, d3.max(rateValues)]);

  const id = sel.replace('#', '');
  const W  = getContainerWidth(id);
  const H  = 440;

  const svg = d3.select(sel).append('svg').attr('width', W).attr('height', H);

  const projection = d3.geoMercator().fitSize([W - 20, H * 0.88], geojson);
  const pathGen = d3.geoPath().projection(projection);

  svg.selectAll('.state-path')
    .data(geojson.features)
    .enter().append('path')
      .attr('class', 'state-path')
      .attr('d', pathGen)
      .attr('fill', d => {
        const abbr = STATE_ABBR[d.properties.STATE_NAME];
        return abbr && rateByState[abbr] != null ? colorScale(rateByState[abbr]) : '#2a2f3f';
      })
      .attr('stroke', 'var(--bg)').attr('stroke-width', 1.5)
      .on('mousemove', (evt, d) => {
        const abbr = STATE_ABBR[d.properties.STATE_NAME];
        const rate = rateByState[abbr];
        showTooltip('tooltip-choropleth',
          `<strong>${d.properties.STATE_NAME}</strong> (${abbr || '?'})<br/>` +
          (rate != null ? `${fmtRate(rate)} hospitalisations per 100,000 / year` : 'No data'), evt);
      })
      .on('mouseleave', () => hideTooltip('tooltip-choropleth'));

  // State abbreviation labels at centroids
  svg.selectAll('.state-label')
    .data(geojson.features)
    .enter().append('text')
      .attr('transform', d => `translate(${pathGen.centroid(d)})`)
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
      .attr('fill', '#e8eaf0').attr('font-family', "'DM Mono', monospace")
      .attr('font-size', '10px').attr('pointer-events', 'none')
      .text(d => STATE_ABBR[d.properties.STATE_NAME] || '');

  // Colour legend
  const legW = 200, legH = 10;
  const defs = svg.append('defs');
  const grad = defs.append('linearGradient').attr('id', 'choro-grad').attr('x1', '0%').attr('x2', '100%');
  [0, 0.25, 0.5, 0.75, 1].forEach(t =>
    grad.append('stop').attr('offset', `${t * 100}%`).attr('stop-color', colorScale(t * d3.max(rateValues)))
  );
  const legG = svg.append('g').attr('transform', `translate(16, ${H - 38})`);
  legG.append('rect').attr('width', legW).attr('height', legH).attr('fill', 'url(#choro-grad)').attr('rx', 2);
  legG.append('text').attr('x', 0).attr('y', -4)
    .attr('fill', 'var(--muted)').attr('font-family', "'DM Mono', monospace").attr('font-size', '8px').text('0');
  legG.append('text').attr('x', legW).attr('y', -4).attr('text-anchor', 'end')
    .attr('fill', 'var(--muted)').attr('font-family', "'DM Mono', monospace").attr('font-size', '8px')
    .text(fmtRate(d3.max(rateValues)) + ' /100k');
  legG.append('text').attr('x', legW / 2).attr('y', legH + 14).attr('text-anchor', 'middle')
    .attr('fill', 'var(--muted)').attr('font-family', "'DM Mono', monospace").attr('font-size', '8px')
    .text('Average annual hospitalisations per 100,000 population');
}

function drawFirstNationsSlope(fnByAge, fnByRoadUser, sel) {
  // Total FN / Non-Indigenous hospitalisations per year (aggregated over all road users)
  const totByStatusYear = d3.rollup(
    fnByRoadUser,
    v => d3.sum(v, d => num(d[HOSPS])),
    d => d.indigenous_status,
    d => +d.year
  );

  const fn   = totByStatusYear.get('First Nations people');
  const ni   = totByStatusYear.get('Non-Indigenous');
  const years = [...new Set(fnByRoadUser.map(d => +d.year))].sort((a, b) => a - b);

  const id = sel.replace('#', '');
  const W  = getContainerWidth(id);
  const H  = 380;
  const w  = W - M.left - M.right;
  const h  = H - M.top - M.bottom;

  const svg = d3.select(sel)
    .append('svg').attr('width', W).attr('height', H)
    .append('g').attr('transform', `translate(${M.left},${M.top})`);

  const x  = d3.scaleLinear().domain([2011, 2021]).range([0, w]);
  // Dual y-axes: Non-Indigenous left, First Nations right
  const yL = d3.scaleLinear()
    .domain([0, d3.max(Array.from(ni?.values() || [0])) * 1.2]).range([h, 0]);
  const yR = d3.scaleLinear()
    .domain([0, d3.max(Array.from(fn?.values() || [0])) * 1.2]).range([h, 0]);

  svg.append('g').attr('class', 'grid')
    .call(d3.axisLeft(yL).ticks(5).tickSize(-w).tickFormat(''));

  const mkLine = scale => d3.line().x(d => x(d.yr)).y(d => scale(d.v)).curve(d3.curveCatmullRom);

  const niData = years.map(yr => ({ yr, v: ni?.get(yr) || 0 }));
  const fnData = years.map(yr => ({ yr, v: fn?.get(yr) || 0 }));

  svg.append('path').datum(niData)
    .attr('fill', 'none').attr('stroke', 'var(--nonindig)').attr('stroke-width', 2.5)
    .attr('d', mkLine(yL));
  svg.append('path').datum(fnData)
    .attr('fill', 'none').attr('stroke', 'var(--fn-color)').attr('stroke-width', 2.5)
    .attr('d', mkLine(yR));

  [
    [niData, yL, 'var(--nonindig)', 'Non-Indigenous', 'tooltip-fn-slope'],
    [fnData, yR, 'var(--fn-color)', 'First Nations people', 'tooltip-fn-slope'],
  ].forEach(([data, scale, col, label, tipId]) => {
    data.forEach(d => {
      svg.append('circle')
        .attr('cx', x(d.yr)).attr('cy', scale(d.v))
        .attr('r', 4).attr('fill', col).attr('stroke', 'var(--bg)').attr('stroke-width', 2)
        .style('cursor', 'pointer')
        .on('mousemove', evt => showTooltip(tipId,
          `<strong>${label}</strong><br/>${d.yr}: ${fmt(d.v)}`, evt))
        .on('mouseleave', () => hideTooltip(tipId));
    });
  });

  svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).ticks(11).tickFormat(d3.format('d')));
  svg.append('g').attr('class', 'axis').call(d3.axisLeft(yL).ticks(5).tickFormat(d => fmt(d)));
  svg.append('g').attr('class', 'axis').attr('transform', `translate(${w},0)`)
    .call(d3.axisRight(yR).ticks(5).tickFormat(d => fmt(d)));

  svg.append('text').attr('transform', 'rotate(-90)').attr('x', -h / 2).attr('y', -55)
    .attr('text-anchor', 'middle').attr('fill', 'var(--nonindig)')
    .attr('font-family', "'DM Mono', monospace").attr('font-size', '10px')
    .text('Non-Indigenous hospitalisations');
  svg.append('text').attr('transform', 'rotate(90)').attr('x', h / 2).attr('y', -(w + 52))
    .attr('text-anchor', 'middle').attr('fill', 'var(--fn-color)')
    .attr('font-family', "'DM Mono', monospace").attr('font-size', '10px')
    .text('First Nations hospitalisations');

  const leg = svg.append('g').attr('transform', `translate(${w / 2 - 190}, ${h - 18})`);
  [['First Nations people', 'var(--fn-color)'], ['Non-Indigenous', 'var(--nonindig)']].forEach(([lbl, col], i) => {
    leg.append('rect').attr('x', i * 210).attr('y', 0).attr('width', 12).attr('height', 3)
      .attr('fill', col).attr('rx', 1);
    leg.append('text').attr('x', i * 210 + 18).attr('y', 4).attr('dominant-baseline', 'middle')
      .attr('fill', 'var(--muted)').attr('font-family', "'DM Mono', monospace").attr('font-size', '10px')
      .text(lbl);
  });
}

function drawRemoteness(raw, sel) {
  const statuses = ['First Nations people', 'Non-Indigenous'];
  const statusColors = {
    'First Nations people': 'var(--fn-color)',
    'Non-Indigenous':       'var(--nonindig)',
  };

  const rolled = d3.rollup(
    raw,
    v => d3.sum(v, d => num(d[HOSPS])),
    d => d.remoteness,
    d => d.indigenous_status,
    d => +d.year
  );

  const areas = REMOTENESS_ORDER.filter(r => rolled.has(r));
  const years = [...new Set(raw.map(d => +d.year))].sort((a, b) => a - b);

  const containerEl = document.querySelector(sel);
  const totalW = containerEl ? containerEl.getBoundingClientRect().width || 800 : 800;
  const cellW  = Math.floor((totalW - 30) / areas.length);
  const cellH  = 220;
  const cm     = { top: 28, right: 14, bottom: 36, left: 50 };

  const svg = d3.select(sel)
    .append('svg').attr('width', totalW).attr('height', cellH + 30);

  areas.forEach((rem, idx) => {
    const offX = idx * cellW + 15;
    const g    = svg.append('g').attr('transform', `translate(${offX},8)`);
    const cw   = cellW - cm.left - cm.right;
    const ch   = cellH - cm.top - cm.bottom;
    const inner = g.append('g').attr('transform', `translate(${cm.left},${cm.top})`);

    const x    = d3.scaleLinear().domain([2011, 2021]).range([0, cw]);
    const maxY = d3.max(statuses.flatMap(st =>
      years.map(yr => rolled.get(rem)?.get(st)?.get(yr) || 0)
    ));
    const y = d3.scaleLinear().domain([0, (maxY || 1) * 1.2]).range([ch, 0]);

    inner.append('g').attr('class', 'grid')
      .call(d3.axisLeft(y).ticks(4).tickSize(-cw).tickFormat(''));

    statuses.forEach(st => {
      const lineData = years.map(yr => ({ yr, v: rolled.get(rem)?.get(st)?.get(yr) || 0 }));
      inner.append('path').datum(lineData)
        .attr('fill', 'none').attr('stroke', statusColors[st]).attr('stroke-width', 1.8)
        .attr('d', d3.line().x(d => x(d.yr)).y(d => y(d.v)).curve(d3.curveCatmullRom));

      lineData.forEach(d => {
        inner.append('circle')
          .attr('cx', x(d.yr)).attr('cy', y(d.v)).attr('r', 3)
          .attr('fill', statusColors[st]).attr('opacity', 0)
          .on('mousemove', evt => showTooltip('tooltip-remoteness',
            `<strong>${rem} — ${st}</strong><br/>${d.yr}: ${fmt(d.v)}`, evt))
          .on('mouseenter', function() { d3.select(this).attr('opacity', 1); })
          .on('mouseleave', function() { d3.select(this).attr('opacity', 0); hideTooltip('tooltip-remoteness'); });
      });
    });

    // Panel title
    g.append('text').attr('x', cm.left + cw / 2).attr('y', 16).attr('text-anchor', 'middle')
      .attr('fill', 'var(--text)').attr('font-family', "'DM Mono', monospace").attr('font-size', '11px')
      .text(rem);

    inner.append('g').attr('class', 'axis').attr('transform', `translate(0,${ch})`)
      .call(d3.axisBottom(x).ticks(3).tickFormat(d3.format('d')));
    if (idx === 0) {
      inner.append('g').attr('class', 'axis').call(d3.axisLeft(y).ticks(4).tickFormat(d => fmt(d)));
      inner.append('text').attr('transform', 'rotate(-90)').attr('x', -ch / 2).attr('y', -42)
        .attr('text-anchor', 'middle').attr('fill', 'var(--muted)')
        .attr('font-family', "'DM Mono', monospace").attr('font-size', '9px')
        .text('Hospitalisations');
    }
  });

  // Shared legend below panels
  const legG = svg.append('g').attr('transform', `translate(15, ${cellH + 10})`);
  [['First Nations people', 'var(--fn-color)'], ['Non-Indigenous', 'var(--nonindig)']].forEach(([lbl, col], i) => {
    legG.append('line')
      .attr('x1', i * 190).attr('x2', i * 190 + 20).attr('y1', 0).attr('y2', 0)
      .attr('stroke', col).attr('stroke-width', 2);
    legG.append('text').attr('x', i * 190 + 26).attr('y', 4).attr('dominant-baseline', 'middle')
      .attr('fill', 'var(--muted)').attr('font-family', "'DM Mono', monospace").attr('font-size', '10px')
      .text(lbl);
  });
}
