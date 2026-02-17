import type { Request, Response, RequestHandler } from 'express';
import { AiAnalysisError } from './aiCaller.js';
import { NoAiSettingsError, aiErrorToStatus } from './aiSettings.js';
import { ValidationError } from './crypto.js';

/** Wrap an async AI route handler with standard error handling. */
export function aiRouteHandler(
  action: string,
  fn: (req: Request, res: Response) => Promise<void>
): RequestHandler {
  return async (req: Request, res: Response) => {
    try {
      await fn(req, res);
    } catch (err) {
      if (err instanceof AiAnalysisError) {
        res.status(aiErrorToStatus(err.code)).json({ error: err.message, code: err.code });
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
      console.error(`AI ${action} error:`, err);
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
