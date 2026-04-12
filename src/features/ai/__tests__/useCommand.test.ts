import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => {
  class ApiError extends Error {
    status: number;
    code?: string;
    constructor(status: number, message: string, code?: string) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.code = code;
    }
  }
  return { apiFetch: vi.fn(), ApiError };
});

import { ApiError } from '@/lib/api';
import { mapAiError } from '../aiErrors';

describe('mapAiError (command fallback)', () => {
  it('maps 422 to API key message', () => {
    expect(mapAiError(new ApiError(422, 'fail'), 'Couldn\'t understand that command — try rephrasing')).toBe('Invalid API key or model — check Settings > AI');
  });

  it('maps 429 to rate limit message', () => {
    expect(mapAiError(new ApiError(429, 'fail'), 'Couldn\'t understand that command — try rephrasing')).toBe('AI provider rate limited — wait a moment and try again');
  });

  it('maps 502 to provider error message', () => {
    expect(mapAiError(new ApiError(502, 'fail'), 'Couldn\'t understand that command — try rephrasing')).toBe('Your AI provider returned an error — verify your settings');
  });

  it('maps unknown error to generic message', () => {
    expect(mapAiError(new TypeError('oops'), 'Couldn\'t understand that command — try rephrasing')).toBe('Couldn\'t understand that command — try rephrasing');
  });

  it('maps 422 VALIDATION_ERROR to actual message', () => {
    expect(mapAiError(new ApiError(422, 'text must be 5000 characters or less', 'VALIDATION_ERROR'), 'Couldn\'t understand that command — try rephrasing')).toBe('text must be 5000 characters or less');
  });
});
