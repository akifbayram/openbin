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

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on any turn mutation so in-place swaps (thinking → result) also stick to the bottom
  useEffect(() => {
    const el = scrollRef.current;
    if (!atBottom || !el) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: prefersReduced ? 'auto' : 'smooth',
    });
  }, [turns]);

  function jumpToBottom() {
    const el = scrollRef.current;
    if (el) {
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollTo({
        top: el.scrollHeight,
        behavior: prefersReduced ? 'auto' : 'smooth',
      });
    }
    setAtBottom(true);
  }

  return (
    <div className="relative flex-1 min-h-0">
      <div
        ref={scrollRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        className="absolute inset-0 overflow-y-auto px-5 py-5"
      >
        {turns.map((turn, i) => {
          // Conversational rhythm: tight gap after a user question (they belong
          // to the same exchange), generous gap otherwise (new exchange starts).
          const prev = i > 0 ? turns[i - 1] : null;
          const withinExchange = prev?.kind === 'user-text' && turn.kind !== 'user-text';
          const gapClass = i === 0 ? '' : withinExchange ? 'mt-2' : 'mt-5';

          let content: React.ReactNode = null;
          if (turn.kind === 'user-text') {
            content = <UserMessage text={turn.text} />;
          } else if (turn.kind === 'ai-thinking') {
            content = <AiTurnThinking phase={turn.phase} />;
          } else if (turn.kind === 'ai-command-preview') {
            content = turn.status === 'executed' && turn.executionResult ? (
              <AiTurnExecutionResult
                result={turn.executionResult}
                onBinClick={onBinClick}
              />
            ) : (
              <AiTurnCommandPreview
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
          } else if (turn.kind === 'ai-query-result') {
            content = (
              <AiTurnQueryResult
                queryResult={turn.queryResult}
                streamingText={turn.streamingText}
                isStreaming={turn.isStreaming}
                onBinClick={onBinClick}
              />
            );
          } else if (turn.kind === 'ai-error') {
            content = (
              <AiTurnError
                error={turn.error}
                canRetry={turn.canRetry}
                onRetry={() => onRetry(turn.id)}
              />
            );
          }

          return (
            <div key={turn.id} className={gapClass}>
              {content}
            </div>
          );
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
