export interface MismatchOptions {
  /** True when the reorganize policy allows the same item name to appear in multiple output bins. */
  allowDupes: boolean;
}

export interface MismatchResult {
  mismatch: boolean;
  /**
   * Normalized input names that are under-represented in the output. A name
   * may appear multiple times — once for each missing occurrence (e.g. if the
   * input has "screw" twice and the output has it once, `dropped` is `['screw']`;
   * if the output is empty, `dropped` is `['screw', 'screw']`).
   */
  dropped: string[];
  /**
   * Normalized output names that are over-represented vs the input. Under
   * `force-single`, this includes names the output duplicated. Under
   * `allow` (allowDupes=true), this only includes names that do not exist in
   * the input at all. May contain the same name multiple times.
   */
  invented: string[];
}

export function normalizeItemName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function buildCountMap(names: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const raw of names) {
    const n = normalizeItemName(raw);
    counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  return counts;
}

/**
 * Compare input vs output item names for the reorganize AI output.
 * - Under `force-single` (allowDupes=false): require exact multiset equality.
 * - Under `allow` (allowDupes=true): require output names to be a subset of input names,
 *   with unlimited multiplicity on the output side.
 *
 * Names are normalized by trimming, lowercasing, and collapsing internal whitespace.
 *
 * Callers should derive `allowDupes` from the *effective* duplicates policy:
 *   `ambiguousPolicy === 'multi-bin' || duplicates === 'allow'`
 * This mirrors the `effectiveDuplicates` computation in `buildReorganizePrompt`
 * (`server/src/lib/reorganizePrompt.ts`). Passing the raw `duplicates` field
 * alone will miss the `multi-bin` case.
 */
export function detectReorganizeMismatch(
  inputNames: string[],
  outputNames: string[],
  options: MismatchOptions,
): MismatchResult {
  const inputCounts = buildCountMap(inputNames);
  const outputCounts = buildCountMap(outputNames);

  const dropped: string[] = [];
  const invented: string[] = [];

  for (const [name, inCount] of inputCounts) {
    const outCount = outputCounts.get(name) ?? 0;
    if (options.allowDupes) {
      if (outCount === 0) dropped.push(name);
    } else if (outCount < inCount) {
      for (let i = 0; i < inCount - outCount; i++) dropped.push(name);
    }
  }

  for (const [name, outCount] of outputCounts) {
    const inCount = inputCounts.get(name) ?? 0;
    if (inCount === 0) {
      for (let i = 0; i < outCount; i++) invented.push(name);
    } else if (!options.allowDupes && outCount > inCount) {
      for (let i = 0; i < outCount - inCount; i++) invented.push(name);
    }
  }

  return {
    mismatch: dropped.length > 0 || invented.length > 0,
    dropped,
    invented,
  };
}
