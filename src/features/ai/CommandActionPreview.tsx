import { Check, ChevronLeft, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@chakra-ui/react';
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

  return (
    <div className="space-y-4">
      {interpretation && (
        <div className="flex items-start gap-2 rounded-[var(--radius-sm)] bg-purple-600/5 dark:bg-purple-500/5 px-3 py-2">
          <Sparkles className="h-4 w-4 shrink-0 mt-0.5 text-purple-600 dark:text-purple-400" />
          <p className="text-[13px] text-gray-600 dark:text-gray-300 italic">
            {interpretation}
          </p>
        </div>
      )}

      {actions.length === 0 ? (
        <p className="text-[14px] text-gray-500 dark:text-gray-400 py-4 text-center">
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
                  onClick={() => toggleAction(i)}
                  className="flex items-start gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-2 hover:bg-gray-500/16 dark:hover:bg-gray-500/28 transition-colors cursor-pointer w-full text-left"
                >
                  <span
                    key={`check-${i}-${checked}`}
                    className={cn(
                      'shrink-0 mt-0.5 h-4.5 w-4.5 rounded border flex items-center justify-center transition-colors',
                      checked
                        ? destructive
                          ? 'bg-red-500 border-red-500'
                          : 'bg-purple-600 dark:bg-purple-500 border-purple-600 dark:border-purple-500 ai-check-pop'
                        : 'border-black/6 dark:border-white/6 bg-transparent',
                    )}
                  >
                    {checked && <Check className="h-3 w-3 text-white" />}
                  </span>
                  <Icon className={cn(
                    'h-4 w-4 shrink-0 mt-0.5',
                    !checked
                      ? 'text-gray-500 dark:text-gray-400'
                      : destructive
                        ? 'text-red-500 dark:text-red-400'
                        : 'text-gray-600 dark:text-gray-300'
                  )} />
                  <span className={cn(
                    'text-[14px] leading-snug',
                    !checked
                      ? 'text-gray-500 dark:text-gray-400 line-through'
                      : destructive
                        ? 'text-red-500 dark:text-red-400'
                        : ''
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

      <div className="flex gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-0.5" />
          Back
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onExecute}
          disabled={selectedCount === 0 || isExecuting}
          className="flex-1"
        >
          {isExecuting ? (
            <>
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              Applying {executingProgress.current} of {executingProgress.total}...
            </>
          ) : (
            <>Apply {selectedCount} Change{selectedCount !== 1 ? 's' : ''}</>
          )}
        </Button>
      </div>
    </div>
  );
}
