# Road Crash Hospitalisations — Group 9 (COS30045)

Single-page scrollytelling site visualising 2011–2021 Australian road crash hospitalisation data.
Stack: plain HTML / CSS / JavaScript + D3.js v7 (CDN). No framework, no build step.

## File Structure

```
index.html                  # Hero, 6 chapter sections (4 AQs + conclusion), sticky nav
css/style.css               # Layout, typography, scroll, responsive
js/main.js                  # Entry point: load all files, aggregate, call draw functions
js/charts/aq1.js            # drawTrend, drawStackedArea
js/charts/aq2.js            # drawHeatmap, drawSexRoadUser, drawPyramid  (BLOCKED)
js/charts/aq3.js            # drawChoropleth, drawFirstNationsSlope, drawRemoteness
js/charts/aq4.js            # drawSankey (BLOCKED), drawCounterpartyBar
js/constants.js             # Shared colours, margins, formatters — single source of truth
data/*.csv                  # KNIME exports; no intermediate tidy files
data/australia.geojson      # ABS ASGS state boundaries for choropleth
data/abs_population_by_state.csv  # ABS population denominators for per-100k rates
```

## Data Files

All files in `data/` are KNIME-processed exports. Do not load the original raw source filenames — they no longer apply.

| File | Used by |
| --- | --- |
| `state_x_road_user.csv` | `drawTrend`, `drawStackedArea` |
| `state_annual_totals.csv` | `drawChoropleth`, hero statistic |
| `state_x_counterparty.csv` | `drawCounterpartyBar` |
| `fn_by_age.csv` | `drawFirstNationsSlope` |
| `fn_by_road_user.csv` | `drawFirstNationsSlope` |
| `fn_by_remoteness.csv` | `drawRemoteness` |
| `fn_by_counterparty.csv` | `drawSankey` (blocked) |
| `national_crossed_aq2.csv` | `drawHeatmap`, `drawSexRoadUser`, `drawPyramid` (Blocker 1 — not yet available) |
| `national_crossed_aq4.csv` | `drawSankey` (Blocker 1 — not yet available) |
| `australia.geojson` | `drawChoropleth` |
| `abs_population_by_state.csv` | `drawChoropleth` (Blocker 2 — not yet available) |

**Note on `first_nations_3`:** this file is byte-for-byte identical to `first_nations_1` and has been removed. Use `fn_by_age.csv` for all First Nations age breakdowns.

## Standardised Column Names

All KNIME exports use these column names. Reference them exactly in every draw function and aggregation.

| Column | Type |
| --- | --- |
| `year` | Integer |
| `half_year` | String (`Jan-Jun` / `Jul-Dec`) |
| `state` | String — **all uppercase** (`NSW`, `VIC`, `QLD`, `SA`, `WA`, `TAS`, `NT`, `ACT`) |
| `hospitalisations` | Integer (missing where suppressed as `n.p.`) |
| `bed_days` | Integer |
| `road_user` | String |
| `age_group` | String |
| `sex` | String |
| `remoteness` | String |
| `counterparty` | String |
| `indigenous_status` | String (`First Nations` / `Non-Indigenous`) |

**State casing:** state abbreviations are all uppercase in the KNIME exports. Any hardcoded state name or join key must use uppercase (`QLD` not `Qld`, `TAS` not `Tas`, `VIC` not `Vic`).

## Data Pipeline Rules

- Load all files in parallel via `Promise.all()`. Draw functions only run once all files resolve.
- Use the shared `num()` parser: `n.p.`, blank, and `Missing` → `0`. Never let NaN enter an aggregation.
- `n.p.` (suppressed First Nations cells) must be visually flagged as "data suppressed" (grey hatching + legend item). Do not silently zero them.
- Use `d3.rollup()` to sum `half_year` halves into annual totals where the source file is 6-monthly.
- The national total is **derived** by summing all 8 states per year from `state_x_road_user.csv` — there is no national row.
- State rates = `(annual count / ABS population) × 100,000`. Store denominators in `abs_population_by_state.csv`.

## Shared Constants (js/constants.js)

Never redefine these inside a draw function.

| Constant | Purpose |
| --- | --- |
| `roadUserColors` | Fixed colour per road-user label (keyed to full ABS strings). Never changes between charts. |
| `M` | Shared margin object `{ top, right, bottom, left }`. |
| `fmt` | `d3.format(",")` — all counts on axes and tooltips. |
| `fmtRate` | `d3.format(".1f")` — per-100k rates in choropleth tooltips. |

## Draw Function Contract

```js
function drawX(data, containerSelector) { ... }
```

- Receives prepared data slice + CSS selector. Does not fetch or aggregate.
- Reads from `roadUserColors`, `M`, `fmt` / `fmtRate`. Never redefines locally.
- Appends one `<svg>` (or `<div>` for Sankey) to container, sized responsively.
- Every axis must have a title and units. No unlabelled axes.
- **Renders a visible empty state** if required data is absent (blocked charts must still render a placeholder).

## Chart Inventory

### AQ1 — The Big Picture (build now)

| Function | Type | Data source | Encodes |
| --- | --- | --- | --- |
| `drawTrend` | Multi-series line | `state_x_road_user.csv` | Annual hospitalisations per road user 2011–2021; national total as bold line derived by summing all states |
| `drawStackedArea` | Stacked area | `state_x_road_user.csv` | Road user composition over time |

Both AQ1 charts must show:
- Dashed vertical line at 2012 (Victoria policy break) with tooltip
- Dashed vertical line at 2017 (NSW policy break) with tooltip
- Inline label at 2020 dip: "COVID-19 mobility restrictions"

### AQ2 — Who Is Affected (blocked by Blocker 1)

| Function | Type | Data source | Encodes |
| --- | --- | --- | --- |
| `drawHeatmap` | Heatmap | `national_crossed_aq2.csv` | Age group × road user; colour = count |
| `drawSexRoadUser` | Grouped bar | `national_crossed_aq2.csv` | Male vs female per road user category |
| `drawPyramid` | Population pyramid | `national_crossed_aq2.csv` | Age-sex distribution; male left, female right |

### AQ3 — Where It Happens (build now, choropleth blocked by Blocker 2)

| Function | Type | Data source | Encodes |
| --- | --- | --- | --- |
| `drawChoropleth` | Choropleth map | `state_annual_totals.csv` + `abs_population_by_state.csv` + `australia.geojson` | Hospitalisations per 100,000 by state; sequential colour scale |
| `drawFirstNationsSlope` | Slope / diverging bar | `fn_by_age.csv` + `fn_by_road_user.csv` | First Nations vs non-Indigenous trend; highlights doubling vs ~15% growth |
| `drawRemoteness` | Small multiples line | `fn_by_remoteness.csv` | Trend by remoteness area for both groups |

Choropleth uses `d3.geoMercator()` or `d3.geoAlbers()` fit to SVG container. Colour encodes **rate**, not raw count.

### AQ4 — How It Happens (drawCounterpartyBar now; drawSankey blocked by Blocker 1)

| Function | Type | Data source | Encodes |
| --- | --- | --- | --- |
| `drawSankey` | Sankey diagram | `national_crossed_aq4.csv` | Road user → counterparty flow; link width = count |
| `drawCounterpartyBar` | Grouped bar (time) | `state_x_counterparty.csv` | Counterparty type counts over time |

## Page Order

```
Hero (static)
  → Ch.1 AQ1: drawTrend + drawStackedArea
  → Ch.2 AQ2: drawHeatmap + drawSexRoadUser + drawPyramid  [BLOCKED]
  → Ch.3 AQ3: drawChoropleth + drawFirstNationsSlope + drawRemoteness
  → Ch.4 AQ4: drawSankey [BLOCKED] + drawCounterpartyBar
  → Ch.5 Conclusion (static): key findings, caveats, attribution
```

## Interaction Rules

- Tooltips on hover: label + `fmt` count or `fmtRate` rate.
- Hover highlight: focused mark keeps colour; others dim to 20% opacity. Layout must not shift.
- Scroll-driven reveal: fade + slight upward translate as chapter enters viewport.
- Road user filter (AQ1): toggle buttons; filters both AQ1 charts in sync.
- Sex toggle (AQ2): male / female / both.
- State click (AQ3 choropleth): highlights state; updates detail panel with road user breakdown.
- Sankey hover: highlights full flow path end-to-end; dims all other flows.
- **Every interaction must change the marks themselves.** Do not respond with only a text or axis update.

## Open Blockers

> Do not build blocked charts until the relevant blocker is resolved.

**Blocker 1 — Crossed dimensions missing** (gates: drawHeatmap, drawSexRoadUser, drawPyramid, drawSankey)
AQ2 and AQ4 need dimensions crossed on the same rows. Two separate KNIME exports are required:
- `national_crossed_aq2.csv`: `national_hospitalisations_raw.csv` filtered to Traffic, grouped by `year`, `age_group`, `sex`, `road_user` → sum `hospitalisations`. Unblocks `drawHeatmap`, `drawSexRoadUser`, `drawPyramid`.
- `national_crossed_aq4.csv`: `national_hospitalisations_raw.csv` filtered to Traffic, grouped by `year`, `road_user`, `counterparty` → sum `hospitalisations`. Unblocks `drawSankey`.
- Fallback (Option B): aggregate on-the-fly in `js/main.js` from `national_hospitalisations_raw.csv` via `d3.rollup()` grouped by the required dimensions per chart.

**Blocker 2 — Choropleth needs rates, not counts** (gates: drawChoropleth)
Raw counts reflect population size, not road safety.
Fix: add `data/abs_population_by_state.csv` with ABS estimated resident populations; compute rate per 100,000.

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
| Hero stat 403,293 is state-attributable only; true national total is 410,884 | Footnote below hero stat |

## Team

| Owner | Responsibilities |
| --- | --- |
| Rusham | All draw functions + front-end. Source `australia.geojson` and `abs_population_by_state.csv`. |
| Vinh | Design book, conclusion copy, Week 12 stand-up. |
| Both | Resolve blockers. Annotate series breaks and COVID dip. |