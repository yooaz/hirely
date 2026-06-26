/**
 * P0 Subtraction — export More menu.
 */
(function (global) {
  function initExportMoreMenu() {
    const btn = global.document.getElementById('exportMoreBtn');
    const menu = global.document.getElementById('exportMoreMenu');
    if (!btn || !menu || menu._p0Bound) return;
    menu._p0Bound = true;

    const close = () => {
      menu.classList.add('hidden');
      btn.setAttribute('aria-expanded', 'false');
    };

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const open = menu.classList.contains('hidden');
      if (open) {
        menu.classList.remove('hidden');
        btn.setAttribute('aria-expanded', 'true');
      } else {
        close();
      }
    });

    menu.addEventListener('click', (e) => {
      const item = e.target.closest('[role="menuitem"]');
      if (!item) return;
      close();
    });

    global.document.addEventListener('click', (e) => {
      if (menu.classList.contains('hidden')) return;
      if (e.target === btn || btn.contains(e.target) || menu.contains(e.target)) return;
      close();
    });

    global.document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });
  }

  global.HirelyP0Subtraction = { initExportMoreMenu };
  if (global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', initExportMoreMenu, { once: true });
  } else {
    initExportMoreMenu();
  }
})(typeof window !== 'undefined' ? window : globalThis);
