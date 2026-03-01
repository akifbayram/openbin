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
import { analyzeImageFile, analyzeImageFiles, MAX_AI_PHOTOS, useAiAnalysis } from '../useAiAnalysis';

const mockApiFetch = vi.mocked(apiFetch);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('analyzeImageFile', () => {
  it('creates FormData with single file and POSTs', async () => {
    const suggestions = { name: 'Tools', items: ['Wrench'], tags: ['tools'], notes: '' };
    mockApiFetch.mockResolvedValue(suggestions);

    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' });
    const result = await analyzeImageFile(file);

    expect(result).toEqual(suggestions);
    expect(mockApiFetch).toHaveBeenCalledWith('/api/ai/analyze-image', {
      method: 'POST',
      body: expect.any(FormData),
    });

    const formData = mockApiFetch.mock.calls[0][1]?.body as FormData;
    expect(formData.get('photo')).toBe(file);
  });
});

describe('analyzeImageFiles', () => {
  it('creates FormData with multiple files', async () => {
    const suggestions = { name: 'Tools', items: ['Wrench', 'Hammer'], tags: ['tools'], notes: '' };
    mockApiFetch.mockResolvedValue(suggestions);

    const files = [
      new File(['a'], '1.jpg', { type: 'image/jpeg' }),
      new File(['b'], '2.jpg', { type: 'image/jpeg' }),
    ];
    const result = await analyzeImageFiles(files);

    expect(result).toEqual(suggestions);

    const formData = mockApiFetch.mock.calls[0][1]?.body as FormData;
    expect(formData.getAll('photos')).toHaveLength(2);
  });

  it('caps files at MAX_AI_PHOTOS', async () => {
    mockApiFetch.mockResolvedValue({ name: '', items: [], tags: [], notes: '' });

    const files = Array.from({ length: 8 }, (_, i) =>
      new File([`data-${i}`], `${i}.jpg`, { type: 'image/jpeg' })
    );
    await analyzeImageFiles(files);

    const formData = mockApiFetch.mock.calls[0][1]?.body as FormData;
    expect(formData.getAll('photos')).toHaveLength(MAX_AI_PHOTOS);
  });
});

describe('useAiAnalysis', () => {
  it('analyze: sets isAnalyzing and returns suggestions', async () => {
    const suggestions = { name: 'Box', items: ['Tape'], tags: ['shipping'], notes: 'Brown box' };
    mockApiFetch.mockResolvedValue(suggestions);

    const { result } = renderHook(() => useAiAnalysis());

    expect(result.current.isAnalyzing).toBe(false);
    expect(result.current.suggestions).toBeNull();

    await act(async () => {
      await result.current.analyze('photo-1');
    });

    expect(result.current.isAnalyzing).toBe(false);
    expect(result.current.suggestions).toEqual(suggestions);
    expect(result.current.error).toBeNull();
    expect(mockApiFetch).toHaveBeenCalledWith('/api/ai/analyze', {
      method: 'POST',
      body: { photoId: 'photo-1' },
    });
  });

  it('analyze: error 422 maps to API key message', async () => {
    mockApiFetch.mockRejectedValue(new ApiError(422, 'Unprocessable'));

    const { result } = renderHook(() => useAiAnalysis());

    await act(async () => {
      await result.current.analyze('photo-1');
    });

    expect(result.current.error).toBe('Invalid API key or model — check Settings > AI');
    expect(result.current.suggestions).toBeNull();
  });

  it('analyze: error 429 maps to rate limit message', async () => {
    mockApiFetch.mockRejectedValue(new ApiError(429, 'Too many requests'));

    const { result } = renderHook(() => useAiAnalysis());

    await act(async () => {
      await result.current.analyze('photo-1');
    });

    expect(result.current.error).toBe('AI provider rate limited — wait a moment and try again');
  });

  it('analyze: error 502 maps to provider error message', async () => {
    mockApiFetch.mockRejectedValue(new ApiError(502, 'Bad gateway'));

    const { result } = renderHook(() => useAiAnalysis());

    await act(async () => {
      await result.current.analyze('photo-1');
    });

    expect(result.current.error).toBe('Your AI provider returned an error — verify your settings');
  });

  it('analyze: unknown error maps to generic message', async () => {
    mockApiFetch.mockRejectedValue(new TypeError('Network failed'));

    const { result } = renderHook(() => useAiAnalysis());

    await act(async () => {
      await result.current.analyze('photo-1');
    });

    expect(result.current.error).toBe('Couldn\'t analyze the photo — try again');
  });

  it('analyzeMultiple: caps photoIds at MAX_AI_PHOTOS', async () => {
    const suggestions = { name: 'Multi', items: [], tags: [], notes: '' };
    mockApiFetch.mockResolvedValue(suggestions);

    const ids = Array.from({ length: 8 }, (_, i) => `photo-${i}`);
    const { result } = renderHook(() => useAiAnalysis());

    await act(async () => {
      await result.current.analyzeMultiple(ids);
    });

    expect(result.current.suggestions).toEqual(suggestions);
    expect(mockApiFetch).toHaveBeenCalledWith('/api/ai/analyze', {
      method: 'POST',
      body: { photoIds: ids.slice(0, MAX_AI_PHOTOS) },
    });
  });

  it('clearSuggestions: clears suggestions and error', async () => {
    mockApiFetch.mockRejectedValue(new ApiError(422, 'fail'));

    const { result } = renderHook(() => useAiAnalysis());

    await act(async () => {
      await result.current.analyze('photo-1');
    });

    expect(result.current.error).not.toBeNull();

    act(() => {
      result.current.clearSuggestions();
    });

    expect(result.current.suggestions).toBeNull();
    expect(result.current.error).toBeNull();
  });
});
