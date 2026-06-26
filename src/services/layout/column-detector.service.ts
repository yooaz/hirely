import type { LayoutAnalysis } from '../../types/layout.types.js';
import type { RawBlock } from '../../types/extraction.types.js';

export class ColumnDetectorService {
  /**
   * Very lightweight 1p/2c detection based on x-centers.
   * Phase 1 targets production stability > pixel-perfect layout.
   */
  detectColumns(blocks: RawBlock[], pageWidth: number): Pick<LayoutAnalysis, 'layout_type' | 'columns'> {
    const xs = (blocks || [])
      .map((b) => {
        const w = b.bbox?.w || 0;
        const x = b.bbox?.x || 0;
        if (!Number.isFinite(x) || !Number.isFinite(w) || w <= 0) return null;
        return x + w / 2;
      })
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));

    const uniq = [...new Set(xs.map((v) => Math.round(v)))];
    if (uniq.length < 20) {
      return {
        layout_type: 'single_column',
        columns: [
          {
            column_id: 'main',
            page_number: 1,
            role: 'main',
            bbox: { x: 0, y: 0, w: pageWidth, h: 1000000 },
          },
        ],
      };
    }

    xs.sort((a, b) => a - b);
    const median = xs[Math.floor(xs.length / 2)]!;
    const q1 = xs[Math.floor(xs.length * 0.25)]!;
    const q3 = xs[Math.floor(xs.length * 0.75)]!;
    const width = Math.max(1, pageWidth);
    const spread = (q3 - q1) / width;

    // Heuristic: two-column layouts tend to show a strong bimodal spread.
    const twoColumnCandidate = spread > 0.28 && Math.abs(median - width / 2) > width * 0.05;

    if (!twoColumnCandidate) {
      return {
        layout_type: 'single_column',
        columns: [
          {
            column_id: 'main',
            page_number: 1,
            role: 'main',
            bbox: { x: 0, y: 0, w: pageWidth, h: 1000000 },
          },
        ],
      };
    }

    const gapThreshold = q1 + (q3 - q1) / 2;
    const leftXs = xs.filter((x) => x < gapThreshold);
    const rightXs = xs.filter((x) => x >= gapThreshold);

    const leftMin = Math.min(...leftXs);
    const leftMax = Math.max(...leftXs);
    const rightMin = Math.min(...rightXs);
    const rightMax = Math.max(...rightXs);

    // Confidence handled by LayoutAnalyzer; here only return geometry.
    return {
      layout_type: 'two_columns',
      columns: [
        {
          column_id: 'left',
          page_number: 1,
          role: 'main',
          bbox: { x: Math.max(0, leftMin - 20), y: 0, w: Math.max(1, leftMax - leftMin + 40), h: 1000000 },
        },
        {
          column_id: 'right',
          page_number: 1,
          role: 'secondary',
          bbox: { x: Math.max(0, rightMin - 20), y: 0, w: Math.max(1, rightMax - rightMin + 40), h: 1000000 },
        },
      ],
    };
  }
}

