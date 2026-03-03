import type { LanguageModel, UserContent } from 'ai';
import { streamText } from 'ai';
import type { Response } from 'express';
import type { AiErrorCode } from './aiCaller.js';
import { mapSdkError } from './aiCaller.js';

export interface StreamOptions {
  system: string;
  userContent: UserContent;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  abortSignal?: AbortSignal;
}

/** Set SSE headers on an Express response and return a typed event writer. */
export function initSseResponse(res: Response): (data: object) => void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  return (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };
}

const SAFE_MESSAGES: Partial<Record<AiErrorCode, string>> = {
  INVALID_KEY: 'Invalid API key — check your AI provider settings',
  RATE_LIMITED: 'Rate limited by provider — try again later',
  MODEL_NOT_FOUND: 'Model not found — check your AI provider settings',
  INVALID_RESPONSE: 'Provider returned an invalid response',
};

/**
 * Stream AI text output as SSE to an Express response.
 *
 * Protocol: each SSE `data:` event carries one of:
 *   { type: 'delta', text: string }   — incremental text chunk
 *   { type: 'done', text: string }    — full accumulated text on finish
 *   { type: 'error', message: string, code: string } — error event
 */
export async function pipeAiStreamToResponse(
  res: Response,
  model: LanguageModel,
  opts: StreamOptions
): Promise<void> {
  const writeEvent = initSseResponse(res);

  try {
    const { textStream, text: textPromise } = streamText({
      model,
      system: opts.system,
      messages: [{ role: 'user' as const, content: opts.userContent }],
      maxOutputTokens: opts.maxTokens,
      temperature: opts.temperature,
      topP: opts.topP,
      abortSignal: opts.abortSignal,
    });

    for await (const delta of textStream) {
      writeEvent({ type: 'delta', text: delta });
    }

    writeEvent({ type: 'done', text: await textPromise });
  } catch (err) {
    const mapped = mapSdkError(err);
    const safeMessage = (mapped.code === 'NETWORK_ERROR' ? mapped.message : SAFE_MESSAGES[mapped.code])
      ?? 'Provider error — check server logs';
    if (mapped.code === 'PROVIDER_ERROR') {
      const safeErr = err instanceof Error ? { message: err.message, name: err.name } : '[non-Error thrown]';
      console.error('AI stream error:', safeErr);
    }
    writeEvent({ type: 'error', message: safeMessage, code: mapped.code });
  } finally {
    res.end();
  }
}
