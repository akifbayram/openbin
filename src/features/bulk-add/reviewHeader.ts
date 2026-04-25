export interface ReviewHeaderTerm {
  /** Lowercase singular bin term (e.g., "bin", "box"). */
  bin: string;
  /** Capitalized singular bin term (e.g., "Bin", "Box"). */
  Bin: string;
}

export interface ReviewHeaderState {
  title: string;
  subtitle: string | null;
}

/**
 * Compute the title and subtitle for the photo-bulk-add review step.
 *
 * Three top-level modes:
 *   - editingFromSummary: always "Edit ${bin}"
 *   - analyzing (single bin): "Analyzing your photo[s]" — pluralized by photoCount
 *   - analyzing (multi bin): "Analyzing ${bin} ${currentIndex + 1}"
 *   - else (single): "Review ${bin}"
 *   - else (multi):  "Review ${bin} ${currentIndex + 1}"
 *
 * Subtitle is null during analysis (the streaming label below the photo
 * carries that signal), or "Tap any field to edit" otherwise.
 */
export function computeReviewHeader(opts: {
  groupCount: number;
  currentIndex: number;
  /** Number of photos in the current group. */
  photoCount: number;
  /** True when the user opened this group via "edit" from the summary screen. */
  editingFromSummary: boolean;
  /** True when an analyze/reanalyze/correction stream is active for this group. */
  isAnalyzing: boolean;
  term: ReviewHeaderTerm;
}): ReviewHeaderState {
  const isMulti = opts.groupCount > 1;

  let title: string;
  if (opts.editingFromSummary) {
    title = `Edit ${opts.term.bin}`;
  } else if (opts.isAnalyzing) {
    if (isMulti) {
      title = `Analyzing ${opts.term.bin} ${opts.currentIndex + 1}`;
    } else {
      title = opts.photoCount > 1 ? 'Analyzing your photos' : 'Analyzing your photo';
    }
  } else if (isMulti) {
    title = `Review ${opts.term.bin} ${opts.currentIndex + 1}`;
  } else {
    title = `Review ${opts.term.bin}`;
  }

  const subtitle = opts.isAnalyzing && !opts.editingFromSummary ? null : 'Tap any field to edit';

  return { title, subtitle };
}
