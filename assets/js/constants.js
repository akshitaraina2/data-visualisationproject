// ─────────────────────────────────────────────────────────────────────────────
// constants.js — Shared constants, colour scales, and utility functions.
// Single source of truth used by all chart modules.
// Must be loaded before any chart file in index.html.
// ─────────────────────────────────────────────────────────────────────────────


// ── NUMBER FORMATTER ─────────────────────────────────────────────────────────
// d3.format(",") adds thousands separators (e.g. 12345 → "12,345").
const fmt     = d3.format(",");
const fmtRate = d3.format(".1f"); // one decimal for per-100k rates


// ── DATA FILE PATHS ───────────────────────────────────────────────────────────
// All paths are relative to index.html (project root).
const DATA = {
  state:        'data/state_territory/state_territory_1_by_state_and_territory.csv',
  roadUser:     'data/state_territory/state_territory_2_territory_and_road_user.csv',
  age:          'data/state_territory/state_territory_4_territory_and_age_group.csv',
  firstNations: 'data/first_nations/first_nations_1_injuries_from_road_crashes.csv',
};

// Column name shared by all state_territory files for the case count.
const ST_COUNT = 'count of cases excluding died in hospitals within 30 days';


// ── COLOUR SCALES ─────────────────────────────────────────────────────────────
// Keys must exactly match the full ABS road-user label strings used in KNIME exports.
// Changing a key here breaks every chart that reads roadUserColors.
const roadUserColors = {
  'Car driver, passenger or unknown position':            '#4fc3f7',
  'Motorcyclist':                                         '#f5a623',
  'Pedal cyclist':                                        '#81c784',
  'Pedestrian':                                           '#e8453c',
  'Bus occupant':                                         '#a1887f',
  'Pick-up truck or van occupant':                        '#4db6ac',
  'Heavy transport driver, passenger or unknown position':'#ff8a65',
  'Other or unknown':                                     '#b0bec5',
};

// Shortened display labels used in legends and filter buttons.
// Full ABS labels are too long to fit in UI elements.
const roadUserShort = {
  'Car driver, passenger or unknown position':            'Car occupant',
  'Motorcyclist':                                         'Motorcyclist',
  'Pedal cyclist':                                        'Pedal cyclist',
  'Pedestrian':                                           'Pedestrian',
  'Bus occupant':                                         'Bus occupant',
  'Pick-up truck or van occupant':                        'Pick-up / van',
  'Heavy transport driver, passenger or unknown position':'Heavy transport',
  'Other or unknown':                                     'Other / unknown',
};

// Age groups in demographic order (not alphabetical).
const AGE_ORDER = ['0-7', '8-16', '17-25', '26-39', '40-64', '65-74', '75+'];

const ageColors = d3.scaleOrdinal()
  .domain(AGE_ORDER)
  .range(['#b3e5fc', '#4fc3f7', '#f5a623', '#e8453c', '#81c784', '#7986cb', '#ce93d8']);


// ── SHARED MARGIN ─────────────────────────────────────────────────────────────
// Standard chart margins used by all draw functions.
const M = { top: 30, right: 30, bottom: 45, left: 65 };


// ── UTILITY FUNCTIONS ─────────────────────────────────────────────────────────

/**
 * Parses a raw count cell from a CSV row.
 * KNIME suppresses small cell counts as "n.p." (not published) to protect privacy.
 * Blank strings and "Missing" values also appear in exports. All are treated as 0
 * so that d3.sum() and d3.rollup() aggregations remain valid numbers.
 */
function num(v) {
  if (v === undefined || v === null) return 0;
  const s = String(v).trim();
  if (s === '' || s === 'n.p.' || s === 'np' || s === 'NP' || s === 'Missing') return 0;
  const n = +s;
  return Number.isFinite(n) ? n : 0;
}

/** Returns the pixel width of a DOM element by id. */
function getContainerWidth(id) {
  return document.getElementById(id).getBoundingClientRect().width;
}


// ── TOOLTIP HELPERS ───────────────────────────────────────────────────────────
// Tooltip elements are defined in index.html inside each chart container.
// Positioning is relative to the parent container, not the viewport,
// so tooltips don't overflow when charts are inside constrained columns.

function showTooltip(tooltipId, html, event) {
  const tip = document.getElementById(tooltipId);
  tip.innerHTML = html;
  tip.style.opacity = 1;
  positionTooltip(tooltipId, event);
}

function positionTooltip(tooltipId, event) {
  const tip       = document.getElementById(tooltipId);
  const container = tip.parentElement.getBoundingClientRect();
  const x         = event.clientX - container.left + 12;
  const y         = event.clientY - container.top  - 10;
  tip.style.left  = x + 'px';
  tip.style.top   = y + 'px';
}

function hideTooltip(tooltipId) {
  document.getElementById(tooltipId).style.opacity = 0;
}
