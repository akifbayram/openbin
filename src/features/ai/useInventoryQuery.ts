export interface QueryMatch {
  bin_id: string;
  name: string;
  area_name: string;
  items: string[];
  tags: string[];
  relevance: string;
}

export interface QueryResult {
  answer: string;
  matches: QueryMatch[];
}
