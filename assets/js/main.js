// ── UTILITIES ────────────────────────────────────────────────────────────────
const fmt = d3.format(",");

function getContainerWidth(id) {
  return document.getElementById(id).getBoundingClientRect().width;
}

function showTooltip(tooltipId, html, event) {
  const tip = document.getElementById(tooltipId);
  tip.innerHTML = html;
  tip.style.opacity = 1;
  positionTooltip(tooltipId, event);
}

function positionTooltip(tooltipId, event) {
  const tip = document.getElementById(tooltipId);
  const container = tip.parentElement.getBoundingClientRect();
  const x = event.clientX - container.left + 12;
  const y = event.clientY - container.top - 10;
  tip.style.left = x + 'px';
  tip.style.top  = y + 'px';
}

function hideTooltip(tooltipId) {
  document.getElementById(tooltipId).style.opacity = 0;
}

// ── COLOUR SCALES ─────────────────────────────────────────────────────────────
const roadUserColors = {
  'Car driver':                       '#4fc3f7',
  'Motorcyclist':                     '#f5a623',
  'Pedal cyclist':                    '#81c784',
  'Car passenger':                    '#7986cb',
  'Pedestrian':                       '#e8453c',
  'Bus occupant':                     '#a1887f',
  'Pick-up truck or van occupant':    '#4db6ac',
  'Heavy transport driver':           '#ff8a65',
  'Heavy transport passenger':        '#ce93d8',
  'Heavy transport unknown position': '#b0bec5',
  'Car unknown position':             '#fff176',
};

const ageColors = d3.scaleOrdinal()
  .domain(['0-7','8-16','17-25','26-39','40-64','65-74','75+'])
  .range(['#b3e5fc','#4fc3f7','#f5a623','#e8453c','#81c784','#7986cb','#ce93d8']);

// ── SHARED MARGIN ─────────────────────────────────────────────────────────────
const M = { top: 30, right: 30, bottom: 45, left: 65 };

// ─────────────────────────────────────────────────────────────────────────────
// CHART 1 — National Trend (area + line)
// ─────────────────────────────────────────────────────────────────────────────
async function drawTrend() {
  const data = await d3.csv('assets/data/national_trend.csv', d => ({
    year: +d.year,
    hospitalisations: +d.hospitalisations
  }));

  // update hero stat
  const total = d3.sum(data, d => d.hospitalisations);
  document.getElementById('hero-total').textContent = fmt(total);

  const id = 'chart-trend';
  const W = getContainerWidth(id);
  const H = 380;
  const w = W - M.left - M.right;
  const h = H - M.top - M.bottom;

  const svg = d3.select(`#${id}`)
    .append('svg').attr('width', W).attr('height', H)
    .append('g').attr('transform', `translate(${M.left},${M.top})`);

  const x = d3.scaleLinear().domain([2011, 2021]).range([0, w]);
  const y = d3.scaleLinear().domain([0, d3.max(data, d => d.hospitalisations) * 1.15]).range([h, 0]);

  // grid
  svg.append('g').attr('class','grid')
    .call(d3.axisLeft(y).ticks(5).tickSize(-w).tickFormat(''));

  // area
  const area = d3.area()
    .x(d => x(d.year))
    .y0(h).y1(d => y(d.hospitalisations))
    .curve(d3.curveCatmullRom);

  svg.append('path').datum(data)
    .attr('fill', 'rgba(245,166,35,0.12)')
    .attr('d', area);

  // line
  const line = d3.line()
    .x(d => x(d.year))
    .y(d => y(d.hospitalisations))
    .curve(d3.curveCatmullRom);

  const path = svg.append('path').datum(data)
    .attr('fill', 'none')
    .attr('stroke', '#f5a623')
    .attr('stroke-width', 2.5)
    .attr('d', line);

  // animate line draw
  const len = path.node().getTotalLength();
  path.attr('stroke-dasharray', len).attr('stroke-dashoffset', len)
    .transition().duration(1800).ease(d3.easeCubicInOut)
    .attr('stroke-dashoffset', 0);

  // dots
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

  // COVID annotation
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

  // axes
  svg.append('g').attr('class','axis').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).ticks(11).tickFormat(d3.format('d')));

  svg.append('g').attr('class','axis')
    .call(d3.axisLeft(y).ticks(5).tickFormat(d => d3.format(',')(d)));

  // y label
  svg.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -h/2).attr('y', -52)
    .attr('text-anchor', 'middle')
    .attr('fill', 'var(--muted)')
    .attr('font-family', "'DM Mono', monospace")
    .attr('font-size', '11px')
    .text('Hospitalisations');
}

// ─────────────────────────────────────────────────────────────────────────────
// CHART 2 — Road User Multi-line
// ─────────────────────────────────────────────────────────────────────────────
async function drawRoadUser() {
  const raw = await d3.csv('assets/data/road_user_trend.csv', d => ({
    year: +d.year,
    road_user: d.road_user,
    hospitalisations: +d.hospitalisations
  }));

  // group by road user
  const grouped = d3.group(raw, d => d.road_user);
  const users = Array.from(grouped.keys()).sort();

  // build filter buttons
  const filterRow = document.getElementById('road-user-filters');
  const allBtn = document.createElement('button');
  allBtn.className = 'filter-btn active';
  allBtn.textContent = 'All';
  allBtn.dataset.user = 'all';
  filterRow.appendChild(allBtn);

  users.forEach(u => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn';
    btn.textContent = u;
    btn.dataset.user = u;
    filterRow.appendChild(btn);
  });

  const id = 'chart-roaduser';
  const W = getContainerWidth(id);
  const H = 400;
  const w = W - M.left - M.right;
  const h = H - M.top - M.bottom;

  const svg = d3.select(`#${id}`)
    .append('svg').attr('width', W).attr('height', H)
    .append('g').attr('transform', `translate(${M.left},${M.top})`);

  const x = d3.scaleLinear().domain([2011, 2021]).range([0, w]);
  const y = d3.scaleLinear()
    .domain([0, d3.max(raw, d => d.hospitalisations) * 1.2])
    .range([h, 0]);

  svg.append('g').attr('class','grid')
    .call(d3.axisLeft(y).ticks(5).tickSize(-w).tickFormat(''));

  const lineGen = d3.line().x(d => x(d.year)).y(d => y(d.hospitalisations)).curve(d3.curveCatmullRom);

  const lines = svg.selectAll('.road-line')
    .data(Array.from(grouped.entries()))
    .enter().append('path')
    .attr('class', 'road-line')
    .attr('data-user', ([u]) => u)
    .attr('fill', 'none')
    .attr('stroke', ([u]) => roadUserColors[u] || '#888')
    .attr('stroke-width', 2)
    .attr('opacity', 0.85)
    .attr('d', ([, vals]) => lineGen(vals.sort((a,b) => a.year - b.year)));

  // invisible hover overlay per line
  grouped.forEach((vals, u) => {
    vals.sort((a,b) => a.year - b.year).forEach(d => {
      svg.append('circle')
        .attr('cx', x(d.year)).attr('cy', y(d.hospitalisations))
        .attr('r', 5).attr('fill', roadUserColors[u] || '#888')
        .attr('opacity', 0)
        .attr('data-user', u)
        .style('cursor','pointer')
        .on('mousemove', event => showTooltip('tooltip-roaduser',
          `<strong>${u}</strong><br/>${d.year}: ${fmt(d.hospitalisations)}`, event))
        .on('mouseleave', () => hideTooltip('tooltip-roaduser'))
        .on('mouseenter', function() { d3.select(this).attr('opacity',1); })
        .on('mouseleave', function() { d3.select(this).attr('opacity',0); hideTooltip('tooltip-roaduser'); });
    });
  });

  svg.append('g').attr('class','axis').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).ticks(11).tickFormat(d3.format('d')));
  svg.append('g').attr('class','axis')
    .call(d3.axisLeft(y).ticks(5).tickFormat(d => d3.format(',')(d)));
  svg.append('text').attr('transform','rotate(-90)').attr('x',-h/2).attr('y',-52)
    .attr('text-anchor','middle').attr('fill','var(--muted)')
    .attr('font-family',"'DM Mono', monospace").attr('font-size','11px')
    .text('Hospitalisations');

  // legend
  const legendData = users.slice(0, 6);
  const leg = svg.append('g').attr('transform', `translate(${w - 220}, 0)`);
  legendData.forEach((u, i) => {
    leg.append('rect').attr('x',0).attr('y', i*18).attr('width',10).attr('height',3)
      .attr('fill', roadUserColors[u] || '#888').attr('rx',1);
    leg.append('text').attr('x',16).attr('y', i*18+4)
      .attr('fill','var(--muted)').attr('font-family',"'DM Mono', monospace")
      .attr('font-size','9px').text(u);
  });

  // filter interaction
  filterRow.addEventListener('click', e => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    document.querySelectorAll('#road-user-filters .filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const selected = btn.dataset.user;

    svg.selectAll('.road-line')
      .transition().duration(300)
      .attr('opacity', ([u]) => selected === 'all' || u === selected ? 0.85 : 0.08)
      .attr('stroke-width', ([u]) => selected !== 'all' && u === selected ? 3.5 : 2);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// CHART 3 — Age Group Bar Chart with slider
// ─────────────────────────────────────────────────────────────────────────────
async function drawAge() {
  const raw = await d3.csv('assets/data/age_trend.csv', d => ({
    year: +d.year,
    age_group: d.age_group,
    hospitalisations: +d.hospitalisations
  }));

  const ageOrder = ['0-7','8-16','17-25','26-39','40-64','65-74','75+'];
  const id = 'chart-age';
  const W = getContainerWidth(id);
  const H = 380;
  const w = W - M.left - M.right;
  const h = H - M.top - M.bottom;

  const svg = d3.select(`#${id}`)
    .append('svg').attr('width', W).attr('height', H)
    .append('g').attr('transform', `translate(${M.left},${M.top})`);

  const x = d3.scaleBand().domain(ageOrder).range([0, w]).padding(0.25);
  const maxVal = d3.max(raw, d => d.hospitalisations);
  const y = d3.scaleLinear().domain([0, maxVal * 1.15]).range([h, 0]);

  svg.append('g').attr('class','grid')
    .call(d3.axisLeft(y).ticks(5).tickSize(-w).tickFormat(''));

  const bars = svg.selectAll('.age-bar').data(ageOrder).enter()
    .append('rect').attr('class','age-bar')
    .attr('x', d => x(d)).attr('width', x.bandwidth())
    .attr('y', h).attr('height', 0)
    .attr('fill', d => ageColors(d))
    .attr('rx', 2).style('cursor','pointer');

  svg.append('g').attr('class','axis').attr('transform',`translate(0,${h})`)
    .call(d3.axisBottom(x));
  svg.append('g').attr('class','axis')
    .call(d3.axisLeft(y).ticks(5).tickFormat(d => d3.format(',')(d)));
  svg.append('text').attr('transform','rotate(-90)').attr('x',-h/2).attr('y',-52)
    .attr('text-anchor','middle').attr('fill','var(--muted)')
    .attr('font-family',"'DM Mono', monospace").attr('font-size','11px')
    .text('Hospitalisations');

  function update(year) {
    document.getElementById('yearLabel').textContent = year;
    const yearData = raw.filter(d => d.year === year);
    const byAge = Object.fromEntries(yearData.map(d => [d.age_group, d.hospitalisations]));

    bars.data(ageOrder)
      .on('mousemove', (event, d) => showTooltip('tooltip-age',
        `<strong>${d}</strong><br/>${year}: ${fmt(byAge[d] || 0)}`, event))
      .on('mouseleave', () => hideTooltip('tooltip-age'))
      .transition().duration(500).ease(d3.easeCubicOut)
      .attr('y', d => y(byAge[d] || 0))
      .attr('height', d => h - y(byAge[d] || 0));
  }

  update(2021);
  document.getElementById('yearSlider').addEventListener('input', e => update(+e.target.value));
}

// ─────────────────────────────────────────────────────────────────────────────
// CHART 4 — State Stacked/Grouped Lines
// ─────────────────────────────────────────────────────────────────────────────
async function drawState() {
  const raw = await d3.csv('assets/data/state_trend.csv', d => ({
    year: +d.year,
    state: d.state,
    hospitalisations: +d.hospitalisations
  }));

  const states = [...new Set(raw.map(d => d.state))].sort();
  const stateColor = d3.scaleOrdinal()
    .domain(states)
    .range(['#4fc3f7','#f5a623','#81c784','#e8453c','#7986cb','#a1887f','#ff8a65','#ce93d8']);

  const id = 'chart-state';
  const W = getContainerWidth(id);
  const H = 400;
  const w = W - M.left - M.right;
  const h = H - M.top - M.bottom;

  const svg = d3.select(`#${id}`)
    .append('svg').attr('width', W).attr('height', H)
    .append('g').attr('transform', `translate(${M.left},${M.top})`);

  const x = d3.scaleLinear().domain([2011,2021]).range([0,w]);
  const y = d3.scaleLinear().domain([0, d3.max(raw, d=>d.hospitalisations)*1.2]).range([h,0]);

  svg.append('g').attr('class','grid')
    .call(d3.axisLeft(y).ticks(5).tickSize(-w).tickFormat(''));

  const grouped = d3.group(raw, d => d.state);
  const lineGen = d3.line().x(d=>x(d.year)).y(d=>y(d.hospitalisations)).curve(d3.curveCatmullRom);

  grouped.forEach((vals, state) => {
    const sorted = vals.sort((a,b)=>a.year-b.year);
    svg.append('path').datum(sorted)
      .attr('fill','none')
      .attr('stroke', stateColor(state))
      .attr('stroke-width', 2)
      .attr('opacity', 0.85)
      .attr('d', lineGen);

    // end label
    const last = sorted[sorted.length-1];
    svg.append('text')
      .attr('x', x(last.year)+6)
      .attr('y', y(last.hospitalisations)+4)
      .attr('fill', stateColor(state))
      .attr('font-family', "'DM Mono', monospace")
      .attr('font-size','10px')
      .text(state);

    sorted.forEach(d => {
      svg.append('circle')
        .attr('cx',x(d.year)).attr('cy',y(d.hospitalisations))
        .attr('r',4).attr('fill',stateColor(state)).attr('opacity',0)
        .style('cursor','pointer')
        .on('mousemove', event => showTooltip('tooltip-state',
          `<strong>${state}</strong><br/>${d.year}: ${fmt(d.hospitalisations)}`, event))
        .on('mouseenter', function(){ d3.select(this).attr('opacity',1); })
        .on('mouseleave', function(){ d3.select(this).attr('opacity',0); hideTooltip('tooltip-state'); });
    });
  });

  svg.append('g').attr('class','axis').attr('transform',`translate(0,${h})`)
    .call(d3.axisBottom(x).ticks(11).tickFormat(d3.format('d')));
  svg.append('g').attr('class','axis')
    .call(d3.axisLeft(y).ticks(5).tickFormat(d=>d3.format(',')(d)));
  svg.append('text').attr('transform','rotate(-90)').attr('x',-h/2).attr('y',-52)
    .attr('text-anchor','middle').attr('fill','var(--muted)')
    .attr('font-family',"'DM Mono', monospace").attr('font-size','11px')
    .text('Hospitalisations');
}

// ─────────────────────────────────────────────────────────────────────────────
// CHART 5 — First Nations vs Non-Indigenous
// ─────────────────────────────────────────────────────────────────────────────
async function drawFirstNations() {
  const raw = await d3.csv('assets/data/first_nations_trend.csv', d => ({
    year: +d.year,
    fn_status: d.fn_status,
    hospitalisations: +d.hospitalisations
  }));

  const fn   = raw.filter(d => d.fn_status === 'First Nations people').sort((a,b)=>a.year-b.year);
  const noni = raw.filter(d => d.fn_status === 'Non-Indigenous').sort((a,b)=>a.year-b.year);

  const id = 'chart-fn';
  const W = getContainerWidth(id);
  const H = 400;
  const w = W - M.left - M.right;
  const h = H - M.top - M.bottom;

  const svg = d3.select(`#${id}`)
    .append('svg').attr('width', W).attr('height', H)
    .append('g').attr('transform', `translate(${M.left},${M.top})`);

  const x = d3.scaleLinear().domain([2011,2021]).range([0,w]);

  // dual y axes
  const yL = d3.scaleLinear().domain([0, d3.max(noni, d=>d.hospitalisations)*1.2]).range([h,0]);
  const yR = d3.scaleLinear().domain([0, d3.max(fn, d=>d.hospitalisations)*1.2]).range([h,0]);

  svg.append('g').attr('class','grid')
    .call(d3.axisLeft(yL).ticks(5).tickSize(-w).tickFormat(''));

  const lineGen = scale => d3.line().x(d=>x(d.year)).y(d=>scale(d.hospitalisations)).curve(d3.curveCatmullRom);

  // Non-Indigenous
  svg.append('path').datum(noni)
    .attr('fill','none').attr('stroke','var(--nonindig)').attr('stroke-width',2.5)
    .attr('d', lineGen(yL));

  // First Nations (right axis)
  svg.append('path').datum(fn)
    .attr('fill','none').attr('stroke','var(--fn-color)').attr('stroke-width',2.5)
    .attr('d', lineGen(yR));

  // dots + tooltips
  [[fn, yR, 'var(--fn-color)', 'First Nations people'],
   [noni, yL, 'var(--nonindig)', 'Non-Indigenous']].forEach(([data, scale, col, label]) => {
    data.forEach(d => {
      svg.append('circle')
        .attr('cx',x(d.year)).attr('cy',scale(d.hospitalisations))
        .attr('r',5).attr('fill',col).attr('stroke','#0d0f14').attr('stroke-width',2)
        .style('cursor','pointer')
        .on('mousemove', event => showTooltip('tooltip-fn',
          `<strong>${label}</strong><br/>${d.year}: ${fmt(d.hospitalisations)}`, event))
        .on('mouseleave', () => hideTooltip('tooltip-fn'));
    });
  });

  // axes
  svg.append('g').attr('class','axis').attr('transform',`translate(0,${h})`)
    .call(d3.axisBottom(x).ticks(11).tickFormat(d3.format('d')));
  svg.append('g').attr('class','axis')
    .call(d3.axisLeft(yL).ticks(5).tickFormat(d=>d3.format(',')(d)));
  svg.append('g').attr('class','axis').attr('transform',`translate(${w},0)`)
    .call(d3.axisRight(yR).ticks(5).tickFormat(d=>d3.format(',')(d)));

  // left y label
  svg.append('text').attr('transform','rotate(-90)').attr('x',-h/2).attr('y',-52)
    .attr('text-anchor','middle').attr('fill','var(--nonindig)')
    .attr('font-family',"'DM Mono', monospace").attr('font-size','10px')
    .text('Non-Indigenous hospitalisations');

  // right y label
  svg.append('text').attr('transform','rotate(90)').attr('x',h/2).attr('y',-(w+52))
    .attr('text-anchor','middle').attr('fill','var(--fn-color)')
    .attr('font-family',"'DM Mono', monospace").attr('font-size','10px')
    .text('First Nations hospitalisations');

  // legend
  const leg = svg.append('g').attr('transform',`translate(${w/2 - 180}, ${h - 30})`);
  [['First Nations people','var(--fn-color)'],['Non-Indigenous','var(--nonindig)']].forEach(([lbl,col],i) => {
    leg.append('rect').attr('x',i*190).attr('y',0).attr('width',12).attr('height',3).attr('fill',col).attr('rx',1);
    leg.append('text').attr('x',i*190+18).attr('y',5)
      .attr('fill','var(--muted)').attr('font-family',"'DM Mono', monospace").attr('font-size','10px').text(lbl);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// STICKY NAV HIGHLIGHT
// ─────────────────────────────────────────────────────────────────────────────
function initNav() {
  const sections = document.querySelectorAll('.chapter');
  const navLinks = document.querySelectorAll('.nav-link');

  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        navLinks.forEach(l => l.classList.remove('active'));
        const active = document.querySelector(`.nav-link[href="#${e.target.id}"]`);
        if (active) active.classList.add('active');
      }
    });
  }, { threshold: 0.4 });

  sections.forEach(s => obs.observe(s));
}

// ─────────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────────
(async function init() {
  await Promise.all([
    drawTrend(),
    drawRoadUser(),
    drawAge(),
    drawState(),
    drawFirstNations()
  ]);
  initNav();
})();