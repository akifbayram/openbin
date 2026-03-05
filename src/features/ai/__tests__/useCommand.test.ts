import { describe, expect, it, vi } from 'vitest';

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

import { ApiError } from '@/lib/api';
import { mapCommandErrorMessage } from '../useCommand';

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
