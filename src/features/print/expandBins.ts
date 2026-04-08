import type { Bin } from '@/types';

export function expandBinsByCopies(bins: Bin[], copies: number): Bin[] {
  if (copies <= 1) return bins;
  return bins.flatMap((bin) => Array.from({ length: copies }, () => bin));
}
