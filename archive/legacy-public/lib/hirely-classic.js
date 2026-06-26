/**
 * Hirely Classic — restore simple 2-column layout (input | dark result + CV).
 */
(function (global) {
  function enableClassicLayout() {
    document.documentElement.classList.add('classic-layout');
    document.body.classList.add('classic-layout');
    if (document.documentElement.classList.contains('layout-stacked')) return;

    const grid = document.getElementById('workspaceGridRoot');
    const intel = document.querySelector('.col-intel');
    const preview = document.querySelector('.col-preview');
    if (grid && intel && preview && intel.compareDocumentPosition(preview) & Node.DOCUMENT_POSITION_FOLLOWING) {
      grid.insertBefore(intel, preview);
    }
  }

  function mountToolbarTemplates() {
    if (document.getElementById('templatePicker')) return;
    const toolbar = document.getElementById('proToolbar');
    const host = document.getElementById('templateButtons');
    if (!toolbar || !host) return;
    const groups = toolbar.querySelectorAll('.toolbarGroup');
    const editGroup = groups.length > 1 ? groups[1] : null;
    if (host.parentElement !== toolbar) {
      if (editGroup) toolbar.insertBefore(host, editGroup);
      else toolbar.prepend(host);
    }
    host.className = 'toolbarGroup';
    host.dataset.classicMounted = '1';
  }

  function patchStable() {
    const stable = global.HirelyStable;
    if (!stable || stable._classicPatched) return;
    const origMount = stable.mountTemplatesBand;
    if (origMount) {
      stable.mountTemplatesBand = function () {
        if (document.documentElement.classList.contains('classic-layout')) {
          mountToolbarTemplates();
          return;
        }
        return origMount.apply(this, arguments);
      };
    }
    stable._classicPatched = true;
  }

  function init() {
    enableClassicLayout();
    patchStable();
    mountToolbarTemplates();
    requestAnimationFrame(mountToolbarTemplates);
  }

  global.HirelyClassic = { init, enableClassicLayout, mountToolbarTemplates };
})(typeof window !== 'undefined' ? window : globalThis);
