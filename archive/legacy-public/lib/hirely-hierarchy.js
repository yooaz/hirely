/**
 * Hirely Hierarchy — hero clarity + init (intelligence UI in hirely-experience.js).
 */
(function (global) {
  function init() {
    const hero = document.querySelector('.hero--compact');
    if (hero && !document.getElementById('heroInsight')) {
      const p = document.createElement('p');
      p.className = 'heroInsight';
      p.id = 'heroInsight';
      p.textContent = 'One recruiter-grade read before you send a single application.';
      const lead = hero.querySelector('.heroLead');
      if (lead) {
        lead.textContent =
          'Simulate the seven-second scan — then refine into a publication-ready document.';
        lead.after(p);
      }
    }
  }

  global.HirelyHierarchy = { init };
})(typeof window !== 'undefined' ? window : globalThis);
