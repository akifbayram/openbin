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
import { structureTextItems, useTextStructuring, mapStructureErrorMessage } from '../useTextStructuring';

const mockApiFetch = vi.mocked(apiFetch);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('structureTextItems', () => {
  it('sends text to API and returns items', async () => {
    mockApiFetch.mockResolvedValue({ items: ['Socks (x3)', 'Winter jacket'] });

    const result = await structureTextItems({ text: 'three pairs of socks and a winter jacket' });

    expect(result).toEqual(['Socks (x3)', 'Winter jacket']);
    expect(mockApiFetch).toHaveBeenCalledWith('/api/ai/structure-text', {
      method: 'POST',
      body: {
        text: 'three pairs of socks and a winter jacket',
        mode: 'items',
        context: undefined,
        locationId: undefined,
      },
    });
  });

  it('passes context and locationId', async () => {
    mockApiFetch.mockResolvedValue({ items: ['Hammer'] });

    await structureTextItems({
      text: 'a hammer',
      context: { binName: 'Tools', existingItems: ['Wrench'] },
      locationId: 'loc-1',
    });

    expect(mockApiFetch).toHaveBeenCalledWith('/api/ai/structure-text', {
      method: 'POST',
      body: {
        text: 'a hammer',
        mode: 'items',
        context: { binName: 'Tools', existingItems: ['Wrench'] },
        locationId: 'loc-1',
      },
    });
  });
});

describe('mapStructureErrorMessage', () => {
  it('maps 422 to API key message', () => {
    expect(mapStructureErrorMessage(new ApiError(422, 'fail'))).toBe('Check your API key and model name');
  });

  it('maps 429 to rate limit message', () => {
    expect(mapStructureErrorMessage(new ApiError(429, 'fail'))).toBe('Rate limited \u2014 try again in a moment');
  });

  it('maps 502 to provider error message', () => {
    expect(mapStructureErrorMessage(new ApiError(502, 'fail'))).toBe('AI provider error \u2014 check your settings');
  });

  it('maps unknown error to generic message', () => {
    expect(mapStructureErrorMessage(new TypeError('oops'))).toBe('Failed to structure text');
  });
});

describe('useTextStructuring', () => {
  it('structures text and returns items', async () => {
    mockApiFetch.mockResolvedValue({ items: ['Tape', 'Scissors'] });

    const { result } = renderHook(() => useTextStructuring());

    expect(result.current.isStructuring).toBe(false);
    expect(result.current.structuredItems).toBeNull();

    await act(async () => {
      await result.current.structure({ text: 'tape and scissors' });
    });

    expect(result.current.isStructuring).toBe(false);
    expect(result.current.structuredItems).toEqual(['Tape', 'Scissors']);
    expect(result.current.error).toBeNull();
  });

  it('sets error on failure', async () => {
    mockApiFetch.mockRejectedValue(new ApiError(502, 'Bad gateway'));

    const { result } = renderHook(() => useTextStructuring());

    await act(async () => {
      await result.current.structure({ text: 'some items' });
    });

    expect(result.current.error).toBe('AI provider error \u2014 check your settings');
    expect(result.current.structuredItems).toBeNull();
  });

  it('clearStructured resets state', async () => {
    mockApiFetch.mockResolvedValue({ items: ['Item'] });

    const { result } = renderHook(() => useTextStructuring());

    await act(async () => {
      await result.current.structure({ text: 'an item' });
    });

    expect(result.current.structuredItems).toEqual(['Item']);

    act(() => {
      result.current.clearStructured();
    });

    expect(result.current.structuredItems).toBeNull();
    expect(result.current.error).toBeNull();
  });
});
