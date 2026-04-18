import type { BinItem } from '@/types';

export type EnrichedQueryItem = BinItem;

export interface QueryMatch {
  bin_id: string;
  name: string;
  area_name: string;
  items: EnrichedQueryItem[];
  /** Total items in the bin — may exceed `items.length` when the AI truncated. */
  total_item_count: number;
  tags: string[];
  relevance: string;
  is_trashed?: boolean;
  icon: string;
  color: string;
}

export interface QueryResult {
  answer: string;
  matches: QueryMatch[];
}
