import * as React from 'react';
import { cn } from '@/lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-11 w-full rounded-[var(--radius-sm)] bg-[var(--bg-input)] px-3.5 py-2.5 text-base text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-0 focus-visible:shadow-[0_0_0_4px_var(--accent-glow)] disabled:cursor-not-allowed disabled:opacity-40',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
