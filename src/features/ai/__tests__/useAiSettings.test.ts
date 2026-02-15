import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('@/lib/api', () => {
  class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
    }
  }
  return { apiFetch: vi.fn(), ApiError };
});

vi.mock('@/lib/auth', () => ({
  useAuth: vi.fn(() => ({
    token: 'test-token',
  })),
}));

import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useAiSettings, saveAiSettings, deleteAiSettings, testAiConnection } from '../useAiSettings';

const mockApiFetch = vi.mocked(apiFetch);
const mockUseAuth = vi.mocked(useAuth);

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({
    token: 'test-token',
  } as ReturnType<typeof useAuth>);
});

describe('useAiSettings', () => {
  it('fetches settings when token is present', async () => {
    const settings = {
      id: 'ai-1',
      provider: 'openai' as const,
      apiKey: 'sk-test',
      model: 'gpt-4',
      endpointUrl: null,
      customPrompt: null,
      commandPrompt: null,
      queryPrompt: null,
      structurePrompt: null,
      providerConfigs: {
        openai: { apiKey: 'sk-test', model: 'gpt-4', endpointUrl: null },
      },
    };
    mockApiFetch.mockResolvedValue(settings);

    const { result } = renderHook(() => useAiSettings());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.settings).toEqual(settings);
    expect(mockApiFetch).toHaveBeenCalledWith('/api/ai/settings');
  });

  it('returns null settings when no token', async () => {
    mockUseAuth.mockReturnValue({ token: null } as ReturnType<typeof useAuth>);

    const { result } = renderHook(() => useAiSettings());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.settings).toBeNull();
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it('handles 404 error by keeping settings null', async () => {
    // Import ApiError from the mocked module
    const { ApiError } = await import('@/lib/api');
    mockApiFetch.mockRejectedValue(new ApiError(404, 'Not found'));

    const { result } = renderHook(() => useAiSettings());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.settings).toBeNull();
  });
});

describe('saveAiSettings', () => {
  it('PUTs with provider, apiKey, model, and endpointUrl', async () => {
    const opts = { provider: 'openai' as const, apiKey: 'sk-test', model: 'gpt-4', endpointUrl: 'https://custom.api' };
    const saved = { id: 'ai-1', ...opts };
    mockApiFetch.mockResolvedValue(saved);

    const result = await saveAiSettings(opts);

    expect(result).toEqual(saved);
    expect(mockApiFetch).toHaveBeenCalledWith('/api/ai/settings', {
      method: 'PUT',
      body: opts,
    });
  });
});

describe('deleteAiSettings', () => {
  it('calls DELETE endpoint', async () => {
    mockApiFetch.mockResolvedValue(undefined);

    await deleteAiSettings();

    expect(mockApiFetch).toHaveBeenCalledWith('/api/ai/settings', { method: 'DELETE' });
  });
});

describe('testAiConnection', () => {
  it('POSTs with settings object', async () => {
    const opts = { provider: 'anthropic' as const, apiKey: 'sk-ant', model: 'claude-3', endpointUrl: undefined };
    mockApiFetch.mockResolvedValue(undefined);

    await testAiConnection(opts);

    expect(mockApiFetch).toHaveBeenCalledWith('/api/ai/test', {
      method: 'POST',
      body: opts,
    });
  });
});
