export interface MismatchOptions {
  /** True when the reorganize policy allows the same item name to appear in multiple output bins. */
  allowDupes: boolean;
}

export interface IndexMismatchResult {
  mismatch: boolean;
  /** Input indices that were missing from the output (see function JSDoc for multiplicity rules). */
  dropped: number[];
  /**
   * Output indices that were out-of-range, non-integer, or (under force-single) duplicated.
   * Ordering: out-of-range and non-integer values appear first in their original output order,
   * followed by duplicate entries in ascending index order. Callers should not rely on a
   * specific ordering across the two categories.
   */
  invented: number[];
}

/**
 * Validates that the AI-emitted integer indices cover the numbered input
 * item list correctly.
 *
 * - `allowDupes=false` (force-single): every index in [1, totalInputItems] must
 *   appear exactly once. Missing → dropped. Duplicate or out-of-range → invented.
 * - `allowDupes=true`  (multi-bin / duplicates=allow): every output index must be
 *   in [1, totalInputItems]. Subsets and duplicates are OK. Unreferenced input
 *   indices populate `dropped` once each; out-of-range/non-integer indices
 *   populate `invented`.
 */
export function detectReorganizeMismatchByIndex(
  totalInputItems: number,
  outputIndices: number[],
  options: MismatchOptions,
): IndexMismatchResult {
  const dropped: number[] = [];
  const invented: number[] = [];
  const outCounts = new Map<number, number>();

  for (const raw of outputIndices) {
    if (!Number.isInteger(raw) || raw < 1 || raw > totalInputItems) {
      invented.push(raw);
      continue;
    }
    outCounts.set(raw, (outCounts.get(raw) ?? 0) + 1);
  }

  for (let i = 1; i <= totalInputItems; i++) {
    const count = outCounts.get(i) ?? 0;
    if (options.allowDupes) {
      if (count === 0) dropped.push(i);
    } else {
      if (count === 0) dropped.push(i);
      else if (count > 1) {
        for (let j = 0; j < count - 1; j++) invented.push(i);
      }
    }
  }

  return { mismatch: dropped.length > 0 || invented.length > 0, dropped, invented };
}
