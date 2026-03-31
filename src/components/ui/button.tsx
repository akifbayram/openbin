import * as React from 'react';
import { cn, focusRing } from '@/lib/utils';

const variants = {
  default:
    'bg-[var(--accent)] text-[var(--text-on-accent)] hover:bg-[var(--accent-hover)] active:bg-[var(--accent-active)]',
  destructive:
    'bg-[var(--destructive)] text-[var(--text-on-accent)] hover:bg-[var(--destructive-hover)] active:bg-[var(--destructive-active)]',
  'destructive-ghost':
    'text-[var(--destructive)] hover:bg-[var(--destructive)]/10 active:bg-[var(--destructive)]/15',
  'destructive-outline':
    'bg-[var(--bg-input)] border border-[var(--destructive)]/30 text-[var(--destructive)] hover:bg-[var(--destructive)]/10 active:bg-[var(--destructive)]/15',
  outline:
    'bg-[var(--bg-input)] border border-[var(--border-flat)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] active:bg-[var(--bg-active)]',
  secondary:
    'bg-[var(--bg-input)] text-[var(--text-primary)] hover:bg-[var(--bg-active)]',
  ghost:
    'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] active:bg-[var(--bg-active)]',
  link:
    'text-[var(--accent)] underline-offset-4 hover:underline',
};

const sizes = {
  default: 'h-11 px-5 py-2.5',
  sm: 'h-9 px-3.5 text-[13px]',
  lg: 'h-12 px-8',
  icon: 'h-11 w-11',
  'icon-sm': 'h-8 w-8',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  fullWidth?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', fullWidth, ...props }, ref) => {
    return (
      <button
        className={cn(
          'inline-flex items-center justify-center whitespace-nowrap rounded-[var(--radius-md)] text-[15px] font-semibold transition-colors duration-150',
          focusRing,
          'disabled:pointer-events-none disabled:opacity-40',
          variants[variant],
          sizes[size],
          fullWidth && 'w-full',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button };
