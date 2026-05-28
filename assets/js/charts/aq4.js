// ── AQ4: HOW IT HAPPENS ──────────────────────────────────────────────────────
// drawSankey         → road user → counterparty Sankey; link width = count
// drawCounterpartyBar → stacked bar by year; colour = counterparty type
//
// Depends on: constants.js, d3-sankey (CDN, loaded before this file)

function drawSankey(raw, sel) {
  if (typeof d3.sankey === 'undefined') {
    d3.select(sel).append('p')
      .attr('class', 'data-note')
      .style('padding', '2rem')
      .text('Sankey diagram requires d3-sankey plugin (not loaded).');
    return;
  }

  // Sum all years: road_user → counterparty
  const flowMap = d3.rollup(
    raw,
    v => d3.sum(v, d => num(d[HOSPS])),
    d => d.road_user,
    d => d.counterparty
  );

  const sources = [...new Set(raw.map(d => d.road_user))].sort();
  const targets = [...new Set(raw.map(d => d.counterparty))].sort();
  const nodeNames = [...sources, ...targets];
  const nodeIndex = new Map(nodeNames.map((n, i) => [n, i]));

  const nodes = nodeNames.map(name => ({ name }));
  const links = [];
  flowMap.forEach((cpMap, src) => {
    cpMap.forEach((val, tgt) => {
      if (val > 0) links.push({ source: nodeIndex.get(src), target: nodeIndex.get(tgt), value: val });
    });
  });

  const id = sel.replace('#', '');
  const W  = getContainerWidth(id);
  const H  = 500;

  const svg = d3.select(sel).append('svg').attr('width', W).attr('height', H);

  const layout = d3.sankey()
    .nodeWidth(14)
    .nodePadding(10)
    .extent([[20, 10], [W - 160, H - 10]]);

  const { nodes: sNodes, links: sLinks } = layout({
    nodes: nodes.map(d => ({ ...d })),
    links: links.map(d => ({ ...d })),
  });

  // Links
  svg.selectAll('.s-link')
    .data(sLinks)
    .enter().append('path')
      .attr('class', 's-link')
      .attr('d', d3.sankeyLinkHorizontal())
      .attr('fill', 'none')
      .attr('stroke', d => roadUserColors[sNodes[d.source.index]?.name] || '#4fc3f7')
      .attr('stroke-opacity', 0.28)
      .attr('stroke-width', d => Math.max(1, d.width))
      .on('mousemove', (evt, d) => showTooltip('tooltip-sankey',
        `<strong>${d.source.name}</strong> → <strong>${d.target.name}</strong><br/>${fmt(d.value)}`, evt))
      .on('mouseenter', function() { d3.select(this).attr('stroke-opacity', 0.6); })
      .on('mouseleave', function() {
        d3.select(this).attr('stroke-opacity', 0.28);
        hideTooltip('tooltip-sankey');
      });

  // Nodes
  svg.selectAll('.s-node')
    .data(sNodes)
    .enter().append('rect')
      .attr('class', 's-node')
      .attr('x', d => d.x0).attr('y', d => d.y0)
      .attr('height', d => d.y1 - d.y0).attr('width', d => d.x1 - d.x0)
      .attr('fill', d => roadUserColors[d.name] || '#4db6ac')
      .attr('stroke', 'var(--bg)').attr('rx', 2);

  // Node labels
  svg.selectAll('.s-label')
    .data(sNodes)
    .enter().append('text')
      .attr('x', d => d.x0 < W / 2 ? d.x1 + 6 : d.x0 - 6)
      .attr('y', d => (d.y0 + d.y1) / 2)
      .attr('text-anchor', d => d.x0 < W / 2 ? 'start' : 'end')
      .attr('dominant-baseline', 'middle')
      .attr('fill', 'var(--muted)').attr('font-family', "'DM Mono', monospace").attr('font-size', '9px')
      .attr('pointer-events', 'none')
      .text(d => (roadUserShort[d.name] || d.name).substring(0, 22));
}

function drawCounterpartyBar(raw, sel) {
  const cps  = [...new Set(raw.map(d => d.counterparty))].sort();
  const cpColors = d3.scaleOrdinal()
    .domain(cps)
    .range(['#4fc3f7', '#f5a623', '#81c784', '#e8453c', '#a1887f']);

  const years = [...new Set(raw.map(d => +d.year))].sort((a, b) => a - b);

  const byYearCp = d3.rollup(
    raw,
    v => d3.sum(v, d => num(d[HOSPS])),
    d => +d.year,
    d => d.counterparty
  );

  const stackData = years.map(yr => {
    const row = { year: yr };
    cps.forEach(cp => { row[cp] = byYearCp.get(yr)?.get(cp) || 0; });
    return row;
  });

  const series = d3.stack().keys(cps)(stackData);

  const id = sel.replace('#', '');
  const W  = getContainerWidth(id);
  const H  = 380;
  const w  = W - M.left - M.right;
  const h  = H - M.top - M.bottom;

  const svg = d3.select(sel)
    .append('svg').attr('width', W).attr('height', H)
    .append('g').attr('transform', `translate(${M.left},${M.top})`);

  const x = d3.scaleBand().domain(years).range([0, w]).padding(0.1);
  const y = d3.scaleLinear()
    .domain([0, d3.max(series, s => d3.max(s, d => d[1])) * 1.05])
    .range([h, 0]);

  svg.append('g').attr('class', 'grid')
    .call(d3.axisLeft(y).ticks(5).tickSize(-w).tickFormat(''));

  series.forEach(s => {
    const safeKey = s.key.replace(/[^a-zA-Z0-9]/g, '_');
    svg.selectAll(`.bar-${safeKey}`)
      .data(s)
      .enter().append('rect')
        .attr('class', `bar-${safeKey}`)
        .attr('x', d => x(d.data.year))
        .attr('y', d => y(d[1]))
        .attr('height', d => Math.max(0, y(d[0]) - y(d[1])))
        .attr('width', x.bandwidth())
        .attr('fill', cpColors(s.key))
        .attr('stroke', 'var(--bg)').attr('stroke-width', 0.5)
        .on('mousemove', (evt, d) => showTooltip('tooltip-counterparty',
          `<strong>${s.key}</strong><br/>${d.data.year}: ${fmt(d.data[s.key])}`, evt))
        .on('mouseleave', () => hideTooltip('tooltip-counterparty'));
  });

  svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).tickFormat(d3.format('d')));
  svg.append('g').attr('class', 'axis')
    .call(d3.axisLeft(y).ticks(5).tickFormat(d => fmt(d)));
  svg.append('text').attr('transform', 'rotate(-90)')
    .attr('x', -h / 2).attr('y', -55).attr('text-anchor', 'middle')
    .attr('fill', 'var(--muted)').attr('font-family', "'DM Mono', monospace").attr('font-size', '11px')
    .text('Hospitalisations');
  svg.append('text').attr('x', w / 2).attr('y', h + 38).attr('text-anchor', 'middle')
    .attr('fill', 'var(--muted)').attr('font-family', "'DM Mono', monospace").attr('font-size', '11px')
    .text('Year');

  // Legend
  const leg = svg.append('g').attr('transform', `translate(${w - 185}, 0)`);
  cps.forEach((cp, i) => {
    leg.append('rect').attr('x', 0).attr('y', i * 18).attr('width', 12).attr('height', 12)
      .attr('fill', cpColors(cp)).attr('rx', 1);
    leg.append('text').attr('x', 18).attr('y', i * 18 + 9).attr('dominant-baseline', 'middle')
      .attr('fill', 'var(--muted)').attr('font-family', "'DM Mono', monospace").attr('font-size', '10px')
      .text(cp);
  });
}
