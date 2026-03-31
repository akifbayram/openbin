import type { LanguageModel, UserContent } from 'ai';
import { Output, streamText } from 'ai';
import type { Response } from 'express';
import { mapSdkError, toSafeAiMessage } from './aiCaller.js';
import { createLogger } from './logger.js';

const log = createLogger('ai');

export interface StreamOptions {
  system: string;
  userContent: UserContent;
  /** Zod schema — when provided, constrains the model to output valid JSON matching this shape. */
  schema?: Parameters<typeof Output.object>[0]['schema'];
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

/**
 * Stream AI output as SSE to an Express response.
 *
 * When `opts.schema` is provided, uses Output.object() to constrain the model
 * to valid JSON matching the given Zod schema.
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
    const streamResult = streamText({
      model,
      ...(opts.schema ? { output: Output.object({ schema: opts.schema }) } : {}),
      system: opts.system,
      messages: [{ role: 'user' as const, content: opts.userContent }],
      maxOutputTokens: opts.maxTokens,
      temperature: opts.temperature,
      topP: opts.topP,
      abortSignal: opts.abortSignal,
    });

    for await (const delta of streamResult.textStream) {
      writeEvent({ type: 'delta', text: delta });
    }

    let finalText = await streamResult.text;

    // When structured output is requested, prefer the validated output object.
    // The text stream may be truncated (e.g. max tokens reached) while the
    // SDK's output channel still provides the complete, validated object.
    if (opts.schema) {
      try {
        const output = await streamResult.output;
        if (output) finalText = JSON.stringify(output);
      } catch {
        // output parsing failed — fall through to raw text
      }
    }

    // Guard against truncated JSON (e.g. model hit max tokens)
    if (finalText.trim()) {
      try {
        JSON.parse(finalText);
      } catch {
        writeEvent({ type: 'error', message: 'AI response was cut short — try a shorter query or increase max tokens', code: 'TRUNCATED_RESPONSE' });
        return;
      }
    }

    writeEvent({ type: 'done', text: finalText });
  } catch (err) {
    const mapped = mapSdkError(err);
    const safeMessage = toSafeAiMessage(mapped) || 'Provider error — check server logs';
    if (mapped.code === 'PROVIDER_ERROR') {
      const safeErr = err instanceof Error ? { message: err.message, name: err.name } : '[non-Error thrown]';
      log.error('Stream error:', safeErr);
    }
    writeEvent({ type: 'error', message: safeMessage, code: mapped.code });
  } finally {
    res.end();
  }
}
