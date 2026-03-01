import type { AiProviderConfig, MultimodalContent } from './aiCaller.js';
import { callAiProvider, testProviderConnection } from './aiCaller.js';
import { DEFAULT_AI_PROMPT } from './defaultPrompts.js';

export type { AiProviderConfig, AiProviderType } from './aiCaller.js';
// Re-export types that other modules import from here
export { AiAnalysisError, stripCodeFences } from './aiCaller.js';

export interface AiSuggestionsResult {
  name: string;
  items: string[];
  tags: string[];
  notes: string;
}

export interface ImageInput {
  base64: string;
  mimeType: string;
}

function buildSystemPrompt(existingTags?: string[], customPrompt?: string | null): string {
  const basePrompt = customPrompt || DEFAULT_AI_PROMPT;

  if (!existingTags || existingTags.length === 0) {
    return basePrompt.replace(/\{available_tags\}/g, '');
  }

  const tagBlock = `EXISTING TAGS in this inventory: [${existingTags.join(', ')}]
When a relevant existing tag fits the bin's contents, reuse it instead of creating a new synonym. Only create new tags when no existing tag is appropriate.`;

  if (basePrompt.includes('{available_tags}')) {
    return basePrompt.replace(/\{available_tags\}/g, tagBlock);
  }

  return `${basePrompt}\n\n${tagBlock}`;
}

function validateSuggestions(raw: unknown): AiSuggestionsResult {
  const obj = raw as Record<string, unknown>;

  let name = typeof obj.name === 'string' ? obj.name.trim() : '';
  if (name.length > 255) name = name.slice(0, 255);

  let items: string[] = [];
  if (Array.isArray(obj.items)) {
    items = obj.items
      .filter((i): i is string => typeof i === 'string')
      .map((i) => i.trim())
      .filter(Boolean)
      .slice(0, 100);
  }

  let tags: string[] = [];
  if (Array.isArray(obj.tags)) {
    tags = obj.tags
      .filter((t): t is string => typeof t === 'string')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 20);
  }

  let notes = typeof obj.notes === 'string' ? obj.notes.trim() : '';
  if (notes.length > 2000) notes = notes.slice(0, 2000);

  return { name, items, tags, notes };
}

export interface AiOverrides {
  temperature?: number | null;
  max_tokens?: number | null;
  top_p?: number | null;
  request_timeout?: number | null;
}

export async function analyzeImages(
  config: AiProviderConfig,
  images: ImageInput[],
  existingTags?: string[],
  customPrompt?: string | null,
  overrides?: AiOverrides
): Promise<AiSuggestionsResult> {
  const userText = images.length > 1
    ? `Catalog the contents of this storage bin. ${images.length} photos attached showing different angles of the same bin.`
    : 'Catalog the contents of this storage bin.';

  const userContent: MultimodalContent[] = [
    ...images.map((img) => ({ type: 'image' as const, base64: img.base64, mimeType: img.mimeType })),
    { type: 'text' as const, text: userText },
  ];

  return callAiProvider({
    config,
    systemPrompt: buildSystemPrompt(existingTags, customPrompt),
    userContent,
    temperature: overrides?.temperature ?? 0.3,
    maxTokens: overrides?.max_tokens ?? (images.length > 1 ? 2000 : 1500),
    topP: overrides?.top_p ?? undefined,
    timeoutMs: overrides?.request_timeout ? overrides.request_timeout * 1000 : undefined,
    validate: validateSuggestions,
  });
}

export async function analyzeImage(
  config: AiProviderConfig,
  imageBase64: string,
  mimeType: string,
  existingTags?: string[],
  customPrompt?: string | null,
  overrides?: AiOverrides
): Promise<AiSuggestionsResult> {
  return analyzeImages(config, [{ base64: imageBase64, mimeType }], existingTags, customPrompt, overrides);
}

export async function testConnection(config: AiProviderConfig): Promise<void> {
  return testProviderConnection(config);
}
