import * as React from 'react';
import { cn } from '@/lib/utils';

const variants = {
  default:
    'bg-[var(--accent)] text-[var(--text-on-accent)] hover:bg-[var(--accent-hover)] active:scale-[0.97]',
  destructive:
    'bg-[var(--destructive)] text-[var(--text-on-accent)] hover:bg-[var(--destructive-hover)] active:scale-[0.97]',
  outline:
    'glass-card text-[var(--text-primary)] hover:bg-[var(--bg-hover)] active:bg-[var(--bg-active)]',
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
  icon: 'h-10 w-10',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        className={cn(
          'inline-flex items-center justify-center whitespace-nowrap rounded-[var(--radius-md)] text-[15px] font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40',
          variants[variant],
          sizes[size],
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
