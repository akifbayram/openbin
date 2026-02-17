import { ApiError } from '@/lib/api';

/**
 * Map AI-related API errors to user-friendly messages.
 * @param err  The caught error.
 * @param fallback  Message shown for non-API errors.
 */
export function mapAiError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    switch (err.status) {
      case 422: return 'Invalid API key or model — check Settings > AI';
      case 429: return 'AI provider rate limited — wait a moment and try again';
      case 502: return 'Your AI provider returned an error — verify your settings';
      default: return err.message;
    }
  }
  return fallback;
}
