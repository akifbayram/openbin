import * as React from 'react';
import { cn } from '@/lib/utils';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[100px] w-full rounded-[var(--radius-md)] bg-[var(--bg-input)] px-3.5 py-2.5 text-base text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-0 focus-visible:shadow-[0_0_0_4px_var(--accent-glow)] disabled:cursor-not-allowed disabled:opacity-40 resize-none',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export { Textarea };
