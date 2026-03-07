import { Check, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface AiProgressBarProps {
  /** Whether the AI operation is actively running */
  active: boolean;
  /** Whether the AI response has been fully received */
  complete?: boolean;
  /** Status text shown below the bar */
  label?: string;
  /** Show elapsed time counter */
  showElapsed?: boolean;
  /** Compact height variant for inline use */
  compact?: boolean;
  className?: string;
}

function useElapsed(enabled: boolean) {
  const start = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    start.current = Date.now();
    setElapsed(0);
    const id = setInterval(() => setElapsed(Date.now() - start.current), 1000);
    return () => clearInterval(id);
  }, [enabled]);

  const secs = Math.floor(elapsed / 1000);
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

/**
 * Asymptotic progress: rises quickly at first then decelerates,
 * approaching but never reaching `ceiling`. Uses exponential decay:
 * progress = ceiling * (1 - e^(-t / tau))
 */
function useAsymptoticProgress(active: boolean, complete: boolean) {
  const [progress, setProgress] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    if (complete) {
      setProgress(100);
      return;
    }
    if (!active) {
      setProgress(0);
      startRef.current = Date.now();
      return;
    }

    startRef.current = Date.now();
    setProgress(0);

    const ceiling = 92;
    const tau = 12_000; // time constant in ms — reaches ~63% of ceiling at tau

    const id = setInterval(() => {
      const t = Date.now() - startRef.current;
      setProgress(ceiling * (1 - Math.exp(-t / tau)));
    }, 200);

    return () => clearInterval(id);
  }, [active, complete]);

  return Math.min(100, Math.round(progress));
}

export function AiProgressBar({
  active,
  complete = false,
  label,
  showElapsed = false,
  compact = false,
  className,
}: AiProgressBarProps) {
  const progress = useAsymptoticProgress(active, complete);
  const elapsed = useElapsed(active);

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {/* Track */}
      <div
        className={cn(
          'ai-progress-track relative overflow-hidden rounded-full',
          'bg-[var(--bg-input)] border border-[var(--border-glass)]',
          compact ? 'h-1.5' : 'h-2',
        )}
      >
        {/* Glow backdrop */}
        <div
          className={cn(
            'absolute inset-0 rounded-full',
            complete ? 'ai-progress-glow-complete' : 'ai-progress-glow',
          )}
        />

        {/* Fill */}
        <div
          className={cn(
            'absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out',
            complete ? 'ai-progress-fill-complete' : 'ai-progress-fill',
          )}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Label row */}
      {(label || showElapsed) && (
        <div className="flex items-center justify-between gap-2">
          {label && (
            <div className="flex items-center gap-1.5 min-w-0">
              {complete ? (
                <Check className="h-3 w-3 text-emerald-500 shrink-0" />
              ) : (
                <Sparkles className="h-3 w-3 text-[var(--ai-accent)] shrink-0 ai-thinking-pulse" />
              )}
              <span
                className={cn(
                  'text-[12px] font-medium truncate',
                  complete ? 'text-emerald-500' : 'text-[var(--text-tertiary)]',
                )}
              >
                {label}
              </span>
            </div>
          )}
          {showElapsed && (
            <span className="text-[11px] tabular-nums text-[var(--text-tertiary)] shrink-0">
              {elapsed}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
