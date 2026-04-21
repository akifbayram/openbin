import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Module-level mocks (hoisted before imports) ----

vi.mock('../db.js', () => ({
  query: vi.fn(),
}));

vi.mock('../lib/crypto.js', () => ({
  decryptApiKey: vi.fn((stored: string) =>
    stored.startsWith('enc:') ? stored.slice(4) : stored,
  ),
  encryptApiKey: vi.fn((plain: string) => `enc:${plain}`),
}));

vi.mock('../lib/config.js', () => ({
  config: {
    aiProvider: 'openai',
    aiApiKey: 'sk-default',
    aiModel: 'gpt-4o',
    aiEndpointUrl: null,
  },
  hasEnvAiConfig: () => true,
  getEnvAiConfig: () => ({
    provider: 'openai' as const,
    apiKey: 'sk-default',
    model: 'gpt-4o',
    endpointUrl: null,
  }),
  getEnvGroupOverride: vi.fn(() => ({
    provider: null,
    apiKey: null,
    model: null,
    endpointUrl: null,
  })),
  isGroupEnvLocked: vi.fn(() => false),
}));

vi.mock('../lib/aiSettings.js', () => ({
  NoAiSettingsError: class NoAiSettingsError extends Error {
    constructor() {
      super('AI not configured. Set up your AI provider first.');
      this.name = 'NoAiSettingsError';
    }
  },
}));

// ---- Imports (after mocks) ----

import { query } from '../db.js';
import { getEnvGroupOverride } from '../lib/config.js';
import { decryptApiKey } from '../lib/crypto.js';
import { resolveTaskConfig, TASK_GROUP_MAP } from '../lib/taskRouting.js';

// ---- Helpers ----

const mockQuery = vi.mocked(query);
const mockGetEnvGroupOverride = vi.mocked(getEnvGroupOverride);

function emptyResult() {
  return { rows: [], rowCount: 0 };
}

// ---- Tests ----

describe('TASK_GROUP_MAP', () => {
  it('maps all AI tasks to correct groups', () => {
    expect(TASK_GROUP_MAP.analysis).toBe('vision');
    expect(TASK_GROUP_MAP['analyze-image']).toBe('vision');
    expect(TASK_GROUP_MAP.command).toBe('quickText');
    expect(TASK_GROUP_MAP.execute).toBe('quickText');
    expect(TASK_GROUP_MAP.structure).toBe('quickText');
    expect(TASK_GROUP_MAP['structure-text']).toBe('quickText');
    expect(TASK_GROUP_MAP.query).toBe('deepText');
    expect(TASK_GROUP_MAP.reorganization).toBe('deepText');
    expect(TASK_GROUP_MAP.tagSuggestion).toBe('deepText');
  });

  it('covers all expected task keys', () => {
    const keys = Object.keys(TASK_GROUP_MAP);
    expect(keys).toHaveLength(9);
  });
});

describe('resolveTaskConfig()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetEnvGroupOverride.mockReturnValue({
      provider: null,
      apiKey: null,
      model: null,
      endpointUrl: null,
    });
    // Default: no DB overrides, no DB user settings
    mockQuery.mockResolvedValue(emptyResult());
  });

  it('returns env default config when no overrides exist', async () => {
    const result = await resolveTaskConfig('user-1', 'vision');

    expect(result).toEqual({
      provider: 'openai',
      apiKey: 'sk-default',
      model: 'gpt-4o',
      endpointUrl: null,
    });

    // Should query for DB override but not for DB default (env default covers it)
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('user_ai_task_overrides'),
      ['user-1', 'vision'],
    );
  });

  it('returns full DB override when all fields set', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        provider: 'anthropic',
        api_key: 'enc:sk-anthropic-key',
        model: 'claude-3-opus',
        endpoint_url: null,
      }],
      rowCount: 1,
    });

    const result = await resolveTaskConfig('user-1', 'vision');

    expect(result).toEqual({
      provider: 'anthropic',
      apiKey: 'sk-anthropic-key',
      model: 'claude-3-opus',
      endpointUrl: null,
    });
    expect(decryptApiKey).toHaveBeenCalledWith('enc:sk-anthropic-key');
  });

  it('cascades: model-only DB override inherits provider+key from env default', async () => {
    // DB override has only model set
    mockQuery.mockResolvedValueOnce({
      rows: [{
        provider: null,
        api_key: null,
        model: 'gpt-4o-mini',
        endpoint_url: null,
      }],
      rowCount: 1,
    });

    const result = await resolveTaskConfig('user-1', 'quickText');

    expect(result).toEqual({
      provider: 'openai',
      apiKey: 'sk-default',
      model: 'gpt-4o-mini',
      endpointUrl: null,
    });
  });

  it('env group override takes precedence over DB override', async () => {
    // Layer 1: env group has a specific vision model
    mockGetEnvGroupOverride.mockReturnValue({
      provider: 'gemini' as any,
      apiKey: 'gemini-key',
      model: 'gemini-pro-vision',
      endpointUrl: null,
    });

    // Layer 2: DB override exists too
    mockQuery.mockResolvedValueOnce({
      rows: [{
        provider: 'anthropic',
        api_key: 'enc:sk-anthropic-key',
        model: 'claude-3-opus',
        endpoint_url: null,
      }],
      rowCount: 1,
    });

    const result = await resolveTaskConfig('user-1', 'vision');

    // Env group override wins
    expect(result).toEqual({
      provider: 'gemini',
      apiKey: 'gemini-key',
      model: 'gemini-pro-vision',
      endpointUrl: null,
    });
    // DB override row's api_key should not have been decrypted
    expect(decryptApiKey).not.toHaveBeenCalled();
  });

  it('env group model-only cascades other fields from env default', async () => {
    // Env group override sets only model
    mockGetEnvGroupOverride.mockReturnValue({
      provider: null,
      apiKey: null,
      model: 'gpt-4o-vision',
      endpointUrl: null,
    });

    const result = await resolveTaskConfig('user-1', 'vision');

    expect(result).toEqual({
      provider: 'openai',
      apiKey: 'sk-default',
      model: 'gpt-4o-vision',
      endpointUrl: null,
    });
  });

  it('falls back to DB user default when no env default exists', async () => {
    // Override getEnvAiConfig to return null (no env AI config)
    const configMod = await import('../lib/config.js');
    const origGetEnvAiConfig = configMod.getEnvAiConfig;
    vi.spyOn(configMod, 'getEnvAiConfig').mockReturnValue(null);

    // No DB task override
    mockQuery.mockResolvedValueOnce(emptyResult());
    // DB user default
    mockQuery.mockResolvedValueOnce({
      rows: [{
        provider: 'anthropic',
        api_key: 'enc:sk-db-default',
        model: 'claude-3-sonnet',
        endpoint_url: 'https://custom.endpoint.com',
      }],
      rowCount: 1,
    });

    const result = await resolveTaskConfig('user-1', 'deepText');

    expect(result).toEqual({
      provider: 'anthropic',
      apiKey: 'sk-db-default',
      model: 'claude-3-sonnet',
      endpointUrl: 'https://custom.endpoint.com',
    });
    expect(decryptApiKey).toHaveBeenCalledWith('enc:sk-db-default');

    // Second query should be for user_ai_settings
    expect(mockQuery).toHaveBeenCalledTimes(2);
    expect(mockQuery).toHaveBeenNthCalledWith(2,
      expect.stringContaining('user_ai_settings'),
      ['user-1'],
    );

    // Restore
    vi.mocked(configMod.getEnvAiConfig).mockImplementation(origGetEnvAiConfig);
  });

  it('throws NoAiSettingsError when no config is available', async () => {
    const configMod = await import('../lib/config.js');
    const origGetEnvAiConfig = configMod.getEnvAiConfig;
    vi.spyOn(configMod, 'getEnvAiConfig').mockReturnValue(null);

    // No DB task override
    mockQuery.mockResolvedValueOnce(emptyResult());
    // No DB user default
    mockQuery.mockResolvedValueOnce(emptyResult());

    await expect(resolveTaskConfig('user-1', 'vision')).rejects.toThrow(
      'AI not configured. Set up your AI provider first.',
    );

    vi.mocked(configMod.getEnvAiConfig).mockImplementation(origGetEnvAiConfig);
  });
});
