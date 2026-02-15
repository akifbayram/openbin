import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

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

import { apiFetch, ApiError } from '@/lib/api';
import { parseCommandText, useCommand, mapCommandErrorMessage } from '../useCommand';

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
    expect(mapCommandErrorMessage(new ApiError(422, 'fail'))).toBe('Check your API key and model name');
  });

  it('maps 429 to rate limit message', () => {
    expect(mapCommandErrorMessage(new ApiError(429, 'fail'))).toBe('Rate limited \u2014 try again in a moment');
  });

  it('maps 502 to provider error message', () => {
    expect(mapCommandErrorMessage(new ApiError(502, 'fail'))).toBe('AI provider error \u2014 check your settings');
  });

  it('maps unknown error to generic message', () => {
    expect(mapCommandErrorMessage(new TypeError('oops'))).toBe('Failed to parse command');
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

    expect(result.current.error).toBe('AI provider error \u2014 check your settings');
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
