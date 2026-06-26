import type { BlockBuilderInput, LogicalBlock } from '../../types/blocks.types.js';
import type { NormalizedBlock } from '../../types/blocks.types.js';
import { BlockClassifierService } from './block-classifier.service.js';

export class BlockBuilderService {
  private classifier = new BlockClassifierService();

  build(input: BlockBuilderInput): LogicalBlock[] {
    const normalized = [...(input.normalized_blocks || [])];
    const ordered = [...normalized].sort((a, b) => {
      if ((a.page_number || 1) !== (b.page_number || 1)) return (a.page_number || 1) - (b.page_number || 1);
      return (a.reading_order || 0) - (b.reading_order || 0);
    });

    return ordered.map((ln: NormalizedBlock) => {
      const { type, confidence } = this.classifier.classify(ln);
      return {
        block_id: ln.block_id,
        type,
        lines: [ln],
        text: ln.normalized_text,
        page_number: ln.page_number,
        column_id: ln.column_id,
        reading_order: ln.reading_order,
        confidence,
      };
    });
  }
}

