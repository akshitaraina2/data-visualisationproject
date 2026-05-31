// ── AQ2: WHO IS AFFECTED ─────────────────────────────────────────────────────
// drawHeatmap      → age_group × road_user heatmap; colour = total count
// drawSexRoadUser  → grouped bar, Male vs Female per road user
// drawPyramid      → population pyramid by age group
//
// All three charts use national_crossed_aq2.csv.
// Depends on: constants.js

function drawHeatmap(raw, sel) {
  const ages  = AGE_ORDER.filter(a => raw.some(d => d.age_group === a));
  const users = [...new Set(raw.map(d => d.road_user))].sort();

  // Sum over all years and sexes
  const matrix = d3.rollup(
    raw,
    v => d3.sum(v, d => num(d[HOSPS])),
    d => d.age_group,
    d => d.road_user
  );

  const id = sel.replace('#', '');
  // RESPONSIVE FIX — was hardcoded, now container-relative
  const container  = document.querySelector(sel);
  const totalWidth = container ? container.getBoundingClientRect().width || 800 : 800;
  const rightPad   = 20;
  const bottomPad  = 185;
  // RESPONSIVE FIX — was hardcoded, now container-relative
  const w  = totalWidth - M.left - rightPad;
  const H  = 280 + bottomPad;
  const h  = H - M.top - bottomPad;

  // USABILITY FIX — colour scale updated after usability testing
  // Viridis chosen for perceptual uniformity and colourblind safety.
  // Safe under Protanopia, Deuteranopia, and Tritanopia.
  // Replaces previous scale which failed usability testing (unclear
  // magnitude encoding).
  const maxVal     = d3.max(ages.flatMap(a => users.map(u => matrix.get(a)?.get(u) || 0))) || 1;
  const colorScale = d3.scaleSequential()
    .domain([0, maxVal])
    .interpolator(d3.interpolateViridis);

  const svgEl = d3.select(sel)
    // RESPONSIVE FIX — was hardcoded, now container-relative
    .append('svg').attr('width', totalWidth).attr('height', H)
    .attr('viewBox', `0 0 ${totalWidth} ${H}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    // USABILITY FIX — accessibility: role="img" and aria-label per spec
    .attr('role', 'img')
    .attr('aria-label', 'Heatmap of road crash hospitalisations by age group and road user type, Australia 2011 to 2021');
  svgEl.append('title').attr('id', `${id}-title`)
    .text('Heatmap: hospitalisations by age group and road user type, Australia 2011–2021');
  svgEl.append('desc')
    .text('Colour intensity encodes the total hospitalisation count for each combination of age group (rows) and road user type (columns) across the full decade.');

  // USABILITY FIX — SVG defs: Viridis gradient + hatch pattern for suppressed/zero cells
  // NOTE (Blocker 1): national_crossed_aq2.csv not yet available. Once resolved,
  // verify: (a) maxVal is realistic and legend ticks format correctly with live data,
  // (b) zero cells are genuinely suppressed/absent vs truly zero counts.
  const defs = svgEl.append('defs');

  // Viridis gradient — sampled at 11 evenly-spaced stops
  const linearGradient = defs.append('linearGradient')
    .attr('id', `${id}-viridis-gradient`)
    .attr('x1', '0%').attr('x2', '100%')
    .attr('y1', '0%').attr('y2', '0%');
  linearGradient.selectAll('stop')
    .data(d3.range(11).map(i => i / 10))
    .join('stop')
    .attr('offset', d => `${d * 100}%`)
    .attr('stop-color', d => d3.interpolateViridis(d));

  // USABILITY FIX — diagonal hatch for zero/suppressed cells (consistent with n.p.
  // suppression handling elsewhere in this project per CLAUDE.md)
  const hatchPattern = defs.append('pattern')
    .attr('id', `${id}-hatch`)
    .attr('patternUnits', 'userSpaceOnUse')
    .attr('width', 6).attr('height', 6);
  hatchPattern.append('path')
    .attr('d', 'M-1,1 l2,-2 M0,6 l6,-6 M5,7 l2,-2')
    .attr('stroke', '#555')
    .attr('stroke-width', 1.5);

  const svg = svgEl.append('g').attr('transform', `translate(${M.left},${M.top})`);

  const xScale = d3.scaleBand().domain(users).range([0, w]).padding(0.04);
  const yScale = d3.scaleBand().domain(ages).range([0, h]).padding(0.04);

  // USABILITY FIX — cells: hatch for zero/suppressed; Viridis for non-zero values.
  // Edge case: if all cells in a row (age group) or column (road user) are zero,
  // the entire row/column shows only hatch. This could mean a genuinely absent
  // combination or full suppression — flag for QA once Blocker 1 resolves.
  ages.forEach(age => {
    users.forEach(user => {
      const val    = matrix.get(age)?.get(user) || 0;
      const isZero = val === 0;

      svg.append('rect')
        .attr('x', xScale(user)).attr('y', yScale(age))
        .attr('width', xScale.bandwidth()).attr('height', yScale.bandwidth())
        .attr('fill', isZero ? `url(#${id}-hatch)` : colorScale(val))
        .attr('rx', 2)
        .attr('stroke', 'none')
        .attr('stroke-width', 2)
        // USABILITY FIX — accessibility: aria-label per spec
        .attr('aria-label', isZero
          ? `${age}, ${user}: data suppressed`
          : `${age}, ${user}: ${fmt(val)} hospitalisations`)
        // USABILITY FIX — tooltip: percentage format for single category; hatch label for zero
        .on('mousemove', evt => showTooltip('tooltip-heatmap',
          isZero
            ? `<strong>${age} × ${user}</strong><br/>data suppressed or not available`
            : `<strong>${age} × ${user}</strong><br/>${fmt(val)} hospitalisations`,
          evt))
        // USABILITY FIX — hover border: white stroke added on enter, removed on leave
        .on('mouseenter', function() { d3.select(this).attr('stroke', 'white'); })
        .on('mouseleave', function() {
          d3.select(this).attr('stroke', 'none');
          hideTooltip('tooltip-heatmap');
        });
    });
  });

  // x axis with rotated labels
  svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(xScale).tickFormat(d => roadUserShort[d] || d))
    .selectAll('text')
      .attr('transform', 'rotate(-45)').style('text-anchor', 'end')
      .attr('dx', '-0.5em').attr('dy', '0.2em')
      .attr('fill', 'var(--text)');

  svg.append('g').attr('class', 'axis').call(d3.axisLeft(yScale));

  svg.append('text').attr('x', w / 2).attr('y', -10).attr('text-anchor', 'middle')
    .attr('fill', 'var(--muted)').attr('font-family', "'DM Mono', monospace").attr('font-size', '11px')
    .text('Age group × road user (total 2011–2021 hospitalisations)');

  // USABILITY FIX — continuous gradient legend replaces previous discrete 5-step swatches.
  // Horizontal bar, 200px wide, centre-aligned to chart, positioned below rotated x-axis labels.
  const legBarW = 200;
  const legBarH = 12;
  const midVal  = Math.round(maxVal / 2);
  const legX    = (w - legBarW) / 2;
  const legY    = h + 95;

  const legG = svg.append('g').attr('transform', `translate(${legX}, ${legY})`);

  legG.append('text')
    .attr('x', legBarW / 2).attr('y', -6)
    .attr('text-anchor', 'middle')
    .attr('fill', 'var(--muted)').attr('font-family', "'DM Mono', monospace").attr('font-size', '9px')
    .text('Hospitalisations (total 2011–2021)');

  // Gradient bar — aria-hidden since axis ticks carry the screen-readable values
  legG.append('rect')
    .attr('width', legBarW).attr('height', legBarH)
    .attr('fill', `url(#${id}-viridis-gradient)`)
    .attr('rx', 1)
    .attr('aria-hidden', 'true');

  // USABILITY FIX — axis ticks at min, midpoint, and max
  [[0, 0, 'start'], [midVal, legBarW / 2, 'middle'], [maxVal, legBarW, 'end']].forEach(([v, x, anchor]) => {
    legG.append('line')
      .attr('x1', x).attr('x2', x)
      .attr('y1', legBarH).attr('y2', legBarH + 4)
      .attr('stroke', 'var(--muted)').attr('stroke-width', 1);
    legG.append('text')
      .attr('x', x).attr('y', legBarH + 14)
      .attr('text-anchor', anchor)
      .attr('fill', 'var(--muted)').attr('font-family', "'DM Mono', monospace").attr('font-size', '8px')
      .text(fmt(v));
  });

  // USABILITY FIX — hatch swatch + label for suppressed/zero cells
  const hatchSwatchX = legBarW + 24;
  legG.append('rect')
    .attr('x', hatchSwatchX).attr('y', 0)
    .attr('width', legBarH).attr('height', legBarH)
    .attr('fill', `url(#${id}-hatch)`)
    .attr('stroke', '#555').attr('stroke-width', 0.5).attr('rx', 1);
  legG.append('text')
    .attr('x', hatchSwatchX + legBarH + 5).attr('y', legBarH / 2 + 1)
    .attr('dominant-baseline', 'middle')
    .attr('fill', 'var(--muted)').attr('font-family', "'DM Mono', monospace").attr('font-size', '8px')
    .text('Suppressed or zero');
}

function drawSexRoadUser(raw, sel) {
  const SEXES = ['Male', 'Female'];
  const users = [...new Set(raw.map(d => d.road_user))].sort();
  const sexColors = { Male: '#56B4E9', Female: '#E69F00' };

  const rolled = d3.rollup(
    raw.filter(d => SEXES.includes(d.sex)),
    v => d3.sum(v, d => num(d[HOSPS])),
    d => d.road_user,
    d => d.sex
  );

  const id = sel.replace('#', '');
  // RESPONSIVE FIX — was hardcoded, now container-relative
  const container = document.querySelector(sel);
  const totalWidth = container ? container.getBoundingClientRect().width || 800 : 800;
  const H  = 440;
  // RESPONSIVE FIX — was hardcoded, now container-relative
  const w  = totalWidth - M.left - M.right;
  const h  = H - M.top - 160;

  const svgEl = d3.select(sel)
    // RESPONSIVE FIX — was hardcoded, now container-relative
    .append('svg').attr('width', totalWidth).attr('height', H)
    .attr('viewBox', `0 0 ${totalWidth} ${H}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .attr('role', 'graphics-document').attr('aria-labelledby', `${id}-title`);
  svgEl.append('title').attr('id', `${id}-title`)
    .text('Grouped bar chart: male vs female hospitalisations by road user type, Australia 2011–2021');
  svgEl.append('desc')
    .text('Paired bars compare total male and female hospitalisation counts for each road user category across the full 2011–2021 period.');
  const svg = svgEl.append('g').attr('transform', `translate(${M.left},${M.top})`);

  const x0 = d3.scaleBand().domain(users).range([0, w]).padding(0.2);
  const x1 = d3.scaleBand().domain(SEXES).range([0, x0.bandwidth()]).padding(0.06);
  const maxVal = d3.max(users.flatMap(u => SEXES.map(s => rolled.get(u)?.get(s) || 0)));
  const y = d3.scaleLinear().domain([0, maxVal * 1.15]).range([h, 0]);

  svg.append('g').attr('class', 'grid')
    .call(d3.axisLeft(y).ticks(5).tickSize(-w).tickFormat(''));

  users.forEach(u => {
    SEXES.forEach(s => {
      const val = rolled.get(u)?.get(s) || 0;
      svg.append('rect')
        .attr('x', x0(u) + x1(s)).attr('y', y(val))
        .attr('width', x1.bandwidth()).attr('height', h - y(val))
        .attr('fill', sexColors[s]).attr('rx', 1)
        .on('mousemove', evt => showTooltip('tooltip-sex',
          `<strong>${u} — ${s}</strong><br/>${fmt(val)}`, evt))
        .on('mouseleave', () => hideTooltip('tooltip-sex'));
    });
  });

  svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x0).tickFormat(d => roadUserShort[d] || d))
    .selectAll('text')
      .attr('transform', 'rotate(-45)').style('text-anchor', 'end')
      .attr('dx', '-0.5em').attr('dy', '0.2em')
      .attr('fill', 'var(--text)');
  svg.append('g').attr('class', 'axis')
    .call(d3.axisLeft(y).ticks(5).tickFormat(d => fmt(d)));
  svg.append('text').attr('transform', 'rotate(-90)')
    .attr('x', -h / 2).attr('y', -55).attr('text-anchor', 'middle')
    .attr('fill', 'var(--muted)').attr('font-family', "'DM Mono', monospace").attr('font-size', '11px')
    .text('Hospitalisations (total 2011–2021)');

  const leg = svg.append('g').attr('transform', `translate(${w - 130}, 0)`);
  SEXES.forEach((s, i) => {
    leg.append('rect').attr('x', 0).attr('y', i * 18).attr('width', 12).attr('height', 12)
      .attr('fill', sexColors[s]).attr('rx', 1);
    leg.append('text').attr('x', 18).attr('y', i * 18 + 9).attr('dominant-baseline', 'middle')
      .attr('fill', 'var(--muted)').attr('font-family', "'DM Mono', monospace").attr('font-size', '11px')
      .text(s);
  });
}

function drawPyramid(raw, sel) {
  const SEXES = ['Male', 'Female'];
  const ages = AGE_ORDER.filter(a => raw.some(d => d.age_group === a));

  const rolled = d3.rollup(
    raw.filter(d => SEXES.includes(d.sex)),
    v => d3.sum(v, d => num(d[HOSPS])),
    d => d.age_group,
    d => d.sex
  );

  const id = sel.replace('#', '');
  // RESPONSIVE FIX — was hardcoded, now container-relative
  const container = document.querySelector(sel);
  const totalWidth = container ? container.getBoundingClientRect().width || 800 : 800;
  const H  = 300;
  // RESPONSIVE FIX — was hardcoded, now container-relative
  const w  = totalWidth - M.left - M.right;
  const h  = H - M.top - M.bottom;
  const midX = w / 2;

  const svgEl = d3.select(sel)
    // RESPONSIVE FIX — was hardcoded, now container-relative
    .append('svg').attr('width', totalWidth).attr('height', H)
    .attr('viewBox', `0 0 ${totalWidth} ${H}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .attr('role', 'graphics-document').attr('aria-labelledby', `${id}-title`);
  svgEl.append('title').attr('id', `${id}-title`)
    .text('Population pyramid: hospitalisations by age group and sex, Australia 2011–2021');
  svgEl.append('desc')
    .text('Male bars extend left and female bars extend right from the centre axis, showing the age distribution of hospitalisations across the full decade.');
  const svg = svgEl.append('g').attr('transform', `translate(${M.left},${M.top})`);

  const y = d3.scaleBand().domain(ages).range([0, h]).padding(0.15);
  const maxVal = d3.max(ages.flatMap(a => SEXES.map(s => rolled.get(a)?.get(s) || 0)));
  const xLeft  = d3.scaleLinear().domain([0, maxVal]).range([midX, 0]);
  const xRight = d3.scaleLinear().domain([0, maxVal]).range([midX, w]);

  // Male bars (left)
  ages.forEach(a => {
    const val = rolled.get(a)?.get('Male') || 0;
    svg.append('rect')
      .attr('x', xLeft(val)).attr('y', y(a))
      .attr('width', midX - xLeft(val)).attr('height', y.bandwidth())
      .attr('fill', '#56B4E9').attr('rx', 1)
      .on('mousemove', evt => showTooltip('tooltip-pyramid',
        `<strong>${a} — Male</strong><br/>${fmt(val)}`, evt))
      .on('mouseleave', () => hideTooltip('tooltip-pyramid'));
  });

  // Female bars (right)
  ages.forEach(a => {
    const val = rolled.get(a)?.get('Female') || 0;
    svg.append('rect')
      .attr('x', midX).attr('y', y(a))
      .attr('width', xRight(val) - midX).attr('height', y.bandwidth())
      .attr('fill', '#E69F00').attr('rx', 1)
      .on('mousemove', evt => showTooltip('tooltip-pyramid',
        `<strong>${a} — Female</strong><br/>${fmt(val)}`, evt))
      .on('mouseleave', () => hideTooltip('tooltip-pyramid'));
  });

  // Centre divider
  svg.append('line')
    .attr('x1', midX).attr('x2', midX).attr('y1', 0).attr('y2', h)
    .attr('stroke', 'var(--border)').attr('stroke-width', 1);

  // Age labels at centre
  svg.append('g').attr('class', 'axis')
    .attr('transform', `translate(${midX},0)`)
    .call(d3.axisLeft(y).tickSize(0))
    .selectAll('.domain').remove();

  // x axes
  svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(xLeft.copy().range([midX, 0])).ticks(4).tickFormat(d => fmt(d)));
  svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(xRight.copy().range([midX, w])).ticks(4).tickFormat(d => fmt(d)));

  svg.append('text').attr('x', midX - 10).attr('y', -8).attr('text-anchor', 'end')
    .attr('fill', '#56B4E9').attr('font-family', "'DM Mono', monospace").attr('font-size', '11px')
    .text('Male');
  svg.append('text').attr('x', midX + 10).attr('y', -8)
    .attr('fill', '#E69F00').attr('font-family', "'DM Mono', monospace").attr('font-size', '11px')
    .text('Female');
  svg.append('text').attr('x', w / 2).attr('y', h + 40).attr('text-anchor', 'middle')
    .attr('fill', 'var(--muted)').attr('font-family', "'DM Mono', monospace").attr('font-size', '11px')
    .text('Hospitalisations (total 2011–2021)');
}
