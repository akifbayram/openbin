import { ChevronLeft, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CommandActionList } from './CommandActionList';
import { isDestructiveAction } from './commandActionUtils';
import type { CommandAction } from './useCommand';

interface CommandActionPreviewProps {
  actions: CommandAction[];
  interpretation: string | null;
  checkedActions: Map<number, boolean>;
  toggleAction: (index: number) => void;
  selectedCount: number;
  isExecuting: boolean;
  executingProgress: { current: number; total: number };
  onBack: () => void;
  onExecute: () => void;
}

export function CommandActionPreview({
  actions,
  interpretation,
  checkedActions,
  toggleAction,
  selectedCount,
  isExecuting,
  executingProgress,
  onBack,
  onExecute,
}: CommandActionPreviewProps) {
  const [confirmDestructive, setConfirmDestructive] = useState(false);

  const destructiveCount = actions.filter(
    (a, i) => checkedActions.get(i) !== false && isDestructiveAction(a),
  ).length;

  function handleExecuteClick() {
    if (destructiveCount > 0 && !confirmDestructive) {
      setConfirmDestructive(true);
      return;
    }
    setConfirmDestructive(false);
    onExecute();
  }

  function handleToggle(i: number) {
    toggleAction(i);
    setConfirmDestructive(false);
  }

  return (
    <div className="space-y-4">
      <CommandActionList
        actions={actions}
        interpretation={interpretation}
        checkedActions={checkedActions}
        toggleAction={handleToggle}
        confirmDestructive={confirmDestructive && !isExecuting}
        destructiveCount={destructiveCount}
      />

      {isExecuting && (
        <div className="ai-progress-track">
          <div
            className="ai-progress-fill"
            style={{ width: `${executingProgress.total > 0 ? (executingProgress.current / executingProgress.total) * 100 : 0}%` }}
          />
        </div>
      )}

      <div className="flex gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-0.5" />
          Back
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleExecuteClick}
          disabled={selectedCount === 0 || isExecuting}
          className={cn('flex-1', confirmDestructive && 'bg-[var(--destructive)] hover:bg-[var(--destructive)]/90')}
        >
          {isExecuting ? (
            <>
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              Applying {executingProgress.current} of {executingProgress.total}...
            </>
          ) : confirmDestructive ? (
            <>Confirm {selectedCount} Change{selectedCount !== 1 ? 's' : ''}</>
          ) : (
            <>Apply {selectedCount} Change{selectedCount !== 1 ? 's' : ''}</>
          )}
        </Button>
      </div>
    </div>
  );
}
