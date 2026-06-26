/**
 * @deprecated Use `src/ui/templates/cv-templates.js` (loaded by index.html).
 * Legacy path kept for docs/scripts that still reference this filename.
 */
(function (global) {
  const src = './src/ui/templates/cv-templates.js';
  if (typeof document !== 'undefined') {
    const s = document.createElement('script');
    s.src = src;
    document.head.appendChild(s);
  } else if (typeof require !== 'undefined') {
    require(src);
  }
})(typeof window !== 'undefined' ? window : global);
