import { Check, Sparkles, X } from 'lucide-react';
import { useMemo } from 'react';
import { AiProgressBar } from '@/components/ui/ai-progress-bar';
import { AnimatedEllipsis } from '@/components/ui/animated-ellipsis';
import { cn } from '@/lib/utils';
import { type AnalyzeStreamMode, computeAnalyzeLabel } from './analyzeLabel';

interface AiAnalyzeProgressProps {
  /** Whether a stream is active OR the lock-beat is playing. Drives bar fill + cancel visibility. */
  active: boolean;
  /** Whether the lock-beat (success flash) is playing. Switches the bar to its complete state. */
  complete?: boolean;
  /**
   * Mode driving the streamed label. Pass `'locking'` during the lock-beat so the label
   * reads "N items found"; pass `'analyze' | 'reanalyze' | 'correction'` while streaming.
   */
  mode: AnalyzeStreamMode;
  /** Streamed JSON text (for live item count). Empty during initial scan or non-streaming use. */
  partialText?: string;
  /** Cancel handler. When supplied AND the stream is active (not complete), renders the cancel button. */
  onCancel?: () => void;
  className?: string;
}

/**
 * Shared progress surface for AI photo analysis: bar + live label + cancel.
 *
 * Used by both single-bin AI Fill (BinCreateForm) and per-bin review
 * (GroupReviewStep). Caller controls the lock-beat (set `complete` and switch
 * `mode` to `'locking'`); this component just renders the visuals. Pair with
 * `<PhotoScanFrame>` over a host photo for the HUD overlay.
 *
 * The label row is an `<output aria-live>` region so screen readers announce
 * `"Found 3 items"` etc. as the JSON streams. The Sparkles icon pulses while
 * scanning, swaps to a green Check during the lock beat.
 */
export function AiAnalyzeProgress({
  active,
  complete = false,
  mode,
  partialText = '',
  onCancel,
  className,
}: AiAnalyzeProgressProps) {
  const labelState = useMemo(
    () => computeAnalyzeLabel({ mode, partialText, complete: false }),
    [mode, partialText],
  );
  const showCancel = !!onCancel && active && !complete;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <AiProgressBar
        active={active}
        complete={complete}
        showSparkles={false}
        className="w-full"
      />
      {labelState.text && (
        <output aria-live="polite" className="flex items-center gap-1.5 min-w-0">
          {complete ? (
            <Check className="h-3 w-3 shrink-0 text-[var(--color-success)]" />
          ) : (
            <Sparkles className="h-3 w-3 shrink-0 text-[var(--ai-accent)] ai-thinking-pulse" />
          )}
          <span
            className={cn(
              'flex-1 truncate text-[12px] font-medium',
              complete ? 'text-[var(--color-success)]' : 'text-[var(--text-tertiary)]',
            )}
          >
            {labelState.text}
            {labelState.showEllipsis && <AnimatedEllipsis />}
          </span>
          {showCancel && (
            <button
              type="button"
              aria-label="Cancel scan"
              onClick={onCancel}
              className="shrink-0 -my-1 inline-flex items-center gap-1 rounded-[var(--radius-sm)] px-1.5 py-1 text-[12px] font-medium text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)] transition-colors"
            >
              <X className="h-3 w-3" />
              Cancel
            </button>
          )}
        </output>
      )}
    </div>
  );
}
