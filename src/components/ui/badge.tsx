import type * as React from 'react';
import { cn, focusRingInset } from '@/lib/utils';

const badgeVariants = {
  default: 'bg-[var(--accent)] text-[var(--text-on-accent)]',
  secondary: 'bg-[var(--bg-input)] text-[var(--text-secondary)]',
  destructive: 'bg-[var(--destructive)] text-[var(--text-on-accent)]',
  outline: 'border border-[var(--border-glass)] text-[var(--text-secondary)]',
};

const BASE = 'inline-flex items-center rounded-[var(--radius-full)] px-2.5 py-0.5 text-[12px] font-medium transition-colors';

export interface BadgeProps {
  variant?: keyof typeof badgeVariants;
  className?: string;
  style?: React.CSSProperties;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  children?: React.ReactNode;
}

function Badge({ className, variant = 'default', onClick, style, children }: BadgeProps) {
  if (onClick) {
    return (
      <button
        type="button"
        className={cn(BASE, badgeVariants[variant], 'border-0 cursor-pointer', focusRingInset, className)}
        onClick={onClick}
        style={style}
      >
        {children}
      </button>
    );
  }

  return (
    <div
      className={cn(BASE, badgeVariants[variant], className)}
      style={style}
    >
      {children}
    </div>
  );
}

export { Badge };
