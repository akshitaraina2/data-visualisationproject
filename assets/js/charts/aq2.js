function drawHeatmap(raw, sel) {
  // finer age buckets than the global AGE_ORDER (65-74 and 75+ instead of 65+)
  const AGE_ORDER_LOCAL = [
    '0-7', '8-16', '17-25', '26-39', '40-64', '65-74', '75+'
  ];

  const DATA_QUALITY_FLAGS = new Set([
    '0-7|Car driver',
    '0-7|Motorcyclist',
    '8-16|Heavy transport driver'
  ]);
  const isFlagged = (age, user) => DATA_QUALITY_FLAGS.has(`${age}|${user}`);

  const ROAD_USER_ABBREV = {
    'Bus occupant':                        'Bus occupant',
    'Car driver':                          'Car driver',
    'Car passenger':                       'Car passenger',
    'Car unknown position':                'Car (unknown pos.)',
    'Heavy transport driver':              'HV driver',
    'Heavy transport passenger':           'HV passenger',
    'Heavy transport unknown position':    'HV (unknown pos.)',
    'Motorcyclist':                        'Motorcyclist',
    'Other or unknown':                    'Other/unknown',
    'Pedal cyclist':                       'Pedal cyclist',
    'Pedestrian':                          'Pedestrian',
    'Pick-up truck or van occupant':       'Pick-up/van'
  };

  const ages  = AGE_ORDER_LOCAL.filter(a => raw.some(d => d.age_group === a));
  const users = [...new Set(raw.map(d => d.road_user))].sort();

  // d3.rollup only creates entries for combinations that appear in raw
  // undefined from .get() → no rows at all → suppressed; 0 → rows exist but all n.p. → true zero
  const matrix = d3.rollup(
    raw.filter(d => AGE_ORDER_LOCAL.includes(d.age_group)),
    v => d3.sum(v, d => num(d[HOSPS])),
    d => d.age_group,
    d => d.road_user
  );

  const cellState = (age, user) => {
    const v = matrix.get(age)?.get(user);
    if (v === undefined)      return { state: 'suppressed', val: 0 };
    if (v === 0)              return { state: 'zero',       val: 0 };
    if (isFlagged(age, user)) return { state: 'flagged',    val: v };
    return { state: 'normal', val: v };
  };

  const id = sel.replace('#', '');
  const totalWidth = getContainerWidth(id);
  const rightPad   = 20;
  const bottomPad  = 270;
  const w          = totalWidth - M.left - rightPad;

  // 40px per row keeps cells readable at any age bucket count
  const rowH = 40;
  const h    = rowH * ages.length;
  const H    = M.top + h + bottomPad;

  const maxVal     = d3.max(ages.flatMap(a => users.map(u => matrix.get(a)?.get(u) || 0))) || 1;
  const colorScale = d3.scaleSequential()
    .domain([0, maxVal])
    .interpolator(d3.interpolateViridis);

  const svgEl = d3.select(sel)
    .append('svg').attr('width', totalWidth).attr('height', H)
    .attr('viewBox', `0 0 ${totalWidth} ${H}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .attr('role', 'graphics-document')
    .attr('aria-labelledby', `${id}-title`);
  svgEl.append('title').attr('id', `${id}-title`)
    .text('Heatmap: hospitalisations by age group and road user type, Australia 2011–2021');
  svgEl.append('desc')
    .text('Colour intensity encodes the total hospitalisation count for each combination of age group (rows) and road user type (columns) across the full decade.');

  const defs = svgEl.append('defs');

  const linearGradient = defs.append('linearGradient')
    .attr('id', `${id}-viridis-gradient`)
    .attr('x1', '0%').attr('x2', '100%')
    .attr('y1', '0%').attr('y2', '0%');
  linearGradient.selectAll('stop')
    .data(d3.range(11).map(i => i / 10))
    .join('stop')
    .attr('offset', d => `${d * 100}%`)
    .attr('stop-color', d => d3.interpolateViridis(d));

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

  ages.forEach(age => {
    users.forEach(user => {
      const { state, val } = cellState(age, user);

      const fill = state === 'suppressed' ? `url(#${id}-hatch)`
                 : state === 'zero'       ? 'rgba(255,255,255,0.1)'
                 :                          colorScale(val);

      const tooltipHtml = state === 'suppressed'
        ? `<strong>${age} × ${user}</strong><br/>Data suppressed (small cell count)`
        : state === 'zero'
        ? `<strong>${age} × ${user}</strong><br/>No cases recorded`
        : state === 'flagged'
        ? `<strong>${age} × ${user}</strong><br/>${fmt(val)} hospitalisations<br/>† Possible miscoding — interpret with caution`
        : `<strong>${age} × ${user}</strong><br/>${fmt(val)} hospitalisations (2011–2021 total)`;

      const ariaLabel = state === 'suppressed'
        ? `${age}, ${user}: Data suppressed (small cell count)`
        : state === 'zero'
        ? `${age}, ${user}: No cases recorded`
        : state === 'flagged'
        ? `${age}, ${user}: ${fmt(val)} hospitalisations, possible miscoding`
        : `${age}, ${user}: ${fmt(val)} hospitalisations`;

      svg.append('rect')
        .attr('x', xScale(user)).attr('y', yScale(age))
        .attr('width', xScale.bandwidth()).attr('height', yScale.bandwidth())
        .attr('fill', fill)
        .attr('rx', 2)
        .attr('stroke', 'rgba(255,255,255,0.15)')
        .attr('stroke-width', 0.5)
        .attr('aria-label', ariaLabel)
        .on('mousemove', evt => showTooltip('tooltip-heatmap', tooltipHtml, evt))
        .on('mouseenter', function() {
          svg.selectAll('rect').attr('opacity', 0.2);
          d3.select(this)
            .attr('opacity', 1)
            .attr('stroke', 'rgba(255,255,255,0.9)')
            .attr('stroke-width', 2);
        })
        .on('mouseleave', function() {
          svg.selectAll('rect').attr('opacity', 1);
          d3.select(this)
            .attr('stroke', 'rgba(255,255,255,0.15)')
            .attr('stroke-width', 0.5);
          hideTooltip('tooltip-heatmap');
        });

      if (state === 'flagged') {
        const cx = xScale(user) + xScale.bandwidth() - 6;
        const cy = yScale(age) + 6;
        svg.append('circle')
          .attr('cx', cx).attr('cy', cy).attr('r', 4)
          .attr('fill', 'white').attr('stroke', 'rgba(0,0,0,0.3)').attr('stroke-width', 0.5)
          .attr('pointer-events', 'none');
        svg.append('text')
          .attr('x', cx).attr('y', cy)
          .attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
          .attr('font-size', '11px').attr('fill', '#333')
          .attr('pointer-events', 'none')
          .text('?');
      }

      // annotate top 20% cells only; flagged cells already have "?" marker
      if (state === 'normal' && val >= 0.8 * maxVal) {
        const textColor = val > 0.7 * maxVal ? '#000' : '#fff';
        svg.append('text')
          .attr('x', xScale(user) + xScale.bandwidth() / 2)
          .attr('y', yScale(age) + yScale.bandwidth() / 2)
          .attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
          .attr('font-size', '11px').attr('font-weight', 'bold')
          .attr('fill', textColor).attr('pointer-events', 'none')
          .text(fmt(val));
      }
    });
  });

  svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(xScale).tickFormat(d => ROAD_USER_ABBREV[d] || d))
    .selectAll('text')
      .attr('transform', 'rotate(-60)').style('text-anchor', 'end')
      .attr('dx', '-0.5em').attr('dy', '0.15em')
      .attr('fill', 'var(--text)');

  svg.append('g').attr('class', 'axis').call(d3.axisLeft(yScale));

  svg.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -(h / 2)).attr('y', -(M.left * 0.6))
    .attr('text-anchor', 'middle')
    .attr('fill', 'var(--muted)').attr('font-family', "'DM Mono', monospace").attr('font-size', '12px')
    .text('Age Group');

  // bottomPad is 20px larger than M.bottom to ensure clearance below -60° labels
  svg.append('text')
    .attr('x', w / 2).attr('y', h + 120)
    .attr('text-anchor', 'middle')
    .attr('fill', 'var(--muted)').attr('font-family', "'DM Mono', monospace").attr('font-size', '12px')
    .text('Road User Type');

  svg.append('text').attr('x', w / 2).attr('y', -10).attr('text-anchor', 'middle')
    .attr('fill', 'var(--muted)').attr('font-family', "'DM Mono', monospace").attr('font-size', '11px')
    .text('Age group × road user (total 2011–2021 hospitalisations)');

  const legBarW = 200;
  const legBarH = 12;
  const midVal  = Math.round(maxVal / 2);
  const legX    = (w - legBarW) / 2;
  const legY    = h + 145;

  const legG = svg.append('g')
    .attr('transform', `translate(${legX}, ${legY})`)
    .attr('role', 'group')
    .attr('aria-label', 'Chart legend');

  legG.append('text')
    .attr('x', legBarW / 2).attr('y', -6)
    .attr('text-anchor', 'middle')
    .attr('fill', 'var(--muted)').attr('font-family', "'DM Mono', monospace").attr('font-size', '11px')
    .text('Hospitalisations (total 2011–2021)');
  legG.append('rect')
    .attr('width', legBarW).attr('height', legBarH)
    .attr('fill', `url(#${id}-viridis-gradient)`)
    .attr('rx', 1)
    .attr('aria-hidden', 'true');
  [[0, 0, 'start'], [midVal, legBarW / 2, 'middle'], [maxVal, legBarW, 'end']].forEach(([v, x, anchor]) => {
    legG.append('line')
      .attr('x1', x).attr('x2', x)
      .attr('y1', legBarH).attr('y2', legBarH + 4)
      .attr('stroke', 'var(--muted)').attr('stroke-width', 1);
    legG.append('text')
      .attr('x', x).attr('y', legBarH + 14)
      .attr('text-anchor', anchor)
      .attr('fill', 'var(--muted)').attr('font-family', "'DM Mono', monospace").attr('font-size', '11px')
      .text(fmt(v));
  });

  const swatchY1 = legBarH + 28;
  legG.append('rect')
    .attr('x', 0).attr('y', swatchY1)
    .attr('width', legBarH).attr('height', legBarH)
    .attr('fill', 'rgba(255,255,255,0.1)')
    .attr('stroke', '#888').attr('stroke-width', 0.5).attr('rx', 1);
  legG.append('text')
    .attr('x', legBarH + 5).attr('y', swatchY1 + legBarH / 2 + 1)
    .attr('dominant-baseline', 'middle')
    .attr('fill', 'var(--muted)').attr('font-family', "'DM Mono', monospace").attr('font-size', '11px')
    .text('Zero cases recorded');

  const swatchY2 = swatchY1 + 20;
  legG.append('rect')
    .attr('x', 0).attr('y', swatchY2)
    .attr('width', legBarH).attr('height', legBarH)
    .attr('fill', `url(#${id}-hatch)`)
    .attr('stroke', '#555').attr('stroke-width', 0.5).attr('rx', 1);
  legG.append('text')
    .attr('x', legBarH + 5).attr('y', swatchY2 + legBarH / 2 + 1)
    .attr('dominant-baseline', 'middle')
    .attr('fill', 'var(--muted)').attr('font-family', "'DM Mono', monospace").attr('font-size', '11px')
    .text('Data suppressed');

  const swatchY3 = swatchY2 + 20;
  legG.append('circle')
    .attr('cx', legBarH / 2).attr('cy', swatchY3 + legBarH / 2)
    .attr('r', 4)
    .attr('fill', 'white').attr('stroke', 'rgba(0,0,0,0.3)').attr('stroke-width', 0.5);
  legG.append('text')
    .attr('x', legBarH / 2).attr('y', swatchY3 + legBarH / 2)
    .attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
    .attr('font-size', '11px').attr('fill', '#333')
    .text('?');
  legG.append('text')
    .attr('x', legBarH + 5).attr('y', swatchY3 + legBarH / 2 + 1)
    .attr('dominant-baseline', 'middle')
    .attr('fill', 'var(--muted)').attr('font-family', "'DM Mono', monospace").attr('font-size', '11px')
    .text('† Possible miscoding — see data notes');

  d3.select(sel).append('p')
    .attr('role', 'note')
    .attr('aria-label', 'Data quality note')
    .attr('class', 'data-note')
    .style('margin-top', '0.75rem')
    .text(`These combinations (e.g. 0–7 year old car drivers) appear in the source data but likely reflect coding anomalies. The ABS 'Motorcyclist' category covers both riders and passengers, so some 0–7 cases may represent pillion passengers.`);
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
  const container = document.querySelector(sel);
  const totalWidth = container ? container.getBoundingClientRect().width || 800 : 800;
  const H  = 440;
  const w  = totalWidth - M.left - M.right;
  const h  = H - M.top - 160;

  const svgEl = d3.select(sel)
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
  const container = document.querySelector(sel);
  const totalWidth = container ? container.getBoundingClientRect().width || 800 : 800;
  const H  = 300;
  const w  = totalWidth - M.left - M.right;
  const h  = H - M.top - M.bottom;
  const midX = w / 2;

  const svgEl = d3.select(sel)
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

  svg.append('line')
    .attr('x1', midX).attr('x2', midX).attr('y1', 0).attr('y2', h)
    .attr('stroke', 'var(--border)').attr('stroke-width', 1);

  svg.append('g').attr('class', 'axis')
    .attr('transform', `translate(${midX},0)`)
    .call(d3.axisLeft(y).tickSize(0))
    .selectAll('.domain').remove();

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
