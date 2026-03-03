import { useCallback, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Events, notify } from '@/lib/eventBus';
import { mapAiError } from './aiErrors';
import { parseChatStream } from './chatStreamParser';

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

/** Build the API message array from conversation history, including tool result context. */
function buildApiMessages(messages: ChatMessageContent[]): Array<{ role: string; content: string }> {
  const result: Array<{ role: string; content: string }> = [];
  for (const m of messages) {
    if (m.role === 'user') {
      result.push({ role: 'user', content: m.text });
    } else if (m.role === 'assistant') {
      let content = m.text;
      // Include tool result summaries for multi-turn context
      if (m.toolResults?.length) {
        const summaries = m.toolResults.map(
          (tr) => `[Tool ${tr.name}: ${typeof tr.result === 'string' ? tr.result : JSON.stringify(tr.result)}]`,
        );
        content += `\n${summaries.join('\n')}`;
      }
      if (m.executedActions?.length) {
        const summaries = m.executedActions.map(
          (ea) => `[Action ${ea.success ? 'succeeded' : 'failed'}: ${ea.details}]`,
        );
        content += `\n${summaries.join('\n')}`;
      }
      if (content.length > 0) {
        result.push({ role: 'assistant', content });
      }
    }
  }
  return result;
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
  // Ref to always have latest messages available (avoids stale closures & React batching issues)
  const messagesRef = useRef<ChatMessageContent[]>(messages);
  messagesRef.current = messages;

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
      // Build API messages from conversation history + the new user message.
      // Use ref to get latest messages synchronously (avoids React batching issues).
      const apiMessages = buildApiMessages([...messagesRef.current, userMsg]);

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
            const actions: ActionPreview[] = event.actions;
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
            // Don't return — the server is waiting for confirmation.
            // When the user confirms/rejects, more SSE events will arrive.
            break;
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
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === 'assistant') {
          updated[updated.length - 1] = { ...last, isStreaming: true };
        }
        return updated;
      });
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
