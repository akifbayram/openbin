import { ArrowDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { AiTurnCommandPreview } from './AiTurnCommandPreview';
import { AiTurnError } from './AiTurnError';
import { AiTurnExecutionResult } from './AiTurnExecutionResult';
import { AiTurnQueryResult } from './AiTurnQueryResult';
import { AiTurnThinking } from './AiTurnThinking';
import type { Turn } from './conversationTurns';
import { UserMessage } from './UserMessage';

interface ConversationThreadProps {
  turns: Turn[];
  onToggleAction: (turnId: string, index: number) => void;
  onExecute: (turnId: string) => void;
  onBinClick: (binId: string, isTrashed?: boolean) => void;
  onRetry: (turnId: string) => void;
  executingProgress?: { turnId: string; current: number; total: number } | null;
}

const BOTTOM_THRESHOLD = 80;

export function ConversationThread({
  turns,
  onToggleAction,
  onExecute,
  onBinClick,
  onRetry,
  executingProgress,
}: ConversationThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    function onScroll() {
      if (!el) return;
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      setAtBottom(distance < BOTTOM_THRESHOLD);
    }
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally scroll on turn count change only
  useEffect(() => {
    if (atBottom && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns.length]);

  function jumpToBottom() {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    setAtBottom(true);
  }

  return (
    <div className="relative flex-1 min-h-0">
      <div
        ref={scrollRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        className="absolute inset-0 overflow-y-auto px-4 py-4 space-y-3"
      >
        {turns.map((turn) => {
          if (turn.kind === 'user-text') {
            return <UserMessage key={turn.id} text={turn.text} />;
          }
          if (turn.kind === 'ai-thinking') {
            return <AiTurnThinking key={turn.id} phase={turn.phase} />;
          }
          if (turn.kind === 'ai-command-preview') {
            if (turn.status === 'executed' && turn.executionResult) {
              return (
                <AiTurnExecutionResult
                  key={turn.id}
                  result={turn.executionResult}
                  onBinClick={onBinClick}
                />
              );
            }
            return (
              <AiTurnCommandPreview
                key={turn.id}
                turnId={turn.id}
                actions={turn.actions}
                interpretation={turn.interpretation}
                checkedActions={turn.checkedActions}
                status={turn.status}
                onToggleAction={onToggleAction}
                onExecute={onExecute}
                executingProgress={
                  executingProgress?.turnId === turn.id
                    ? { current: executingProgress.current, total: executingProgress.total }
                    : undefined
                }
              />
            );
          }
          if (turn.kind === 'ai-query-result') {
            return (
              <AiTurnQueryResult
                key={turn.id}
                queryResult={turn.queryResult}
                streamingText={turn.streamingText}
                isStreaming={turn.isStreaming}
                onBinClick={onBinClick}
              />
            );
          }
          if (turn.kind === 'ai-error') {
            return (
              <AiTurnError
                key={turn.id}
                error={turn.error}
                canRetry={turn.canRetry}
                onRetry={() => onRetry(turn.id)}
              />
            );
          }
          return null;
        })}
      </div>

      {!atBottom && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
          <Button type="button" size="sm" variant="secondary" onClick={jumpToBottom}>
            <ArrowDown className="h-4 w-4 mr-1" />
            New message
          </Button>
        </div>
      )}
    </div>
  );
}
