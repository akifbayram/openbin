import { useCallback, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Events, notify } from '@/lib/eventBus';
import { mapAiError } from './aiErrors';
import { parseChatStream } from './chatStreamParser';
import type { CommandAction } from './useCommand';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ToolResult {
  toolCallId: string;
  name: string;
  result: unknown;
}

export interface ActionPreview {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  description: string;
}

export interface ChatMessageContent {
  role: 'user' | 'assistant' | 'system';
  text: string;
  toolResults?: ToolResult[];
  actionPreview?: {
    confirmationId: string;
    actions: ActionPreview[];
    status: 'pending' | 'accepted' | 'rejected';
  };
  executedActions?: Array<{ toolCallId: string; success: boolean; details: string }>;
  isStreaming?: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map CommandAction from stream into ActionPreview shape. */
function toActionPreview(action: CommandAction, index: number): ActionPreview {
  const { type, ...args } = action;
  return {
    id: `${type}-${index}`,
    toolName: type,
    args: args as Record<string, unknown>,
    description: `${type}: ${JSON.stringify(args)}`,
  };
}

/** Build the API message array from conversation history. */
function buildApiMessages(messages: ChatMessageContent[]): Array<{ role: string; content: string }> {
  return messages
    .filter((m) => m.role === 'user' || (m.role === 'assistant' && m.text.length > 0))
    .map((m) => ({ role: m.role, content: m.text }));
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useChat() {
  const { activeLocationId } = useAuth();
  const [messages, setMessages] = useState<ChatMessageContent[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    confirmationId: string;
    actions: ActionPreview[];
  } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // -----------------------------------------------------------------------
  // sendMessage
  // -----------------------------------------------------------------------
  const sendMessage = useCallback(async (text: string) => {
    if (!activeLocationId || isStreaming) return;

    // Append user message + empty streaming assistant placeholder
    const userMsg: ChatMessageContent = { role: 'user', text };
    const assistantMsg: ChatMessageContent = { role: 'assistant', text: '', isStreaming: true };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // Build API messages from current conversation + the new user message.
      // We read from state via functional update pattern to capture the latest messages,
      // but we need the value synchronously here, so we construct from what we know.
      let apiMessages: Array<{ role: string; content: string }> = [];
      setMessages((prev) => {
        // Use prev to capture current state; compute apiMessages as side-effect
        apiMessages = buildApiMessages(prev);
        return prev; // no-op state update
      });

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({ messages: apiMessages, locationId: activeLocationId }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(errorData.message || errorData.error || response.statusText);
      }

      for await (const event of parseChatStream(response, controller.signal)) {
        switch (event.type) {
          case 'text_delta': {
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last?.role === 'assistant') {
                updated[updated.length - 1] = { ...last, text: last.text + event.delta };
              }
              return updated;
            });
            break;
          }

          case 'tool_result': {
            const toolResult: ToolResult = {
              toolCallId: event.toolCallId,
              name: event.name,
              result: event.result,
            };
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last?.role === 'assistant') {
                updated[updated.length - 1] = {
                  ...last,
                  toolResults: [...(last.toolResults ?? []), toolResult],
                };
              }
              return updated;
            });
            break;
          }

          case 'action_preview': {
            const actions = event.actions.map(toActionPreview);
            const confirmation = { confirmationId: event.confirmationId, actions };
            setPendingConfirmation(confirmation);
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last?.role === 'assistant') {
                updated[updated.length - 1] = {
                  ...last,
                  actionPreview: { ...confirmation, status: 'pending' as const },
                  isStreaming: false,
                };
              }
              return updated;
            });
            setIsStreaming(false);
            return; // Pause for user confirmation
          }

          case 'action_executed': {
            const executed = {
              toolCallId: event.toolCallId,
              success: event.success,
              details: event.details,
            };
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last?.role === 'assistant') {
                updated[updated.length - 1] = {
                  ...last,
                  executedActions: [...(last.executedActions ?? []), executed],
                };
              }
              return updated;
            });
            notify(Events.BINS);
            break;
          }

          case 'action_rejected': {
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last?.role === 'assistant' && last.actionPreview) {
                updated[updated.length - 1] = {
                  ...last,
                  actionPreview: { ...last.actionPreview, status: 'rejected' as const },
                };
              }
              return updated;
            });
            break;
          }

          case 'done': {
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last?.role === 'assistant') {
                updated[updated.length - 1] = { ...last, isStreaming: false };
              }
              return updated;
            });
            break;
          }

          case 'error': {
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last?.role === 'assistant') {
                updated[updated.length - 1] = {
                  ...last,
                  error: event.message,
                  isStreaming: false,
                };
              }
              return updated;
            });
            break;
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      const errorMessage = mapAiError(err, 'Something went wrong — please try again');
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === 'assistant') {
          updated[updated.length - 1] = { ...last, error: errorMessage, isStreaming: false };
        }
        return updated;
      });
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [activeLocationId, isStreaming]);

  // -----------------------------------------------------------------------
  // confirmActions
  // -----------------------------------------------------------------------
  const confirmActions = useCallback(async (confirmationId: string, accepted: boolean) => {
    // Update action preview status in messages
    const newStatus = accepted ? 'accepted' : 'rejected';
    setMessages((prev) =>
      prev.map((m) => {
        if (m.actionPreview?.confirmationId === confirmationId) {
          return {
            ...m,
            actionPreview: { ...m.actionPreview, status: newStatus as 'accepted' | 'rejected' },
          };
        }
        return m;
      }),
    );
    setPendingConfirmation(null);

    await apiFetch('/api/ai/chat/confirm', {
      method: 'POST',
      body: { confirmationId, accepted },
    });

    if (accepted) {
      setIsStreaming(true);
    }
  }, []);

  // -----------------------------------------------------------------------
  // abort
  // -----------------------------------------------------------------------
  const abort = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setMessages((prev) => {
      const updated = [...prev];
      const last = updated[updated.length - 1];
      if (last?.role === 'assistant' && last.isStreaming) {
        updated[updated.length - 1] = { ...last, isStreaming: false };
      }
      return updated;
    });
  }, []);

  // -----------------------------------------------------------------------
  // clearChat
  // -----------------------------------------------------------------------
  const clearChat = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setMessages([]);
    setPendingConfirmation(null);
  }, []);

  return {
    messages,
    isStreaming,
    pendingConfirmation,
    sendMessage,
    confirmActions,
    abort,
    clearChat,
  };
}
