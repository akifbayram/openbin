import type { Bin } from '@/types';

/** Deep-compare two Bin objects for memo purposes. */
export function areBinsEqual(a: Bin, b: Bin): boolean {
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.area_id === b.area_id &&
    a.area_name === b.area_name &&
    a.icon === b.icon &&
    a.color === b.color &&
    a.card_style === b.card_style &&
    a.updated_at === b.updated_at &&
    a.visibility === b.visibility &&
    a.is_pinned === b.is_pinned &&
    a.items.length === b.items.length &&
    a.items.every((item, i) => item.id === b.items[i]?.id && item.name === b.items[i]?.name) &&
    a.tags.length === b.tags.length &&
    a.tags.every((t, i) => t === b.tags[i])
  );
}

/** Common prop comparisons shared across BinCard, BinCompactCard, and TableRow. */
export function areCommonBinCardPropsEqual(
  prev: { bin: Bin; selectable?: boolean; selected?: boolean; index?: number; onSelect?: unknown; searchQuery?: string },
  next: { bin: Bin; selectable?: boolean; selected?: boolean; index?: number; onSelect?: unknown; searchQuery?: string },
): boolean {
  return (
    areBinsEqual(prev.bin, next.bin) &&
    prev.selectable === next.selectable &&
    prev.selected === next.selected &&
    prev.index === next.index &&
    prev.onSelect === next.onSelect &&
    prev.searchQuery === next.searchQuery
  );
}
