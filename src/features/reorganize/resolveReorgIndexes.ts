import type { Bin } from '@/types';

/** Shape emitted by `parsePartialReorg` after Task 6. Indices, not strings. */
export interface PartialReorgBinIndexed {
  name: string;
  itemIndices: readonly number[];
  tags: readonly string[];
}

export interface PartialReorgResultIndexed {
  bins: readonly PartialReorgBinIndexed[];
}

/** Shape consumed by `deriveMoveList` and `ReorganizePreview`. String items, no summary. */
export interface ResolvedReorgBin {
  name: string;
  items: string[];
  tags: string[];
}

export interface ResolvedReorgPartial {
  bins: ResolvedReorgBin[];
}

/**
 * Convert an indexed partial result into string-items shape by mapping each
 * 1-based index to the corresponding item name, flattened across input bins
 * in the order they were sent to the server. Out-of-range and non-integer
 * indices are silently dropped here — validation is the authoritative channel
 * for mismatch reporting.
 */
export function resolveReorgIndexes(
  partial: PartialReorgResultIndexed,
  inputBins: Bin[],
): ResolvedReorgPartial {
  const indexToName: string[] = [];
  for (const bin of inputBins) {
    for (const item of bin.items) {
      indexToName.push(item.name);
    }
  }

  const bins = partial.bins.map((b) => ({
    name: b.name,
    items: b.itemIndices.reduce<string[]>((acc, raw) => {
      if (!Number.isInteger(raw) || raw < 1 || raw > indexToName.length) return acc;
      acc.push(indexToName[raw - 1]);
      return acc;
    }, []),
    tags: [...b.tags],
  }));

  return { bins };
}
