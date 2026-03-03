import { z } from 'zod';

/** Schema for image analysis results. Used with generateObject() in aiProviders.ts. */
export const AiSuggestionsSchema = z.object({
  name: z.string(),
  items: z.array(z.string()),
  tags: z.array(z.string()),
  notes: z.string(),
});

/** Schema for structure-text results. Used with generateObject() in structureText.ts. */
export const StructureTextSchema = z.object({
  items: z.array(z.string()),
});
