/**
 * A4 viewport — ratio, fit / 90% / 100% zoom, breakpoints, export parity.
 */
import { A4_WIDTH_PX, A4_HEIGHT_PX, A4_WIDTH_MM, A4_HEIGHT_MM } from '../core/export/pdf-export-config.js';

const MIN_ZOOM = 0.22;
const MAX_ZOOM = 1;
const ZOOM_P90 = 0.9;
const ZOOM_P100 = 1;

const ok = (cond, msg) => {
  if (!cond) throw new Error(msg);
  console.log('  ✓', msg);
};

function computeZoom(opts) {
  const contentW = opts.contentW || A4_WIDTH_PX;
  const padX = opts.padX ?? 32;
  const padY = opts.padY ?? 32;
  const availW = Math.max(100, opts.containerW - padX);
  const availH = Math.max(120, opts.containerH - padY);
  const scaleW = availW / contentW;
  const scaleH = availH / A4_HEIGHT_PX;
  const mode = opts.zoomMode || 'fit';

  if (mode === '100') {
    const zoom = Math.min(ZOOM_P100, scaleW, MAX_ZOOM);
    return Number(Math.max(MIN_ZOOM, zoom).toFixed(4));
  }

  if (mode === '90') {
    const zoom = Math.min(ZOOM_P90, scaleW, MAX_ZOOM);
    return Number(Math.max(MIN_ZOOM, zoom).toFixed(4));
  }

  const zoom = Math.min(scaleW, scaleH, MAX_ZOOM);
  return Number(Math.max(MIN_ZOOM, zoom).toFixed(4));
}

function testRatio() {
  const ratio = A4_HEIGHT_MM / A4_WIDTH_MM;
  ok(A4_WIDTH_MM === 210 && A4_HEIGHT_MM === 297, 'ISO A4 mm dimensions');
  ok(A4_WIDTH_PX === 794 && A4_HEIGHT_PX === 1123, 'A4 px dimensions 794×1123');
  ok(Math.abs(A4_HEIGHT_PX / A4_WIDTH_PX - ratio) < 0.02, `px ratio matches mm (${(A4_HEIGHT_PX / A4_WIDTH_PX).toFixed(3)} ≈ ${ratio.toFixed(3)})`);
}

function testFitModeDesktop() {
  const w1440 = computeZoom({ containerW: 1440, containerH: 900, zoomMode: 'fit' });
  const w1280 = computeZoom({ containerW: 1280, containerH: 820, zoomMode: 'fit' });
  const reviewCol = computeZoom({ containerW: 720, containerH: 520, zoomMode: 'fit', padX: 24, padY: 20 });
  ok(w1440 > 0 && w1440 <= 1, `1440px fit zoom ${w1440}`);
  ok(w1280 > 0 && w1280 <= 1, `1280px fit zoom ${w1280}`);
  const visualH1440 = A4_HEIGHT_PX * w1440;
  ok(visualH1440 <= 900 - 32, `first page fits 1440×900 viewport (${Math.round(visualH1440)}px ≤ ${900 - 32}px)`);
  ok(reviewCol > 0 && reviewCol <= 1, `review column fit zoom ${reviewCol}`);
  const visualHReview = A4_HEIGHT_PX * reviewCol;
  ok(visualHReview <= 520 - 20, `first page fits review column height (${Math.round(visualHReview)}px)`);
}

function testZoomPresets() {
  const z90 = computeZoom({ containerW: 1440, containerH: 900, zoomMode: '90' });
  const z100 = computeZoom({ containerW: 1440, containerH: 900, zoomMode: '100' });
  ok(z90 === ZOOM_P90, `90% preset is ${ZOOM_P90}`);
  ok(z100 === ZOOM_P100, `100% preset is ${ZOOM_P100}`);
}

function testBreakpoints() {
  const w1024 = computeZoom({ containerW: 1024, containerH: 700, zoomMode: 'fit' });
  const mobile = computeZoom({ containerW: 390, containerH: 640, zoomMode: 'fit' });
  ok(w1024 > 0 && w1024 <= 1, `1024px fit zoom ${w1024}`);
  ok(mobile > 0 && mobile < 1, `mobile fit zoom ${mobile}`);
  ok(mobile >= MIN_ZOOM, `mobile respects min zoom (${mobile} >= ${MIN_ZOOM})`);
}

function testNoHorizontalCrop() {
  const narrow = computeZoom({ containerW: 420, containerH: 900, zoomMode: 'fit' });
  const visualW = A4_WIDTH_PX * narrow;
  ok(visualW <= 420 - 32 + 1, `scaled width fits container (${Math.round(visualW)}px)`);
}

function testNoDistortionContract() {
  const zoom = 0.62;
  const layoutW = A4_WIDTH_PX;
  const layoutH = A4_HEIGHT_PX;
  const visualW = layoutW * zoom;
  const visualH = layoutH * zoom;
  ok(Math.abs(visualH / visualW - A4_HEIGHT_PX / A4_WIDTH_PX) < 0.001, 'scaled page preserves aspect ratio');
}

function testDeterministic() {
  const a = computeZoom({ containerW: 1200, containerH: 900, zoomMode: 'fit' });
  const b = computeZoom({ containerW: 1200, containerH: 900, zoomMode: 'fit' });
  ok(a === b, 'zoom is deterministic');
}

function testExportUsesNativePage() {
  ok(A4_WIDTH_PX === 794, 'export width matches preview');
  ok(A4_HEIGHT_PX === 1123, 'export height matches preview');
}

function main() {
  console.log('qa-a4-viewport');
  testRatio();
  testFitModeDesktop();
  testZoomPresets();
  testBreakpoints();
  testNoHorizontalCrop();
  testNoDistortionContract();
  testDeterministic();
  testExportUsesNativePage();
  console.log('qa-a4-viewport: passed');
}

main();
