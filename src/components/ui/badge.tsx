import type * as React from 'react';
import { cn } from '@/lib/utils';

const badgeVariants = {
  default: 'bg-purple-600 dark:bg-purple-500 text-white',
  secondary: 'bg-gray-500/12 dark:bg-gray-500/24 text-gray-600 dark:text-gray-300',
  destructive: 'bg-red-500 text-white',
  outline: 'border border-[var(--border-glass)] text-gray-600 dark:text-gray-300',
  ghost: 'bg-gray-500/8 dark:bg-gray-500/18 text-gray-600 dark:text-gray-300',
};

export interface BadgeProps extends React.HTMLAttributes<HTMLElement> {
  variant?: keyof typeof badgeVariants;
}

function Badge({ className, variant = 'default', onClick, ...props }: BadgeProps) {
  const classes = cn(
    'inline-flex items-center rounded-[var(--radius-full)] px-2.5 py-0.5 text-[12px] font-medium transition-colors',
    badgeVariants[variant],
    className
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={cn(classes, 'border-0 cursor-pointer')}
        onClick={onClick}
        {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      />
    );
  }

  return (
    <div
      className={classes}
      {...props}
    />
  );
}

export { Badge };
