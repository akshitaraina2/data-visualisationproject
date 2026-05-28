const fmt     = d3.format(",");
const fmtRate = d3.format(".1f");

// Column name for hospitalisation count in all KNIME exports
const HOSPS = 'Sum(hospitalisations)';

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

// Colours keyed to full ABS road-user strings (state files) and shorter
// labels used in national crossed exports — same colour family per type.
const roadUserColors = {
  // Full ABS labels (state-track files)
  'Car driver, passenger or unknown position':             '#4fc3f7',
  'Motorcyclist':                                          '#f5a623',
  'Pedal cyclist':                                         '#81c784',
  'Pedestrian':                                            '#e8453c',
  'Bus occupant':                                          '#a1887f',
  'Pick-up truck or van occupant':                         '#4db6ac',
  'Heavy transport driver, passenger or unknown position': '#ff8a65',
  'Other or unknown':                                      '#b0bec5',
  // Short labels (national-track crossed files)
  'Car driver':                       '#4fc3f7',
  'Car passenger':                    '#4fc3f7',
  'Car unknown position':             '#4fc3f7',
  'Heavy transport driver':           '#ff8a65',
  'Heavy transport passenger':        '#ff8a65',
  'Heavy transport unknown position': '#ff8a65',
};

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

// Demographic order for age groups (matches actual KNIME export values)
const AGE_ORDER = ['0-7', '8-16', '17-25', '26-39', '40-64', '65+'];

const REMOTENESS_ORDER = ['Major Cities', 'Regional', 'Remote'];

const ageColors = d3.scaleOrdinal()
  .domain(AGE_ORDER)
  .range(['#b3e5fc', '#4fc3f7', '#f5a623', '#e8453c', '#81c784', '#7986cb']);

// Maps GeoJSON STATE_NAME → CSV state abbreviation
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

const M = { top: 30, right: 30, bottom: 45, left: 65 };

function num(v) {
  if (v === undefined || v === null) return 0;
  const s = String(v).trim();
  if (s === '' || s === 'n.p.' || s === 'np' || s === 'NP' || s === 'Missing') return 0;
  const n = +s;
  return Number.isFinite(n) ? n : 0;
}

function getContainerWidth(id) {
  const el = document.getElementById(id);
  return el ? el.getBoundingClientRect().width || 800 : 800;
}

function showTooltip(tooltipId, html, event) {
  const tip = document.getElementById(tooltipId);
  if (!tip) return;
  tip.innerHTML = html;
  tip.style.opacity = 1;
  const container = tip.parentElement.getBoundingClientRect();
  tip.style.left = (event.clientX - container.left + 14) + 'px';
  tip.style.top  = (event.clientY - container.top  - 10) + 'px';
}

function hideTooltip(tooltipId) {
  const tip = document.getElementById(tooltipId);
  if (tip) tip.style.opacity = 0;
}
