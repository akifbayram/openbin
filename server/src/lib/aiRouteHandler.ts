import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { AiErrorCode } from './aiCaller.js';
import { AiAnalysisError } from './aiCaller.js';
import { aiErrorToStatus, NoAiSettingsError } from './aiSettings.js';
import { ValidationError } from './crypto.js';
import { HttpError } from './httpErrors.js';

/** Safe client-facing messages keyed by AI error code (avoids leaking provider internals). */
const SAFE_AI_MESSAGES: Partial<Record<AiErrorCode, string>> = {
  INVALID_KEY: 'Invalid API key — check your AI provider settings',
  RATE_LIMITED: 'Rate limited by provider — try again later',
  MODEL_NOT_FOUND: 'Model not found — check your AI provider settings',
  INVALID_RESPONSE: 'Provider returned an invalid response',
};

/** Wrap an async AI route handler with standard error handling. */
export function aiRouteHandler(
  action: string,
  fn: (req: Request, res: Response) => Promise<void>
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(req, res);
    } catch (err) {
      if (err instanceof HttpError) {
        next(err);
        return;
      }
      if (err instanceof AiAnalysisError) {
        // Use safe messages for codes that might contain provider internals;
        // let NETWORK_ERROR through (contains user-actionable info like hostname resolution)
        const message = (err.code === 'NETWORK_ERROR' ? err.message : SAFE_AI_MESSAGES[err.code]) ?? err.message;
        if (err.code === 'PROVIDER_ERROR') {
          const safeErr = { message: err.message, name: err.name, code: err.code };
          console.error(`AI ${action} provider error:`, safeErr);
        }
        res.status(aiErrorToStatus(err.code)).json({ error: message, code: err.code });
        return;
      }
      if (err instanceof NoAiSettingsError) {
        res.status(422).json({ error: 'VALIDATION_ERROR', message: err.message });
        return;
      }
      if (err instanceof ValidationError) {
        res.status(422).json({ error: 'VALIDATION_ERROR', message: err.message });
        return;
      }
      // Redact potentially sensitive fields (auth headers, API keys) from external provider errors
      const safeErr = err instanceof Error ? { message: err.message, name: err.name } : '[non-Error thrown]';
      console.error(`AI ${action} error:`, safeErr);
      res.status(500).json({ error: 'INTERNAL_ERROR', message: `Failed to ${action}` });
    }
  };
}

/** Validate a text input field: non-empty string, trimmed, within max length. */
export function validateTextInput(value: unknown, fieldName: string, maxLength = 5000): string {
  if (!value || typeof value !== 'string' || !value.trim()) {
    throw new ValidationError(`${fieldName} is required`);
  }
  if (value.length > maxLength) {
    throw new ValidationError(`${fieldName} must be ${maxLength} characters or less`);
  }
  return value.trim();
}
