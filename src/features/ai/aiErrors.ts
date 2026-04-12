import { ApiError } from '@/lib/api';

/**
 * Map AI-related API errors to user-friendly messages.
 * @param err  The caught error.
 * @param fallback  Message shown for non-API errors.
 */
export function mapAiError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (err.code === 'AI_CREDITS_EXHAUSTED') return err.message;
    if (err.code === 'AI_RATE_LIMITED') return 'Too many AI requests — try again in a moment';
    if (err.code === 'VALIDATION_ERROR') return err.message;
    switch (err.status) {
      case 422: return 'Invalid API key or model — check Settings > AI';
      case 429: return 'AI provider rate limited — wait a moment and try again';
      case 502: return 'Your AI provider returned an error — verify your settings';
      default: return err.message;
    }
  }
  return fallback;
}
