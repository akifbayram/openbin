import { cn } from '@/lib/utils';

export type ProgressTone = 'neutral' | 'amber' | 'red';

interface ProgressBarProps {
  value: number;             // 0-100
  tone?: ProgressTone;
  className?: string;
  ariaLabel: string;
}

const TONE_CLASSES: Record<ProgressTone, string> = {
  neutral: 'bg-emerald-500 dark:bg-emerald-400',
  amber:   'bg-amber-500 dark:bg-amber-400',
  red:     'bg-red-500 dark:bg-red-400',
};

export function ProgressBar({ value, tone = 'neutral', className, ariaLabel }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      className={cn('h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden', className)}
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn('h-full transition-[width]', TONE_CLASSES[tone])}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
