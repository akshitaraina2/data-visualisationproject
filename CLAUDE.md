# Road Crash Hospitalisations — Group 9 (COS30045)

Single-page scrollytelling site visualising 2011–2021 Australian road crash hospitalisation data.
Stack: plain HTML / CSS / JavaScript + D3.js v7 (CDN). No framework, no build step.

## File Structure

```
index.html                       # Hero, 5 chapter sections (4 AQs + conclusion), sticky nav
assets/css/style.css             # Layout, typography, scroll, responsive
assets/js/main.js                # Entry point: load all files, call draw functions
assets/js/charts/aq1.js          # drawTrend, drawStackedArea
assets/js/charts/aq2.js          # drawHeatmap, drawSexRoadUser, drawPyramid
assets/js/charts/aq3.js          # drawChoropleth, drawFirstNationsSlope, drawRemoteness
assets/js/charts/aq4.js          # drawSankey, drawCounterpartyBar
assets/js/constants.js           # Shared colours, margins, formatters, DATA paths — single source of truth
data/state-track/                # State-level KNIME exports
data/fn-track/                   # First Nations KNIME exports
data/national-track/             # National-level KNIME exports (crossed dimensions)
data/australia.geojson           # ABS ASGS state boundaries for choropleth
data/abs_population_by_state.csv # ABS population denominators for per-100k rates
```

## Data Files

All files in `data/` are KNIME-processed exports. Reference via the `DATA` object in `constants.js` — never hardcode paths in draw functions.

| File | DATA key | Used by |
| --- | --- | --- |
| `data/state-track/state_x_road_user.csv` | `DATA.stateRoadUser` | `drawTrend`, `drawStackedArea` |
| `data/state-track/state_annual_totals.csv` | `DATA.stateAnnualTotals` | `drawChoropleth`, hero statistic |
| `data/state-track/state_x_counterparty.csv` | `DATA.stateCounterparty` | `drawCounterpartyBar` |
| `data/fn-track/fn_by_age.csv` | `DATA.fnByAge` | `drawFirstNationsSlope` |
| `data/fn-track/fn_by_road_user.csv` | `DATA.fnByRoadUser` | `drawFirstNationsSlope` |
| `data/fn-track/fn_by_remoteness.csv` | `DATA.fnByRemoteness` | `drawRemoteness` |
| `data/fn-track/fn_by_counterparty.csv` | `DATA.fnByCounterparty` | (unused currently) |
| `data/national-track/national_crossed_aq2.csv` | `DATA.nationalAq2` | `drawHeatmap`, `drawSexRoadUser`, `drawPyramid` |
| `data/national-track/national_crossed_aq4.csv` | `DATA.nationalAq4` | `drawSankey` |
| `data/australia.geojson` | `DATA.geojson` | `drawChoropleth` |
| `data/abs_population_by_state.csv` | `DATA.population` | `drawChoropleth` |

## Standardised Column Names

| Column | Type | Notes |
| --- | --- | --- |
| `year` | Integer | |
| `state` | String — **all uppercase** | `NSW`, `VIC`, `QLD`, `SA`, `WA`, `TAS`, `NT`, `ACT` |
| `road_user` | String | Full ABS label in state-track; short label in national-track |
| `age_group` | String | Values: `0-7`, `8-16`, `17-25`, `26-39`, `40-64`, `65+` |
| `sex` | String | |
| `remoteness` | String | Values: `Major Cities`, `Regional`, `Remote` |
| `counterparty` | String | |
| `indigenous_status` | String | `First Nations` / `Non-Indigenous` |
| `Sum(hospitalisations)` | Integer | **Actual column name in all exports** — use `HOSPS` constant |
| `Sum(bed_days)` | Integer | State-track files only |

**Critical:** The hospitalisation count column is named `Sum(hospitalisations)` in all KNIME exports. Always access it via the `HOSPS` constant defined in `constants.js`.

**State casing:** state abbreviations are all uppercase. Any hardcoded state name or join key must use uppercase (`QLD` not `Qld`, `TAS` not `Tas`, `VIC` not `Vic`).

## Data Pipeline Rules

- Load all files in parallel via `Promise.all()` in `main.js`. Draw functions only run once all files resolve.
- Use the shared `num()` parser: `n.p.`, blank, and `Missing` → `0`. Never let NaN enter an aggregation.
- `n.p.` (suppressed First Nations cells) must be visually flagged as "data suppressed" (grey hatching + legend item). Do not silently zero them.
- The national total is **derived** by summing all 8 states per year from `state_x_road_user.csv` — there is no national row.
- State rates = `(annual count / ABS population) × 100,000`. Denominators in `abs_population_by_state.csv`.
- `drawChoropleth` takes 4 arguments: `(stateData, population, geojson, containerSelector)`.

## Shared Constants (assets/js/constants.js)

Never redefine these inside a draw function.

| Constant | Purpose |
| --- | --- |
| `HOSPS` | `'Sum(hospitalisations)'` — the exact column name in all KNIME exports |
| `DATA` | Object with all file paths keyed by logical name |
| `roadUserColors` | Fixed colour per road-user label (Wong 2011 colorblind-safe palette). Keys cover both full ABS labels (state-track) and short labels (national-track). |
| `roadUserShort` | Maps full ABS road-user label → short display label |
| `AGE_ORDER` | `['0-7', '8-16', '17-25', '26-39', '40-64', '65+']` — canonical sort order |
| `REMOTENESS_ORDER` | `['Major Cities', 'Regional', 'Remote']` |
| `ageColors` | `d3.scaleOrdinal` keyed to `AGE_ORDER` |
| `STATE_ABBR` | Maps GeoJSON `STATE_NAME` → CSV state abbreviation (e.g. `'Victoria'` → `'VIC'`) |
| `M` | Shared margin object `{ top: 30, right: 30, bottom: 45, left: 65 }` |
| `fmt` | `d3.format(",")` — all counts on axes and tooltips |
| `fmtRate` | `d3.format(".1f")` — per-100k rates in choropleth tooltips |
| `num(v)` | Parser: returns 0 for `n.p.`, blank, `Missing`, non-finite |
| `getContainerWidth(id)` | Returns element width or 800 fallback |
| `showTooltip(id, html, event)` | Positions and shows a `.chart-tooltip` element |
| `hideTooltip(id)` | Hides a `.chart-tooltip` element |

## Draw Function Contract

```js
function drawX(data, containerSelector) { ... }
// Exception: drawChoropleth(stateData, population, geojson, containerSelector)
```

- Receives prepared data slice + CSS selector. Does not fetch or aggregate.
- Reads from constants — never redefines `roadUserColors`, `M`, `fmt`, `fmtRate`, `HOSPS` locally.
- Appends one `<svg>` to container, sized responsively via `getContainerWidth()`.
- Every axis must have a title and units. No unlabelled axes.
- SVG includes `role="graphics-document"` and `aria-labelledby` pointing to a `<title>` element.

## Chart Inventory

All blockers resolved. All charts are built and active.

### AQ1 — The Big Picture (`assets/js/charts/aq1.js`)

| Function | Type | Data source | Encodes |
| --- | --- | --- | --- |
| `drawTrend` | Multi-series line | `state_x_road_user.csv` | Annual hospitalisations per road user 2011–2021; national total as bold line |
| `drawStackedArea` | Stacked area | `state_x_road_user.csv` | Road user composition over time |

Both AQ1 charts show:
- Dashed vertical line at 2012 (Victoria policy break) with tooltip — shared helper `_addPolicyLines()`
- Dashed vertical line at 2017 (NSW policy break) with tooltip
- Inline label at 2020 dip: "COVID-19 mobility restrictions"
- Road user filter buttons (`#aq1-filters`), added once by `drawTrend`, shared with `drawStackedArea`

### AQ2 — Who Is Affected (`assets/js/charts/aq2.js`)

| Function | Type | Data source | Encodes |
| --- | --- | --- | --- |
| `drawHeatmap` | Heatmap | `national_crossed_aq2.csv` | Age group × road user; colour = count (5-step quantile blues) |
| `drawSexRoadUser` | Grouped bar | `national_crossed_aq2.csv` | Male vs female per road user category |
| `drawPyramid` | Population pyramid | `national_crossed_aq2.csv` | Age-sex distribution; male left, female right |

### AQ3 — Where It Happens (`assets/js/charts/aq3.js`)

| Function | Type | Data source | Encodes |
| --- | --- | --- | --- |
| `drawChoropleth` | Choropleth map | `state_annual_totals.csv` + `abs_population_by_state.csv` + `australia.geojson` | Average annual hospitalisations per 100,000 by state; sequential Oranges scale |
| `drawFirstNationsSlope` | Dual-axis line | `fn_by_age.csv` + `fn_by_road_user.csv` | First Nations vs non-Indigenous trend |
| `drawRemoteness` | Small multiples line | `fn_by_remoteness.csv` | Trend by remoteness area for both groups |

Choropleth uses `d3.geoMercator().fitSize()`. Colour encodes **average annual rate**, not raw count.

### AQ4 — How It Happens (`assets/js/charts/aq4.js`)

| Function | Type | Data source | Encodes |
| --- | --- | --- | --- |
| `drawSankey` | Sankey diagram | `national_crossed_aq4.csv` | Road user → counterparty flow; link width = count. Requires d3-sankey CDN plugin; renders fallback `<p>` if plugin absent. |
| `drawCounterpartyBar` | Stacked bar (time) | `state_x_counterparty.csv` | Counterparty type counts over time |

## Page Order

```
Hero (static)
  → Ch.1 (#chapter1) AQ1: drawTrend + drawStackedArea
  → Ch.2 (#chapter2) AQ2: drawHeatmap + drawSexRoadUser + drawPyramid
  → Ch.3 (#chapter3) AQ3: drawChoropleth + drawFirstNationsSlope + drawRemoteness
  → Ch.4 (#chapter4) AQ4: drawSankey + drawCounterpartyBar
  → Ch.5 (#chapter5) Conclusion (static): key findings, caveats, attribution
```

## Interaction Rules

- Tooltips on hover: label + `fmt` count or `fmtRate` rate, via `showTooltip()` / `hideTooltip()`.
- Hover highlight: focused mark keeps colour; others dim to 20% opacity. Layout must not shift.
- Scroll-driven reveal: fade + slight upward translate as chapter enters viewport.
- Road user filter (AQ1): toggle buttons in `#aq1-filters`; filters both AQ1 charts in sync.
- Sankey hover: highlights full flow path; dims other flows.
- **Every interaction must change the marks themselves.** Do not respond with only a text or axis update.

## Data Caveats (must appear in the UI, not just the design book)

| Caveat | Where |
| --- | --- |
| Victoria 2012 series break (est. −5.6%) | Dashed line + tooltip on AQ1 charts |
| NSW 2017 series break | Dashed line + tooltip on AQ1 charts |
| 2020 COVID dip is mobility, not safety | Inline label on AQ1 charts |
| Choropleth shows rates, not raw counts | Footnote on choropleth |
| First Nations `n.p.` suppression | Grey hatching + legend item |
| Counterparty "Other/unspecified" may be large | Footnote on AQ4 charts |
| Remoteness = residence, not crash location | Footnote on AQ3 remoteness |
| Hero stat is state-attributable only; true national total is 410,884 | Footnote below hero stat |

## Team

| Owner | Responsibilities |
| --- | --- |
| Rusham | All draw functions + front-end. |
| Vinh | Design book, conclusion copy, Week 12 stand-up. |
