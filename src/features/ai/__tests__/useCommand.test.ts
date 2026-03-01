import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

import { ApiError, apiFetch } from '@/lib/api';
import { mapCommandErrorMessage, parseCommandText, useCommand } from '../useCommand';

const mockApiFetch = vi.mocked(apiFetch);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('parseCommandText', () => {
  it('sends text and locationId to API and returns result', async () => {
    const mockResult = {
      actions: [{ type: 'add_items', bin_id: 'b1', bin_name: 'Tools', items: ['Screwdriver'] }],
      interpretation: 'Add screwdriver to Tools bin',
    };
    mockApiFetch.mockResolvedValue(mockResult);

    const result = await parseCommandText({ text: 'add screwdriver to tools', locationId: 'loc-1' });

    expect(result).toEqual(mockResult);
    expect(mockApiFetch).toHaveBeenCalledWith('/api/ai/command', {
      method: 'POST',
      body: {
        text: 'add screwdriver to tools',
        locationId: 'loc-1',
      },
    });
  });
});

describe('mapCommandErrorMessage', () => {
  it('maps 422 to API key message', () => {
    expect(mapCommandErrorMessage(new ApiError(422, 'fail'))).toBe('Invalid API key or model — check Settings > AI');
  });

  it('maps 429 to rate limit message', () => {
    expect(mapCommandErrorMessage(new ApiError(429, 'fail'))).toBe('AI provider rate limited — wait a moment and try again');
  });

  it('maps 502 to provider error message', () => {
    expect(mapCommandErrorMessage(new ApiError(502, 'fail'))).toBe('Your AI provider returned an error — verify your settings');
  });

  it('maps unknown error to generic message', () => {
    expect(mapCommandErrorMessage(new TypeError('oops'))).toBe('Couldn\'t understand that command — try rephrasing');
  });
});

describe('useCommand', () => {
  it('parses command and returns actions', async () => {
    const mockResult = {
      actions: [{ type: 'add_items', bin_id: 'b1', bin_name: 'Tools', items: ['Hammer'] }],
      interpretation: 'Add hammer to Tools',
    };
    mockApiFetch.mockResolvedValue(mockResult);

    const { result } = renderHook(() => useCommand());

    expect(result.current.isParsing).toBe(false);
    expect(result.current.actions).toBeNull();

    await act(async () => {
      await result.current.parse({ text: 'add hammer to tools', locationId: 'loc-1' });
    });

    expect(result.current.isParsing).toBe(false);
    expect(result.current.actions).toEqual(mockResult.actions);
    expect(result.current.interpretation).toBe('Add hammer to Tools');
    expect(result.current.error).toBeNull();
  });

  it('sets error on failure', async () => {
    mockApiFetch.mockRejectedValue(new ApiError(502, 'Bad gateway'));

    const { result } = renderHook(() => useCommand());

    await act(async () => {
      await result.current.parse({ text: 'do something', locationId: 'loc-1' });
    });

    expect(result.current.error).toBe('Your AI provider returned an error — verify your settings');
    expect(result.current.actions).toBeNull();
  });

  it('clearCommand resets state', async () => {
    const mockResult = {
      actions: [{ type: 'delete_bin', bin_id: 'b1', bin_name: 'Old Bin' }],
      interpretation: 'Delete Old Bin',
    };
    mockApiFetch.mockResolvedValue(mockResult);

    const { result } = renderHook(() => useCommand());

    await act(async () => {
      await result.current.parse({ text: 'delete old bin', locationId: 'loc-1' });
    });

    expect(result.current.actions).toEqual(mockResult.actions);

    act(() => {
      result.current.clearCommand();
    });

    expect(result.current.actions).toBeNull();
    expect(result.current.interpretation).toBeNull();
    expect(result.current.error).toBeNull();
  });
});
