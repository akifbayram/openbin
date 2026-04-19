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

export const TASK_TYPES = ['analysis', 'command', 'query', 'structure', 'reorganization'] as const;

export type TaskType = (typeof TASK_TYPES)[number];

type TaskModelOverrides = Partial<Record<TaskType, string>>;

/** Parse a raw task_model_overrides value (string or object) into a typed map. */
export function parseTaskModelOverrides(raw: unknown): TaskModelOverrides | null {
  if (!raw) return null;
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : (raw as TaskModelOverrides);
  } catch { return null; }
}

export interface UserAiSettings {
  config: AiProviderConfig;
  custom_prompt: string | null;
  command_prompt: string | null;
  query_prompt: string | null;
  structure_prompt: string | null;
  reorganization_prompt: string | null;
  temperature: number | null;
  max_tokens: number | null;
  top_p: number | null;
  request_timeout: number | null;
  task_model_overrides: TaskModelOverrides | null;
}

/** Return a config with the overridden model for a task, or the default config. */
export function getConfigForTask(settings: UserAiSettings, task: TaskType): AiProviderConfig {
  const override = settings.task_model_overrides?.[task];
  if (override) {
    return { ...settings.config, model: override };
  }
  return settings.config;
}

/** Load and decrypt a user's AI settings. Falls back to env config. Throws NoAiSettingsError if neither exist. */
export async function getUserAiSettings(userId: string): Promise<UserAiSettings> {
  const result = await query(
    'SELECT provider, api_key, model, endpoint_url, custom_prompt, command_prompt, query_prompt, structure_prompt, reorganization_prompt, temperature, max_tokens, top_p, request_timeout, task_model_overrides FROM user_ai_settings WHERE user_id = $1 AND is_active = TRUE',
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
        reorganization_prompt: null,
        temperature: null,
        max_tokens: null,
        top_p: null,
        request_timeout: null,
        task_model_overrides: null,
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
    reorganization_prompt: row.reorganization_prompt || null,
    temperature: row.temperature ?? null,
    max_tokens: row.max_tokens ?? null,
    top_p: row.top_p ?? null,
    request_timeout: row.request_timeout ?? null,
    task_model_overrides: parseTaskModelOverrides(row.task_model_overrides),
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
