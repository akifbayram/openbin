import { query } from '../db.js';
import type { AiProviderConfig, AiProviderType } from './aiCaller.js';
import { type AiTaskGroup, getEnvAiConfig, getEnvGroupOverride } from './config.js';
import { decryptApiKey } from './crypto.js';

export type { AiTaskGroup } from './config.js';

/** Maps each AI route task key to its task group. */
export const TASK_GROUP_MAP: Record<string, AiTaskGroup> = {
  'analysis': 'vision',
  'analyze-image': 'vision',
  'command': 'quickText',
  'execute': 'quickText',
  'structure': 'quickText',
  'structure-text': 'quickText',
  'query': 'deepText',
  'reorganization': 'deepText',
};

/**
 * Resolve the AI provider config for a specific task group.
 *
 * Resolution order per field (first non-null wins):
 * 1. Env group override (AI_VISION_MODEL, etc.)
 * 2. DB task override (user_ai_task_overrides row)
 * 3. Env default (AI_MODEL, etc.)
 * 4. DB user default — uses `fallbackConfig` when provided (avoids duplicate query)
 */
export async function resolveTaskConfig(
  userId: string,
  group: AiTaskGroup,
  fallbackConfig?: AiProviderConfig,
): Promise<AiProviderConfig> {
  // Layer 1: env group override
  const envGroup = getEnvGroupOverride(group);

  // Layer 2: DB task override
  const dbOverride = await query(
    'SELECT provider, api_key, model, endpoint_url FROM user_ai_task_overrides WHERE user_id = $1 AND task_group = $2',
    [userId, group],
  );
  const dbRow = dbOverride.rows[0] ?? null;

  // Layer 3: env default
  const envDefault = getEnvAiConfig();

  // Layer 4: DB user default — prefer caller-provided fallback to avoid re-querying
  let layer4: AiProviderConfig | null = fallbackConfig ?? null;

  if (!layer4) {
    const needsDbDefault =
      !(envGroup.provider && envGroup.apiKey && envGroup.model) &&
      !(dbRow?.provider && dbRow?.api_key && dbRow?.model) &&
      !envDefault;

    if (needsDbDefault) {
      const dbDefaultResult = await query<{ provider: string; api_key: string; model: string; endpoint_url: string | null }>(
        'SELECT provider, api_key, model, endpoint_url FROM user_ai_settings WHERE user_id = $1 AND is_active = TRUE',
        [userId],
      );
      const row = dbDefaultResult.rows[0];
      if (row) {
        layer4 = { provider: row.provider as AiProviderType, apiKey: decryptApiKey(row.api_key), model: row.model, endpointUrl: row.endpoint_url };
      }
    }
  }

  // Resolve each field through the cascade
  const provider =
    envGroup.provider ??
    dbRow?.provider ??
    envDefault?.provider ??
    layer4?.provider ??
    null;

  const apiKey =
    envGroup.apiKey ??
    (dbRow?.api_key ? decryptApiKey(dbRow.api_key) : null) ??
    envDefault?.apiKey ??
    layer4?.apiKey ??
    null;

  const model =
    envGroup.model ??
    dbRow?.model ??
    envDefault?.model ??
    layer4?.model ??
    null;

  const endpointUrl =
    envGroup.endpointUrl ??
    dbRow?.endpoint_url ??
    envDefault?.endpointUrl ??
    layer4?.endpointUrl ??
    null;

  if (!provider || !apiKey || !model) {
    const { NoAiSettingsError } = await import('./aiSettings.js');
    throw new NoAiSettingsError();
  }

  return {
    provider: provider as AiProviderType,
    apiKey,
    model,
    endpointUrl: endpointUrl ?? null,
  };
}
