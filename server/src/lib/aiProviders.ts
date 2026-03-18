import { generateObject } from 'ai';
import type { AiProviderConfig } from './aiCaller.js';
import { mapSdkError, validateEndpointUrl } from './aiCaller.js';
import { AiSuggestionsSchema } from './aiSchemas.js';
import type { CustomFieldDef } from './customFieldHelpers.js';
import { AI_CORRECTION_PROMPT, DEFAULT_AI_PROMPT } from './defaultPrompts.js';
import { createSdkModel } from './sdkProviderFactory.js';


export interface AiSuggestedItem {
  name: string;
  quantity?: number | null;
}

/** Normalize a raw AI items array into typed AiSuggestedItem[]. Accepts strings or {name, quantity} objects. */
export function normalizeAiItems(raw: unknown[]): AiSuggestedItem[] {
  return raw
    .map((i): AiSuggestedItem | null => {
      if (typeof i === 'string') {
        const name = i.trim();
        return name ? { name } : null;
      }
      if (i && typeof i === 'object' && typeof (i as Record<string, unknown>).name === 'string') {
        const name = ((i as Record<string, unknown>).name as string).trim();
        const rawQty = (i as Record<string, unknown>).quantity;
        const quantity = typeof rawQty === 'number' && rawQty > 0 ? rawQty : null;
        return name ? { name, quantity } : null;
      }
      return null;
    })
    .filter((i): i is AiSuggestedItem => i !== null);
}

export interface AiSuggestionsResult {
  name: string;
  items: AiSuggestedItem[];
  tags: string[];
  notes: string;
  customFields?: Record<string, string>;
}

export interface ImageInput {
  base64: string;
  mimeType: string;
}

function buildTagBlock(existingTags?: string[]): string {
  if (!existingTags || existingTags.length === 0) return '';
  return `EXISTING TAGS in this inventory: [${existingTags.join(', ')}]
You MUST use tags from this list whenever they are even loosely relevant. Do NOT create synonyms, abbreviations, or variations of existing tags (e.g., if "tools" exists, never output "tool", "tooling", or "hand-tools"). Only create a new tag when the bin's contents represent a category not covered by ANY existing tag. New tags should be rare.`;
}

function appendCustomFieldsDef(prompt: string, customFieldDefs?: CustomFieldDef[]): string {
  if (!customFieldDefs || customFieldDefs.length === 0) return prompt;
  const fieldList = customFieldDefs.map((f) => `"${f.name}" (id: ${f.id})`).join(', ');
  return `${prompt}\n\nCUSTOM FIELDS defined for this location: [${fieldList}]
If any of these fields are relevant to the bin's contents, include a "customFields" object in your response mapping field IDs to suggested values. Only include fields where you can provide a meaningful value.`;
}

function injectTagBlock(basePrompt: string, tagBlock: string): string {
  if (!tagBlock) return basePrompt.replace(/\{available_tags\}/g, '');
  if (basePrompt.includes('{available_tags}')) return basePrompt.replace(/\{available_tags\}/g, tagBlock);
  return `${basePrompt}\n\n${tagBlock}`;
}

export function buildSystemPrompt(existingTags?: string[], customPrompt?: string | null, customFieldDefs?: CustomFieldDef[]): string {
  const basePrompt = customPrompt || DEFAULT_AI_PROMPT;
  const prompt = injectTagBlock(basePrompt, buildTagBlock(existingTags));
  return appendCustomFieldsDef(prompt, customFieldDefs);
}

export function buildCorrectionPrompt(existingTags?: string[], customFieldDefs?: CustomFieldDef[]): string {
  const prompt = injectTagBlock(AI_CORRECTION_PROMPT, buildTagBlock(existingTags));
  return appendCustomFieldsDef(prompt, customFieldDefs);
}

function validateSuggestions(raw: unknown): AiSuggestionsResult {
  const obj = raw as Record<string, unknown>;

  let name = typeof obj.name === 'string' ? obj.name.trim() : '';
  if (name.length > 255) name = name.slice(0, 255);

  let items: AiSuggestedItem[] = [];
  if (Array.isArray(obj.items)) {
    items = normalizeAiItems(obj.items).slice(0, 100);
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

  let customFields: Record<string, string> | undefined;
  if (obj.customFields && typeof obj.customFields === 'object' && !Array.isArray(obj.customFields)) {
    customFields = {};
    for (const [key, value] of Object.entries(obj.customFields as Record<string, unknown>)) {
      if (typeof value === 'string' && value.trim()) {
        customFields[key] = value.trim().slice(0, 2000);
      }
    }
    if (Object.keys(customFields).length === 0) customFields = undefined;
  }

  return { name, items, tags, notes, customFields };
}

/** Default maxOutputTokens for image analysis (single image). */
export const IMAGE_TOKENS_SINGLE = 2500;
/** Default maxOutputTokens for image analysis (multiple images). */
export const IMAGE_TOKENS_MULTI = 3000;

export interface AiOverrides {
  temperature?: number | null;
  max_tokens?: number | null;
  top_p?: number | null;
  request_timeout?: number | null;
}

/** Build the user-facing prompt text for image analysis. */
export function buildAnalysisUserText(imageCount: number): string {
  return imageCount > 1
    ? `Catalog the contents of this storage bin. ${imageCount} photos attached showing different angles of the same bin.`
    : 'Catalog the contents of this storage bin.';
}

export async function analyzeImages(
  config: AiProviderConfig,
  images: ImageInput[],
  existingTags?: string[],
  customPrompt?: string | null,
  overrides?: AiOverrides
): Promise<AiSuggestionsResult> {
  // SSRF protection: validate user-supplied endpoint URLs before making requests
  if (config.endpointUrl) {
    await validateEndpointUrl(config.endpointUrl);
  }

  const model = createSdkModel(config);

  const userText = buildAnalysisUserText(images.length);

  const imageParts = images.map((img) => ({
    type: 'image' as const,
    image: Buffer.from(img.base64, 'base64'),
    mimeType: img.mimeType,
  }));

  try {
    const result = await generateObject({
      model,
      schema: AiSuggestionsSchema,
      system: buildSystemPrompt(existingTags, customPrompt),
      messages: [{
        role: 'user' as const,
        content: [...imageParts, { type: 'text' as const, text: userText }],
      }],
      maxOutputTokens: overrides?.max_tokens ?? (images.length > 1 ? IMAGE_TOKENS_MULTI : IMAGE_TOKENS_SINGLE),
      temperature: overrides?.temperature ?? 0.3,
      topP: overrides?.top_p ?? undefined,
      abortSignal: overrides?.request_timeout
        ? AbortSignal.timeout(overrides.request_timeout * 1000)
        : undefined,
    });
    // Post-process with existing business rule sanitizer
    return validateSuggestions(result.object);
  } catch (err) {
    throw mapSdkError(err);
  }
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

