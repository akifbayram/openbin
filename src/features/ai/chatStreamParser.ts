// ---------------------------------------------------------------------------
// SSE event types from POST /api/ai/chat
// ---------------------------------------------------------------------------

export interface TextDeltaEvent {
  type: 'text_delta';
  delta: string;
}

export interface ToolResultEvent {
  type: 'tool_result';
  toolCallId: string;
  name: string;
  result: Record<string, unknown>;
}

export interface ActionPreviewEvent {
  type: 'action_preview';
  confirmationId: string;
  actions: Array<{ id: string; toolName: string; args: Record<string, unknown>; description: string }>;
}

export interface ActionExecutedEvent {
  type: 'action_executed';
  toolCallId: string;
  success: boolean;
  details: string;
}

export interface ActionRejectedEvent {
  type: 'action_rejected';
  confirmationId: string;
}

export interface DoneEvent {
  type: 'done';
}

export interface ErrorEvent {
  type: 'error';
  message: string;
  code: string;
}

export type ChatStreamEvent =
  | TextDeltaEvent
  | ToolResultEvent
  | ActionPreviewEvent
  | ActionExecutedEvent
  | ActionRejectedEvent
  | DoneEvent
  | ErrorEvent;

// ---------------------------------------------------------------------------
// SSE parser
// ---------------------------------------------------------------------------

const VALID_EVENT_TYPES = new Set([
  'text_delta',
  'tool_result',
  'action_preview',
  'action_executed',
  'action_rejected',
  'done',
  'error',
]);

/**
 * Reads a streaming SSE response from POST /api/ai/chat and yields typed
 * `ChatStreamEvent` objects as they arrive.
 *
 * @param response  A `fetch` Response whose body is an SSE text stream.
 * @param signal    Optional AbortSignal to cancel reading early.
 */
export async function* parseChatStream(
  response: Response,
  signal?: AbortSignal,
): AsyncGenerator<ChatStreamEvent> {
  const body = response.body;
  if (!body) return;

  const reader = body.getReader();
  const decoder = new TextDecoder();

  let buffer = '';
  let currentEventType: string | null = null;

  try {
    while (true) {
      if (signal?.aborted) break;

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete lines (SSE lines are terminated by \n)
      const lines = buffer.split('\n');
      // The last element may be an incomplete line — keep it in the buffer
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (signal?.aborted) break;

        const trimmed = line.trim();

        // Blank line = end of an SSE event block (reset for next event)
        if (trimmed === '') {
          currentEventType = null;
          continue;
        }

        // Comment lines (starting with ':') are ignored per SSE spec
        if (trimmed.startsWith(':')) continue;

        // event: <type>
        if (trimmed.startsWith('event:')) {
          currentEventType = trimmed.slice('event:'.length).trim();
          continue;
        }

        // data: <json>
        if (trimmed.startsWith('data:')) {
          const jsonStr = trimmed.slice('data:'.length).trim();
          if (!currentEventType || !VALID_EVENT_TYPES.has(currentEventType)) continue;

          try {
            const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
            yield { type: currentEventType, ...parsed } as ChatStreamEvent;
          } catch {
            // Malformed JSON — skip this event
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
