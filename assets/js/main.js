// ─────────────────────────────────────────────────────────────────────────────
// main.js — Entry point for Australia's Road Crash Burden visualisation.
//
// Responsibilities:
//   1. Launch all chart draw functions in parallel via Promise.all.
//   2. Initialise the sticky nav IntersectionObserver after charts resolve.
//
// Load order in index.html must be:
//   constants.js → aq1.js → aq2.js → aq3.js → main.js
// ─────────────────────────────────────────────────────────────────────────────


/**
 * Highlights the active nav link as the user scrolls between chapter sections.
 * Uses IntersectionObserver rather than scroll events to avoid layout thrashing.
 */
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


// All draw functions run in parallel. initNav runs after all charts are ready
// so the observer does not fire before chart containers have their full height.
(async function init() {
  try {
    await Promise.all([
      drawTrend(),
      drawRoadUser(),
      drawAge(),
      drawState(),
      drawFirstNations(),
    ]);
  } catch (err) {
    console.error('Chart init failed:', err);
  }
  initNav();
})();
