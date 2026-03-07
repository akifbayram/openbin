import * as React from 'react';
import { cn, inputBase } from '@/lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        autoComplete="off"
        className={cn('flex h-11', inputBase, 'focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-0 focus-visible:shadow-[0_0_0_4px_var(--accent-glow)]', className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
