import { callAiProvider } from './aiCaller.js';
import type { AiProviderConfig } from './aiCaller.js';
import { DEFAULT_STRUCTURE_PROMPT } from './defaultPrompts.js';

export interface StructureTextRequest {
  text: string;
  mode: 'items';
  context?: {
    binName?: string;
    existingItems?: string[];
  };
}

export interface StructureTextResult {
  items: string[];
}

function buildPrompt(request: StructureTextRequest, customPrompt?: string): string {
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
  let items: string[] = [];
  if (Array.isArray(obj.items)) {
    items = obj.items
      .filter((i): i is string => typeof i === 'string')
      .map((i) => i.trim())
      .filter(Boolean)
      .slice(0, 500);
  }
  return { items };
}

export async function structureText(
  config: AiProviderConfig,
  request: StructureTextRequest,
  customPrompt?: string
): Promise<StructureTextResult> {
  return callAiProvider({
    config,
    systemPrompt: buildPrompt(request, customPrompt),
    userContent: request.text,
    temperature: 0.2,
    maxTokens: 800,
    validate: validateItems,
  });
}
