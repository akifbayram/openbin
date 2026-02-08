import * as React from 'react';
import { cn } from '@/lib/utils';

const badgeVariants = {
  default: 'bg-[var(--accent)] text-[var(--text-on-accent)]',
  secondary: 'bg-[var(--bg-input)] text-[var(--text-secondary)]',
  destructive: 'bg-[var(--destructive)] text-[var(--text-on-accent)]',
  outline: 'border border-[var(--border-glass)] text-[var(--text-secondary)]',
};

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: keyof typeof badgeVariants;
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-[var(--radius-full)] px-2.5 py-0.5 text-[12px] font-medium transition-colors',
        badgeVariants[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge };
