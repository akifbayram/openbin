import { type AiTaskGroup, config } from './config.js';

/**
 * Per-call credit cost for each AI task class. Flat per-unit pricing,
 * sized so plan caps line up with measured Gemini 3 Flash Preview spend
 * after Lever-1 (`thinkingLevel='minimal'`):
 *
 *   quickText:  1                  (per request — chat/command/query/etc)
 *   vision:     5 × image_count    (no batch discount; encoding overhead small)
 *   reorganize: 2 × bin_count      (no base fee; system-prompt overhead amortized into plan caps)
 *
 * Mental model: "1 per chat, 5 per photo, 2 per bin." Both helpers floor
 * their inputs at 1 (vision) / 0 (reorganize) so a malformed request
 * still produces a positive charge instead of a free call.
 *
 * Defaults are overridable via `AI_WEIGHT_QUICKTEXT`, `AI_WEIGHT_VISION`,
 * and `AI_WEIGHT_DEEPTEXT` env vars (see config.ts).
 */
export const AI_CREDIT_WEIGHTS: Record<AiTaskGroup, number> = {
  quickText: config.aiWeightQuickText,
  vision: config.aiWeightVision,
  deepText: config.aiWeightDeepText,
};

export function visionWeight(imageCount: number): number {
  const n = Math.max(1, Math.ceil(imageCount));
  return AI_CREDIT_WEIGHTS.vision * n;
}

export function reorganizeWeight(binCount: number): number {
  const n = Math.max(0, Math.ceil(binCount));
  return AI_CREDIT_WEIGHTS.deepText * n;
}
