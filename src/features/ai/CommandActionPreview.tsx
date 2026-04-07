import { AlertTriangle, Check, ChevronLeft, Loader2, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useTerminology } from '@/lib/terminology';
import { cn } from '@/lib/utils';
import { describeAction, getActionIcon, isDestructiveAction } from './commandActionUtils';
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
  const t = useTerminology();
  const [confirmDestructive, setConfirmDestructive] = useState(false);

  const destructiveCount = actions.filter((a, i) => checkedActions.get(i) !== false && isDestructiveAction(a)).length;

  function handleExecuteClick() {
    if (destructiveCount > 0 && !confirmDestructive) {
      setConfirmDestructive(true);
      return;
    }
    setConfirmDestructive(false);
    onExecute();
  }

  return (
    <div className="space-y-4">
      {interpretation && (
        <div className="flex items-start gap-2 rounded-[var(--radius-sm)] bg-[var(--accent)]/5 px-3 py-2">
          <Sparkles className="h-4 w-4 shrink-0 mt-0.5 text-[var(--accent)]" />
          <p className="text-[13px] text-[var(--text-secondary)] italic">
            {interpretation}
          </p>
        </div>
      )}

      {actions.length === 0 ? (
        <p className="text-[14px] text-[var(--text-tertiary)] py-4 text-center">
          No matching {t.bins} found, or the command was ambiguous. Try using exact {t.bin} names.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {actions.map((action, i) => {
            const checked = checkedActions.get(i) !== false;
            const Icon = getActionIcon(action);
            const destructive = isDestructiveAction(action);
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: actions identified by index
              <li key={i} className="ai-stagger-item" style={{ animationDelay: `${Math.min(i * 50, 500)}ms` }}>
                <button
                  type="button"
                  onClick={() => { toggleAction(i); setConfirmDestructive(false); }}
                  className="flex items-start gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-2 hover:bg-[var(--bg-active)] transition-colors cursor-pointer w-full text-left"
                >
                  <span
                    key={`check-${i}-${checked}`}
                    className={cn(
                      'shrink-0 mt-0.5 h-4.5 w-4.5 rounded border-2 flex items-center justify-center transition-colors',
                      checked
                        ? destructive
                          ? 'bg-[var(--destructive)] border-[var(--destructive)]'
                          : 'bg-[var(--accent)] border-[var(--accent)] ai-check-pop'
                        : 'border-[var(--text-tertiary)] bg-transparent',
                    )}
                  >
                    {checked && <Check className="h-3 w-3 text-[var(--text-on-accent)] animate-check-pop" strokeWidth={3} />}
                  </span>
                  <Icon className={cn(
                    'h-4 w-4 shrink-0 mt-0.5',
                    !checked
                      ? 'text-[var(--text-tertiary)]'
                      : destructive
                        ? 'text-[var(--destructive)]'
                        : 'text-[var(--text-secondary)]'
                  )} />
                  <span className={cn(
                    'text-[14px] leading-snug',
                    !checked
                      ? 'text-[var(--text-tertiary)] line-through'
                      : destructive
                        ? 'text-[var(--destructive)]'
                        : 'text-[var(--text-primary)]'
                  )}>
                    {describeAction(action, t)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {isExecuting && (
        <div className="ai-progress-track">
          <div
            className="ai-progress-fill"
            style={{ width: `${executingProgress.total > 0 ? (executingProgress.current / executingProgress.total) * 100 : 0}%` }}
          />
        </div>
      )}

      {/* Destructive confirmation inline banner */}
      {confirmDestructive && !isExecuting && (
        <div className="flex items-start gap-2 rounded-[var(--radius-sm)] bg-[var(--destructive)]/10 px-3 py-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-[var(--destructive)]" />
          <p className="text-[13px] text-[var(--destructive)]">
            {destructiveCount} destructive action{destructiveCount !== 1 ? 's' : ''} selected. Click apply again to confirm.
          </p>
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
