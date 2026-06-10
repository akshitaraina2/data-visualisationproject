# data-visualisationproject
# Who Bears the Burden? — Australian Road Crash Hospitalisations

**COS30045 Data Visualisation | Swinburne University of Technology**  
**Team:** Akshita Raina & vinh 
**Semester 1, 2026**

---

## Project Overview

This project presents an interactive data story exploring a decade of 
hospitalised road crash injuries in Australia (2011–2021). Rather than 
simply displaying injury statistics, the visualisation argues a central 
thesis: **the burden of road crash injuries is unequal, and the gap is 
widening.**

The target audience is the **general public** — people who may be 
unaware of who road injuries actually affect most, and how trends have 
shifted over time.

---

## Story Angle

> "Australia's road crash injury burden isn't random — it falls hardest 
> on specific people, and the gap is widening."

---

## Live Site

[Link to Mercury hosted site — add when deployed]

---

## Data Sources

All data sourced from the Bureau of Infrastructure and Transport Research 
Economics (BITRE):

- National Hospitalised Injury Data (2011–2021)
- State & Territory Hospitalised Injury Data (2011–2021)  
- First Nations Hospitalised Injury Data (2011–2021)

Source: https://www.bitre.gov.au/publications/ongoing/hospitalised-injury

---

## File Structure
```
├── index.html
├── README.md
├── assets/
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── main.js
│       ├── constants.js
│       └── charts/
│           ├── aq1.js
│           ├── aq2.js
│           ├── aq3.js
│           └── aq4.js
└── data/
    ├── australia.geojson
    ├── abs_population_by_state.csv
    ├── state-track/
    │   ├── state_x_road_user.csv
    │   ├── state_annual_totals.csv
    │   ├── state_x_counterparty.csv
    │   ├── state_x_age.csv
    │   └── state_x_sex.csv
    ├── fn-track/
    │   ├── fn_by_age.csv
    │   ├── fn_by_road_user.csv
    │   ├── fn_by_remoteness.csv
    │   └── fn_by_counterparty.csv
    └── national-track/
        ├── national_crossed_aq2.csv
        ├── national_crossed_aq4.csv
        ├── annual_trend.csv
        ├── by_age_group.csv
        ├── by_road_user.csv
        ├── by_sex.csv
        ├── by_remoteness.csv
        ├── kpi_total.csv
        └── kpi_bed_days.csv
```
---

## How to Run Locally

1. Clone the repository:
```bash
   git clone https://github.com/akshitaraina2/data-visualisationproject.git
```
2. Open the project folder in VS Code
3. Install the Live Server extension if you haven't already
4. Right-click `index.html` → **Open with Live Server**

> D3 loads data via CSV fetch requests, so the file must be served 
> through a local server — opening index.html directly in a browser 
> will not work.

---

## Tech Stack

- D3.js v7
- HTML5 / CSS3 / Vanilla JavaScript
- KNIME Analytics Platform (data processing)
- Fonts: Bebas Neue, DM Sans, DM Mono (Google Fonts)

---

## Team Contributions

| Task | Owner |
|------|-------|
| Website structure & layout | Akshita Raina |
| D3 visualisations & interactivity | Vinh Nghiem |
| Mercury deployment | Vinh Nghiem |
| Data cleaning & KNIME workflow | Vinh Nghiem |
| Narrative text & data story | Vinh Nghiem |
| Usability testing | Akshita Raina |
| Design Book (joint) | Both |
| Visualisation design decisions (joint) | Both |

---

## AI Use Acknowledgement
using AI to brainstorm and planning things.

---

## Data Limitations

All figures represent **absolute hospitalisation counts**. Direct 
comparisons across states or population groups without population 
adjustment may be misleading. This limitation is acknowledged throughout 
the visualisation narrative.
