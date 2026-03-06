import { z } from 'zod';

/** Schema for image analysis results. Used with generateObject() in aiProviders.ts. */
export const AiSuggestionsSchema = z.object({
  name: z.string(),
  items: z.array(z.string()),
  tags: z.array(z.string()),
  notes: z.string(),
  customFields: z.record(z.string(), z.string()).optional(),
});

/** Schema for structure-text results. Used with generateObject() in structureText.ts. */
export const StructureTextSchema = z.object({
  items: z.array(z.string()),
});

/** Schema for inventory query results. Used with Output.object() in aiStream.ts. */
export const QueryResultSchema = z.object({
  answer: z.string(),
  matches: z.array(z.object({
    bin_id: z.string(),
    name: z.string(),
    area_name: z.string(),
    items: z.array(z.string()),
    tags: z.array(z.string()),
    relevance: z.string(),
    is_trashed: z.boolean().optional(),
  })),
});
