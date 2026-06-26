/**
 * Hirely PDF Export Pro — browser html2pdf with A4, breaks, font readiness.
 * V2: discrete A4 pages (cover + audit packet + cloned CV sheets).
 */
(function (global) {
  const A4_WIDTH_PX = 794;
  const A4_HEIGHT_PX = 1123;
  const A4_WIDTH_MM = 210;
  const A4_HEIGHT_MM = 297;
  const PDF_EXPORT_V2 = 'PDF_EXPORT_V2';
  const PAGE_BREAK_AVOID = [
    '.cvHead',
    '.cvSection',
    '.cvExpEntry',
    '.cvProjectEntry',
    '.cvMetaFooter',
    '.cvSide',
    '.cvSectionTitle',
  ];

  async function prepareFonts() {
    if (global.document?.fonts?.ready) {
      try {
        await Promise.race([
          global.document.fonts.ready,
          new Promise((r) => setTimeout(r, 3500)),
        ]);
      } catch {
        /* ignore */
      }
    }
    await new Promise((r) => setTimeout(r, 280));
  }

  /**
   * Safari-safe blob download — anchor click + delayed revokeObjectURL.
   * @param {Blob} blob
   * @param {string} filename
   */
  function triggerBlobDownload(blob, filename) {
    if (!blob) return false;
    const name = String(filename || 'hirely-cv.pdf').replace(/[/\\?%*:|"<>]/g, '-');
    const url = URL.createObjectURL(blob);
    const a = global.document.createElement('a');
    a.href = url;
    a.download = name;
    a.rel = 'noopener';
    a.style.display = 'none';
    global.document.body.appendChild(a);
    a.click();
    global.setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 1200);
    return true;
  }

  /**
   * Convert non-data-URL images to data URLs so html2canvas (allowTaint:false) can capture them.
   * @param {HTMLElement} rootEl
   */
  async function inlineExportImages(rootEl) {
    if (!rootEl) return;
    const imgs = [...rootEl.querySelectorAll('img[src]')];
    await Promise.all(
      imgs.map(
        (img) =>
          new Promise((resolve) => {
            const src = img.getAttribute('src') || '';
            if (!src || src.startsWith('data:')) {
              resolve();
              return;
            }
            const probe = new Image();
            probe.crossOrigin = 'anonymous';
            probe.onload = () => {
              try {
                const canvas = global.document.createElement('canvas');
                canvas.width = probe.naturalWidth || probe.width || 1;
                canvas.height = probe.naturalHeight || probe.height || 1;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.drawImage(probe, 0, 0);
                  img.src = canvas.toDataURL('image/png');
                }
              } catch {
                /* CORS — leave src; capture may skip photo */
              }
              resolve();
            };
            probe.onerror = () => resolve();
            probe.src = src;
          })
      )
    );
  }

  function applyExportMode(cvEl) {
    if (!cvEl) return;
    global.document?.body?.classList.add('export-pdf');
    cvEl.classList.add('cv-page', 'cv--pdf-export');
    cvEl.style.width = `${A4_WIDTH_PX}px`;
    cvEl.style.maxWidth = `${A4_WIDTH_PX}px`;
    cvEl.style.overflow = 'visible';
    cvEl.style.boxShadow = 'none';
    cvEl.style.minHeight = '0';
    cvEl.style.transform = 'none';
  }

  function clearExportMode(cvEl) {
    if (!cvEl) return;
    global.document?.body?.classList.remove('export-pdf');
    cvEl.classList.remove('cv--pdf-export');
    cvEl.style.transform = '';
    cvEl.style.width = '';
    cvEl.style.maxWidth = '';
    cvEl.style.overflow = '';
    cvEl.style.boxShadow = '';
    cvEl.style.minHeight = '';
  }

  /**
   * @param {HTMLElement} cvEl
   * @param {string} filename
   */
  function getExportCaptureMetrics(cvEl) {
    const stack = cvEl?.querySelector('.cvA4Stack');
    if (stack) {
      const pages = Math.max(1, stack.querySelectorAll('.cvA4Sheet').length);
      const gap = global.document?.body?.classList.contains('export-pdf') ? 0 : 16;
      const captureH = pages * A4_HEIGHT_PX + Math.max(0, pages - 1) * gap;
      return { captureH, pages };
    }
    const scrollH = Math.max(cvEl?.scrollHeight || 0, cvEl?.offsetHeight || 0, A4_HEIGHT_PX);
    return { captureH: scrollH + 64, pages: Math.ceil(scrollH / A4_HEIGHT_PX) };
  }

  function buildHtml2PdfOptions(cvEl, filename) {
    const { captureH, pages } = getExportCaptureMetrics(cvEl);
    return {
      margin: [0, 0, 0, 0],
      filename: filename || 'hirely-cv.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        width: A4_WIDTH_PX,
        windowWidth: A4_WIDTH_PX,
        windowHeight: captureH,
        height: captureH,
        scrollX: 0,
        scrollY: -global.scrollY,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        logging: false,
        letterRendering: true,
        removeContainer: true,
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait',
        compress: true,
        putOnlyUsedFonts: true,
      },
      pagebreak: {
        mode: ['css', 'legacy'],
        avoid: PAGE_BREAK_AVOID,
        before: '.cvA4Sheet.html2pdf__page-break-before, .html2pdf__page-break-before',
      },
      _pagesEstimated: pages,
    };
  }

  /**
   * @param {HTMLElement} cvEl
   * @param {string} filename
   */
  function pdfExportFail(errors) {
    return { ok: false, success: false, errors, warnings: ['PDF_EXPORT_SAFE_FALLBACK'], data: {} };
  }

  function resolveJsPdf() {
    const mod = global.jspdf || global.jsPDF;
    if (mod?.jsPDF) return mod.jsPDF;
    if (typeof mod === 'function') return mod;
    try {
      if (global.html2pdf) {
        const worker = global.html2pdf().set({
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait', compress: true },
        });
        const ctor = worker?.internal?.pdf?.constructor;
        if (ctor && typeof ctor === 'function') {
          if (!global.jspdf) global.jspdf = { jsPDF: ctor };
          return ctor;
        }
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  async function resolveJsPdfAsync() {
    let JsPDF = resolveJsPdf();
    if (JsPDF) return JsPDF;
    if (!global.html2pdf || !global.document?.body) return null;
    try {
      const stub = global.document.createElement('div');
      stub.style.cssText = 'position:fixed;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none';
      global.document.body.appendChild(stub);
      const worker = global
        .html2pdf()
        .set({ jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait', compress: true } })
        .from(stub);
      await worker.toContainer();
      JsPDF = worker?.internal?.pdf?.constructor || null;
      stub.remove();
      if (JsPDF && typeof JsPDF === 'function') {
        if (!global.jspdf) global.jspdf = { jsPDF: JsPDF };
        return JsPDF;
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  function primePageDimensions(pageEl) {
    if (!pageEl) return;
    pageEl.style.width = `${A4_WIDTH_PX}px`;
    pageEl.style.height = `${A4_HEIGHT_PX}px`;
    pageEl.style.overflow = 'hidden';
    pageEl.style.boxSizing = 'border-box';
    pageEl.style.margin = '0';
    pageEl.style.padding = '0';
    pageEl.style.transform = 'none';
  }

  function buildPageCanvasOptions() {
    return {
      scale: 2,
      width: A4_WIDTH_PX,
      height: A4_HEIGHT_PX,
      windowWidth: A4_WIDTH_PX,
      windowHeight: A4_HEIGHT_PX,
      scrollX: 0,
      scrollY: 0,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      logging: false,
      letterRendering: true,
    };
  }

  async function rasterizePage(pageEl) {
    if (!global.html2pdf) return null;
    const worker = global
      .html2pdf()
      .set({
        margin: [0, 0, 0, 0],
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: buildPageCanvasOptions(),
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait', compress: true },
        enableLinks: false,
      })
      .from(pageEl);
    await worker.toContainer().toCanvas();
    return worker.get('canvas');
  }

  function collectPacketPages(exportRoot) {
    if (!exportRoot) return [];
    return global.HirelyPdfExportV2?.collectPages
      ? global.HirelyPdfExportV2.collectPages(exportRoot)
      : [...exportRoot.querySelectorAll('.pdfV2Page')];
  }

  /**
   * Page-by-page A4 assembly — no tall-stack screenshot, no cross-page clipping.
   * @param {HTMLElement} exportRoot
   * @param {string} filename
   */
  async function exportPacketV2(exportRoot, filename) {
    if (!exportRoot) return pdfExportFail(['EXPORT_ROOT_MISSING']);
    if (!global.html2pdf) return pdfExportFail(['html2pdf not loaded']);

    const JsPDF = await resolveJsPdfAsync();
    if (!JsPDF) return pdfExportFail(['jsPDF not loaded']);

    await prepareFonts();
    await inlineExportImages(exportRoot);
    global.document?.body?.classList.add('export-pdf-v2');

    const hadScale = !!global.HirelyA4Viewport?.suspendScaleForExport;
    if (hadScale) global.HirelyA4Viewport.suspendScaleForExport();

    const pages = collectPacketPages(exportRoot);
    if (!pages.length) return pdfExportFail(['PDF_V2_NO_PAGES']);

    try {
      const pdf = new JsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
      for (let i = 0; i < pages.length; i++) {
        primePageDimensions(pages[i]);
        await new Promise((r) => global.requestAnimationFrame(() => global.requestAnimationFrame(r)));
        const canvas = await rasterizePage(pages[i]);
        if (!canvas) return pdfExportFail([`PAGE_RASTERIZE_FAILED_${i + 1}`]);
        const img = canvas.toDataURL('image/jpeg', 0.98);
        if (i > 0) pdf.addPage();
        pdf.addImage(img, 'JPEG', 0, 0, A4_WIDTH_MM, A4_HEIGHT_MM, undefined, 'FAST');
      }
      try {
        pdf.save(filename || 'hirely-cv.pdf');
      } catch {
        triggerBlobDownload(pdf.output('blob'), filename || 'hirely-cv.pdf');
      }
      return {
        ok: true,
        success: true,
        method: PDF_EXPORT_V2,
        pagesEstimated: pages.length,
        auditPages: pages.filter((p) => !p.classList.contains('pdfV2Page--cv')).length,
        cvPages: pages.filter((p) => p.classList.contains('pdfV2Page--cv')).length,
        errors: [],
        warnings: [],
      };
    } catch (err) {
      console.error('PDF_EXPORT_V2_FAILED', err);
      return pdfExportFail([String(err?.message || 'PDF_EXPORT_V2_FAILED')]);
    } finally {
      global.document?.body?.classList.remove('export-pdf-v2');
      if (hadScale) global.HirelyA4Viewport.restoreScaleAfterExport();
    }
  }

  /**
   * @param {HTMLElement} exportRoot
   * @param {string} filename
   */
  async function exportPacketV2Blob(exportRoot, filename) {
    if (!exportRoot) {
      return { ...pdfExportFail(['EXPORT_ROOT_MISSING']), blob: null, filename: filename || 'hirely-cv.pdf', pagesEstimated: 0 };
    }
    if (!global.html2pdf) {
      return { ...pdfExportFail(['html2pdf not loaded']), blob: null, filename: filename || 'hirely-cv.pdf', pagesEstimated: 0 };
    }
    const JsPDF = await resolveJsPdfAsync();
    if (!JsPDF) {
      return { ...pdfExportFail(['jsPDF not loaded']), blob: null, filename: filename || 'hirely-cv.pdf', pagesEstimated: 0 };
    }

    await prepareFonts();
    await inlineExportImages(exportRoot);
    global.document?.body?.classList.add('export-pdf-v2');
    const hadScale = !!global.HirelyA4Viewport?.suspendScaleForExport;
    if (hadScale) global.HirelyA4Viewport.suspendScaleForExport();

    const pages = collectPacketPages(exportRoot);
    if (!pages.length) {
      return { ...pdfExportFail(['PDF_V2_NO_PAGES']), blob: null, filename: filename || 'hirely-cv.pdf', pagesEstimated: 0 };
    }

    try {
      const pdf = new JsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
      for (let i = 0; i < pages.length; i++) {
        primePageDimensions(pages[i]);
        await new Promise((r) => global.requestAnimationFrame(() => global.requestAnimationFrame(r)));
        const canvas = await rasterizePage(pages[i]);
        if (!canvas) {
          return {
            ...pdfExportFail([`PAGE_RASTERIZE_FAILED_${i + 1}`]),
            blob: null,
            filename: filename || 'hirely-cv.pdf',
            pagesEstimated: 0,
          };
        }
        const img = canvas.toDataURL('image/jpeg', 0.98);
        if (i > 0) pdf.addPage();
        pdf.addImage(img, 'JPEG', 0, 0, A4_WIDTH_MM, A4_HEIGHT_MM, undefined, 'FAST');
      }
      const blob = pdf.output('blob');
      return {
        ok: true,
        success: true,
        blob,
        filename: filename || 'hirely-cv.pdf',
        pagesEstimated: pages.length,
        method: PDF_EXPORT_V2,
        errors: [],
        warnings: [],
      };
    } catch (err) {
      console.error('PDF_EXPORT_V2_BLOB_FAILED', err);
      return {
        ...pdfExportFail([String(err?.message || 'PDF_EXPORT_V2_BLOB_FAILED')]),
        blob: null,
        filename: filename || 'hirely-cv.pdf',
        pagesEstimated: 0,
      };
    } finally {
      global.document?.body?.classList.remove('export-pdf-v2');
      if (hadScale) global.HirelyA4Viewport.restoreScaleAfterExport();
    }
  }

  async function exportCvToPdf(cvEl, filename) {
    if (!cvEl) return pdfExportFail(['CV element missing']);
    if (!global.html2pdf) return pdfExportFail(['html2pdf not loaded']);

    await prepareFonts();
    await inlineExportImages(cvEl);
    const hadScale = !!global.HirelyA4Viewport?.suspendScaleForExport;
    if (hadScale) global.HirelyA4Viewport.suspendScaleForExport();
    applyExportMode(cvEl);
    cvEl.scrollIntoView({ block: 'start', behavior: 'instant' });
    await new Promise((r) => global.requestAnimationFrame(() => global.requestAnimationFrame(r)));

    try {
      const opt = buildHtml2PdfOptions(cvEl, filename);
      try {
        await global.html2pdf().set(opt).from(cvEl).save();
      } catch {
        const blob = await global.html2pdf().set(opt).from(cvEl).outputPdf('blob');
        triggerBlobDownload(blob, filename);
      }
      const { pages } = getExportCaptureMetrics(cvEl);
      return { ok: true, success: true, method: 'html2pdf', pagesEstimated: pages, errors: [], warnings: [] };
    } catch (err) {
      console.error('PDF_EXPORT_FAILED', err);
      return pdfExportFail([String(err?.message || 'PDF_EXPORT_FAILED')]);
    } finally {
      clearExportMode(cvEl);
      if (hadScale) global.HirelyA4Viewport.restoreScaleAfterExport();
    }
  }

  /**
   * Same render path as exportCvToPdf but returns a PDF Blob (for email upload).
   * @param {HTMLElement} cvEl
   * @param {string} filename
   * @returns {Promise<{ ok: boolean, blob: Blob, filename: string, pagesEstimated: number }>}
   */
  async function exportCvToPdfBlob(cvEl, filename) {
    if (!cvEl) return { ...pdfExportFail(['CV element missing']), blob: null, filename: filename || 'hirely-cv.pdf', pagesEstimated: 0 };
    if (!global.html2pdf) return { ...pdfExportFail(['html2pdf not loaded']), blob: null, filename: filename || 'hirely-cv.pdf', pagesEstimated: 0 };

    await prepareFonts();
    await inlineExportImages(cvEl);
    const hadScale = !!global.HirelyA4Viewport?.suspendScaleForExport;
    if (hadScale) global.HirelyA4Viewport.suspendScaleForExport();
    applyExportMode(cvEl);
    cvEl.scrollIntoView({ block: 'start', behavior: 'instant' });
    await new Promise((r) => global.requestAnimationFrame(() => global.requestAnimationFrame(r)));

    try {
      const opt = buildHtml2PdfOptions(cvEl, filename);
      const worker = global.html2pdf().set(opt).from(cvEl);
      const blob = await worker.outputPdf('blob');
      return {
        ok: true,
        success: true,
        blob,
        filename: filename || 'hirely-cv.pdf',
        pagesEstimated: getExportCaptureMetrics(cvEl).pages,
        errors: [],
        warnings: [],
      };
    } catch (err) {
      console.error('PDF_EXPORT_BLOB_FAILED', err);
      return {
        ...pdfExportFail([String(err?.message || 'PDF_BLOB_UNAVAILABLE')]),
        blob: null,
        filename: filename || 'hirely-cv.pdf',
        pagesEstimated: 0,
      };
    } finally {
      clearExportMode(cvEl);
      if (hadScale) global.HirelyA4Viewport.restoreScaleAfterExport();
    }
  }

  global.HirelyPdfExport = {
    A4_WIDTH_PX,
    A4_HEIGHT_PX,
    A4_WIDTH_MM,
    A4_HEIGHT_MM,
    PDF_EXPORT_V2,
    PAGE_BREAK_AVOID,
    prepareFonts,
    inlineExportImages,
    triggerBlobDownload,
    applyExportMode,
    clearExportMode,
    buildHtml2PdfOptions,
    rasterizePage,
    exportPacketV2,
    exportPacketV2Blob,
    exportCvToPdf,
    exportCvToPdfBlob,
  };
})(typeof window !== 'undefined' ? window : globalThis);
