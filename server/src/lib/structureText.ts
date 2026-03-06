import { generateObject } from 'ai';
import type { AiProviderConfig } from './aiCaller.js';
import { mapSdkError, validateEndpointUrl } from './aiCaller.js';
import type { AiSuggestedItem } from './aiProviders.js';
import { normalizeAiItems } from './aiProviders.js';
import { StructureTextSchema } from './aiSchemas.js';
import { DEFAULT_STRUCTURE_PROMPT } from './defaultPrompts.js';
import { createSdkModel } from './sdkProviderFactory.js';

export interface StructureTextRequest {
  text: string;
  mode: 'items';
  context?: {
    binName?: string;
    existingItems?: string[];
  };
}

export interface StructureTextResult {
  items: AiSuggestedItem[];
}

export function buildPrompt(request: StructureTextRequest, customPrompt?: string): string {
  let prompt = customPrompt || DEFAULT_STRUCTURE_PROMPT;

  if (request.context?.binName) {
    prompt += `\n\nBin name: "${request.context.binName}" — use this for context about what type of items to expect.`;
  }

  if (request.context?.existingItems && request.context.existingItems.length > 0) {
    prompt += `\n\nExisting items already in this bin: ${JSON.stringify(request.context.existingItems)}. Do NOT include these in your response — only return NEW items from the dictation.`;
  }

  return prompt;
}

function validateItems(raw: unknown): StructureTextResult {
  const obj = raw as Record<string, unknown>;
  let items: AiSuggestedItem[] = [];
  if (Array.isArray(obj.items)) {
    items = normalizeAiItems(obj.items).slice(0, 500);
  }
  return { items };
}

export interface StructureTextOverrides {
  temperature?: number | null;
  max_tokens?: number | null;
  top_p?: number | null;
  request_timeout?: number | null;
}

export async function structureText(
  config: AiProviderConfig,
  request: StructureTextRequest,
  customPrompt?: string,
  overrides?: StructureTextOverrides
): Promise<StructureTextResult> {
  // SSRF protection: validate user-supplied endpoint URLs before making requests
  if (config.endpointUrl) {
    await validateEndpointUrl(config.endpointUrl);
  }

  const model = createSdkModel(config);

  try {
    const result = await generateObject({
      model,
      schema: StructureTextSchema,
      system: buildPrompt(request, customPrompt),
      messages: [{ role: 'user' as const, content: request.text }],
      maxOutputTokens: overrides?.max_tokens ?? 800,
      temperature: overrides?.temperature ?? 0.2,
      topP: overrides?.top_p ?? undefined,
      abortSignal: overrides?.request_timeout
        ? AbortSignal.timeout(overrides.request_timeout * 1000)
        : undefined,
    });
    // Post-process: business rule sanitization that Zod cannot express
    return validateItems(result.object);
  } catch (err) {
    throw mapSdkError(err);
  }
}
