import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn, flatCard } from '@/lib/utils';
import { CommandActionList } from './CommandActionList';
import { isDestructiveAction } from './commandActionUtils';
import type { CommandAction } from './useCommand';

interface AiTurnCommandPreviewProps {
  turnId: string;
  actions: CommandAction[];
  interpretation: string;
  checkedActions: Map<number, boolean>;
  status: 'pending' | 'executing' | 'executed' | 'canceled';
  onToggleAction: (turnId: string, index: number) => void;
  onExecute: (turnId: string) => void;
  executingProgress?: { current: number; total: number };
}

export function AiTurnCommandPreview({
  turnId,
  actions,
  interpretation,
  checkedActions,
  status,
  onToggleAction,
  onExecute,
  executingProgress,
}: AiTurnCommandPreviewProps) {
  const [confirmDestructive, setConfirmDestructive] = useState(false);

  const selectedCount = actions.filter((_, i) => checkedActions.get(i) !== false).length;
  const destructiveCount = actions.filter(
    (a, i) => checkedActions.get(i) !== false && isDestructiveAction(a),
  ).length;

  const isExecuting = status === 'executing';
  const isFinal = status === 'executed' || status === 'canceled';

  function handleApply() {
    if (destructiveCount > 0 && !confirmDestructive) {
      setConfirmDestructive(true);
      return;
    }
    setConfirmDestructive(false);
    onExecute(turnId);
  }

  function handleToggle(i: number) {
    onToggleAction(turnId, i);
    setConfirmDestructive(false);
  }

  return (
    <div className={cn(flatCard, 'p-3 space-y-3')}>
      <CommandActionList
        actions={actions}
        interpretation={interpretation}
        checkedActions={checkedActions}
        toggleAction={handleToggle}
        confirmDestructive={confirmDestructive && !isExecuting}
        destructiveCount={destructiveCount}
      />

      {isExecuting && executingProgress && (
        <div className="ai-progress-track">
          <div
            className="ai-progress-fill"
            style={{
              width: `${executingProgress.total > 0 ? (executingProgress.current / executingProgress.total) * 100 : 0}%`,
            }}
          />
        </div>
      )}

      {!isFinal && (
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--border-subtle)]">
          <span className="text-[12px] text-[var(--text-tertiary)]">
            {selectedCount} of {actions.length} selected
          </span>
          <Button
            type="button"
            size="sm"
            onClick={handleApply}
            disabled={selectedCount === 0 || isExecuting}
            className={cn(confirmDestructive && 'bg-[var(--destructive)] hover:bg-[var(--destructive)]/90')}
          >
            {isExecuting ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                Applying…
              </>
            ) : confirmDestructive ? (
              <>Confirm {selectedCount}</>
            ) : (
              <>Apply {selectedCount}</>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
