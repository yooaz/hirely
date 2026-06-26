import type { LayoutAnalysis } from '../../types/layout.types.js';
import type { RawBlock, RawPage } from '../../types/extraction.types.js';
import type { LayoutType } from '../../types/layout.types.js';
import { ColumnDetectorService } from './column-detector.service.js';
import { computeBlockSignals } from '../_internal/block-signals.js';
import { matchSectionHeading } from '../_internal/section-headings.js';
import { tokenize } from '../_internal/utils.js';

function unique(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const i of items) {
    const k = i.trim();
    if (!k || seen.has(k.toLowerCase())) continue;
    seen.add(k.toLowerCase());
    out.push(k);
  }
  return out;
}

export class LayoutAnalyzerService {
  private columnsDetector = new ColumnDetectorService();

  analyze(pages: RawPage[], blocks: RawBlock[]): LayoutAnalysis {
    const pageWidth = Math.max(1, ...pages.map((p) => p.width || 595));
    const colsRes = this.columnsDetector.detectColumns(blocks, pageWidth);

    const layout_type: LayoutType = colsRes.layout_type;
    const columns = colsRes.columns;

    const byPage = new Map<number, RawBlock[]>();
    for (const b of blocks || []) {
      const p = b.page_number || 1;
      if (!byPage.has(p)) byPage.set(p, []);
      byPage.get(p)!.push(b);
    }

    const pageLayouts = (pages || []).map((p) => {
      const pageBlocks = byPage.get(p.page_number) || [];
      const headingCandidates: string[] = [];
      const listCandidates: string[] = [];

      for (const b of pageBlocks) {
        const signals = computeBlockSignals(b.text, { fontSize: b.font_size, isBold: b.is_bold });
        if (signals.looks_like_heading) {
          const mh = matchSectionHeading(b.text);
          headingCandidates.push(mh ? b.text.trim() : b.text.trim().slice(0, 80));
        }
        if (signals.looks_like_bullet) {
          listCandidates.push(b.text.trim().slice(0, 120));
        }
      }

      // Light filtering to avoid pure noise.
      const headingsClean = unique(headingCandidates).slice(0, 20);
      const listsClean = unique(listCandidates).slice(0, 30);
      return {
        page_number: p.page_number,
        layout_type,
        heading_candidates: headingsClean,
        list_candidates: listsClean,
      };
    });

    const confidence =
      layout_type === 'two_columns' ? 0.78 : layout_type === 'single_column' ? 0.86 : 0.6;

    return {
      layout_type,
      has_sidebar: layout_type === 'sidebar_left' || layout_type === 'sidebar_right',
      columns,
      pages: pageLayouts.length ? pageLayouts : [{ page_number: 1, layout_type, heading_candidates: [], list_candidates: [] }],
      confidence,
    };
  }
}

