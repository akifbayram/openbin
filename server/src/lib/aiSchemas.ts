import { z } from 'zod';

/** Schema for an AI-suggested item with optional quantity. */
const AiItemSchema = z.object({
  name: z.string(),
  quantity: z.number().nullable().optional(),
});

/** Schema for image analysis results. Used with generateObject() in aiProviders.ts. */
export const AiSuggestionsSchema = z.object({
  name: z.string(),
  items: z.array(AiItemSchema),
  tags: z.array(z.string()),
  customFields: z.record(z.string(), z.string()).optional(),
});

/** Schema for structure-text results. Used with generateObject() in structureText.ts. */
export const StructureTextSchema = z.object({
  items: z.array(AiItemSchema),
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
