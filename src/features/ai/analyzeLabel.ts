import { parseAnalysisItemCount } from '@/features/ai/parsePartialAnalysis';

export type AnalyzeStreamMode = 'analyze' | 'reanalyze' | 'correction' | 'locking' | 'idle';

export interface AnalyzeLabelState {
  /** Plain text label, no trailing ellipsis. */
  text: string;
  /** Whether the caller should render an animated ellipsis after the text. */
  showEllipsis: boolean;
  /** Number of complete items parsed from the partial JSON stream. */
  itemCount: number;
}

/**
 * Compute the streaming label state for the photo-bulk-add review step.
 *
 * Pure function — given the active stream mode, the partial JSON text, and
 * whether the stream has completed, returns the human-readable label and item
 * count. The component renders the ellipsis separately (animated dots).
 */
export function computeAnalyzeLabel(opts: {
  mode: AnalyzeStreamMode;
  partialText: string;
  complete: boolean;
}): AnalyzeLabelState {
  if (opts.complete) {
    return { text: 'Done', showEllipsis: false, itemCount: 0 };
  }

  if (opts.mode === 'locking') {
    const itemCount = parseAnalysisItemCount(opts.partialText);
    const text =
      itemCount === 0
        ? 'No items found'
        : `${itemCount} ${itemCount === 1 ? 'item' : 'items'} found`;
    return { text, showEllipsis: false, itemCount };
  }

  if (opts.mode === 'idle') {
    return { text: '', showEllipsis: false, itemCount: 0 };
  }

  const itemCount = parseAnalysisItemCount(opts.partialText);

  if (itemCount === 0) {
    if (opts.mode === 'reanalyze') {
      return { text: 'Reanalyzing', showEllipsis: true, itemCount: 0 };
    }
    if (opts.mode === 'correction') {
      return { text: 'Applying correction', showEllipsis: true, itemCount: 0 };
    }
    return { text: 'Scanning', showEllipsis: true, itemCount: 0 };
  }

  const noun = itemCount === 1 ? 'item' : 'items';
  return { text: `Found ${itemCount} ${noun}`, showEllipsis: true, itemCount };
}
