import { apiFetch } from '@/lib/api';
import { mapCommandErrorMessage } from './useCommand';

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

export async function queryInventoryText(options: {
  question: string;
  locationId: string;
}): Promise<QueryResult> {
  return apiFetch<QueryResult>('/api/ai/query', {
    method: 'POST',
    body: {
      question: options.question,
      locationId: options.locationId,
    },
  });
}

export { mapCommandErrorMessage };
