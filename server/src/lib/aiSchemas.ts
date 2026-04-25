import { z } from 'zod';

/** Schema for an AI-suggested item with optional quantity. */
const AiItemSchema = z.object({
  name: z.string(),
  quantity: z.number().nullable().optional(),
});

/** Schema for image analysis results. */
export const AiSuggestionsSchema = z.object({
  name: z.string(),
  items: z.array(AiItemSchema),
});

/** Schema for structure-text results. Used with generateObject() in structureText.ts. */
export const StructureTextSchema = z.object({
  items: z.array(AiItemSchema),
});

/** Schema for inventory query results. Used with Output.object() in aiStream.ts. */
export const QueryResultSchema = z.object({
  answer: z.string(),
  matches: z.array(z.object({
    bin_code: z.string(),
    name: z.string(),
    area_name: z.string(),
    items: z.array(z.string()),
    tags: z.array(z.string()),
    relevance: z.string(),
    is_trashed: z.boolean().optional(),
  })),
});

const TagStringSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,99}$/);

export const TagProposalSchema = z.object({
  taxonomy: z.object({
    newTags: z.array(z.object({
      tag: TagStringSchema,
      parent: TagStringSchema.nullable().optional(),
    })),
    renames: z.array(z.object({
      from: TagStringSchema,
      to: TagStringSchema,
    })),
    merges: z.array(z.object({
      from: z.array(TagStringSchema).min(1),
      to: TagStringSchema,
    })),
    parents: z.array(z.object({
      tag: TagStringSchema,
      parent: TagStringSchema.nullable(),
    })),
  }),
  assignments: z.array(z.object({
    binId: z.string().regex(/^[a-zA-Z0-9-]{1,36}$/),
    add: z.array(TagStringSchema),
    remove: z.array(TagStringSchema),
  })),
  summary: z.string(),
});

export type TagProposal = z.infer<typeof TagProposalSchema>;
