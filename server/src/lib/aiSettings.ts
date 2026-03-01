import { query } from '../db.js';
import type { AiProviderConfig } from './aiCaller.js';
import { getEnvAiConfig } from './config.js';
import { decryptApiKey } from './crypto.js';

export class NoAiSettingsError extends Error {
  constructor() {
    super('AI not configured. Set up your AI provider first.');
    this.name = 'NoAiSettingsError';
  }
}

export interface UserAiSettings {
  config: AiProviderConfig;
  custom_prompt: string | null;
  command_prompt: string | null;
  query_prompt: string | null;
  structure_prompt: string | null;
  temperature: number | null;
  max_tokens: number | null;
  top_p: number | null;
  request_timeout: number | null;
}

/** Load and decrypt a user's AI settings. Falls back to env config. Throws NoAiSettingsError if neither exist. */
export async function getUserAiSettings(userId: string): Promise<UserAiSettings> {
  const result = await query(
    'SELECT provider, api_key, model, endpoint_url, custom_prompt, command_prompt, query_prompt, structure_prompt, temperature, max_tokens, top_p, request_timeout FROM user_ai_settings WHERE user_id = $1 AND is_active = 1',
    [userId]
  );
  if (result.rows.length === 0) {
    const envConfig = getEnvAiConfig();
    if (envConfig) {
      return {
        config: envConfig,
        custom_prompt: null,
        command_prompt: null,
        query_prompt: null,
        structure_prompt: null,
        temperature: null,
        max_tokens: null,
        top_p: null,
        request_timeout: null,
      };
    }
    throw new NoAiSettingsError();
  }
  const row = result.rows[0];
  return {
    config: {
      provider: row.provider,
      apiKey: decryptApiKey(row.api_key),
      model: row.model,
      endpointUrl: row.endpoint_url,
    },
    custom_prompt: row.custom_prompt || null,
    command_prompt: row.command_prompt || null,
    query_prompt: row.query_prompt || null,
    structure_prompt: row.structure_prompt || null,
    temperature: row.temperature ?? null,
    max_tokens: row.max_tokens ?? null,
    top_p: row.top_p ?? null,
    request_timeout: row.request_timeout ?? null,
  };
}

export function aiErrorToStatus(code: string): number {
  switch (code) {
    case 'INVALID_KEY': return 422;
    case 'RATE_LIMITED': return 429;
    case 'MODEL_NOT_FOUND': return 422;
    case 'INVALID_RESPONSE': return 502;
    case 'NETWORK_ERROR': return 502;
    case 'PROVIDER_ERROR': return 502;
    default: return 500;
  }
}
