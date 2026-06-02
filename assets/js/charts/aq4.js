function drawSankey(raw, sel) {
  if (typeof d3.sankey === 'undefined') {
    d3.select(sel).append('p')
      .attr('class', 'data-note')
      .style('padding', '2rem')
      .text('Sankey diagram requires d3-sankey plugin (not loaded).');
    return;
  }

  const id         = sel.replace('#', '');
  const container  = document.querySelector(sel);
  const totalWidth = container ? container.getBoundingClientRect().width || 800 : 800;
  const H          = 500;

  // filter UI persists through resize redraws — remove before rebuilding
  d3.select(sel).select('.sankey-filter-group').remove();
  d3.select(sel).select('.sankey-count-summary').remove();
  d3.select(sel).select('.sankey-all-note').remove();

  const roadUsers  = [...new Set(raw.map(d => d.road_user))].sort();
  const totalsByRU = d3.rollup(raw, v => d3.sum(v, d => num(d[HOSPS])), d => d.road_user);
  let activeFilter = '__ALL__';

  // appended before SVG so it renders above chart
  const filterGroup = d3.select(sel).append('div')
    .attr('class', 'sankey-filter-group filter-row')
    .attr('role', 'group')
    .attr('aria-label', 'Filter by road user type');

  // aria-live announces filter changes to screen readers
  const countSummaryEl = d3.select(sel).append('p')
    .attr('class', 'sankey-count-summary data-note')
    .attr('aria-live', 'polite')
    .style('margin-bottom', '0.5rem');

  const allNoteEl = d3.select(sel).append('p')
    .attr('class', 'sankey-all-note data-note')
    .style('margin-bottom', '0.75rem')
    .style('display', 'none')
    .text('Showing all road user groups. Select a group above for a clearer view.');

  // SVG persists across filter changes — only the s-content group inside is replaced
  const svg = d3.select(sel).append('svg')
    .attr('width', totalWidth).attr('height', H)
    .attr('viewBox', `0 0 ${totalWidth} ${H}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .attr('role', 'graphics-document')
    .attr('aria-labelledby', `${id}-title`);
  const titleEl = svg.append('title').attr('id', `${id}-title`)
    .text('Sankey diagram: flow from road user type to collision counterparty, Australia 2011–2021');
  svg.append('desc')
    .text('Link width encodes total hospitalisations per road-user to counterparty pair. Hover a link to see the count.');

  function buildSankeyData(filterValue) {
    const filtered = filterValue === '__ALL__'
      ? raw
      : raw.filter(d => d.road_user === filterValue);

    const flowMap = d3.rollup(
      filtered,
      v => d3.sum(v, d => num(d[HOSPS])),
      d => d.road_user,
      d => d.counterparty
    );

    const sources   = [...new Set(filtered.map(d => d.road_user))].sort();
    const targets   = [...new Set(filtered.map(d => d.counterparty))].sort();
    const nodeNames = [...sources, ...targets];
    const nodeIndex = new Map(nodeNames.map((n, i) => [n, i]));
    const nodes     = nodeNames.map(name => ({ name }));
    const links     = [];

    flowMap.forEach((cpMap, src) => {
      cpMap.forEach((val, tgt) => {
        if (val > 0) links.push({ source: nodeIndex.get(src), target: nodeIndex.get(tgt), value: val });
      });
    });

    const layout = d3.sankey()
      .nodeWidth(14)
      .nodePadding(10)
      .extent([[160, 10], [totalWidth - 160, H - 10]]);

    return layout({
      nodes: nodes.map(d => ({ ...d })),
      links: links.map(d => ({ ...d })),
    });
  }

  // exit transition 200ms, enter delayed 220ms so old and new content don't overlap
  function renderFilter(filterValue) {
    const isAll      = filterValue === '__ALL__';
    const filterTotal = isAll ? null : (totalsByRU.get(filterValue) || 1);

    if (isAll) {
      countSummaryEl.text('');
      allNoteEl.style('display', null);
    } else {
      const cpCount = [...new Set(
        raw.filter(d => d.road_user === filterValue).map(d => d.counterparty)
      )].length;
      countSummaryEl.text(
        `${filterValue} — ${fmt(filterTotal)} hospitalisations across ${cpCount} crash types`
      );
      allNoteEl.style('display', 'none');
    }

    titleEl.text(isAll
      ? 'Sankey diagram: flow from road user type to collision counterparty, Australia 2011–2021'
      : `Sankey diagram showing crash counterparties for ${filterValue}, Australia 2011–2021`
    );

    // interrupt in-progress exit transitions from rapid clicks
    svg.selectAll('g.s-exiting').interrupt().remove();
    const existing = svg.select('g.s-content');
    if (!existing.empty()) {
      existing.classed('s-content', false).classed('s-exiting', true);
      existing.transition('exit').duration(200).attr('opacity', 0).remove();
    }

    const g = svg.append('g').attr('class', 's-content').attr('opacity', 0);

    const { nodes: sNodes, links: sLinks } = buildSankeyData(filterValue);

    function linkTip(d) {
      if (isAll) {
        return `<strong>${d.source.name}</strong> → <strong>${d.target.name}</strong><br/>${fmt(d.value)} hospitalisations`;
      }
      const pct = d3.format('.1f')(d.value / filterTotal * 100);
      return `<strong>${d.source.name}</strong> → <strong>${d.target.name}</strong><br/>${fmt(d.value)} hospitalisations (${pct}% of this road user's total)`;
    }

    g.selectAll('.s-link')
      .data(sLinks)
      .enter().append('path')
        .attr('class', 's-link')
        .attr('tabindex', '0')
        .attr('role', 'img')
        .attr('aria-label', d => isAll
          ? `${d.source.name} to ${d.target.name}: ${fmt(d.value)} hospitalisations`
          : `${d.source.name} to ${d.target.name}: ${fmt(d.value)} hospitalisations, ${d3.format('.1f')(d.value / filterTotal * 100)}% of this road user's total`)
        .attr('d', d3.sankeyLinkHorizontal())
        .attr('fill', 'none')
        .attr('stroke', d => roadUserColors[sNodes[d.source.index]?.name] || '#56B4E9')
        .attr('stroke-opacity', 0.28)
        .attr('stroke-width', d => Math.max(1, d.width))
        .on('mousemove', (evt, d) => showTooltip('tooltip-sankey', linkTip(d), evt))
        .on('mouseenter', function() { d3.select(this).attr('stroke-opacity', 0.6); })
        .on('mouseleave', function() {
          d3.select(this).attr('stroke-opacity', 0.28);
          hideTooltip('tooltip-sankey');
        })
        .on('focusin', function(evt, d) {
          d3.select(this).attr('stroke-opacity', 0.6);
          showTooltip('tooltip-sankey', linkTip(d), evt);
        })
        .on('focusout', function() {
          d3.select(this).attr('stroke-opacity', 0.28);
          hideTooltip('tooltip-sankey');
        })
        .on('keydown', function(evt, d) {
          if (evt.key === 'Enter' || evt.key === ' ') {
            evt.preventDefault();
            d3.select(this).attr('stroke-opacity', 0.6);
            showTooltip('tooltip-sankey', linkTip(d), evt);
          } else if (evt.key === 'Escape') {
            d3.select(this).attr('stroke-opacity', 0.28);
            hideTooltip('tooltip-sankey');
          }
        });

    g.selectAll('.s-node')
      .data(sNodes)
      .enter().append('rect')
        .attr('class', 's-node')
        .attr('x', d => d.x0).attr('y', d => d.y0)
        .attr('height', d => d.y1 - d.y0).attr('width', d => d.x1 - d.x0)
        .attr('fill', d => roadUserColors[d.name] || '#4db6ac')
        .attr('stroke', 'var(--bg)').attr('rx', 2);

    g.selectAll('.s-label')
      .data(sNodes)
      .enter().append('text')
        .attr('class', 's-label')
        .attr('x', d => d.x0 < totalWidth / 2 ? d.x0 - 6 : d.x1 + 6)
        .attr('y', d => (d.y0 + d.y1) / 2)
        .attr('text-anchor', d => d.x0 < totalWidth / 2 ? 'end' : 'start')
        .attr('dominant-baseline', 'middle')
        .attr('fill', 'var(--muted)').attr('font-family', "'DM Mono', monospace").attr('font-size', '11px').attr('font-weight', '500')
        .attr('pointer-events', 'none')
        .text(d => (roadUserShort[d.name] || d.name).substring(0, 22));

    // delay > exit duration so old and new content don't overlap
    g.transition('enter').delay(220).duration(300).attr('opacity', 1);
  }

  filterGroup.append('button')
    .attr('class', 'filter-btn active')
    .attr('aria-pressed', 'true')
    .text('All (complex view)')
    .on('click', function() {
      activeFilter = '__ALL__';
      filterGroup.selectAll('button')
        .attr('aria-pressed', 'false').classed('active', false);
      d3.select(this).attr('aria-pressed', 'true').classed('active', true);
      renderFilter('__ALL__');
    });

  roadUsers.forEach(ru => {
    filterGroup.append('button')
      .attr('class', 'filter-btn' + (ru === activeFilter ? ' active' : ''))
      .attr('aria-pressed', ru === activeFilter ? 'true' : 'false')
      .text(roadUserShort[ru] || ru)
      .datum(ru)
      .on('click', function(evt, d) {
        activeFilter = d;
        filterGroup.selectAll('button')
          .attr('aria-pressed', 'false').classed('active', false);
        d3.select(this).attr('aria-pressed', 'true').classed('active', true);
        renderFilter(d);
      });
  });

  renderFilter(activeFilter);
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
  const container = document.querySelector(sel);
  const totalWidth = container ? container.getBoundingClientRect().width || 800 : 800;
  const legendRows = Math.ceil(cps.length / 2);
  const H  = 380 + legendRows * 16 + 12;
  const w  = totalWidth - M.left - M.right;
  const h  = H - M.top - M.bottom - legendRows * 16 - 12;

  const svgEl = d3.select(sel)
    .append('svg').attr('width', totalWidth).attr('height', H)
    .attr('viewBox', `0 0 ${totalWidth} ${H}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .attr('role', 'graphics-document').attr('aria-labelledby', `${id}-title`);
  svgEl.append('title').attr('id', `${id}-title`)
    .text('Stacked bar chart: road crash hospitalisations by counterparty type, Australia 2011–2021');
  svgEl.append('desc')
    .text('Annual stacked bars show the breakdown of hospitalisations by collision counterparty (e.g. other vehicle, fixed object) from 2011 to 2021.');
  const svg = svgEl.append('g').attr('transform', `translate(${M.left},${M.top})`);

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
    .attr('fill', 'var(--muted)').attr('font-family', "'DM Mono', monospace").attr('font-size', '11px').attr('font-weight', '500')
    .text('Hospitalisations');
  svg.append('text').attr('x', w / 2).attr('y', h + 38).attr('text-anchor', 'middle')
    .attr('fill', 'var(--muted)').attr('font-family', "'DM Mono', monospace").attr('font-size', '11px').attr('font-weight', '500')
    .text('Year');

  const leg = svg.append('g').attr('transform', `translate(0, ${h + 46})`);
  cps.forEach((cp, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const xOff = col * (w / 2);
    leg.append('rect').attr('x', xOff).attr('y', row * 16).attr('width', 12).attr('height', 12)
      .attr('fill', cpColors(cp)).attr('rx', 1);
    leg.append('text').attr('x', xOff + 18).attr('y', row * 16 + 9).attr('dominant-baseline', 'middle')
      .attr('fill', 'var(--muted)').attr('font-family', "'DM Mono', monospace").attr('font-size', '11px').attr('font-weight', '500')
      .text(cp);
  });
}
