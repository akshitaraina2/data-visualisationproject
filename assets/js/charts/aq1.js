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
  const legendRows = Math.ceil(users.length / 2);
  const H  = 420 + legendRows * 16 + 12;
  const w  = W - M.left - M.right - 100; // extra right margin for "National total" label
  const h  = H - M.top - M.bottom - legendRows * 16 - 12;

  const svgEl = d3.select(sel)
    .append('svg').attr('width', W).attr('height', H)
    .attr('role', 'graphics-document').attr('aria-labelledby', `${id}-title`);
  svgEl.append('title').attr('id', `${id}-title`)
    .text('Multi-series line chart: annual road crash hospitalisations by road user type, Australia 2011–2021');
  svgEl.append('desc')
    .text('National hospitalisation counts per year for each road user type, with a bold national total line. Dashed markers at 2012 (Victoria) and 2017 (NSW) indicate series breaks; a red dashed line marks the 2020 COVID-19 mobility dip.');
  const svg = svgEl.append('g').attr('transform', `translate(${M.left},${M.top})`);

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

  // COVID-19 dip label — fixed near top so it clears all data lines
  svg.append('line')
    .attr('x1', x(2020)).attr('x2', x(2020))
    .attr('y1', 16).attr('y2', h)
    .attr('stroke', '#e8453c').attr('stroke-width', 1).attr('stroke-dasharray', '3,3');
  svg.append('text')
    .attr('x', x(2020)).attr('y', 12)
    .attr('text-anchor', 'middle')
    .attr('fill', '#e8453c').attr('font-family', "'DM Mono', monospace").attr('font-size', '8px')
    .text('COVID-19 mobility restrictions');

  // Hover overlay — filter-aware
  svg.append('rect')
    .attr('width', w).attr('height', h)
    .attr('fill', 'none').attr('pointer-events', 'all')
    .on('mousemove', function(evt) {
      const [mx] = d3.pointer(evt);
      const yr = Math.max(2011, Math.min(2021, Math.round(x.invert(mx))));
      const active = document.querySelector('#aq1-filters .filter-btn.active')?.dataset.user || 'all';
      if (active === 'all') {
        showTooltip('tooltip-trend', `<strong>National total</strong><br/>${yr}: ${fmt(natTotal.get(yr) || 0)}`, evt);
      } else {
        const val = natRU.get(active)?.get(yr) || 0;
        showTooltip('tooltip-trend', `<strong>${roadUserShort[active] || active}</strong><br/>${yr}: ${fmt(val)}`, evt);
      }
    })
    .on('mouseleave', () => hideTooltip('tooltip-trend'));

  // Axes
  svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).ticks(11).tickFormat(d3.format('d')));
  svg.append('g').attr('class', 'axis')
    .call(d3.axisLeft(y).ticks(5).tickFormat(d => fmt(d)));
  svg.append('text').attr('transform', 'rotate(-90)')
    .attr('x', -h / 2).attr('y', -55).attr('text-anchor', 'middle')
    .attr('fill', 'var(--muted)').attr('font-family', "'DM Mono', monospace").attr('font-size', '11px')
    .text('Hospitalisations');

  // Road user legend (2-column, below x-axis)
  const leg = svg.append('g').attr('transform', `translate(0, ${h + 30})`);
  users.forEach((u, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const xOff = col * (w / 2);
    leg.append('rect').attr('x', xOff).attr('y', row * 16).attr('width', 10).attr('height', 3)
      .attr('fill', roadUserColors[u] || '#888').attr('rx', 1);
    leg.append('text').attr('x', xOff + 15).attr('y', row * 16 + 3)
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
  const legendRows = Math.ceil(users.length / 2);
  const H  = 380 + legendRows * 16 + 12;
  const w  = W - M.left - M.right;
  const h  = H - M.top - M.bottom - legendRows * 16 - 12;

  const svgEl = d3.select(sel)
    .append('svg').attr('width', W).attr('height', H)
    .attr('role', 'graphics-document').attr('aria-labelledby', `${id}-title`);
  svgEl.append('title').attr('id', `${id}-title`)
    .text('Stacked area chart: road user composition of hospitalisations, Australia 2011–2021');
  svgEl.append('desc')
    .text('Stacked coloured areas show how each road user type contributes to the national hospitalisation total each year. Use the filter buttons above to isolate a road user type.');

  // Hatch pattern defs — redundant encoding alongside colour for colorblind accessibility
  const HATCH_CFGS = [
    null,                                                    // solid
    { d: 'M0,4 L8,4',            size: 8, sw: 1.2 },        // horizontal lines
    { d: 'M4,0 L4,8',            size: 8, sw: 1.2 },        // vertical lines
    { d: 'M0,0 L8,8',            size: 8, sw: 1.2 },        // diagonal /
    { d: 'M8,0 L0,8',            size: 8, sw: 1.2 },        // diagonal \
    { dots: true, r: 1.5, size: 6 },                        // dots
    { d: 'M0,0 L8,8 M8,0 L0,8', size: 8, sw: 0.8 },        // crosshatch
    { d: 'M0,0 L5,5',            size: 5, sw: 1 },          // dense diagonal
  ];
  const defs = svgEl.append('defs');
  const patternFill = new Map();
  users.forEach((u, i) => {
    const color = roadUserColors[u] || '#888';
    const cfg = HATCH_CFGS[i % HATCH_CFGS.length];
    if (!cfg) { patternFill.set(u, null); return; }
    const pid = `pat-stacked-${id}-${i}`;
    patternFill.set(u, pid);
    const pat = defs.append('pattern')
      .attr('id', pid).attr('patternUnits', 'userSpaceOnUse')
      .attr('width', cfg.size).attr('height', cfg.size);
    pat.append('rect')
      .attr('width', cfg.size).attr('height', cfg.size)
      .attr('fill', color).attr('fill-opacity', 0.75);
    if (cfg.dots) {
      pat.append('circle')
        .attr('cx', cfg.size / 2).attr('cy', cfg.size / 2).attr('r', cfg.r)
        .attr('fill', 'rgba(255,255,255,0.35)');
    } else {
      pat.append('path').attr('d', cfg.d).attr('fill', 'none')
        .attr('stroke', 'rgba(255,255,255,0.35)').attr('stroke-width', cfg.sw);
    }
  });

  const svg = svgEl.append('g').attr('transform', `translate(${M.left},${M.top})`);

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
      .attr('fill', s => patternFill.get(s.key) ? `url(#${patternFill.get(s.key)})` : (roadUserColors[s.key] || '#888'))
      .attr('fill-opacity', s => patternFill.get(s.key) ? 1 : 0.75)
      .attr('stroke', '#fff')
      .attr('stroke-width', 0.5)
      .attr('d', area);

  // Policy break lines
  _addPolicyLines(svg, x, h, 'tooltip-stacked');

  // Hover overlay — filter-aware, sits on top of areas
  svg.append('rect')
    .attr('width', w).attr('height', h)
    .attr('fill', 'none').attr('pointer-events', 'all')
    .on('mousemove', function(evt) {
      const [mx] = d3.pointer(evt);
      const yr = Math.max(2011, Math.min(2021, Math.round(x.invert(mx))));
      const active = document.querySelector('#aq1-filters .filter-btn.active')?.dataset.user || 'all';
      if (active === 'all') {
        const total = d3.sum(users, u => natRU.get(u)?.get(yr) || 0);
        showTooltip('tooltip-stacked', `<strong>National total</strong><br/>${yr}: ${fmt(total)}`, evt);
      } else {
        const val = natRU.get(active)?.get(yr) || 0;
        showTooltip('tooltip-stacked', `<strong>${roadUserShort[active] || active}</strong><br/>${yr}: ${fmt(val)}`, evt);
      }
    })
    .on('mouseleave', () => hideTooltip('tooltip-stacked'));

  // COVID label + dashed connector
  svg.append('line')
    .attr('x1', x(2020)).attr('x2', x(2020))
    .attr('y1', 16).attr('y2', h)
    .attr('stroke', '#e8453c').attr('stroke-width', 1).attr('stroke-dasharray', '3,3');
  svg.append('text')
    .attr('x', x(2020)).attr('y', 12)
    .attr('text-anchor', 'middle')
    .attr('fill', '#e8453c').attr('font-family', "'DM Mono', monospace").attr('font-size', '8px')
    .text('COVID-19 mobility restrictions');

  // Axes
  svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).ticks(11).tickFormat(d3.format('d')));
  svg.append('g').attr('class', 'axis')
    .call(d3.axisLeft(y).ticks(5).tickFormat(d => fmt(d)));
  svg.append('text').attr('transform', 'rotate(-90)')
    .attr('x', -h / 2).attr('y', -55).attr('text-anchor', 'middle')
    .attr('fill', 'var(--muted)').attr('font-family', "'DM Mono', monospace").attr('font-size', '11px')
    .text('Hospitalisations');

  // Legend (2-column, below x-axis) — swatches mirror the hatch fill of each band
  const legG = svg.append('g').attr('transform', `translate(0, ${h + 30})`);
  // Inline pattern defs for legend swatches (10×10 px, same hatch configs)
  const legDefs = svgEl.append('defs');
  users.forEach((u, i) => {
    const color = roadUserColors[u] || '#888';
    const cfg = HATCH_CFGS[i % HATCH_CFGS.length];
    const lpid = `leg-pat-${id}-${i}`;
    const pat = legDefs.append('pattern')
      .attr('id', lpid).attr('patternUnits', 'userSpaceOnUse')
      .attr('width', cfg ? cfg.size : 10).attr('height', cfg ? cfg.size : 10);
    pat.append('rect')
      .attr('width', cfg ? cfg.size : 10).attr('height', cfg ? cfg.size : 10)
      .attr('fill', color).attr('fill-opacity', 0.75);
    if (cfg && cfg.dots) {
      pat.append('circle')
        .attr('cx', cfg.size / 2).attr('cy', cfg.size / 2).attr('r', cfg.r)
        .attr('fill', 'rgba(255,255,255,0.35)');
    } else if (cfg) {
      pat.append('path').attr('d', cfg.d).attr('fill', 'none')
        .attr('stroke', 'rgba(255,255,255,0.35)').attr('stroke-width', cfg.sw);
    }
    const col = i % 2;
    const row = Math.floor(i / 2);
    const xOff = col * (w / 2);
    legG.append('rect').attr('x', xOff).attr('y', row * 16).attr('width', 10).attr('height', 10)
      .attr('fill', `url(#${lpid})`).attr('rx', 1);
    legG.append('text').attr('x', xOff + 15).attr('y', row * 16 + 8)
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
