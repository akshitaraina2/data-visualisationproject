// ── AQ1: THE BIG PICTURE ─────────────────────────────────────────────────────
// drawTrend      → multi-series line (road user + national total bold)
// drawStackedArea → stacked area by road user
//
// Both charts share #aq1-filters buttons, added once by drawTrend.
// Vertical lines at 2012 (VIC break) and 2017 (NSW break), COVID label at 2020.
// Depends on: constants.js

function _addPolicyLines(svg, x, h, tooltipId) {
  const breaks = [
    { yr: 2012, tip: 'Victoria 2012: revised hospitalisation coding — est. −5.6% step-change.' },
    { yr: 2017, tip: 'NSW 2017: change in hospitalisation reporting methodology.' },
  ];
  breaks.forEach(({ yr, tip }) => {
    const g = svg.append('g').style('cursor', 'pointer');
    g.append('line')
      .attr('x1', x(yr)).attr('x2', x(yr)).attr('y1', 0).attr('y2', h)
      .attr('stroke', 'var(--muted)').attr('stroke-width', 1).attr('stroke-dasharray', '4,3');
    g.append('text')
      .attr('x', x(yr) + 4).attr('y', 12)
      .attr('fill', 'var(--muted)').attr('font-family', "'DM Mono', monospace").attr('font-size', '8px')
      .text(yr === 2012 ? 'VIC break' : 'NSW break');
    g.on('mousemove', evt => showTooltip(tooltipId, tip, evt))
     .on('mouseleave', () => hideTooltip(tooltipId));
  });
}

function drawTrend(raw, sel) {
  // National totals per road user per year (sum all states)
  const natRU = d3.rollup(
    raw,
    v => d3.sum(v, d => num(d[HOSPS])),
    d => d.road_user,
    d => +d.year
  );
  // National total per year across all road users
  const natTotal = d3.rollup(
    raw,
    v => d3.sum(v, d => num(d[HOSPS])),
    d => +d.year
  );

  const users = Array.from(natRU.keys()).sort();
  const years = Array.from(natTotal.keys()).sort((a, b) => a - b);

  // Build filter buttons once (shared with drawStackedArea)
  const filterRow = document.getElementById('aq1-filters');
  if (filterRow && !filterRow.hasChildNodes()) {
    const allBtn = document.createElement('button');
    allBtn.className = 'filter-btn active';
    allBtn.textContent = 'All';
    allBtn.dataset.user = 'all';
    filterRow.appendChild(allBtn);
    users.forEach(u => {
      const btn = document.createElement('button');
      btn.className = 'filter-btn';
      btn.textContent = roadUserShort[u] || u;
      btn.dataset.user = u;
      filterRow.appendChild(btn);
    });
  }

  const id = sel.replace('#', '');
  const W  = getContainerWidth(id);
  const H  = 420;
  const w  = W - M.left - M.right - 100; // extra right margin for "National total" label
  const h  = H - M.top - M.bottom;

  const svg = d3.select(sel)
    .append('svg').attr('width', W).attr('height', H)
    .append('g').attr('transform', `translate(${M.left},${M.top})`);

  const x = d3.scaleLinear().domain([2011, 2021]).range([0, w]);
  const yMax = Math.max(
    d3.max(Array.from(natTotal.values())),
    d3.max(Array.from(natRU.values()).flatMap(m => Array.from(m.values())))
  );
  const y = d3.scaleLinear().domain([0, yMax * 1.15]).range([h, 0]);

  svg.append('g').attr('class', 'grid')
    .call(d3.axisLeft(y).ticks(5).tickSize(-w).tickFormat(''));

  const lineGen = d3.line().x(d => x(d.yr)).y(d => y(d.v)).curve(d3.curveCatmullRom);

  // Per-road-user lines
  svg.selectAll('.ru-line')
    .data(users)
    .enter().append('path')
      .attr('class', 'ru-line')
      .attr('fill', 'none')
      .attr('stroke', u => roadUserColors[u] || '#888')
      .attr('stroke-width', 1.8)
      .attr('opacity', 0.75)
      .attr('d', u => lineGen(years.map(yr => ({ yr, v: natRU.get(u)?.get(yr) || 0 }))));

  // National total (bold white line)
  svg.append('path')
    .attr('class', 'national-total-line')
    .datum(years.map(yr => ({ yr, v: natTotal.get(yr) || 0 })))
    .attr('fill', 'none')
    .attr('stroke', '#e8eaf0')
    .attr('stroke-width', 3)
    .attr('d', lineGen);

  // National total end-label
  const lastTotal = natTotal.get(2021) || 0;
  svg.append('text')
    .attr('x', x(2021) + 6).attr('y', y(lastTotal))
    .attr('dominant-baseline', 'middle')
    .attr('fill', '#e8eaf0')
    .attr('font-family', "'DM Mono', monospace").attr('font-size', '9px')
    .text('National total');

  // Policy break lines
  _addPolicyLines(svg, x, h, 'tooltip-trend');

  // COVID-19 dip label
  svg.append('text')
    .attr('x', x(2020) + 5).attr('y', y(natTotal.get(2020) || 0) - 10)
    .attr('fill', '#e8453c').attr('font-family', "'DM Mono', monospace").attr('font-size', '8px')
    .text('COVID-19 mobility restrictions');

  // Hover dots on national total
  years.forEach(yr => {
    svg.append('circle')
      .attr('cx', x(yr)).attr('cy', y(natTotal.get(yr) || 0))
      .attr('r', 4).attr('fill', '#e8eaf0').attr('opacity', 0)
      .style('cursor', 'pointer')
      .on('mousemove', evt => showTooltip('tooltip-trend',
        `<strong>National total</strong><br/>${yr}: ${fmt(natTotal.get(yr) || 0)}`, evt))
      .on('mouseenter', function() { d3.select(this).attr('opacity', 1); })
      .on('mouseleave', function() { d3.select(this).attr('opacity', 0); hideTooltip('tooltip-trend'); });
  });

  // Axes
  svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).ticks(11).tickFormat(d3.format('d')));
  svg.append('g').attr('class', 'axis')
    .call(d3.axisLeft(y).ticks(5).tickFormat(d => fmt(d)));
  svg.append('text').attr('transform', 'rotate(-90)')
    .attr('x', -h / 2).attr('y', -55).attr('text-anchor', 'middle')
    .attr('fill', 'var(--muted)').attr('font-family', "'DM Mono', monospace").attr('font-size', '11px')
    .text('Hospitalisations');

  // Road user legend (bottom-right)
  const leg = svg.append('g').attr('transform', `translate(${w - 155}, ${h - users.length * 14 - 4})`);
  users.forEach((u, i) => {
    leg.append('rect').attr('x', 0).attr('y', i * 14).attr('width', 10).attr('height', 3)
      .attr('fill', roadUserColors[u] || '#888').attr('rx', 1);
    leg.append('text').attr('x', 15).attr('y', i * 14 + 3)
      .attr('dominant-baseline', 'middle')
      .attr('fill', 'var(--muted)').attr('font-family', "'DM Mono', monospace").attr('font-size', '9px')
      .text(roadUserShort[u] || u);
  });

  // Filter interaction (SVG-local — drawStackedArea adds its own listener)
  if (filterRow) {
    filterRow.addEventListener('click', e => {
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;
      document.querySelectorAll('#aq1-filters .filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const sel2 = btn.dataset.user;
      svg.selectAll('.ru-line')
        .transition().duration(250)
        .attr('opacity', function(u) { return sel2 === 'all' || u === sel2 ? 0.85 : 0.05; })
        .attr('stroke-width', function(u) { return sel2 !== 'all' && u === sel2 ? 3.5 : 1.8; });
      svg.select('.national-total-line')
        .transition().duration(250)
        .attr('opacity', sel2 === 'all' ? 1 : 0.15);
    });
  }
}

function drawStackedArea(raw, sel) {
  const natRU = d3.rollup(
    raw,
    v => d3.sum(v, d => num(d[HOSPS])),
    d => d.road_user,
    d => +d.year
  );

  const users = Array.from(natRU.keys()).sort();
  const years = [...new Set(raw.map(d => +d.year))].sort((a, b) => a - b);

  const stackData = years.map(yr => {
    const row = { year: yr };
    users.forEach(u => { row[u] = natRU.get(u)?.get(yr) || 0; });
    return row;
  });

  const series = d3.stack().keys(users)(stackData);

  const id = sel.replace('#', '');
  const W  = getContainerWidth(id);
  const H  = 380;
  const w  = W - M.left - M.right;
  const h  = H - M.top - M.bottom;

  const svg = d3.select(sel)
    .append('svg').attr('width', W).attr('height', H)
    .append('g').attr('transform', `translate(${M.left},${M.top})`);

  const x = d3.scaleLinear().domain([2011, 2021]).range([0, w]);
  const y = d3.scaleLinear()
    .domain([0, d3.max(series, s => d3.max(s, d => d[1])) * 1.05])
    .range([h, 0]);

  const area = d3.area()
    .x(d => x(d.data.year))
    .y0(d => y(d[0])).y1(d => y(d[1]))
    .curve(d3.curveCatmullRom);

  svg.selectAll('.stack-area')
    .data(series)
    .enter().append('path')
      .attr('class', 'stack-area')
      .attr('fill', s => roadUserColors[s.key] || '#888')
      .attr('fill-opacity', 0.75)
      .attr('d', area)
      .on('mousemove', (event, s) => {
        const [mx] = d3.pointer(event, svg.node());
        const yr = Math.max(2011, Math.min(2021, Math.round(x.invert(mx))));
        const val = natRU.get(s.key)?.get(yr) || 0;
        showTooltip('tooltip-stacked',
          `<strong>${roadUserShort[s.key] || s.key}</strong><br/>${yr}: ${fmt(val)}`, event);
      })
      .on('mouseleave', () => hideTooltip('tooltip-stacked'));

  // Policy break lines
  _addPolicyLines(svg, x, h, 'tooltip-stacked');

  // COVID label
  svg.append('text')
    .attr('x', x(2020) + 4).attr('y', 14)
    .attr('fill', '#e8453c').attr('font-family', "'DM Mono', monospace").attr('font-size', '8px')
    .text('COVID-19');

  // Axes
  svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).ticks(11).tickFormat(d3.format('d')));
  svg.append('g').attr('class', 'axis')
    .call(d3.axisLeft(y).ticks(5).tickFormat(d => fmt(d)));
  svg.append('text').attr('transform', 'rotate(-90)')
    .attr('x', -h / 2).attr('y', -55).attr('text-anchor', 'middle')
    .attr('fill', 'var(--muted)').attr('font-family', "'DM Mono', monospace").attr('font-size', '11px')
    .text('Hospitalisations');

  // Legend
  const leg = svg.append('g').attr('transform', `translate(${w - 155}, 4)`);
  users.forEach((u, i) => {
    leg.append('rect').attr('x', 0).attr('y', i * 14).attr('width', 10).attr('height', 10)
      .attr('fill', roadUserColors[u] || '#888').attr('fill-opacity', 0.75).attr('rx', 1);
    leg.append('text').attr('x', 15).attr('y', i * 14 + 8)
      .attr('dominant-baseline', 'middle')
      .attr('fill', 'var(--muted)').attr('font-family', "'DM Mono', monospace").attr('font-size', '9px')
      .text(roadUserShort[u] || u);
  });

  // Filter: hide/show layers when AQ1 filter buttons are clicked
  const filterRow = document.getElementById('aq1-filters');
  if (filterRow) {
    filterRow.addEventListener('click', e => {
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;
      const selected = btn.dataset.user;
      svg.selectAll('.stack-area')
        .transition().duration(250)
        .attr('fill-opacity', function(s) {
          return selected === 'all' || s.key === selected ? 0.75 : 0.04;
        });
    });
  }
}
