// ── FORMATTERS ───────────────────────────────────────────────────────────
// fmt: comma-separated integer counts (e.g. 12,345) used on all count axes and tooltips.
// fmtRate: one decimal place for per-100k rates used in choropleth tooltips.
const fmt     = d3.format(",");
const fmtRate = d3.format(".1f");

// Exact column name in all KNIME exports — access via this constant, never hardcode.
const HOSPS = 'Sum(hospitalisations)';

// Centralised file paths for all data files — draw functions reference DATA.key,
// never hardcode paths, so paths can be updated in one place.
const DATA = {
  stateRoadUser:     'data/state-track/state_x_road_user.csv',
  stateAnnualTotals: 'data/state-track/state_annual_totals.csv',
  stateCounterparty: 'data/state-track/state_x_counterparty.csv',
  fnByAge:           'data/fn-track/fn_by_age.csv',
  fnByRoadUser:      'data/fn-track/fn_by_road_user.csv',
  fnByRemoteness:    'data/fn-track/fn_by_remoteness.csv',
  fnByCounterparty:  'data/fn-track/fn_by_counterparty.csv',
  nationalAq2:       'data/national-track/national_crossed_aq2.csv',
  nationalAq4:       'data/national-track/national_crossed_aq4.csv',
  geojson:           'data/australia.geojson',
  population:        'data/abs_population_by_state.csv',
};

// Wong (2011) colorblind-safe palette — avoids red/green pairing that causes
// confusion under deuteranopia (most common deficiency). All hex values
// verified ≥3:1 contrast against the dark chart surface (#13161e).
const roadUserColors = {
  // Full ABS labels (state-track files)
  'Car driver, passenger or unknown position':             '#56B4E9', // sky blue    — 8.4:1 on surface
  'Motorcyclist':                                          '#E69F00', // amber       — 7.7:1
  'Pedal cyclist':                                         '#009E73', // blue-green  — 5.6:1  (prev #81c784 green, changed: avoids red/green pair)
  'Pedestrian':                                            '#CC79A7', // purple-pink — 6.3:1  (prev #e8453c red, changed: not confused with green under deuteranopia)
  'Bus occupant':                                          '#a1887f', // warm brown  — 5.9:1
  'Pick-up truck or van occupant':                         '#4db6ac', // teal        — 8.0:1
  'Heavy transport driver, passenger or unknown position': '#D55E00', // vermilion   — 5.0:1
  'Other or unknown':                                      '#b0bec5', // neutral grey — 10.2:1
  // Short labels (national-track crossed files) — same colour family
  'Car driver':                       '#56B4E9',
  'Car passenger':                    '#56B4E9',
  'Car unknown position':             '#56B4E9',
  'Heavy transport driver':           '#D55E00',
  'Heavy transport passenger':        '#D55E00',
  'Heavy transport unknown position': '#D55E00',
};

// Maps full ABS road user label to a shorter display label for axis ticks and legends.
const roadUserShort = {
  'Car driver, passenger or unknown position':             'Car occupant',
  'Motorcyclist':                                          'Motorcyclist',
  'Pedal cyclist':                                         'Pedal cyclist',
  'Pedestrian':                                            'Pedestrian',
  'Bus occupant':                                          'Bus occupant',
  'Pick-up truck or van occupant':                         'Pick-up / van',
  'Heavy transport driver, passenger or unknown position': 'Heavy transport',
  'Other or unknown':                                      'Other / unknown',
};

// Canonical sort order for age groups — used to ensure consistent axis ordering.
const AGE_ORDER = ['0-7', '8-16', '17-25', '26-39', '40-64', '65+'];

const REMOTENESS_ORDER = ['Major Cities', 'Regional', 'Remote'];

const ageColors = d3.scaleOrdinal()
  .domain(AGE_ORDER)
  .range(['#b3e5fc', '#4fc3f7', '#f5a623', '#e8453c', '#81c784', '#7986cb']);

// Maps GeoJSON STATE_NAME strings to the uppercase state abbreviations used in CSV files.
const STATE_ABBR = {
  'New South Wales':              'NSW',
  'Victoria':                     'VIC',
  'Queensland':                   'QLD',
  'South Australia':              'SA',
  'Western Australia':            'WA',
  'Tasmania':                     'TAS',
  'Northern Territory':           'NT',
  'Australian Capital Territory': 'ACT',
};

// Shared SVG margin object used by all draw functions for consistent chart padding.
const M = { top: 30, right: 30, bottom: 45, left: 65 };

// Parses a raw KNIME export cell value: treats n.p. (suppressed), blank, "Missing",
// and non-finite numbers as 0 so they don't propagate NaN into aggregations.
function num(v) {
  if (v === undefined || v === null) return 0;
  const s = String(v).trim();
  if (s === '' || s === 'n.p.' || s === 'np' || s === 'NP' || s === 'Missing') return 0;
  const n = +s;
  return Number.isFinite(n) ? n : 0;
}

// Returns the pixel width of a container element by ID, falling back to 800 if the
// element is missing or reports zero — used to size SVGs responsively.
function getContainerWidth(id) {
  const el = document.getElementById(id);
  return el ? el.getBoundingClientRect().width || 800 : 800;
}

// Positions and shows the tooltip <div> for the given chart. Offsets from the
// container's top-left corner so the tooltip stays inside the scroll parent.
function showTooltip(tooltipId, html, event) {
  const tip = document.getElementById(tooltipId);
  if (!tip) return;
  tip.innerHTML = html;
  tip.style.opacity = 1;
  const container = tip.parentElement.getBoundingClientRect();
  tip.style.left = (event.clientX - container.left + 14) + 'px';
  tip.style.top  = (event.clientY - container.top  - 10) + 'px';
}

// Hides the tooltip <div> by setting opacity to 0 (not display:none, to avoid layout shift).
function hideTooltip(tooltipId) {
  const tip = document.getElementById(tooltipId);
  if (tip) tip.style.opacity = 0;
}
