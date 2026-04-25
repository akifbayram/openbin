import { resolvePrompt, withHardening } from './aiSanitize.js';
import { AI_CORRECTION_PROMPT, AI_REANALYSIS_PROMPT, DEFAULT_AI_PROMPT } from './defaultPrompts.js';

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

/** Build a tag-reuse instruction block from existing tags. */
export function buildTagBlock(existingTags?: string[]): string {
  if (!existingTags || existingTags.length === 0) return '';
  return `EXISTING TAGS in this inventory: [${existingTags.join(', ')}]
You MUST use tags from this list whenever they are even loosely relevant. Do NOT create synonyms, abbreviations, or variations of existing tags (e.g., if "tools" exists, never output "tool", "tooling", or "hand-tools"). Only create a new tag when the bin's contents represent a category not covered by ANY existing tag. New tags should be rare.`;
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
): Array<{ type: 'image'; image: Buffer; mimeType: string } | { type: 'text'; text: string }> {
  const contextText = `Previous analysis result:\n${JSON.stringify(previousResult, null, 2)}\n\nRe-examine these photos. Be more thorough than last time.`;
  return [
    { type: 'text' as const, text: contextText },
    ...imageParts,
  ];
}

/** Default maxOutputTokens for image analysis (single image). */
export const IMAGE_TOKENS_SINGLE = 10000;
/** Default maxOutputTokens for image analysis (multiple images). */
export const IMAGE_TOKENS_MULTI = 10000;

/** Build the user-facing prompt text for image analysis. */
export function buildAnalysisUserText(imageCount: number): string {
  return imageCount > 1
    ? `Catalog the contents of this storage bin. ${imageCount} photos attached showing different angles of the same bin.`
    : 'Catalog the contents of this storage bin.';
}
