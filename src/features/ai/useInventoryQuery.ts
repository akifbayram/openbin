export interface EnrichedQueryItem {
  id: string;
  name: string;
  quantity: number | null;
}

export interface QueryMatch {
  bin_id: string;
  name: string;
  area_name: string;
  items: EnrichedQueryItem[];
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
