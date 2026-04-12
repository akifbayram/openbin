import { Check, ChevronRight } from 'lucide-react';
import { cn, flatCard, plural } from '@/lib/utils';
import type { ExecutionResult } from './useActionExecutor';

interface AiTurnExecutionResultProps {
  result: ExecutionResult;
  onBinClick: (binId: string, isTrashed?: boolean) => void;
}

export function AiTurnExecutionResult({ result, onBinClick }: AiTurnExecutionResultProps) {
  const completedCount = result.completedActionIndices.length;

  return (
    <div className={cn(flatCard, 'ai-turn-enter p-3 space-y-2')}>
      <div className="flex items-center gap-2 text-[14px] text-[var(--text-primary)]">
        <Check className="h-4 w-4 text-[var(--color-success)]" strokeWidth={3} />
        <span>
          Applied {completedCount} {plural(completedCount, 'change')}
          {result.failedCount > 0 && (
            <span className="text-[var(--destructive)]"> · {result.failedCount} failed</span>
          )}
        </span>
      </div>

      {result.createdBins && result.createdBins.length > 0 && (
        <div className="space-y-1.5 pt-1">
          {result.createdBins.map((bin) => (
            <button
              key={bin.id}
              type="button"
              onClick={() => onBinClick(bin.id, false)}
              className="flat-card w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-[var(--bg-active)] transition-colors rounded-[var(--radius-sm)]"
            >
              <span
                className="inline-flex size-6 items-center justify-center rounded-[var(--radius-xs)] text-[11px]"
                style={{ background: bin.color }}
                aria-hidden
              />
              <span className="flex-1 text-[13px] font-medium text-[var(--text-primary)] truncate">{bin.name}</span>
              <ChevronRight className="h-4 w-4 text-[var(--text-tertiary)]" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
