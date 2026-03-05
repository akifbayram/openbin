import { Check, Sparkles } from 'lucide-react';
import { AnimatedCheckmark } from '@/components/ui/animated-checkmark';
import { Button } from '@/components/ui/button';
import { BinRow } from '@/features/bins/BinCreateSuccess';
import { useTerminology } from '@/lib/terminology';
import { plural } from '@/lib/utils';
import { describeAction, getActionIcon, isBinCreatingAction } from './commandActionUtils';
import type { ExecutionResult } from './useActionExecutor';

interface CommandSuccessProps {
  result: ExecutionResult;
  onAskAnother: () => void;
  onClose: () => void;
  onBinClick: (binId: string) => void;
}

export function CommandSuccess({ result, onAskAnother, onClose, onBinClick }: CommandSuccessProps) {
  const t = useTerminology();
  const { completedActions, createdBins, failedCount } = result;

  const nonBinActions = completedActions.filter((a) => !isBinCreatingAction(a));

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <div className="relative flex items-center justify-center">
        <AnimatedCheckmark />
      </div>

      <div className="text-center scan-text-fade">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Success</h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          {completedActions.length} {plural(completedActions.length, 'action')} completed
          {failedCount > 0 && <> &middot; {failedCount} failed</>}
        </p>
      </div>

      {(createdBins.length > 0 || nonBinActions.length > 0) && (
        <div className="w-full scan-text-fade-delay">
          <div
            className="flex flex-col gap-2 overflow-y-auto"
            style={{ maxHeight: 200 }}
          >
            {createdBins.map((bin, idx) => (
              <div key={bin.id} className="ai-stagger-item" style={{ animationDelay: `${idx * 60}ms` }}>
                <BinRow bin={bin} showColor={createdBins.length > 1} onViewBin={onBinClick} />
              </div>
            ))}
            {nonBinActions.map((action, idx) => {
              const Icon = getActionIcon(action);
              const key = `${action.type}-${'bin_id' in action ? action.bin_id : ''}-${idx}`;
              return (
                <div
                  key={key}
                  className="ai-stagger-item flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]"
                  style={{ animationDelay: `${(createdBins.length + idx) * 60}ms` }}
                >
                  <Check className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
                  <Icon className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
                  <span className="truncate">{describeAction(action, t)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex w-full flex-col gap-2 scan-text-fade-delay">
        <Button className="w-full rounded-[var(--radius-full)]" onClick={onAskAnother}>
          <Sparkles className="mr-2 h-4 w-4" />
          Ask another
        </Button>
        <Button
          variant="ghost"
          className="w-full rounded-[var(--radius-full)]"
          onClick={onClose}
        >
          Done
        </Button>
      </div>
    </div>
  );
}
