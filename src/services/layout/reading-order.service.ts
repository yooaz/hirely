import type { LayoutAnalysis } from '../../types/layout.types.js';
import type { NormalizedBlock, LogicalBlock } from '../../types/blocks.types.js';

function assignColumnId(block: NormalizedBlock, layout: LayoutAnalysis): NormalizedBlock['column_id'] {
  if (!layout.columns?.length) return block.column_id;
  const cx = block.bbox.x + block.bbox.w / 2;
  const found = layout.columns.find((c) => {
    const x = c.bbox.x;
    const x2 = c.bbox.x + c.bbox.w;
    return cx >= x && cx <= x2;
  });
  return found?.column_id || block.column_id;
}

export class ReadingOrderService {
  /**
   * Phase 1 fallback: if reading_order missing, sort using page/column/y.
   */
  applyToNormalizedBlocks(blocks: NormalizedBlock[], layout: LayoutAnalysis): NormalizedBlock[] {
    const withCol = blocks.map((b) => ({
      ...b,
      column_id: assignColumnId(b, layout),
    }));

    // Stable sort: already has reading_order from extraction for native/docx/text.
    const hasOrder = withCol.every((b) => Number.isFinite(b.reading_order));
    if (hasOrder) return withCol;

    const cols = layout.columns || [];
    const colIndex = (colId?: string) =>
      cols.findIndex((c) => c.column_id === colId) >= 0 ? cols.findIndex((c) => c.column_id === colId) : 999;

    return [...withCol].sort((a, b) => {
      if (a.page_number !== b.page_number) return a.page_number - b.page_number;
      const ci = colIndex(a.column_id) - colIndex(b.column_id);
      if (ci !== 0) return ci;
      // Heuristic: smaller y first (top-down in most extracted coords)
      return a.bbox.y - b.bbox.y;
    });
  }

  /**
   * Ensure logical blocks are ordered.
   */
  applyToLogicalBlocks(blocks: LogicalBlock[]): LogicalBlock[] {
    const hasOrder = blocks.every((b) => Number.isFinite(b.reading_order));
    if (hasOrder) return blocks;
    return [...blocks].sort((a, b) => {
      if (a.page_number !== b.page_number) return a.page_number - b.page_number;
      const ay = a.lines?.[0]?.bbox?.y ?? 0;
      const by = b.lines?.[0]?.bbox?.y ?? 0;
      return ay - by;
    });
  }
}

