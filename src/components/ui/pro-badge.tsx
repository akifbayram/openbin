import { cn } from '@/lib/utils';

interface ProBadgeProps {
  className?: string;
}

export function ProBadge({ className }: ProBadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center rounded-md bg-[var(--accent)]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--accent)] uppercase tracking-wide',
      className
    )}>
      Pro
    </span>
  );
}
