import { generateObject } from 'ai';
import type { AiProviderConfig } from './aiCaller.js';
import { createPinnedFetch, mapSdkError, validateEndpointUrl } from './aiCaller.js';
import { resolvePrompt, validateAiOutput, withHardening } from './aiSanitize.js';
import { AiSuggestionsSchema } from './aiSchemas.js';
import type { CustomFieldDef } from './customFieldHelpers.js';
import { AI_CORRECTION_PROMPT, AI_REANALYSIS_PROMPT, DEFAULT_AI_PROMPT } from './defaultPrompts.js';
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

interface AiSuggestionsResult {
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

/** Build a tag-reuse instruction block from existing tags. */
export function buildTagBlock(existingTags?: string[]): string {
  if (!existingTags || existingTags.length === 0) return '';
  return `EXISTING TAGS in this inventory: [${existingTags.join(', ')}]
You MUST use tags from this list whenever they are even loosely relevant. Do NOT create synonyms, abbreviations, or variations of existing tags (e.g., if "tools" exists, never output "tool", "tooling", or "hand-tools"). Only create a new tag when the bin's contents represent a category not covered by ANY existing tag. New tags should be rare.`;
}

function buildCustomFieldsBlock(customFieldDefs?: CustomFieldDef[]): string {
  if (!customFieldDefs || customFieldDefs.length === 0) return '';
  const fieldList = customFieldDefs.map((f) => `"${f.name}" (id: ${f.id})`).join(', ');
  return `CUSTOM FIELDS defined for this location: [${fieldList}]
If any of these fields are relevant to the bin's contents, include a "customFields" object in your response mapping field IDs to suggested values. Only include fields where you can provide a meaningful value.`;
}

/** Build a user-message preamble with per-request tag and custom-field context. */
export function buildContextPreamble(existingTags?: string[], customFieldDefs?: CustomFieldDef[]): string {
  const parts: string[] = [];
  const tagBlock = buildTagBlock(existingTags);
  if (tagBlock) parts.push(tagBlock);
  const cfBlock = buildCustomFieldsBlock(customFieldDefs);
  if (cfBlock) parts.push(cfBlock);
  return parts.length > 0 ? `${parts.join('\n\n')}\n\n` : '';
}

function stripTagPlaceholder(prompt: string): string {
  return prompt.replace(/\{available_tags\}/g, '');
}

export function buildSystemPrompt(customPrompt?: string | null, isDemoUser?: boolean): string {
  const basePrompt = resolvePrompt(DEFAULT_AI_PROMPT, customPrompt, isDemoUser);
  return withHardening(stripTagPlaceholder(basePrompt));
}

export function buildCorrectionPrompt(): string {
  return withHardening(stripTagPlaceholder(AI_CORRECTION_PROMPT));
}

export function buildReanalysisPrompt(): string {
  return withHardening(stripTagPlaceholder(AI_REANALYSIS_PROMPT));
}

/** Build the user-facing content parts for a reanalysis request (previous result JSON + instruction + images). */
export function buildReanalysisUserContent(
  previousResult: object,
  imageParts: Array<{ type: 'image'; image: Buffer; mimeType: string }>,
  contextPreamble?: string,
): Array<{ type: 'image'; image: Buffer; mimeType: string } | { type: 'text'; text: string }> {
  const contextText = `${contextPreamble ?? ''}Previous analysis result:\n${JSON.stringify(previousResult, null, 2)}\n\nRe-examine these photos. Be more thorough than last time.`;
  return [
    { type: 'text' as const, text: contextText },
    ...imageParts,
  ];
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

  return validateAiOutput({ name, items, tags, notes, customFields });
}

/** Default maxOutputTokens for image analysis (single image). */
export const IMAGE_TOKENS_SINGLE = 5000;
/** Default maxOutputTokens for image analysis (multiple images). */
export const IMAGE_TOKENS_MULTI = 10000;

interface AiOverrides {
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
  overrides?: AiOverrides,
  isDemoUser?: boolean
): Promise<AiSuggestionsResult> {
  // SSRF protection: validate user-supplied endpoint URLs before making requests
  const resolvedIps = config.endpointUrl
    ? await validateEndpointUrl(config.endpointUrl, isDemoUser)
    : undefined;
  const pinnedFetch = resolvedIps ? createPinnedFetch(resolvedIps) : undefined;

  const model = createSdkModel(config, pinnedFetch);

  const preamble = buildContextPreamble(existingTags);
  const userText = preamble + buildAnalysisUserText(images.length);

  const imageParts = images.map((img) => ({
    type: 'image' as const,
    image: Buffer.from(img.base64, 'base64'),
    mimeType: img.mimeType,
  }));

  try {
    const result = await generateObject({
      model,
      schema: AiSuggestionsSchema,
      system: buildSystemPrompt(customPrompt, isDemoUser),
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

export async function reanalyzeImages(
  config: AiProviderConfig,
  images: ImageInput[],
  previousResult: object,
  existingTags?: string[],
  customFieldDefs?: CustomFieldDef[],
  overrides?: AiOverrides,
  isDemoUser?: boolean
): Promise<AiSuggestionsResult> {
  const resolvedIps = config.endpointUrl
    ? await validateEndpointUrl(config.endpointUrl, isDemoUser)
    : undefined;
  const pinnedFetch = resolvedIps ? createPinnedFetch(resolvedIps) : undefined;

  const model = createSdkModel(config, pinnedFetch);

  const imageParts = images.map((img) => ({
    type: 'image' as const,
    image: Buffer.from(img.base64, 'base64'),
    mimeType: img.mimeType,
  }));

  const preamble = buildContextPreamble(existingTags, customFieldDefs);
  const userContent = buildReanalysisUserContent(previousResult, imageParts, preamble);

  try {
    const result = await generateObject({
      model,
      schema: AiSuggestionsSchema,
      system: buildReanalysisPrompt(),
      messages: [{
        role: 'user' as const,
        content: userContent,
      }],
      maxOutputTokens: overrides?.max_tokens ?? (images.length > 1 ? IMAGE_TOKENS_MULTI : IMAGE_TOKENS_SINGLE),
      temperature: overrides?.temperature ?? 0.3,
      topP: overrides?.top_p ?? undefined,
      abortSignal: overrides?.request_timeout
        ? AbortSignal.timeout(overrides.request_timeout * 1000)
        : undefined,
    });
    return validateSuggestions(result.object);
  } catch (err) {
    throw mapSdkError(err);
  }
}
