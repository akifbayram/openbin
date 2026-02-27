import { Loader2, ChevronLeft, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTerminology } from '@/lib/terminology';
import type { CommandAction } from './useCommand';
import { isDestructiveAction, getActionIcon, describeAction } from './commandActionUtils';

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

  return (
    <div className="space-y-4">
      {interpretation && (
        <p className="text-[13px] text-[var(--text-secondary)] italic">
          {interpretation}
        </p>
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
              <li key={i}>
                <button
                  type="button"
                  onClick={() => toggleAction(i)}
                  className="flex items-start gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-2 hover:bg-[var(--bg-active)] transition-colors cursor-pointer w-full text-left"
                >
                  <span
                    className={`shrink-0 mt-0.5 h-4.5 w-4.5 rounded border flex items-center justify-center transition-colors ${
                      checked
                        ? destructive
                          ? 'bg-[var(--destructive)] border-[var(--destructive)]'
                          : 'bg-[var(--accent)] border-[var(--accent)]'
                        : 'border-[var(--border-primary)] bg-transparent'
                    }`}
                  >
                    {checked && <Check className="h-3 w-3 text-white" />}
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

      <div className="flex gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onBack} className="rounded-[var(--radius-full)]">
          <ChevronLeft className="h-4 w-4 mr-0.5" />
          Back
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onExecute}
          disabled={selectedCount === 0 || isExecuting}
          className="flex-1 rounded-[var(--radius-full)]"
        >
          {isExecuting ? (
            <>
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              Executing {executingProgress.current} of {executingProgress.total}...
            </>
          ) : (
            <>Execute {selectedCount} Action{selectedCount !== 1 ? 's' : ''}</>
          )}
        </Button>
      </div>
    </div>
  );
}
