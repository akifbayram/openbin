import { useCallback, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useToast } from '@/components/ui/toast';
import { mapAiError } from './aiErrors';
import { buildHistoryPayload, createTurnId, type Turn } from './conversationTurns';
import { executeBatch } from './useActionExecutor';
import { type AskClassified, classifyResult, useStreamingAsk } from './useStreamingAsk';

interface UseConversationOptions {
  locationId: string | null;
  initialSelectedBinIds?: string[];
}

export interface UseConversationReturn {
  turns: Turn[];
  isStreaming: boolean;
  executingTurnId: string | null;
  /**
   * Tracks whether a command turn is currently executing. Because `/api/batch` is a single
   * round-trip, this is effectively binary: `{current: 0, total: N}` at start and
   * `{current: N, total: N}` on completion. Consumers wanting fine-grained progress should
   * treat this as a boolean `isExecuting` rather than a progress percentage.
   */
  executingProgress: { current: number; total: number };
  scopeInfo: { binCount: number; isScoped: boolean; clearScope: () => void };
  ask: (text: string) => Promise<void>;
  executeActions: (turnId: string) => Promise<void>;
  toggleAction: (turnId: string, actionIndex: number) => void;
  clearConversation: () => void;
  cancelStreaming: () => void;
  retry: (turnId: string) => Promise<void>;
}

export function useConversation({
  locationId,
  initialSelectedBinIds,
}: UseConversationOptions): UseConversationReturn {
  const { showToast } = useToast();
  const { ask: streamAsk, isStreaming, cancel: cancelAsk, clear: clearAsk } = useStreamingAsk();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [scopeCleared, setScopeCleared] = useState(false);
  const [executingTurnId, setExecutingTurnId] = useState<string | null>(null);
  const [executingProgress, setExecutingProgress] = useState({ current: 0, total: 0 });
  const turnsRef = useRef<Turn[]>([]);
  turnsRef.current = turns;
  const executingTurnIdRef = useRef<string | null>(null);

  const scopeInfo = useMemo(() => {
    const isScoped = !scopeCleared && (initialSelectedBinIds?.length ?? 0) > 0;
    return {
      binCount: initialSelectedBinIds?.length ?? 0,
      isScoped,
      clearScope: () => setScopeCleared(true),
    };
  }, [initialSelectedBinIds, scopeCleared]);

  const effectiveBinIds = scopeInfo.isScoped ? initialSelectedBinIds : undefined;

  const ask = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !locationId) return;

      const userTurn: Turn = {
        kind: 'user-text',
        id: createTurnId(),
        text: trimmed,
        createdAt: Date.now(),
      };
      const thinkingTurn: Turn = {
        kind: 'ai-thinking',
        id: createTurnId(),
        phase: 'parsing',
      };
      const priorTurns = turnsRef.current;
      // flushSync so the user-text and thinking turns are observable immediately
      // (also matters for tests that inspect state during a pending async act scope).
      flushSync(() => {
        setTurns([...priorTurns, userTurn, thinkingTurn]);
      });

      const history = buildHistoryPayload(priorTurns);

      try {
        const result = await streamAsk({
          text: trimmed,
          locationId,
          binIds: effectiveBinIds,
          history,
        });
        if (!result) {
          setTurns((curr) =>
            curr.map((t) =>
              t.id === thinkingTurn.id
                ? { kind: 'ai-error', id: t.id, error: 'Request failed', canRetry: true }
                : t,
            ),
          );
          return;
        }
        const classified = classifyResult(result as never);
        const aiTurn = askClassifiedToTurn(thinkingTurn.id, classified);
        setTurns((curr) => curr.map((t) => (t.id === thinkingTurn.id ? aiTurn : t)));
      } catch (err) {
        // Aborted requests (from cancelStreaming) are user-initiated — don't show an error.
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (err instanceof Error && err.name === 'AbortError') return;
        const message = mapAiError(err, 'Request failed');
        showToast({ message });
        setTurns((curr) =>
          curr.map((t) =>
            t.id === thinkingTurn.id
              ? { kind: 'ai-error', id: t.id, error: message, canRetry: true }
              : t,
          ),
        );
      }
    },
    [locationId, effectiveBinIds, streamAsk, showToast],
  );

  const toggleAction = useCallback((turnId: string, actionIndex: number) => {
    setTurns((curr) =>
      curr.map((t) => {
        if (t.id !== turnId || t.kind !== 'ai-command-preview') return t;
        const next = new Map(t.checkedActions);
        next.set(actionIndex, !(t.checkedActions.get(actionIndex) ?? true));
        return { ...t, checkedActions: next };
      }),
    );
  }, []);

  const executeActions = useCallback(
    async (turnId: string) => {
      const turn = turnsRef.current.find((t) => t.id === turnId);
      if (!turn || turn.kind !== 'ai-command-preview' || !locationId) return;
      // Concurrent-execute guard: if another turn is already executing, ignore this call.
      // Also rejects re-running an already-executed/executing/canceled turn.
      if (executingTurnIdRef.current !== null || turn.status !== 'pending') return;

      const selectedIndices: number[] = [];
      for (let i = 0; i < turn.actions.length; i++) {
        if (turn.checkedActions.get(i) !== false) selectedIndices.push(i);
      }
      if (selectedIndices.length === 0) return;

      setExecutingTurnId(turnId);
      executingTurnIdRef.current = turnId;
      setExecutingProgress({ current: 0, total: selectedIndices.length });
      setTurns((curr) =>
        curr.map((t) =>
          t.id === turnId && t.kind === 'ai-command-preview'
            ? { ...t, status: 'executing' }
            : t,
        ),
      );

      try {
        const result = await executeBatch({
          actions: turn.actions,
          selectedIndices,
          locationId,
          onUndoToast: (message, undo) =>
            showToast({ message, action: { label: 'Undo', onClick: undo } }),
        });
        setExecutingProgress({ current: selectedIndices.length, total: selectedIndices.length });
        if (result.failedCount > 0) {
          showToast({
            message: `${result.completedActions.length} of ${selectedIndices.length} actions completed`,
          });
        }
        setTurns((curr) =>
          curr.map((t) =>
            t.id === turnId && t.kind === 'ai-command-preview'
              ? { ...t, status: 'executed', executionResult: result }
              : t,
          ),
        );
      } catch (err) {
        const message = mapAiError(err, 'Execution failed');
        showToast({ message });
        setTurns((curr) =>
          curr.map((t) =>
            t.id === turnId && t.kind === 'ai-command-preview'
              ? { ...t, status: 'pending' }
              : t,
          ),
        );
      } finally {
        setExecutingTurnId(null);
        executingTurnIdRef.current = null;
        setExecutingProgress({ current: 0, total: 0 });
      }
    },
    [locationId, showToast],
  );

  const clearConversation = useCallback(() => {
    cancelAsk();
    clearAsk();
    setTurns([]);
    setScopeCleared(false);
  }, [cancelAsk, clearAsk]);

  const cancelStreaming = useCallback(() => {
    cancelAsk();
    // Remove the most recent thinking turn (if any). We don't know its id from here, so scan.
    setTurns((curr) => {
      let realIdx = -1;
      for (let i = curr.length - 1; i >= 0; i--) {
        if (curr[i].kind === 'ai-thinking') {
          realIdx = i;
          break;
        }
      }
      if (realIdx === -1) return curr;
      return [...curr.slice(0, realIdx), ...curr.slice(realIdx + 1)];
    });
  }, [cancelAsk]);

  const retry = useCallback(
    async (turnId: string) => {
      const errIdx = turnsRef.current.findIndex((t) => t.id === turnId && t.kind === 'ai-error');
      if (errIdx === -1) return;
      // Walk back to the preceding user-text turn
      let userText: string | null = null;
      let userIdx = -1;
      // Invariant: every ai-error turn is immediately preceded by the user-text
      // turn that triggered it. If that invariant changes, revisit retry().
      for (let i = errIdx - 1; i >= 0; i--) {
        const t = turnsRef.current[i];
        if (t.kind === 'user-text') {
          userText = t.text;
          userIdx = i;
          break;
        }
      }
      if (userText === null || userIdx === -1) return;
      // Remove both the error turn and its preceding user turn. ask() will re-append both.
      // We update turnsRef.current synchronously so the subsequent ask() sees the filtered
      // list before React has a chance to re-render.
      const filtered = turnsRef.current.filter((_, i) => i !== errIdx && i !== userIdx);
      turnsRef.current = filtered;
      setTurns(filtered);
      await ask(userText);
    },
    [ask],
  );

  return {
    turns,
    isStreaming,
    executingTurnId,
    executingProgress,
    scopeInfo,
    ask,
    executeActions,
    toggleAction,
    clearConversation,
    cancelStreaming,
    retry,
  };
}

function askClassifiedToTurn(id: string, c: AskClassified): Turn {
  if (c.kind === 'command') {
    const checked = new Map<number, boolean>(c.actions.map((_, i) => [i, true] as const));
    return {
      kind: 'ai-command-preview',
      id,
      actions: c.actions,
      interpretation: c.interpretation,
      checkedActions: checked,
      status: 'pending',
    };
  }
  return {
    kind: 'ai-query-result',
    id,
    queryResult: { answer: c.answer, matches: c.matches },
    isStreaming: false,
  };
}
